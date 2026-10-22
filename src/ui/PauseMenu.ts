export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onReturnToMenu: () => void;
  onReturnToStart?: () => void;
}

export class PauseMenu {
  private overlay: HTMLElement | null = null;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;
  private callbacks: PauseMenuCallbacks;
  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(callbacks: PauseMenuCallbacks) {
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('pause-overlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'pause-overlay';
    this.overlay.className = 'pause-overlay hidden';

    this.overlay.innerHTML = `
      <div class="pause-card">
        <h2 class="pause-title">EVENT PAUSED</h2>
        <div class="pause-menu-items">
          <button id="btn-resume" class="pause-btn primary" autofocus>RESUME</button>
          <button id="btn-restart" class="pause-btn">RESTART EVENT</button>
          <button id="btn-pause-settings" class="pause-btn">SETTINGS</button>
          <button id="btn-pause-menu" class="pause-btn danger">ABANDON EVENT & RETURN</button>
        </div>
        <p class="pause-hint">[ESC] TO RESUME • ABANDONING DISCARDS PROGRESS</p>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.overlay);

    document.getElementById('btn-resume')?.addEventListener('click', () => {
      this.triggerResume();
    });

    document.getElementById('btn-restart')?.addEventListener('click', () => {
      this.triggerRestart();
    });

    document.getElementById('btn-pause-settings')?.addEventListener('click', () => {
      this.triggerSettings();
    });

    document.getElementById('btn-pause-menu')?.addEventListener('click', () => {
      this.triggerMenu();
    });
  }

  private triggerResume(): void {
    if (this.isNavigating) return;
    this.callbacks.onResume();
  }

  private triggerRestart(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onRestart();
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
      this.triggerResume();
    }
  }

  public setMultiplayerMode(isMultiplayer: boolean): void {
    const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement | null;
    const btnMenu = document.getElementById('btn-pause-menu');
    const hint = this.overlay?.querySelector('.pause-hint');

    if (btnRestart) {
      btnRestart.disabled = isMultiplayer;
      btnRestart.textContent = isMultiplayer ? 'RESTART UNAVAILABLE (MULTIPLAYER)' : 'RESTART EVENT';
      btnRestart.style.opacity = isMultiplayer ? '0.4' : '1.0';
      btnRestart.style.cursor = isMultiplayer ? 'not-allowed' : 'pointer';
    }

    if (btnMenu) {
      btnMenu.textContent = isMultiplayer ? 'LEAVE MULTIPLAYER RACE' : 'ABANDON EVENT & RETURN';
    }

    if (hint) {
      hint.textContent = isMultiplayer
        ? '[ESC] TO RESUME • RACE CONTINUES IN BACKGROUND'
        : '[ESC] TO RESUME • ABANDONING DISCARDS PROGRESS';
    }
  }

  public show(): void {
    if (!this.overlay) return;
    this.isVisible = true;
    this.isNavigating = false;
    this.overlay.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    const btnResume = document.getElementById('btn-resume');
    btnResume?.focus();
  }

  public hide(): void {
    if (!this.overlay) return;
    this.isVisible = false;
    this.overlay.classList.add('hidden');
    window.removeEventListener('keydown', this.boundKeyDown);
  }

  public getIsOpen(): boolean {
    return this.isVisible;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    this.overlay?.remove();
    this.overlay = null;
  }
}
