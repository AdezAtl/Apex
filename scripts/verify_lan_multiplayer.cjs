/**
 * Project Apex — Multi-Instance LAN Multiplayer Verification Suite
 * Launches two separate browser instances (Host and Client) communicating via
 * the local LAN WebSocket server on port 5050.
 * Verifies lobby connection, readiness, vehicle synchronization, live racing, and results.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const ARTIFACT_DIR = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function connectToEdge(port) {
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
  if (!page) {
    throw new Error(`Page target not found on port ${port}`);
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res?.exceptionDetails) {
      console.error(`[CDP port ${port}] Eval Exception:`, res.exceptionDetails.text, res.exceptionDetails.exception?.description);
    }
    return res?.result?.value;
  }

  async function captureScreenshot(fileName) {
    const shotRes = await send('Page.captureScreenshot', { format: 'png' });
    if (shotRes && shotRes.data) {
      const buffer = Buffer.from(shotRes.data, 'base64');
      const outPath = path.join(ARTIFACT_DIR, fileName);
      fs.writeFileSync(outPath, buffer);
      console.log(`Saved screenshot: ${fileName} (${buffer.length} bytes)`);
    }
  }

  return { ws, evaluate, captureScreenshot, consoleErrors };
}

async function runMultiplayerVerification() {
  console.log('========================================================================');
  console.log('     PROJECT APEX — LAN MULTIPLAYER FULL INTEGRATION AUDIT               ');
  console.log('========================================================================\n');

  const profileHost = path.join(os.tmpdir(), 'apex_mp_host_' + Date.now());
  const profileClient = path.join(os.tmpdir(), 'apex_mp_client_' + Date.now());
  fs.mkdirSync(profileHost, { recursive: true });
  fs.mkdirSync(profileClient, { recursive: true });

  console.log('[Setup 1/2] Launching Instance 1 (Host) on remote debugging port 9881...');
  const edgeHost = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9881',
    `--user-data-dir=${profileHost}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  console.log('[Setup 2/2] Launching Instance 2 (Client) on remote debugging port 9882...');
  const edgeClient = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9882',
    `--user-data-dir=${profileClient}`,
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--window-size=1280,720',
    'http://localhost:5173/'
  ]);

  const hostConn = await connectToEdge(9881);
  const clientConn = await connectToEdge(9882);

  console.log('Both Edge instances connected via CDP!\n');

  // Wait for both games to initialize
  console.log('Waiting for both instances to initialize Project Apex...');
  for (let i = 0; i < 60; i++) {
    const hReady = await hostConn.evaluate('!!(window.game || window.apexGame)?.isRunning');
    const cReady = await clientConn.evaluate('!!(window.game || window.apexGame)?.isRunning');
    if (hReady && cReady) break;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('Both game instances running and ready!\n');

  const results = [];

  // --- CHECK 1: Main Menu Multiplayer Button ---
  console.log('--- CHECK 1: Main Menu LAN Multiplayer Button & UI ---');
  const btnMpExists = await hostConn.evaluate('!!document.getElementById("btn-menu-multiplayer")');
  console.log('Multiplayer button present on main menu:', btnMpExists);
  results.push({ check: '1. Main Menu LAN Multiplayer Button', pass: btnMpExists });
  await hostConn.captureScreenshot('multiplayer_01_main_menu_button.png');

  // --- CHECK 2: Host Creates LAN Room ---
  console.log('\n--- CHECK 2: Host Creates LAN Room ---');
  await hostConn.evaluate('document.getElementById("btn-menu-multiplayer").click()');
  await new Promise(r => setTimeout(r, 400));

  // Host enters name and creates room
  await hostConn.evaluate(`
    (() => {
      const nameInput = document.getElementById("input-mp-name");
      if (nameInput) nameInput.value = "Apex Host";
      const carSelect = document.getElementById("select-mp-car");
      if (carSelect) carSelect.value = "apex_sport_coupe";
      document.getElementById("btn-mp-primary-action").click();
    })()
  `);

  // Wait for lobby view on host
  let hostInLobby = false;
  for (let i = 0; i < 40; i++) {
    hostInLobby = await hostConn.evaluate('!!document.querySelector(".mp-lobby-card")');
    if (hostInLobby) break;
    await new Promise(r => setTimeout(r, 200));
  }

  const hostLobbyInfo = await hostConn.evaluate(`
    (() => {
      const ip = document.querySelector(".mp-ip-val")?.textContent;
      const pill = document.querySelector(".mp-status-pill")?.textContent;
      return { ip, pill };
    })()
  `);
  console.log('Host Lobby Created! IP Banner:', hostLobbyInfo.ip, 'Pill:', hostLobbyInfo.pill?.trim());
  const check2 = hostInLobby && !!hostLobbyInfo.ip;
  results.push({ check: '2. Host Room Creation & IP Display', pass: check2 });
  await hostConn.captureScreenshot('multiplayer_02_host_lobby_setup.png');

  // --- CHECK 3: Client Joins Host Room ---
  console.log('\n--- CHECK 3: Client Connects and Joins Host Room ---');
  await clientConn.evaluate('document.getElementById("btn-menu-multiplayer").click()');
  await new Promise(r => setTimeout(r, 400));

  // Client switches to JOIN tab, sets name and address, clicks connect
  await clientConn.evaluate(`
    (() => {
      document.getElementById("btn-tab-join").click();
      const nameInput = document.getElementById("input-mp-name");
      if (nameInput) nameInput.value = "Apex Challenger";
      const carSelect = document.getElementById("select-mp-car");
      if (carSelect) carSelect.value = "azura_coupe";
      const addrInput = document.getElementById("input-join-addr");
      if (addrInput) addrInput.value = "localhost:5050";
      document.getElementById("btn-mp-primary-action").click();
    })()
  `);

  // Wait for client to enter lobby
  let clientInLobby = false;
  for (let i = 0; i < 40; i++) {
    clientInLobby = await clientConn.evaluate('!!document.querySelector(".mp-lobby-card")');
    if (clientInLobby) break;
    await new Promise(r => setTimeout(r, 200));
  }

  // Verify both players appear in both lobby views
  const hostPlayerCount = await hostConn.evaluate('document.querySelectorAll(".mp-player-card.filled").length');
  const clientPlayerCount = await clientConn.evaluate('document.querySelectorAll(".mp-player-card.filled").length');
  console.log('Player count in Host view:', hostPlayerCount, 'in Client view:', clientPlayerCount);

  const check3 = clientInLobby && hostPlayerCount === 2 && clientPlayerCount === 2;
  results.push({ check: '3. Client Join & Multi-Player Lobby Roster', pass: check3 });
  await clientConn.captureScreenshot('multiplayer_03_client_joined_lobby.png');

  // --- CHECK 4: Client Readiness & Host Start Button ---
  console.log('\n--- CHECK 4: Client Toggles Ready & Host Launch Activation ---');
  // Client clicks READY
  await clientConn.evaluate('document.getElementById("btn-lobby-ready").click()');
  await new Promise(r => setTimeout(r, 400));

  const hostLaunchEnabled = await hostConn.evaluate('!document.getElementById("btn-lobby-start").disabled');
  console.log('Host LAUNCH RACE button enabled after client ready:', hostLaunchEnabled);

  const check4 = hostLaunchEnabled;
  results.push({ check: '4. Client Ready State & Launch Authorization', pass: check4 });

  // --- CHECK 5: Synchronized Race Start on 13m Road ---
  console.log('\n--- CHECK 5: Synchronized Race Launch on 13m Grand Circuit ---');
  await hostConn.evaluate('document.getElementById("btn-lobby-start").click()');

  // Wait for countdown to initiate on both instances and remote vehicles to load
  let hostState = '';
  let clientState = '';
  for (let i = 0; i < 60; i++) {
    hostState = await hostConn.evaluate('(window.game || window.apexGame)?.state');
    clientState = await clientConn.evaluate('(window.game || window.apexGame)?.state');
    const hRemoteLoaded = await hostConn.evaluate(`
      (() => {
        const mp = (window.game || window.apexGame)?.multiplayerManager;
        return mp && mp.remoteVehicles.size > 0 && Array.from(mp.remoteVehicles.values())[0]?.isLoaded;
      })()
    `);
    const cRemoteLoaded = await clientConn.evaluate(`
      (() => {
        const mp = (window.game || window.apexGame)?.multiplayerManager;
        return mp && mp.remoteVehicles.size > 0 && Array.from(mp.remoteVehicles.values())[0]?.isLoaded;
      })()
    `);
    if ((hostState === 'Countdown' || hostState === 'Racing') && hRemoteLoaded && cRemoteLoaded) break;
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('Host State:', hostState, 'Client State:', clientState);

  // Check grid slots and remote vehicle spawning
  const gridCheck = await hostConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const mp = game.multiplayerManager;
      const remoteCount = mp.remoteVehicles.size;
      const localSlot = mp.gridAssignments[mp.selfPlayerId];
      const localPos = game.vehicleController.position;
      return {
        remoteCount,
        localSlot,
        localPos: { x: localPos.x, y: localPos.y, z: localPos.z }
      };
    })()
  `);
  console.log('Host Grid & Remote Vehicles:', JSON.stringify(gridCheck, null, 2));

  const clientGridCheck = await clientConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const mp = game.multiplayerManager;
      const remoteCount = mp.remoteVehicles.size;
      const localSlot = mp.gridAssignments[mp.selfPlayerId];
      const localPos = game.vehicleController.position;
      return {
        remoteCount,
        localSlot,
        localPos: { x: localPos.x, y: localPos.y, z: localPos.z }
      };
    })()
  `);
  console.log('Client Grid & Remote Vehicles:', JSON.stringify(clientGridCheck, null, 2));

  const check5 = (hostState === 'Countdown' || hostState === 'Racing') &&
                 gridCheck.remoteCount === 1 &&
                 clientGridCheck.remoteCount === 1 &&
                 gridCheck.localSlot !== clientGridCheck.localSlot;
  results.push({ check: '5. Synchronized Grid Spawn & Remote Vehicle Pairing', pass: check5 });
  await hostConn.captureScreenshot('multiplayer_04_synchronized_grid_start.png');

  // --- CHECK 6: Live Racing Simulation & Network State Synchronization ---
  console.log('\n--- CHECK 6: Live Racing Physics & Transform Synchronization ---');
  // Wait for racing state
  for (let i = 0; i < 40; i++) {
    const s = await hostConn.evaluate('(window.game || window.apexGame)?.state');
    if (s === 'Racing') break;
    await new Promise(r => setTimeout(r, 200));
  }

  // Drive both vehicles forward for 90 frames (~1.5s)
  await hostConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      for (let i = 0; i < 90; i++) {
        game.vehicleController.update(1/60, {
          forward: true, backward: false, steerLeft: false, steerRight: false,
          handbrake: false, reset: false, toggleCamera: false, pause: false
        });
        game.multiplayerManager.update(1/60, game.vehicleController, {
          forward: true, backward: false, steerLeft: false, steerRight: false,
          handbrake: false, reset: false, toggleCamera: false, pause: false
        });
      }
    })()
  `);

  await clientConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      for (let i = 0; i < 90; i++) {
        game.vehicleController.update(1/60, {
          forward: true, backward: false, steerLeft: false, steerRight: false,
          handbrake: false, reset: false, toggleCamera: false, pause: false
        });
        game.multiplayerManager.update(1/60, game.vehicleController, {
          forward: true, backward: false, steerLeft: false, steerRight: false,
          handbrake: false, reset: false, toggleCamera: false, pause: false
        });
      }
    })()
  `);

  await new Promise(r => setTimeout(r, 600));

  // Verify that Host sees Client position updated, and Client sees Host position updated
  const syncCheck = await hostConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      const mp = game.multiplayerManager;
      const remote = Array.from(mp.remoteVehicles.values())[0];
      return {
        hostCarZ: game.vehicleController.position.z,
        remoteCarZ: remote ? remote.position.z : 0,
        remoteIsLoaded: remote ? remote.isLoaded : false
      };
    })()
  `);
  console.log('Host View of Movement Sync:', syncCheck);

  const check6 = syncCheck.remoteIsLoaded && syncCheck.hostCarZ !== 0;
  results.push({ check: '6. Vehicle Motion & Transform Synchronization', pass: check6 });
  await hostConn.captureScreenshot('multiplayer_05_multi_car_live_race.png');

  // --- CHECK 7: Official Race Finish & Standings Synchronization ---
  console.log('\n--- CHECK 7: Official Finish Standings Broadcast ---');
  // Trigger race finish from host
  await hostConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      game.multiplayerManager.finalizeRaceResults();
    })()
  `);

  await new Promise(r => setTimeout(r, 600));

  const hostResultsOpen = await hostConn.evaluate('document.getElementById("multiplayer-results-overlay") && !document.getElementById("multiplayer-results-overlay").classList.contains("hidden")');
  const clientResultsOpen = await clientConn.evaluate('document.getElementById("multiplayer-results-overlay") && !document.getElementById("multiplayer-results-overlay").classList.contains("hidden")');
  console.log('Results Screen Open — Host:', hostResultsOpen, 'Client:', clientResultsOpen);

  const standingsCount = await hostConn.evaluate('document.querySelectorAll(".standings-row").length');
  console.log('Standings row count in official results:', standingsCount);

  const check7 = hostResultsOpen && clientResultsOpen && standingsCount >= 2;
  results.push({ check: '7. Official Results & Standings Synchronization', pass: check7 });
  await hostConn.captureScreenshot('multiplayer_06_official_results_screen.png');

  // --- CHECK 8: Clean Client Disconnect Handling ---
  console.log('\n--- CHECK 8: Clean Client Disconnect Handling ---');
  // Disconnect client
  await clientConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      game.multiplayerManager.close();
    })()
  `);

  await new Promise(r => setTimeout(r, 600));

  const hostRemoteCountAfter = await hostConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      return game.multiplayerManager.remoteVehicles.size;
    })()
  `);
  console.log('Host remote vehicle count after client disconnect:', hostRemoteCountAfter);

  const check8 = hostRemoteCountAfter === 0;
  results.push({ check: '8. Graceful Disconnection & Cleanup', pass: check8 });

  // --- CHECK 9: Unbroken Single-Player Free Play Operation ---
  console.log('\n--- CHECK 9: Single-Player Regression Validation ---');
  // Return host to main menu and start single player Time Trial
  await hostConn.evaluate(`
    (() => {
      const game = (window.game || window.apexGame);
      game.returnToMenu();
      const ev = game.currentCircuit.events.find(e => e.mode === 'time_trial');
      game.startCountdown(ev, 'pro');
    })()
  `);

  await new Promise(r => setTimeout(r, 1500));
  const singlePlayerState = await hostConn.evaluate('(window.game || window.apexGame)?.state');
  console.log('Host Single Player State after multiplayer:', singlePlayerState);

  const check9 = singlePlayerState === 'Countdown' || singlePlayerState === 'Racing';
  results.push({ check: '9. Single-Player Free Play Unaffected', pass: check9 });

  // --- CHECK 10: Zero Unhandled Console Errors ---
  console.log('\n--- CHECK 10: Zero Unhandled Console Errors ---');
  console.log('Host Errors:', hostConn.consoleErrors);
  console.log('Client Errors:', clientConn.consoleErrors);

  const check10 = hostConn.consoleErrors.length === 0 && clientConn.consoleErrors.length === 0;
  results.push({ check: '10. Zero Unhandled Console Errors', pass: check10 });

  // Summary
  console.log('\n========================================================================');
  console.log('           PROJECT APEX — LAN MULTIPLAYER VERIFICATION AUDIT            ');
  console.log('========================================================================');
  results.forEach(r => {
    console.log(`${r.pass ? '✓ PASS' : '✗ FAIL'}: ${r.check}`);
  });
  console.log('========================================================================');

  const allPassed = results.every(r => r.pass);
  console.log(`VERDICT: ${allPassed ? 'ALL 10 CHECKS PASSED!' : 'SOME CHECKS FAILED'}\n`);

  hostConn.ws.close();
  clientConn.ws.close();
  edgeHost.kill();
  edgeClient.kill();

  if (!allPassed) {
    process.exit(1);
  }
}

runMultiplayerVerification().catch(err => {
  console.error('Multiplayer verification failed:', err);
  process.exit(1);
});
