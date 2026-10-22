import { Scene, UniversalCamera, Vector3, Scalar } from '@babylonjs/core';
import {
  ChaseCameraConfig,
  GameplayCameraMode,
  CAMERA_CONFIG_PRESETS,
} from './CameraConfig';

export class ChaseCamera {
  public camera: UniversalCamera;
  public config: ChaseCameraConfig;
  public mode: GameplayCameraMode = 'chase';

  // Smoothly blended target parameters across camera modes
  private currentDistance: number;
  private currentHeight: number;
  private currentLookAhead: number;
  private currentBaseFov: number;
  private currentMaxFov: number;

  // Active runtime state
  private currentPosition: Vector3 = new Vector3(0, 0, 0);
  private currentTarget: Vector3 = new Vector3(0, 0, 0);
  public smoothedYaw: number = 0;
  public lastSlipAngle: number = 0;
  public targetCameraYaw: number = 0;
  private shakeTrauma: number = 0;
  public roadSurfaceY: number = 0.05;

  // Cinematic override state
  public isCinematicActive: boolean = false;
  private cinematicPosition: Vector3 = new Vector3(0, 0, 0);
  private cinematicTarget: Vector3 = new Vector3(0, 0, 0);
  private cinematicFov: number = 0.85;

  constructor(
    scene: Scene,
    initialPosition: Vector3,
    initialYaw: number,
    initialMode: GameplayCameraMode = 'chase'
  ) {
    this.mode = initialMode;
    this.config = { ...CAMERA_CONFIG_PRESETS[initialMode] };

    this.currentDistance = this.config.baseDistance;
    this.currentHeight = this.config.baseHeight;
    this.currentLookAhead = this.config.lookAheadDistance;
    this.currentBaseFov = this.config.baseFov;
    this.currentMaxFov = this.config.maxFov;

    this.smoothedYaw = initialYaw;
    this.targetCameraYaw = initialYaw;
    this.roadSurfaceY = initialPosition.y;

    this.camera = new UniversalCamera('ChaseCamera', initialPosition.clone(), scene);
    this.camera.fov = this.currentBaseFov;
    this.camera.minZ = 0.2;
    this.camera.maxZ = 350;

    const forward = new Vector3(Math.sin(initialYaw), 0, Math.cos(initialYaw));
    this.currentPosition = initialPosition
      .subtract(forward.scale(this.currentDistance))
      .add(new Vector3(0, this.currentHeight, 0));
    this.currentTarget = initialPosition.add(new Vector3(0, 1.05, 0));

    this.camera.position.copyFrom(this.currentPosition);
    this.camera.setTarget(this.currentTarget);
  }

  /**
   * Sets gameplay camera mode (standard, close, wide) with smooth blending.
   */
  public setMode(newMode: GameplayCameraMode): void {
    this.mode = newMode;
    this.config = { ...CAMERA_CONFIG_PRESETS[newMode] };
  }

  /**
   * Main camera update routine called every frame during driving.
   */
  public update(
    targetPos: Vector3,
    vehicleYaw: number,
    forwardSpeed: number,
    lateralSpeed: number,
    steeringAngle: number = 0,
    dt: number = 0.016
  ): void {
    const clampedDt = Math.min(dt, 0.1);
    if (clampedDt <= 0) return;

    // Handle cinematic override if engaged
    if (this.isCinematicActive) {
      const blendSpeed = 8.0 * clampedDt;
      this.currentPosition = Vector3.Lerp(this.currentPosition, this.cinematicPosition, blendSpeed);
      this.currentTarget = Vector3.Lerp(this.currentTarget, this.cinematicTarget, blendSpeed);
      this.camera.position.copyFrom(this.currentPosition);
      this.camera.setTarget(this.currentTarget);
      this.camera.fov = Scalar.Lerp(this.camera.fov, this.cinematicFov, blendSpeed);
      return;
    }

    // Smoothly blend preset parameters when camera mode switches
    const modeBlendSpeed = Math.min(1.0, clampedDt * 6.0);
    this.currentDistance += (this.config.baseDistance - this.currentDistance) * modeBlendSpeed;
    this.currentHeight += (this.config.baseHeight - this.currentHeight) * modeBlendSpeed;
    this.currentLookAhead += (this.config.lookAheadDistance - this.currentLookAhead) * modeBlendSpeed;
    this.currentBaseFov += (this.config.baseFov - this.currentBaseFov) * modeBlendSpeed;
    this.currentMaxFov += (this.config.maxFov - this.currentMaxFov) * modeBlendSpeed;

    const speedRatio = Math.min(1.0, Math.abs(forwardSpeed) / 33.3);

    // 1. DRIFT-AWARE & APEX-RESPONSIVE CAMERA YAW
    const actualSlipAngle = Math.atan2(lateralSpeed, Math.abs(forwardSpeed) + 0.1);
    this.lastSlipAngle = actualSlipAngle;

    // Subtle drift yaw offset showcases vehicle slide while keeping sight of the road ahead
    const targetCameraYaw = vehicleYaw + actualSlipAngle * this.config.driftYawOffsetFactor;
    this.targetCameraYaw = targetCameraYaw;

    // Angle wrapping to prevent 360° flipping
    let yawDiff = targetCameraYaw - this.smoothedYaw;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

    // Adaptive yaw damping: accelerates tracking through hairpins to keep car visible
    const sharpTurnFactor = Math.min(1.0, Math.abs(yawDiff) / 0.65);
    const effectiveYawDamping = this.config.yawDamping + sharpTurnFactor * this.config.aggressiveYawDampingBonus;
    const yawAlpha = 1.0 - Math.exp(-effectiveYawDamping * clampedDt);
    this.smoothedYaw += yawDiff * yawAlpha;

    // 2. SPEED-BASED SETBACK & ELEVATION
    const dynamicDistance = this.currentDistance + speedRatio * this.config.speedSetbackFactor;
    const dynamicHeight = this.currentHeight + speedRatio * 0.25;

    const camDir = new Vector3(Math.sin(this.smoothedYaw), 0, Math.cos(this.smoothedYaw));
    const idealPosition = targetPos
      .subtract(camDir.scale(dynamicDistance))
      .add(new Vector3(0, dynamicHeight, 0));

    // Clamp camera minimum elevation above track deck
    idealPosition.y = Math.max(this.roadSurfaceY + this.config.minHeight, idealPosition.y);

    // 3. LOOK-AHEAD TARGET WITH CORNERING LEAD (LOOKS INTO THE TURN APEX)
    const travelDir = new Vector3(Math.sin(vehicleYaw), 0, Math.cos(vehicleYaw));
    const lateralDir = new Vector3(Math.cos(vehicleYaw), 0, -Math.sin(vehicleYaw));

    // Cornering lead pulls camera gaze slightly toward inside of corner
    const cornerLead = (lateralSpeed * 0.12 + steeringAngle * 1.8) * this.config.corneringLeadFactor;
    const idealTarget = targetPos
      .add(travelDir.scale(this.currentLookAhead * Math.max(0.40, speedRatio)))
      .add(lateralDir.scale(cornerLead))
      .add(new Vector3(0, 1.05, 0));

    // 4. SMOOTH INTERPOLATION (POSITION & LOOK-AT TARGET)
    const posAlpha = 1.0 - Math.exp(-this.config.positionDamping * clampedDt);
    this.currentPosition = Vector3.Lerp(this.currentPosition, idealPosition, posAlpha);

    const targetAlpha = 1.0 - Math.exp(-this.config.targetDamping * clampedDt);
    this.currentTarget = Vector3.Lerp(this.currentTarget, idealTarget, targetAlpha);

    // 5. SPEED-BASED DYNAMIC FOV
    const targetFov = this.currentBaseFov + speedRatio * (this.currentMaxFov - this.currentBaseFov);
    const fovAlpha = 1.0 - Math.exp(-this.config.fovDamping * clampedDt);
    this.camera.fov = Scalar.Lerp(this.camera.fov, targetFov, fovAlpha);

    // 6. CAMERA SHAKE ON IMPACTS
    let shakeOffset = new Vector3(0, 0, 0);
    if (this.shakeTrauma > 0.001) {
      const shakeMag = (this.shakeTrauma * this.shakeTrauma) * this.config.shakeIntensity;
      shakeOffset = new Vector3(
        (Math.random() - 0.5) * 2 * shakeMag,
        (Math.random() - 0.5) * 1.5 * shakeMag,
        (Math.random() - 0.5) * 2 * shakeMag
      );
      this.shakeTrauma = Math.max(0, this.shakeTrauma - this.config.shakeDecay * clampedDt);
    }

    this.camera.position.copyFrom(this.currentPosition.add(shakeOffset));
    this.camera.setTarget(this.currentTarget.add(shakeOffset.scale(0.5)));
  }

  // ==========================================
  // CINEMATIC MOMENTS INTEGRATION
  // ==========================================

  /**
   * Sets manual cinematic override coordinates.
   */
  public setCinematicTarget(pos: Vector3, target: Vector3, fov: number = 0.85): void {
    this.isCinematicActive = true;
    this.cinematicPosition.copyFrom(pos);
    this.cinematicTarget.copyFrom(target);
    this.cinematicFov = fov;
  }

  public clearCinematic(): void {
    this.isCinematicActive = false;
  }

  /**
   * Starting grid cinematic sweep:
   * Arcs from low front-quarter view around to the rear, docking cleanly at progress = 1.0.
   */
  public updateGridSweep(progress: number, carPos: Vector3, carYaw: number): void {
    const clampedProgress = Math.max(0, Math.min(1.0, progress));
    // Ease-in-out curve
    const t = 0.5 - 0.5 * Math.cos(clampedProgress * Math.PI);

    // Arc angle relative to car: starts at -2.4 rad (~137 deg front-side) and ends at 0 rad (directly behind)
    const startAngle = carYaw - 2.4;
    const endAngle = carYaw;
    const currentAngle = startAngle + (endAngle - startAngle) * t;

    // Radius and height sweep
    const radius = 5.6 - 0.4 * t;
    const height = 1.25 + 0.8 * t;

    const camX = carPos.x - Math.sin(currentAngle) * radius;
    const camZ = carPos.z - Math.cos(currentAngle) * radius;
    const camY = carPos.y + height;

    const targetY = carPos.y + 0.9 + 0.25 * t;
    const targetPoint = new Vector3(carPos.x, targetY, carPos.z);

    this.setCinematicTarget(new Vector3(camX, camY, camZ), targetPoint, 0.84 + 0.08 * t);
    this.smoothedYaw = currentAngle;
  }

  /**
   * Celebratory finish line tracking shot:
   * Low trackside angle framing the slowing vehicle.
   */
  public updateFinishSweep(progress: number, carPos: Vector3, carYaw: number): void {
    const t = Math.max(0, Math.min(1.0, progress));
    const forward = new Vector3(Math.sin(carYaw), 0, Math.cos(carYaw));
    const right = new Vector3(Math.cos(carYaw), 0, -Math.sin(carYaw));

    // Camera sits ahead and to the side, looking back at the crossing car
    const camPos = carPos
      .add(forward.scale(7.5 - t * 2.0))
      .add(right.scale(3.2 + t * 0.8))
      .add(new Vector3(0, 1.35 + t * 0.4, 0));

    const targetPos = carPos.add(new Vector3(0, 1.0, 0));
    this.setCinematicTarget(camPos, targetPos, 0.80);
  }

  public triggerImpactShake(intensity: number = 0.8): void {
    this.shakeTrauma = Math.min(1.0, this.shakeTrauma + intensity);
  }

  public reset(targetPos: Vector3, yawAngle: number): void {
    this.smoothedYaw = yawAngle;
    this.shakeTrauma = 0;
    this.isCinematicActive = false;
    const forward = new Vector3(Math.sin(yawAngle), 0, Math.cos(yawAngle));
    this.currentPosition = targetPos
      .subtract(forward.scale(this.currentDistance))
      .add(new Vector3(0, this.currentHeight, 0));
    this.currentTarget = targetPos.add(new Vector3(0, 1.15, 0));
    this.camera.position.copyFrom(this.currentPosition);
    this.camera.setTarget(this.currentTarget);
    this.camera.fov = this.currentBaseFov;
  }

  public dispose(): void {
    this.camera.dispose();
  }
}
