const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function diagnose() {
  const profileDir = path.join(os.tmpdir(), 'apex_diag_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProc = spawn(edgePath, [
    '--remote-debugging-port=9225',
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9225/json', res => {
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

  async function evaluate(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  // Wait for game ready
  for (let i = 0; i < 30; i++) {
    const ready = await evaluate('!!(window.game || window.apexGame)?.isRunning');
    if (ready) break;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('Game is ready. Opening Drift Challenge event...');
  await evaluate('(window.game || window.apexGame).openEventSelect()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('document.getElementById("tab-event-2").click()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('document.getElementById("btn-start-event").click()');

  // Wait for countdown
  await new Promise(r => setTimeout(r, 3500));

  const racing = await evaluate('(window.game || window.apexGame).state === "Racing"');
  console.log('State is Racing:', racing);

  // Now simulate actual player driving: forward for 1.5s, then handbrake + steerLeft for 2.0s
  console.log('Driving forward...');
  await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      // Drive forward for 90 frames (1.5 seconds)
      for (let i = 0; i < 90; i++) {
        game.vehicleController.update(1/60, {
          forward: true, backward: false, steerLeft: false, steerRight: false, handbrake: false, reset: false, toggleCamera: false, pause: false
        });
      }
    })()
  `);

  const speedAfterStraight = await evaluate('(window.game || window.apexGame).vehicleController.getTelemetry()');
  console.log('Telemetry after straight:', speedAfterStraight);

  // Now initiate drift: steerLeft + handbrake
  console.log('Initiating drift with steerLeft + handbrake...');
  const driftLog = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const samples = [];
      for (let i = 0; i < 120; i++) {
        const input = {
          forward: true, backward: false, steerLeft: true, steerRight: false,
          handbrake: i < 45, // handbrake tapped for 0.75s then steered into corner
          reset: false, toggleCamera: false, pause: false
        };
        const dt = 1/60;
        game.vehicleController.update(dt, input);
        const tele = game.vehicleController.getTelemetry();
        game.driftScoringManager.update(dt, tele, game.vehicleController.yawRate);
        const scoreTele = game.driftScoringManager.getTelemetry();
        if (i % 15 === 0) {
          samples.push({
            frame: i,
            speedKmh: tele.speedKmh,
            lateralSpeed: tele.lateralSpeed.toFixed(2),
            slipDeg: tele.slipAngleDeg,
            isDriftingPhysics: tele.isDrifting,
            yawRate: game.vehicleController.yawRate.toFixed(2),
            activePoints: scoreTele.activeDriftPoints,
            isDriftingScore: scoreTele.isDrifting,
            multiplier: scoreTele.comboMultiplier,
            banner: scoreTele.feedbackBannerText
          });
        }
      }
      return samples;
    })()
  `);
  console.log('Drift Samples during actual driving:\n', JSON.stringify(driftLog, null, 2));

  edgeProc.kill();
  process.exit(0);
}

diagnose().catch(err => {
  console.error(err);
  process.exit(1);
});
