import { RecordManager } from '../records/RecordManager';
import { RaceEventConfig, DEFAULT_EVENT } from '../events/EventConfig';

export interface FinishScreenCallbacks {
  onRetry: () => void;
  onWatchReplay?: () => void;
  onEventSelect: () => void;
  onReturnToMenu: () => void;
}

export class FinishScreen {
  private container: HTMLElement | null = null;
  private callbacks: FinishScreenCallbacks;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;

  private panelBadgeElement: HTMLElement | null = null;
  private panelTitleElement: HTMLElement | null = null;
  private eventSubtitleElement: HTMLElement | null = null;
  private finalTimeLabelElement: HTMLElement | null = null;
  private finalTimeElement: HTMLElement | null = null;
  private bestTimeLabelElement: HTMLElement | null = null;
  private bestTimeElement: HTMLElement | null = null;
  private positionTileElement: HTMLElement | null = null;
  private positionValueElement: HTMLElement | null = null;
  private newRecordBanner: HTMLElement | null = null;
  private retryBtnTextElement: HTMLElement | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(callbacks: FinishScreenCallbacks) {
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('finish-screen-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'finish-screen-overlay';
    this.container.className = 'menu-overlay hidden';

    this.container.innerHTML = `
      <div class="menu-card finish-card">
        <div class="panel-header text-center">
          <span id="finish-badge" class="panel-badge gold-badge">SESSION COMPLETE // TIME ATTACK</span>
          <h2 id="finish-title" class="panel-title large-title">TIME TRIAL FINISHED</h2>
          <span id="finish-subtitle" class="event-subtitle">Apex Circuit • Forest Valley Loop (220m)</span>
        </div>

        <div id="new-record-banner" class="new-record-banner hidden">
          ★ NEW PERSONAL BEST RECORD! ★
        </div>

        <div class="results-grid">
          <div class="result-tile primary-tile">
            <span id="finish-time-label" class="result-label">FINAL LAP TIME</span>
            <span id="finish-final-time" class="result-value big-time">00:00.00</span>
          </div>

          <div class="result-tile">
            <span id="finish-best-label" class="result-label">PERSONAL BEST</span>
            <span id="finish-best-time" class="result-value">00:00.00</span>
          </div>

          <div id="finish-position-tile" class="result-tile highlight-tile hidden">
            <span class="result-label">GRID FINISH POSITION</span>
            <span id="finish-position-value" class="result-value highlight">1ST / 4</span>
          </div>
        </div>

        <div class="finish-actions">
          <button id="btn-finish-retry" class="apex-btn primary-btn full-width" autofocus>
            <span id="finish-retry-text" class="btn-text">RETRY TIME TRIAL</span>
          </button>
          <button id="btn-finish-replay" class="apex-btn secondary-btn full-width">
            <span class="btn-text">WATCH REPLAY HIGHLIGHT</span>
          </button>
          <button id="btn-finish-events" class="apex-btn secondary-btn full-width">
            <span class="btn-text">EVENT SELECTION</span>
          </button>
          <button id="btn-finish-menu" class="apex-btn tertiary-btn full-width">
            <span class="btn-text">RETURN TO MAIN MENU</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    this.panelBadgeElement = document.getElementById('finish-badge');
    this.panelTitleElement = document.getElementById('finish-title');
    this.eventSubtitleElement = document.getElementById('finish-subtitle');
    this.finalTimeLabelElement = document.getElementById('finish-time-label');
    this.finalTimeElement = document.getElementById('finish-final-time');
    this.bestTimeLabelElement = document.getElementById('finish-best-label');
    this.bestTimeElement = document.getElementById('finish-best-time');
    this.positionTileElement = document.getElementById('finish-position-tile');
    this.positionValueElement = document.getElementById('finish-position-value');
    this.newRecordBanner = document.getElementById('new-record-banner');
    this.retryBtnTextElement = document.getElementById('finish-retry-text');

    document.getElementById('btn-finish-retry')?.addEventListener('click', () => {
      this.triggerRetry();
    });

    document.getElementById('btn-finish-replay')?.addEventListener('click', () => {
      this.triggerReplay();
    });

    document.getElementById('btn-finish-events')?.addEventListener('click', () => {
      this.triggerEventSelect();
    });

    document.getElementById('btn-finish-menu')?.addEventListener('click', () => {
      this.triggerMenu();
    });
  }

  private triggerReplay(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    if (this.callbacks.onWatchReplay) {
      this.callbacks.onWatchReplay();
    }
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerRetry(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onRetry();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerEventSelect(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onEventSelect();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerMenu(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onReturnToMenu();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'Escape') {
      e.preventDefault();
      this.triggerMenu();
    }
  }

  public show(
    finalResultValue: number,
    event: RaceEventConfig = DEFAULT_EVENT,
    positionDisplay?: string
  ): void {
    if (!this.container) return;

    const isDrift = event.mode === 'drift';
    const isSpeedTrap = event.mode === 'speed_trap';
    const isScoreBased = isDrift || isSpeedTrap;
    const result = isScoreBased
      ? RecordManager.saveScore(event.id, finalResultValue)
      : RecordManager.saveTime(event.id, finalResultValue);

    if (this.panelBadgeElement) {
      this.panelBadgeElement.textContent = `SESSION COMPLETE // ${event.badgeText}`;
    }

    if (this.panelTitleElement) {
      this.panelTitleElement.textContent = `${event.name.toUpperCase()} FINISHED`;
    }

    if (this.eventSubtitleElement) {
      this.eventSubtitleElement.textContent = event.subtitle;
    }

    if (this.finalTimeLabelElement) {
      if (isDrift) {
        this.finalTimeLabelElement.textContent = 'TOTAL DRIFT SCORE';
      } else if (event.mode === 'sprint') {
        this.finalTimeLabelElement.textContent = 'FINAL SPRINT TIME';
      } else if (event.mode === 'elimination') {
        this.finalTimeLabelElement.textContent = 'SURVIVAL TIME';
      } else if (event.mode === 'pursuit') {
        this.finalTimeLabelElement.textContent = 'PURSUIT TIME';
      } else if (event.mode === 'speed_trap') {
        this.finalTimeLabelElement.textContent = 'COMBINED TRAP VELOCITY';
      } else {
        this.finalTimeLabelElement.textContent = 'FINAL LAP TIME';
      }
    }

    if (this.bestTimeLabelElement) {
      if (isDrift) {
        this.bestTimeLabelElement.textContent = 'BEST DRIFT SCORE';
      } else if (event.mode === 'speed_trap') {
        this.bestTimeLabelElement.textContent = 'BEST RECORDED VELOCITY';
      } else {
        this.bestTimeLabelElement.textContent = 'PERSONAL BEST';
      }
    }

    if (this.retryBtnTextElement) {
      if (isDrift) {
        this.retryBtnTextElement.textContent = 'RETRY DRIFT CHALLENGE';
      } else if (event.mode === 'sprint') {
        this.retryBtnTextElement.textContent = 'RETRY SPRINT';
      } else if (event.mode === 'elimination') {
        this.retryBtnTextElement.textContent = 'RETRY ELIMINATION';
      } else if (event.mode === 'pursuit') {
        this.retryBtnTextElement.textContent = 'RETRY PURSUIT';
      } else if (event.mode === 'speed_trap') {
        this.retryBtnTextElement.textContent = 'RETRY SPEED TRAP';
      } else {
        this.retryBtnTextElement.textContent = 'RETRY TIME TRIAL';
      }
    }

    if (this.finalTimeElement) {
      if (isDrift) {
        this.finalTimeElement.textContent = RecordManager.formatScore(finalResultValue);
      } else if (event.mode === 'speed_trap') {
        this.finalTimeElement.textContent = `${Math.round(finalResultValue)} KM/H`;
      } else {
        this.finalTimeElement.textContent = RecordManager.formatTime(finalResultValue);
      }
    }

    if (this.bestTimeElement) {
      if (isDrift) {
        this.bestTimeElement.textContent = RecordManager.formatScore(result.bestTime);
      } else if (event.mode === 'speed_trap') {
        this.bestTimeElement.textContent = `${Math.round(result.bestTime)} KM/H`;
      } else {
        this.bestTimeElement.textContent = RecordManager.formatTime(result.bestTime);
      }
    }

    if (this.positionTileElement) {
      if (!isDrift && positionDisplay) {
        this.positionTileElement.classList.remove('hidden');
        if (this.positionValueElement) {
          this.positionValueElement.textContent = positionDisplay;
        }
      } else {
        this.positionTileElement.classList.add('hidden');
      }
    }

    if (this.newRecordBanner) {
      if (result.isNewRecord) {
        this.newRecordBanner.textContent = isDrift
          ? '★ NEW DRIFT HIGH SCORE RECORD! ★'
          : '★ NEW PERSONAL BEST RECORD! ★';
        this.newRecordBanner.classList.remove('hidden');
      } else {
        this.newRecordBanner.classList.add('hidden');
      }
    }

    this.isVisible = true;
    this.isNavigating = false;
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    const btnRetry = document.getElementById('btn-finish-retry');
    btnRetry?.focus();
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
