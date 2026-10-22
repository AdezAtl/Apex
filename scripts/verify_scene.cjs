const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyScene() {
  const profileDir = path.join(os.tmpdir(), 'apex_edge_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for runtime verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9444',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  // Wait for Edge port to become available
  let targets = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9444/json', res => {
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
      if (type === 'error') {
        errors.push(text);
      }
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

  // Reload page so DevTools captures initial load lifecycle from t=0
  console.log('Reloading page to capture full bootstrap lifecycle...');
  await send('Page.reload');

  // Allow assets and engine to load and render several frames
  console.log('Waiting for Babylon.js engine and 3D assets to load...');
  await new Promise(r => setTimeout(r, 5000));

  // Evaluate runtime scene state
  const evalScript = `(() => {
    const g = window.game;
    return {
      hasGame: !!g,
      vehicleLoaded: !!g?.vehicle?.metadata,
      vehicleModel: g?.vehicle?.metadata?.fileName,
      triangleCount: g?.vehicle?.metadata?.totalTriangles,
      wheelNodes: g?.vehicle?.metadata?.wheelNodeNames,
      vehiclePos: g?.vehicle?.getPosition() ? {
        x: g.vehicle.getPosition().x,
        y: g.vehicle.getPosition().y,
        z: g.vehicle.getPosition().z
      } : null,
      trackPiecesCount: g?.trackLoader?.pieces?.length,
      roadSurfaceY: g?.trackLoader?.roadSurfaceY,
      cameraPos: g?.sceneManager?.camera?.position ? {
        x: g.sceneManager.camera.position.x,
        y: g.sceneManager.camera.position.y,
        z: g.sceneManager.camera.position.z
      } : null,
      cameraTarget: g?.sceneManager?.camera?.target ? {
        x: g.sceneManager.camera.target.x,
        y: g.sceneManager.camera.target.y,
        z: g.sceneManager.camera.target.z
      } : null,
      fpsText: document.getElementById('fps-counter')?.textContent,
      canvasSize: {
        width: document.getElementById('renderCanvas')?.clientWidth,
        height: document.getElementById('renderCanvas')?.clientHeight
      }
    };
  })()`;

  const evalResult = await send('Runtime.evaluate', {
    expression: evalScript,
    returnByValue: true
  });

  const state = evalResult?.result?.value;
  console.log('\n========================================');
  console.log('   PROJECT APEX - SCENE VERIFICATION');
  console.log('========================================');
  console.log('Game initialized:', state?.hasGame);
  console.log('Vehicle loaded:', state?.vehicleLoaded, `(${state?.vehicleModel})`);
  console.log('Triangle count:', state?.triangleCount);
  console.log('Wheel nodes detected:', state?.wheelNodes);
  console.log('Vehicle position:', state?.vehiclePos);
  console.log('Track surface Y level:', state?.roadSurfaceY);
  console.log('Total track & scenery meshes:', state?.trackPiecesCount);
  console.log('Camera target:', state?.cameraTarget);
  console.log('Camera position:', state?.cameraPos);
  console.log('Canvas dimensions:', state?.canvasSize);
  console.log('HUD FPS status:', state?.fpsText);
  console.log('Total console logs captured:', consoleLogs.length);
  console.log('Console errors:', errors.length);

  if (consoleLogs.length > 0) {
    console.log('\n--- Console Messages ---');
    consoleLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));
  }

  // Capture screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  if (shot && shot.data) {
    const shotPath = path.join(process.cwd(), 'milestone1_screenshot.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`\nScreenshot saved: ${shotPath} (${fs.statSync(shotPath).size} bytes)`);
  }

  ws.close();
  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}

  if (errors.length > 0) {
    console.error('VERIFICATION FAILED: Console errors detected:', errors);
    process.exit(1);
  } else {
    console.log('\n>>> SCENE VERIFICATION PASSED WITH ZERO CONSOLE ERRORS <<<');
  }
}

verifyScene().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
