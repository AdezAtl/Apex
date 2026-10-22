export type GameplayCameraMode = 'chase' | 'close' | 'wide';

export interface ChaseCameraConfig {
  /** Distance behind vehicle at rest in meters */
  baseDistance: number;
  /** Height above vehicle center in meters */
  baseHeight: number;
  /** Minimum camera elevation above road deck to prevent ground clipping */
  minHeight: number;
  /** Look-ahead target distance along travel vector in meters */
  lookAheadDistance: number;
  /** Lateral look-ahead lead into turns based on steering and lateral acceleration */
  corneringLeadFactor: number;
  /** Damping speed for camera position smoothing */
  positionDamping: number;
  /** Damping speed for camera target look-at smoothing */
  targetDamping: number;
  /** Base damping speed for camera heading / yaw alignment */
  yawDamping: number;
  /** Dynamic yaw damping multiplier when turning sharply to prevent losing sight of the car */
  aggressiveYawDampingBonus: number;
  /** Angle offset multiplier responding to genuine drift/slip angle */
  driftYawOffsetFactor: number;
  /** Additional distance setback pulled at maximum speed */
  speedSetbackFactor: number;
  /** Base Field of View in radians at rest */
  baseFov: number;
  /** High-speed Field of View in radians */
  maxFov: number;
  /** Rate of FOV transition */
  fovDamping: number;
  /** Camera shake amplitude triggered by barrier impacts */
  shakeIntensity: number;
  /** Rate at which camera shake decays */
  shakeDecay: number;
}

/** Standard Chase View: Closer, lower, dramatic tarmac racing perspective */
export const DEFAULT_CAMERA_CONFIG: ChaseCameraConfig = {
  baseDistance: 4.85,
  baseHeight: 1.70,
  minHeight: 0.75,
  lookAheadDistance: 5.8,
  corneringLeadFactor: 1.25,
  positionDamping: 9.2,
  targetDamping: 12.0,
  yawDamping: 6.8,
  aggressiveYawDampingBonus: 3.5,
  driftYawOffsetFactor: 0.32,
  speedSetbackFactor: 1.05,
  baseFov: 0.94, // ~53.8 deg
  maxFov: 1.08,  // ~61.9 deg
  fovDamping: 5.0,
  shakeIntensity: 0.12,
  shakeDecay: 8.5,
};

/** Close Chase View: Closer, lower, intimate road feel */
export const CLOSE_CHASE_CONFIG: ChaseCameraConfig = {
  baseDistance: 4.3,
  baseHeight: 1.55,
  minHeight: 0.70,
  lookAheadDistance: 5.0,
  corneringLeadFactor: 0.95,
  positionDamping: 10.5,
  targetDamping: 13.0,
  yawDamping: 8.2,
  aggressiveYawDampingBonus: 4.0,
  driftYawOffsetFactor: 0.24,
  speedSetbackFactor: 0.80,
  baseFov: 0.88, // ~50.4 deg
  maxFov: 0.96,  // ~55.0 deg
  fovDamping: 5.2,
  shakeIntensity: 0.14,
  shakeDecay: 9.0,
};

/** Wide Chase View: Higher, panoramic view showcasing track & surrounding competitors */
export const WIDE_CHASE_CONFIG: ChaseCameraConfig = {
  baseDistance: 7.8,
  baseHeight: 2.85,
  minHeight: 1.10,
  lookAheadDistance: 8.0,
  corneringLeadFactor: 1.60,
  positionDamping: 7.0,
  targetDamping: 9.5,
  yawDamping: 5.5,
  aggressiveYawDampingBonus: 2.8,
  driftYawOffsetFactor: 0.40,
  speedSetbackFactor: 1.40,
  baseFov: 0.98, // ~56.2 deg
  maxFov: 1.12,  // ~64.2 deg
  fovDamping: 4.0,
  shakeIntensity: 0.10,
  shakeDecay: 8.0,
};

export const CAMERA_CONFIG_PRESETS: Record<GameplayCameraMode, ChaseCameraConfig> = {
  chase: DEFAULT_CAMERA_CONFIG,
  close: CLOSE_CHASE_CONFIG,
  wide: WIDE_CHASE_CONFIG,
};
