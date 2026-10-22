const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifySolidCarsAndApexElite() {
  console.log('=== VERIFYING SOLID CARS & APEX ELITE HANDLING ===\n');

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';
  const profileDir = path.join(os.tmpdir(), 'apex_solid_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9882',
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
        const req = http.get('http://localhost:9882/json', res => {
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

  // Open Event Selection
  await evaluate(`document.getElementById('btn-menu-play').click()`);
  await new Promise(r => setTimeout(r, 500));

  // Select "APEX ELITE" difficulty (data-diff="hard")
  const eliteBtn = await evaluate(`(() => {
    const btn = document.querySelector('button[data-diff="hard"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  })()`);
  console.log(`- Selected Apex Elite difficulty button: ${eliteBtn}`);
  await new Promise(r => setTimeout(r, 300));

  // Start Race
  await evaluate(`document.getElementById('btn-start-event').click()`);
  await new Promise(r => setTimeout(r, 1200)); // Countdown active

  // Verify AI opponents have hard tuning
  const tuningCheck = await evaluate(`(() => {
    const opp = window.apexGame.aiManager.opponents[0];
    return {
      name: opp.name,
      difficulty: opp.difficulty,
      topSpeedMult: opp.tuning.topSpeedMult,
      accelMult: opp.tuning.accelMult,
      brakeDecel: opp.tuning.brakeDecel,
      steerRate: opp.tuning.steerRate,
      gripFactor: opp.tuning.gripFactor,
      speedScale: opp.speedScale
    };
  })()`);
  console.log('- Apex Elite opponent tuning verification:', tuningCheck);

  // Wait for countdown to finish -> Racing
  await new Promise(r => setTimeout(r, 2600));

  // TEST 1: Solid Body Collision Test
  console.log('\n--- Testing Solid Body Car-on-Car Collision ---');
  // Position player directly in line with and 4 meters behind AI 2 (Slot 2 at X: 1.8), moving faster
  const setupCollision = await evaluate(`(() => {
    const p = window.apexGame.vehicleController;
    const opp = window.apexGame.aiManager.opponents[1]; // APX BILLET at X: 1.8
    
    // Position player 4.0m behind opponent at 80 km/h (22 m/s), opponent at 40 km/h (11 m/s)
    p.position.set(opp.position.x, 0.05, opp.position.z - 4.0);
    p.yawAngle = 0;
    p.forwardSpeed = 22.0; // 79 km/h
    p.lateralSpeed = 0;
    
    opp.yawAngle = 0;
    opp.forwardSpeed = 11.0; // 40 km/h
    opp.lateralSpeed = 0;

    return {
      playerZ: p.position.z.toFixed(2),
      oppZ: opp.position.z.toFixed(2),
      dist: (opp.position.z - p.position.z).toFixed(2),
      playerKmh: Math.round(p.forwardSpeed * 3.6),
      oppKmh: Math.round(opp.forwardSpeed * 3.6)
    };
  })()`);
  console.log('- Pre-impact state:', setupCollision);

  // Run physics steps for 300ms to allow collision contact and momentum transfer
  let minDistanceRecorded = Infinity;
  for (let step = 0; step < 15; step++) {
    await new Promise(r => setTimeout(r, 20));
    const dist = await evaluate(`(() => {
      const p = window.apexGame.vehicleController;
      const opp = window.apexGame.aiManager.opponents[1];
      return opp.position.z - p.position.z;
    })()`);
    if (dist < minDistanceRecorded) minDistanceRecorded = dist;
  }

  const postCollision = await evaluate(`(() => {
    const p = window.apexGame.vehicleController;
    const opp = window.apexGame.aiManager.opponents[1];
    const dist = opp.position.z - p.position.z;
    return {
      playerZ: p.position.z.toFixed(2),
      oppZ: opp.position.z.toFixed(2),
      dist: dist.toFixed(2),
      playerKmh: Math.round(p.forwardSpeed * 3.6),
      oppKmh: Math.round(opp.forwardSpeed * 3.6),
      solidBodyKeptSeparated: dist >= 2.60 // Car length is 2.9m; min bumper distance is >= 2.6m (NO penetration)
    };
  })()`);
  console.log(`- Minimum distance during impact: ${minDistanceRecorded.toFixed(2)}m (expected >= 2.60m)`);
  console.log('- Post-impact state:', postCollision);

  // Capture screenshot of solid body contact
  await capture('stage8_solid_body_collision.png');

  // TEST 2: Active Apex Elite Racing Performance
  console.log('\n--- Testing Apex Elite High-Speed Racing ---');
  // Release player to race and drive for 3 seconds
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'KeyW', code: 'KeyW' });
  await new Promise(r => setTimeout(r, 3500));

  const raceState = await evaluate(`(() => {
    const opps = window.apexGame.aiManager.opponents.map(o => ({
      name: o.name,
      speedKmh: Math.round(o.forwardSpeed * 3.6),
      pos: { x: o.position.x.toFixed(1), z: o.position.z.toFixed(1) },
      steerDeg: (o.steeringAngle * 180 / Math.PI).toFixed(1),
      totalDist: o.totalDistance.toFixed(1)
    }));
    const p = window.apexGame.vehicleController;
    return {
      playerSpeedKmh: Math.round(p.forwardSpeed * 3.6),
      playerPos: { x: p.position.x.toFixed(1), z: p.position.z.toFixed(1) },
      opponents: opps
    };
  })()`);
  console.log('Apex Elite racing telemetry:', JSON.stringify(raceState, null, 2));

  await capture('stage8_apex_elite_racing.png');
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'KeyW', code: 'KeyW' });

  edgeProc.kill();
  process.exit(0);
}

verifySolidCarsAndApexElite().catch(err => {
  console.error(err);
  process.exit(1);
});
