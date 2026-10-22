const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

async function runStage13CareerVerification() {
  console.log('================================================================');
  console.log('   PROJECT APEX — STAGE 13 CAREER MODE & PROGRESSION AUDIT     ');
  console.log('================================================================\n');

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\cae9d4c6-6024-4167-a66e-403e7553d949';
  const profileDir = path.join(os.tmpdir(), 'apex_stage13_career_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  console.log('[Step 1/10] Launching headless browser with CDP...');
  const edgeProc = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=9875',
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
        const req = http.get('http://localhost:9875/json', res => {
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
    console.error('ERROR: Page target not found on port 9875');
    edgeProc.kill();
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
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const resolve = pending.get(data.id);
      pending.delete(data.id);
      resolve(data.result);
    }
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
      const text = data.params.args?.map(a => a.value || a.description).join(' ');
      consoleErrors.push(text);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);
  await send('Runtime.enable');
  await send('Page.enable');

  async function evaluate(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ': ' + (res.exceptionDetails.exception?.description || ''));
    }
    return res.result?.value;
  }

  async function takeScreenshot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const targetPath = path.join(artifactDir, name);
    fs.writeFileSync(targetPath, buffer);
    console.log(`  -> Screenshot saved: ${name}`);
    return targetPath;
  }

  try {
    console.log('[Step 2/10] Waiting for Project Apex initialization...');
    let ready = false;
    for (let i = 0; i < 40; i++) {
      ready = await evaluate(`Boolean(window.game && window.game.careerManager && window.game.state !== 'loading')`);
      if (ready) break;
      await new Promise(r => setTimeout(r, 500));
    }
    if (!ready) {
      throw new Error('Project Apex game failed to initialize within timeout');
    }
    console.log('  -> Project Apex successfully loaded and ready.');
    await evaluate(`window.alert = (msg) => { console.log('[Browser Alert Intercepted]:', msg); };`);

    // -------------------------------------------------------------
    // Test 1: Fresh Career State Audit
    // -------------------------------------------------------------
    console.log('\n[Step 3/10] Verifying fresh career profile state and defaults...');
    const initialState = await evaluate(`(() => {
      const cm = window.game.careerManager;
      return {
        credits: cm.getCredits(),
        reputation: cm.getReputation(),
        currentTier: cm.getCurrentTier(),
        isDetectiveOwned: cm.isVehicleOwned('detective_cruiser'),
        isApexOwned: cm.isVehicleOwned('apex01_flagship'),
        isRookieSprintUnlocked: cm.isEventUnlocked('rookie_sprint_1'),
        isRookieTTUnlocked: cm.isEventUnlocked('rookie_time_trial_2'),
        selectedVehicleId: cm.getSelectedVehicleId()
      };
    })()`);

    console.log('  -> Initial Career State:', JSON.stringify(initialState, null, 2));
    if (initialState.credits !== 5000) throw new Error(`Expected 5000 starting credits, got ${initialState.credits}`);
    if (initialState.reputation !== 0) throw new Error(`Expected 0 starting reputation, got ${initialState.reputation}`);
    if (!initialState.isDetectiveOwned) throw new Error('Detective Cruiser starter vehicle should be owned');
    if (!initialState.isApexOwned) throw new Error('Apex-01 starter vehicle should be owned');
    if (!initialState.isRookieSprintUnlocked) throw new Error('Rookie Sprint 1 must be unlocked by default');
    if (initialState.isRookieTTUnlocked) throw new Error('Rookie Time Trial 1 should be locked initially');

    // -------------------------------------------------------------
    // Test 2: Main Menu Career Buttons
    // -------------------------------------------------------------
    console.log('\n[Step 4/10] Verifying Main Menu Buttons and Shortcuts...');
    const menuButtons = await evaluate(`(() => {
      const careerBtn = document.getElementById('btn-menu-career');
      const playBtn = document.getElementById('btn-menu-play');
      const garageBtn = document.getElementById('btn-menu-garage');
      return {
        careerBtnExists: Boolean(careerBtn),
        careerBtnText: careerBtn ? careerBtn.textContent.trim() : null,
        playBtnExists: Boolean(playBtn),
        playBtnText: playBtn ? playBtn.textContent.trim() : null,
        garageBtnExists: Boolean(garageBtn)
      };
    })()`);

    console.log('  -> Main Menu Buttons:', JSON.stringify(menuButtons, null, 2));
    if (!menuButtons.careerBtnExists || (!menuButtons.careerBtnText.includes('CAREER MODE') && !menuButtons.careerBtnText.includes('CAREER CHAMPIONSHIP'))) {
      throw new Error('Career Mode button missing on Main Menu');
    }
    if (!menuButtons.playBtnExists || (!menuButtons.playBtnText.includes('START') && !menuButtons.playBtnText.includes('FREE PLAY'))) {
      throw new Error('Start / Quick Play button on Main Menu missing or corrupted');
    }
    await takeScreenshot('stage13_main_menu.png');

    // -------------------------------------------------------------
    // Test 3: Opening Career Hub & Inspecting UI
    // -------------------------------------------------------------
    console.log('\n[Step 5/10] Opening Career Hub...');
    await evaluate(`window.game.openCareerHub()`);
    await new Promise(r => setTimeout(r, 600));

    const hubState = await evaluate(`(() => {
      const titleEl = document.getElementById('ch-driver-title');
      const lvlEl = document.getElementById('ch-driver-level');
      const repEl = document.getElementById('ch-rep-count');
      const creditsEl = document.getElementById('ch-credits-balance');
      const tierTabs = Array.from(document.querySelectorAll('.career-tier-tab')).map(t => ({
        id: t.id,
        name: t.querySelector('.tier-tab-name')?.textContent?.trim(),
        isLocked: t.classList.contains('locked-tier'),
        isActive: t.classList.contains('active')
      }));
      const eventCards = Array.from(document.querySelectorAll('.career-event-card')).map(c => ({
        eventId: c.getAttribute('data-event-id'),
        name: c.querySelector('.event-card-name')?.textContent?.trim(),
        isLocked: c.classList.contains('is-locked')
      }));
      const startBtn = document.getElementById('btn-ch-start-event');

      return {
        gameState: window.game.state,
        driverTitle: titleEl?.textContent?.trim(),
        driverLvl: lvlEl?.textContent?.trim(),
        repText: repEl?.textContent?.trim(),
        creditsText: creditsEl?.textContent?.trim(),
        tierTabs,
        eventCards,
        startBtnEnabled: startBtn ? !startBtn.hasAttribute('disabled') : false
      };
    })()`);

    console.log('  -> Hub Inspection:', JSON.stringify(hubState, null, 2));
    if (hubState.gameState !== 'CareerHub') throw new Error(`Expected GameState.CareerHub, got ${hubState.gameState}`);
    if (hubState.tierTabs.length !== 5) throw new Error(`Expected 5 Career Tiers, found ${hubState.tierTabs.length}`);
    if (!hubState.tierTabs[0].isActive) throw new Error('Tier 1 should be active by default');
    if (!hubState.tierTabs[1].isLocked) throw new Error('Tier 2 should be locked at 0 REP');
    if (hubState.eventCards.length !== 3) throw new Error(`Expected 3 events in Tier 1, found ${hubState.eventCards.length}`);
    if (hubState.eventCards[0].isLocked) throw new Error('Event 1 (Rookie Debut Sprint) should be unlocked');
    if (!hubState.startBtnEnabled) throw new Error('Start button should be enabled for Detective Cruiser (Tier 1)');

    await takeScreenshot('stage13_career_hub_tier1.png');

    // -------------------------------------------------------------
    // Test 4: Ineligible Vehicle Blocking
    // -------------------------------------------------------------
    console.log('\n[Step 6/10] Testing Ineligible Vehicle Entry Restrictions...');
    // Set active vehicle to Apex-01 Coupe (Tier 4) while viewing Tier 1 event
    await evaluate(`(() => {
      window.game.careerManager.setSelectedVehicleId('apex01_flagship');
      window.game.careerHub.render();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    const eligibilityCheck = await evaluate(`(() => {
      const startBtn = document.getElementById('btn-ch-start-event');
      const garageLinkBtn = document.getElementById('btn-ch-go-garage');
      const errorBox = document.querySelector('.eligibility-box.error-box');
      return {
        startDisabled: startBtn ? startBtn.hasAttribute('disabled') : false,
        garageLinkExists: Boolean(garageLinkBtn),
        errorText: errorBox?.textContent?.trim()
      };
    })()`);

    console.log('  -> Eligibility Enforcement:', JSON.stringify(eligibilityCheck, null, 2));
    if (!eligibilityCheck.startDisabled) throw new Error('Start button MUST be disabled for ineligible Tier 4 chassis in Tier 1');
    if (!eligibilityCheck.garageLinkExists) throw new Error('Garage link button should be present when vehicle is ineligible');

    // Restore eligible chassis (detective_cruiser)
    await evaluate(`(() => {
      window.game.careerManager.setSelectedVehicleId('detective_cruiser');
      window.game.careerHub.render();
    })()`);
    await new Promise(r => setTimeout(r, 400));

    // -------------------------------------------------------------
    // Test 5: Launching and Racing Career Event 1
    // -------------------------------------------------------------
    console.log('\n[Step 7/10] Launching Career Event 01 (Rookie Debut Sprint)...');
    await evaluate(`(() => {
      const event = window.game.careerHub.selectedEventId;
      const evDef = window.game.careerManager.getEventRecord ? window.game.careerManager : null;
      document.getElementById('btn-ch-start-event')?.click();
    })()`);

    await new Promise(r => setTimeout(r, 800));
    const raceState = await evaluate(`(() => ({
      state: window.game.state,
      isCareerSession: window.game.isCareerSession,
      activeCareerEventId: window.game.activeCareerEvent?.id,
      mode: window.game.currentEvent?.mode
    }))()`);
    console.log('  -> Career Race State:', JSON.stringify(raceState, null, 2));
    if (!raceState.isCareerSession) throw new Error('Race should be flagged as active career session');
    if (raceState.activeCareerEventId !== 'rookie_sprint_1') throw new Error('Active career event ID mismatch');

    // Wait for countdown to finish -> Racing state
    console.log('  -> Waiting for countdown to finish...');
    for (let i = 0; i < 15; i++) {
      const s = await evaluate(`window.game.state`);
      if (s === 'Racing') break;
      await new Promise(r => setTimeout(r, 400));
    }
    await takeScreenshot('stage13_career_racing_active.png');

    // Complete race by triggering finish
    console.log('  -> Simulating race completion and victory...');
    await evaluate(`(() => {
      window.game.raceTimeSeconds = 18.25;
      window.game.careerWallCollisions = 0; // Clean race objective met!
      window.game.careerMaxSpeedKmh = 175; // Top speed objective met!
      window.game.finishRace();
    })()`);

    // Wait for finish cinematic to complete and results screen to show
    let resultsVisible = false;
    for (let i = 0; i < 30; i++) {
      resultsVisible = await evaluate(`window.game.state === 'CareerResults' && !document.getElementById('career-results-overlay').classList.contains('hidden')`);
      if (resultsVisible) break;
      // Skip cinematic if still in Finished
      await evaluate(`(() => {
        if (window.game.state === 'Finished') {
          window.game.showFinishScreen();
        }
      })()`);
      await new Promise(r => setTimeout(r, 400));
    }
    if (!resultsVisible) throw new Error('CareerResultsScreen failed to show after race finish');

    const resultsData = await evaluate(`(() => {
      const medalStamp = document.getElementById('cr-medal-stamp');
      const medalText = document.getElementById('cr-medal-text')?.textContent?.trim();
      const posText = document.getElementById('cr-position-text')?.textContent?.trim();
      const totalCredits = document.getElementById('cr-total-credits')?.textContent?.trim();
      const repVal = document.getElementById('cr-rep-val')?.textContent?.trim();
      const unlockAlert = document.getElementById('cr-unlock-alert');
      const unlockText = document.getElementById('cr-unlock-text')?.textContent?.trim();

      return {
        medalStampClass: medalStamp?.className,
        medalText,
        posText,
        totalCredits,
        repVal,
        unlockVisible: unlockAlert ? !unlockAlert.classList.contains('hidden') : false,
        unlockText,
        creditsInBank: window.game.careerManager.getCredits(),
        repInBank: window.game.careerManager.getReputation()
      };
    })()`);

    console.log('  -> Career Results Screen Data:', JSON.stringify(resultsData, null, 2));
    if (!resultsData.medalStampClass.includes('gold-stamp')) throw new Error('Expected Gold victory stamp');
    if (resultsData.repInBank < 150) throw new Error(`Expected at least 150 REP earned, got ${resultsData.repInBank}`);
    if (resultsData.creditsInBank <= 5000) throw new Error(`Expected credits to increase from 5000, got ${resultsData.creditsInBank}`);
    if (!resultsData.unlockVisible || !resultsData.unlockText.includes('UNLOCKED')) {
      throw new Error('New event unlock alert should be displayed on first victory');
    }

    await takeScreenshot('stage13_career_results_screen.png');

    // -------------------------------------------------------------
    // Test 6: Idempotency Verification (Single-Award Guarantee)
    // -------------------------------------------------------------
    console.log('\n[Step 8/10] Testing Single-Award Idempotency Guarantee...');
    const preDupeCredits = resultsData.creditsInBank;
    const preDupeRep = resultsData.repInBank;

    const duplicateAttempt = await evaluate(`(() => {
      const cm = window.game.careerManager;
      const token = window.game.careerSessionToken;
      return cm.completeEvent({
        eventId: 'rookie_sprint_1',
        resultValue: 18.25,
        positionRank: 1,
        wallHits: 0,
        topSpeedKmh: 175,
        maxComboMultiplier: 1.0,
        sessionToken: token // identical token
      });
    })()`);

    console.log('  -> Duplicate attempt result:', JSON.stringify(duplicateAttempt, null, 2));
    if (!duplicateAttempt.isAlreadyRewarded) throw new Error('Idempotency guard failed: isAlreadyRewarded should be true');
    if (duplicateAttempt.totalCredits !== 0 || duplicateAttempt.reputationEarned !== 0) {
      throw new Error('Duplicate award gave non-zero credits or reputation!');
    }

    const postDupeCredits = await evaluate(`window.game.careerManager.getCredits()`);
    const postDupeRep = await evaluate(`window.game.careerManager.getReputation()`);
    if (postDupeCredits !== preDupeCredits || postDupeRep !== preDupeRep) {
      throw new Error('Bank balance changed during duplicate completion attempt!');
    }
    console.log('  -> Single-award guarantee verified: zero duplicate credits/reputation awarded.');

    // -------------------------------------------------------------
    // Test 7: Return to Career Hub & Verify Next Event Unlocked
    // -------------------------------------------------------------
    console.log('\n[Step 9/10] Returning to Career Hub and verifying unlocks...');
    await evaluate(`document.getElementById('btn-cr-continue')?.click()`);
    await new Promise(r => setTimeout(r, 600));

    const updatedHub = await evaluate(`(() => {
      const eventCards = Array.from(document.querySelectorAll('.career-event-card')).map(c => ({
        eventId: c.getAttribute('data-event-id'),
        name: c.querySelector('.event-card-name')?.textContent?.trim(),
        isLocked: c.classList.contains('is-locked'),
        statusTag: c.querySelector('.event-status-tag')?.textContent?.trim()
      }));
      return {
        gameState: window.game.state,
        eventCards,
        credits: window.game.careerManager.getCredits(),
        reputation: window.game.careerManager.getReputation()
      };
    })()`);

    console.log('  -> Updated Hub State:', JSON.stringify(updatedHub, null, 2));
    const ev1 = updatedHub.eventCards.find(e => e.eventId === 'rookie_sprint_1');
    const ev2 = updatedHub.eventCards.find(e => e.eventId === 'rookie_time_trial_2');

    if (!ev1 || !ev1.statusTag.includes('GOLD')) throw new Error('Event 1 card should display Gold medal badge');
    if (!ev2 || ev2.isLocked) throw new Error('Event 2 (Rookie Time Trial) should now be UNLOCKED');

    await takeScreenshot('stage13_career_hub_unlocked.png');

    // -------------------------------------------------------------
    // Test 8: Garage Vehicle Purchasing
    // -------------------------------------------------------------
    console.log('\n[Step 10/10] Testing Vehicle Purchasing in Garage...');
    // Grant player sufficient credits if needed to test vehicle purchase
    await evaluate(`window.game.careerManager.addCredits(15000)`);
    await evaluate(`window.game.openGarage()`);
    await new Promise(r => setTimeout(r, 800));

    const garagePurchaseResult = await evaluate(`(() => {
      const cm = window.game.careerManager;
      const initialOwned = cm.isVehicleOwned('fairhaven_lt80');
      const startCredits = cm.getCredits();

      // Select Fairhaven LT-80 (cost 8,000 CR)
      window.game.garageScreen.selectVehicle('fairhaven_lt80');

      // Click purchase/select button
      document.getElementById('btn-select-chassis')?.click();

      const postOwned = cm.isVehicleOwned('fairhaven_lt80');
      const endCredits = cm.getCredits();

      return {
        initialOwned,
        postOwned,
        startCredits,
        endCredits,
        creditsDeducted: startCredits - endCredits
      };
    })()`);

    console.log('  -> Garage Purchase Result:', JSON.stringify(garagePurchaseResult, null, 2));
    if (garagePurchaseResult.initialOwned) throw new Error('Fairhaven LT-80 should not be owned initially');
    if (!garagePurchaseResult.postOwned) throw new Error('Fairhaven LT-80 was not unlocked after purchase click');
    if (garagePurchaseResult.creditsDeducted !== 8000) {
      throw new Error(`Expected exactly 8,000 CR deducted, got ${garagePurchaseResult.creditsDeducted}`);
    }

    await takeScreenshot('stage13_garage_career_purchase.png');

    console.log('\n================================================================');
    console.log('   ALL 10 CAREER MODE VERIFICATION CHECKS PASSED PERFECTLY!     ');
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ VERIFICATION FAILED:', err);
    process.exitCode = 1;
  } finally {
    edgeProc.kill();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  }
}

runStage13CareerVerification();
