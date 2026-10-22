const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyCameraAndHUD() {
  const profileDir = path.join(os.tmpdir(), 'apex_cam_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Milestone 4 Camera & HUD testing...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9777',
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
        const req = http.get('http://localhost:9777/json', res => {
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

  console.log('Waiting for circuit and vehicle initialization...');
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate('!!window.game?.vehicleController && window.game?.trackLoader?.pieces?.length > 20');
    if (ready) {
      console.log('Ready!');
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n--- Test 1: Straight-Line Driving & Speed-Based Camera Effects ---');
  const restCamera = await evaluate(`(() => {
    const cam = window.game?.sceneManager?.chaseCamera;
    return {
      fov: cam?.camera?.fov,
      baseFov: cam?.config?.baseFov,
      pos: { x: cam?.camera?.position?.x, y: cam?.camera?.position?.y, z: cam?.camera?.position?.z }
    };
  })()`);
  console.log('At rest: Camera FOV:', restCamera?.fov?.toFixed(3), 'rad (~52.7 deg)');

  console.log('Accelerating for 1.8s...');
  await sendKey('KeyW', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1800));

  const speedCamera = await evaluate(`(() => {
    const g = window.game;
    const c = g?.vehicleController;
    const cam = g?.sceneManager?.chaseCamera;
    const t = c?.getTelemetry();
    return {
      speedKmh: t?.speedKmh,
      hudSpeedText: document.getElementById('speed-value')?.textContent,
      gearText: document.getElementById('gear-indicator')?.textContent,
      timerText: document.getElementById('race-timer')?.textContent,
      fov: cam?.camera?.fov,
      distanceFromCar: cam?.camera?.position ? Math.hypot(
        cam.camera.position.x - c.position.x,
        cam.camera.position.z - c.position.z
      ) : null
    };
  })()`);
  console.log('At speed:');
  console.log('  Telemetry Speed:', speedCamera?.speedKmh, 'KM/H | HUD Speed Display:', speedCamera?.hudSpeedText, 'KM/H');
  console.log('  HUD Gear:', speedCamera?.gearText);
  console.log('  Lap Timer:', speedCamera?.timerText);
  console.log('  Camera FOV expanded to:', speedCamera?.fov?.toFixed(3), 'rad (dynamic high-speed effect)');
  console.log('  Camera Distance setback:', speedCamera?.distanceFromCar?.toFixed(2), 'm (pulled back with speed)');

  console.log('\n--- Test 2: Drift Slip Offset & Camera Behavior ---');
  await sendKey('KeyA', 'rawKeyDown');
  await sendKey('Space', 'rawKeyDown');

  let peakDrift = null;
  let driftScreenshotTaken = false;

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 60));
    const sample = await evaluate(`(() => {
      const g = window.game;
      const c = g?.vehicleController;
      const cam = g?.sceneManager?.chaseCamera;
      const t = c?.getTelemetry();
      return {
        isDrifting: t?.isDrifting,
        slipAngleDeg: t?.slipAngleDeg,
        lateralSpeed: t?.lateralSpeed,
        forwardSpeed: t?.forwardSpeed,
        speedKmh: t?.speedKmh,
        vehicleYaw: c?.yawAngle,
        cameraSmoothedYaw: cam?.smoothedYaw,
        cameraSlipOffset: cam?.lastSlipAngle,
        hudDriftVisible: !document.getElementById('drift-badge')?.classList?.contains('hidden'),
        hudSlipText: document.getElementById('slip-readout')?.textContent
      };
    })()`);

    if (sample && (sample.isDrifting || Math.abs(sample.slipAngleDeg) > 5)) {
      if (!peakDrift || Math.abs(sample.slipAngleDeg) > Math.abs(peakDrift.slipAngleDeg)) {
        peakDrift = sample;
      }
      if (sample.isDrifting && !driftScreenshotTaken) {
        const shot = await send('Page.captureScreenshot', { format: 'png' });
        if (shot && shot.data) {
          const shotPath = path.join(process.cwd(), 'milestone4_screenshot.png');
          fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
          console.log(`Screenshot saved at active drift: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);
          driftScreenshotTaken = true;
        }
      }
    }
  }

  console.log('Peak Drift State observed:', peakDrift);

  await sendKey('Space', 'keyUp');
  await sendKey('KeyA', 'keyUp');
  await sendKey('KeyW', 'keyUp');

  if (!driftScreenshotTaken) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
      const shotPath = path.join(process.cwd(), 'milestone4_screenshot.png');
      fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
      console.log(`Fallback screenshot saved: ${shotPath}`);
    }
  }

  console.log('\n--- Test 3: Pause / Resume Functionality ---');
  console.log('Pressing Escape to Pause...');
  await sendKey('Escape', 'rawKeyDown');
  await sendKey('Escape', 'keyUp');
  await new Promise(r => setTimeout(r, 300));

  const pausedState = await evaluate(`(() => {
    const g = window.game;
    const overlay = document.getElementById('pause-overlay');
    return {
      isPaused: g?.isPaused,
      overlayVisible: overlay && !overlay.classList.contains('hidden'),
      frozenTimer: g?.raceTimeSeconds,
      frozenSpeed: g?.vehicleController?.forwardSpeed
    };
  })()`);
  console.log('Paused State:', pausedState);

  // Wait 600ms and verify time remained frozen
  await new Promise(r => setTimeout(r, 600));
  const timeCheck = await evaluate('window.game.raceTimeSeconds');
  console.log('Timer frozen check: before =', pausedState?.frozenTimer?.toFixed(3), 'after =', timeCheck?.toFixed(3));

  console.log('Clicking Resume button...');
  await evaluate('document.getElementById("btn-resume")?.click()');
  await new Promise(r => setTimeout(r, 300));

  const resumedState = await evaluate(`(() => {
    const g = window.game;
    const overlay = document.getElementById('pause-overlay');
    return {
      isPaused: g?.isPaused,
      overlayVisible: overlay && !overlay.classList.contains('hidden')
    };
  })()`);
  console.log('Resumed State:', resumedState);

  console.log('\n--- Verification Summary ---');
  console.log('Total console logs captured:', consoleLogs.length);
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
    speedCamera?.fov > restCamera?.fov &&
    speedCamera?.speedKmh > 60 &&
    speedCamera?.speedKmh === parseInt(speedCamera?.hudSpeedText, 10) &&
    peakDrift?.isDrifting === true &&
    peakDrift?.hudDriftVisible === true &&
    Math.abs(peakDrift?.slipAngleDeg) > 5 &&
    pausedState?.isPaused === true &&
    pausedState?.overlayVisible === true &&
    Math.abs(pausedState?.frozenTimer - timeCheck) < 0.001 &&
    resumedState?.isPaused === false &&
    resumedState?.overlayVisible === false &&
    errors.length === 0;

  if (passed) {
    console.log('\n>>> ALL MILESTONE 4 CAMERA & HUD TESTS PASSED <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyCameraAndHUD().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
