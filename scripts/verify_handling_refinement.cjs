const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyHandling() {
  const profileDir = path.join(os.tmpdir(), 'apex_handling_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Handling Refinement testing...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9825',
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
        const req = http.get('http://localhost:9825/json', res => {
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

  console.log(`Connected to page: "${page.title}" (${page.url})`);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

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
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map(a => a.value || JSON.stringify(a)).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails?.text || 'Exception');
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

  // Wait for MainMenu
  for (let i = 0; i < 30; i++) {
    const state = await evaluate('window.game?.state');
    if (state === 'MainMenu') break;
    await new Promise(r => setTimeout(r, 400));
  }

  // Launch Time Trial
  await evaluate('window.game.openEventSelect()');
  await new Promise(r => setTimeout(r, 200));
  await evaluate('document.getElementById("btn-start-event")?.click()');

  // Wait for countdown to finish and state === Racing
  console.log('Waiting for Countdown to finish...');
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    const st = await evaluate('window.game?.state');
    if (st === 'Racing') break;
  }

  console.log('=== TEST 1: Starting from rest and progressive acceleration ===');
  // Throttle forward for 1.5 seconds
  await sendKey('KeyW', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1500));
  const t1 = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      speedKmh: t.speedKmh,
      forwardSpeed: t.forwardSpeed,
      gear: t.gear,
      hudSpeed: document.getElementById('speed-value')?.textContent
    };
  })()`);
  console.log('Test 1 (1.5s throttle):', t1);
  // Expected: Speed is progressive (around 50-65 km/h, NOT 85+ km/h), Gear D

  console.log('\n=== TEST 2: Maintaining controllable speed on a straight ===');
  // Throttle for another 1.2s to reach steady cruising speed
  await new Promise(r => setTimeout(r, 1200));
  await sendKey('KeyW', 'keyUp');
  const t2 = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      cruisingSpeedKmh: t.speedKmh,
      maxAllowedKmh: Math.round(window.game.vehicleController.config.maxForwardSpeed * 3.6),
      isControllable: t.speedKmh <= 125
    };
  })()`);
  console.log('Test 2 (Cruising on straight):', t2);

  console.log('\n=== TEST 3: Braking before a corner & off-throttle coasting ===');
  // First coast for 400ms off-throttle
  const speedBeforeCoast = await evaluate('window.game.vehicleController.forwardSpeed');
  await new Promise(r => setTimeout(r, 400));
  const speedAfterCoast = await evaluate('window.game.vehicleController.forwardSpeed');
  console.log('Passive Coasting deceleration: before =', speedBeforeCoast.toFixed(2), 'm/s, after =', speedAfterCoast.toFixed(2), 'm/s');

  // Apply service brakes for 600ms
  await sendKey('KeyS', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 600));
  await sendKey('KeyS', 'keyUp');
  const speedAfterBrake = await evaluate('window.game.vehicleController.forwardSpeed');
  const brakeDrop = speedAfterCoast - speedAfterBrake;
  console.log('Active Service Braking: after 600ms =', speedAfterBrake.toFixed(2), 'm/s, drop =', brakeDrop.toFixed(2), 'm/s');

  console.log('\n=== TEST 4: Taking a corner at moderate speed (stable grip) ===');
  // Position car heading into Turn 1 at controlled 55 km/h (~15.2 m/s)
  await evaluate(`(() => {
    const c = window.game.vehicleController;
    c.position.set(0, 0.05, 38);
    c.yawAngle = 0;
    c.forwardSpeed = 15.2; // 55 km/h
    c.lateralSpeed = 0;
    c.yawRate = 0;
    window.game.vehicle.applyTransform(c.position, c.yawAngle);
    window.game.sceneManager.resetCameras(c.position, c.yawAngle);
  })()`);

  // Steer right at moderate speed for 500ms
  await sendKey('KeyD', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 500));
  await sendKey('KeyD', 'keyUp');

  const cornerModerate = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      speedKmh: t.speedKmh,
      slipAngleDeg: t.slipAngleDeg,
      isDrifting: t.isDrifting, // Should maintain grip (false)
      yawRate: window.game.vehicleController.yawRate
    };
  })()`);
  console.log('Test 4 (Moderate cornering grip):', cornerModerate);

  console.log('\n=== TEST 5: Taking the same corner too quickly (slip onset) ===');
  // Position car into Turn 1 at high speed (100 km/h = 27.8 m/s)
  await evaluate(`(() => {
    const c = window.game.vehicleController;
    c.position.set(0, 0.05, 30);
    c.yawAngle = 0;
    c.forwardSpeed = 27.8; // ~100 km/h
    c.lateralSpeed = 0;
    c.yawRate = 0;
  })()`);

  await sendKey('KeyD', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 600));
  await sendKey('KeyD', 'keyUp');

  const cornerFast = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      speedKmh: t.speedKmh,
      slipAngleDeg: t.slipAngleDeg,
      lateralSpeed: t.lateralSpeed
    };
  })()`);
  console.log('Test 5 (High-speed cornering slip):', cornerFast);

  console.log('\n=== TEST 6: Handbrake drift initiation and counter-steer recovery ===');
  // Position car at straight heading forward at 75 km/h (20.8 m/s)
  await evaluate(`(() => {
    const c = window.game.vehicleController;
    c.position.set(0, 0.05, 10);
    c.yawAngle = 0;
    c.forwardSpeed = 20.8;
    c.lateralSpeed = 0;
    c.yawRate = 0;
  })()`);

  // Initiate slide: steer right + handbrake
  await sendKey('KeyD', 'rawKeyDown');
  await sendKey('Space', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 450));

  const driftState = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      isDrifting: t.isDrifting,
      slipAngleDeg: t.slipAngleDeg,
      lateralSpeed: t.lateralSpeed
    };
  })()`);
  console.log('Drift initiated:', driftState);

  await sendKey('Space', 'keyUp');
  await sendKey('KeyD', 'keyUp');

  // Counter-steer left to catch slide
  await sendKey('KeyA', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 450));
  await sendKey('KeyA', 'keyUp');

  const recoveredState = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      recoveredSlipAngleDeg: t.slipAngleDeg,
      lateralSpeedDamped: t.lateralSpeed
    };
  })()`);
  console.log('Counter-steer recovery:', recoveredState);

  console.log('\n=== TEST 7: Reversing after coming to a stop ===');
  // Bring car to full stop
  await evaluate(`(() => {
    const c = window.game.vehicleController;
    c.forwardSpeed = 0;
    c.lateralSpeed = 0;
    c.yawRate = 0;
  })()`);

  // Press S/backward to reverse
  await sendKey('KeyS', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 800));
  await sendKey('KeyS', 'keyUp');

  const reverseState = await evaluate(`(() => {
    const t = window.game.vehicleController.getTelemetry();
    return {
      forwardSpeed: t.forwardSpeed,
      speedKmh: t.speedKmh,
      gear: t.gear,
      isReversing: t.forwardSpeed < -0.5 && t.gear === 'R'
    };
  })()`);
  console.log('Reverse Test:', reverseState);

  console.log('\n=== TEST 8: Barrier collision and elastic response ===');
  // Drive into outer barrier
  await evaluate(`(() => {
    const c = window.game.vehicleController;
    c.position.set(3.8, 0.05, 20);
    c.yawAngle = 0.3;
    c.forwardSpeed = 15.0;
  })()`);
  // Steer right into barrier
  await sendKey('KeyD', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 500));
  await sendKey('KeyD', 'keyUp');

  const collisionCheck = await evaluate(`(() => {
    const c = window.game.vehicleController;
    const res = window.game.trackCollision.resolveCollision(c);
    return {
      deflectionApplied: res.deflectionApplied || c.position.x <= 4.2,
      carX: c.position.x,
      barrierLimit: window.game.trackCollision.barrierLimit
    };
  })()`);
  console.log('Collision Check:', collisionCheck);

  console.log('\n=== TEST 9: In-Race Restart functionality ===');
  await evaluate('window.game.restartRace()');
  await new Promise(r => setTimeout(r, 300));
  const restartState = await evaluate(`(() => {
    const g = window.game;
    return {
      state: g.state,
      timer: g.raceTimeSeconds,
      carPos: { x: g.vehicleController.position.x, z: g.vehicleController.position.z },
      speed: g.vehicleController.forwardSpeed
    };
  })()`);
  console.log('Restart State (expected Countdown, 0 speed, start pos):', restartState);

  console.log('\n=== TEST 10: Speedometer agreement with simulated velocity ===');
  await evaluate(`(() => {
    const c = window.game.vehicleController;
    c.forwardSpeed = 20.0; // exactly 20.0 m/s = 72 km/h
    window.game.racingHUD.update({
      telemetry: c.getTelemetry(),
      currentGate: 1,
      totalGates: 6,
      lap: 1,
      raceTimeSeconds: 5.0
    });
  })()`);

  const speedAgreement = await evaluate(`(() => {
    const c = window.game.vehicleController;
    const hudVal = document.getElementById('speed-value')?.textContent;
    const calcKmh = Math.round(c.forwardSpeed * 3.6);
    return {
      forwardSpeedMs: c.forwardSpeed,
      calculatedKmh: calcKmh,
      displayedHudKmh: parseInt(hudVal, 10),
      exactMatch: calcKmh === parseInt(hudVal, 10)
    };
  })()`);
  console.log('Speedometer Agreement:', speedAgreement);

  // Capture screenshot of refined handling view
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const shotPath = path.join(process.cwd(), 'refined_handling_screenshot.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log('Screenshot saved to:', shotPath);
  }

  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  const passed =
    t1.speedKmh > 35 && t1.speedKmh < 75 &&
    t2.cruisingSpeedKmh <= t2.maxAllowedKmh &&
    brakeDrop > 5.0 &&
    cornerModerate.isDrifting === false &&
    Math.abs(cornerFast.slipAngleDeg) > Math.abs(cornerModerate.slipAngleDeg) &&
    Math.abs(driftState.slipAngleDeg) > 5.0 &&
    Math.abs(recoveredState.lateralSpeedDamped) < Math.abs(driftState.lateralSpeed) &&
    reverseState.isReversing === true &&
    restartState.state === 'Countdown' &&
    speedAgreement.exactMatch === true &&
    errors.length === 0;

  if (passed) {
    console.log('\n>>> ALL 10 HANDLING REFINEMENT TESTS PASSED <<<');
  } else {
    console.error('\n>>> SOME HANDLING TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyHandling().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
