export interface InputState {
  forward: boolean;
  backward: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
  reset: boolean;
  toggleCamera: boolean;
  pause: boolean;
}

export class InputManager {
  private keys: Set<string> = new Set();
  private touchActions: Set<keyof InputState> = new Set();

  private pendingReset: boolean = false;
  private pendingToggleCamera: boolean = false;
  private pendingPause: boolean = false;

  private touchEnabled: boolean = false;
  private touchContainer: HTMLElement | null = null;
  private toggleBtn: HTMLButtonElement | null = null;

  constructor() {
    this.bindKeyboardEvents();
    this.initMobileTouchControls();
  }

  private detectSmallOrTouchScreen(): boolean {
    const isSmallViewport = window.innerWidth <= 920 || window.innerHeight <= 600;
    const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return isSmallViewport || isCoarsePointer;
  }

  private bindKeyboardEvents(): void {
    window.addEventListener('keydown', (e) => {
      // Ignore shortcuts if user is typing in an input box (e.g. LAN Lobby name/IP)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      const code = e.code;
      this.keys.add(code);

      if (code === 'KeyR') this.pendingReset = true;
      if (code === 'KeyC') this.pendingToggleCamera = true;
      if (code === 'Escape' || code === 'KeyP') this.pendingPause = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.clearAll();
    });
  }

  private initMobileTouchControls(): void {
    this.injectTouchStyles();

    // Auto-enable only if small screen factor / coarse touch screen is detected
    this.touchEnabled = this.detectSmallOrTouchScreen();

    // 1. Unobtrusive Top-Right Toggle Pill (Never blocks road or HUD)
    const existingBtn = document.getElementById('apex-touch-toggle-btn');
    if (existingBtn) existingBtn.remove();

    this.toggleBtn = document.createElement('button');
    this.toggleBtn.id = 'apex-touch-toggle-btn';
    this.toggleBtn.type = 'button';
    this.toggleBtn.title = 'Toggle On-Screen Touch Controls';
    this.updateToggleButtonLabel();

    this.toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.setTouchControlsEnabled(!this.touchEnabled);
      this.toggleBtn?.blur();
    });

    document.body.appendChild(this.toggleBtn);

    // 2. Touch Controls Overlay Container
    const existingPad = document.getElementById('apex-mobile-touch-controls');
    if (existingPad) existingPad.remove();

    this.touchContainer = document.createElement('div');
    this.touchContainer.id = 'apex-mobile-touch-controls';
    this.touchContainer.className = this.touchEnabled ? 'touch-visible' : 'touch-hidden';

    this.touchContainer.innerHTML = `
      <!-- Top Utility Mini-Pills (Reset, Camera, Pause) -->
      <div class="apex-touch-utility-bar">
        <button type="button" class="apex-touch-util-btn" data-action="reset">↻ RESET</button>
        <button type="button" class="apex-touch-util-btn" data-action="toggleCamera">🎥 CAM</button>
        <button type="button" class="apex-touch-util-btn" data-action="pause">⏸ PAUSE</button>
      </div>

      <!-- Left Thumb Cluster: Steer Left & Steer Right -->
      <div class="apex-touch-cluster left-cluster">
        <button type="button" class="apex-touch-pad steer-btn" data-action="steerLeft" aria-label="Steer Left">◀</button>
        <button type="button" class="apex-touch-pad steer-btn" data-action="steerRight" aria-label="Steer Right">▶</button>
      </div>

      <!-- Right Thumb Cluster: Drift, Brake/Rev, Gas -->
      <div class="apex-touch-cluster right-cluster">
        <button type="button" class="apex-touch-pad drift-btn" data-action="handbrake">DRIFT</button>
        <button type="button" class="apex-touch-pad brake-btn" data-action="backward">BRAKE</button>
        <button type="button" class="apex-touch-pad gas-btn" data-action="forward">GAS</button>
      </div>
    `;

    document.body.appendChild(this.touchContainer);
    this.bindTouchButtons();

    // Re-check if screen is resized/rotated into mobile dimensions (unless manually toggled)
    window.addEventListener('resize', () => {
      if (this.toggleBtn?.dataset.manualOverride !== 'true') {
        this.setTouchControlsEnabled(this.detectSmallOrTouchScreen(), false);
      }
    });
  }

  private bindTouchButtons(): void {
    if (!this.touchContainer) return;

    const holdButtons = this.touchContainer.querySelectorAll<HTMLElement>('.apex-touch-pad');
    holdButtons.forEach((btn) => {
      const action = btn.dataset.action as keyof InputState;
      if (!action) return;

      const activate = (e: PointerEvent) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        this.touchActions.add(action);
        btn.classList.add('active-touch');
      };

      const deactivate = (e: PointerEvent) => {
        e.preventDefault();
        this.touchActions.delete(action);
        btn.classList.remove('active-touch');
      };

      btn.addEventListener('pointerdown', activate);
      btn.addEventListener('pointerup', deactivate);
      btn.addEventListener('pointercancel', deactivate);
      btn.addEventListener('lostpointercapture', () => {
        this.touchActions.delete(action);
        btn.classList.remove('active-touch');
      });
    });

    const utilButtons = this.touchContainer.querySelectorAll<HTMLElement>('.apex-touch-util-btn');
    utilButtons.forEach((btn) => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (action === 'reset') this.pendingReset = true;
        if (action === 'toggleCamera') this.pendingToggleCamera = true;
        if (action === 'pause') this.pendingPause = true;
      });
    });
  }

  public setTouchControlsEnabled(enabled: boolean, isManual: boolean = true): void {
    this.touchEnabled = enabled;
    if (!enabled) {
      this.touchActions.clear();
    }
    if (this.toggleBtn) {
      if (isManual) this.toggleBtn.dataset.manualOverride = 'true';
      this.updateToggleButtonLabel();
    }
    if (this.touchContainer) {
      this.touchContainer.className = enabled ? 'touch-visible' : 'touch-hidden';
    }
  }

  private updateToggleButtonLabel(): void {
    if (!this.toggleBtn) return;
    this.toggleBtn.textContent = this.touchEnabled ? '📱 TOUCH: ON' : '📱 TOUCH: OFF';
    this.toggleBtn.classList.toggle('is-active', this.touchEnabled);
  }

  private injectTouchStyles(): void {
    if (document.getElementById('apex-touch-styles')) return;
    const style = document.createElement('style');
    style.id = 'apex-touch-styles';
    style.textContent = `
      #apex-touch-toggle-btn {
        position: fixed;
        top: 10px;
        right: 12px;
        z-index: 9999;
        padding: 5px 11px;
        font-family: 'Orbitron', 'Rajdhani', sans-serif;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.78);
        background: rgba(10, 15, 26, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        backdrop-filter: blur(6px);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        transition: opacity 0.2s, border-color 0.2s, background 0.2s;
        opacity: 0.65;
      }
      #apex-touch-toggle-btn:hover,
      #apex-touch-toggle-btn.is-active {
        opacity: 0.95;
        border-color: rgba(0, 215, 255, 0.65);
        color: #00d7ff;
      }
      #apex-mobile-touch-controls.touch-hidden {
        display: none !important;
      }
      #apex-mobile-touch-controls.touch-visible {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 90;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      /* Auto-hide touch pads while any full-screen menu overlay is open */
      body:has(.menu-overlay:not(.hidden)) #apex-mobile-touch-controls {
        display: none !important;
      }
      .apex-touch-utility-bar {
        position: absolute;
        top: 44px;
        right: 12px;
        display: flex;
        gap: 6px;
        pointer-events: auto;
      }
      .apex-touch-util-btn {
        padding: 5px 10px;
        font-family: 'Orbitron', 'Rajdhani', sans-serif;
        font-size: 10px;
        font-weight: 700;
        color: #e2e8f0;
        background: rgba(12, 18, 30, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 6px;
        backdrop-filter: blur(4px);
      }
      .apex-touch-cluster {
        position: absolute;
        bottom: 22px;
        display: flex;
        align-items: flex-end;
        gap: 12px;
        pointer-events: auto;
      }
      .apex-touch-cluster.left-cluster {
        left: 20px;
      }
      .apex-touch-cluster.right-cluster {
        right: 20px;
      }
      .apex-touch-pad {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Orbitron', 'Rajdhani', sans-serif;
        font-weight: 800;
        color: rgba(255, 255, 255, 0.9);
        background: rgba(14, 22, 36, 0.45);
        border: 2px solid rgba(255, 255, 255, 0.24);
        border-radius: 16px;
        backdrop-filter: blur(4px);
        touch-action: none;
        transition: transform 0.06s, background 0.1s, border-color 0.1s;
      }
      .apex-touch-pad.steer-btn {
        width: 72px;
        height: 72px;
        font-size: 24px;
      }
      .apex-touch-pad.drift-btn {
        width: 64px;
        height: 60px;
        font-size: 12px;
        border-color: rgba(245, 158, 11, 0.45);
        color: #fbbf24;
      }
      .apex-touch-pad.brake-btn {
        width: 68px;
        height: 68px;
        font-size: 12px;
        border-color: rgba(239, 68, 68, 0.45);
      }
      .apex-touch-pad.gas-btn {
        width: 78px;
        height: 96px;
        font-size: 15px;
        border-color: rgba(0, 215, 255, 0.55);
        color: #00d7ff;
      }
      .apex-touch-pad.active-touch {
        transform: scale(0.93);
        background: rgba(0, 215, 255, 0.28);
        border-color: #00d7ff;
      }
    `;
    document.head.appendChild(style);
  }

  public getState(): InputState {
    return {
      forward:
        this.keys.has('KeyW') ||
        this.keys.has('ArrowUp') ||
        this.touchActions.has('forward'),
      backward:
        this.keys.has('KeyS') ||
        this.keys.has('ArrowDown') ||
        this.touchActions.has('backward'),
      steerLeft:
        this.keys.has('KeyA') ||
        this.keys.has('ArrowLeft') ||
        this.touchActions.has('steerLeft'),
      steerRight:
        this.keys.has('KeyD') ||
        this.keys.has('ArrowRight') ||
        this.touchActions.has('steerRight'),
      handbrake:
        this.keys.has('Space') ||
        this.touchActions.has('handbrake'),
      reset: this.pendingReset,
      toggleCamera: this.pendingToggleCamera,
      pause: this.pendingPause,
    };
  }

  public hasDrivingInput(): boolean {
    const s = this.getState();
    return s.forward || s.backward || s.steerLeft || s.steerRight || s.handbrake;
  }

  public consumeReset(): boolean {
    const val = this.pendingReset;
    this.pendingReset = false;
    return val;
  }

  public consumeToggleCamera(): boolean {
    const val = this.pendingToggleCamera;
    this.pendingToggleCamera = false;
    return val;
  }

  public consumePause(): boolean {
    const val = this.pendingPause;
    this.pendingPause = false;
    return val;
  }

  public clearAll(): void {
    this.keys.clear();
    this.touchActions.clear();
    this.pendingReset = false;
    this.pendingToggleCamera = false;
    this.pendingPause = false;
  }

  public dispose(): void {
    this.clearAll();
    this.touchContainer?.remove();
    this.toggleBtn?.remove();
  }
}