export interface MainMenuCallbacks {
  onPlay: () => void;
  onCareer?: () => void;
  onMultiplayer?: () => void;
  onGarage: () => void;
  onSettings: () => void;
  onExit: () => void;
}

export class MainMenu {
  private container: HTMLElement | null = null;
  private callbacks: MainMenuCallbacks;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(callbacks: MainMenuCallbacks) {
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('main-menu-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'main-menu-overlay';
    this.container.className = 'menu-overlay hidden';

    this.container.innerHTML = `
      <div class="menu-card main-menu-card">
        <header class="brand-cluster">
          <div class="brand-badge-row">
            <span class="brand-tag">
              <span class="brand-tag-dot"></span>
              MOTORSPORT SIMULATION
            </span>
          </div>
          <h1 class="brand-title">PROJECT APEX<span class="accent-slash"> //</span></h1>
          <p class="brand-subtitle">GRAND TOURING & HYPERCAR RACING • WEBGL 3D</p>
        </header>

        <nav class="menu-actions" aria-label="Main Menu Actions">
          <button id="btn-menu-career" class="apex-btn career-gold-btn full-width">
            <span class="btn-inner-left">
              <svg class="menu-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
                <path d="M4 22h16"></path>
                <path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34"></path>
                <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-12 0V6a2 2 0 0 1 2-2Z"></path>
              </svg>
              <span class="btn-text">CAREER CHAMPIONSHIP</span>
            </span>
            <span class="btn-inner-chevron">›</span>
          </button>

          <button id="btn-menu-play" class="apex-btn primary-btn full-width" autofocus>
            <span class="btn-inner-left">
              <svg class="menu-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
              <span class="btn-text">FREE PLAY / ARCADE</span>
            </span>
            <span class="btn-inner-chevron">›</span>
          </button>

          <button id="btn-menu-multiplayer" class="apex-btn cyan-btn full-width">
            <span class="btn-inner-left">
              <svg class="menu-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
              <span class="btn-text">LAN MULTIPLAYER</span>
            </span>
            <span class="btn-inner-chevron">›</span>
          </button>

          <button id="btn-menu-garage" class="apex-btn secondary-btn full-width">
            <span class="btn-inner-left">
              <svg class="menu-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 14 3-3"></path>
                <path d="M3.34 19a10 10 0 1 1 17.32 0"></path>
              </svg>
              <span class="btn-text">GARAGE & SHOWROOM</span>
            </span>
            <span class="btn-inner-chevron">›</span>
          </button>

          <button id="btn-menu-settings" class="apex-btn secondary-btn full-width">
            <span class="btn-inner-left">
              <svg class="menu-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="4" y1="21" x2="4" y2="14"></line>
                <line x1="4" y1="10" x2="4" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12" y2="3"></line>
                <line x1="20" y1="21" x2="20" y2="16"></line>
                <line x1="20" y1="12" x2="20" y2="3"></line>
                <line x1="1" y1="14" x2="7" y2="14"></line>
                <line x1="9" y1="8" x2="15" y2="8"></line>
                <line x1="17" y1="16" x2="23" y2="16"></line>
              </svg>
              <span class="btn-text">SETTINGS</span>
            </span>
            <span class="btn-inner-chevron">›</span>
          </button>

          <button id="btn-menu-exit" class="apex-btn tertiary-btn full-width">
            <span class="btn-inner-left">
              <svg class="menu-btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span class="btn-text">EXIT GAME</span>
            </span>
            <span class="btn-inner-chevron">›</span>
          </button>
        </nav>

        <footer class="menu-footer">
          <div class="footer-ticker">
            <span class="ticker-badge">INPUT</span>
            <span class="keyboard-hint-bar">[C] CAREER • [ENTER] FREE PLAY • [M] MULTIPLAYER • [G] GARAGE • [S] SETTINGS</span>
          </div>
          <div class="footer-meta">
            <span class="version-tag">RELEASE CANDIDATE 1.0.0 • 60 FPS ENGINE</span>
          </div>
        </footer>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    const btnCareer = document.getElementById('btn-menu-career');
    const btnPlay = document.getElementById('btn-menu-play');
    const btnMultiplayer = document.getElementById('btn-menu-multiplayer');
    const btnGarage = document.getElementById('btn-menu-garage');
    const btnSettings = document.getElementById('btn-menu-settings');
    const btnExit = document.getElementById('btn-menu-exit');

    btnCareer?.addEventListener('click', () => {
      this.triggerCareer();
    });

    btnPlay?.addEventListener('click', () => {
      this.triggerPlay();
    });

    btnMultiplayer?.addEventListener('click', () => {
      this.triggerMultiplayer();
    });

    btnGarage?.addEventListener('click', () => {
      this.triggerGarage();
    });

    btnSettings?.addEventListener('click', () => {
      this.triggerSettings();
    });

    btnExit?.addEventListener('click', () => {
      this.triggerExit();
    });
  }

  private triggerCareer(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    if (this.callbacks.onCareer) {
      this.callbacks.onCareer();
    } else {
      this.callbacks.onPlay();
    }
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerPlay(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onPlay();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerMultiplayer(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    if (this.callbacks.onMultiplayer) {
      this.callbacks.onMultiplayer();
    }
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerGarage(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onGarage();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerSettings(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onSettings();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private triggerExit(): void {
    if (this.isNavigating) return;
    this.callbacks.onExit();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'KeyC' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.triggerCareer();
    } else if (e.code === 'KeyM' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.triggerMultiplayer();
    } else if (e.code === 'KeyG' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.triggerGarage();
    } else if (e.code === 'KeyS' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      this.triggerSettings();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.triggerExit();
    }
  }

  public show(): void {
    if (!this.container) return;
    this.isVisible = true;
    this.isNavigating = false;
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    // Focus play button
    const btnPlay = document.getElementById('btn-menu-play');
    btnPlay?.focus();
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
