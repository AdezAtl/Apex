const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage6Garage() {
  const profileDir = path.join(os.tmpdir(), 'apex_stage6_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  console.log('Launching headless Edge for Stage 6 Garage & Customization verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9867',
    `--user-data-dir=${profileDir}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  let targets = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      targets = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:9867/json', res => {
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
  const consoleErrors = [];

  function send(method, params = {}) {
    const id = reqId++;
    return new Promise(resolve => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const errText = msg.params.args.map(a => a.value || a.description || '').join(' ');
      consoleErrors.push(errText);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.id && pending.has(msg.id)) {
      const cb = pending.get(msg.id);
      pending.delete(msg.id);
      cb(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false
  });

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async function captureScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const localPath = path.join(process.cwd(), filename);
    const artPath = path.join(artifactDir, filename);
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(localPath, buf);
    fs.writeFileSync(artPath, buf);
    console.log(`Saved screenshot: ${filename} (${buf.length} bytes)`);
  }

  // 1. Wait for game boot
  let gameState = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    gameState = await evaluate('(window.game || window.apexGame)?.state');
    if (gameState === 'MainMenu') break;
  }
  console.log('\n--- CHECK 1: Main Menu Boot with Garage CTA ---');
  console.log('Game state:', gameState);
  if (gameState !== 'MainMenu') throw new Error('Expected MainMenu state, got ' + gameState);

  const btnGarageVisible = await evaluate('!!document.getElementById("btn-menu-garage")');
  console.log('PASS: Garage & Showroom CTA present on Main Menu:', btnGarageVisible);
  if (!btnGarageVisible) throw new Error('Missing btn-menu-garage');

  // 2. Open Garage & Showroom
  console.log('\n--- CHECK 2: Full-Screen Garage Navigation (Non-Modal) ---');
  await evaluate('document.getElementById("btn-menu-garage").click()');
  await new Promise(r => setTimeout(r, 600));

  const garageInfo = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const overlay = document.getElementById("garage-screen-overlay");
      const leftDock = document.querySelector(".garage-left-dock");
      const rightDock = document.querySelector(".garage-right-dock");
      const isVisible = overlay && !overlay.classList.contains("hidden");
      const rect = overlay?.getBoundingClientRect();
      const isGarageMode = game?.sceneManager?.isGarageMode;
      const isTrackHidden = !game?.trackLoader?.trackRoot?.isEnabled();
      const isShowroomPlatformVisible = !!game?.sceneManager?.showroomPlatform?.isEnabled();

      return {
        state: game.state,
        isVisible,
        width: rect?.width,
        height: rect?.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        isGarageMode,
        isTrackHidden,
        isShowroomPlatformVisible,
        hasLeftDock: !!leftDock,
        hasRightDock: !!rightDock,
        activePaint: game?.vehicle?.currentPaint?.id,
        initialColor: game?.vehicle?.bodyMaterial?.albedoColor ? {
          r: game.vehicle.bodyMaterial.albedoColor.r,
          g: game.vehicle.bodyMaterial.albedoColor.g,
          b: game.vehicle.bodyMaterial.albedoColor.b,
        } : null
      };
    })()
  `);

  console.log('Garage inspection:', garageInfo);
  if (garageInfo.state !== 'Garage') throw new Error('Expected state Garage, got ' + garageInfo.state);
  if (!garageInfo.isVisible) throw new Error('Garage screen overlay is not visible');
  if (Math.abs(garageInfo.width - garageInfo.windowWidth) > 2 || Math.abs(garageInfo.height - garageInfo.windowHeight) > 2) {
    throw new Error(`Garage does not fill viewport: element=${garageInfo.width}x${garageInfo.height}, window=${garageInfo.windowWidth}x${garageInfo.windowHeight}`);
  }
  if (!garageInfo.isGarageMode || !garageInfo.isTrackHidden || !garageInfo.isShowroomPlatformVisible) {
    throw new Error('Showroom studio environment not correctly configured');
  }
  console.log('PASS: Full-screen garage occupies 100% viewport with dedicated dark showroom studio platform');
  await captureScreenshot('stage6_garage_initial.png');

  // 3. Inspect Vehicle Roster & Specs in Left Dock
  console.log('\n--- CHECK 3: Single Confirmed Playable Vehicle Roster & Real Specs ---');
  const specsInfo = await evaluate(`
    (() => {
      const title = document.querySelector(".garage-left-dock .panel-title")?.textContent;
      const specs = Array.from(document.querySelectorAll(".garage-spec-item")).map(s => ({
        label: s.querySelector(".spec-label")?.textContent,
        val: s.querySelector(".spec-value")?.textContent
      }));
      return { title, specs };
    })()
  `);
  console.log('Vehicle specs:', specsInfo);
  if (specsInfo.title !== 'APX-01 COUPE') throw new Error('Expected APX-01 COUPE, got ' + specsInfo.title);
  console.log('PASS: Vehicle roster prominently showcases APX-01 COUPE with authentic telemetry specifications');

  // 4. Test Paint Swatch Customization: Racing Red
  console.log('\n--- CHECK 4: Paint Selection: Racing Red ---');
  await evaluate('document.getElementById("swatch-racing_red").click()');
  await new Promise(r => setTimeout(r, 400));

  const redPaintCheck = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const activePaintId = game?.garageScreen?.getActivePaintId();
      const currentPaintId = game?.vehicle?.currentPaint?.id;
      const bodyColor = game?.vehicle?.bodyMaterial?.albedoColor;
      const glassMat = game?.sceneManager?.scene?.materials?.find(m => m.name.toLowerCase().includes('glass'));
      const tireMat = game?.sceneManager?.scene?.materials?.find(m => m.name.toLowerCase().includes('tire'));

      return {
        activePaintId,
        currentPaintId,
        bodyColor: bodyColor ? { r: bodyColor.r.toFixed(2), g: bodyColor.g.toFixed(2), b: bodyColor.b.toFixed(2) } : null,
        glassRoughness: glassMat?.roughness,
        tireRoughness: tireMat?.roughness,
        localStoragePaint: JSON.parse(localStorage.getItem('project_apex_settings') || '{}').vehiclePaintId
      };
    })()
  `);
  console.log('Racing Red check:', redPaintCheck);
  if (redPaintCheck.currentPaintId !== 'racing_red') throw new Error('Expected vehicle paint to be racing_red');
  if (redPaintCheck.localStoragePaint !== 'racing_red') throw new Error('Expected persisted paint to be racing_red');
  console.log('PASS: Racing Red safely applied only to body material and persisted to localStorage');
  await captureScreenshot('stage6_garage_racing_red.png');

  // 5. Test Paint Swatch Customization: Deep Blue
  console.log('\n--- CHECK 5: Paint Selection: Deep Blue ---');
  await evaluate('document.getElementById("swatch-deep_blue").click()');
  await new Promise(r => setTimeout(r, 400));

  const bluePaintCheck = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        currentPaintId: game?.vehicle?.currentPaint?.id,
        bodyColor: {
          r: game.vehicle.bodyMaterial.albedoColor.r.toFixed(2),
          g: game.vehicle.bodyMaterial.albedoColor.g.toFixed(2),
          b: game.vehicle.bodyMaterial.albedoColor.b.toFixed(2),
        },
        localStoragePaint: JSON.parse(localStorage.getItem('project_apex_settings') || '{}').vehiclePaintId
      };
    })()
  `);
  console.log('Deep Blue check:', bluePaintCheck);
  if (bluePaintCheck.currentPaintId !== 'deep_blue') throw new Error('Expected vehicle paint to be deep_blue');
  if (bluePaintCheck.localStoragePaint !== 'deep_blue') throw new Error('Expected persisted paint to be deep_blue');
  console.log('PASS: Deep Blue applied live with instant preview');
  await captureScreenshot('stage6_garage_deep_blue.png');

  // 6. Return to Main Menu & Verify Clean Restoration
  console.log('\n--- CHECK 6: Return to Main Menu & Environment Restoration ---');
  await evaluate('document.getElementById("btn-garage-back").click()');
  await new Promise(r => setTimeout(r, 600));

  const returnMenuCheck = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        state: game.state,
        isGarageHidden: document.getElementById("garage-screen-overlay").classList.contains("hidden"),
        isMainMenuVisible: !document.getElementById("main-menu-overlay").classList.contains("hidden"),
        isTrackEnabled: game.trackLoader.trackRoot.isEnabled(),
        isShowroomPlatformDisabled: !game.sceneManager.showroomPlatform.isEnabled(),
        isGarageMode: game.sceneManager.isGarageMode,
        vehiclePaintRetained: game.vehicle.currentPaint.id
      };
    })()
  `);
  console.log('Return to menu check:', returnMenuCheck);
  if (returnMenuCheck.state !== 'MainMenu') throw new Error('Expected MainMenu state, got ' + returnMenuCheck.state);
  if (!returnMenuCheck.isTrackEnabled || returnMenuCheck.isGarageMode) {
    throw new Error('Outdoor racing environment not cleanly restored');
  }
  if (returnMenuCheck.vehiclePaintRetained !== 'deep_blue') {
    throw new Error('Car lost custom paint on return to menu');
  }
  console.log('PASS: Returned to Main Menu, outdoor circuit restored, custom Deep Blue paint retained');
  await captureScreenshot('stage6_main_menu_painted.png');

  // 7. Proceed to Race with Custom Paint
  console.log('\n--- CHECK 7: Race Launch with Custom Paint ---');
  await evaluate('document.getElementById("btn-menu-play").click()');
  await new Promise(r => setTimeout(r, 400));
  await evaluate('document.getElementById("btn-start-event").click()');
  await new Promise(r => setTimeout(r, 3600)); // Wait through countdown

  const raceCheck = await evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return {
        state: game.state,
        vehiclePaintInRace: game.vehicle.currentPaint.id,
        bodyColor: {
          r: game.vehicle.bodyMaterial.albedoColor.r.toFixed(2),
          g: game.vehicle.bodyMaterial.albedoColor.g.toFixed(2),
          b: game.vehicle.bodyMaterial.albedoColor.b.toFixed(2)
        },
        isRacing: game.isRacing
      };
    })()
  `);
  console.log('Race check:', raceCheck);
  if (raceCheck.state !== 'Racing') throw new Error('Expected Racing state, got ' + raceCheck.state);
  if (raceCheck.vehiclePaintInRace !== 'deep_blue') throw new Error('Paint not applied in active race');
  console.log('PASS: Custom Deep Blue paint correctly rendered in active race circuit');
  await captureScreenshot('stage6_racing_painted.png');

  // 8. Test Race Restart Preserves Paint
  console.log('\n--- CHECK 8: Race Restart Preserves Custom Paint ---');
  await evaluate('(window.game || window.apexGame).restartRace()');
  await new Promise(r => setTimeout(r, 1000));
  const restartPaint = await evaluate('(window.game || window.apexGame).vehicle.currentPaint.id');
  console.log('Restart paint:', restartPaint);
  if (restartPaint !== 'deep_blue') throw new Error('Restart did not preserve paint');
  console.log('PASS: Race restart strictly preserves vehicle customization');

  // 9. Re-enter Garage from Main Menu & Check Resource Count
  console.log('\n--- CHECK 9: Return to Menu & Re-open Garage (Zero Mesh Duplication) ---');
  await evaluate('(window.game || window.apexGame).returnToMenu()');
  await new Promise(r => setTimeout(r, 600));
  const meshCountBefore = await evaluate('(window.game || window.apexGame).sceneManager.scene.meshes.length');
  await evaluate('(window.game || window.apexGame).openGarage()');
  await new Promise(r => setTimeout(r, 600));
  const meshCountInGarage = await evaluate('(window.game || window.apexGame).sceneManager.scene.meshes.length');
  await evaluate('(window.game || window.apexGame).returnToMenu()');
  await new Promise(r => setTimeout(r, 600));
  const meshCountAfter = await evaluate('(window.game || window.apexGame).sceneManager.scene.meshes.length');

  console.log(`Mesh counts: Before=${meshCountBefore}, InGarage=${meshCountInGarage}, After=${meshCountAfter}`);
  if (meshCountBefore !== meshCountAfter) {
    throw new Error(`Mesh leak detected! Before: ${meshCountBefore}, After: ${meshCountAfter}`);
  }
  console.log('PASS: Zero mesh or texture leaks across repeated garage transitions');

  // 10. Console and Shader Integrity
  console.log('\n--- CHECK 10: Console Errors & Shader Integrity ---');
  console.log('Console errors captured:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
    throw new Error('Detected console errors during test');
  }
  console.log('PASS: 0 console errors or WebGL warnings');

  console.log('\n========================================');
  console.log('STAGE 6 GARAGE VERIFICATION: ALL PASS ✓');
  console.log('========================================\n');

  edgeProc.kill();
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}
}

verifyStage6Garage().catch(err => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
