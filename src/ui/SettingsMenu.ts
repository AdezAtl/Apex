import { GraphicsQuality, SettingsManager } from '../settings/SettingsManager';

export interface SettingsMenuCallbacks {
  onQualityChange: (quality: GraphicsQuality) => void;
  onVolumeChange: (volume: number) => void;
  onEngineVolumeChange?: (volume: number) => void;
  onEffectsVolumeChange?: (volume: number) => void;
  onMuteToggle?: (isMuted: boolean) => void;
  onBack: () => void;
}

export class SettingsMenu {
  private container: HTMLElement | null = null;
  private callbacks: SettingsMenuCallbacks;
  private settingsManager: SettingsManager;
  private isVisible: boolean = false;
  private isNavigating: boolean = false;

  private qualityButtons: Map<GraphicsQuality, HTMLButtonElement> = new Map();
  private masterSlider: HTMLInputElement | null = null;
  private masterValueText: HTMLElement | null = null;
  private engineSlider: HTMLInputElement | null = null;
  private engineValueText: HTMLElement | null = null;
  private effectsSlider: HTMLInputElement | null = null;
  private effectsValueText: HTMLElement | null = null;
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

    this.masterSlider = document.getElementById('volume-slider') as HTMLInputElement;
    this.masterValueText = document.getElementById('volume-percentage');
    this.engineSlider = document.getElementById('engine-slider') as HTMLInputElement;
    this.engineValueText = document.getElementById('engine-percentage');
    this.effectsSlider = document.getElementById('effects-slider') as HTMLInputElement;
    this.effectsValueText = document.getElementById('effects-percentage');
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

    if (e.code === 'Escape' || e.code === 'Enter') {
      e.preventDefault();
      this.triggerBack();
    }
  }

  public syncFromSettings(): void {
    const s = this.settingsManager.getSettings();
    this.selectQuality(s.graphicsQuality);

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
