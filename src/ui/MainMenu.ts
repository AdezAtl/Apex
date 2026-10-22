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
        <div class="brand-cluster">
          <span class="brand-tag">MOTORSPORT SIMULATION</span>
          <h1 class="brand-title">PROJECT APEX <span class="accent-slash">//</span></h1>
          <p class="brand-subtitle">FOREST VALLEY CIRCUIT • APX-01 COUPE</p>
        </div>

        <div class="menu-actions">
          <button id="btn-menu-career" class="apex-btn career-gold-btn full-width">
            <span class="btn-text">🏆 CAREER CHAMPIONSHIP</span>
          </button>
          <button id="btn-menu-play" class="apex-btn primary-btn full-width" autofocus>
            <span class="btn-text">🏁 FREE PLAY / ARCADE</span>
          </button>
          <button id="btn-menu-multiplayer" class="apex-btn cyan-btn full-width">
            <span class="btn-text">🌐 LAN MULTIPLAYER</span>
          </button>
          <button id="btn-menu-garage" class="apex-btn secondary-btn full-width">
            <span class="btn-text">GARAGE & SHOWROOM</span>
          </button>
          <button id="btn-menu-settings" class="apex-btn secondary-btn full-width">
            <span class="btn-text">SETTINGS</span>
          </button>
          <button id="btn-menu-exit" class="apex-btn tertiary-btn full-width">
            <span class="btn-text">EXIT GAME</span>
          </button>
        </div>

        <div class="menu-footer">
          <span class="version-tag">RELEASE CANDIDATE 1.0.0 • 60 FPS ENGINE</span>
          <span class="keyboard-hint-bar">[C] CAREER • [ENTER] FREE PLAY • [M] MULTIPLAYER • [G] GARAGE • [S] SETTINGS</span>
        </div>
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
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      this.triggerPlay();
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
