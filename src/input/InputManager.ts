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
  private state: InputState = {
    forward: false,
    backward: false,
    steerLeft: false,
    steerRight: false,
    handbrake: false,
    reset: false,
    toggleCamera: false,
    pause: false,
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  constructor() {
    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundBlur = this.onBlur.bind(this);

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.steerLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.steerRight = true;
        break;
      case 'Space':
        this.state.handbrake = true;
        break;
      case 'KeyR':
        this.state.reset = true;
        break;
      case 'KeyC':
        this.state.toggleCamera = true;
        break;
      case 'Escape':
        this.state.pause = true;
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.state.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.state.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.state.steerLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.state.steerRight = false;
        break;
      case 'Space':
        this.state.handbrake = false;
        break;
      case 'KeyR':
        this.state.reset = false;
        break;
      case 'KeyC':
        this.state.toggleCamera = false;
        break;
      case 'Escape':
        this.state.pause = false;
        break;
    }
  }

  private onBlur(): void {
    this.state.forward = false;
    this.state.backward = false;
    this.state.steerLeft = false;
    this.state.steerRight = false;
    this.state.handbrake = false;
    this.state.reset = false;
    this.state.toggleCamera = false;
    this.state.pause = false;
  }

  public getState(): InputState {
    return { ...this.state };
  }

  public consumeReset(): boolean {
    if (this.state.reset) {
      this.state.reset = false;
      return true;
    }
    return false;
  }

  public consumeToggleCamera(): boolean {
    if (this.state.toggleCamera) {
      this.state.toggleCamera = false;
      return true;
    }
    return false;
  }

  public consumePause(): boolean {
    if (this.state.pause) {
      this.state.pause = false;
      return true;
    }
    return false;
  }

  public hasDrivingInput(): boolean {
    return (
      this.state.forward ||
      this.state.backward ||
      this.state.steerLeft ||
      this.state.steerRight ||
      this.state.handbrake
    );
  }

  public clearAll(): void {
    this.state.forward = false;
    this.state.backward = false;
    this.state.steerLeft = false;
    this.state.steerRight = false;
    this.state.handbrake = false;
    this.state.reset = false;
    this.state.toggleCamera = false;
    this.state.pause = false;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);
  }
}
