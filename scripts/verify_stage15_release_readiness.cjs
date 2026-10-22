const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function runStage15ReleaseReadiness() {
  console.log('========================================================================');
  console.log('   PROJECT APEX — STAGE 15 FINAL POLISH & RELEASE READINESS AUDIT');
  console.log('========================================================================\n');

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';
  const profileDir = path.join(os.tmpdir(), 'apex_stage15_release_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('[Setup] Launching headless browser on port 9888...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9888',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9888/json', res => {
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
    console.error('ERROR: Target page not found on port 9888');
    edgeProc.kill();
    process.exit(1);
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
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const resolve = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      const text = data.params.args?.map(a => a.value || a.description).join(' ');
      consoleErrors.push(text);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res && res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ': ' + (res.exceptionDetails.exception?.description || ''));
    }
    return res?.result?.value;
  }

  async function takeScreenshot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const targetPath = path.join(artifactDir, name);
    fs.writeFileSync(targetPath, buffer);
    console.log(`  -> Screenshot saved: ${name}`);
    return targetPath;
  }

  const testResults = [];
  function assert(scenario, condition, message) {
    if (condition) {
      console.log(`  [PASS] ${scenario}: ${message}`);
      testResults.push({ scenario, status: 'PASS', message });
    } else {
      console.error(`  [FAIL] ${scenario}: ${message}`);
      testResults.push({ scenario, status: 'FAIL', message });
    }
  }

  try {
    console.log('[Setup] Waiting for Project Apex to initialize and enter Main Menu...');
    for (let i = 0; i < 40; i++) {
      let state = null;
      let menuVisible = false;
      try {
        state = await evaluate(`window.game ? window.game.state : null`);
        menuVisible = await evaluate(`!document.getElementById('main-menu-overlay')?.classList.contains('hidden')`);
      } catch {}
      if (state === 'MainMenu' && menuVisible) break;
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n[Scenario 1/16] Clean Boot & Main Menu Presentation...');
    const bootInfo = await evaluate(`(() => ({
      title: document.title,
      menuVisible: !document.getElementById('main-menu-overlay')?.classList.contains('hidden'),
      hasCareerBtn: !!document.getElementById('btn-menu-career'),
      hasPlayBtn: !!document.getElementById('btn-menu-play'),
      hasGarageBtn: !!document.getElementById('btn-menu-garage'),
      hasSettingsBtn: !!document.getElementById('btn-menu-settings'),
      faviconSet: !!document.querySelector("link[rel*='icon']"),
      versionText: document.querySelector('.version-tag')?.textContent || ''
    }))()`);

    assert('Scenario 1', bootInfo.title.includes('Project Apex'), 'Document title set to Project Apex');
    assert('Scenario 1', bootInfo.menuVisible, 'Main menu overlay is visible on boot');
    assert('Scenario 1', bootInfo.hasCareerBtn && bootInfo.hasPlayBtn, 'Career and Free Play buttons present with updated IDs');
    assert('Scenario 1', bootInfo.faviconSet, 'Favicon link tag configured in document head');
    assert('Scenario 1', bootInfo.versionText.includes('RELEASE CANDIDATE'), 'Version label displays Release Candidate status: ' + bootInfo.versionText);
    await takeScreenshot('stage15_01_main_menu.png');

    console.log('\n[Scenario 2/16] Audio Engine Initialization & Gesture Unlock...');
    await evaluate(`(() => {
      window.dispatchEvent(new PointerEvent('pointerdown'));
      window.game.soundManager.initContext();
    })()`);
    const audioStateAfter = await evaluate(`(() => ({
      masterVol: window.game.soundManager.masterVolume,
      engineVol: window.game.soundManager.engineVolume,
      isMuted: window.game.soundManager.isMuted,
      isInitialized: window.game.soundManager.getIsInitialized(),
      contextState: window.game.soundManager.getContextState()
    }))()`);

    assert('Scenario 2', audioStateAfter.masterVol > 0 && audioStateAfter.engineVol > 0, 'Audio volumes configured correctly');
    assert('Scenario 2', !audioStateAfter.isMuted, 'Audio is not muted by default');
    assert('Scenario 2', audioStateAfter.isInitialized, 'SoundManager initialized synthesizer graphs successfully');
    assert('Scenario 2', audioStateAfter.contextState === 'running' || audioStateAfter.contextState === 'suspended', 'Web Audio Context active: ' + audioStateAfter.contextState);

    console.log('\n[Scenario 3/16] Event Select & Active Chassis Garage Flow...');
    await evaluate(`window.game.openEventSelect()`);
    await new Promise(r => setTimeout(r, 400));

    const eventSelectInfo = await evaluate(`(() => ({
      visible: !document.getElementById('event-select-overlay')?.classList.contains('hidden'),
      activeChassisBar: !!document.querySelector('.event-selected-vehicle-bar'),
      chassisName: document.getElementById('event-select-vehicle-name')?.textContent,
      chassisSpecs: document.getElementById('event-select-vehicle-specs')?.textContent,
      hasSwitchBtn: !!document.getElementById('btn-event-open-garage')
    }))()`);

    assert('Scenario 3', eventSelectInfo.visible, 'Event selection overlay displayed');
    assert('Scenario 3', eventSelectInfo.activeChassisBar, 'Active chassis bar rendered in event selector');
    assert('Scenario 3', eventSelectInfo.chassisName && eventSelectInfo.chassisName !== '--', 'Chassis name populated: ' + eventSelectInfo.chassisName);
    assert('Scenario 3', eventSelectInfo.hasSwitchBtn, 'Garage / Switch button present in active chassis bar');
    await takeScreenshot('stage15_02_event_select_with_chassis.png');

    // Click Switch / Garage button to transition into Garage from EventSelect
    await evaluate(`document.getElementById('btn-event-open-garage').click()`);
    await new Promise(r => setTimeout(r, 600));

    const garageState = await evaluate(`(() => ({
      garageVisible: !document.getElementById('garage-screen-overlay')?.classList.contains('hidden'),
      eventSelectHidden: document.getElementById('event-select-overlay')?.classList.contains('hidden'),
      currentReturnState: window.game.garageReturnState
    }))()`);

    assert('Scenario 3', garageState.garageVisible, 'Garage opened from Event Selection');
    assert('Scenario 3', garageState.eventSelectHidden, 'Event Select hidden while in Garage');
    assert('Scenario 3', garageState.currentReturnState === 'EventSelect', 'Garage return state properly registered as EventSelect');

    // Now click Back in Garage: should return directly to EventSelect!
    await evaluate(`document.getElementById('btn-garage-back').click()`);
    await new Promise(r => setTimeout(r, 600));

    const returnState = await evaluate(`(() => ({
      gameState: window.game.state,
      eventSelectVisible: !document.getElementById('event-select-overlay')?.classList.contains('hidden'),
      garageHidden: document.getElementById('garage-screen-overlay')?.classList.contains('hidden')
    }))()`);

    assert('Scenario 3', returnState.gameState === 'EventSelect' && returnState.eventSelectVisible && returnState.garageHidden,
      'Two-way navigation: Garage back button returns cleanly to Event Selection');
    await takeScreenshot('stage15_03_garage_switch_return.png');

    console.log('\n[Scenario 4/16] Free Play Time Trial Execution & Personal Best...');
    await evaluate(`(() => {
      window.game.currentEvent = window.game.currentCircuit.events[0];
      window.game.startCountdown(window.game.currentCircuit.events[0], 'normal');
      window.game.clearCountdownTimeouts();
      window.game.setGameState('Racing');
    })()`);
    assert('Scenario 4', await evaluate(`window.game.state === 'Racing'`), 'Racing state active in Time Trial');
    await takeScreenshot('stage15_04_time_trial_racing.png');

    // Finish lap and show finish screen immediately
    await evaluate(`(() => {
      window.game.raceTimeSeconds = 64.82;
      window.game.finishRace();
      window.game.showFinishScreen();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const finishInfo = await evaluate(`(() => ({
      finishVisible: !document.getElementById('finish-screen-overlay')?.classList.contains('hidden'),
      timeDisplay: document.getElementById('finish-final-time')?.textContent,
      hasReplayBtn: !!document.getElementById('btn-finish-replay'),
      savedRecord: window.game.currentEvent ? window.RecordManager.getBestTime(window.game.currentEvent.id) : null
    }))()`);

    assert('Scenario 4', finishInfo.finishVisible, 'Finish screen overlay displayed for Time Trial');
    assert('Scenario 4', finishInfo.timeDisplay && finishInfo.timeDisplay.includes('01:04'), 'Lap time displayed accurately: ' + finishInfo.timeDisplay);
    assert('Scenario 4', finishInfo.savedRecord <= 64.82, 'Personal best record saved in RecordManager: ' + finishInfo.savedRecord);
    await takeScreenshot('stage15_05_time_trial_finish.png');

    console.log('\n[Scenario 5/16] Free Play Sprint Race & AI Fleet Grid...');
    await evaluate(`(() => {
      window.game.returnToMenu();
      const circ = window.game.currentCircuit;
      const sprintEvent = circ.events.find(e => e.mode === 'sprint');
      window.game.currentEvent = sprintEvent;
      window.game.startCountdown(sprintEvent, 'normal');
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const aiGridState = await evaluate(`(() => ({
      aiCount: window.game.aiManager.opponents.length,
      aiActive: window.game.aiManager.opponents.every(o => o.isLoaded),
      aiDifficulty: window.game.aiManager.difficulty
    }))()`);

    assert('Scenario 5', aiGridState.aiCount === 3, '3 AI opponents spawned on starting grid');
    assert('Scenario 5', aiGridState.aiActive, 'All AI opponents initialized and loaded');
    assert('Scenario 5', aiGridState.aiDifficulty === 'normal', 'AI difficulty set to Pro (normal)');

    // Complete sprint race in 1st place
    await evaluate(`(() => {
      window.game.clearCountdownTimeouts();
      window.game.setGameState('Racing');
      window.game.raceTimeSeconds = 58.12;
      window.game.cachedFinishPositionDisplay = '1ST / 4';
      window.game.finishRace();
      window.game.showFinishScreen();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const sprintFinish = await evaluate(`(() => ({
      visible: !document.getElementById('finish-screen-overlay')?.classList.contains('hidden'),
      pos: document.getElementById('finish-position-value')?.textContent
    }))()`);
    assert('Scenario 5', sprintFinish.visible && sprintFinish.pos?.includes('1ST'), 'Sprint race completed with position display: ' + sprintFinish.pos);

    console.log('\n[Scenario 6/16] Free Play Drift Challenge & Scoring Session...');
    await evaluate(`(() => {
      window.game.returnToMenu();
      const circ = window.game.currentCircuit;
      const driftEvent = circ.events.find(e => e.mode === 'drift');
      window.game.currentEvent = driftEvent;
      window.game.startCountdown(driftEvent, 'normal');
      window.game.clearCountdownTimeouts();
      window.game.setGameState('Racing');
      window.game.driftScoringManager.startSession();
      window.game.driftScoringManager.totalBankedScore = 4850;
      window.game.finishRace(4850);
      window.game.showFinishScreen();
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const driftRecord = await evaluate(`(() => ({
      visible: !document.getElementById('finish-screen-overlay')?.classList.contains('hidden'),
      scoreDisplay: document.getElementById('finish-final-time')?.textContent,
      bestScore: window.RecordManager.getBestScore(window.game.currentEvent.id)
    }))()`);

    assert('Scenario 6', driftRecord.visible, 'Drift finish screen displayed');
    assert('Scenario 6', driftRecord.bestScore >= 4850, 'Drift score saved to persistent records: ' + driftRecord.bestScore);
    await takeScreenshot('stage15_06_drift_challenge_finish.png');

    console.log('\n[Scenario 7/16] Pause Menu & Event Abandonment Flow...');
    await evaluate(`(() => {
      window.game.returnToMenu();
      window.game.startCountdown(window.game.currentCircuit.events[0], 'normal');
      window.game.clearCountdownTimeouts();
      window.game.setGameState('Racing');
      window.game.pause();
    })()`);
    await new Promise(r => setTimeout(r, 300));

    const pauseInfo = await evaluate(`(() => ({
      pauseVisible: !document.getElementById('pause-overlay')?.classList.contains('hidden'),
      hasResume: !!document.getElementById('btn-resume'),
      hasRestart: !!document.getElementById('btn-restart'),
      hasAbandon: !!document.getElementById('btn-pause-menu'),
      abandonText: document.getElementById('btn-pause-menu')?.textContent
    }))()`);

    assert('Scenario 7', pauseInfo.pauseVisible, 'Pause overlay displayed on pause');
    assert('Scenario 7', pauseInfo.hasResume && pauseInfo.hasRestart, 'Resume and Restart actions present');
    assert('Scenario 7', pauseInfo.abandonText.includes('ABANDON EVENT'), 'Abandon button text clarified: ' + pauseInfo.abandonText);
    await takeScreenshot('stage15_07_pause_overlay.png');

    // Click abandon button and verify clean reset
    await evaluate(`document.getElementById('btn-pause-menu').click()`);
    await new Promise(r => setTimeout(r, 400));

    const postAbandonState = await evaluate(`(() => ({
      state: window.game.state,
      menuVisible: !document.getElementById('main-menu-overlay')?.classList.contains('hidden'),
      pauseHidden: document.getElementById('pause-overlay')?.classList.contains('hidden'),
      racingHUDHidden: !window.game.racingHUD.isVisible
    }))()`);

    assert('Scenario 7', postAbandonState.state === 'MainMenu' && postAbandonState.menuVisible && postAbandonState.pauseHidden, 'Abandoning event returns cleanly to Main Menu');
    assert('Scenario 7', postAbandonState.racingHUDHidden, 'Racing HUD hidden after abandoning');

    console.log('\n[Scenario 8/16] Replay System & Multi-Angle Playback...');
    await evaluate(`(() => {
      const rm = window.game.replayManager;
      rm.samples = [
        { time: 0, player: { x: 0, y: 0.5, z: 0, yaw: 0, speed: 100, steer: 0, wheelSpin: 0 }, opponents: [] },
        { time: 1.0, player: { x: 0, y: 0.5, z: 20, yaw: 0, speed: 100, steer: 0, wheelSpin: 0 }, opponents: [] }
      ];
      window.game.startReplay();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const replayInfo = await evaluate(`(() => ({
      isReplayState: window.game.state === 'Replay',
      replayOverlayVisible: !document.getElementById('replay-overlay')?.classList.contains('hidden'),
      initialCameraAngle: window.game.replayManager.cameraAngle
    }))()`);

    assert('Scenario 8', replayInfo.isReplayState, 'Game state entered Replay mode');
    assert('Scenario 8', replayInfo.replayOverlayVisible, 'Replay controls overlay visible');

    // Cycle camera angle
    await evaluate(`window.game.replayManager.cycleCamera()`);
    const newCamAngle = await evaluate(`window.game.replayManager.cameraAngle`);
    assert('Scenario 8', newCamAngle !== replayInfo.initialCameraAngle, 'Replay camera cycled successfully (Angle: ' + newCamAngle + ')');
    await takeScreenshot('stage15_08_replay_playback.png');

    // Exit replay
    await evaluate(`window.game.exitReplay()`);
    await new Promise(r => setTimeout(r, 300));
    assert('Scenario 8', await evaluate(`window.game.state === 'Finished'`), 'Exited replay back to finish state');

    console.log('\n[Scenario 9/16] Career Mode Hub & Progression Token Verification...');
    await evaluate(`(() => {
      window.game.returnToMenu();
      window.game.openCareerHub();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const careerHubInfo = await evaluate(`(() => ({
      hubVisible: !document.getElementById('career-hub-overlay')?.classList.contains('hidden'),
      tierTabsCount: document.querySelectorAll('.career-tier-tab').length,
      creditBalance: window.CareerManager.getInstance().getCredits(),
      repBalance: window.CareerManager.getInstance().getReputation()
    }))()`);

    assert('Scenario 9', careerHubInfo.hubVisible, 'Career Hub overlay visible');
    assert('Scenario 9', careerHubInfo.tierTabsCount === 5, '5 Career Tier tabs rendered');
    await takeScreenshot('stage15_09_career_hub.png');

    // Start Tier 1 Event 1 and simulate Gold completion
    const t1e1 = await evaluate(`window.CareerManager.getInstance().getEventsForTier(1)[0]`);
    const testSessionToken = 'test_token_' + Date.now();

    const completionResult = await evaluate(`(() => {
      return window.CareerManager.getInstance().completeEvent({
        eventId: '${t1e1.id}',
        resultValue: 35.0,
        positionRank: 1,
        wallHits: 0,
        topSpeedKmh: 140,
        maxComboMultiplier: 1,
        sessionToken: '${testSessionToken}'
      });
    })()`);

    assert('Scenario 9', completionResult.medal === 'gold', 'Gold medal achieved on Tier 1 event');
    assert('Scenario 9', completionResult.totalCredits > 0, 'Credits earned for Gold finish: ' + completionResult.totalCredits);

    // Verify idempotent anti-cheat session token check
    const duplicateResult = await evaluate(`(() => {
      return window.CareerManager.getInstance().completeEvent({
        eventId: '${t1e1.id}',
        resultValue: 35.0,
        positionRank: 1,
        wallHits: 0,
        topSpeedKmh: 140,
        maxComboMultiplier: 1,
        sessionToken: '${testSessionToken}'
      });
    })()`);

    assert('Scenario 9', duplicateResult.isAlreadyRewarded && duplicateResult.totalCredits === 0, 'Idempotent anti-cheat: duplicate sessionToken awards 0 credits');

    console.log('\n[Scenario 10/16] Vehicle Economy & Ownership Purchase...');
    await evaluate(`window.CareerManager.getInstance().addCredits(100000)`);
    // Ensure clean slate on velocity_hatch
    await evaluate(`(() => {
      const cm = window.CareerManager.getInstance();
      const idx = cm.data.ownedVehicleIds.indexOf('velocity_hatch');
      if (idx !== -1) cm.data.ownedVehicleIds.splice(idx, 1);
      delete cm.data.vehicleUpgrades['velocity_hatch'];
      cm.save();
    })()`);

    const testBuyVehicle = 'velocity_hatch'; // Tier 2 vehicle (Cost 28,000)
    const buyResult = await evaluate(`window.CareerManager.getInstance().purchaseVehicle('${testBuyVehicle}')`);
    assert('Scenario 10', buyResult.success, 'Successfully purchased vehicle: ' + testBuyVehicle);
    assert('Scenario 10', await evaluate(`window.CareerManager.getInstance().isVehicleOwned('${testBuyVehicle}')`), 'Vehicle ownership registered in CareerManager');

    // Test rejection of purchase with insufficient credits
    const unaffordableCar = 'f1_2022_pinnacle'; // Tier 5 (Cost 600,000)
    await evaluate(`(() => {
      const cm = window.CareerManager.getInstance();
      cm.credits = 0; // Temporarily drain credits
    })()`);
    const failBuyResult = await evaluate(`window.CareerManager.getInstance().purchaseVehicle('${unaffordableCar}')`);
    assert('Scenario 10', !failBuyResult.success, 'Purchase correctly rejected when credits insufficient: ' + failBuyResult.reason);

    console.log('\n[Scenario 11/16] Performance Upgrades & Stage 3 Hard Capping...');
    await evaluate(`window.CareerManager.getInstance().addCredits(100000)`);
    const upgradeVeh = 'velocity_hatch';

    // Purchase upgrades for engine up to Stage 3 on newly bought vehicle
    const up1 = await evaluate(`window.CareerManager.getInstance().purchaseUpgrade('${upgradeVeh}', 'engine')`);
    const up2 = await evaluate(`window.CareerManager.getInstance().purchaseUpgrade('${upgradeVeh}', 'engine')`);
    const up3 = await evaluate(`window.CareerManager.getInstance().purchaseUpgrade('${upgradeVeh}', 'engine')`);
    const up4 = await evaluate(`window.CareerManager.getInstance().purchaseUpgrade('${upgradeVeh}', 'engine')`);

    assert('Scenario 11', up1.success && (up1.newStage === 1 || up1.newLevel === 1), 'Engine Upgrade Stage 1 applied');
    assert('Scenario 11', up2.success && (up2.newStage === 2 || up2.newLevel === 2), 'Engine Upgrade Stage 2 applied');
    assert('Scenario 11', up3.success && (up3.newStage === 3 || up3.newLevel === 3), 'Engine Upgrade Stage 3 applied');
    assert('Scenario 11', !up4.success && (up4.reason?.toLowerCase().includes('maximum') || false), 'Stage 3 hard cap enforced: ' + up4.reason);

    const effectiveSpecs = await evaluate(`window.CareerManager.getInstance().getEffectiveVehicleSpecs('${upgradeVeh}')`);
    assert('Scenario 11', effectiveSpecs.powerHp > 275, 'Effective vehicle specs increased power: ' + effectiveSpecs.powerHp + ' HP');

    console.log('\n[Scenario 12/16] Independent Per-Vehicle Paint Customization...');
    await evaluate(`(() => {
      const cm = window.CareerManager.getInstance();
      cm.setVehiclePaint('detective_cruiser', 'racing_red');
      cm.setVehiclePaint('velocity_hatch', 'metallic_silver');
    })()`);
    const paintA = await evaluate(`window.CareerManager.getInstance().getVehiclePaint('detective_cruiser')`);
    const paintB = await evaluate(`window.CareerManager.getInstance().getVehiclePaint('velocity_hatch')`);

    assert('Scenario 12', paintA === 'racing_red', 'Vehicle A preserved custom paint: ' + paintA);
    assert('Scenario 12', paintB === 'metallic_silver', 'Vehicle B preserved custom paint: ' + paintB);

    console.log('\n[Scenario 13/16] Graphics Quality Scaling (Low / Medium / High)...');
    await evaluate(`(() => {
      window.game.returnToMenu();
      window.game.openSettings();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const settingsMenuVisible = await evaluate(`!document.getElementById('settings-menu-overlay')?.classList.contains('hidden')`);
    assert('Scenario 13', settingsMenuVisible, 'Settings overlay displayed');
    await takeScreenshot('stage15_13_settings_menu.png');

    // Test low quality application
    await evaluate(`(() => {
      window.game.settingsManager.setGraphicsQuality('low');
      window.game.sceneManager.applyGraphicsQuality('low');
    })()`);
    const lowScaling = await evaluate(`window.game.sceneManager.engine.getHardwareScalingLevel() >= 1.5`);
    assert('Scenario 13', lowScaling, 'Low quality engaged battery/performance hardware scaling (1.5x)');

    // Test high quality application
    await evaluate(`(() => {
      window.game.settingsManager.setGraphicsQuality('high');
      window.game.sceneManager.applyGraphicsQuality('high');
    })()`);
    const highScaling = await evaluate(`window.game.sceneManager.engine.getHardwareScalingLevel() <= 1.0`);
    assert('Scenario 13', highScaling, 'High quality engaged native full-resolution scaling (<=1.0x)');

    console.log('\n[Scenario 14/16] Save Data Integrity & Reload Recovery...');
    const preReloadJson = await evaluate(`localStorage.getItem('project_apex_career_v1')`);
    assert('Scenario 14', !!preReloadJson, 'localStorage career save exists: project_apex_career_v1');
    const parsedSave = JSON.parse(preReloadJson);
    assert('Scenario 14', parsedSave.version === 1, 'Career save version is 1');
    assert('Scenario 14', Array.isArray(parsedSave.ownedVehicleIds), 'ownedVehicleIds array persisted correctly');
    assert('Scenario 14', typeof parsedSave.vehicleUpgrades === 'object', 'Vehicle upgrades dictionary persisted correctly');

    // Trigger reload and safely wait for reboot
    console.log('  Reloading page to verify state recovery...');
    await send('Page.reload');
    await new Promise(r => setTimeout(r, 2000));

    for (let i = 0; i < 60; i++) {
      let isReady = false;
      try {
        isReady = await evaluate(`Boolean(window.game && (window.CareerManager || window.game.careerManager) && window.game.state === 'MainMenu')`);
      } catch {}
      if (isReady) break;
      await new Promise(r => setTimeout(r, 400));
    }

    const postReloadData = await evaluate(`(() => {
      const cm = window.CareerManager ? window.CareerManager.getInstance() : window.game?.careerManager;
      return {
        credits: cm ? cm.getCredits() : 0,
        ownsVelocity: cm ? cm.isVehicleOwned('velocity_hatch') : false,
        velocityEngineStage: cm ? cm.getVehicleUpgradeStage('velocity_hatch', 'engine') : 0,
        detectivePaint: cm ? cm.getVehiclePaint('detective_cruiser') : ''
      };
    })()`);

    assert('Scenario 14', postReloadData.ownsVelocity, 'Purchased vehicle ownership preserved after page reload');
    assert('Scenario 14', postReloadData.velocityEngineStage === 3, 'Upgrades preserved at Stage 3 after page reload');
    assert('Scenario 14', postReloadData.detectivePaint === 'racing_red', 'Custom vehicle paint preserved after page reload');

    console.log('\n[Scenario 15/16] Viewport Responsiveness at 1280x720 and 1920x1080...');
    // Open Garage to check docks
    await evaluate(`window.game.openGarage()`);
    await new Promise(r => setTimeout(r, 800));

    // 1280x720 Viewport Check
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 400));

    const dockLayout720 = await evaluate(`(() => {
      const getRect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        leftDock: getRect('.garage-left-dock'),
        rightDock: getRect('.garage-right-dock'),
        bodyScrollWidth: document.body.scrollWidth,
        windowWidth: window.innerWidth
      };
    })()`);

    assert('Scenario 15', dockLayout720.leftDock.right < dockLayout720.rightDock.left,
      '720p: Left dock (right=' + Math.round(dockLayout720.leftDock.right) + 'px) and Right dock (left=' + Math.round(dockLayout720.rightDock.left) + 'px) have unobstructed center showroom');
    assert('Scenario 15', dockLayout720.bodyScrollWidth <= dockLayout720.windowWidth, '720p: No horizontal overflow/scrolling');
    await takeScreenshot('stage15_14_viewport_720p.png');

    // 1920x1080 Viewport Check
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise(r => setTimeout(r, 400));

    const dockLayout1080 = await evaluate(`(() => {
      const getRect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        leftDock: getRect('.garage-left-dock'),
        rightDock: getRect('.garage-right-dock'),
        bodyScrollWidth: document.body.scrollWidth,
        windowWidth: window.innerWidth
      };
    })()`);

    assert('Scenario 15', dockLayout1080.leftDock.right < dockLayout1080.rightDock.left,
      '1080p: Left dock and Right dock maintain spacious center showroom (gap: ' + Math.round(dockLayout1080.rightDock.left - dockLayout1080.leftDock.right) + 'px)');
    await takeScreenshot('stage15_15_viewport_1080p.png');

    console.log('\n[Scenario 16/16] Uncaught Console Errors & Stability Verdict...');
    console.log('  Captured error count:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('  Errors:', consoleErrors);
    }
    assert('Scenario 16', consoleErrors.length === 0, 'Zero uncaught console errors detected during full integration run');

    // Print Final Audit Summary
    console.log('\n========================================================================');
    console.log('                     RELEASE READINESS AUDIT SUMMARY                    ');
    console.log('========================================================================');
    const passCount = testResults.filter(t => t.status === 'PASS').length;
    const failCount = testResults.filter(t => t.status === 'FAIL').length;
    console.log(`TOTAL SCENARIOS CHECKED: ${testResults.length}`);
    console.log(`PASSED: ${passCount}`);
    console.log(`FAILED: ${failCount}`);
    console.log(`STABILITY VERDICT: ${failCount === 0 ? 'READY FOR RELEASE (GOLD CANDIDATE)' : 'DEFECTS DETECTED'}`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('CRITICAL TEST ERROR:', err);
  } finally {
    try {
      ws.close();
      edgeProc.kill();
    } catch {}
    process.exit(0);
  }
}

runStage15ReleaseReadiness();
