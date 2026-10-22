const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function captureNewTrackVisuals() {
  const profileDir = path.join(os.tmpdir(), 'apex_track_vis_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  console.log('Launching Edge for New Track Visual Verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9899',
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
        const req = http.get('http://localhost:9899/json', res => {
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
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async function takeScreenshot(fileName) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
      const buf = Buffer.from(shot.data, 'base64');
      const outPath = path.join(artifactDir, fileName);
      fs.writeFileSync(outPath, buf);
      console.log(`Saved: ${fileName} (${buf.length} bytes)`);
    }
  }

  // Wait for game
  for (let i = 0; i < 60; i++) {
    const ready = await evaluate('!!window.game?.isRunning && !!window.game?.vehicleController');
    if (ready) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('Game ready! Starting Time Trial to inspect new track visuals...');
  await evaluate('window.game.openEventSelect()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('document.getElementById("btn-start-event").click()');

  // Wait for countdown
  for (let i = 0; i < 40; i++) {
    const s = await evaluate('window.game?.state');
    if (s === 'Racing') break;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('Racing state reached! Capturing starting grid & asphalt surface...');
  await takeScreenshot('track_redesign_01_grid_asphalt.png');

  // Drive forward 1.5 seconds down straight
  await evaluate(`(() => {
    const g = window.game;
    for (let i = 0; i < 90; i++) {
      g.vehicleController.update(1/60, {
        forward: true, backward: false, steerLeft: false, steerRight: false,
        handbrake: false, reset: false, toggleCamera: false, pause: false
      });
    }
  })()`);
  await new Promise(r => setTimeout(r, 200));
  console.log('Capturing driving down main straight...');
  await takeScreenshot('track_redesign_02_main_straight_drive.png');

  // Move camera to overhead / panoramic view of the circuit
  console.log('Setting panoramic camera view to inspect circuit layout & curves...');
  await evaluate(`(() => {
    const sm = window.game.sceneManager;
    const pos = new BABYLON.Vector3(40, 240, -20);
    const target = new BABYLON.Vector3(40, 0, -20);
    sm.chaseCamera.setCinematicTarget(pos, target, 0.95);
    sm.chaseCamera.camera.position.copyFrom(pos);
    sm.chaseCamera.camera.setTarget(target);
  })()`);
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('track_redesign_03_overhead_circuit.png');

  // Inspect corner apex with rumble strip kerbs
  console.log('Positioning car & camera at Turn 1 apex to inspect red/white kerbs...');
  await evaluate(`(() => {
    const g = window.game;
    // Turn 1 entry
    g.vehicleController.position.set(24.1, 0.05, 141.6);
    g.vehicleController.yawAngle = 1.073;
    g.vehicle.applyTransform(g.vehicleController.position, g.vehicleController.yawAngle);
    
    const camPos = new BABYLON.Vector3(12, 4.5, 126);
    const camTarget = new BABYLON.Vector3(25, 0.8, 142);
    g.sceneManager.chaseCamera.setCinematicTarget(camPos, camTarget, 0.80);
    g.sceneManager.chaseCamera.camera.position.copyFrom(camPos);
    g.sceneManager.chaseCamera.camera.setTarget(camTarget);
  })()`);
  await new Promise(r => setTimeout(r, 600));
  await takeScreenshot('track_redesign_04_turn1_apex_kerbs.png');

  console.log('All visual verification screenshots captured!');
  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}

captureNewTrackVisuals().catch(console.error);
