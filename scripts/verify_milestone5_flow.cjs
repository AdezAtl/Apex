const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyMilestone5() {
  const profileDir = path.join(os.tmpdir(), 'apex_m5_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Milestone 5 Full Event Flow testing...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9788',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9788/json', res => {
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
    console.error('Page target not found:', targets);
    edgeProc.kill();
    return;
  }

  console.log(`Connected to page: "${page.title}" (${page.url})`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  const consoleLogs = [];
  const errors = [];
  let reqId = 1;
  const pending = new Map();

  function send(method, params = {}) {
    const id = reqId++;
    return new Promise(resolve => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const text = msg.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
      consoleLogs.push({ type, text });
      if (type === 'error') errors.push(text);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails?.text || 'Exception thrown');
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');

  console.log('Reloading page...');
  await send('Page.reload');

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true
    });
    return res?.result?.value;
  }

  async function sendKey(code, type = 'keyDown') {
    await send('Input.dispatchKeyEvent', {
      type: type,
      code: code,
      key: code === 'Escape' ? 'Escape' : code.replace('Key', '').toLowerCase()
    });
  }

  console.log('Waiting for engine initialization and Main Menu...');
  let bootReady = false;
  for (let i = 0; i < 30; i++) {
    const state = await evaluate('window.game?.state');
    if (state === 'MainMenu') {
      bootReady = true;
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!bootReady) {
    console.error('Failed to reach MainMenu state');
    edgeProc.kill();
    return;
  }

  console.log('\n--- Test 1: Boot & Main Menu Verification ---');
  const mainMenuCheck = await evaluate(`(() => {
    const g = window.game;
    const overlay = document.getElementById('main-menu-overlay');
    const hud = document.getElementById('racing-hud');
    return {
      state: g.state,
      isMenuVisible: overlay && !overlay.classList.contains('hidden'),
      isHudHidden: hud ? hud.style.display === 'none' : false,
      playBtn: !!document.getElementById('btn-menu-play'),
      settingsBtn: !!document.getElementById('btn-menu-settings'),
      exitBtn: !!document.getElementById('btn-menu-exit'),
    };
  })()`);
  console.log('Main Menu State:', mainMenuCheck);

  console.log('\n--- Test 2: Settings & Graphics Quality Verification ---');
  await evaluate('document.getElementById("btn-menu-settings")?.click()');
  await new Promise(r => setTimeout(r, 200));

  const settingsOpen = await evaluate('window.game.state');
  console.log('State after opening settings:', settingsOpen);

  // Toggle Low quality
  await evaluate('document.getElementById("btn-quality-low")?.click()');
  const lowScale = await evaluate('window.game.sceneManager.engine.getHardwareScalingLevel()');
  console.log('Low Quality Hardware Scaling Level (expected 1.5):', lowScale);

  // Toggle Medium quality
  await evaluate('document.getElementById("btn-quality-medium")?.click()');
  const medScale = await evaluate('window.game.sceneManager.engine.getHardwareScalingLevel()');
  console.log('Medium Quality Hardware Scaling Level (expected 1.0):', medScale);

  // Adjust volume
  await evaluate(`(() => {
    const s = document.getElementById('volume-slider');
    if (s) {
      s.value = '60';
      s.dispatchEvent(new Event('input'));
    }
  })()`);
  const volumeCheck = await evaluate('window.game.soundManager.getVolume()');
  console.log('Sound Manager volume (expected 0.6):', volumeCheck);

  // Close Settings
  await evaluate('document.getElementById("btn-settings-back")?.click()');
  await new Promise(r => setTimeout(r, 200));
  const backToMenu = await evaluate('window.game.state');
  console.log('State after returning from settings (expected MainMenu):', backToMenu);

  console.log('\n--- Test 3: Event Selection ---');
  await evaluate('document.getElementById("btn-menu-play")?.click()');
  await new Promise(r => setTimeout(r, 200));

  const eventSelectCheck = await evaluate(`(() => {
    const g = window.game;
    const overlay = document.getElementById('event-select-overlay');
    return {
      state: g.state,
      isVisible: overlay && !overlay.classList.contains('hidden'),
      hasStartBtn: !!document.getElementById('btn-start-event'),
      hasBackBtn: !!document.getElementById('btn-event-back')
    };
  })()`);
  console.log('Event Select State:', eventSelectCheck);

  console.log('\n--- Test 4: Countdown & Input Lock ---');
  // Clear any existing stored test record for a clean baseline test
  await evaluate('localStorage.removeItem("project_apex_records")');

  // Start Time Trial
  await evaluate('document.getElementById("btn-start-event")?.click()');
  await new Promise(r => setTimeout(r, 300));

  const countdownState = await evaluate(`(() => {
    const g = window.game;
    const banner = document.getElementById('countdown-banner');
    return {
      state: g.state,
      bannerText: banner?.textContent,
      bannerVisible: banner && !banner.classList.contains('hidden'),
      carPos: { x: g.vehicleController.position.x, z: g.vehicleController.position.z },
      speed: g.vehicleController.forwardSpeed,
    };
  })()`);
  console.log('Countdown State at start:', countdownState);

  // Attempt to move while in Countdown: input must be rejected!
  await sendKey('KeyW', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 500));
  const lockedCheck = await evaluate(`(() => {
    const g = window.game;
    return {
      state: g.state,
      forwardSpeed: g.vehicleController.forwardSpeed,
      distMoved: Math.hypot(
        g.vehicleController.position.x - ${countdownState.carPos.x},
        g.vehicleController.position.z - ${countdownState.carPos.z}
      )
    };
  })()`);
  console.log('Input lock test during countdown:', lockedCheck);
  await sendKey('KeyW', 'keyUp');

  // Wait for countdown completion (3 -> 2 -> 1 -> GO! -> Racing)
  console.log('Waiting for countdown to complete (3s)...');
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 400));
    const st = await evaluate('window.game.state');
    if (st === 'Racing') {
      console.log('Race started! State transitioned to Racing.');
      break;
    }
  }

  const raceStarted = await evaluate(`(() => {
    const g = window.game;
    return {
      state: g.state,
      isRacing: g.isRacing,
      raceTime: g.raceTimeSeconds
    };
  })()`);
  console.log('Race Started Status:', raceStarted);

  console.log('\n--- Test 5: Driving & Checkpoint Progress ---');
  await sendKey('KeyW', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1200));
  await sendKey('KeyW', 'keyUp');

  const drivingCheck = await evaluate(`(() => {
    const g = window.game;
    const t = g.vehicleController.getTelemetry();
    return {
      speedKmh: t.speedKmh,
      raceTime: g.raceTimeSeconds,
      currentGate: g.checkpointManager.currentCheckpointIndex
    };
  })()`);
  console.log('Driving telemetry after throttle:', drivingCheck);

  console.log('\n--- Test 6: In-Race Pause, Resume & Restart ---');
  // Pause
  await sendKey('Escape', 'rawKeyDown');
  await sendKey('Escape', 'keyUp');
  await new Promise(r => setTimeout(r, 300));

  const pauseCheck = await evaluate(`(() => {
    const g = window.game;
    return {
      state: g.state,
      isPaused: g.isPaused,
      timerAtPause: g.raceTimeSeconds
    };
  })()`);
  console.log('In-Race Pause State:', pauseCheck);

  // Resume
  await evaluate('document.getElementById("btn-resume")?.click()');
  await new Promise(r => setTimeout(r, 200));
  const resumeCheck = await evaluate('window.game.state');
  console.log('Resumed State (expected Racing):', resumeCheck);

  // Restart Race from Pause Menu
  await sendKey('Escape', 'rawKeyDown');
  await sendKey('Escape', 'keyUp');
  await new Promise(r => setTimeout(r, 200));
  await evaluate('document.getElementById("btn-restart")?.click()');
  await new Promise(r => setTimeout(r, 300));

  const restartCheck = await evaluate(`(() => {
    const g = window.game;
    return {
      state: g.state,
      timer: g.raceTimeSeconds,
      carPos: { x: g.vehicleController.position.x, z: g.vehicleController.position.z },
      currentGate: g.checkpointManager.currentCheckpointIndex
    };
  })()`);
  console.log('Restart check (reset to countdown):', restartCheck);

  // Wait for countdown to finish again
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 400));
    const st = await evaluate('window.game.state');
    if (st === 'Racing') break;
  }

  console.log('\n--- Test 7: Complete Lap & Finish Time Trial ---');
  // Simulate complete lap by moving through all checkpoints in strict sequence
  const checkpointsSeq = [
    { name: 'Gate 1', x: 0, z: 36, dirZ: 1 },
    { name: 'Gate 2', x: 21, z: 50, dirX: 1 },
    { name: 'Gate 3', x: 40, z: 34, dirZ: -1 },
    { name: 'Gate 4', x: 40, z: -6, dirZ: -1 },
    { name: 'Gate 5', x: 19, z: -20, dirX: -1 },
    { name: 'Finish Line (Gate 0)', x: 0, z: 1, dirZ: 1 }
  ];

  for (const cp of checkpointsSeq) {
    await evaluate(`(() => {
      const g = window.game;
      const prev = g.vehicleController.position.clone();
      // Position vehicle just across the gate plane
      g.vehicleController.position.set(${cp.x}, 0.05, ${cp.z});
      g.checkpointManager.update(prev, g.vehicleController.position);
    })()`);
    await new Promise(r => setTimeout(r, 100));
  }

  const finishedState = await evaluate(`(() => {
    const g = window.game;
    const overlay = document.getElementById('finish-screen-overlay');
    return {
      state: g.state,
      finalTime: g.raceTimeSeconds,
      isFinishOverlayVisible: overlay && !overlay.classList.contains('hidden'),
      hudFinalTimeText: document.getElementById('finish-final-time')?.textContent,
      hudBestTimeText: document.getElementById('finish-best-time')?.textContent,
      newRecordVisible: !document.getElementById('new-record-banner')?.classList?.contains('hidden')
    };
  })()`);
  console.log('Finished State & Results Display:', finishedState);

  // Capture screenshot of Finish / Results Screen
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const shotPath = path.join(process.cwd(), 'milestone5_screenshot.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Results Screen screenshot saved: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);
  }

  console.log('\n--- Test 8: Retry Flow & Personal Best Persistence ---');
  // Click Retry
  await evaluate('document.getElementById("btn-finish-retry")?.click()');
  await new Promise(r => setTimeout(r, 300));

  const retryState = await evaluate(`(() => {
    const g = window.game;
    const overlay = document.getElementById('finish-screen-overlay');
    return {
      state: g.state,
      isFinishOverlayHidden: overlay && overlay.classList.contains('hidden'),
      timerReset: g.raceTimeSeconds === 0
    };
  })()`);
  console.log('Retry State (expected Countdown and overlay hidden):', retryState);

  // Return to Menu
  await evaluate('window.game.returnToMenu()');
  await new Promise(r => setTimeout(r, 200));

  const menuAfterFinish = await evaluate('window.game.state');
  console.log('State after returnToMenu (expected MainMenu):', menuAfterFinish);

  // Check personal best persistence in localStorage across re-entering EventSelect
  await evaluate('window.game.openEventSelect()');
  await new Promise(r => setTimeout(r, 200));
  const persistedBest = await evaluate('document.getElementById("event-select-best-time")?.textContent');
  console.log('Event Select persisted personal best (expected formatted time):', persistedBest);

  console.log('\n--- Verification Summary ---');
  console.log('Total console logs captured:', consoleLogs.length);
  console.log('Console errors:', errors.length);
  if (errors.length > 0) {
    errors.forEach(e => console.error('  [Error]', e));
  }

  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  const passed =
    mainMenuCheck?.state === 'MainMenu' &&
    mainMenuCheck?.isMenuVisible === true &&
    lowScale === 1.5 &&
    medScale === 1.0 &&
    Math.abs(volumeCheck - 0.6) < 0.01 &&
    backToMenu === 'MainMenu' &&
    eventSelectCheck?.state === 'EventSelect' &&
    countdownState?.state === 'Countdown' &&
    lockedCheck?.distMoved < 0.05 &&
    raceStarted?.state === 'Racing' &&
    drivingCheck?.speedKmh > 10 &&
    pauseCheck?.state === 'Paused' &&
    resumeCheck === 'Racing' &&
    restartCheck?.state === 'Countdown' &&
    finishedState?.state === 'Finished' &&
    finishedState?.isFinishOverlayVisible === true &&
    finishedState?.newRecordVisible === true &&
    retryState?.state === 'Countdown' &&
    retryState?.isFinishOverlayHidden === true &&
    menuAfterFinish === 'MainMenu' &&
    persistedBest !== '--:--.--' &&
    errors.length === 0;

  if (passed) {
    console.log('\n>>> ALL MILESTONE 5 TIME-TRIAL MVP TESTS PASSED <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyMilestone5().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
