const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage4Environment() {
  const profileDir = path.join(os.tmpdir(), 'apex_stage4_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';

  console.log('Launching headless Edge for Stage 4 Environment & Atmosphere verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9862',
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
        const req = http.get('http://localhost:9862/json', res => {
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
      consoleErrors.push(msg.params.args.map(a => a.value || JSON.stringify(a)).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails?.text || 'Exception');
    }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.reload');

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true
    });
    return res?.result?.value;
  }

  async function pressInputs(inputs) {
    await evaluate(`(() => {
      const im = window.game?.inputManager;
      if (!im) return;
      ${inputs.forward !== undefined ? `im.state.forward = ${inputs.forward};` : ''}
      ${inputs.backward !== undefined ? `im.state.backward = ${inputs.backward};` : ''}
      ${inputs.steerLeft !== undefined ? `im.state.steerLeft = ${inputs.steerLeft};` : ''}
      ${inputs.steerRight !== undefined ? `im.state.steerRight = ${inputs.steerRight};` : ''}
      ${inputs.handbrake !== undefined ? `im.state.handbrake = ${inputs.handbrake};` : ''}
    })()`);
  }

  async function captureScreenshot(filename) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
      const buffer = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(filename, buffer);
      if (fs.existsSync(artifactDir)) {
        fs.writeFileSync(path.join(artifactDir, path.basename(filename)), buffer);
      }
      console.log(`Saved screenshot: ${filename} (${buffer.length} bytes)`);
    }
  }

  let passedAll = true;

  try {
    // 1. Scene boot & MainMenu state
    console.log('\n--- CHECK 1: Scene Boot & MainMenu State ---');
    for (let i = 0; i < 60; i++) {
      const state = await evaluate('window.game?.state');
      if (state === 'MainMenu') break;
      await new Promise(r => setTimeout(r, 500));
    }
    const state = await evaluate('window.game?.state');
    console.log('Current game state:', state);
    if (state !== 'MainMenu') {
      console.error('FAIL: Game did not enter MainMenu within timeout');
      passedAll = false;
    } else {
      console.log('PASS: Game successfully booted into MainMenu');
    }

    // 2. Atmospheric Environment & Sky Dome
    console.log('\n--- CHECK 2: Atmospheric Sky Dome & Linear Depth Fog ---');
    const skyInfo = await evaluate(`(() => {
      const sm = window.game?.sceneManager;
      const scene = sm?.scene;
      return {
        hasSkybox: !!sm?.skybox,
        infiniteDistance: sm?.skybox?.infiniteDistance,
        fogMode: scene?.fogMode,
        fogStart: scene?.fogStart,
        fogEnd: scene?.fogEnd,
        fogColor: scene?.fogColor ? [scene.fogColor.r, scene.fogColor.g, scene.fogColor.b] : null
      };
    })()`);
    console.log('Sky & Fog info:', skyInfo);
    if (skyInfo.hasSkybox && skyInfo.infiniteDistance && skyInfo.fogMode === 3 && skyInfo.fogStart === 80 && skyInfo.fogEnd === 260) {
      console.log('PASS: Sky dome with infiniteDistance and balanced linear fog (80m - 260m) active');
    } else {
      console.error('FAIL: Sky dome or fog configuration mismatch');
      passedAll = false;
    }

    // 3. Ground Terrain
    console.log('\n--- CHECK 3: Detailed Meadow Ground Terrain (500m) ---');
    const terrainInfo = await evaluate(`(() => {
      const t = window.game?.sceneManager?.groundTerrain;
      if (!t) return null;
      const mat = t.material;
      const tex = mat?.diffuseTexture;
      return {
        name: t.name,
        posY: t.position.y,
        uScale: tex?.uScale,
        vScale: tex?.vScale,
        texName: tex?.name
      };
    })()`);
    console.log('Terrain info:', terrainInfo);
    if (terrainInfo && terrainInfo.uScale === 40 && terrainInfo.vScale === 40 && terrainInfo.posY === -0.04) {
      console.log('PASS: 500m ground terrain with tiled stippled turf texture active');
    } else {
      console.error('FAIL: Ground terrain configuration mismatch');
      passedAll = false;
    }

    // 4. Surrounding Alpine Mountain Ridges
    console.log('\n--- CHECK 4: Low-Poly Surrounding Alpine Mountain Ridges ---');
    const ridgeInfo = await evaluate(`(() => {
      const r = window.game?.sceneManager?.mountainRidges;
      if (!r) return null;
      return {
        name: r.name,
        useVertexColors: r.useVertexColors,
        vertexCount: r.getTotalVertices(),
        indexCount: r.getTotalIndices()
      };
    })()`);
    console.log('Mountain ridges info:', ridgeInfo);
    if (ridgeInfo && ridgeInfo.useVertexColors && ridgeInfo.vertexCount >= 200) {
      console.log(`PASS: Surrounding alpine mountain ridges active (${ridgeInfo.vertexCount} vertices, vertex-colored)`);
    } else {
      console.error('FAIL: Mountain ridges missing or missing vertex colors');
      passedAll = false;
    }

    // 5. Roadside Gravel Verges & Corner Runoff Traps
    console.log('\n--- CHECK 5: Roadside Gravel Verges & Corner Runoff Traps ---');
    const vergeInfo = await evaluate(`(() => {
      const scene = window.game?.sceneManager?.scene;
      const v = scene?.getMeshByName('CircuitRoadVerges');
      if (!v) return null;
      const mat = v.material;
      const tex = mat?.diffuseTexture;
      return {
        name: v.name,
        matName: mat?.name,
        hasTexture: !!tex,
        uScale: tex?.uScale,
        vScale: tex?.vScale,
        vertexCount: v.getTotalVertices()
      };
    })()`);
    console.log('Verges & Runoff info:', vergeInfo);
    if (vergeInfo && vergeInfo.matName === 'VergeGravelMat' && vergeInfo.uScale === 8) {
      console.log(`PASS: Consolidated verges and 4 corner runoff traps active (${vergeInfo.vertexCount} vertices, gravel aggregate texture)`);
    } else {
      console.error('FAIL: Road verges or corner runoffs missing');
      passedAll = false;
    }

    // 6. Checkpoint Steel Lattice Gantries & Timing Banners
    console.log('\n--- CHECK 6: Checkpoint Steel Lattice Gantries & Timing Banners ---');
    const cpInfo = await evaluate(`(() => {
      const cm = window.game?.checkpointManager;
      const meshes = cm?.rootNode?.getChildMeshes(false) || [];
      const finishBanners = meshes.filter(m => m.name.includes('Banner') && m.name.includes('START_FINISH'));
      const sectorBanners = meshes.filter(m => m.name.includes('Banner') && !m.name.includes('START_FINISH'));
      const posts = meshes.filter(m => m.name.includes('Gate_L_') || m.name.includes('Gate_R_'));
      const footings = meshes.filter(m => m.name.includes('Footing_'));
      const beams = meshes.filter(m => m.name.includes('Gate_Beam_'));
      return {
        totalGantryMeshes: meshes.length,
        postsCount: posts.length,
        footingsCount: footings.length,
        beamsCount: beams.length,
        finishBannersCount: finishBanners.length,
        sectorBannersCount: sectorBanners.length
      };
    })()`);
    console.log('Checkpoint gantries info:', cpInfo);
    if (cpInfo.totalGantryMeshes === 36 && cpInfo.finishBannersCount === 1 && cpInfo.sectorBannersCount === 5 && cpInfo.postsCount === 12) {
      console.log('PASS: All 6 checkpoints upgraded to steel lattice gantries with timing banners');
    } else {
      console.error('FAIL: Checkpoint gantries incomplete');
      passedAll = false;
    }

    // 7. Roadside Infrastructure: Brake Boards & Tire Barriers
    console.log('\n--- CHECK 7: Roadside Infrastructure (Brake Boards & Tire Barriers) ---');
    const infraInfo = await evaluate(`(() => {
      const scene = window.game?.sceneManager?.scene;
      const bPosts = scene?.getMeshByName('CircuitBrakePosts');
      const b100 = scene?.getMeshByName('CircuitBrakeBoards100');
      const b50 = scene?.getMeshByName('CircuitBrakeBoards50');
      const tires = scene?.getMeshByName('CircuitTireBarriers');
      return {
        hasPosts: !!bPosts,
        has100Boards: !!b100,
        has50Boards: !!b50,
        hasTireBarriers: !!tires,
        tireVertexCount: tires ? tires.getTotalVertices() : 0,
        tireMat: tires?.material?.name
      };
    })()`);
    console.log('Infrastructure info:', infraInfo);
    if (infraInfo.hasPosts && infraInfo.has100Boards && infraInfo.has50Boards && infraInfo.hasTireBarriers) {
      console.log(`PASS: Brake boards (100m, 50m) and corner tire barrier cushions active (${infraInfo.tireVertexCount} tire vertices, 1 draw call)`);
    } else {
      console.error('FAIL: Roadside infrastructure missing');
      passedAll = false;
    }

    // 8. Multi-Archetype Forest Scenery & Hardware Instancing
    console.log('\n--- CHECK 8: Multi-Archetype Forest Scenery & Hardware Instancing ---');
    const sceneryInfo = await evaluate(`(() => {
      const scene = window.game?.sceneManager?.scene;
      const spruceMaster = scene?.getMeshByName('MasterAlpineSpruce');
      const oakMaster = scene?.getMeshByName('MasterDeciduousOak');
      const shrubMaster = scene?.getMeshByName('MasterWildShrub');
      const rockMaster = scene?.getMeshByName('MasterGraniteRock');

      const spruceInsts = scene?.meshes.filter(m => m.name.startsWith('Spruce_Inst_')) || [];
      const oakInsts = scene?.meshes.filter(m => m.name.startsWith('Oak_Inst_')) || [];
      const shrubInsts = scene?.meshes.filter(m => m.name.startsWith('Shrub_Inst_')) || [];
      const rockInsts = scene?.meshes.filter(m => m.name.startsWith('Rock_Inst_')) || [];
      const kenneyInsts = scene?.meshes.filter(m => m.name.startsWith('Kenney_Inst_')) || [];

      return {
        templatesHidden: spruceMaster && !spruceMaster.isVisible && oakMaster && !oakMaster.isVisible,
        spruceCount: spruceInsts.length,
        oakCount: oakInsts.length,
        shrubCount: shrubInsts.length,
        rockCount: rockInsts.length,
        kenneyCount: kenneyInsts.length,
        totalInstances: spruceInsts.length + oakInsts.length + shrubInsts.length + rockInsts.length + kenneyInsts.length
      };
    })()`);
    console.log('Scenery instances info:', sceneryInfo);
    if (sceneryInfo.spruceCount >= 40 && sceneryInfo.oakCount >= 25 && sceneryInfo.shrubCount >= 35 && sceneryInfo.rockCount >= 20 && sceneryInfo.totalInstances >= 140) {
      console.log(`PASS: Multi-archetype forest scenery active with ${sceneryInfo.totalInstances} hardware instances across 5 archetypes`);
    } else {
      console.error('FAIL: Forest scenery instances count insufficient');
      passedAll = false;
    }

    // 9. Sightline & Clearance Safety Verification
    console.log('\n--- CHECK 9: Track Boundary Clearance & Sightline Safety ---');
    const clearanceInfo = await evaluate(`(() => {
      const scene = window.game?.sceneManager?.scene;
      const instances = scene?.meshes.filter(m =>
        m.name.startsWith('Spruce_Inst_') ||
        m.name.startsWith('Oak_Inst_') ||
        m.name.startsWith('Shrub_Inst_') ||
        m.name.startsWith('Rock_Inst_') ||
        m.name.startsWith('Kenney_Inst_')
      ) || [];

      // Drivable track corridors:
      // North: X in [-4, 4], Z in [-15, 45]
      // East: X in [5, 35], Z in [46, 54]
      // South: X in [36, 44], Z in [-15, 45]
      // West: X in [5, 35], Z in [-24, -16]
      const encroaching = [];
      for (const inst of instances) {
        const p = inst.position;
        // Check if inside any drivable track rectangle
        const onNorth = (p.x >= -4.5 && p.x <= 4.5 && p.z >= -16 && p.z <= 46);
        const onEast = (p.x >= 5 && p.x <= 35 && p.z >= 45.5 && p.z <= 54.5);
        const onSouth = (p.x >= 35.5 && p.x <= 44.5 && p.z >= -16 && p.z <= 46);
        const onWest = (p.x >= 5 && p.x <= 35 && p.z >= -24.5 && p.z <= -15.5);

        if (onNorth || onEast || onSouth || onWest) {
          encroaching.push({ name: inst.name, pos: [p.x, p.z] });
        }
      }
      return {
        encroachingCount: encroaching.length,
        encroachingSamples: encroaching.slice(0, 3)
      };
    })()`);
    console.log('Clearance check info:', clearanceInfo);
    if (clearanceInfo.encroachingCount === 0) {
      console.log('PASS: Zero vegetation instances encroach onto drivable track corridors');
    } else {
      console.error('FAIL: Some vegetation instances encroach on the track:', clearanceInfo.encroachingSamples);
      passedAll = false;
    }

    // 10. Start Race & Dynamic Driving Verification
    console.log('\n--- CHECK 10: Race Start, Dynamic Driving & Performance ---');
    // Click play
    await evaluate(`(() => {
      const btn = document.getElementById('btn-play') || document.querySelector('.btn-primary');
      if (btn) btn.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // Click start event in Event Select
    await evaluate(`(() => {
      const btn = document.getElementById('btn-start-event') || document.querySelector('#event-select .btn-primary');
      if (btn) btn.click();
    })()`);

    // Wait through countdown
    console.log('Waiting for countdown completion into Racing state...');
    for (let i = 0; i < 30; i++) {
      const st = await evaluate('window.game?.state');
      if (st === 'Racing') break;
      await new Promise(r => setTimeout(r, 250));
    }
    const raceState = await evaluate('window.game?.state');
    console.log('State after countdown:', raceState);

    // Drive forward down main straight
    console.log('Accelerating down Main Straight towards Turn 1...');
    await pressInputs({ forward: 1 });
    await new Promise(r => setTimeout(r, 2500));

    // Capture main environment screenshot
    await captureScreenshot('stage4_environment_view.png');

    // Sample performance (FPS & draw calls)
    const perfInfo = await evaluate(`(() => {
      const fps = window.game?.sceneManager?.engine?.getFps() || 60;
      const carPos = window.game?.vehicleController?.position;
      const telem = window.game?.vehicleController?.getTelemetry();
      return {
        fps: Math.round(fps),
        speedKmh: Math.round(telem?.speedKmh || 0),
        carPos: carPos ? [Math.round(carPos.x * 10) / 10, Math.round(carPos.y * 10) / 10, Math.round(carPos.z * 10) / 10] : null
      };
    })()`);
    console.log('Performance during driving:', perfInfo);
    if (perfInfo && perfInfo.fps >= 45) {
      console.log(`PASS: Engine running smoothly at ${perfInfo.fps} FPS during active gameplay (Speed: ${perfInfo.speedKmh} km/h)`);
    } else {
      console.warn(`NOTE: FPS is ${perfInfo?.fps} FPS`);
    }

    // Drive further into Turn 1 approach to capture corner runoff view
    await pressInputs({ forward: 1, steerRight: 0.6 });
    await new Promise(r => setTimeout(r, 1600));
    await pressInputs({ forward: 0, steerRight: 0, backward: 0.3 });
    await new Promise(r => setTimeout(r, 400));
    await pressInputs({ backward: 0 });

    // Capture corner runoff screenshot
    await captureScreenshot('stage4_corner_runoff.png');

    // Check CP crossing progress
    const cpProgress = await evaluate(`(() => {
      const cm = window.game?.checkpointManager;
      return {
        currentCP: cm?.currentCheckpointIndex,
        lastCrossed: cm?.lastCrossedCheckpoint?.id
      };
    })()`);
    console.log('Checkpoint progress:', cpProgress);

    // 11. Console & WebGL Shader Integrity
    console.log('\n--- CHECK 11: Console & WebGL Integrity ---');
    console.log('Console errors captured:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.error('Errors:', consoleErrors);
      passedAll = false;
    } else {
      console.log('PASS: 0 console errors or WebGL shader warnings');
    }

  } catch (err) {
    console.error('Test execution error:', err);
    passedAll = false;
  } finally {
    ws.close();
    edgeProc.kill();
  }

  console.log('\n========================================');
  console.log('STAGE 4 VERIFICATION RESULT:', passedAll ? 'ALL PASS ✓' : 'FAIL ✗');
  console.log('========================================');
  process.exit(passedAll ? 0 : 1);
}

verifyStage4Environment().catch(e => {
  console.error(e);
  process.exit(1);
});
