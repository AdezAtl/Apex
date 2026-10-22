import {
  CAREER_TIERS,
  CAREER_EVENTS,
  CareerEventDefinition,
  getTierInfo,
  getEventsByTier,
} from '../career/CareerConfig';
import { CareerManager } from '../career/CareerManager';
import { VEHICLE_CATALOG, getVehicleById } from '../vehicle/VehicleCatalog';

export interface CareerHubCallbacks {
  onStartEvent: (event: CareerEventDefinition) => void;
  onOpenGarage: () => void;
  onBack: () => void;
}

export class CareerHub {
  private container: HTMLElement | null = null;
  private callbacks: CareerHubCallbacks;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;
  private selectedTier: number = 1;
  private selectedEventId: string = 'rookie_sprint_1';
  private boundKeyDown: (e: KeyboardEvent) => void;
  private tooltipTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: CareerHubCallbacks) {
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('career-hub-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'career-hub-overlay';
    this.container.className = 'menu-overlay career-hub-overlay hidden';

    this.container.innerHTML = `
      <div class="career-hub-layout">
        <!-- ==================================================================
             ZONE 1 — PLAYER HEADER BAR (Fixed: 64px, Full Width)
             ================================================================== -->
        <header class="zone-player-header">
          <!-- Left: Brand Block -->
          <div class="header-left">
            <span class="brand-eyebrow">PROJECT APEX</span>
            <span class="brand-title">CAREER CHAMPIONSHIP</span>
          </div>

          <!-- Center: Player Level Badge & Progress Bar -->
          <div class="header-center">
            <div class="player-level-badge">
              <span id="ch-driver-title">STREET NOVICE</span>
              <span class="badge-slash">//</span>
              <span id="ch-driver-level">LVL 1</span>
            </div>
            <div class="reputation-progress-wrap">
              <div class="reputation-progress-track">
                <div id="ch-rep-fill" class="reputation-progress-fill" style="width: 0%;"></div>
              </div>
              <span id="ch-rep-count" class="reputation-label tabular-nums">0 / 450 REP</span>
            </div>
          </div>

          <!-- Right: Credits Balance & Actions -->
          <div class="header-right">
            <span id="ch-credits-balance" class="balance-val tabular-nums">5,000 CR</span>
            <button type="button" class="btn-secondary" id="btn-ch-garage">GARAGE</button>
            <button type="button" class="btn-secondary" id="btn-ch-back">← MENU</button>
          </div>
        </header>

        <!-- ==================================================================
             ZONE 2 — TIER NAVIGATION TABS (Fixed: 72px, 5 Equal 20% Tabs)
             ================================================================== -->
        <nav class="zone-tier-nav" id="ch-tier-nav" aria-label="Career Tiers">
          <!-- Rendered dynamically by renderTierTabs() -->
        </nav>

        <!-- Anchored Floating Tooltip for Locked Tiers -->
        <div id="tier-tooltip" class="tier-tooltip" role="tooltip"></div>

        <!-- ==================================================================
             ZONE 3 — MAIN CONTENT AREA (3-Column Layout: Events | Showcase | Details)
             ================================================================== -->
        <main class="zone-main-content">
          <!-- Left Column: Event List -->
          <section class="col-event-list" aria-label="Championship Events">
            <div class="col-event-header">
              <h2 class="league-title" id="ch-tier-title">ROOKIE CIRCUIT</h2>
              <div class="league-subtitle" id="ch-tier-subtitle">Entry Novice Championship</div>
              <p class="league-desc" id="ch-tier-desc">Master the fundamentals of throttle control, trail braking, and racecraft across technical configurations.</p>
            </div>

            <div class="event-cards-scroll-wrap" id="ch-events-list" role="listbox" aria-label="Career Events">
              <!-- Rendered dynamically by renderEventCards() -->
            </div>
          </section>

          <!-- Middle Column: Live 3D Vehicle Showcase Viewport & Specs HUD -->
          <section class="col-vehicle-showcase" id="ch-vehicle-showcase" aria-label="Selected Chassis Showcase">
            <div class="showcase-viewport-backdrop"></div>
            
            <!-- Sleek Floating Chassis HUD -->
            <div class="showcase-chassis-hud" id="ch-showcase-hud">
              <!-- Rendered dynamically by renderVehicleShowcase() -->
            </div>
          </section>

          <!-- Right Column: Event Detail Panel -->
          <section class="col-event-detail" id="ch-event-details-card" aria-label="Event Specifications">
            <!-- Rendered dynamically by renderEventDetails() -->
          </section>
        </main>

        <!-- ==================================================================
             ZONE 4 — CTA BAR (Fixed: 64px, Pinned to Bottom)
             ================================================================== -->
        <footer class="zone-cta-bar">
          <div class="keyboard-hints">
            [ENTER] Start Event • [G] Garage • [1–5] Switch Tier • [ESC] Menu
          </div>
          <button type="button" class="btn-start-event" id="btn-ch-start-event">
            START CAREER EVENT →
          </button>
        </footer>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.container) return;

    // Header buttons
    document.getElementById('btn-ch-garage')?.addEventListener('click', () => {
      this.triggerGarage();
    });

    document.getElementById('btn-ch-back')?.addEventListener('click', () => {
      this.triggerBack();
    });

    // CTA button
    document.getElementById('btn-ch-start-event')?.addEventListener('click', () => {
      this.handleStartClick();
    });
  }

  public selectTier(tierNumber: number): void {
    const career = CareerManager.getInstance();
    const tierInfo = getTierInfo(tierNumber);

    if (!career.isTierUnlocked(tierNumber)) {
      // Brief anchored tooltip without navigating
      const tab = document.getElementById(`tier-tab-${tierNumber}`);
      if (tab) {
        this.showLockedTooltip(
          tab,
          `Reach ${tierInfo.requiredReputation.toLocaleString()} REP to unlock`
        );
      }
      return;
    }

    this.selectedTier = tierNumber;

    // Select first unlocked event in this tier
    const events = getEventsByTier(tierNumber);
    const firstUnlocked = events.find((e: CareerEventDefinition) => career.isEventUnlocked(e.id)) || events[0];
    this.selectedEventId = firstUnlocked.id;

    this.render();
  }

  public selectEvent(eventId: string): void {
    this.selectedEventId = eventId;
    this.renderEventCards();
    this.renderVehicleShowcase();
    this.renderEventDetails();
  }

  public render(): void {
    this.renderHeaderSummary();
    this.renderTierTabs();
    this.renderActiveTierBanner();
    this.renderEventCards();
    this.renderVehicleShowcase();
    this.renderEventDetails();
  }

  private renderHeaderSummary(): void {
    const career = CareerManager.getInstance();
    const playerLevel = career.getPlayerLevel();

    const titleEl = document.getElementById('ch-driver-title');
    const lvlEl = document.getElementById('ch-driver-level');
    const repCountEl = document.getElementById('ch-rep-count');
    const repFillEl = document.getElementById('ch-rep-fill');
    const credEl = document.getElementById('ch-credits-balance');

    if (titleEl) titleEl.textContent = playerLevel.title.toUpperCase();
    if (lvlEl) lvlEl.textContent = `LVL ${playerLevel.level}`;
    if (repCountEl) {
      repCountEl.textContent = `${playerLevel.currentRep.toLocaleString()} / ${playerLevel.nextThreshold.toLocaleString()} REP`;
    }
    if (repFillEl) {
      repFillEl.style.width = `${Math.round(playerLevel.progressRatio * 100)}%`;
    }
    if (credEl) {
      credEl.textContent = `${career.getCredits().toLocaleString()} CR`;
    }
  }

  private renderTierTabs(): void {
    const nav = document.getElementById('ch-tier-nav');
    if (!nav) return;

    const career = CareerManager.getInstance();

    nav.innerHTML = CAREER_TIERS.map((tier) => {
      const isUnlocked = career.isTierUnlocked(tier.tierNumber);
      const isActive = tier.tierNumber === this.selectedTier;

      // Determine completed state: unlocked and all events completed
      const events = getEventsByTier(tier.tierNumber);
      const isCompleted = isUnlocked && events.every(e => career.isEventCompleted(e.id));

      let stateClass = '';
      let rightIcon = '';
      let metaContent = '';

      if (isActive) {
        stateClass = 'active';
        metaContent = '<span class="tier-badge-active">ACTIVE</span>';
      } else if (!isUnlocked) {
        stateClass = 'locked locked-tier';
        rightIcon = '<span class="tier-tab-icon">🔒</span>';
        metaContent = `<span class="tier-meta tabular-nums">${tier.requiredReputation.toLocaleString()} REP</span>`;
      } else if (isCompleted) {
        stateClass = 'completed';
        rightIcon = '<span class="tier-tab-icon">✓</span>';
        metaContent = `<span class="tier-meta tabular-nums">COMPLETED</span>`;
      } else {
        // Unlocked and available
        rightIcon = '<span class="tier-tab-icon">✓</span>';
        metaContent = `<span class="tier-meta tabular-nums">${tier.requiredReputation > 0 ? `${tier.requiredReputation.toLocaleString()} REP` : 'OPEN'}</span>`;
      }

      return `
        <button
          type="button"
          id="tier-tab-${tier.tierNumber}"
          class="career-tier-tab tier-tab ${stateClass}"
          data-tier="${tier.tierNumber}"
          data-required-rep="${tier.requiredReputation}"
        >
          <div class="tier-tab-top">
            <span class="tier-num">TIER ${tier.tierNumber}</span>
            ${rightIcon}
          </div>
          <span class="tier-name">${tier.name}</span>
          ${metaContent}
        </button>
      `;
    }).join('');

    // Bind tier tab clicks
    const tabs = nav.querySelectorAll<HTMLButtonElement>('.career-tier-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tierNum = parseInt(tab.getAttribute('data-tier') || '1', 10);
        this.selectTier(tierNum);
      });
    });
  }

  private showLockedTooltip(targetElement: HTMLElement, message: string): void {
    const tooltip = document.getElementById('tier-tooltip');
    if (!tooltip) return;

    if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);

    const rect = targetElement.getBoundingClientRect();
    tooltip.textContent = message;
    tooltip.style.left = `${rect.left + rect.width / 2 - 80}px`;
    tooltip.classList.add('visible');

    this.tooltipTimeout = setTimeout(() => {
      tooltip.classList.remove('visible');
    }, 2200);
  }

  private renderActiveTierBanner(): void {
    const titleEl = document.getElementById('ch-tier-title');
    const subtitleEl = document.getElementById('ch-tier-subtitle');
    const descEl = document.getElementById('ch-tier-desc');

    const tierInfo = getTierInfo(this.selectedTier);
    if (titleEl) titleEl.textContent = tierInfo.name;
    if (subtitleEl) subtitleEl.textContent = tierInfo.subtitle;
    if (descEl) descEl.textContent = tierInfo.description;
  }

  private renderEventCards(): void {
    const list = document.getElementById('ch-events-list');
    if (!list) return;

    const career = CareerManager.getInstance();
    const events = getEventsByTier(this.selectedTier);
    const recommendedEventId = career.getNextRecommendedEventId();

    list.innerHTML = events.map((ev: CareerEventDefinition) => {
      const isUnlocked = career.isEventUnlocked(ev.id);
      const isCompleted = career.isEventCompleted(ev.id);
      const record = career.getEventRecord(ev.id);
      const isSelected = ev.id === this.selectedEventId;
      const isNextRecommended = ev.id === recommendedEventId;

      // 5 Distinct Event History & Status States:
      // 1. LOCKED
      // 2. NEXT RECOMMENDED
      // 3. NEW / AVAILABLE
      // 4. COMPLETED (Medal Trophy)
      // 5. REPLAY
      let topBadge = '';
      let cardStateClass = '';

      if (!isUnlocked) {
        cardStateClass = 'locked is-locked';
        topBadge = '<span class="event-status-tag tag-locked">🔒 LOCKED</span>';
      } else if (isNextRecommended && !isCompleted) {
        cardStateClass = 'is-recommended';
        topBadge = '<span class="event-status-tag tag-recommended">★ RECOMMENDED</span>';
      } else if (isCompleted && record) {
        cardStateClass = 'is-completed';
        const medalSymbols: Record<string, string> = {
          gold: '🏆 GOLD',
          silver: '🥈 SILVER',
          bronze: '🥉 BRONZE',
          completed: '✓ COMPLETED',
        };
        const medalLabel = medalSymbols[record.medal] || '✓ COMPLETED';
        topBadge = `<span class="event-status-tag tag-completed medal-${record.medal}">${medalLabel} • REPLAY</span>`;
      } else {
        // Unlocked and untouched
        topBadge = '<span class="event-status-tag tag-new tag-ready">★ NEW</span>';
      }

      const modeName = ev.mode === 'sprint' ? 'SPRINT RACE' : ev.mode === 'time_trial' ? 'TIME TRIAL' : 'DRIFT CHALLENGE';
      const circuitName = ev.circuitId === 'azure_coast' ? 'Azure Coast GP' : 'Forest Valley GP';

      return `
        <article
          class="career-event-card event-card ${isSelected ? 'selected active-event-card' : ''} ${cardStateClass}"
          data-event-id="${ev.id}"
          role="option"
          aria-selected="${isSelected}"
          tabindex="${isUnlocked ? '0' : '-1'}"
        >
          <div class="event-card-top">
            <span class="event-card-mode">${modeName}</span>
            ${topBadge}
          </div>
          <div class="event-card-name">${ev.name}</div>
          <div class="event-card-circuit">${circuitName}</div>
        </article>
      `;
    }).join('');

    // Bind event card click handlers
    const cards = list.querySelectorAll<HTMLElement>('.career-event-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        if (card.classList.contains('locked') || card.classList.contains('is-locked')) return;
        const eventId = card.getAttribute('data-event-id');
        if (eventId) {
          this.selectEvent(eventId);
        }
      });
    });
  }

  private renderVehicleShowcase(): void {
    const hud = document.getElementById('ch-showcase-hud');
    if (!hud) return;

    const career = CareerManager.getInstance();
    const event = CAREER_EVENTS.find((e) => e.id === this.selectedEventId);
    const selectedVehicleId = career.getSelectedVehicleId();
    const vehicle = getVehicleById(selectedVehicleId) || VEHICLE_CATALOG[0];
    const effectiveSpecs = career.getEffectiveVehicleSpecs(vehicle.id) || vehicle.specs;
    const isOwned = career.isVehicleOwned(vehicle.id);

    const eligibility = event ? career.validateVehicleEligibility(event, vehicle) : { eligible: true };

    let eligibilityHtml = '';
    if (!eligibility.eligible) {
      eligibilityHtml = `
        <div class="showcase-eligibility ineligible">
          <span class="eligibility-dot"></span>
          <span>✕ ${eligibility.reason || 'Vehicle does not meet entry regulations'}</span>
        </div>
      `;
    } else {
      eligibilityHtml = `
        <div class="showcase-eligibility eligible">
          <span class="eligibility-dot"></span>
          <span>✓ Meets championship entry regulations (Tier ${vehicle.tier})</span>
        </div>
      `;
    }

    hud.innerHTML = `
      <div class="showcase-hud-header">
        <div class="showcase-hud-title-block">
          <div class="showcase-hud-eyebrow">
            <span>SELECTED CHASSIS</span>
            <span class="showcase-tier-tag">TIER ${vehicle.tier}</span>
            ${isOwned ? '<span class="showcase-owned-tag">OWNED</span>' : ''}
          </div>
          <h3 class="showcase-vehicle-name">${vehicle.name}</h3>
        </div>
        <button type="button" class="btn-showcase-garage" id="btn-showcase-garage">
          GARAGE / SWITCH CAR →
        </button>
      </div>

      <!-- Compact Performance Metrics Strip -->
      <div class="showcase-stats-grid">
        <div class="showcase-stat-tile">
          <span class="stat-label">TOP SPEED</span>
          <span class="stat-value tabular-nums">${effectiveSpecs.topSpeedKmH} <span class="stat-unit">KM/H</span></span>
        </div>
        <div class="showcase-stat-tile">
          <span class="stat-label">0-100 KM/H</span>
          <span class="stat-value tabular-nums">${effectiveSpecs.accelerationSec.toFixed(2)} <span class="stat-unit">s</span></span>
        </div>
        <div class="showcase-stat-tile">
          <span class="stat-label">HANDLING</span>
          <span class="stat-value tabular-nums">${Math.round(effectiveSpecs.handlingRating)} <span class="stat-unit">/100</span></span>
        </div>
        <div class="showcase-stat-tile">
          <span class="stat-label">DRIVETRAIN</span>
          <span class="stat-value">${effectiveSpecs.drivetrain.toUpperCase()}</span>
        </div>
      </div>

      ${eligibilityHtml}
    `;

    document.getElementById('btn-showcase-garage')?.addEventListener('click', () => {
      this.triggerGarage();
    });
  }

  private renderEventDetails(): void {
    const card = document.getElementById('ch-event-details-card');
    if (!card) return;

    const career = CareerManager.getInstance();
    const event = CAREER_EVENTS.find((e) => e.id === this.selectedEventId);
    if (!event) return;

    const isUnlocked = career.isEventUnlocked(event.id);
    const isCompleted = career.isEventCompleted(event.id);
    const record = career.getEventRecord(event.id);

    // Selected vehicle validation
    const selectedVehicleId = career.getSelectedVehicleId();
    const vehicle = getVehicleById(selectedVehicleId) || VEHICLE_CATALOG[0];
    const eligibility = career.validateVehicleEligibility(event, vehicle);

    // Benchmark rows
    let benchmarkRowsHtml = '';
    if (event.mode === 'sprint') {
      benchmarkRowsHtml = `
        <div class="benchmark-row">
          <span class="benchmark-accent-bar gold"></span>
          <span class="benchmark-trophy">🏆</span>
          <span class="benchmark-pos tabular-nums">1ST PLACE</span>
          <span class="benchmark-tier">GOLD TROPHY</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-accent-bar silver"></span>
          <span class="benchmark-trophy">🥈</span>
          <span class="benchmark-pos tabular-nums">2ND PLACE</span>
          <span class="benchmark-tier">SILVER TROPHY</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-accent-bar bronze"></span>
          <span class="benchmark-trophy">🥉</span>
          <span class="benchmark-pos tabular-nums">3RD PLACE</span>
          <span class="benchmark-tier">BRONZE TROPHY</span>
        </div>
      `;
    } else if (event.mode === 'time_trial' && event.targetBenchmark) {
      benchmarkRowsHtml = `
        <div class="benchmark-row">
          <span class="benchmark-accent-bar gold"></span>
          <span class="benchmark-trophy">🏆</span>
          <span class="benchmark-pos tabular-nums">&lt; ${event.targetBenchmark.gold.toFixed(2)}s</span>
          <span class="benchmark-tier">GOLD TROPHY</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-accent-bar silver"></span>
          <span class="benchmark-trophy">🥈</span>
          <span class="benchmark-pos tabular-nums">&lt; ${event.targetBenchmark.silver.toFixed(2)}s</span>
          <span class="benchmark-tier">SILVER TROPHY</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-accent-bar bronze"></span>
          <span class="benchmark-trophy">🥉</span>
          <span class="benchmark-pos tabular-nums">&lt; ${event.targetBenchmark.bronze.toFixed(2)}s</span>
          <span class="benchmark-tier">BRONZE TROPHY</span>
        </div>
      `;
    } else if (event.mode === 'drift' && event.targetBenchmark) {
      benchmarkRowsHtml = `
        <div class="benchmark-row">
          <span class="benchmark-accent-bar gold"></span>
          <span class="benchmark-trophy">🏆</span>
          <span class="benchmark-pos tabular-nums">&ge; ${event.targetBenchmark.gold.toLocaleString()} PTS</span>
          <span class="benchmark-tier">GOLD TROPHY</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-accent-bar silver"></span>
          <span class="benchmark-trophy">🥈</span>
          <span class="benchmark-pos tabular-nums">&ge; ${event.targetBenchmark.silver.toLocaleString()} PTS</span>
          <span class="benchmark-tier">SILVER TROPHY</span>
        </div>
        <div class="benchmark-row">
          <span class="benchmark-accent-bar bronze"></span>
          <span class="benchmark-trophy">🥉</span>
          <span class="benchmark-pos tabular-nums">&ge; ${event.targetBenchmark.bronze.toLocaleString()} PTS</span>
          <span class="benchmark-tier">BRONZE TROPHY</span>
        </div>
      `;
    }

    // Objectives list
    const objectivesHtml = event.objectives.map((obj) => {
      const isMet = record?.completedObjectives.includes(obj.id) || false;
      return `
        <div class="objective-row">
          <div class="objective-left">
            <span class="hollow-checkbox ${isMet ? 'checked' : ''}"></span>
            <span class="objective-text">${obj.description}</span>
          </div>
          <span class="objective-cr tabular-nums">+${obj.bonusCredits.toLocaleString()} CR</span>
        </div>
      `;
    }).join('');

    // Personal Best tile (if completed)
    let bestRecordHtml = '';
    if (isCompleted && record) {
      const bestFormatted = event.mode === 'drift'
        ? `${Math.round(record.bestResult).toLocaleString()} PTS`
        : `${(record.bestResult).toFixed(2)}s`;
      bestRecordHtml = `
        <div class="detail-tile pb-tile">
          <span class="tile-label">PERSONAL RECORD</span>
          <div class="pb-row">
            <span class="pb-val tabular-nums">${bestFormatted}</span>
            <span class="pb-medal medal-${record.medal}">${record.medal.toUpperCase()}</span>
          </div>
        </div>
      `;
    }

    // Ineligible action warning box
    let ineligibilityBoxHtml = '';
    if (!eligibility.eligible) {
      ineligibilityBoxHtml = `
        <div class="eligibility-box error-box">
          <span class="error-icon">⚠</span>
          <span class="error-msg">${eligibility.reason}</span>
        </div>
        <div class="ineligible-action-wrap">
          <button type="button" class="btn-secondary" id="btn-ch-go-garage">OPEN GARAGE TO SWITCH / BUY VEHICLE →</button>
        </div>
      `;
    }

    // Reputation display: Shows 20% on replayed events
    const repRewardValue = isCompleted
      ? Math.floor(event.reputationReward * 0.20)
      : event.reputationReward;
    const repSubLabel = isCompleted ? '<span class="rep-replay-note">(REPLAY 20%)</span>' : '';

    const diffDisplay = event.aiDifficulty.replace('_', ' ').toUpperCase();

    card.innerHTML = `
      <!-- Event Header with AI Difficulty Badge -->
      <div class="detail-header-block">
        <div class="detail-eyebrow-row">
          <span class="detail-circuit-name">${event.subtitle}</span>
          <span class="difficulty-pill diff-${event.aiDifficulty}">DIFFICULTY // ${diffDisplay}</span>
        </div>
        <h2 class="detail-event-title">${event.name}</h2>
        <p class="detail-event-desc">${event.description}</p>
      </div>

      <!-- Row A — Reward Summary Strip -->
      <div class="row-rewards">
        <div class="detail-tile">
          <span class="tile-label">CREDIT REWARD</span>
          <span class="reward-value cr tabular-nums">${event.rewards.gold.toLocaleString()} CR</span>
        </div>
        <div class="detail-tile">
          <span class="tile-label">REPUTATION REWARD</span>
          <span class="reward-value rep tabular-nums">+${repRewardValue.toLocaleString()} REP ${repSubLabel}</span>
        </div>
      </div>

      ${bestRecordHtml}

      <!-- Row B — Trophies & Objectives -->
      <div class="detail-tile">
        <span class="tile-label">TARGET BENCHMARKS &amp; TROPHIES</span>
        <div class="benchmark-list">
          ${benchmarkRowsHtml}
        </div>
      </div>

      <div class="detail-tile">
        <span class="tile-label">BONUS PERFORMANCE OBJECTIVES</span>
        <div class="objective-list">
          ${objectivesHtml}
        </div>
      </div>

      ${ineligibilityBoxHtml}
    `;

    document.getElementById('btn-ch-go-garage')?.addEventListener('click', () => {
      this.triggerGarage();
    });

    // Update CTA button in Zone 4 based on selection & eligibility
    const btnStart = document.getElementById('btn-ch-start-event') as HTMLButtonElement | null;
    if (btnStart) {
      if (!isUnlocked) {
        btnStart.textContent = 'EVENT LOCKED';
        btnStart.disabled = true;
      } else if (!eligibility.eligible) {
        btnStart.textContent = 'INELIGIBLE VEHICLE';
        btnStart.disabled = true;
      } else if (isCompleted) {
        btnStart.textContent = 'REPLAY CAREER EVENT →';
        btnStart.disabled = false;
      } else {
        btnStart.textContent = 'START CAREER EVENT →';
        btnStart.disabled = false;
      }
    }
  }

  private handleStartClick(): void {
    const career = CareerManager.getInstance();
    const event = CAREER_EVENTS.find((e) => e.id === this.selectedEventId);
    if (!event) return;

    const isUnlocked = career.isEventUnlocked(event.id);
    const vehicle = getVehicleById(career.getSelectedVehicleId()) || VEHICLE_CATALOG[0];
    const eligibility = career.validateVehicleEligibility(event, vehicle);

    if (isUnlocked && eligibility.eligible) {
      this.triggerStartEvent(event);
    }
  }

  private triggerStartEvent(event: CareerEventDefinition): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onStartEvent(event);
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerGarage(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onOpenGarage();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerBack(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onBack();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'Escape' || e.code === 'KeyB') {
      e.preventDefault();
      this.triggerBack();
    } else if (e.code === 'KeyG') {
      e.preventDefault();
      this.triggerGarage();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.handleStartClick();
    } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
      e.preventDefault();
      const tierNum = parseInt(e.code.replace('Digit', ''), 10);
      if (tierNum >= 1 && tierNum <= 5) {
        this.selectTier(tierNum);
      }
    }
  }

  public show(autoRecommend: boolean = false): void {
    if (!this.container) return;
    this.isVisible = true;
    this.isNavigating = false;
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    // Refresh state
    const career = CareerManager.getInstance();
    career.refreshUnlocks();

    // Auto-select next recommended event if returning from race or initial entry
    if (autoRecommend) {
      const nextId = career.getNextRecommendedEventId();
      if (nextId) {
        const nextEv = CAREER_EVENTS.find(e => e.id === nextId);
        if (nextEv) {
          this.selectedTier = nextEv.tier;
          this.selectedEventId = nextId;
        }
      }
    }

    this.render();

    const btnStart = document.getElementById('btn-ch-start-event');
    if (btnStart && !btnStart.hasAttribute('disabled')) {
      btnStart.focus();
    }
  }

  public hide(): void {
    if (!this.container) return;
    this.isVisible = false;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = null;
    }
    const tooltip = document.getElementById('career-locked-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
    this.container.classList.add('hidden');
    window.removeEventListener('keydown', this.boundKeyDown);
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    this.container?.remove();
    this.container = null;
  }
}
