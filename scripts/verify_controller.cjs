const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyController() {
  const profileDir = path.join(os.tmpdir(), 'apex_ctrl_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Milestone 2 controller testing...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9555',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9555/json', res => {
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
    console.error('Failed to find Page target. Targets:', targets);
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

  // Wait until game and vehicleController are fully initialized
  console.log('Waiting for vehicle and controller to finish loading...');
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate('!!window.game?.vehicleController');
    if (ready) {
      console.log('Vehicle and controller are fully initialized!');
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

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
      key: code.replace('Key', '').toLowerCase()
    });
  }

  console.log('\n--- Test 1: Initial State & Positioning ---');
  const initial = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    return {
      pos: c?.position,
      yaw: c?.yawAngle,
      speed: c?.forwardSpeed,
      wheels: window.game?.vehicle?.metadata?.wheelNodeNames
    };
  })()`);
  console.log('Initial position:', initial?.pos, 'Yaw:', initial?.yaw, 'Speed:', initial?.speed);

  console.log('\n--- Test 2: Acceleration (holding W for 1.5s) ---');
  await sendKey('KeyW', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1500));
  const accelState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const t = c?.getTelemetry();
    return {
      pos: c?.position,
      speedKmh: t?.speedKmh,
      forwardSpeed: c?.forwardSpeed,
      wheelSpinAngle: c?.wheelSpinAngle,
      gear: t?.gear
    };
  })()`);
  console.log('Accelerated to:', accelState?.speedKmh, 'KM/H (forwardSpeed:', accelState?.forwardSpeed?.toFixed(2), 'm/s)');
  console.log('Position after accel:', accelState?.pos);
  console.log('Wheel spin angle:', accelState?.wheelSpinAngle?.toFixed(2), 'rad');

  console.log('\n--- Test 3: Steering & Drifting (W + A + Space for 1.2s) ---');
  await sendKey('KeyA', 'rawKeyDown');
  await sendKey('Space', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1200));

  const driftState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const t = c?.getTelemetry();
    const wheels = window.game?.vehicle?.wheels;
    return {
      pos: c?.position,
      speedKmh: t?.speedKmh,
      forwardSpeed: c?.forwardSpeed,
      lateralSpeed: c?.lateralSpeed,
      slipAngleDeg: t?.slipAngleDeg,
      steeringAngleDeg: t?.steeringAngleDeg,
      isDrifting: t?.isDrifting,
      handbrakeActive: t?.handbrakeActive,
      flWheelRotY: wheels?.frontLeft?.rotation?.y,
      flWheelRotX: wheels?.frontLeft?.rotation?.x
    };
  })()`);
  console.log('Drift State:', driftState);

  // Take screenshot while drifting!
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const shotPath = path.join(process.cwd(), 'milestone2_screenshot.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Screenshot saved to: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);
  }

  // Release keys
  await sendKey('Space', 'keyUp');
  await sendKey('KeyA', 'keyUp');
  await sendKey('KeyW', 'keyUp');

  console.log('\n--- Test 4: Drift Recovery & Natural Deceleration (1.0s) ---');
  await new Promise(r => setTimeout(r, 1000));
  const recoveredState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const t = c?.getTelemetry();
    return {
      speedKmh: t?.speedKmh,
      lateralSpeed: c?.lateralSpeed,
      isDrifting: t?.isDrifting
    };
  })()`);
  console.log('Recovered state: speed:', recoveredState?.speedKmh, 'KM/H, lateralSpeed:', recoveredState?.lateralSpeed?.toFixed(2), 'm/s, drifting:', recoveredState?.isDrifting);

  console.log('\n--- Test 5: Service Braking (holding S for 1.2s) ---');
  await sendKey('KeyS', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1200));
  const brakeState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const t = c?.getTelemetry();
    return {
      forwardSpeed: c?.forwardSpeed,
      speedKmh: t?.speedKmh,
      gear: t?.gear
    };
  })()`);
  console.log('Braked state: forwardSpeed:', brakeState?.forwardSpeed?.toFixed(2), 'gear:', brakeState?.gear);

  console.log('\n--- Test 6: Reverse (holding S for another 1.2s) ---');
  await new Promise(r => setTimeout(r, 1200));
  const reverseState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const t = c?.getTelemetry();
    return {
      forwardSpeed: c?.forwardSpeed,
      speedKmh: t?.speedKmh,
      gear: t?.gear
    };
  })()`);
  console.log('Reverse state: forwardSpeed:', reverseState?.forwardSpeed?.toFixed(2), 'gear:', reverseState?.gear);
  await sendKey('KeyS', 'keyUp');

  console.log('\n--- Test 7: Reset functionality (KeyR) ---');
  await sendKey('KeyR', 'rawKeyDown');
  await sendKey('KeyR', 'keyUp');
  await new Promise(r => setTimeout(r, 300));
  const resetState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const t = c?.getTelemetry();
    return {
      pos: c?.position,
      yaw: c?.yawAngle,
      forwardSpeed: c?.forwardSpeed,
      lateralSpeed: c?.lateralSpeed,
      speedKmh: t?.speedKmh
    };
  })()`);
  console.log('Reset state:', resetState);

  console.log('\n--- Verification Summary ---');
  console.log('Total console logs:', consoleLogs.length);
  console.log('Console errors:', errors.length);
  if (consoleLogs.length > 0) {
    consoleLogs.forEach(l => console.log(`  [${l.type}] ${l.text}`));
  }

  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  const passed =
    accelState?.forwardSpeed > 5.0 &&
    driftState?.isDrifting === true &&
    reverseState?.forwardSpeed < -1.0 &&
    resetState?.speedKmh === 0 &&
    errors.length === 0;

  if (passed) {
    console.log('\n>>> ALL MILESTONE 2 CONTROLLER TESTS PASSED <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyController().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
