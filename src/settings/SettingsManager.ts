import { GameplayCameraMode } from '../camera/CameraConfig';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  engineVolume: number;
  effectsVolume: number;
  isMuted: boolean;
  vehiclePaintId: string;
  selectedVehicleId: string;
  preferredCameraMode: GameplayCameraMode;
}

export class SettingsManager {
  private static readonly STORAGE_KEY = 'project_apex_settings';
  private settings: GameSettings;

  constructor() {
    this.settings = this.loadSettings();
  }

  private loadSettings(): GameSettings {
    const defaults: GameSettings = {
      graphicsQuality: 'medium',
      masterVolume: 0.8,
      engineVolume: 0.8,
      effectsVolume: 0.8,
      isMuted: false,
      vehiclePaintId: 'pearl_white',
      selectedVehicleId: 'mercedes_slc',
      preferredCameraMode: 'chase',
    };

    try {
      const raw = localStorage.getItem(SettingsManager.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (['low', 'medium', 'high'].includes(parsed.graphicsQuality)) {
          defaults.graphicsQuality = parsed.graphicsQuality;
        }
        if (typeof parsed.masterVolume === 'number') {
          defaults.masterVolume = Math.max(0, Math.min(1.0, parsed.masterVolume));
        }
        if (typeof parsed.engineVolume === 'number') {
          defaults.engineVolume = Math.max(0, Math.min(1.0, parsed.engineVolume));
        }
        if (typeof parsed.effectsVolume === 'number') {
          defaults.effectsVolume = Math.max(0, Math.min(1.0, parsed.effectsVolume));
        }
        if (typeof parsed.isMuted === 'boolean') {
          defaults.isMuted = parsed.isMuted;
        }
        if (typeof parsed.vehiclePaintId === 'string' && parsed.vehiclePaintId.trim().length > 0) {
          defaults.vehiclePaintId = parsed.vehiclePaintId.trim();
        }
        if (['chase', 'close', 'wide'].includes(parsed.preferredCameraMode)) {
          defaults.preferredCameraMode = parsed.preferredCameraMode;
        }
      }
    } catch {}

    return defaults;
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public getPreferredCameraMode(): GameplayCameraMode {
    return this.settings.preferredCameraMode || 'chase';
  }

  public setPreferredCameraMode(mode: GameplayCameraMode): void {
    this.settings.preferredCameraMode = mode;
    this.saveSettings();
  }

  public getVehiclePaintId(): string {
    return this.settings.vehiclePaintId || 'pearl_white';
  }

  public setVehiclePaintId(paintId: string): void {
    this.settings.vehiclePaintId = paintId;
    this.saveSettings();
  }

  public getSelectedVehicleId(): string {
    return this.settings.selectedVehicleId || 'mercedes_slc';
  }

  public setSelectedVehicleId(vehicleId: string): void {
    this.settings.selectedVehicleId = vehicleId;
    this.saveSettings();
  }

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.settings.graphicsQuality = quality;
    this.saveSettings();
  }

  public setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1.0, volume));
    this.saveSettings();
  }

  public setEngineVolume(volume: number): void {
    this.settings.engineVolume = Math.max(0, Math.min(1.0, volume));
    this.saveSettings();
  }

  public setEffectsVolume(volume: number): void {
    this.settings.effectsVolume = Math.max(0, Math.min(1.0, volume));
    this.saveSettings();
  }

  public setMuted(muted: boolean): void {
    this.settings.isMuted = muted;
    this.saveSettings();
  }

  public toggleMute(): boolean {
    this.settings.isMuted = !this.settings.isMuted;
    this.saveSettings();
    return this.settings.isMuted;
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SettingsManager.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (err) {
      console.warn('[SettingsManager] Failed to persist settings:', err);
    }
  }
}
