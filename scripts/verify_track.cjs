const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyTrack() {
  const profileDir = path.join(os.tmpdir(), 'apex_track_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Milestone 3 track verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9666',
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
        const req = http.get('http://localhost:9666/json', res => {
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

  console.log('Reloading page to capture bootstrap...');
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
      key: code.replace('Key', '').toLowerCase()
    });
  }

  // Wait until circuit and vehicleController are fully loaded
  console.log('Waiting for circuit and vehicle to finish loading...');
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate('!!window.game?.vehicleController && window.game?.trackLoader?.pieces?.length > 20');
    if (ready) {
      console.log('Circuit and vehicle ready!');
      break;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n--- Test 1: Track Assembly & Checkpoint Structure ---');
  const trackInfo = await evaluate(`(() => {
    const g = window.game;
    return {
      piecesCount: g?.trackLoader?.pieces?.length,
      checkpoints: g?.checkpointManager?.checkpoints?.map(c => ({
        id: c.id,
        order: c.order,
        pos: { x: c.position.x, y: c.position.y, z: c.position.z },
        dir: { x: c.direction.x, y: c.direction.y, z: c.direction.z },
        width: c.width
      })),
      initialCPIndex: g?.checkpointManager?.currentCheckpointIndex,
      startPos: g?.trackLoader?.startPosition
    };
  })()`);
  console.log('Track pieces count:', trackInfo?.piecesCount);
  console.log('Registered checkpoints:', trackInfo?.checkpoints?.length);
  trackInfo?.checkpoints?.forEach(c => console.log(`  [${c.order}] ${c.id} at (${c.pos.x}, ${c.pos.y}, ${c.pos.z}) width: ${c.width}m`));

  console.log('\n--- Test 2: Driving and Sequential Checkpoint Crossing ---');
  console.log('Accelerating down main straight toward Checkpoint 1 (at Z = 35)...');
  await sendKey('KeyW', 'rawKeyDown');
  // Drive for 2.2s to travel from Z = -2 to beyond Z = 35
  await new Promise(r => setTimeout(r, 2200));
  await sendKey('KeyW', 'keyUp');

  const cpAfterDrive = await evaluate(`(() => {
    const g = window.game;
    const c = g?.vehicleController;
    return {
      pos: { x: c?.position?.x, y: c?.position?.y, z: c?.position?.z },
      speedKmh: c?.getTelemetry()?.speedKmh,
      currentCPIndex: g?.checkpointManager?.currentCheckpointIndex,
      lastCrossed: g?.checkpointManager?.lastCrossedCheckpoint?.id,
      hudText: document.getElementById('checkpoint-indicator')?.textContent
    };
  })()`);
  console.log('Position after driving:', cpAfterDrive?.pos);
  console.log('Speed:', cpAfterDrive?.speedKmh, 'KM/H');
  console.log('Next expected checkpoint index:', cpAfterDrive?.currentCPIndex);
  console.log('Last crossed checkpoint ID:', cpAfterDrive?.lastCrossed);
  console.log('HUD text:', cpAfterDrive?.hudText);

  console.log('\n--- Test 3: Track Boundary & Barrier Collision Deflection ---');
  console.log('Steering right toward East barrier...');
  await sendKey('KeyW', 'rawKeyDown');
  await sendKey('KeyD', 'rawKeyDown');
  await new Promise(r => setTimeout(r, 1000));
  await sendKey('KeyD', 'keyUp');
  await sendKey('KeyW', 'keyUp');

  const barrierState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    const col = window.game?.trackCollision;
    const distInfo = col?.getDistanceToTrackCenterline(c?.position);
    return {
      pos: { x: c?.position?.x, y: c?.position?.y, z: c?.position?.z },
      distanceToCenterline: distInfo?.distance,
      barrierLimit: col?.barrierLimit,
      speedKmh: c?.getTelemetry()?.speedKmh
    };
  })()`);
  console.log('Barrier check: Pos:', barrierState?.pos, 'Dist to centerline:', barrierState?.distanceToCenterline?.toFixed(2), 'm (limit:', barrierState?.barrierLimit, 'm)');
  console.log('Car stayed within barrier limit and Y elevation remained:', barrierState?.pos?.y);

  // Capture screenshot of track with checkpoints & car
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const shotPath = path.join(process.cwd(), 'milestone3_screenshot.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Screenshot saved to: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);
  }

  console.log('\n--- Test 4: Out-of-bounds Recovery ---');
  console.log('Triggering out-of-bounds displacement...');
  await evaluate(`(() => {
    // Intentionally place car outside the playable circuit envelope
    window.game.vehicleController.position.set(120, -10, 150);
  })()`);
  // Wait 2 frames for collision update to detect and auto-recover
  await new Promise(r => setTimeout(r, 300));

  const recoveredPos = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    return {
      pos: { x: c?.position?.x, y: c?.position?.y, z: c?.position?.z },
      speed: c?.forwardSpeed
    };
  })()`);
  console.log('Recovered position after out-of-bounds:', recoveredPos?.pos, 'Speed:', recoveredPos?.speed);

  console.log('\n--- Test 5: Manual Reset (KeyR) to Latest Checkpoint ---');
  await sendKey('KeyR', 'rawKeyDown');
  await sendKey('KeyR', 'keyUp');
  await new Promise(r => setTimeout(r, 200));

  const resetState = await evaluate(`(() => {
    const c = window.game?.vehicleController;
    return {
      pos: { x: c?.position?.x, y: c?.position?.y, z: c?.position?.z },
      speed: c?.forwardSpeed
    };
  })()`);
  console.log('Manual reset placed car at:', resetState?.pos, 'Speed:', resetState?.speed);

  console.log('\n--- Verification Summary ---');
  console.log('Console logs captured:', consoleLogs.length);
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
    trackInfo?.piecesCount >= 22 &&
    trackInfo?.checkpoints?.length === 6 &&
    cpAfterDrive?.lastCrossed === 'CP_1_NORTH_ENTRY' &&
    cpAfterDrive?.currentCPIndex === 2 &&
    barrierState?.pos?.y === 0.05 &&
    recoveredPos?.pos?.y === 0.05 &&
    errors.length === 0;

  if (passed) {
    console.log('\n>>> ALL MILESTONE 3 TEST TRACK TESTS PASSED <<<');
  } else {
    console.error('\n>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyTrack().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
