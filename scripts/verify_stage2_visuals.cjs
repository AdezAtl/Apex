const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage2Visuals() {
  const profileDir = path.join(os.tmpdir(), 'apex_visual_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Stage 2 Visual Overhaul regression test...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9855',
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
        const req = http.get('http://localhost:9855/json', res => {
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
      pending.delete(msg.id);
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

  async function sendKey(code, type = 'rawKeyDown') {
    await send('Input.dispatchKeyEvent', {
      type: type,
      code: code,
      key: code === 'Escape' ? 'Escape' : code.replace('Key', '').toLowerCase()
    });
  }

  // 1. Scene load verification
  console.log('\n--- CHECK 1: Scene load & boot state ---');
  for (let i = 0; i < 30; i++) {
    const state = await evaluate('window.game?.state');
    if (state === 'MainMenu') break;
    await new Promise(r => setTimeout(r, 400));
  }
  const bootState = await evaluate('window.game?.state');
  console.log('Boot state:', bootState, 'Errors:', JSON.stringify(consoleErrors, null, 2));

  // Capture Main Menu overhaul screenshot
  const menuShot = await send('Page.captureScreenshot', { format: 'png' });
  if (menuShot && menuShot.data) {
    const p = path.join(process.cwd(), 'stage2_main_menu.png');
    fs.writeFileSync(p, Buffer.from(menuShot.data, 'base64'));
    console.log('Saved Main Menu screenshot:', p);
  }

  // 2. Vehicle & wheel animations verification
  console.log('\n--- CHECK 2: Vehicle & animated wheels ---');
  const vehicleAudit = await evaluate(`(() => {
    const v = window.game.vehicle;
    return {
      hasCar: !!v,
      wheelCount: Object.values(v.wheels).filter(Boolean).length,
      hasContactShadow: !!v.contactShadow,
      shadowPos: v.contactShadow?.position
    };
  })()`);
  console.log('Vehicle audit:', vehicleAudit);

  // 3. Track and road surface materials audit
  console.log('\n--- CHECK 3: Track materials, detailMap, and markings ---');
  const trackAudit = await evaluate(`(() => {
    const tl = window.game.trackLoader;
    const s = window.game.sceneManager.scene;
    const markings = s.getMeshByName('CircuitRoadMarkings');
    const verges = s.getMeshByName('CircuitRoadVerges');
    const sky = s.getMeshByName('SkyBox');
    const terrain = s.getMeshByName('GroundTerrain');
    const trees = s.meshes.filter(m => m.name.startsWith('Forest_Inst_'));
    const matNames = s.materials.map(m => m.name);
    const colormapCount = matNames.filter(n => n === 'colormap').length;

    return {
      tileCount: tl.pieces.length,
      hasMasterMat: !!tl.masterTrackMaterial,
      hasAsphaltNoise: !!tl.masterTrackMaterial?.ambientTexture,
      hasMarkings: !!markings,
      markingsVertices: markings?.getTotalVertices?.(),
      hasVerges: !!verges,
      hasSky: !!sky,
      hasTerrain: !!terrain,
      treeInstanceCount: trees.length,
      uniqueMaterials: matNames.length,
      colormapMaterialCount: colormapCount,
      fogMode: s.fogMode,
      fogStart: s.fogStart,
      fogEnd: s.fogEnd
    };
  })()`);
  console.log('Track and Environment audit:', trackAudit);

  // 4. Launch Time Trial & Race state verification
  console.log('\n--- CHECK 4: Event start & Countdown ---');
  await evaluate('window.game.openEventSelect()');
  await new Promise(r => setTimeout(r, 200));
  await evaluate('document.getElementById("btn-start-event")?.click()');

  // Wait for Racing state
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const st = await evaluate('window.game?.state');
    if (st === 'Racing') break;
  }
  const racingState = await evaluate('window.game?.state');
  console.log('Active race state:', racingState);

  // 5. Drive vehicle forward along the start straight
  console.log('\n--- CHECK 5: Driving, ground contact, and wheel steering ---');
  await sendKey('KeyW', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1200));

  // Steer right while accelerating to check wheel steering and road visibility
  await sendKey('KeyD', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 400));

  const drivingCheck = await evaluate(`(() => {
    const c = window.game.vehicleController;
    const t = c.getTelemetry();
    const wheels = window.game.vehicle.wheels;
    const v = window.game.vehicle;
    return {
      speedKmh: t.speedKmh,
      forwardSpeed: c.forwardSpeed,
      carPosY: c.position.y,
      isGrounded: Math.abs(c.position.y - 0.05) < 0.01,
      steerAngle: c.steeringAngle,
      flWheelRotY: wheels.frontLeft?.rotation?.y,
      frWheelRotY: wheels.frontRight?.rotation?.y,
      wheelsTurningRight: wheels.frontLeft?.rotation?.y < 0,
      contactShadowY: v.contactShadow?.position?.y
    };
  })()`);
  console.log('Driving & Steering telemetry:', drivingCheck);

  // Capture in-race screenshot
  const raceShot = await send('Page.captureScreenshot', { format: 'png' });
  if (raceShot && raceShot.data) {
    const p = path.join(process.cwd(), 'stage2_racing_view.png');
    fs.writeFileSync(p, Buffer.from(raceShot.data, 'base64'));
    console.log('Saved In-Race screenshot:', p);
  }

  await sendKey('KeyD', 'keyUp');
  await sendKey('KeyW', 'keyUp');

  // 6. Test Low Graphics Setting
  console.log('\n--- CHECK 6: Low Graphics Quality Scaling ---');
  await evaluate('window.game.settingsManager.setGraphicsQuality("low"); window.game.sceneManager.applyGraphicsQuality("low");');
  await new Promise(r => setTimeout(r, 300));

  const lowQualityCheck = await evaluate(`(() => {
    return {
      scalingLevel: window.game.sceneManager.engine.getHardwareScalingLevel(),
      shadowRenderCount: window.game.sceneManager.shadowGenerator?.getShadowMap()?.renderList?.length || 0,
      state: window.game.state
    };
  })()`);
  console.log('Low Graphics audit:', lowQualityCheck);

  // Restore Medium Graphics
  await evaluate('window.game.settingsManager.setGraphicsQuality("medium"); window.game.sceneManager.applyGraphicsQuality("medium");');

  // 7. Checkpoints and HUD check
  console.log('\n--- CHECK 7: Checkpoints and HUD progress ---');
  const hudCheck = await evaluate(`(() => {
    return {
      hudSpeed: document.getElementById('speed-value')?.textContent,
      gear: document.getElementById('gear-value')?.textContent,
      gateInfo: document.getElementById('gate-indicator')?.textContent,
      activeGateIndex: window.game.checkpointManager.currentCheckpointIndex,
      raceTime: window.game.raceTimeSeconds
    };
  })()`);
  console.log('HUD check:', hudCheck);

  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  const passed =
    bootState === 'MainMenu' &&
    vehicleAudit.hasCar &&
    vehicleAudit.wheelCount === 4 &&
    vehicleAudit.hasContactShadow &&
    trackAudit.hasMasterMat &&
    trackAudit.hasAsphaltNoise === true &&
    trackAudit.hasMarkings &&
    trackAudit.hasSky &&
    trackAudit.treeInstanceCount >= 25 &&
    racingState === 'Racing' &&
    drivingCheck.speedKmh > 20 &&
    drivingCheck.isGrounded &&
    drivingCheck.wheelsTurningRight &&
    lowQualityCheck.scalingLevel === 1.5 &&
    consoleErrors.length === 0;

  if (passed) {
    console.log('\n>>> ALL 10 STAGE 2 VISUAL FOUNDATION REGRESSION TESTS PASSED <<<');
  } else {
    console.error('\n>>> STAGE 2 VISUAL TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyStage2Visuals().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
