const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function captureArcadeMenu() {
  const profileDir = path.join(os.tmpdir(), 'apex_arcade_diag_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const port = 9887;
  const edgeBin = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProc = spawn(edgeBin, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
      try {
        targets = await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${port}/json`, res => {
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

    const page = targets?.find(t => t.type === 'page' && t.url.includes('localhost:5173'));
    if (!page) throw new Error('Target page not found');

    console.log('[Setup] Connecting WebSocket to:', page.webSocketDebuggerUrl);
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => {
      if (ws.readyState === 1) return resolve();
      ws.onopen = resolve;
    });
    console.log('[Setup] WebSocket connected!');

    let msgId = 1;
    const pending = new Map();
    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, (res) => {
          if (res.error) reject(new Error(res.error.message));
          else resolve(res.result);
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      if (res.id && pending.has(res.id)) {
        const cb = pending.get(res.id);
        pending.delete(res.id);
        cb(res);
      }
    };

    await send('Runtime.enable');
    await send('Page.enable');
    console.log('[Setup] Waiting for Project Apex Main Menu...');

    // Wait for game to initialize out of Loading
    for (let i = 0; i < 80; i++) {
      await new Promise(r => setTimeout(r, 500));
      let isReady = false;
      try {
        const res = await send('Runtime.evaluate', {
          expression: "Boolean(window.game && window.game.state !== 'Loading')",
          returnByValue: true
        });
        isReady = res.result?.value;
      } catch (e) {}
      if (i % 6 === 0) {
        console.log(`[Wait ${i*500}ms] isReady=${isReady}`);
      }
      if (isReady) {
        console.log(`[Setup] Game engine initialized in ${(i+1)*500}ms!`);
        break;
      }
    }
    await new Promise(r => setTimeout(r, 1000));

    console.log('[Action] Opening Event Select...');
    // Open Event Select
    await send('Runtime.evaluate', {
      expression: 'window.game.openEventSelect()',
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1200));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949\\arcade_menu_redesign.png';
    fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
    console.log('[SUCCESS] Screenshot saved to:', outPath);

    ws.close();
  } finally {
    edgeProc.kill();
  }
}

captureArcadeMenu().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
