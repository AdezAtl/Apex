const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function verifyStage3Feedback() {
  const profileDir = path.join(os.tmpdir(), 'apex_stage3_test_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('Launching headless Edge for Stage 3 Driving Feedback verification...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9857',
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
        const req = http.get('http://localhost:9857/json', res => {
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

  // 1. Scene load & boot
  console.log('\n--- CHECK 1: Scene boot & MainMenu state ---');
  for (let i = 0; i < 35; i++) {
    const state = await evaluate('window.game?.state');
    if (state === 'MainMenu') break;
    await new Promise(r => setTimeout(r, 400));
  }
  const initialState = await evaluate('window.game?.state');
  console.log('Game state at boot:', initialState);

  // Check TireFeedbackManager components
  console.log('\n--- CHECK 2: TireFeedbackManager Initialization ---');
  const tfmInit = await evaluate(`(() => {
    const tfm = window.game?.tireFeedbackManager;
    return {
      exists: !!tfm,
      hasLeftSmoke: !!tfm?.leftSmoke,
      hasRightSmoke: !!tfm?.rightSmoke,
      hasLeftSkidMesh: !!tfm?.leftSkidMesh,
      hasRightSkidMesh: !!tfm?.rightSkidMesh,
      roadSurfaceY: tfm?.roadSurfaceY
    };
  })()`);
  console.log('TireFeedbackManager check:', tfmInit);

  // 2. Start Race
  console.log('\n--- CHECK 3: Event Select & Countdown to Racing ---');
  await evaluate('window.game.openEventSelect()');
  await new Promise(r => setTimeout(r, 500));
  await evaluate('window.game.startCountdown()');
  console.log('Countdown started, waiting for GO!...');

  for (let i = 0; i < 30; i++) {
    const state = await evaluate('window.game?.state');
    if (state === 'Racing') break;
    await new Promise(r => setTimeout(r, 300));
  }
  const racingState = await evaluate('window.game?.state');
  console.log('State after countdown:', racingState);

  // 3. Straight acceleration test
  console.log('\n--- CHECK 4: Straight Acceleration (Squat Body Pitch & Grip) ---');
  await pressInputs({ forward: true, backward: false, steerLeft: false, steerRight: false, handbrake: false });

  let maxAccelPitch = 0;
  let straightSmokeEmit = 0;
  let straightSkidPoints = 0;

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 80));
    const data = await evaluate(`(() => {
      const v = window.game?.vehicle;
      const c = window.game?.vehicleController;
      const tfm = window.game?.tireFeedbackManager;
      return {
        speed: c?.forwardSpeed || 0,
        pitch: v?.currentPitch || 0,
        roll: v?.currentRoll || 0,
        smokeLeft: tfm?.leftSmoke?.emitRate || 0,
        skidCount: tfm?.leftPointCount || 0
      };
    })()`);
    if (data.pitch > maxAccelPitch) maxAccelPitch = data.pitch;
    if (data.smokeLeft > straightSmokeEmit) straightSmokeEmit = data.smokeLeft;
    straightSkidPoints = data.skidCount;

    if (i === 10) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      if (shot?.data) {
        const shotPath = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949\\stage3_cruising_grip.png';
        fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
        console.log('Saved cruising screenshot to:', shotPath);
      }
    }
  }
  console.log(`Straight driving: maxAccelPitch=${maxAccelPitch.toFixed(4)} rad, straightSmokeEmit=${straightSmokeEmit}, straightSkidPoints=${straightSkidPoints}`);

  // 4. Braking test (Dive Body Pitch)
  console.log('\n--- CHECK 5: Service Braking (Dive Body Pitch) ---');
  await pressInputs({ forward: false, backward: true });

  let minBrakePitch = 0;
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 70));
    const pitch = await evaluate('window.game?.vehicle?.currentPitch || 0');
    if (pitch < minBrakePitch) minBrakePitch = pitch;
  }
  await pressInputs({ backward: false });
  console.log(`Braking pitch dive: minBrakePitch=${minBrakePitch.toFixed(4)} rad`);

  // Reset to start line before cornering test
  await evaluate('window.game.returnToStartLine()');
  await new Promise(r => setTimeout(r, 300));

  // 5. Cornering Roll test
  console.log('\n--- CHECK 6: Cornering Suspension Roll ---');
  // Steer right while accelerating down straight
  await pressInputs({ forward: true, steerRight: true, steerLeft: false, backward: false, handbrake: false });
  let rightTurnRoll = 0;
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 70));
    const roll = await evaluate('window.game?.vehicle?.currentRoll || 0');
    if (roll < rightTurnRoll) rightTurnRoll = roll; // Outside lean is negative roll
  }

  // Steer left while accelerating
  await pressInputs({ forward: true, steerRight: false, steerLeft: true });
  let leftTurnRoll = 0;
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 70));
    const roll = await evaluate('window.game?.vehicle?.currentRoll || 0');
    if (roll > leftTurnRoll) leftTurnRoll = roll; // Outside lean is positive roll
  }
  await pressInputs({ forward: false, steerLeft: false, steerRight: false });
  console.log(`Cornering roll: right turn lean=${rightTurnRoll.toFixed(4)} rad, left turn lean=${leftTurnRoll.toFixed(4)} rad`);

  // Reset to start line before drift test
  await evaluate('window.game.returnToStartLine()');
  await new Promise(r => setTimeout(r, 300));

  // 6. Handbrake Drift test: Smoke and Skid Marks
  console.log('\n--- CHECK 7: Handbrake Drift Feedback (Smoke & Skid Marks) ---');
  // First, accelerate forward down straight to build ~50 km/h speed
  await pressInputs({ forward: true, backward: false, steerLeft: false, steerRight: false, handbrake: false });
  await new Promise(r => setTimeout(r, 1000));

  // Now apply hard steering and handbrake to trigger lateral slide down the straight
  await pressInputs({ forward: true, steerRight: true, handbrake: true });

  let driftDetected = false;
  let maxDriftSmokeRate = 0;
  let leftSkidCount = 0;
  let rightSkidCount = 0;
  let driftTelemetry = null;

  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, 80));
    const d = await evaluate(`(() => {
      const c = window.game?.vehicleController;
      const tfm = window.game?.tireFeedbackManager;
      const t = c?.getTelemetry();
      return {
        speed: c?.forwardSpeed || 0,
        lateral: c?.lateralSpeed || 0,
        isDrifting: t?.isDrifting || false,
        handbrake: c?.isHandbrakeEngaged || false,
        smokeLeft: tfm?.leftSmoke?.emitRate || 0,
        smokeRight: tfm?.rightSmoke?.emitRate || 0,
        leftSkidCount: tfm?.leftPointCount || 0,
        rightSkidCount: tfm?.rightPointCount || 0,
        telemetry: t
      };
    })()`);

    if (d.smokeLeft > maxDriftSmokeRate) maxDriftSmokeRate = d.smokeLeft;
    if (d.leftSkidCount > leftSkidCount) leftSkidCount = d.leftSkidCount;
    if (d.rightSkidCount > rightSkidCount) rightSkidCount = d.rightSkidCount;
    if (d.isDrifting || Math.abs(d.lateral) > 1.2 || d.smokeLeft > 0) {
      driftDetected = true;
      driftTelemetry = d.telemetry;
    }

    // Capture screenshot at peak slide (iteration 6-8)
    if (i === 7) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      if (shot?.data) {
        const shotPath = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949\\stage3_drift_feedback.png';
        fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
        console.log('Saved active drift screenshot to:', shotPath);
      }
    }
  }

  console.log(`Drift results: driftDetected=${driftDetected}, maxSmokeEmit=${maxDriftSmokeRate}, leftSkids=${leftSkidCount}, rightSkids=${rightSkidCount}`);
  if (driftTelemetry) {
    console.log('Drift Telemetry:', driftTelemetry);
  }

  // Release all inputs
  await pressInputs({ forward: false, steerRight: false, handbrake: false });

  // 7. Straighten up / cessation of smoke
  console.log('\n--- CHECK 8: Smoke Cutoff After Slide ---');
  await new Promise(r => setTimeout(r, 600));
  const postSlideSmoke = await evaluate(`(() => {
    const tfm = window.game?.tireFeedbackManager;
    return {
      leftEmit: tfm?.leftSmoke?.emitRate || 0,
      rightEmit: tfm?.rightSmoke?.emitRate || 0
    };
  })()`);
  console.log('Post-slide smoke rate:', postSlideSmoke);

  // 8. Vehicle Reset Test
  console.log('\n--- CHECK 9: Vehicle Reset & Skid Buffer Wipe ---');
  await evaluate('window.game.returnToStartLine()');
  await new Promise(r => setTimeout(r, 400));

  const postResetState = await evaluate(`(() => {
    const v = window.game?.vehicle;
    const c = window.game?.vehicleController;
    const tfm = window.game?.tireFeedbackManager;
    return {
      speed: c?.forwardSpeed || 0,
      pitch: v?.currentPitch || 0,
      roll: v?.currentRoll || 0,
      smokeLeft: tfm?.leftSmoke?.emitRate || 0,
      leftSkidCount: tfm?.leftPointCount || 0,
      rightSkidCount: tfm?.rightPointCount || 0
    };
  })()`);
  console.log('Post-reset state:', postResetState);

  // 9. Camera Refinement Check
  console.log('\n--- CHECK 10: Camera Telemetry & Dynamic Shake ---');
  await evaluate('window.game.sceneManager.triggerCameraShake(0.8)');
  const camCheck = await evaluate(`(() => {
    const cam = window.game?.sceneManager?.chaseCamera;
    return {
      exists: !!cam,
      fov: cam?.camera?.fov,
      baseFov: cam?.config?.baseFov,
      maxFov: cam?.config?.maxFov,
      shakeIntensity: cam?.config?.shakeIntensity,
      hasShake: cam?.shakeTrauma > 0
    };
  })()`);
  console.log('Chase camera check:', camCheck);

  // 10. Frame rate & Error check
  console.log('\n--- CHECK 11: Performance & Zero Errors ---');
  const fps = await evaluate('window.game?.sceneManager?.engine?.getFps()');
  console.log(`Average render loop FPS: ${fps.toFixed(1)}`);
  console.log(`Console errors during test: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.error('Console errors encountered:', consoleErrors);
  }

  // Summary of verdicts
  const checks = [
    { name: 'TireFeedbackManager initialized', pass: tfmInit.exists && tfmInit.hasLeftSmoke && tfmInit.hasLeftSkidMesh },
    { name: 'Squat body pitch on acceleration (> 0)', pass: maxAccelPitch > 0.005 },
    { name: 'Dive body pitch on braking (< 0)', pass: minBrakePitch < -0.005 },
    { name: 'Chassis outside roll in corners', pass: rightTurnRoll < -0.005 && leftTurnRoll > 0.005 },
    { name: 'Zero smoke on straight normal grip', pass: straightSmokeEmit === 0 },
    { name: 'Tire smoke emitted during handbrake drift', pass: maxDriftSmokeRate > 10 },
    { name: 'Skid marks generated during slide', pass: leftSkidCount > 0 && rightSkidCount > 0 },
    { name: 'Smoke cuts off after slide resolves', pass: postSlideSmoke.leftEmit === 0 && postSlideSmoke.rightEmit === 0 },
    { name: 'Vehicle reset clears skids & body tilt', pass: postResetState.leftSkidCount === 0 && Math.abs(postResetState.pitch) < 0.001 },
    { name: 'Chase camera dynamic shake operational', pass: camCheck.exists && camCheck.hasShake },
    { name: 'Target 60 FPS maintained without console errors', pass: fps >= 45 && consoleErrors.length === 0 }
  ];

  console.log('\n========================================');
  console.log('  STAGE 3 DRIVING FEEDBACK VERDICT:');
  console.log('========================================');
  let allPass = true;
  for (const c of checks) {
    const status = c.pass ? 'PASS [OK]' : 'FAIL [X]';
    if (!c.pass) allPass = false;
    console.log(`- ${status}: ${c.name}`);
  }
  console.log(`\nOverall: ${allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}\n`);

  edgeProc.kill();
  process.exit(allPass ? 0 : 1);
}

verifyStage3Feedback().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
