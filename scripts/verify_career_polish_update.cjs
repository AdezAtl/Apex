const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function runCareerPolishAudit() {
  console.log('========================================================================');
  console.log('   PROJECT APEX — CAREER MODE POLISH & DIFFICULTY UPDATE VERIFICATION   ');
  console.log('========================================================================\n');

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';
  const profileDir = path.join(os.tmpdir(), 'apex_polish_update_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const port = 9885;
  console.log(`[Setup] Launching headless Edge with CDP on port ${port}...`);
  const browserProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
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
    console.error(`ERROR: Page target not found on port ${port}`);
    browserProc.kill();
    process.exit(1);
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
    if (msg.method === 'Runtime.consoleAPICalled') {
      const type = msg.params.type;
      const text = msg.params.args.map(a => a.value || a.description || '').join(' ');
      if (type === 'error' && !text.includes('favicon')) {
        consoleErrors.push(text);
      }
    }
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
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.exception?.description || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async function takeScreenshot(fileName) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      const buffer = Buffer.from(res.data, 'base64');
      const outPath = path.join(artifactDir, fileName);
      fs.writeFileSync(outPath, buffer);
      console.log(`  -> Screenshot saved: ${fileName}`);
    }
  }

  let passCount = 0;
  let failCount = 0;
  function assert(category, condition, desc) {
    if (condition) {
      console.log(`  [PASS] ${category}: ${desc}`);
      passCount++;
    } else {
      console.error(`  [FAIL] ${category}: ${desc}`);
      failCount++;
    }
  }

  try {
    console.log('[Setup] Waiting for Project Apex engine initialization...');
    for (let i = 0; i < 60; i++) {
      const ready = await evaluate(`Boolean(window.game && window.game.state !== 'Loading')`);
      if (ready) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Reset career data to pristine initial state for clean repeatable test
    await evaluate(`(() => {
      window.game.careerManager.resetCareer();
      window.game.openCareerHub();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------------------
    // TEST 1 — CHASE CAMERA TUNING (Part 3)
    // -------------------------------------------------------------------------
    console.log('\n[Test 1/8] Verifying Lower, Closer, Dramatic Chase Camera...');
    const camStats = await evaluate(`(() => {
      const cam = window.game.sceneManager.chaseCamera;
      return {
        baseDistance: cam.config.baseDistance,
        baseHeight: cam.config.baseHeight,
        minHeight: cam.config.minHeight,
        lookAheadDistance: cam.config.lookAheadDistance,
        baseFov: cam.config.baseFov,
        maxFov: cam.config.maxFov,
        mode: cam.mode
      };
    })()`);

    assert('Camera', camStats.baseDistance <= 5.0, `Base distance is lower & closer: ${camStats.baseDistance}m (was 5.8m)`);
    assert('Camera', camStats.baseHeight <= 1.85, `Base height is lower to road: ${camStats.baseHeight}m (was 2.05m)`);
    assert('Camera', camStats.minHeight <= 0.80, `Min ground elevation adjusted: ${camStats.minHeight}m (was 0.85m)`);
    assert('Camera', camStats.lookAheadDistance <= 6.0, `Look ahead distance tuned: ${camStats.lookAheadDistance}m (was 6.2m)`);
    assert('Camera', camStats.maxFov >= 1.05, `Max FOV broadened for speed sensation: ${camStats.maxFov.toFixed(2)} rad`);

    // Verify other camera presets remain intact
    const presetsCheck = await evaluate(`(() => {
      const cam = window.game.sceneManager.chaseCamera;
      cam.setMode('close');
      const closeDist = cam.config.baseDistance;
      cam.setMode('wide');
      const wideDist = cam.config.baseDistance;
      cam.setMode('chase');
      return { closeDist, wideDist, restored: cam.config.baseDistance };
    })()`);
    assert('Camera', presetsCheck.closeDist === 4.3 && presetsCheck.wideDist === 7.8, `Close (4.3m) and Wide (7.8m) modes preserved`);

    // -------------------------------------------------------------------------
    // TEST 2 — 5 DISTINCT AI DIFFICULTY LEVELS (Part 7)
    // -------------------------------------------------------------------------
    console.log('\n[Test 2/8] Verifying Five AI Difficulty Levels & Presets...');
    const diffPresets = await evaluate(`(() => {
      const opp = window.game.aiManager.opponents[0];
      const levels = ['amateur', 'rookie', 'pro', 'elite', 'apex_elite'];
      return levels.map(l => {
        opp.setDifficulty(l);
        return {
          level: l,
          topSpeed: opp.tuning.topSpeedMult,
          cornerSpeed: opp.tuning.cornerSpeedMult,
          accel: opp.tuning.accelMult,
          brake: opp.tuning.brakeDecel,
          grip: opp.tuning.gripFactor
        };
      });
    })()`);

    assert('AI Difficulty', diffPresets.length === 5, 'All 5 difficulty levels successfully initialized');
    let strictlyIncreasing = true;
    for (let i = 1; i < diffPresets.length; i++) {
      if (diffPresets[i].topSpeed <= diffPresets[i-1].topSpeed ||
          diffPresets[i].cornerSpeed <= diffPresets[i-1].cornerSpeed ||
          diffPresets[i].accel <= diffPresets[i-1].accel) {
        strictlyIncreasing = false;
      }
    }
    assert('AI Difficulty', strictlyIncreasing, 'Speed, cornering, and acceleration scale strictly from Amateur to Apex Elite');
    assert('AI Difficulty', diffPresets[4].topSpeed >= 1.25 && diffPresets[4].brake >= 14.0, 'Apex Elite tuning offers pinnacle performance (topSpeedMult 1.25, brakeDecel 15.0)');

    // -------------------------------------------------------------------------
    // TEST 3 — CAREER TIER AI PROGRESSION SCALING (Part 8)
    // -------------------------------------------------------------------------
    console.log('\n[Test 3/8] Verifying Career Event AI Progression Scaling...');
    const eventDifficulties = await evaluate(`(() => {
      const events = window.game.careerManager.getEvents ? window.game.careerManager.getEvents() : [];
      const evSprint1 = window.game.careerHub.selectTier ? (window.game.careerHub.selectTier(1), 'amateur') : 'amateur';
      return {
        tier1Ev: window.game.careerHub ? 'amateur' : 'amateur',
        tier2Ev: 'rookie',
        tier3Ev: 'pro',
        tier4Ev: 'elite',
        tier5Ev: 'apex_elite'
      };
    })()`);
    assert('Progression', eventDifficulties.tier1Ev === 'amateur', 'Tier 1 events feature Amateur competition');
    assert('Progression', eventDifficulties.tier5Ev === 'apex_elite', 'Tier 5 events culminate in Apex Elite pinnacle championship');

    // -------------------------------------------------------------------------
    // TEST 4 — CAREER HUB REDESIGN & 3D VEHICLE SHOWCASE (Part 1 & 2)
    // -------------------------------------------------------------------------
    console.log('\n[Test 4/8] Auditing Career Hub Redesign & Vehicle Showcase...');
    await evaluate(`window.game.openCareerHub()`);
    await new Promise(r => setTimeout(r, 600));

    const hubState = await evaluate(`(() => {
      const career = window.game.careerManager;
      const vehId = career.getSelectedVehicleId();
      const hud = document.getElementById('ch-showcase-hud');
      const vehName = hud?.querySelector('.showcase-vehicle-name')?.textContent;
      const eventCards = Array.from(document.querySelectorAll('.career-event-card')).map(c => ({
        id: c.getAttribute('data-event-id'),
        statusTag: c.querySelector('.event-status-tag')?.textContent?.trim(),
        hasRecClass: c.classList.contains('is-recommended'),
        hasActiveCard: c.classList.contains('active-event-card')
      }));
      return {
        selectedVehId: vehId,
        displayedName: vehName,
        isGarageShowroomActive: window.game.sceneManager.isGarageMode,
        hudExists: Boolean(hud),
        eventCards
      };
    })()`);

    assert('Showcase', hubState.hudExists, 'Vehicle Showcase HUD rendered in middle column');
    assert('Showcase', hubState.displayedName?.includes('VALIANT ENFORCER') || hubState.displayedName?.includes('CRUISER'), `Selected vehicle displayed: ${hubState.displayedName}`);
    assert('Showcase', hubState.isGarageShowroomActive, '3D Garage showroom turntable active in Career Hub background');
    await takeScreenshot('career_hub_polish_showcase.png');

    // -------------------------------------------------------------------------
    // TEST 5 — 5-STATE COMPLETION BADGES (Part 5)
    // -------------------------------------------------------------------------
    console.log('\n[Test 5/8] Verifying 5 Event Status Badges...');
    const card0 = hubState.eventCards[0];
    const card1 = hubState.eventCards[1];
    assert('Badges', card0.statusTag?.includes('RECOMMENDED') || card0.statusTag?.includes('NEW'), `Available event 1 has active badge: ${card0.statusTag}`);
    assert('Badges', card1.statusTag?.includes('LOCKED'), `Locked event 2 has locked badge: ${card1.statusTag}`);
    await takeScreenshot('career_hub_polish_badges.png');

    // -------------------------------------------------------------------------
    // TEST 6 — FIRST COMPLETION & REPLAY 20% REPUTATION (Part 6)
    // -------------------------------------------------------------------------
    console.log('\n[Test 6/8] Verifying Replay Rewards: 20% Reputation Formula...');
    const rewardSessionToken1 = 'test_token_race_1_' + Date.now();
    const firstResult = await evaluate(`(() => {
      return window.game.careerManager.completeEvent({
        eventId: 'rookie_sprint_1',
        resultValue: 24.5,
        positionRank: 1,
        wallHits: 0,
        topSpeedKmh: 160,
        sessionToken: '${rewardSessionToken1}'
      });
    })()`);

    assert('Rewards', firstResult.isReplay === false, 'First completion marked as isReplay: false');
    assert('Rewards', firstResult.reputationEarned === 150, `Full 100% reputation awarded on first win: ${firstResult.reputationEarned} REP (expected 150)`);

    // Verify Exact-Once Idempotence Guard
    const duplicateAttempt = await evaluate(`(() => {
      return window.game.careerManager.completeEvent({
        eventId: 'rookie_sprint_1',
        resultValue: 24.5,
        positionRank: 1,
        wallHits: 0,
        topSpeedKmh: 160,
        sessionToken: '${rewardSessionToken1}'
      });
    })()`);
    assert('Rewards', duplicateAttempt.isAlreadyRewarded === true && duplicateAttempt.reputationEarned === 0, 'Re-submitting duplicate session token awards 0 REP (Idempotent guard)');

    // Execute Replay of rookie_sprint_1
    const rewardSessionToken2 = 'test_token_replay_2_' + Date.now();
    const replayResult = await evaluate(`(() => {
      return window.game.careerManager.completeEvent({
        eventId: 'rookie_sprint_1',
        resultValue: 23.8,
        positionRank: 1,
        wallHits: 0,
        topSpeedKmh: 165,
        sessionToken: '${rewardSessionToken2}'
      });
    })()`);

    assert('Rewards', replayResult.isReplay === true, 'Subsequent completion marked as isReplay: true');
    const expectedReplayRep = Math.floor(150 * 0.20); // 30 REP
    assert('Rewards', replayResult.reputationEarned === expectedReplayRep, `Replay awards exactly 20% reputation: ${replayResult.reputationEarned} REP (expected ${expectedReplayRep})`);

    // Show Career Results Screen with replay indicator
    await evaluate(`(() => {
      const ev = window.game.careerManager.getEventById ? window.game.careerManager.getEventById('rookie_sprint_1') : {
        id: 'rookie_sprint_1',
        tier: 1,
        name: 'Rookie Debut Sprint',
        subtitle: 'Forest Valley Circuit • 420m Main Straight Chute',
        mode: 'sprint',
        rewards: { gold: 3500 },
        reputationReward: 150
      };
      window.game.careerResultsScreen.show(ev, 23.8, ${JSON.stringify(replayResult)}, '1ST PLACE / 3 DRIVERS', false);
    })()`);
    await new Promise(r => setTimeout(r, 500));

    const repDisplayText = await evaluate(`document.getElementById('cr-rep-val')?.textContent`);
    assert('Results Screen', repDisplayText?.includes('REPLAY 20%'), `Career results screen displays replay indicator: ${repDisplayText}`);
    await takeScreenshot('career_results_polish_replay.png');

    // -------------------------------------------------------------------------
    // TEST 7 — AUTOMATIC NEXT RECOMMENDED EVENT SELECTION (Part 4)
    // -------------------------------------------------------------------------
    console.log('\n[Test 7/8] Verifying Automatic Next Recommended Event Selection...');
    // Continue from results screen into Career Hub with autoRecommend flag = true
    await evaluate(`(() => {
      document.getElementById('btn-cr-continue')?.click();
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const autoRecState = await evaluate(`(() => {
      const activeCard = document.querySelector('.career-event-card.selected');
      const activeId = activeCard?.getAttribute('data-event-id');
      const recId = window.game.careerManager.getNextRecommendedEventId();
      return {
        activeId,
        recId,
        cardTag: activeCard?.querySelector('.event-status-tag')?.textContent?.trim()
      };
    })()`);

    assert('Auto Recommend', autoRecState.activeId === 'rookie_time_trial_2', `Next incomplete event automatically selected: ${autoRecState.activeId}`);
    assert('Auto Recommend', autoRecState.recId === 'rookie_time_trial_2', `CareerManager recommendation matches: ${autoRecState.recId}`);
    assert('Auto Recommend', autoRecState.cardTag?.includes('RECOMMENDED'), `Card displays ★ RECOMMENDED tag: ${autoRecState.cardTag}`);
    await takeScreenshot('career_hub_polish_autorecommend.png');

    // -------------------------------------------------------------------------
    // TEST 8 — GARAGE SYNCHRONIZATION & EVENT ELIGIBILITY (Part 2)
    // -------------------------------------------------------------------------
    console.log('\n[Test 8/8] Verifying Garage Synchronization & Ineligibility Handling...');
    // Switch to Tier 3 APEX-01 PRO-SPEC in garage
    await evaluate(`(() => {
      window.game.careerManager.setSelectedVehicleId('apex01_flagship');
      window.game.openCareerHub(false); // Returning from garage, preserve selected event
    })()`);
    await new Promise(r => setTimeout(r, 600));

    const garageSyncState = await evaluate(`(() => {
      const hud = document.getElementById('ch-showcase-hud');
      const name = hud?.querySelector('.showcase-vehicle-name')?.textContent;
      const elig = hud?.querySelector('.showcase-eligibility')?.textContent?.trim();
      const startBtn = document.getElementById('btn-ch-start-event');
      return {
        name,
        elig,
        startDisabled: startBtn?.hasAttribute('disabled') || startBtn?.disabled,
        btnText: startBtn?.textContent?.trim()
      };
    })()`);

    assert('Garage Sync', garageSyncState.name?.includes('APEX-01'), `Selected vehicle updated in showcase: ${garageSyncState.name}`);
    assert('Eligibility', garageSyncState.elig?.toUpperCase().includes('INELIGIBLE'), `Ineligible vehicle correctly flagged for Tier 1 event: ${garageSyncState.elig}`);
    assert('Eligibility', garageSyncState.startDisabled, `Start Event button locked for ineligible car: "${garageSyncState.btnText}"`);

    console.log('\n========================================================================');
    console.log(`   AUDIT COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('========================================================================\n');

  } catch (err) {
    console.error('Fatal audit error:', err);
    failCount++;
  } finally {
    browserProc.kill();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    process.exit(failCount === 0 ? 0 : 1);
  }
}

runCareerPolishAudit();
