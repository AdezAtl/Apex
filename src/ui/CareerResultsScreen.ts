import { CareerEventDefinition, getTierInfo } from '../career/CareerConfig';
import { EventCompletionResult, CareerMedal } from '../career/CareerManager';

export interface CareerResultsScreenCallbacks {
  onContinue: () => void;
  onRetry: () => void;
  onWatchReplay?: () => void;
}

export class CareerResultsScreen {
  private container: HTMLElement | null = null;
  private callbacks: CareerResultsScreenCallbacks;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(callbacks: CareerResultsScreenCallbacks) {
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('career-results-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'career-results-overlay';
    this.container.className = 'menu-overlay hidden';

    this.container.innerHTML = `
      <div class="menu-card career-results-card">
        <!-- Header -->
        <div class="panel-header text-center">
          <span id="cr-tier-badge" class="panel-badge gold-badge">TIER 1 // ROOKIE CIRCUIT</span>
          <h2 id="cr-event-title" class="panel-title large-title">ROOKIE DEBUT SPRINT</h2>
          <span id="cr-event-subtitle" class="event-subtitle">Forest Valley Circuit • 420m Sprint</span>
        </div>

        <!-- Medal & Finish Position Stamp -->
        <div class="cr-medal-banner-wrap">
          <div id="cr-medal-stamp" class="cr-medal-stamp gold-stamp">
            <span id="cr-medal-text" class="cr-medal-text">GOLD TROPHY</span>
            <span id="cr-position-text" class="cr-position-text">1ST PLACE</span>
          </div>
        </div>

        <!-- Performance Metrics Row -->
        <div class="cr-metrics-row">
          <div class="cr-metric-tile">
            <span id="cr-metric-label" class="cr-label">RACE TIME</span>
            <span id="cr-metric-val" class="cr-val">00:18.42</span>
          </div>
          <div class="cr-metric-tile">
            <span class="cr-label">REPUTATION EARNED</span>
            <span id="cr-rep-val" class="cr-val text-cyan">+150 REP</span>
          </div>
        </div>

        <!-- Credits Earnings Breakdown Card -->
        <div class="cr-earnings-box">
          <div class="cr-earnings-header">
            <span class="cr-box-title">PRIZE PURSE & BONUSES</span>
            <span id="cr-total-credits" class="cr-total-credits">+4,500 CR</span>
          </div>
          <div class="cr-breakdown-list">
            <div class="cr-breakdown-row">
              <span class="cr-row-label">Base Medal Reward:</span>
              <span id="cr-base-credits" class="cr-row-val">+3,000 CR</span>
            </div>
            <div id="cr-objectives-container" class="cr-objectives-container">
              <!-- Injected dynamically -->
            </div>
          </div>
        </div>

        <!-- Unlocks Banner (if any) -->
        <div id="cr-unlock-alert" class="cr-unlock-alert hidden">
          <span class="cr-unlock-icon">🔓</span>
          <span id="cr-unlock-text" class="cr-unlock-text">NEW EVENT UNLOCKED!</span>
        </div>

        <!-- Actions -->
        <div class="cr-actions">
          <button id="btn-cr-continue" class="apex-btn primary-btn full-width" autofocus>
            <span class="btn-text">CONTINUE TO CAREER HUB →</span>
          </button>
          <button id="btn-cr-retry" class="apex-btn secondary-btn full-width">
            <span class="btn-text">RETRY EVENT</span>
          </button>
          <button id="btn-cr-replay" class="apex-btn tertiary-btn full-width hidden">
            <span class="btn-text">WATCH REPLAY HIGHLIGHT</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    document.getElementById('btn-cr-continue')?.addEventListener('click', () => this.triggerContinue());
    document.getElementById('btn-cr-retry')?.addEventListener('click', () => this.triggerRetry());
    document.getElementById('btn-cr-replay')?.addEventListener('click', () => this.triggerReplay());
  }

  private triggerContinue(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.hide();
    this.callbacks.onContinue();
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  private triggerRetry(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.hide();
    this.callbacks.onRetry();
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  private triggerReplay(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    if (this.callbacks.onWatchReplay) {
      this.callbacks.onWatchReplay();
    }
    setTimeout(() => {
      this.isNavigating = false;
    }, 300);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.triggerContinue();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      this.triggerRetry();
    }
  }

  public show(
    event: CareerEventDefinition,
    resultValue: number,
    rewards: EventCompletionResult,
    positionDisplay?: string,
    hasReplayData: boolean = false
  ): void {
    if (!this.container) return;
    this.isVisible = true;
    this.isNavigating = false;
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    const tierInfo = getTierInfo(event.tier);

    // Header updates
    const tierBadge = document.getElementById('cr-tier-badge');
    if (tierBadge) {
      tierBadge.textContent = `TIER ${event.tier} // ${tierInfo.name.toUpperCase()}`;
      tierBadge.style.borderColor = tierInfo.colorHex;
      tierBadge.style.color = tierInfo.colorHex;
    }

    const titleEl = document.getElementById('cr-event-title');
    if (titleEl) titleEl.textContent = event.name.toUpperCase();

    const subEl = document.getElementById('cr-event-subtitle');
    if (subEl) subEl.textContent = event.subtitle;

    // Medal & Stamp
    const stampEl = document.getElementById('cr-medal-stamp');
    const medalText = document.getElementById('cr-medal-text');
    const posText = document.getElementById('cr-position-text');

    if (stampEl && medalText && posText) {
      stampEl.className = `cr-medal-stamp ${rewards.medal}-stamp`;
      const MEDAL_NAMES: Record<CareerMedal, string> = {
        gold: '★ GOLD VICTORY ★',
        silver: '★ SILVER PODIUM ★',
        bronze: '★ BRONZE PODIUM ★',
        completed: '✓ EVENT FINISHED',
      };
      medalText.textContent = MEDAL_NAMES[rewards.medal];
      posText.textContent = positionDisplay || (event.mode === 'drift' ? 'TARGET ACHIEVED' : 'COMPLETED');
    }

    // Metrics Row
    const metricLabel = document.getElementById('cr-metric-label');
    const metricVal = document.getElementById('cr-metric-val');
    if (metricLabel && metricVal) {
      if (event.mode === 'drift') {
        metricLabel.textContent = 'TOTAL DRIFT SCORE';
        metricVal.textContent = `${Math.round(resultValue).toLocaleString()} PTS`;
      } else {
        metricLabel.textContent = 'FINAL RACE TIME';
        const mins = Math.floor(resultValue / 60);
        const secs = (resultValue % 60).toFixed(2);
        metricVal.textContent = `${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`;
      }
    }

    const repVal = document.getElementById('cr-rep-val');
    if (repVal) {
      if (rewards.isReplay) {
        repVal.textContent = `+${rewards.reputationEarned} REP (REPLAY 20%)`;
      } else {
        repVal.textContent = `+${rewards.reputationEarned} REP`;
      }
    }

    // Credits Breakdown
    const totalCr = document.getElementById('cr-total-credits');
    if (totalCr) totalCr.textContent = `+${rewards.totalCredits.toLocaleString()} CR`;

    const baseCr = document.getElementById('cr-base-credits');
    if (baseCr) baseCr.textContent = `+${rewards.baseCredits.toLocaleString()} CR`;

    const objContainer = document.getElementById('cr-objectives-container');
    if (objContainer) {
      if (rewards.completedObjectives.length > 0) {
        objContainer.innerHTML = rewards.completedObjectives
          .map(
            (obj) => `
            <div class="cr-breakdown-row objective-row">
              <span class="cr-row-label">✓ ${obj.description}</span>
              <span class="cr-row-val">+${obj.bonusCredits.toLocaleString()} CR</span>
            </div>
          `
          )
          .join('');
      } else {
        objContainer.innerHTML = '';
      }
    }

    // Unlocks Alert
    const unlockAlert = document.getElementById('cr-unlock-alert');
    const unlockText = document.getElementById('cr-unlock-text');
    if (unlockAlert && unlockText) {
      const unlockNotices: string[] = [];
      if (rewards.newUnlockedTier) {
        unlockNotices.push(`NEW TIER UNLOCKED: ${rewards.newUnlockedTier.name.toUpperCase()}!`);
      }
      if (rewards.newUnlockedEvents.length > 0) {
        unlockNotices.push(`${rewards.newUnlockedEvents.length} NEW EVENT(S) AVAILABLE!`);
      }
      if (rewards.newUnlockedVehicles.length > 0) {
        unlockNotices.push(`NEW CHASSIS UNLOCKED: ${rewards.newUnlockedVehicles.join(', ')}!`);
      }

      if (unlockNotices.length > 0) {
        unlockAlert.classList.remove('hidden');
        unlockText.textContent = unlockNotices.join(' • ');
      } else {
        unlockAlert.classList.add('hidden');
      }
    }

    // Replay button visibility
    const replayBtn = document.getElementById('btn-cr-replay');
    if (replayBtn) {
      replayBtn.classList.toggle('hidden', !hasReplayData);
    }

    const continueBtn = document.getElementById('btn-cr-continue');
    continueBtn?.focus();
  }

  public hide(): void {
    if (!this.container) return;
    this.isVisible = false;
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
