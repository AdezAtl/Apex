import { GraphicsQuality, MobileControlScheme, SettingsManager } from '../settings/SettingsManager';

export interface SettingsMenuCallbacks {
  onQualityChange: (quality: GraphicsQuality) => void;
  onVolumeChange: (volume: number) => void;
  onEngineVolumeChange?: (volume: number) => void;
  onEffectsVolumeChange?: (volume: number) => void;
  onMusicVolumeChange?: (volume: number) => void;
  onMuteToggle?: (isMuted: boolean) => void;
  onControlSchemeChange?: (scheme: MobileControlScheme) => void;
  onTouchScaleChange?: (scale: number) => void;
  onBack: () => void;
}

export class SettingsMenu {
  private container: HTMLElement | null = null;
  private callbacks: SettingsMenuCallbacks;
  private settingsManager: SettingsManager;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;

  private qualityButtons: Map<GraphicsQuality, HTMLButtonElement> = new Map();
  private schemeButtons: Map<MobileControlScheme, HTMLButtonElement> = new Map();
  private touchScaleSlider: HTMLInputElement | null = null;
  private touchScaleValueText: HTMLElement | null = null;
  private masterSlider: HTMLInputElement | null = null;
  private masterValueText: HTMLElement | null = null;
  private engineSlider: HTMLInputElement | null = null;
  private engineValueText: HTMLElement | null = null;
  private effectsSlider: HTMLInputElement | null = null;
  private effectsValueText: HTMLElement | null = null;
  private musicSlider: HTMLInputElement | null = null;
  private musicValueText: HTMLElement | null = null;
  private muteButton: HTMLButtonElement | null = null;

  private boundKeyDown: (e: KeyboardEvent) => void;

  constructor(settingsManager: SettingsManager, callbacks: SettingsMenuCallbacks) {
    this.settingsManager = settingsManager;
    this.callbacks = callbacks;
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('settings-menu-overlay');
    if (existing) existing.remove();

    this.container = document.createElement('div');
    this.container.id = 'settings-menu-overlay';
    this.container.className = 'menu-overlay hidden';

    this.container.innerHTML = `
      <div class="menu-card settings-card">
        <div class="panel-header">
          <span class="panel-badge">CONFIGURATION // SYSTEM</span>
          <h2 class="panel-title">SETTINGS</h2>
        </div>

        <div class="settings-group">
          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">GRAPHICS QUALITY</span>
              <span class="setting-subtext">Controls internal buffer scaling, shadow filtering, and camera shake load</span>
            </div>
            <div class="quality-toggle-group">
              <button id="btn-quality-low" class="quality-btn" data-quality="low">LOW</button>
              <button id="btn-quality-medium" class="quality-btn" data-quality="medium">MEDIUM</button>
              <button id="btn-quality-high" class="quality-btn" data-quality="high">HIGH</button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">DRIVING CONTROL SCHEME</span>
              <span class="setting-subtext">On-screen buttons, Touch Sides (Auto-Gas), or Gyro Tilt</span>
            </div>
            <div class="quality-toggle-group control-scheme-grid">
              <button id="btn-scheme-buttons" class="quality-btn" data-scheme="buttons">BUTTONS</button>
              <button id="btn-scheme-touch-sides" class="quality-btn" data-scheme="touch_sides">TOUCH SIDES (AUTO)</button>
              <button id="btn-scheme-tilt-manual" class="quality-btn" data-scheme="tilt_manual">TILT (MANUAL)</button>
              <button id="btn-scheme-tilt-auto" class="quality-btn" data-scheme="tilt_auto">TILT (AUTO)</button>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">TOUCH BUTTON SIZE</span>
              <span class="setting-subtext">Scale on-screen touch controls for ergonomics</span>
            </div>
            <div class="slider-control-row">
              <input type="range" id="touch-scale-slider" min="70" max="140" step="5" class="apex-slider" />
              <span id="touch-scale-percentage" class="slider-value">100%</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">MASTER AUDIO VOLUME</span>
              <span class="setting-subtext">Overall game audio output level</span>
            </div>
            <div class="slider-control-row">
              <input type="range" id="volume-slider" min="0" max="100" step="5" class="apex-slider" />
              <span id="volume-percentage" class="slider-value">80%</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">ENGINE AUDIO VOLUME</span>
              <span class="setting-subtext">Procedural multi-harmonic powertrain roar & intake resonance</span>
            </div>
            <div class="slider-control-row">
              <input type="range" id="engine-slider" min="0" max="100" step="5" class="apex-slider" />
              <span id="engine-percentage" class="slider-value">80%</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">EFFECTS VOLUME</span>
              <span class="setting-subtext">Tire squeal, transmission clacks, collision thuds & race cues</span>
            </div>
            <div class="slider-control-row">
              <input type="range" id="effects-slider" min="0" max="100" step="5" class="apex-slider" />
              <span id="effects-percentage" class="slider-value">80%</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">RACE & MENU MUSIC</span>
              <span class="setting-subtext">Procedural synthwave soundtrack output</span>
            </div>
            <div class="slider-control-row">
              <input type="range" id="music-slider" min="0" max="100" step="5" class="apex-slider" />
              <span id="music-percentage" class="slider-value">70%</span>
            </div>
          </div>

          <div class="setting-item">
            <div class="setting-meta">
              <span class="setting-title">AUDIO MUTE</span>
              <span class="setting-subtext">Instantly silence all game and vehicle sound</span>
            </div>
            <button id="btn-audio-mute" class="quality-btn" style="width: 100%;">MUTE AUDIO</button>
          </div>
        </div>

        <div class="panel-bottom-nav">
          <button id="btn-settings-back" class="apex-btn primary-btn full-width" autofocus>
            <span class="btn-text">APPLY & RETURN</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('ui-overlay')?.appendChild(this.container);

    const btnLow = document.getElementById('btn-quality-low') as HTMLButtonElement;
    const btnMed = document.getElementById('btn-quality-medium') as HTMLButtonElement;
    const btnHigh = document.getElementById('btn-quality-high') as HTMLButtonElement;
    if (btnLow) this.qualityButtons.set('low', btnLow);
    if (btnMed) this.qualityButtons.set('medium', btnMed);
    if (btnHigh) this.qualityButtons.set('high', btnHigh);

    const btnSchemeBtns = document.getElementById('btn-scheme-buttons') as HTMLButtonElement;
    const btnSchemeTouch = document.getElementById('btn-scheme-touch-sides') as HTMLButtonElement;
    const btnSchemeTiltMan = document.getElementById('btn-scheme-tilt-manual') as HTMLButtonElement;
    const btnSchemeTiltAuto = document.getElementById('btn-scheme-tilt-auto') as HTMLButtonElement;
    if (btnSchemeBtns) this.schemeButtons.set('buttons', btnSchemeBtns);
    if (btnSchemeTouch) this.schemeButtons.set('touch_sides', btnSchemeTouch);
    if (btnSchemeTiltMan) this.schemeButtons.set('tilt_manual', btnSchemeTiltMan);
    if (btnSchemeTiltAuto) this.schemeButtons.set('tilt_auto', btnSchemeTiltAuto);

    this.touchScaleSlider = document.getElementById('touch-scale-slider') as HTMLInputElement;
    this.touchScaleValueText = document.getElementById('touch-scale-percentage');

    this.schemeButtons.forEach((btn, scheme) => {
      btn.addEventListener('click', () => {
        this.selectControlScheme(scheme);
        this.settingsManager.setMobileControlScheme(scheme);
        if (this.callbacks.onControlSchemeChange) {
          this.callbacks.onControlSchemeChange(scheme);
        }
      });
    });

    if (this.touchScaleSlider) {
      this.touchScaleSlider.addEventListener('input', () => {
        const val = parseInt(this.touchScaleSlider!.value, 10) / 100;
        if (this.touchScaleValueText) {
          this.touchScaleValueText.textContent = `${Math.round(val * 100)}%`;
        }
        this.settingsManager.setTouchControlScale(val);
        if (this.callbacks.onTouchScaleChange) {
          this.callbacks.onTouchScaleChange(val);
        }
      });
    }

    this.masterSlider = document.getElementById('volume-slider') as HTMLInputElement;
    this.masterValueText = document.getElementById('volume-percentage');
    this.engineSlider = document.getElementById('engine-slider') as HTMLInputElement;
    this.engineValueText = document.getElementById('engine-percentage');
    this.effectsSlider = document.getElementById('effects-slider') as HTMLInputElement;
    this.effectsValueText = document.getElementById('effects-percentage');
    this.musicSlider = document.getElementById('music-slider') as HTMLInputElement;
    this.musicValueText = document.getElementById('music-percentage');
    this.muteButton = document.getElementById('btn-audio-mute') as HTMLButtonElement;

    this.qualityButtons.forEach((btn, quality) => {
      btn.addEventListener('click', () => {
        this.selectQuality(quality);
        this.callbacks.onQualityChange(quality);
      });
    });

    if (this.masterSlider) {
      this.masterSlider.addEventListener('input', () => {
        const val = parseInt(this.masterSlider!.value, 10) / 100;
        if (this.masterValueText) {
          this.masterValueText.textContent = `${Math.round(val * 100)}%`;
        }
        this.callbacks.onVolumeChange(val);
      });
    }

    if (this.engineSlider) {
      this.engineSlider.addEventListener('input', () => {
        const val = parseInt(this.engineSlider!.value, 10) / 100;
        if (this.engineValueText) {
          this.engineValueText.textContent = `${Math.round(val * 100)}%`;
        }
        if (this.callbacks.onEngineVolumeChange) {
          this.callbacks.onEngineVolumeChange(val);
        }
      });
    }

    if (this.effectsSlider) {
      this.effectsSlider.addEventListener('input', () => {
        const val = parseInt(this.effectsSlider!.value, 10) / 100;
        if (this.effectsValueText) {
          this.effectsValueText.textContent = `${Math.round(val * 100)}%`;
        }
        if (this.callbacks.onEffectsVolumeChange) {
          this.callbacks.onEffectsVolumeChange(val);
        }
      });
    }

    if (this.musicSlider) {
      this.musicSlider.addEventListener('input', () => {
        const val = parseInt(this.musicSlider!.value, 10) / 100;
        if (this.musicValueText) {
          this.musicValueText.textContent = `${Math.round(val * 100)}%`;
        }
        if (this.callbacks.onMusicVolumeChange) {
          this.callbacks.onMusicVolumeChange(val);
        }
      });
    }

    if (this.muteButton) {
      this.muteButton.addEventListener('click', () => {
        const isMuted = this.settingsManager.toggleMute();
        this.updateMuteButtonDisplay(isMuted);
        if (this.callbacks.onMuteToggle) {
          this.callbacks.onMuteToggle(isMuted);
        }
      });
    }

    document.getElementById('btn-settings-back')?.addEventListener('click', () => {
      this.triggerBack();
    });

    this.syncFromSettings();
  }

  private updateMuteButtonDisplay(isMuted: boolean): void {
    if (!this.muteButton) return;
    if (isMuted) {
      this.muteButton.classList.add('active');
      this.muteButton.textContent = 'UNMUTE AUDIO (MUTED)';
    } else {
      this.muteButton.classList.remove('active');
      this.muteButton.textContent = 'MUTE ALL AUDIO';
    }
  }

  private triggerBack(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;
    this.callbacks.onBack();
    setTimeout(() => {
      this.isNavigating = false;
    }, 400);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isVisible) return;

    if (e.code === 'Escape') {
      e.preventDefault();
      this.triggerBack();
    }
  }

  public syncFromSettings(): void {
    const s = this.settingsManager.getSettings();
    this.selectQuality(s.graphicsQuality);
    this.selectControlScheme(s.mobileControlScheme || 'buttons');

    if (this.touchScaleSlider) {
      const scalePercent = Math.round((s.touchControlScale ?? 1.0) * 100);
      this.touchScaleSlider.value = String(scalePercent);
      if (this.touchScaleValueText) {
        this.touchScaleValueText.textContent = `${scalePercent}%`;
      }
    }

    if (this.masterSlider) {
      this.masterSlider.value = String(Math.round(s.masterVolume * 100));
    }
    if (this.masterValueText) {
      this.masterValueText.textContent = `${Math.round(s.masterVolume * 100)}%`;
    }

    if (this.engineSlider) {
      this.engineSlider.value = String(Math.round(s.engineVolume * 100));
    }
    if (this.engineValueText) {
      this.engineValueText.textContent = `${Math.round(s.engineVolume * 100)}%`;
    }

    if (this.effectsSlider) {
      this.effectsSlider.value = String(Math.round(s.effectsVolume * 100));
    }
    if (this.effectsValueText) {
      this.effectsValueText.textContent = `${Math.round(s.effectsVolume * 100)}%`;
    }

    if (this.musicSlider) {
      this.musicSlider.value = String(Math.round((s.musicVolume !== undefined ? s.musicVolume : 0.7) * 100));
    }
    if (this.musicValueText) {
      this.musicValueText.textContent = `${Math.round((s.musicVolume !== undefined ? s.musicVolume : 0.7) * 100)}%`;
    }

    this.updateMuteButtonDisplay(s.isMuted);
  }

  private selectQuality(quality: GraphicsQuality): void {
    this.qualityButtons.forEach((btn, q) => {
      if (q === quality) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  private selectControlScheme(scheme: MobileControlScheme): void {
    this.schemeButtons.forEach((btn, s) => {
      if (s === scheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  public show(): void {
    if (!this.container) return;
    this.syncFromSettings();
    this.isVisible = true;
    this.isNavigating = false;
    this.container.classList.remove('hidden');
    window.addEventListener('keydown', this.boundKeyDown);

    const btnBack = document.getElementById('btn-settings-back');
    btnBack?.focus();
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
