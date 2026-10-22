const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyCarsTurnedAround() {
  console.log('=== VERIFYING PERMANENT CAR ORIENTATION (TURNED AROUND) ===\n');

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';
  const profileDir = path.join(os.tmpdir(), 'apex_verify_turned_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9880',
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
        const req = http.get('http://localhost:9880/json', res => {
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
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
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
    if (msg.id && pending.has(msg.id)) {
      const resolve = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async function capture(filename) {
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(snap.data, 'base64');
    const outPath = path.join(artifactDir, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`Saved screenshot: ${outPath}`);
  }

  // 1. Wait for MainMenu
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 500));
    const state = await evaluate(`window.apexGame ? window.apexGame.state : null`);
    if (state === 'MainMenu') break;
  }

  // Verify Vehicle modelContainer.rotation.y is 0
  const rotY = await evaluate(`window.apexGame.vehicle.modelContainer.rotation.y`);
  console.log(`- Vehicle modelContainer.rotation.y: ${rotY} (expected 0)`);

  // 2. Open Event Select
  await evaluate(`document.getElementById('btn-menu-play').click()`);
  await new Promise(r => setTimeout(r, 500));

  // 3. Start Race
  await evaluate(`document.getElementById('btn-start-event').click()`);
  await new Promise(r => setTimeout(r, 1200)); // Countdown active

  // Capture grid countdown with cars turned around
  await capture('stage8_grid_turned_around.png');

  // Wait for countdown to finish -> Racing
  await new Promise(r => setTimeout(r, 2600));

  // Drive forward with 'KeyW' for 2 seconds
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'KeyW', code: 'KeyW' });
  await new Promise(r => setTimeout(r, 2200));

  // Capture in-motion racing screenshot
  await capture('stage8_racing_turned_around.png');
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'KeyW', code: 'KeyW' });

  // Get telemetry info
  const telemetry = await evaluate(`(() => {
    const vc = window.apexGame.vehicleController;
    return {
      speedKmh: Math.round(vc.forwardSpeed * 3.6),
      yawAngle: vc.yawAngle,
      pos: { x: vc.position.x.toFixed(2), z: vc.position.z.toFixed(2) }
    };
  })()`);
  console.log('Race telemetry:', telemetry);

  edgeProc.kill();
  process.exit(0);
}

verifyCarsTurnedAround().catch(err => {
  console.error(err);
  process.exit(1);
});
