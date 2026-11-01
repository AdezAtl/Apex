import { Scene, Vector3 } from '@babylonjs/core';
import { Vehicle } from '../vehicle/Vehicle';
import { WaypointManager, LookaheadTarget } from './WaypointManager';
import { getPaintOptionById } from '../vehicle/PaintCustomization';
import { PersonalityTraits, PersonalityType, PERSONALITY_PRESETS } from './AIPersonality';
import { VehicleHandlingProfile, createHandlingProfile } from '../vehicle/VehicleHandlingProfile';
import { getVehicleById } from '../vehicle/VehicleCatalog';

export type AIDifficulty =
  | 'amateur'
  | 'rookie'
  | 'pro'
  | 'elite'
  | 'apex_elite'
  | 'easy'
  | 'normal'
  | 'hard';

export interface AIOpponentConfig {
  id: string;
  name: string;
  paintId: string;
  gridSlot: number; // 2, 3, or 4
  gridPosition: Vector3;
  gridYaw: number;
  driverPace?: number;
  difficulty?: AIDifficulty;
  personalityType?: PersonalityType;
  launchDelaySeconds?: number;
  vehicleId?: string;
  modelFile?: string;
  yawOffset?: number;
}

export interface DifficultyTuning {
  topSpeedMult: number;
  cornerSpeedMult: number;
  accelMult: number;
  brakeDecel: number;
  steerRate: number;
  lookaheadBase: number;
  lookaheadSpeedFactor: number;
  avoidanceMargin: number;
  gripFactor: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyTuning> = {
  // 1. Amateur: Relaxed pace, conservative cornering, forgiving acceleration/braking
  amateur: {
    topSpeedMult: 0.78,     // ~26.0 m/s (~94 km/h) — gentle, accessible straight speed
    cornerSpeedMult: 0.72,  // Very cautious apex speeds (~38 km/h hairpins, ~68 km/h sweepers)
    accelMult: 0.70,        // Relaxed, non-threatening acceleration out of corners
    brakeDecel: 6.0,        // Early, cautious braking zones
    steerRate: 3.5,         // Smooth, gentle steering transitions
    lookaheadBase: 10.0,    // Wide, forgiving racing line
    lookaheadSpeedFactor: 0.38,
    avoidanceMargin: 3.0,   // Wide berth around player and other cars across 13m road
    gripFactor: 0.80,       // Generous margin before traction loss
  },
  // 2. Rookie: Moderately paced, fewer mistakes, moderate competitive pressure
  rookie: {
    topSpeedMult: 0.88,     // ~29.3 m/s (~105 km/h) — balanced club pace
    cornerSpeedMult: 0.82,  // Consistent corner entry and exit (~44 km/h hairpins, ~77 km/h sweepers)
    accelMult: 0.82,        // Steady acceleration out of corners
    brakeDecel: 7.5,        // Measured braking zones
    steerRate: 4.4,         // Responsive steering rack
    lookaheadBase: 8.8,     // Cleaner racing lines
    lookaheadSpeedFactor: 0.32,
    avoidanceMargin: 2.6,   // Generous multi-lane racing room
    gripFactor: 0.90,       // Solid tire adhesion
  },
  // 3. Pro: Demands competent driving, strong acceleration management, competitive racing lines
  pro: {
    topSpeedMult: 1.00,     // ~33.3 m/s (120 km/h) — matches player benchmark top speed
    cornerSpeedMult: 0.96,  // Strong, competitive corner carry (~52 km/h hairpins, ~90 km/h sweepers)
    accelMult: 1.00,        // Matches player sports car pull
    brakeDecel: 9.5,        // Direct, crisp braking
    steerRate: 5.6,         // Direct steering rack response
    lookaheadBase: 7.2,     // Balanced, efficient racing lines
    lookaheadSpeedFactor: 0.28,
    avoidanceMargin: 2.2,   // Competitive racing room
    gripFactor: 1.00,       // Full standard tire grip
  },
  // 4. Elite: Aggressive but controlled, late braking, fast recovery, demands capable vehicle
  elite: {
    topSpeedMult: 1.12,     // ~37.3 m/s (~134 km/h) — rapid straight-line pace
    cornerSpeedMult: 1.08,  // Aggressive corner entry & exit carry (~58 km/h hairpins, ~101 km/h sweepers)
    accelMult: 1.18,        // Explosive power delivery out of corner exits
    brakeDecel: 12.0,       // Late-braking mastery into turns
    steerRate: 7.2,         // Fast, precise steering response
    lookaheadBase: 6.2,     // Tight apex clipping
    lookaheadSpeedFactor: 0.24,
    avoidanceMargin: 1.8,   // Confident overtaking clearance
    gripFactor: 1.12,       // High mechanical grip
  },
  // 5. Apex Elite: The pinnacle challenge, exceptionally difficult without top-tier car and flawless driving
  apex_elite: {
    topSpeedMult: 1.25,     // ~41.6 m/s (~150 km/h) — formidable straight-line velocity
    cornerSpeedMult: 1.20,  // Razor-sharp corner carry (~65 km/h hairpins, ~112 km/h sweepers)
    accelMult: 1.35,        // Maximum downforce pull and instant power application
    brakeDecel: 15.0,       // Threshold braking right on the limit
    steerRate: 9.5,         // Lightning-fast transient response
    lookaheadBase: 5.0,     // Perfect geometric apex clipping
    lookaheadSpeedFactor: 0.20,
    avoidanceMargin: 1.5,   // Relentless, assertive multi-lane positioning
    gripFactor: 1.28,       // Supreme aerodynamic & mechanical grip
  },

  // Backward compatibility aliases for existing verification suites:
  easy: {
    topSpeedMult: 0.82,
    cornerSpeedMult: 0.78,
    accelMult: 0.75,
    brakeDecel: 6.5,
    steerRate: 3.8,
    lookaheadBase: 9.5,
    lookaheadSpeedFactor: 0.35,
    avoidanceMargin: 3.0,
    gripFactor: 0.85,
  },
  normal: {
    topSpeedMult: 1.00,
    cornerSpeedMult: 0.96,
    accelMult: 1.00,
    brakeDecel: 9.5,
    steerRate: 5.6,
    lookaheadBase: 7.2,
    lookaheadSpeedFactor: 0.28,
    avoidanceMargin: 2.2,
    gripFactor: 1.00,
  },
  hard: {
    topSpeedMult: 1.16,
    cornerSpeedMult: 1.14,
    accelMult: 1.25,
    brakeDecel: 13.5,
    steerRate: 8.5,
    lookaheadBase: 5.8,
    lookaheadSpeedFactor: 0.22,
    avoidanceMargin: 1.6,
    gripFactor: 1.20,
  },
};

export class AIOpponent {
  public id: string;
  public name: string;
  public paintId: string;
  public difficulty: AIDifficulty;
  public tuning: DifficultyTuning;
  public driverPace: number = 1.0;

  /** Motion scale factor matching VehicleController to synchronize physics scale with speedometer */
  public speedScale: number = 0.75;

  // Visual vehicle instance
  public vehicle: Vehicle;
  public isLoaded: boolean = false;

  // Kinematic state
  public position: Vector3;
  public yawAngle: number;
  public forwardSpeed: number = 0; // m/s
  public lateralSpeed: number = 0; // m/s
  public steeringAngle: number = 0; // rad
  public wheelSpinAngle: number = 0; // rad
  public forwardAcceleration: number = 0; // m/s^2
  public lateralAcceleration: number = 0; // m/s^2

  // Staggered grid parameters
  public gridPosition: Vector3;
  public gridYaw: number;
  public gridSlot: number;

  // Race progression state
  public lapCount: number = 1;
  public prevTrackDist: number = 0;
  public trackDistance: number = 0;
  public totalDistance: number = 0;
  public isFinished: boolean = false;
  public finishTime: number = 0;

  // Personality & Behavioral Dynamics
  public personality: PersonalityTraits;
  public launchDelaySeconds: number = 0;
  private raceTimer: number = 0;
  private passCommitmentTimer: number = 0;
  private chosenPassSide: number = 0;

  // Handling Profile & Model Configuration
  public profile: VehicleHandlingProfile;
  public modelFile: string = 'APX01.glb';
  public yawOffset: number = 0;

  // Local avoidance offset
  private lateralAvoidanceOffset: number = 0;
  private currentAvoidanceOffset: number = 0;

  // Off-track recovery flag
  private isRecovering: boolean = false;

  constructor(scene: Scene, config: AIOpponentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.paintId = config.paintId;
    this.gridSlot = config.gridSlot;
    this.gridPosition = config.gridPosition.clone();
    this.gridYaw = config.gridYaw;
    this.driverPace = config.driverPace || 1.0;
    this.difficulty = config.difficulty || 'normal';
    this.tuning = { ...DIFFICULTY_PRESETS[this.difficulty] };

    const pType = config.personalityType || 'technician';
    this.personality = { ...PERSONALITY_PRESETS[pType] };
    this.launchDelaySeconds = config.launchDelaySeconds || 0;

    // Resolve vehicle model & handling profile from catalog or default
    const catalogItem = config.vehicleId ? getVehicleById(config.vehicleId) : undefined;
    if (catalogItem) {
      this.profile = createHandlingProfile(catalogItem.specs, catalogItem.id, catalogItem.name, catalogItem.tier);
      this.modelFile = catalogItem.fileName;
      this.yawOffset = catalogItem.yawOffset || 0;
    } else {
      this.profile = createHandlingProfile({
        topSpeedKmH: 260,
        accelerationSec: 4.0,
        handlingRating: 83,
        weightKg: 1280,
        powerHp: 420,
        drivetrain: 'RWD',
        brakingForce: 26.0,
        downforceRating: 68,
      }, this.id, this.name, 3);
      this.modelFile = config.modelFile || 'APX01.glb';
      this.yawOffset = config.yawOffset || 0;
    }

    this.position = this.gridPosition.clone();
    this.yawAngle = this.gridYaw;

    this.vehicle = new Vehicle(scene);
  }

  public async load(): Promise<void> {
    await this.vehicle.load(this.modelFile, this.position, this.yawAngle, this.paintId, this.yawOffset);
    // Explicitly apply opponent livery paint
    const paint = getPaintOptionById(this.paintId);
    this.vehicle.applyPaint(paint);
    this.isLoaded = true;
  }

  public applyHandlingProfile(profile: VehicleHandlingProfile): void {
    this.profile = { ...profile };
  }

  public setDifficulty(diff: AIDifficulty): void {
    this.difficulty = diff;
    this.tuning = { ...DIFFICULTY_PRESETS[diff] };
  }

  public resetToGrid(): void {
    this.position.copyFrom(this.gridPosition);
    this.yawAngle = this.gridYaw;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.steeringAngle = 0;
    this.wheelSpinAngle = 0;
    this.forwardAcceleration = 0;
    this.lateralAcceleration = 0;
    this.lapCount = 1;
    this.prevTrackDist = 0;
    this.trackDistance = 0;
    this.totalDistance = 0;
    this.isFinished = false;
    this.finishTime = 0;
    this.raceTimer = 0;
    this.passCommitmentTimer = 0;
    this.chosenPassSide = 0;
    this.lateralAvoidanceOffset = 0;
    this.currentAvoidanceOffset = 0;
    this.isRecovering = false;

    if (this.isLoaded) {
      this.vehicle.applyTransform(this.position, this.yawAngle);
      this.vehicle.updateWheels(0, 0);
      this.vehicle.resetBodyMotion();
    }
  }

  /**
   * Main AI Physics and Navigation Update.
   */
  public update(
    dt: number,
    waypointManager: WaypointManager,
    otherVehicles: { position: Vector3; forwardSpeed: number }[]
  ): void {
    if (!this.isLoaded || dt <= 0) return;
    const clampedDt = Math.min(dt, 0.05);

    // 0. Staggered Grid Launch Reaction
    this.raceTimer += clampedDt;
    if (this.raceTimer < this.launchDelaySeconds) {
      this.forwardSpeed = 0;
      this.lateralSpeed = 0;
      this.steeringAngle = 0;
      this.updateVisuals(clampedDt);
      return;
    }

    // 1. Update track progress and lap counter
    this.trackDistance = waypointManager.getTrackDistance(this.position);

    // Detect lap completion: sudden wrap-around from end of lap to start
    if (
      this.prevTrackDist > waypointManager.trackLength * 0.88 &&
      this.trackDistance < waypointManager.trackLength * 0.15
    ) {
      this.lapCount++;
    }
    this.prevTrackDist = this.trackDistance;
    this.totalDistance = (this.lapCount - 1) * waypointManager.trackLength + this.trackDistance;

    // If finished, smoothly brake to a stop
    if (this.isFinished) {
      this.forwardSpeed = Math.max(0, this.forwardSpeed - 6.0 * clampedDt);
      this.integratePosition(clampedDt);
      this.updateVisuals(clampedDt);
      return;
    }

    // 2. Lookahead Navigation Target
    const lookaheadDist = Math.max(
      this.tuning.lookaheadBase,
      this.tuning.lookaheadBase + this.forwardSpeed * this.tuning.lookaheadSpeedFactor
    );

    const target: LookaheadTarget = waypointManager.getLookaheadTarget(
      this.position,
      lookaheadDist,
      this.currentAvoidanceOffset
    );

    // 3. Obstacle Avoidance & Tactical Personality Positioning
    this.calculateAvoidance(otherVehicles, target.curvatureDeg, clampedDt);
    // Smoothly blend avoidance offset to prevent steering snap
    const blendRate = 3.5;
    this.currentAvoidanceOffset +=
      (this.lateralAvoidanceOffset - this.currentAvoidanceOffset) *
      Math.min(1.0, clampedDt * blendRate);

    // 4. Pure Pursuit Steering with Hunting Suppression & Smoothing
    const toTarget = target.targetPoint.subtract(this.position);
    toTarget.y = 0;
    const targetAngle = Math.atan2(toTarget.x, toTarget.z);

    // Angular difference relative to current vehicle heading
    let angleDiff = targetAngle - this.yawAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Steering deadzone: suppress micro-oscillations when heading is within 0.02 rad (~1.15 deg)
    if (Math.abs(angleDiff) < 0.02) {
      angleDiff = 0;
    }

    // Check off-track distance
    const distToCenter = Vector3.Distance(
      new Vector3(this.position.x, 0, this.position.z),
      new Vector3(target.targetPoint.x, 0, target.targetPoint.z)
    );
    this.isRecovering = distToCenter > 4.2;

    // Target steering angle clamped to vehicle's physical maximum steering lock
    const maxSteer = this.profile.maxSteerAngle;
    const targetSteerAngle = Math.max(-maxSteer, Math.min(maxSteer, angleDiff * 1.55));

    // Rate-limited by both vehicle steering rack capability and driver difficulty
    const effectiveSteerRate = Math.min(this.tuning.steerRate, this.profile.steerRate);
    const steerStep = effectiveSteerRate * clampedDt;
    const targetDelta = targetSteerAngle - this.steeringAngle;
    const smoothStep = targetDelta * Math.min(1.0, clampedDt * this.personality.steeringSmoothness);
    this.steeringAngle += Math.max(-steerStep, Math.min(steerStep, smoothStep));

    // 5. Corner-Aware Speed Profiling & Throttle / Brake derived from vehicle handling profile
    const targetTopSpeed = this.profile.maxForwardSpeed * this.tuning.topSpeedMult * (this.driverPace || 1.0);

    // Corner speed scaled by vehicle mechanical grip and aerodynamic downforce
    const gripRatio = this.profile.normalLateralGrip / 12.0;
    const speedRatio = Math.min(1.0, this.forwardSpeed / Math.max(10.0, this.profile.maxForwardSpeed));
    const aeroFactor = 1.0 + (this.profile.downforceRating / 100) * 0.22 * Math.pow(speedRatio, 2);

    let desiredSpeed = target.targetSpeed * gripRatio * aeroFactor * this.tuning.cornerSpeedMult * (this.driverPace || 1.0) * this.personality.cornerEntrySpeedFactor;
    // On straights, let targetTopSpeed govern
    if (target.curvatureDeg < 14) {
      desiredSpeed = targetTopSpeed;
    }
    if (this.isRecovering) {
      desiredSpeed = Math.min(desiredSpeed, 11.0); // Slow down to recover composure cleanly
    }

    const speedDiff = desiredSpeed - this.forwardSpeed;
    const prevSpeed = this.forwardSpeed;

    if (speedDiff > 0.4) {
      // Progressive acceleration power curve matching vehicle dynamics and drivetrain launch traction
      const speedFraction = Math.max(0, this.forwardSpeed) / (targetTopSpeed + 1.0);
      const powerCurve = Math.max(0.20, 1.0 - Math.pow(Math.min(1.0, speedFraction), 1.25));

      let launchMultiplier = 1.0;
      if (this.forwardSpeed < 16.0) {
        const launchBlend = 1.0 - (Math.max(0, this.forwardSpeed) / 16.0);
        launchMultiplier = 1.0 + (this.profile.launchTractionFactor - 1.0) * launchBlend;
      }

      const accelRate = this.profile.acceleration * this.tuning.accelMult * powerCurve * launchMultiplier;
      this.forwardSpeed += Math.min(speedDiff, Math.max(1.8, accelRate) * clampedDt);
      if (this.forwardSpeed > targetTopSpeed) {
        this.forwardSpeed = targetTopSpeed;
      }
      this.forwardAcceleration = (this.forwardSpeed - prevSpeed) / clampedDt;
    } else if (speedDiff < -0.4) {
      // Deceleration in braking zones modulated by vehicle brake force, difficulty tuning, and personality
      const brakeRate = this.profile.brakeForce * (this.tuning.brakeDecel / 9.5) * this.personality.brakeMarginMultiplier;
      this.forwardSpeed = Math.max(
        desiredSpeed,
        this.forwardSpeed - brakeRate * clampedDt
      );
      this.forwardAcceleration = (this.forwardSpeed - prevSpeed) / clampedDt;
    } else {
      // Coasting / maintaining
      this.forwardAcceleration = 0;
    }

    // Aggressor calculated risk: occasional slight entry slide under high lateral G
    if (this.personality.riskFactor > 0.15 && Math.abs(this.lateralAcceleration) > 8.5 && Math.random() < 0.05) {
      this.lateralSpeed += (Math.random() - 0.5) * 1.0 * this.personality.riskFactor;
    }

    // 6. Kinematic Vehicle Movement Integration
    this.integratePosition(clampedDt);

    // 7. Track Boundary Containment (Repel softly if brushing track barriers)
    this.clampToTrackBarriers(waypointManager);

    // 8. Update 3D Meshes & Wheels
    this.updateVisuals(clampedDt);
  }

  /**
   * Scans ahead for nearby vehicles, applies overtaking commitments, and tactical personality positioning.
   */
  private calculateAvoidance(
    otherVehicles: { position: Vector3; forwardSpeed: number }[],
    upcomingCurvatureDeg: number,
    dt: number
  ): void {
    if (this.passCommitmentTimer > 0) {
      this.passCommitmentTimer -= dt;
    }

    this.lateralAvoidanceOffset = 0;
    const forwardDir = new Vector3(Math.sin(this.yawAngle), 0, Math.cos(this.yawAngle));
    const rightDir = new Vector3(Math.cos(this.yawAngle), 0, -Math.sin(this.yawAngle));

    let closestDist = Infinity;
    let chosenOffset = 0;
    const margin = this.tuning.avoidanceMargin;

    // 1. Scan ahead for vehicles to overtake or avoid
    const scanDist = Math.max(14.0, this.personality.overtakeThresholdDistance);
    for (const other of otherVehicles) {
      const rel = other.position.subtract(this.position);
      rel.y = 0;
      const forwardProj = Vector3.Dot(rel, forwardDir);
      const lateralProj = Vector3.Dot(rel, rightDir);

      // Check if vehicle is ahead within warning zone across wide multi-lane road
      if (forwardProj > 0.8 && forwardProj < scanDist && Math.abs(lateralProj) < 3.4) {
        if (forwardProj < closestDist) {
          closestDist = forwardProj;
          // Retain committed pass side if timer is active
          if (this.passCommitmentTimer > 0 && this.chosenPassSide !== 0) {
            chosenOffset = this.chosenPassSide * margin;
          } else {
            // Aggressor dives inside into corners if upcoming turn detected
            if (this.personality.insideDiveAssertiveness > 0.5 && Math.abs(upcomingCurvatureDeg) > 10) {
              const insideSide = upcomingCurvatureDeg > 0 ? 1 : -1;
              this.chosenPassSide = insideSide;
              chosenOffset = insideSide * margin;
            } else if (lateralProj >= 0) {
              this.chosenPassSide = -1;
              chosenOffset = -margin;
            } else {
              this.chosenPassSide = 1;
              chosenOffset = margin;
            }
            this.passCommitmentTimer = this.personality.passCommitmentSeconds;
          }
        }
      }
    }

    // 2. Tactical defense: Challenger protects inside line when followed closely
    if (chosenOffset === 0 && this.personality.defensiveTriggerDistance > 0) {
      for (const other of otherVehicles) {
        const rel = other.position.subtract(this.position);
        rel.y = 0;
        const forwardProj = Vector3.Dot(rel, forwardDir);
        const lateralProj = Vector3.Dot(rel, rightDir);

        if (forwardProj < -0.8 && forwardProj > -this.personality.defensiveTriggerDistance && Math.abs(lateralProj) < 3.5) {
          const turnSign = Math.sign(upcomingCurvatureDeg);
          if (turnSign !== 0) {
            chosenOffset = turnSign * this.personality.defensiveLateralShift;
          } else {
            chosenOffset = lateralProj > 0 ? 0.6 : -0.6;
          }
          break;
        }
      }
    }

    // 3. Apex kerb clipping for geometric or aggressive apex bite
    if (chosenOffset === 0 && Math.abs(upcomingCurvatureDeg) > 15) {
      chosenOffset = Math.sign(upcomingCurvatureDeg) * (this.personality.apexKerbClipping * 0.75);
    }

    this.lateralAvoidanceOffset = chosenOffset;
  }

  /**
   * Moves vehicle forward along heading and turns according to steering angle.
   */
  private integratePosition(dt: number): void {
    // Yaw rate from bicycle model approximation tuned with peak tier gripFactor: yawRate = (v / wheelbase) * tan(steer) * gripFactor
    const wheelbase = 2.65;
    const effectiveYawRate = (this.forwardSpeed / wheelbase) * Math.tan(this.steeringAngle) * this.tuning.gripFactor;
    this.yawAngle += effectiveYawRate * dt;

    // Normalize yaw
    while (this.yawAngle > Math.PI) this.yawAngle -= Math.PI * 2;
    while (this.yawAngle < -Math.PI) this.yawAngle += Math.PI * 2;

    // Forward displacement scaled to track physics
    const forwardX = Math.sin(this.yawAngle);
    const forwardZ = Math.cos(this.yawAngle);

    // Lateral slip dampening
    const lateralX = Math.cos(this.yawAngle);
    const lateralZ = -Math.sin(this.yawAngle);
    this.lateralSpeed *= Math.max(0, 1.0 - 8.0 * dt);

    this.position.x += (forwardX * this.forwardSpeed * this.speedScale + lateralX * this.lateralSpeed * this.speedScale) * dt;
    this.position.z += (forwardZ * this.forwardSpeed * this.speedScale + lateralZ * this.lateralSpeed * this.speedScale) * dt;
    this.position.y = 0.05;

    // Wheel spin angle accumulation (radius ~0.33m)
    this.wheelSpinAngle += (this.forwardSpeed * this.speedScale * dt) / 0.33;

    // Lateral acceleration calculation
    this.lateralAcceleration = this.forwardSpeed * effectiveYawRate;
  }

  /**
   * Barrier safety clamping to ensure AI remains on paved circuit.
   */
  private clampToTrackBarriers(waypointManager: WaypointManager): void {
    const closestWp = waypointManager.findClosestWaypoint(this.position);
    const toCar = this.position.subtract(closestWp.position);
    toCar.y = 0;
    const distToCenter = toCar.length();

    // Corner-adaptive boundary containment based on local curvature
    const curv = closestWp.curvatureDeg || 0;
    const maxRoadWidth = Math.max(4.5, Math.min(6.5, 6.5 - curv * 0.35));
    if (distToCenter > maxRoadWidth && distToCenter > 0.001) {
      // Gently push back inside
      const dirToCenter = toCar.scale(-1.0 / distToCenter);
      const correction = distToCenter - maxRoadWidth;
      this.position.x += dirToCenter.x * correction;
      this.position.z += dirToCenter.z * correction;

      // Dampen forward speed on wall brush
      this.forwardSpeed *= 0.95;
    }
  }

  /**
   * Updates visual 3D mesh transforms, wheels, and suspension dynamics.
   */
  public updateVisuals(dt: number): void {
    if (!this.isLoaded) return;
    this.vehicle.applyTransform(this.position, this.yawAngle);
    this.vehicle.updateWheels(this.wheelSpinAngle, this.steeringAngle);
    this.vehicle.updateBodyMotion(dt, this.forwardAcceleration, this.lateralAcceleration);
  }

  public dispose(): void {
    if (this.vehicle) {
      this.vehicle.dispose();
    }
    this.isLoaded = false;
  }
}
