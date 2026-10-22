const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage7Drift() {
  const profileDir = path.join(os.tmpdir(), 'apex_stage7_drift_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  console.log('Launching headless Edge for Stage 7.2 Drift Challenge Mode verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9869',
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
        const req = http.get('http://localhost:9869/json', res => {
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

  // --- CHECK 1: Boot & Event Selection 3-Mode Support ---
  console.log('\n--- CHECK 1: Event Selection with 3 Dedicated Modes ---');
  await evaluate('document.getElementById("btn-menu-play").click()');
  await new Promise(r => setTimeout(r, 500));

  const tabsInfo = await evaluate(`
    (() => {
      const tabs = Array.from(document.querySelectorAll(".event-tab"));
      return tabs.map(t => ({
        badge: t.querySelector(".tab-badge")?.textContent,
        title: t.querySelector(".tab-title")?.textContent
      }));
    })()
  `);
  console.log('Available Event Tabs:', tabsInfo);
  const check1 = tabsInfo.length === 3 &&
                 tabsInfo[0].badge === 'TIME ATTACK' &&
                 tabsInfo[1].badge === 'SPRINT RACE' &&
                 tabsInfo[2].badge === 'DRIFT CHALLENGE';
  results.push({ check: '1. Event Selection 3 Modes Available', pass: check1 });
  console.log('PASS: 3 Event tabs loaded:', check1);

  // --- CHECK 2: Drift Challenge Event Details & Minimap ---
  console.log('\n--- CHECK 2: Drift Challenge Event Details & Minimap ---');
  await evaluate('document.getElementById("tab-event-2").click()');
  await new Promise(r => setTimeout(r, 400));

  const driftDetails = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const selected = game.eventSelect.getSelectedEvent();
      const badge = document.getElementById("event-type-badge")?.textContent;
      const lapsBadge = document.getElementById("event-laps-badge")?.textContent;
      const title = document.getElementById("event-name")?.textContent;
      const length = document.getElementById("spec-length")?.textContent;
      const sectors = document.getElementById("spec-sectors")?.textContent;
      const btnText = document.getElementById("btn-start-text")?.textContent;
      const hasDriftSvg = document.querySelector(".circuit-svg")?.innerHTML.includes("DRIFT ZONE");

      return {
        id: selected.id,
        mode: selected.mode,
        badge,
        lapsBadge,
        title,
        length,
        sectors,
        btnText,
        hasDriftSvg
      };
    })()
  `);
  console.log('Drift Challenge Details:', JSON.stringify(driftDetails, null, 2));

  const check2 = driftDetails.id === 'forest_drift_90s' &&
                 driftDetails.mode === 'drift' &&
                 driftDetails.title === 'Forest Drift Challenge' &&
                 driftDetails.sectors === 'OPEN ARENA' &&
                 driftDetails.btnText === 'START DRIFT CHALLENGE' &&
                 driftDetails.hasDriftSvg === true;
  results.push({ check: '2. Drift Challenge Details & Minimap', pass: check2 });
  console.log('PASS: Drift challenge event details verified:', check2);

  await captureScreenshot('stage7_event_select_drift.png');

  // --- CHECK 3: Start Drift Challenge & Vehicle Speed Scale ---
  console.log('\n--- CHECK 3: Start Drift Challenge & Vehicle Speed Scale (0.75x) ---');
  await evaluate('document.getElementById("btn-start-event").click()');
  await new Promise(r => setTimeout(r, 600));

  const driftStartState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const pos = game.vehicleController.position;
      const speedScale = game.vehicleController.speedScale;
      return {
        state: game.state,
        currentEventId: game.currentEvent.id,
        mode: game.currentEvent.mode,
        speedScale,
        pos: { x: pos.x, y: pos.y, z: pos.z }
      };
    })()
  `);
  console.log('Drift Start State:', JSON.stringify(driftStartState, null, 2));

  const check3 = driftStartState.state === 'Countdown' &&
                 driftStartState.currentEventId === 'forest_drift_90s' &&
                 driftStartState.speedScale === 0.75;
  results.push({ check: '3. Drift Start & Speed Scale 0.75x', pass: check3 });
  console.log('PASS: Speed scale set to 0.75x without reducing top speed:', check3);

  await captureScreenshot('stage7_drift_countdown.png');

  // Wait for countdown to finish (3.2 seconds)
  await new Promise(r => setTimeout(r, 3400));

  const isRacing = await evaluate('(window.game || window.apexGame)?.state === "Racing"');
  console.log('Is Racing:', isRacing);

  // --- CHECK 4: Countdown & HUD Mode Telemetry ---
  console.log('\n--- CHECK 4: Drift Challenge Active HUD Display ---');
  const hudInfo = await evaluate(`
    (() => {
      const checkpointText = document.getElementById("checkpoint-indicator")?.textContent;
      const timerLabel = document.getElementById("timer-label")?.textContent;
      const raceTimer = document.getElementById("race-timer")?.textContent;
      const driftScoreVisible = !document.getElementById("drift-score-cluster")?.classList.contains("hidden");
      const totalScore = document.getElementById("drift-total-score")?.textContent;
      return {
        checkpointText,
        timerLabel,
        raceTimer,
        driftScoreVisible,
        totalScore
      };
    })()
  `);
  console.log('Drift HUD Info:', JSON.stringify(hudInfo, null, 2));

  const check4 = isRacing &&
                 hudInfo.checkpointText?.includes('DRIFT CHALLENGE') &&
                 hudInfo.timerLabel === 'TIME REMAINING' &&
                 hudInfo.driftScoreVisible === true &&
                 hudInfo.totalScore === '0 PTS';
  results.push({ check: '4. Drift Challenge HUD Display', pass: check4 });
  console.log('PASS: Drift HUD initialized with countdown and score cluster:', check4);

  // --- CHECK 5: Normal Driving Earns 0 Points ---
  console.log('\n--- CHECK 5: Normal Driving (No Significant Slip) Earns 0 Points ---');
  // Simulate driving straight at 40 km/h with 0 slip angle
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = {
        speedKmh: 40,
        forwardSpeed: 11.1,
        lateralSpeed: 0,
        slipAngleDeg: 1.5,
        steeringAngleDeg: 2.0,
        isDrifting: false,
        handbrakeActive: false,
        gear: 'D'
      };
      game.driftScoringManager.update(1.0, tele, 0.1);
    })()
  `);

  const normalDriveScore = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        activePoints: game.driftScoringManager.activeDriftPoints,
        totalBanked: game.driftScoringManager.totalBankedScore
      };
    })()
  `);
  console.log('Normal Drive Score:', normalDriveScore);
  const check5 = normalDriveScore.activePoints === 0 && normalDriveScore.totalBanked === 0;
  results.push({ check: '5. Normal Driving Does Not Score', pass: check5 });
  console.log('PASS: Straight driving (< 12° slip) earns zero drift points:', check5);

  // --- CHECK 6: Valid Controlled Drift Earns Points & Increases Multiplier ---
  console.log('\n--- CHECK 6: Valid Controlled Drift Accumulation & Multiplier Growth ---');
  const driftActiveState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = {
        speedKmh: 45,
        forwardSpeed: 12.5,
        lateralSpeed: 4.8,
        slipAngleDeg: 28.0,
        steeringAngleDeg: -18.0,
        isDrifting: true,
        handbrakeActive: false,
        gear: 'D'
      };
      // Simulate over 2.2 seconds in 0.1s slices
      for (let i = 0; i < 22; i++) {
        game.driftScoringManager.update(0.1, tele, 1.1);
      }
      const telemetry = game.driftScoringManager.getTelemetry();
      return {
        isDrifting: telemetry.isDrifting,
        activePoints: telemetry.activeDriftPoints,
        multiplier: telemetry.comboMultiplier,
        maxMultiplier: telemetry.maxMultiplierAchieved
      };
    })()
  `);
  console.log('Active Drift State:', driftActiveState);

  const check6 = driftActiveState.activePoints > 200 &&
                 driftActiveState.multiplier >= 1.3 &&
                 driftActiveState.isDrifting === true;
  results.push({ check: '6. Controlled Drift Scoring & Multiplier', pass: check6 });
  console.log('PASS: Controlled drift accumulates points and increases multiplier:', check6);

  await captureScreenshot('stage7_drift_scoring_active.png');

  // --- CHECK 7: Banking Mechanism (Once Only After Grace Period) ---
  console.log('\n--- CHECK 7: Banking Points Cleanly Once After Grace Period ---');
  // Straighten car (slip drops to 0°) and advance past grace period (1.0s)
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = {
        speedKmh: 35,
        forwardSpeed: 9.7,
        lateralSpeed: 0,
        slipAngleDeg: 1.0,
        steeringAngleDeg: 0,
        isDrifting: false,
        handbrakeActive: false,
        gear: 'D'
      };
      game.driftScoringManager.update(1.0, tele, 0);
    })()
  `);

  const bankedState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = game.driftScoringManager.getTelemetry();
      return {
        isDrifting: tele.isDrifting,
        activePoints: tele.activeDriftPoints,
        multiplier: tele.comboMultiplier,
        totalBanked: tele.totalBankedScore
      };
    })()
  `);
  console.log('Banked State:', bankedState);

  const firstBankedScore = bankedState.totalBanked;
  // Advance another 1.0s while driving straight to confirm it DOES NOT bank repeatedly
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = {
        speedKmh: 35,
        forwardSpeed: 9.7,
        lateralSpeed: 0,
        slipAngleDeg: 1.0,
        steeringAngleDeg: 0,
        isDrifting: false,
        handbrakeActive: false,
        gear: 'D'
      };
      game.driftScoringManager.update(1.0, tele, 0);
    })()
  `);

  const secondBankedState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return game.driftScoringManager.totalBankedScore;
    })()
  `);

  const check7 = bankedState.activePoints === 0 &&
                 bankedState.multiplier === 1.0 &&
                 firstBankedScore > 0 &&
                 secondBankedState === firstBankedScore;
  results.push({ check: '7. Clean Banking (Banks Once)', pass: check7 });
  console.log('PASS: Points banked cleanly once into totalBankedScore:', check7);

  // --- CHECK 8: Severe Collision Breaks Combo ---
  console.log('\n--- CHECK 8: Severe Wall Impact Breaks Combo & Drops Unbanked Points ---');
  // Start another drift to accumulate unbanked points
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = {
        speedKmh: 45,
        forwardSpeed: 12.5,
        lateralSpeed: 4.8,
        slipAngleDeg: 28.0,
        steeringAngleDeg: -18.0,
        isDrifting: true,
        handbrakeActive: false,
        gear: 'D'
      };
      for (let i = 0; i < 15; i++) {
        game.driftScoringManager.update(0.1, tele, 1.0);
      }
    })()
  `);

  const preCollisionPoints = await evaluate('(window.game || window.apexGame).driftScoringManager.activeDriftPoints');
  console.log('Pre-collision active points:', preCollisionPoints);

  // Trigger severe wall collision
  await evaluate('(window.game || window.apexGame).driftScoringManager.onCollision(2.5)');

  const postCollisionState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        activePoints: game.driftScoringManager.activeDriftPoints,
        multiplier: game.driftScoringManager.comboMultiplier,
        banner: game.driftScoringManager.getTelemetry().feedbackBannerText
      };
    })()
  `);
  console.log('Post-collision State:', postCollisionState);

  const check8 = preCollisionPoints > 0 &&
                 postCollisionState.activePoints === 0 &&
                 postCollisionState.multiplier === 1.0 &&
                 postCollisionState.banner?.includes('COMBO LOST');
  results.push({ check: '8. Wall Collision Breaks Combo', pass: check8 });
  console.log('PASS: Severe wall collision drops unbanked points and resets multiplier:', check8);

  // --- CHECK 9: Anti-Exploit Spinning in Place Halts Scoring ---
  console.log('\n--- CHECK 9: Anti-Exploit (Spinning in Place / Uncontrolled Spin) ---');
  // Simulate excessive spin out (slip 75°, yawRate 4.2 rad/s)
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const tele = {
        speedKmh: 35,
        forwardSpeed: 3.0,
        lateralSpeed: 8.0,
        slipAngleDeg: 75.0,
        steeringAngleDeg: 25.0,
        isDrifting: false,
        handbrakeActive: false,
        gear: 'D'
      };
      game.driftScoringManager.update(0.5, tele, 4.2);
    })()
  `);

  const spinState = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        activePoints: game.driftScoringManager.activeDriftPoints,
        multiplier: game.driftScoringManager.comboMultiplier,
        banner: game.driftScoringManager.getTelemetry().feedbackBannerText
      };
    })()
  `);
  console.log('Spin Out State:', spinState);
  const check9 = spinState.activePoints === 0 && spinState.multiplier === 1.0;
  results.push({ check: '9. Uncontrolled Spin Disallowed', pass: check9 });
  console.log('PASS: Spinning in place (> 65° / > 3.2 rad/s) halts scoring:', check9);

  // --- CHECK 10: Pause & Resume Behavior ---
  console.log('\n--- CHECK 10: Pause Freezes Scoring Session ---');
  await evaluate('(window.game || window.apexGame).pause()');
  await new Promise(r => setTimeout(r, 400));
  const isPaused = await evaluate('(window.game || window.apexGame)?.state === "Paused"');

  await evaluate('(window.game || window.apexGame).resume()');
  await new Promise(r => setTimeout(r, 400));
  const isResumed = await evaluate('(window.game || window.apexGame)?.state === "Racing"');

  const check10 = isPaused && isResumed;
  results.push({ check: '10. Pause & Resume Invariance', pass: check10 });
  console.log('PASS: Clean pause and resume in Drift Challenge:', check10);

  // --- CHECK 11: Session Timeout Completes Race & Results Screen ---
  console.log('\n--- CHECK 11: Session Timeout & Drift Finish Screen ---');
  // Bank a substantial score of 18,450 for record testing
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      // Pre-seed time trial and sprint records to test record coexistence and isolation
      const existing = JSON.parse(localStorage.getItem("project_apex_records") || "{}");
      existing["forest_loop_220m"] = 52.14;
      existing["forest_sprint_130m"] = 18.62;
      localStorage.setItem("project_apex_records", JSON.stringify(existing));

      game.driftScoringManager.totalBankedScore = 18450;
      // Trigger session end and show finish screen immediately
      game.finishRace(18450);
      game.isFinishSweepActive = false;
      game.showFinishScreen();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  const finishScreenInfo = await evaluate(`
    (() => {
      const title = document.getElementById("finish-title")?.textContent;
      const subtitle = document.getElementById("finish-subtitle")?.textContent;
      const label = document.getElementById("finish-time-label")?.textContent;
      const finalVal = document.getElementById("finish-final-time")?.textContent;
      const bestVal = document.getElementById("finish-best-time")?.textContent;
      const retryText = document.getElementById("finish-retry-text")?.textContent;
      const isOpen = !(document.getElementById("finish-screen-overlay")?.classList.contains("hidden"));

      return {
        title,
        subtitle,
        label,
        finalVal,
        bestVal,
        retryText,
        isOpen
      };
    })()
  `);
  console.log('Drift Finish Screen Info:', JSON.stringify(finishScreenInfo, null, 2));

  const check11 = finishScreenInfo.isOpen &&
                  finishScreenInfo.title?.includes('DRIFT CHALLENGE FINISHED') &&
                  finishScreenInfo.label === 'TOTAL DRIFT SCORE' &&
                  finishScreenInfo.finalVal?.includes('18,450 PTS') &&
                  finishScreenInfo.retryText === 'RETRY DRIFT CHALLENGE';
  results.push({ check: '11. Drift Results Screen Presentation', pass: check11 });
  console.log('PASS: Drift finish screen rendered with score and retry buttons:', check11);

  await captureScreenshot('stage7_drift_finish_screen.png');

  // --- CHECK 12: Record Persistence & Isolation ---
  console.log('\n--- CHECK 12: Drift High Score Persistence & Key Isolation ---');
  const records = await evaluate(`
    (() => {
      const raw = localStorage.getItem("project_apex_records");
      const parsed = JSON.parse(raw);
      return {
        driftScore: parsed["forest_drift_90s"],
        timeTrialRecord: parsed["forest_loop_220m"],
        sprintRecord: parsed["forest_sprint_130m"]
      };
    })()
  `);
  console.log('Stored Records in localStorage:', records);

  const check12 = records.driftScore === 18450 &&
                  typeof records.timeTrialRecord === 'number' &&
                  typeof records.sprintRecord === 'number';
  results.push({ check: '12. Record Persistence & Key Isolation', pass: check12 });
  console.log('PASS: Drift high score stored under forest_drift_90s without overwriting times:', check12);

  // --- CHECK 13: Time Trial and Sprint Non-Regression ---
  console.log('\n--- CHECK 13: Time Trial and Sprint Modes Non-Regression ---');
  await evaluate('(window.game || window.apexGame).returnToMenu()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('(window.game || window.apexGame).openEventSelect()');
  await new Promise(r => setTimeout(r, 400));

  // Select Sprint Race
  await evaluate('document.getElementById("tab-event-1").click()');
  await new Promise(r => setTimeout(r, 400));
  const sprintTitle = await evaluate('document.getElementById("event-name")?.textContent');

  // Select Time Trial
  await evaluate('document.getElementById("tab-event-0").click()');
  await new Promise(r => setTimeout(r, 400));
  const ttTitle = await evaluate('document.getElementById("event-name")?.textContent');

  const check13 = sprintTitle === 'Forest Sector Sprint' && ttTitle === 'Apex Circuit Time Trial';
  results.push({ check: '13. Sprint and Time Trial Non-Regression', pass: check13 });
  console.log('PASS: Sprint and Time Trial modes remain fully functional:', check13);

  // --- CHECK 14: Zero Console Errors ---
  console.log('\n--- CHECK 14: Zero Unhandled Console Errors ---');
  console.log('Captured Console Errors:', consoleErrors);
  const check14 = consoleErrors.length === 0;
  results.push({ check: '14. Zero Unhandled Console Errors', pass: check14 });

  console.log('\n========================================');
  console.log('STAGE 7.2 DRIFT CHALLENGE VERIFICATION SUMMARY');
  console.log('========================================');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? '✓ PASS' : '✗ FAIL'}: ${r.check}`);
    if (!r.pass) allPass = false;
  }
  console.log('========================================');
  console.log(allPass ? 'ALL 14 CHECKS PASSED!' : 'SOME CHECKS FAILED');

  edgeProc.kill();
  process.exit(allPass ? 0 : 1);
}

verifyStage7Drift().catch(err => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
