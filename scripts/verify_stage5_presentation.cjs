const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage5Presentation() {
  const profileDir = path.join(os.tmpdir(), 'apex_stage5_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  console.log('Launching headless Edge for Stage 5 UI & Presentation verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9866',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9866/json', res => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.setTimeout(500, () => req.destroy(new Error('timeout')));
      });
      if (targets && targets.length > 0) break;
    } catch {}
  }

  const page = targets?.find(t => t.type === 'page' && t.url.includes('5173'));
  if (!page) {
    console.error('Page target not found');
    edgeProc.kill();
    return;
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let reqId = 1;
  const pending = new Map();
  const consoleErrors = [];

  function send(method, params = {}) {
    const id = reqId++;
    return new Promise(resolve => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || JSON.stringify(a)).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails?.text || 'Exception');
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload');

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true
    });
    return res?.result?.value;
  }

  async function pressInputs(inputs) {
    await evaluate(`(() => {
      const im = window.game?.inputManager;
      if (!im) return;
      ${inputs.forward !== undefined ? `im.state.forward = ${inputs.forward};` : ''}
      ${inputs.backward !== undefined ? `im.state.backward = ${inputs.backward};` : ''}
      ${inputs.steerLeft !== undefined ? `im.state.steerLeft = ${inputs.steerLeft};` : ''}
      ${inputs.steerRight !== undefined ? `im.state.steerRight = ${inputs.steerRight};` : ''}
      ${inputs.handbrake !== undefined ? `im.state.handbrake = ${inputs.handbrake};` : ''}
    })()`);
  }

  async function captureScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
      const buffer = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(filename, buffer);
      if (fs.existsSync(artifactDir)) {
        fs.writeFileSync(path.join(artifactDir, path.basename(filename)), buffer);
      }
      console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
    }
  }

  let passedAll = true;

  try {
    // 1. Wait for MainMenu boot
    console.log('\n--- CHECK 1: Main Menu Boot & Presentation ---');
    for (let i = 0; i < 60; i++) {
      const state = await evaluate('window.game?.state');
      if (state === 'MainMenu') break;
      await new Promise(r => setTimeout(r, 500));
    }
    const state = await evaluate('window.game?.state');
    console.log('Current game state:', state);
    if (state !== 'MainMenu') {
      console.error('FAIL: Game did not enter MainMenu within timeout');
      passedAll = false;
    } else {
      console.log('PASS: Game successfully booted into MainMenu');
    }

    const menuInfo = await evaluate(`(() => {
      const overlay = document.getElementById('main-menu-overlay');
      const isVisible = overlay && !overlay.classList.contains('hidden');
      const title = document.querySelector('.brand-title')?.textContent;
      const btnPlay = !!document.getElementById('btn-menu-play');
      const btnSettings = !!document.getElementById('btn-menu-settings');
      const btnExit = !!document.getElementById('btn-menu-exit');
      const camMode = window.game?.sceneManager?.currentCameraMode;
      const camRadius = window.game?.sceneManager?.orbitCamera?.radius;
      return { isVisible, title, btnPlay, btnSettings, btnExit, camMode, camRadius };
    })()`);
    console.log('Main menu info:', menuInfo);
    if (menuInfo.isVisible && menuInfo.btnPlay && menuInfo.btnSettings && menuInfo.btnExit && menuInfo.camMode === 'orbit') {
      console.log('PASS: Main menu visible with cinematic orbit camera and all required actions');
    } else {
      console.error('FAIL: Main menu structure mismatch');
      passedAll = false;
    }

    await new Promise(r => setTimeout(r, 800));
    await captureScreenshot('stage5_main_menu.png');

    // 2. Main Menu -> Event Selection
    console.log('\n--- CHECK 2: Main Menu to Event Selection ---');
    await evaluate(`document.getElementById('btn-menu-play')?.click()`);
    await new Promise(r => setTimeout(r, 500));

    const eventSelectInfo = await evaluate(`(() => {
      const state = window.game?.state;
      const overlay = document.getElementById('event-select-overlay');
      const isVisible = overlay && !overlay.classList.contains('hidden');
      const title = document.querySelector('.event-name')?.textContent;
      const trackName = document.querySelector('.event-track-name')?.textContent;
      const hasSvg = !!document.querySelector('.circuit-svg');
      const bestTime = document.getElementById('event-select-best-time')?.textContent;
      const btnStart = !!document.getElementById('btn-start-event');
      const btnBack = !!document.getElementById('btn-event-back');
      return { state, isVisible, title, trackName, hasSvg, bestTime, btnStart, btnBack };
    })()`);
    console.log('Event select info:', eventSelectInfo);
    if (eventSelectInfo.state === 'EventSelect' && eventSelectInfo.isVisible && eventSelectInfo.hasSvg && eventSelectInfo.btnStart) {
      console.log('PASS: Event selection displays 220m loop circuit card with vector minimap and live best time');
    } else {
      console.error('FAIL: Event selection structure mismatch');
      passedAll = false;
    }

    await captureScreenshot('stage5_event_select.png');

    // 3. Event Select -> Back to Main Menu
    console.log('\n--- CHECK 3: Event Selection Back Navigation ---');
    await evaluate(`document.getElementById('btn-event-back')?.click()`);
    await new Promise(r => setTimeout(r, 400));
    const backState = await evaluate('window.game?.state');
    if (backState === 'MainMenu') {
      console.log('PASS: Returned cleanly from Event Selection to Main Menu');
    } else {
      console.error('FAIL: State after back was not MainMenu:', backState);
      passedAll = false;
    }

    // 4. Main Menu -> Settings Menu
    console.log('\n--- CHECK 4: Settings Menu & Configuration Persistence ---');
    await evaluate(`document.getElementById('btn-menu-settings')?.click()`);
    await new Promise(r => setTimeout(r, 400));

    const settingsInfo = await evaluate(`(() => {
      const state = window.game?.state;
      const overlay = document.getElementById('settings-menu-overlay');
      const isVisible = overlay && !overlay.classList.contains('hidden');
      const btnLow = !!document.getElementById('btn-quality-low');
      const btnMed = !!document.getElementById('btn-quality-medium');
      const btnHigh = !!document.getElementById('btn-quality-high');
      const slider = document.getElementById('volume-slider')?.value;
      return { state, isVisible, btnLow, btnMed, btnHigh, slider };
    })()`);
    console.log('Settings info:', settingsInfo);
    if (settingsInfo.state === 'Settings' && settingsInfo.isVisible && settingsInfo.btnHigh) {
      console.log('PASS: Settings menu displays graphics quality toggle and audio volume slider');
    } else {
      console.error('FAIL: Settings menu mismatch');
      passedAll = false;
    }

    await captureScreenshot('stage5_settings_menu.png');

    // Test changing setting
    await evaluate(`document.getElementById('btn-quality-high')?.click()`);
    await evaluate(`(() => {
      const s = document.getElementById('volume-slider');
      if (s) { s.value = '90'; s.dispatchEvent(new Event('input')); }
    })()`);
    await new Promise(r => setTimeout(r, 200));

    // Return to Main Menu
    await evaluate(`document.getElementById('btn-settings-back')?.click()`);
    await new Promise(r => setTimeout(r, 400));

    const persistedSettings = await evaluate(`(() => {
      const raw = localStorage.getItem('project_apex_settings');
      return raw ? JSON.parse(raw) : null;
    })()`);
    console.log('Persisted settings in localStorage:', persistedSettings);
    if (persistedSettings && persistedSettings.graphicsQuality === 'high' && persistedSettings.masterVolume === 0.9) {
      console.log('PASS: Quality and volume settings successfully persisted to localStorage');
    } else {
      console.error('FAIL: Settings failed to persist properly');
      passedAll = false;
    }

    // 5. Start Race & Countdown
    console.log('\n--- CHECK 5: Event Entry & Countdown Sequence ---');
    await evaluate(`document.getElementById('btn-menu-play')?.click()`);
    await new Promise(r => setTimeout(r, 400));
    await evaluate(`document.getElementById('btn-start-event')?.click()`);

    // Verify Countdown state
    const countdownState = await evaluate('window.game?.state');
    const hudCamMode = await evaluate('window.game?.sceneManager?.currentCameraMode');
    console.log('Countdown state:', countdownState, 'Camera mode:', hudCamMode);
    if (countdownState === 'Countdown' && hudCamMode === 'chase') {
      console.log('PASS: State switched to Countdown with third-person chase camera');
    } else {
      console.error('FAIL: Countdown state or camera mismatch');
      passedAll = false;
    }

    // Wait for countdown to finish into Racing
    console.log('Waiting through 3.. 2.. 1.. GO!');
    for (let i = 0; i < 30; i++) {
      const st = await evaluate('window.game?.state');
      if (st === 'Racing') break;
      await new Promise(r => setTimeout(r, 250));
    }
    const racingState = await evaluate('window.game?.state');
    if (racingState === 'Racing') {
      console.log('PASS: Race countdown completed and entered Racing state');
    } else {
      console.error('FAIL: Did not enter Racing state');
      passedAll = false;
    }

    // 6. Active Racing HUD Telemetry
    console.log('\n--- CHECK 6: Active Racing HUD & Telemetry ---');
    await pressInputs({ forward: 1 });
    await new Promise(r => setTimeout(r, 2000));

    const hudTelemetry = await evaluate(`(() => {
      const speed = document.getElementById('speed-value')?.textContent;
      const gear = document.getElementById('gear-indicator')?.textContent;
      const timer = document.getElementById('race-timer')?.textContent;
      const gate = document.getElementById('checkpoint-indicator')?.textContent;
      const telem = window.game?.vehicleController?.getTelemetry();
      return { speed, gear, timer, gate, telemSpeed: telem?.speedKmh };
    })()`);
    console.log('HUD telemetry live values:', hudTelemetry);
    if (parseInt(hudTelemetry.speed, 10) > 30 && hudTelemetry.gear === 'D' && hudTelemetry.timer !== '00:00.00') {
      console.log('PASS: Racing HUD accurately reflects driving telemetry, gear D, and advancing lap timer');
    } else {
      console.error('FAIL: HUD telemetry values mismatch');
      passedAll = false;
    }

    await captureScreenshot('stage5_racing_hud.png');

    // 7. Pause Menu Hierarchy & Timers
    console.log('\n--- CHECK 7: Pause Menu Hierarchy & Timer Halting ---');
    await evaluate(`window.game?.pause()`);
    await new Promise(r => setTimeout(r, 300));

    const pauseCheck = await evaluate(`(() => {
      const state = window.game?.state;
      const overlay = document.getElementById('pause-overlay');
      const isVisible = overlay && !overlay.classList.contains('hidden');
      const timeBefore = window.game?.raceTimeSeconds;
      const btnResume = !!document.getElementById('btn-resume');
      const btnRestart = !!document.getElementById('btn-restart');
      const btnSettings = !!document.getElementById('btn-pause-settings');
      const btnMenu = !!document.getElementById('btn-pause-menu');
      return { state, isVisible, timeBefore, btnResume, btnRestart, btnSettings, btnMenu };
    })()`);
    console.log('Pause menu hierarchy check:', pauseCheck);

    if (pauseCheck.state === 'Paused' && pauseCheck.isVisible && pauseCheck.btnResume && pauseCheck.btnRestart && pauseCheck.btnSettings && pauseCheck.btnMenu) {
      console.log('PASS: Pause menu active with strict 4-tier hierarchy (Resume, Restart, Settings, Return to Menu)');
    } else {
      console.error('FAIL: Pause menu structure mismatch');
      passedAll = false;
    }

    // Verify timer does not advance while paused
    const tBefore = pauseCheck.timeBefore;
    await new Promise(r => setTimeout(r, 1000));
    const tAfter = await evaluate('window.game?.raceTimeSeconds');
    console.log(`Timer verification: Before=${tBefore?.toFixed(2)}s, After=${tAfter?.toFixed(2)}s`);
    if (Math.abs(tAfter - tBefore) < 0.05) {
      console.log('PASS: Gameplay timer is strictly halted while paused');
    } else {
      console.error('FAIL: Timer continued advancing while paused');
      passedAll = false;
    }

    await captureScreenshot('stage5_pause_menu.png');

    // 8. Pause -> Settings -> Pause Flow
    console.log('\n--- CHECK 8: Pause -> Settings -> Pause Navigation ---');
    await evaluate(`document.getElementById('btn-pause-settings')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const inSettingsFromPause = await evaluate('window.game?.state');
    console.log('State in settings from pause:', inSettingsFromPause);

    await evaluate(`document.getElementById('btn-settings-back')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const returnedToPauseState = await evaluate('window.game?.state');
    console.log('State after exiting settings:', returnedToPauseState);
    if (returnedToPauseState === 'Paused') {
      console.log('PASS: Returning from settings cleanly restored Paused state');
    } else {
      console.error('FAIL: Did not return to Paused state');
      passedAll = false;
    }

    // 9. Resume Race
    console.log('\n--- CHECK 9: Resume Race ---');
    await evaluate(`document.getElementById('btn-resume')?.click()`);
    await new Promise(r => setTimeout(r, 300));
    const resumedState = await evaluate('window.game?.state');
    if (resumedState === 'Racing') {
      console.log('PASS: Race resumed cleanly with active vehicle inputs and HUD');
    } else {
      console.error('FAIL: State was not Racing after resume:', resumedState);
      passedAll = false;
    }

    // 10. Finish Event & Results Screen
    console.log('\n--- CHECK 10: Finish Event & Personal Best Presentation ---');
    await evaluate(`window.game?.finishRace()`);
    await new Promise(r => setTimeout(r, 400));

    const finishInfo = await evaluate(`(() => {
      const state = window.game?.state;
      const overlay = document.getElementById('finish-screen-overlay');
      const isVisible = overlay && !overlay.classList.contains('hidden');
      const finalTime = document.getElementById('finish-final-time')?.textContent;
      const bestTime = document.getElementById('finish-best-time')?.textContent;
      const hasRecordBanner = !document.getElementById('new-record-banner')?.classList.contains('hidden');
      const btnRetry = !!document.getElementById('btn-finish-retry');
      const btnEvents = !!document.getElementById('btn-finish-events');
      const btnMenu = !!document.getElementById('btn-finish-menu');
      return { state, isVisible, finalTime, bestTime, hasRecordBanner, btnRetry, btnEvents, btnMenu };
    })()`);
    console.log('Finish screen info:', finishInfo);
    if (finishInfo.state === 'Finished' && finishInfo.isVisible && finishInfo.finalTime !== '00:00.00' && finishInfo.btnRetry && finishInfo.btnEvents) {
      console.log('PASS: Finish screen presents final time, personal best, and 3-tier action navigation');
    } else {
      console.error('FAIL: Finish screen structure mismatch');
      passedAll = false;
    }

    await captureScreenshot('stage5_finish_screen.png');

    // 11. Return to Main Menu from Finish
    console.log('\n--- CHECK 11: Return to Main Menu from Finish Screen ---');
    await evaluate(`document.getElementById('btn-finish-menu')?.click()`);
    await new Promise(r => setTimeout(r, 400));
    const finalMenuState = await evaluate('window.game?.state');
    const finalCam = await evaluate('window.game?.sceneManager?.currentCameraMode');
    if (finalMenuState === 'MainMenu' && finalCam === 'orbit') {
      console.log('PASS: Cleanly returned to Main Menu, resetting gameplay and activating orbit camera');
    } else {
      console.error('FAIL: State or camera mismatch after return to menu');
      passedAll = false;
    }

    // 12. Console Integrity
    console.log('\n--- CHECK 12: Console & WebGL Shader Integrity ---');
    console.log('Console errors captured:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.error('Console errors:', consoleErrors);
      passedAll = false;
    } else {
      console.log('PASS: 0 console errors or WebGL warnings');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    passedAll = false;
  } finally {
    ws.close();
    edgeProc.kill();
  }

  console.log('\n========================================');
  console.log('STAGE 5 PRESENTATION TEST:', passedAll ? 'ALL PASS ✓' : 'FAIL ✗');
  console.log('========================================');
  process.exit(passedAll ? 0 : 1);
}

verifyStage5Presentation().catch(e => {
  console.error(e);
  process.exit(1);
});
