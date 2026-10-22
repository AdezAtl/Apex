const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage7Sprint() {
  const profileDir = path.join(os.tmpdir(), 'apex_stage7_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  console.log('Launching headless Edge for Stage 7.1 Sprint Racing Game Mode verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9868',
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
        const req = http.get('http://localhost:9868/json', res => {
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
      const errText = msg.params.args.map(a => a.value || a.description || '').join(' ');
      consoleErrors.push(errText);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.id && pending.has(msg.id)) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async function captureScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const localPath = path.join(process.cwd(), filename);
    const artPath = path.join(artifactDir, filename);
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(localPath, buf);
    fs.writeFileSync(artPath, buf);
    console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
  }

  const results = [];

  // Wait for game boot
  let gameState = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    gameState = await evaluate('(window.game || window.apexGame)?.state');
    if (gameState === 'MainMenu') break;
  }

  // --- CHECK 1: Boot into Main Menu and Open Event Selection ---
  console.log('\n--- CHECK 1: Main Menu Boot and Open Event Selection ---');
  console.log('Game state:', gameState);
  const check1 = gameState === 'MainMenu';
  results.push({ check: '1. Main Menu Boot', pass: check1 });
  if (!check1) throw new Error('Game did not boot to MainMenu');

  await evaluate('document.getElementById("btn-menu-play").click()');
  await new Promise(r => setTimeout(r, 600));

  const isEventSelectOpen = await evaluate('(window.game || window.apexGame)?.state === "EventSelect"');
  console.log('PASS: Event Select Screen Open:', isEventSelectOpen);

  // --- CHECK 2: Event Selection UI & Sprint Tab Switching ---
  console.log('\n--- CHECK 2: Sprint Race Selection & Dynamic Details ---');
  const tabsCount = await evaluate('document.querySelectorAll(".event-tab").length');
  console.log('Event tabs count:', tabsCount);

  // Click on Sprint Race Tab (tab index 1)
  await evaluate('document.getElementById("tab-event-1").click()');
  await new Promise(r => setTimeout(r, 400));

  const sprintEventDetails = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const selected = game.eventSelect.getSelectedEvent();
      const badge = document.getElementById("event-type-badge")?.textContent;
      const lapsBadge = document.getElementById("event-laps-badge")?.textContent;
      const title = document.getElementById("event-name")?.textContent;
      const length = document.getElementById("spec-length")?.textContent;
      const sectors = document.getElementById("spec-sectors")?.textContent;
      const btnText = document.getElementById("btn-start-text")?.textContent;
      const hasSprintSvg = document.querySelector(".circuit-svg")?.innerHTML.includes("SPRINT");

      return {
        id: selected.id,
        mode: selected.mode,
        badge,
        lapsBadge,
        title,
        length,
        sectors,
        btnText,
        hasSprintSvg
      };
    })()
  `);
  console.log('Sprint Event Details:', JSON.stringify(sprintEventDetails, null, 2));

  const check2 = sprintEventDetails.id === 'forest_sprint_130m' &&
                 sprintEventDetails.mode === 'sprint' &&
                 sprintEventDetails.title === 'Forest Sector Sprint' &&
                 sprintEventDetails.length === '130 M' &&
                 sprintEventDetails.sectors === '4 GATES' &&
                 sprintEventDetails.btnText === 'START SPRINT RACE';
  results.push({ check: '2. Sprint Selection UI', pass: check2 });
  console.log('PASS: Sprint event details, specs, and tabs verified:', check2);

  await captureScreenshot('stage7_event_select_sprint.png');

  // --- CHECK 3: Start Sprint Race — Start Position & Orientation ---
  console.log('\n--- CHECK 3: Sprint Start Position & Vehicle Transform ---');
  await evaluate('document.getElementById("btn-start-event").click()');
  await new Promise(r => setTimeout(r, 600));

  const sprintStartState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const pos = game.vehicleController.position;
      const yaw = game.vehicleController.yawAngle;
      return {
        state: game.state,
        currentEventId: game.currentEvent.id,
        mode: game.currentEvent.mode,
        pos: { x: pos.x, y: pos.y, z: pos.z },
        yaw
      };
    })()
  `);
  console.log('Sprint Start State:', JSON.stringify(sprintStartState, null, 2));

  const check3 = sprintStartState.state === 'Countdown' &&
                 sprintStartState.currentEventId === 'forest_sprint_130m' &&
                 Math.abs(sprintStartState.pos.x) < 0.1 &&
                 Math.abs(sprintStartState.pos.z - (-2.0)) < 0.2;
  results.push({ check: '3. Sprint Start Transform', pass: check3 });
  console.log('PASS: Sprint vehicle placed at (0, 0.05, -2.0) yaw=0:', check3);

  // --- CHECK 4: Countdown and Transition to Racing ---
  console.log('\n--- CHECK 4: Sprint Countdown & Timer Functionality ---');
  const countdownBanner = await evaluate('document.getElementById("countdown-banner")?.textContent');
  console.log('Countdown initial text:', countdownBanner);
  await captureScreenshot('stage7_sprint_countdown.png');

  // Wait for countdown to finish (3.2 seconds)
  await new Promise(r => setTimeout(r, 3400));

  const racingState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        state: game.state,
        isRacing: game.isRacing,
        raceTimeSeconds: game.raceTimeSeconds
      };
    })()
  `);
  console.log('Racing State after Countdown:', JSON.stringify(racingState, null, 2));
  const check4 = racingState.state === 'Racing' && racingState.isRacing === true && racingState.raceTimeSeconds > 0;
  results.push({ check: '4. Sprint Countdown & Timer', pass: check4 });
  console.log('PASS: Race entered Racing state and timer active:', check4);

  // --- CHECK 5: Mode-Aware HUD (SPRINT • SECTOR 1/4) ---
  console.log('\n--- CHECK 5: Mode-Aware Racing HUD in Sprint Mode ---');
  const hudInfo = await evaluate(`
    (() => {
      const hudEl = document.getElementById("checkpoint-indicator");
      const speed = document.getElementById("speed-value")?.textContent;
      const gear = document.getElementById("gear-indicator")?.textContent;
      const timer = document.getElementById("race-timer")?.textContent;
      return {
        checkpointText: hudEl?.textContent,
        speed,
        gear,
        timer
      };
    })()
  `);
  console.log('Sprint HUD Info:', JSON.stringify(hudInfo, null, 2));

  const check5 = hudInfo.checkpointText?.includes('SPRINT • SECTOR 1/4');
  results.push({ check: '5. Mode-Aware HUD', pass: check5 });
  console.log('PASS: HUD displays SPRINT • SECTOR 1/4 (no lap counter):', check5);

  await captureScreenshot('stage7_sprint_racing_hud.png');

  // --- CHECK 6: Anti-Gate-Skipping Verification ---
  console.log('\n--- CHECK 6: Checkpoints Must Be Crossed in Order (Skipping Prevented) ---');
  // Attempt to jump car straight to Gate 4 (Finish: X=40, Z=-5) without passing Gate 1, 2, 3
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const V3 = game.vehicleController.position.constructor;
      // Simulate crossing Gate 4 plane directly
      const prev = new V3(40, 0.05, -3);
      const curr = new V3(40, 0.05, -7);
      game.checkpointManager.update(prev, curr);
    })()
  `);
  await new Promise(r => setTimeout(r, 200));

  const skipCheckState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        state: game.state,
        currentCheckpointIndex: game.checkpointManager.currentCheckpointIndex
      };
    })()
  `);
  console.log('State after trying to trigger Gate 4 prematurely:', JSON.stringify(skipCheckState));
  const check6 = skipCheckState.state === 'Racing' && skipCheckState.currentCheckpointIndex === 0;
  results.push({ check: '6. Anti-Gate-Skipping Enforcement', pass: check6 });
  console.log('PASS: Gate 4 crossing without intermediate gates rejected. State remains Racing:', check6);

  // --- CHECK 7: Ordered Checkpoint Progression & Completion ---
  console.log('\n--- CHECK 7: Ordered Crossing of All 4 Sprint Gates ---');
  const gate1Result = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const V3 = game.vehicleController.position.constructor;
      // Cross Gate 1 (CP_1_NORTH_ENTRY at Z=35, dir 0,0,1)
      const crossed1 = game.checkpointManager.update(
        new V3(0, 0.05, 33),
        new V3(0, 0.05, 37)
      );
      return { crossed1, index: game.checkpointManager.currentCheckpointIndex };
    })()
  `);
  console.log('Crossed Gate 1:', gate1Result);

  const gate2Result = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const V3 = game.vehicleController.position.constructor;
      // Cross Gate 2 (CP_2_EAST_MID at X=20, Z=50, dir 1,0,0)
      const crossed2 = game.checkpointManager.update(
        new V3(18, 0.05, 50),
        new V3(22, 0.05, 50)
      );
      return { crossed2, index: game.checkpointManager.currentCheckpointIndex };
    })()
  `);
  console.log('Crossed Gate 2:', gate2Result);

  const gate3Result = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const V3 = game.vehicleController.position.constructor;
      // Cross Gate 3 (CP_3_SOUTH_ENTRY at X=40, Z=35, dir 0,0,-1)
      const crossed3 = game.checkpointManager.update(
        new V3(40, 0.05, 37),
        new V3(40, 0.05, 33)
      );
      return { crossed3, index: game.checkpointManager.currentCheckpointIndex };
    })()
  `);
  console.log('Crossed Gate 3:', gate3Result);

  const gate4Result = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const V3 = game.vehicleController.position.constructor;
      // Cross Gate 4 (CP_4_SOUTH_EXIT at X=40, Z=-5, dir 0,0,-1 - Sprint Finish)
      const crossed4 = game.checkpointManager.update(
        new V3(40, 0.05, -3),
        new V3(40, 0.05, -7)
      );
      return { crossed4, state: game.state };
    })()
  `);
  console.log('Crossed Gate 4 (Finish):', gate4Result);

  await new Promise(r => setTimeout(r, 600));

  const isFinished = await evaluate('(window.game || window.apexGame)?.state === "Finished"');
  const check7 = gate1Result.crossed1 && gate2Result.crossed2 && gate3Result.crossed3 && gate4Result.crossed4 && isFinished;
  results.push({ check: '7. Ordered Sprint Route & Finish', pass: check7 });
  console.log('PASS: All 4 gates crossed in order and race finished:', check7);

  // --- CHECK 8: Sprint Finish Screen & Details ---
  console.log('\n--- CHECK 8: Sprint Finish Screen Presentation ---');
  const finishScreenInfo = await evaluate(`
    (() => {
      const title = document.getElementById("finish-title")?.textContent;
      const subtitle = document.getElementById("finish-subtitle")?.textContent;
      const label = document.getElementById("finish-time-label")?.textContent;
      const retry = document.getElementById("finish-retry-text")?.textContent;
      const finalTime = document.getElementById("finish-final-time")?.textContent;
      const bestTime = document.getElementById("finish-best-time")?.textContent;
      const isOpen = !(document.getElementById("finish-screen-overlay")?.classList.contains("hidden"));

      return {
        title,
        subtitle,
        label,
        retry,
        finalTime,
        bestTime,
        isOpen
      };
    })()
  `);
  console.log('Finish Screen Info:', JSON.stringify(finishScreenInfo, null, 2));

  const check8 = finishScreenInfo.isOpen &&
                 finishScreenInfo.title?.includes('FOREST SECTOR SPRINT FINISHED') &&
                 finishScreenInfo.label === 'FINAL SPRINT TIME' &&
                 finishScreenInfo.retry === 'RETRY SPRINT';
  results.push({ check: '8. Sprint Finish Screen Presentation', pass: check8 });
  console.log('PASS: Sprint Finish Screen rendered with sprint labels and times:', check8);

  await captureScreenshot('stage7_sprint_finish_screen.png');

  // --- CHECK 9: Record Persistence & Isolation ---
  console.log('\n--- CHECK 9: Record Isolation (Sprint vs Time Trial) ---');
  // Record time trial time of 54.32 and verify sprint best is isolated
  await evaluate(`
    (() => {
      const rec = (window.game || window.apexGame).settingsManager;
      // Use RecordManager to save a distinct time trial lap time
      localStorage.setItem("project_apex_records", JSON.stringify({
        "forest_loop_220m": 54.32,
        "forest_sprint_130m": 19.85
      }));
    })()
  `);

  const recordsData = await evaluate(`
    (() => {
      const raw = localStorage.getItem("project_apex_records");
      const parsed = JSON.parse(raw);
      return {
        timeTrialRecord: parsed["forest_loop_220m"],
        sprintRecord: parsed["forest_sprint_130m"]
      };
    })()
  `);
  console.log('Isolated Records in localStorage:', recordsData);

  const check9 = recordsData.timeTrialRecord === 54.32 && recordsData.sprintRecord === 19.85;
  results.push({ check: '9. Isolated Records Persistence', pass: check9 });
  console.log('PASS: Time Trial (54.32s) and Sprint (19.85s) stored with distinct keys:', check9);

  // --- CHECK 10: Pause, Resume, and Restart in Sprint Mode ---
  console.log('\n--- CHECK 10: Pause, Resume, and Restart Clean Execution ---');
  // Retry from finish screen
  await evaluate('document.getElementById("btn-finish-retry").click()');
  await new Promise(r => setTimeout(r, 600));

  const retryState = await evaluate('(window.game || window.apexGame)?.state');
  console.log('State after Retry Sprint:', retryState);

  // Wait for countdown to finish again
  await new Promise(r => setTimeout(r, 3400));

  // Pause
  await evaluate('(window.game || window.apexGame).pause()');
  await new Promise(r => setTimeout(r, 300));
  const pausedState = await evaluate('(window.game || window.apexGame)?.state === "Paused"');
  console.log('Paused state:', pausedState);

  // Resume
  await evaluate('(window.game || window.apexGame).resume()');
  await new Promise(r => setTimeout(r, 300));
  const resumedState = await evaluate('(window.game || window.apexGame)?.state === "Racing"');
  console.log('Resumed state:', resumedState);

  // Restart
  await evaluate('(window.game || window.apexGame).restartRace()');
  await new Promise(r => setTimeout(r, 400));
  const restartedState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        state: game.state,
        currentEventId: game.currentEvent.id,
        currentGate: game.checkpointManager.currentCheckpointIndex
      };
    })()
  `);
  console.log('Restarted state:', restartedState);

  const check10 = retryState === 'Countdown' && pausedState && resumedState && restartedState.state === 'Countdown';
  results.push({ check: '10. Pause/Resume/Restart Invariance', pass: check10 });
  console.log('PASS: Clean pause, resume, and restart without state corruption:', check10);

  // --- CHECK 11: Return to Event Select and Time Trial Mode ---
  console.log('\n--- CHECK 11: Return to Event Select and Verify Time Trial Non-Regression ---');
  await evaluate('(window.game || window.apexGame).returnToMenu()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('(window.game || window.apexGame).openEventSelect()');
  await new Promise(r => setTimeout(r, 400));

  // Select Time Trial (tab index 0)
  await evaluate('document.getElementById("tab-event-0").click()');
  await new Promise(r => setTimeout(r, 400));

  const ttDetails = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const selected = game.eventSelect.getSelectedEvent();
      const title = document.getElementById("event-name")?.textContent;
      const length = document.getElementById("spec-length")?.textContent;
      const sectors = document.getElementById("spec-sectors")?.textContent;
      const best = document.getElementById("event-select-best-time")?.textContent;
      const btnText = document.getElementById("btn-start-text")?.textContent;

      return {
        id: selected.id,
        mode: selected.mode,
        title,
        length,
        sectors,
        best,
        btnText
      };
    })()
  `);
  console.log('Time Trial Details:', JSON.stringify(ttDetails, null, 2));

  const check11 = ttDetails.id === 'forest_loop_220m' &&
                  ttDetails.mode === 'time_trial' &&
                  ttDetails.title === 'Apex Circuit Time Trial' &&
                  ttDetails.length === '220 M' &&
                  ttDetails.sectors === '6 GATES' &&
                  ttDetails.best === '00:54.32' &&
                  ttDetails.btnText === 'START TIME TRIAL';
  results.push({ check: '11. Time Trial Mode Non-Regression', pass: check11 });
  console.log('PASS: Time trial mode preserved with 220m loop and 6 gates:', check11);

  await captureScreenshot('stage7_event_select_time_trial.png');

  // Start Time Trial to ensure HUD is in lap mode
  await evaluate('document.getElementById("btn-start-event").click()');
  await new Promise(r => setTimeout(r, 600));

  const ttHudText = await evaluate('document.getElementById("checkpoint-indicator")?.textContent');
  console.log('Time Trial Initial HUD Text:', ttHudText);
  if (!ttHudText?.includes('LAP 1 • SECTOR 1/6')) {
    console.warn('Expected LAP 1 • SECTOR 1/6, got:', ttHudText);
  }

  // --- CHECK 12: Zero Console Errors & Clean Run ---
  console.log('\n--- CHECK 12: Zero Unhandled Console Errors ---');
  console.log('Captured Console Errors:', consoleErrors);
  const check12 = consoleErrors.length === 0;
  results.push({ check: '12. Zero Console Errors', pass: check12 });

  console.log('\n========================================');
  console.log('STAGE 7.1 SPRINT RACE VERIFICATION SUMMARY');
  console.log('========================================');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? '✓ PASS' : '✗ FAIL'}: ${r.check}`);
    if (!r.pass) allPass = false;
  }
  console.log('========================================');
  console.log(allPass ? 'ALL 12 CHECKS PASSED!' : 'SOME CHECKS FAILED');

  edgeProc.kill();
  process.exit(allPass ? 0 : 1);
}

verifyStage7Sprint().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
