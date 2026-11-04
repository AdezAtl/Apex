import { SoundManager } from '../audio/SoundManager';

/**
 * Universal Menu Navigation Manager.
 * Enables seamless menu browsing across all screens using:
 * - Keyboard: Arrow keys (Up/Down/Left/Right), Tab, Enter, Space, Escape
 * - Gamepad: D-Pad, Left Analog Stick, Face Button A/Cross (Select), Face Button X/Square (Select), Face Button B/Circle (Back), Start
 * Automatically highlights the focused element with `.nav-focused`, plays sound effects,
 * and scrolls overflowing containers smoothly into view.
 */
export class MenuNavigationManager {
  private soundManager: SoundManager | null = null;
  private currentFocusedElement: HTMLElement | null = null;

  // Gamepad debouncing and edge triggering
  private stickCooldown: number = 0;
  private prevButtonA: boolean = false;
  private prevButtonX: boolean = false;
  private prevButtonB: boolean = false;
  private prevButtonStart: boolean = false;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;

  constructor(soundManager?: SoundManager) {
    if (soundManager) this.soundManager = soundManager;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown, { capture: true });
      window.addEventListener('mousemove', this.boundMouseMove, { passive: true });
    }
  }

  public setSoundManager(soundManager: SoundManager): void {
    this.soundManager = soundManager;
  }

  /**
   * Finds the currently topmost visible menu modal or overlay in DOM
   */
  public getActiveMenuContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;

    // Check modal overlays in priority order (e.g. Pause Menu over game, Settings over Menu, etc.)
    const overlaySelectors = [
      '#pause-overlay',
      '#settings-overlay',
      '#settings-menu-overlay',
      '#career-results-overlay',
      '#finish-screen-overlay',
      '#multiplayer-lobby-overlay',
      '#multiplayer-results-overlay',
      '#event-select-overlay',
      '#garage-screen-overlay',
      '#career-hub-overlay',
      '#main-menu-overlay',
    ];

    for (const sel of overlaySelectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && !el.classList.contains('hidden') && el.style.display !== 'none' && el.offsetParent !== null) {
        return el;
      }
    }

    return null;
  }

  /**
   * Retrieves all visible, enabled interactive elements within container
   */
  public getNavigableElements(container: HTMLElement): HTMLElement[] {
    const rawElements = container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [role="button"]:not([disabled]), [role="tab"]:not([disabled]), input:not([disabled]), select:not([disabled]), .circuit-tab, .diff-btn, .career-card, .strip-car-card, .paint-swatch-btn, .strip-filter-btn'
    );

    const result: HTMLElement[] = [];
    rawElements.forEach((el) => {
      // Must not be hidden by CSS or inside a hidden parent
      if (el.classList.contains('hidden') || el.style.display === 'none') return;
      if (el.offsetParent === null && el.offsetWidth === 0 && el.offsetHeight === 0) return;
      result.push(el);
    });

    return result;
  }

  /**
   * Focuses a target element with visible styling and audio feedback
   */
  public focusElement(element: HTMLElement, playAudio: boolean = true): void {
    if (this.currentFocusedElement === element) return;

    if (this.currentFocusedElement) {
      this.currentFocusedElement.classList.remove('nav-focused');
    }

    this.currentFocusedElement = element;
    element.classList.add('nav-focused');

    try {
      element.focus({ preventScroll: true });
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    } catch {}

    if (playAudio && this.soundManager) {
      this.soundManager.playUIClick();
    }
  }

  /**
   * Moves focus by offset relative to current navigable items
   */
  public navigate(direction: 'up' | 'down' | 'left' | 'right'): void {
    const container = this.getActiveMenuContainer();
    if (!container) return;

    const items = this.getNavigableElements(container);
    if (items.length === 0) return;

    let currentIndex = this.currentFocusedElement ? items.indexOf(this.currentFocusedElement) : -1;

    if (currentIndex === -1) {
      // If none currently focused, focus first element (or autofocus button)
      const autoFocusBtn = items.find((el) => el.hasAttribute('autofocus'));
      this.focusElement(autoFocusBtn || items[0], true);
      return;
    }

    let nextIndex = currentIndex;

    if (direction === 'down') {
      nextIndex = (currentIndex + 1) % items.length;
    } else if (direction === 'up') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    } else if (direction === 'right') {
      // For horizontal elements or general next
      nextIndex = (currentIndex + 1) % items.length;
    } else if (direction === 'left') {
      nextIndex = (currentIndex - 1 + items.length) % items.length;
    }

    this.focusElement(items[nextIndex], true);
  }

  /**
   * Triggers the currently focused option (Click / Select)
   */
  public activateCurrent(): void {
    if (!this.currentFocusedElement) {
      const container = this.getActiveMenuContainer();
      if (!container) return;
      const items = this.getNavigableElements(container);
      if (items.length > 0) {
        this.focusElement(items[0], false);
      }
    }

    if (this.currentFocusedElement) {
      if (this.soundManager) {
        this.soundManager.playUISelect();
      }
      this.currentFocusedElement.click();
    }
  }

  /**
   * Triggers back / cancel / resume for the active menu
   */
  public triggerCancel(): void {
    const container = this.getActiveMenuContainer();
    if (!container) return;

    if (this.soundManager) {
      this.soundManager.playUIClick();
    }

    // Check for standard back / resume / close buttons inside the container
    const cancelSelectors = [
      '#btn-resume',
      '#btn-close-settings',
      '#btn-settings-back',
      '#btn-event-back',
      '#btn-finish-menu',
      '#btn-mp-back',
      '#btn-career-hub',
      '#btn-career-back',
      '.secondary-btn',
      '.btn-back',
    ];

    for (const sel of cancelSelectors) {
      const btn = container.querySelector<HTMLElement>(sel);
      if (btn && !btn.classList.contains('hidden') && btn.offsetParent !== null) {
        btn.click();
        return;
      }
    }

    // Fallback: dispatch escape keyboard event
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
  }

  /**
   * Keyboard event handler for Arrow keys, Enter, and Escape
   */
  private handleKeyDown(e: KeyboardEvent): void {
    const container = this.getActiveMenuContainer();
    if (!container) return;

    // If user is currently typing inside a text input or textarea, let text cursor navigate normally
    const activeTag = (document.activeElement as HTMLElement)?.tagName;
    const isTextInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

    if (e.code === 'ArrowDown') {
      e.preventDefault();
      this.navigate('down');
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      this.navigate('up');
    } else if (e.code === 'ArrowRight' && !isTextInput) {
      e.preventDefault();
      this.navigate('right');
    } else if (e.code === 'ArrowLeft' && !isTextInput) {
      e.preventDefault();
      this.navigate('left');
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      if (activeTag !== 'INPUT') {
        e.preventDefault();
        this.activateCurrent();
      }
    } else if (e.code === 'Escape') {
      e.preventDefault();
      this.triggerCancel();
    }
  }

  /**
   * Syncs hover events so moving mouse smoothly hands off to keyboard/gamepad
   */
  private handleMouseMove(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const interactive = target.closest<HTMLElement>(
      'button, [role="button"], [role="tab"], .circuit-tab, .diff-btn, .career-card, .strip-car-card, .paint-swatch-btn'
    );

    if (interactive && interactive !== this.currentFocusedElement) {
      const container = this.getActiveMenuContainer();
      if (container && container.contains(interactive)) {
        this.focusElement(interactive, false);
      }
    }
  }

  /**
   * Polls Gamepad inputs each frame during menu screens
   */
  public update(dt: number, gp: Gamepad | null): void {
    const container = this.getActiveMenuContainer();
    if (!container) {
      if (this.currentFocusedElement) {
        this.currentFocusedElement.classList.remove('nav-focused');
        this.currentFocusedElement = null;
      }
      return;
    }

    // Auto-focus first element if none is currently highlighted
    if (!this.currentFocusedElement || !container.contains(this.currentFocusedElement)) {
      const items = this.getNavigableElements(container);
      if (items.length > 0) {
        const auto = items.find((el) => el.hasAttribute('autofocus'));
        this.focusElement(auto || items[0], false);
      }
    }

    if (!gp) return;

    const buttons = gp.buttons || [];
    const axes = gp.axes || [];

    const isPressed = (index: number): boolean => {
      const b = buttons[index];
      return b ? (typeof b === 'object' ? b.pressed : (b as number) > 0.5) : false;
    };

    // 1. Directional Navigation (D-Pad & Left Analog Stick)
    const dpadUp = isPressed(12);
    const dpadDown = isPressed(13);
    const dpadLeft = isPressed(14);
    const dpadRight = isPressed(15);

    const stickX = axes[0] !== undefined ? axes[0] : 0;
    const stickY = axes[1] !== undefined ? axes[1] : 0;

    const navUp = dpadUp || stickY < -0.55;
    const navDown = dpadDown || stickY > 0.55;
    const navLeft = dpadLeft || stickX < -0.55;
    const navRight = dpadRight || stickX > 0.55;

    if (this.stickCooldown <= 0) {
      if (navDown) {
        this.navigate('down');
        this.stickCooldown = 0.22;
      } else if (navUp) {
        this.navigate('up');
        this.stickCooldown = 0.22;
      } else if (navRight) {
        this.navigate('right');
        this.stickCooldown = 0.22;
      } else if (navLeft) {
        this.navigate('left');
        this.stickCooldown = 0.22;
      }
    } else {
      if (!navUp && !navDown && !navLeft && !navRight) {
        this.stickCooldown = 0; // Immediate release reset
      } else {
        this.stickCooldown -= dt;
      }
    }

    // 2. Confirm / Select Action: Face Button A (button 0) OR Face Button X (button 2)
    const btnA = isPressed(0);
    const btnX = isPressed(2);
    if ((btnA && !this.prevButtonA) || (btnX && !this.prevButtonX)) {
      this.activateCurrent();
    }
    this.prevButtonA = btnA;
    this.prevButtonX = btnX;

    // 3. Cancel / Back Action: Face Button B (button 1)
    const btnB = isPressed(1);
    if (btnB && !this.prevButtonB) {
      this.triggerCancel();
    }
    this.prevButtonB = btnB;

    // 4. Start Button (button 9): Pause / Resume toggle
    const btnStart = isPressed(9);
    if (btnStart && !this.prevButtonStart) {
      this.triggerCancel();
    }
    this.prevButtonStart = btnStart;
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown, { capture: true });
      window.removeEventListener('mousemove', this.boundMouseMove);
    }
    if (this.currentFocusedElement) {
      this.currentFocusedElement.classList.remove('nav-focused');
      this.currentFocusedElement = null;
    }
  }
}
