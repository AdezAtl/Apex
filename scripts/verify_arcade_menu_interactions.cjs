const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

async function verifyArcadeInteractions() {
  const profileDir = path.join(os.tmpdir(), 'apex_arcade_verify_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const port = 9889;
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
      await new Promise(r => setTimeout(r, 400));
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

    const page = targets?.find(t => t.type === 'page' && t.url.includes('5173'));
    if (!page) throw new Error('Target page not found');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(resolve => {
      if (ws.readyState === 1) return resolve();
      ws.onopen = resolve;
    });

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

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true
      });
      return res.result?.value;
    }

    console.log('[Setup] Waiting for engine initialization...');
    for (let i = 0; i < 80; i++) {
      await new Promise(r => setTimeout(r, 500));
      const isReady = await evaluate("Boolean(window.game && window.game.state !== 'Loading')");
      if (isReady) break;
    }
    await new Promise(r => setTimeout(r, 800));

    console.log('[Test 1] Opening Arcade / Event Select...');
    await evaluate('window.game.openEventSelect()');
    await new Promise(r => setTimeout(r, 600));

    const initialInfo = await evaluate(`(() => ({
      visible: !document.getElementById('event-select-overlay').classList.contains('hidden'),
      circuitId: window.game.eventSelect.selectedCircuitId,
      eventName: document.getElementById('event-name').textContent,
      startText: document.getElementById('btn-start-text').textContent,
      diffClusterVisible: document.getElementById('ai-difficulty-cluster').style.display !== 'none'
    }))()`);

    console.log('  Initial state:', initialInfo);
    if (!initialInfo.visible) throw new Error('Event select not visible');
    if (!initialInfo.circuitId) throw new Error('Circuit ID missing');

    console.log('[Test 2] Switching to Azure Coast Circuit (Circuit 2)...');
    await evaluate(`document.getElementById('track-tab-azure_coast').click()`);
    await new Promise(r => setTimeout(r, 400));

    const azureInfo = await evaluate(`(() => ({
      circuitId: window.game.eventSelect.selectedCircuitId,
      tabActive: document.getElementById('track-tab-azure_coast').classList.contains('active'),
      trackName: document.getElementById('event-track-name').textContent,
      specLength: document.getElementById('spec-length').textContent
    }))()`);

    console.log('  Azure state:', azureInfo);
    if (azureInfo.circuitId !== 'azure_coast') throw new Error('Circuit did not switch to azure_coast');
    if (!azureInfo.tabActive) throw new Error('Azure tab is not active');

    console.log('[Test 3] Switching to Drift Challenge...');
    await evaluate(`document.getElementById('tab-event-2').click()`);
    await new Promise(r => setTimeout(r, 400));

    const driftInfo = await evaluate(`(() => ({
      eventName: document.getElementById('event-name').textContent,
      startText: document.getElementById('btn-start-text').textContent,
      diffClusterHidden: document.getElementById('ai-difficulty-cluster').style.display === 'none'
    }))()`);

    console.log('  Drift state:', driftInfo);
    if (!driftInfo.startText.includes('DRIFT')) throw new Error('Start button did not update to DRIFT');
    if (!driftInfo.diffClusterHidden) throw new Error('Difficulty cluster should be hidden in drift mode');

    // Take screenshot of Azure Coast Drift Challenge
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const driftShotPath = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949\\arcade_menu_azure_drift.png';
    fs.writeFileSync(driftShotPath, Buffer.from(shot.data, 'base64'));
    console.log('  -> Screenshot saved:', driftShotPath);

    console.log('[Test 4] Switching back to Sprint Race on Forest Valley...');
    await evaluate(`document.getElementById('track-tab-forest_valley').click()`);
    await new Promise(r => setTimeout(r, 300));
    await evaluate(`document.getElementById('tab-event-1').click()`);
    await new Promise(r => setTimeout(r, 300));

    const sprintInfo = await evaluate(`(() => ({
      startText: document.getElementById('btn-start-text').textContent,
      diffClusterVisible: document.getElementById('ai-difficulty-cluster').style.display !== 'none'
    }))()`);

    console.log('  Sprint state:', sprintInfo);
    if (!sprintInfo.startText.includes('SPRINT')) throw new Error('Start button did not update to SPRINT');
    if (!sprintInfo.diffClusterVisible) throw new Error('Difficulty cluster should be visible in sprint race');

    console.log('[Test 5] Return to Menu navigation...');
    await evaluate(`document.getElementById('btn-event-back').click()`);
    await new Promise(r => setTimeout(r, 600));

    const menuState = await evaluate(`(() => ({
      state: window.game.state,
      eventSelectHidden: document.getElementById('event-select-overlay').classList.contains('hidden'),
      mainMenuVisible: !document.getElementById('main-menu-overlay').classList.contains('hidden')
    }))()`);

    console.log('  Menu state:', menuState);
    if (menuState.state !== 'MainMenu') throw new Error('Game did not return to MainMenu');
    if (!menuState.eventSelectHidden) throw new Error('Event select should be hidden');
    if (!menuState.mainMenuVisible) throw new Error('Main menu should be visible');

    console.log('\n[SUCCESS] ALL 5 ARCADE INTERACTION TESTS PASSED!');
    ws.close();
  } finally {
    edgeProc.kill();
  }
}

verifyArcadeInteractions().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
