export interface GamepadSnapshot {
  connected: boolean;
  id: string;
  steerAxis: number; // -1.0 to 1.0 (left to right)
  throttleAxis: number; // 0.0 to 1.0
  brakeAxis: number; // 0.0 to 1.0
  handbrake: boolean;
  boost: boolean;
  resetPressed: boolean;
  toggleCameraPressed: boolean;
  pausePressed: boolean;
}

/**
 * GamepadManager handles HTML5 Gamepad API polling, deadzone calibration,
 * analog response curve shaping, dual-rumble haptic feedback, and connection notifications.
 */
export class GamepadManager {
  private activeGamepadIndex: number | null = null;
  private prevButtonStates: Map<number, boolean> = new Map();
  private pendingReset: boolean = false;
  private pendingToggleCamera: boolean = false;
  private pendingPause: boolean = false;
  private toastElement: HTMLElement | null = null;
  private toastTimeout: number | null = null;
  private isSuppressionActive: boolean = false;

  // Deadzone and stick sensitivity tuning
  public deadzone: number = 0.12;
  public stickExponent: number = 1.35; // Slight non-linearity for micro-steering precision

  constructor() {
    this.initEvents();
  }

  private initEvents(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
      this.activeGamepadIndex = e.gamepad.index;
      this.showToast(`🎮 CONTROLLER CONNECTED: ${this.formatGamepadName(e.gamepad.id)}`);
    });

    window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
      if (this.activeGamepadIndex === e.gamepad.index) {
        this.activeGamepadIndex = null;
        this.prevButtonStates.clear();
        this.showToast('🎮 CONTROLLER DISCONNECTED');
      }
    });
  }

  private formatGamepadName(rawId: string): string {
    if (/xbox/i.test(rawId)) return 'XBOX CONTROLLER';
    if (/dualsense|ps5/i.test(rawId)) return 'PLAYSTATION DUALSENSE';
    if (/dualshock|ps4/i.test(rawId)) return 'PLAYSTATION DUALSHOCK';
    if (/switch|nintendo/i.test(rawId)) return 'NINTENDO SWITCH CONTROLLER';
    return rawId.split('(')[0].trim().toUpperCase() || 'WIRELESS CONTROLLER';
  }

  public getActiveGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;

    try {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return null;

      // Prefer previously connected gamepad index
      if (this.activeGamepadIndex !== null && gamepads[this.activeGamepadIndex]?.connected) {
        return gamepads[this.activeGamepadIndex];
      }

      // Fallback: search for first connected gamepad
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (gp && gp.connected) {
          if (this.activeGamepadIndex === null) {
            this.activeGamepadIndex = i;
            this.showToast(`🎮 CONTROLLER DETECTED: ${this.formatGamepadName(gp.id)}`);
          }
          return gp;
        }
      }
    } catch {
      // Silently ignore browser security restriction in cross-origin sandbox
    }

    return null;
  }

  /**
   * Applies deadzone filtering and non-linear response curve for progressive steering.
   */
  private processStickAxis(rawVal: number): number {
    const abs = Math.abs(rawVal);
    if (abs <= this.deadzone) return 0;
    const normalized = (abs - this.deadzone) / (1.0 - this.deadzone);
    const curved = Math.pow(Math.min(1.0, Math.max(0, normalized)), this.stickExponent);
    return Math.sign(rawVal) * curved;
  }

  /**
   * Polls gamepad state for the current frame.
   */
  public poll(): GamepadSnapshot {
    const gp = this.getActiveGamepad();

    const emptySnapshot: GamepadSnapshot = {
      connected: false,
      id: '',
      steerAxis: 0,
      throttleAxis: 0,
      brakeAxis: 0,
      handbrake: false,
      boost: false,
      resetPressed: false,
      toggleCameraPressed: false,
      pausePressed: false,
    };

    if (!gp) {
      this.isSuppressionActive = false;
      return emptySnapshot;
    }

    const buttons = gp.buttons || [];
    const axes = gp.axes || [];

    const isPressed = (index: number): boolean => {
      const b = buttons[index];
      return b ? (typeof b === 'object' ? b.pressed : (b as number) > 0.5) : false;
    };

    const getAxisValue = (index: number): number => {
      return axes[index] !== undefined ? axes[index] : 0;
    };

    const getTriggerValue = (index: number): number => {
      const b = buttons[index];
      if (!b) return 0;
      return typeof b === 'object' ? b.value : (b as number);
    };

    // 1. Steering: Left Stick X (axis 0) with D-Pad fallback
    let steerAxis = this.processStickAxis(getAxisValue(0));
    if (Math.abs(steerAxis) < 0.05) {
      if (isPressed(14)) steerAxis = -1.0; // D-Pad Left
      if (isPressed(15)) steerAxis = 1.0; // D-Pad Right
    }

    // 2. Throttle: Right Trigger (RT / R2: button 7), Face Button A (button 0), or D-Pad Up (button 12)
    let throttleAxis = getTriggerValue(7);
    if (throttleAxis < 0.05 && (isPressed(0) || isPressed(12))) {
      throttleAxis = 1.0;
    }

    // 3. Brake / Reverse: Left Trigger (LT / L2: button 6), Face Button X (button 2), or D-Pad Down (button 13)
    let brakeAxis = getTriggerValue(6);
    if (brakeAxis < 0.05 && (isPressed(2) || isPressed(13))) {
      brakeAxis = 1.0;
    }

    // 4. Handbrake / Drift: Face Button B (button 1) or Left Bumper (button 4)
    const handbrake = isPressed(1) || isPressed(4);

    // 5. Nitro Boost: Right Bumper (button 5) or Left Stick Click (button 10)
    const boost = isPressed(5) || isPressed(10);

    // 6. One-shot Edge-Triggered Buttons: Reset (button 8), Camera (button 3), Pause (button 9)
    const checkEdge = (btnIndex: number): boolean => {
      const currentlyPressed = isPressed(btnIndex);
      const wasPressed = this.prevButtonStates.get(btnIndex) || false;
      this.prevButtonStates.set(btnIndex, currentlyPressed);
      return currentlyPressed && !wasPressed;
    };

    const resetPressed = checkEdge(8); // Back / Select / Share
    const toggleCameraPressed = checkEdge(3); // Y / Triangle
    const pausePressed = checkEdge(9); // Start / Menu / Options

    if (resetPressed) this.pendingReset = true;
    if (toggleCameraPressed) this.pendingToggleCamera = true;
    if (pausePressed) this.pendingPause = true;

    // Detect if gamepad has non-zero inputs to auto-suppress mobile touch pads
    const hasInput =
      Math.abs(steerAxis) > 0.05 ||
      throttleAxis > 0.05 ||
      brakeAxis > 0.05 ||
      handbrake ||
      boost ||
      resetPressed ||
      toggleCameraPressed ||
      pausePressed;

    if (hasInput) {
      this.isSuppressionActive = true;
    }

    return {
      connected: true,
      id: gp.id,
      steerAxis,
      throttleAxis,
      brakeAxis,
      handbrake,
      boost,
      resetPressed,
      toggleCameraPressed,
      pausePressed,
    };
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

  public isGamepadActive(): boolean {
    return this.isSuppressionActive && this.activeGamepadIndex !== null;
  }

  /**
   * Dual-rumble haptic feedback (weak high-frequency + strong low-frequency motors).
   */
  public vibrate(weak: number, strong: number, durationMs: number = 100): void {
    const gp = this.getActiveGamepad();
    if (!gp) return;

    try {
      const actuator = (gp as any).vibrationActuator;
      if (actuator && typeof actuator.playEffect === 'function') {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1.0, Math.max(0, weak)),
          strongMagnitude: Math.min(1.0, Math.max(0, strong)),
        }).catch(() => {});
      }
    } catch {
      // Ignore vibration errors on unprivileged browsers
    }
  }

  private showToast(message: string): void {
    if (typeof document === 'undefined') return;

    if (!this.toastElement) {
      this.toastElement = document.createElement('div');
      this.toastElement.id = 'apex-gamepad-toast';
      this.toastElement.className = 'apex-gamepad-toast';
      document.body.appendChild(this.toastElement);
    }

    this.toastElement.textContent = message;
    this.toastElement.classList.add('visible');

    if (this.toastTimeout !== null) {
      window.clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = window.setTimeout(() => {
      this.toastElement?.classList.remove('visible');
      this.toastTimeout = null;
    }, 3200);
  }

  public dispose(): void {
    if (this.toastTimeout !== null) {
      window.clearTimeout(this.toastTimeout);
    }
    this.toastElement?.remove();
    this.prevButtonStates.clear();
  }
}

