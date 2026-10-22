const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function captureActionScreenshots() {
  const profileDir = path.join(os.tmpdir(), 'apex_track_action_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });
  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9897',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1920,1080',
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9897/json', res => {
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
  if (!page) { edgeProc.kill(); return; }

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
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res?.exceptionDetails) {
      console.error('CDP Exception:', JSON.stringify(res.exceptionDetails));
    }
    return res?.result?.value;
  }

  async function takeScreenshot(fileName) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot?.data) {
      fs.writeFileSync(path.join(artifactDir, fileName), Buffer.from(shot.data, 'base64'));
      console.log(`Saved screenshot: ${fileName}`);
    }
  }

  console.log('Waiting for game readiness...');
  for (let i = 0; i < 60; i++) {
    const ready = await evaluate('!!window.game?.isRunning && !!window.game?.vehicleController');
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('Game ready! Opening event select and launching Time Trial...');
  await evaluate('window.game.openEventSelect()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('document.getElementById("btn-start-event").click()');
  console.log('Waiting for 3-2-1-GO countdown to complete...');
  for (let i = 0; i < 50; i++) {
    const s = await evaluate('window.game?.state');
    if (s === 'Racing') {
      console.log('Countdown finished, now in Racing state!');
      break;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  // Wait additional 1 second so GO banner disappears and physics stabilizes
  await new Promise(r => setTimeout(r, 1000));

  // Helper to place car and synchronize chase camera immediately
  async function placeCar(x, z, yaw, speed = 0, steer = 0) {
    const res = await evaluate(`(() => {
      try {
        const g = window.game;
        if (!g || !g.vehicleController) return 'No game or controller';
        g.vehicleController.position.x = ${x};
        g.vehicleController.position.y = 0.05;
        g.vehicleController.position.z = ${z};
        g.vehicleController.yawAngle = ${yaw};
        g.vehicleController.forwardSpeed = ${speed};
        g.vehicleController.steeringAngle = ${steer};
        g.vehicle.applyTransform(g.vehicleController.position, g.vehicleController.yawAngle);
        g.sceneManager.initChaseCamera(g.vehicleController.position, g.vehicleController.yawAngle);
        return 'Placed car at ' + g.vehicleController.position.x + ', ' + g.vehicleController.position.z;
      } catch (err) {
        return 'Error: ' + err.message + ' stack: ' + err.stack;
      }
    })()`);
    console.log('placeCar result:', res);
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('1. Positioning on Main Straight at speed...');
  await placeCar(-0.5, 66.7, -0.032, 35.0, 0.0);
  await takeScreenshot('track_view_01_main_straight_speed.png');

  console.log('2. Positioning at Turn 1 sweeper apex...');
  await placeCar(24.1, 141.6, 1.073, 28.0, 0.25);
  await takeScreenshot('track_view_02_turn1_sweeper_apex.png');

  console.log('3. Positioning on Grand Back Straight...');
  await placeCar(141.1, -66.3, 3.120, 48.0, 0.0);
  await takeScreenshot('track_view_03_grand_back_straight.png');

  console.log('4. Positioning in Arena Drift Carousel...');
  await placeCar(24.7, -118.0, -1.720, 26.0, -0.35);
  await takeScreenshot('track_view_04_arena_drift_carousel.png');

  console.log('All action screenshots successfully captured!');
  ws.close();
  edgeProc.kill();
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
}

captureActionScreenshots().catch(console.error);
