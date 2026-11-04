import { requestFullscreenIfMobile, toggleFullscreen } from '../utils/Fullscreen';
import { GamepadManager } from './GamepadManager';
import { MobileControlScheme } from '../settings/SettingsManager';

export interface InputState {
  forward: boolean;
  backward: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  handbrake: boolean;
  boost: boolean;
  reset: boolean;
  toggleCamera: boolean;
  pause: boolean;
  steerAxis?: number; // -1.0 (left) to 1.0 (right)
  throttleAxis?: number; // 0.0 to 1.0
  brakeAxis?: number; // 0.0 to 1.0
}

export class InputManager {
  private keys: Set<string> = new Set();
  private touchActions: Set<keyof InputState> = new Set();
  private activePointersByAction: Map<string, Set<number>> = new Map();
  public gamepadManager: GamepadManager;

  private pendingReset: boolean = false;
  private pendingToggleCamera: boolean = false;
  private pendingPause: boolean = false;

  public controlScheme: MobileControlScheme = 'buttons';
  public touchScale: number = 1.0;
  private touchEnabled: boolean = false;
  private inRace: boolean = false;
  private touchContainer: HTMLElement | null = null;
  private toggleBtn: HTMLButtonElement | null = null;

  private tiltSteerValue: number = 0;
  private isTiltListening: boolean = false;
  private boundDeviceOrientation: (e: DeviceOrientationEvent) => void;

  constructor() {
    this.boundDeviceOrientation = this.handleDeviceOrientation.bind(this);
    this.gamepadManager = new GamepadManager();
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
    this.touchContainer.setAttribute('data-scheme', this.controlScheme);
    this.touchContainer.style.setProperty('--apex-touch-scale', String(this.touchScale));

    this.touchContainer.innerHTML = `
      <!-- Bottom Utility Mini-Pills (Reset, Camera, Fullscreen, Pause) -->
      <div class="apex-touch-utility-bar">
        <button type="button" class="apex-touch-util-btn" data-action="reset">↻ RESET</button>
        <button type="button" class="apex-touch-util-btn" data-action="toggleCamera">🎥 CAM</button>
        <button type="button" class="apex-touch-util-btn" data-action="toggleFullscreen" title="Toggle Fullscreen">⛶ FULL</button>
        <button type="button" class="apex-touch-util-btn" data-action="pause">⏸ PAUSE</button>
      </div>

      <!-- Touch Sides Steering Zones (Only active in 'touch_sides' scheme) -->
      <div class="apex-touch-sides-container">
        <div class="apex-touch-side-zone zone-left" data-action="steerLeft"></div>
        <div class="apex-touch-side-zone zone-right" data-action="steerRight"></div>
      </div>

      <!-- Left Thumb Cluster: Nitro, Steer Left/Right, or Tilt-Auto Brake -->
      <div class="apex-touch-cluster left-cluster">
        <button type="button" class="apex-touch-pad nitro-btn left-nitro-btn" data-action="boost">⚡ NITRO</button>
        <div class="left-steer-group">
          <button type="button" class="apex-touch-pad steer-btn steer-left" data-action="steerLeft" aria-label="Steer Left">◀</button>
          <button type="button" class="apex-touch-pad steer-btn steer-right" data-action="steerRight" aria-label="Steer Right">▶</button>
        </div>
        <button type="button" class="apex-touch-pad brake-btn left-tilt-brake-btn" data-action="backward">BRAKE</button>
      </div>

      <!-- Right Thumb Cluster: Nitro, Drift, Brake/Rev, Gas -->
      <div class="apex-touch-cluster right-cluster">
        <button type="button" class="apex-touch-pad drift-btn" data-action="handbrake">DRIFT</button>
        <button type="button" class="apex-touch-pad brake-btn right-brake-btn" data-action="backward">BRAKE</button>
        <div class="gas-column">
          <button type="button" class="apex-touch-pad nitro-btn right-nitro-btn" data-action="boost">⚡ NITRO</button>
          <button type="button" class="apex-touch-pad gas-btn" data-action="forward">GAS</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.touchContainer);
    this.bindTouchButtons();
    this.updateTouchVisibility();

    // Auto-engage fullscreen upon first mobile user interaction
    const triggerMobileFullscreen = () => {
      requestFullscreenIfMobile();
    };
    window.addEventListener('touchstart', triggerMobileFullscreen, { passive: true });
    window.addEventListener('pointerdown', triggerMobileFullscreen, { passive: true });

    // Re-check if screen is resized/rotated into mobile dimensions (unless manually toggled)
    window.addEventListener('resize', () => {
      if (this.toggleBtn?.dataset.manualOverride !== 'true') {
        this.setTouchControlsEnabled(this.detectSmallOrTouchScreen(), false);
      }
    });
  }

  public setControlScheme(scheme: MobileControlScheme): void {
    this.controlScheme = scheme;
    if (this.touchContainer) {
      this.touchContainer.setAttribute('data-scheme', scheme);
    }
    if (scheme === 'tilt_manual' || scheme === 'tilt_auto') {
      this.initTiltListener();
      this.requestTiltPermission();
    }
    this.updateTouchVisibility();
  }

  public setTouchScale(scale: number): void {
    this.touchScale = Math.max(0.7, Math.min(1.5, scale));
    if (this.touchContainer) {
      this.touchContainer.style.setProperty('--apex-touch-scale', String(this.touchScale));
    }
  }

  public async requestTiltPermission(): Promise<boolean> {
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          this.initTiltListener();
          return true;
        }
        return false;
      } catch (err) {
        console.warn('DeviceOrientation permission request failed:', err);
        return false;
      }
    } else {
      this.initTiltListener();
      return true;
    }
  }

  private initTiltListener(): void {
    if (this.isTiltListening || typeof window === 'undefined') return;
    this.isTiltListening = true;
    window.addEventListener('deviceorientation', this.boundDeviceOrientation, { passive: true });
  }

  private handleDeviceOrientation(e: DeviceOrientationEvent): void {
    if (this.controlScheme !== 'tilt_manual' && this.controlScheme !== 'tilt_auto') {
      this.tiltSteerValue = 0;
      return;
    }

    const screenAngle = (screen.orientation && typeof screen.orientation.angle === 'number')
      ? screen.orientation.angle
      : (typeof window.orientation === 'number' ? window.orientation : 0);

    let rawAngle = 0;
    if (screenAngle === 90) {
      // Landscape rotated 90 deg clockwise (top of phone on left)
      rawAngle = e.beta ?? 0;
    } else if (screenAngle === -90 || screenAngle === 270) {
      // Landscape rotated 90 deg counter-clockwise (top of phone on right)
      rawAngle = -(e.beta ?? 0);
    } else if (screenAngle === 0) {
      // Portrait or default
      rawAngle = e.gamma ?? 0;
    } else {
      rawAngle = e.gamma ?? 0;
    }

    // Deadzone: 2.5 degrees. Maximum steering reached at +/- 24 degrees
    const deadzone = 2.5;
    const maxAngle = 24.0;
    const absAngle = Math.abs(rawAngle);

    if (absAngle < deadzone) {
      this.tiltSteerValue = 0;
    } else {
      const sign = Math.sign(rawAngle);
      const normalized = Math.min(1.0, (absAngle - deadzone) / (maxAngle - deadzone));
      this.tiltSteerValue = sign * normalized;
    }
  }

  private bindTouchButtons(): void {
    if (!this.touchContainer) return;

    const holdButtons = this.touchContainer.querySelectorAll<HTMLElement>('.apex-touch-pad');
    holdButtons.forEach((btn) => {
      const action = btn.dataset.action as keyof InputState;
      if (!action) return;

      const activate = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        btn.setPointerCapture(e.pointerId);

        if (!this.activePointersByAction.has(action)) {
          this.activePointersByAction.set(action, new Set());
        }
        this.activePointersByAction.get(action)!.add(e.pointerId);
        this.touchActions.add(action);
        btn.classList.add('active-touch');
      };

      const deactivate = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const set = this.activePointersByAction.get(action);
        if (set) {
          set.delete(e.pointerId);
          if (set.size === 0) {
            this.touchActions.delete(action);
            btn.classList.remove('active-touch');
          }
        } else {
          this.touchActions.delete(action);
          btn.classList.remove('active-touch');
        }
      };

      btn.addEventListener('pointerdown', activate);
      btn.addEventListener('pointerup', deactivate);
      btn.addEventListener('pointercancel', deactivate);
      btn.addEventListener('lostpointercapture', () => {
        const set = this.activePointersByAction.get(action);
        if (set) set.clear();
        this.touchActions.delete(action);
        btn.classList.remove('active-touch');
      });
    });

    const sideZones = this.touchContainer.querySelectorAll<HTMLElement>('.apex-touch-side-zone');
    sideZones.forEach((zone) => {
      const action = zone.dataset.action as keyof InputState;
      if (!action) return;

      const activate = (e: PointerEvent) => {
        e.preventDefault();
        zone.setPointerCapture(e.pointerId);

        if (!this.activePointersByAction.has(action)) {
          this.activePointersByAction.set(action, new Set());
        }
        this.activePointersByAction.get(action)!.add(e.pointerId);
        this.touchActions.add(action);
        zone.classList.add('active-touch');
      };

      const deactivate = (e: PointerEvent) => {
        e.preventDefault();
        const set = this.activePointersByAction.get(action);
        if (set) {
          set.delete(e.pointerId);
          if (set.size === 0) {
            this.touchActions.delete(action);
            zone.classList.remove('active-touch');
          }
        } else {
          this.touchActions.delete(action);
          zone.classList.remove('active-touch');
        }
      };

      zone.addEventListener('pointerdown', activate);
      zone.addEventListener('pointerup', deactivate);
      zone.addEventListener('pointercancel', deactivate);
      zone.addEventListener('lostpointercapture', () => {
        const set = this.activePointersByAction.get(action);
        if (set) set.clear();
        this.touchActions.delete(action);
        zone.classList.remove('active-touch');
      });
    });

    const utilButtons = this.touchContainer.querySelectorAll<HTMLElement>('.apex-touch-util-btn');
    utilButtons.forEach((btn) => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        requestFullscreenIfMobile();
        if (action === 'reset') this.pendingReset = true;
        if (action === 'toggleCamera') this.pendingToggleCamera = true;
        if (action === 'toggleFullscreen') toggleFullscreen();
        if (action === 'pause') this.pendingPause = true;
      });
    });
  }

  public setInRace(inRace: boolean): void {
    this.inRace = inRace;
    if (!inRace) {
      this.touchActions.clear();
    }
    this.updateTouchVisibility();
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
    this.updateTouchVisibility();
  }

  private updateTouchVisibility(): void {
    const isGamepadSuppression = this.gamepadManager.isGamepadActive();
    const shouldShow = this.inRace && this.touchEnabled && !isGamepadSuppression;
    if (this.touchContainer) {
      this.touchContainer.className = shouldShow ? 'touch-visible' : 'touch-hidden';
      this.touchContainer.style.display = shouldShow ? 'block' : 'none';
    }
    if (this.toggleBtn) {
      this.toggleBtn.style.display = this.inRace && !isGamepadSuppression ? 'block' : 'none';
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
        bottom: 58px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        padding: 4px 12px;
        font-family: 'Orbitron', 'Rajdhani', sans-serif;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: rgba(255, 255, 255, 0.78);
        background: rgba(10, 15, 26, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        backdrop-filter: blur(6px);
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        transition: opacity 0.2s, border-color 0.2s, background 0.2s;
        opacity: 0.7;
        display: none;
      }
      #apex-touch-toggle-btn:hover,
      #apex-touch-toggle-btn.is-active {
        opacity: 0.95;
        border-color: rgba(0, 215, 255, 0.65);
        color: #00d7ff;
      }
      #apex-mobile-touch-controls {
        --apex-touch-scale: 1;
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
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        pointer-events: auto;
        z-index: 95;
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
        cursor: pointer;
      }

      /* Touch sides steering zones */
      .apex-touch-sides-container {
        display: none;
        position: absolute;
        inset: 0;
        z-index: 20;
        pointer-events: auto;
      }
      .apex-touch-side-zone {
        flex: 1;
        height: 100%;
        touch-action: none;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        transition: background 0.1s ease;
      }
      .apex-touch-side-zone.zone-left.active-touch {
        background: linear-gradient(90deg, rgba(0, 215, 255, 0.15) 0%, transparent 60%);
      }
      .apex-touch-side-zone.zone-right.active-touch {
        background: linear-gradient(270deg, rgba(0, 215, 255, 0.15) 0%, transparent 60%);
      }
      .side-zone-indicator {
        font-family: 'Orbitron', 'Rajdhani', sans-serif;
        font-size: 13px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.2);
        letter-spacing: 0.1em;
        pointer-events: none;
        user-select: none;
        transition: opacity 0.15s, color 0.15s, text-shadow 0.15s;
      }
      .apex-touch-side-zone.active-touch .side-zone-indicator {
        color: #00d7ff;
        text-shadow: 0 0 12px rgba(0, 215, 255, 0.85);
      }

      /* Left & Right Clusters */
      .apex-touch-cluster {
        position: absolute;
        bottom: 22px;
        pointer-events: auto;
        z-index: 95;
      }
      .apex-touch-cluster.left-cluster {
        left: 25px; /* Moved 5px to the right */
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 45px; /* 45px above bottom buttons */
        transform: scale(var(--apex-touch-scale, 1));
        transform-origin: bottom left;
      }
      .left-steer-group {
        display: flex;
        gap: 12px;
      }
      .apex-touch-cluster.right-cluster {
        right: 20px;
        display: flex;
        align-items: flex-end;
        gap: 12px;
        transform: scale(var(--apex-touch-scale, 1));
        transform-origin: bottom right;
      }
      .right-cluster .gas-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 45px; /* 45px above gas button */
      }

      /* Pads */
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
        cursor: pointer;
      }
      .apex-touch-pad.steer-btn {
        width: 72px;
        height: 72px;
        font-size: 24px;
      }
      .apex-touch-pad.nitro-btn {
        width: 70px;
        height: 58px;
        font-size: 11px;
        border-color: rgba(6, 182, 212, 0.6);
        color: #06b6d4;
        background: rgba(6, 182, 212, 0.15);
      }
      .apex-touch-pad.nitro-btn.active-touch {
        background: rgba(6, 182, 212, 0.55);
        box-shadow: 0 0 16px rgba(6, 182, 212, 0.75);
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
        color: #ef4444;
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

      /* Scheme Specific Visibility */
      #apex-mobile-touch-controls[data-scheme="buttons"] .left-steer-group { display: flex; }
      #apex-mobile-touch-controls[data-scheme="buttons"] .left-tilt-brake-btn { display: none; }
      #apex-mobile-touch-controls[data-scheme="buttons"] .gas-btn { display: flex; }
      #apex-mobile-touch-controls[data-scheme="buttons"] .right-brake-btn { display: flex; }
      #apex-mobile-touch-controls[data-scheme="buttons"] .apex-touch-sides-container { display: none; }

      #apex-mobile-touch-controls[data-scheme="touch_sides"] .left-steer-group { display: none; }
      #apex-mobile-touch-controls[data-scheme="touch_sides"] .left-tilt-brake-btn { display: none; }
      #apex-mobile-touch-controls[data-scheme="touch_sides"] .gas-btn { display: none; }
      #apex-mobile-touch-controls[data-scheme="touch_sides"] .gas-column { gap: 0; }
      #apex-mobile-touch-controls[data-scheme="touch_sides"] .right-brake-btn { display: flex; }
      #apex-mobile-touch-controls[data-scheme="touch_sides"] .apex-touch-sides-container { display: flex; }

      #apex-mobile-touch-controls[data-scheme="tilt_manual"] .left-steer-group { display: none; }
      #apex-mobile-touch-controls[data-scheme="tilt_manual"] .left-tilt-brake-btn { display: none; }
      #apex-mobile-touch-controls[data-scheme="tilt_manual"] .gas-btn { display: flex; }
      #apex-mobile-touch-controls[data-scheme="tilt_manual"] .right-brake-btn { display: flex; }
      #apex-mobile-touch-controls[data-scheme="tilt_manual"] .apex-touch-sides-container { display: none; }

      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .left-steer-group { display: none; }
      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .left-tilt-brake-btn {
        display: flex;
        width: 86px;
        height: 72px;
      }
      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .gas-btn { display: none; }
      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .right-brake-btn { display: none; }
      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .gas-column { gap: 0; }
      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .right-nitro-btn {
        width: 86px;
        height: 72px;
      }
      #apex-mobile-touch-controls[data-scheme="tilt_auto"] .apex-touch-sides-container { display: none; }
    `;
    document.head.appendChild(style);
  }

  public getState(): InputState {
    const gp = this.gamepadManager.poll();
    const hasGpSteer = Math.abs(gp.steerAxis) > 0.05;
    const hasGpThrottle = gp.throttleAxis > 0.05;
    const hasGpBrake = gp.brakeAxis > 0.05;

    // Check if touch suppression needs an update
    this.updateTouchVisibility();

    const isTilt = this.controlScheme === 'tilt_manual' || this.controlScheme === 'tilt_auto';
    const isAutoThrottle = (this.controlScheme === 'touch_sides' || this.controlScheme === 'tilt_auto') && this.touchEnabled && this.inRace;

    const rawSteerLeft =
      this.keys.has('KeyA') ||
      this.keys.has('ArrowLeft') ||
      this.touchActions.has('steerLeft');

    const rawSteerRight =
      this.keys.has('KeyD') ||
      this.keys.has('ArrowRight') ||
      this.touchActions.has('steerRight');

    let steerAxis: number | undefined = undefined;
    let steerLeftKey = rawSteerLeft;
    let steerRightKey = rawSteerRight;

    if (hasGpSteer) {
      steerAxis = gp.steerAxis;
    } else if (isTilt && Math.abs(this.tiltSteerValue) > 0.02) {
      steerAxis = this.tiltSteerValue;
      steerLeftKey = steerAxis < -0.15;
      steerRightKey = steerAxis > 0.15;
    } else if (rawSteerLeft) {
      steerAxis = -1.0;
    } else if (rawSteerRight) {
      steerAxis = 1.0;
    }

    const backwardKey =
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown') ||
      this.touchActions.has('backward');

    let forwardKey =
      this.keys.has('KeyW') ||
      this.keys.has('ArrowUp') ||
      this.touchActions.has('forward');

    // Auto-throttle: accelerates automatically unless player is actively braking
    if (isAutoThrottle) {
      if (backwardKey || hasGpBrake) {
        forwardKey = false;
      } else {
        forwardKey = true;
      }
    }

    let throttleAxis: number | undefined = undefined;
    if (hasGpThrottle) {
      throttleAxis = gp.throttleAxis;
    } else if (forwardKey) {
      throttleAxis = 1.0;
    }

    let brakeAxis: number | undefined = undefined;
    if (hasGpBrake) {
      brakeAxis = gp.brakeAxis;
    } else if (backwardKey) {
      brakeAxis = 1.0;
    }

    return {
      forward: forwardKey || hasGpThrottle,
      backward: backwardKey || hasGpBrake,
      steerLeft: steerLeftKey || (steerAxis !== undefined && steerAxis < -0.2),
      steerRight: steerRightKey || (steerAxis !== undefined && steerAxis > 0.2),
      handbrake:
        this.keys.has('Space') ||
        this.touchActions.has('handbrake') ||
        gp.handbrake,
      boost:
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight') ||
        this.keys.has('KeyN') ||
        this.touchActions.has('boost') ||
        gp.boost,
      reset: this.pendingReset || gp.resetPressed,
      toggleCamera: this.pendingToggleCamera || gp.toggleCameraPressed,
      pause: this.pendingPause || gp.pausePressed,
      steerAxis,
      throttleAxis,
      brakeAxis,
    };
  }

  public hasDrivingInput(): boolean {
    const s = this.getState();
    return s.forward || s.backward || s.steerLeft || s.steerRight || s.handbrake || (s.throttleAxis !== undefined && s.throttleAxis > 0.05);
  }

  public consumeReset(): boolean {
    const val = this.pendingReset || this.gamepadManager.consumeReset();
    this.pendingReset = false;
    return val;
  }

  public consumeToggleCamera(): boolean {
    const val = this.pendingToggleCamera || this.gamepadManager.consumeToggleCamera();
    this.pendingToggleCamera = false;
    return val;
  }

  public consumePause(): boolean {
    const val = this.pendingPause || this.gamepadManager.consumePause();
    this.pendingPause = false;
    return val;
  }

  public triggerHaptic(weak: number, strong: number, durationMs: number = 100): void {
    this.gamepadManager.vibrate(weak, strong, durationMs);
  }

  public clearAll(): void {
    this.keys.clear();
    this.touchActions.clear();
    this.activePointersByAction.clear();
    this.tiltSteerValue = 0;
    this.pendingReset = false;
    this.pendingToggleCamera = false;
    this.pendingPause = false;
  }

  public dispose(): void {
    this.clearAll();
    if (this.isTiltListening && typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.boundDeviceOrientation);
      this.isTiltListening = false;
    }
    this.touchContainer?.remove();
    this.toggleBtn?.remove();
    this.gamepadManager.dispose();
  }
}