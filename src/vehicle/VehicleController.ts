import { Vector3 } from '@babylonjs/core';
import { InputState } from '../input/InputManager';
import { VehicleHandlingConfig, DEFAULT_VEHICLE_CONFIG } from './VehicleConfig';
import { VehicleHandlingProfile, createHandlingProfile } from './VehicleHandlingProfile';

export interface VehicleTelemetry {
  speedKmh: number;
  forwardSpeed: number;
  lateralSpeed: number;
  slipAngleDeg: number;
  steeringAngleDeg: number;
  isDrifting: boolean;
  handbrakeActive: boolean;
  gear: string; // '1' | '2' | '3' | '4' | '5' | '6' | 'N' | 'R'
  gearNumber: number; // 1-6, 0 for N, -1 for R
  engineRpm: number; // 950 - 7200 RPM
  throttleLoad: number; // 0.0 to 1.0
  didShiftThisFrame: boolean;

  // Extended physics telemetry for diagnostics and debug overlay
  profileName?: string;
  tier?: number;
  drivetrain?: string;
  weightKg?: number;
  powerHp?: number;
  downforceRating?: number;
  handlingRating?: number;
  effectiveGrip?: number;
  baseGrip?: number;
  aeroGripBonus?: number;
  forwardAcceleration?: number;
  lateralAcceleration?: number;
  rotationalInertia?: number;
  throttleInput?: boolean;
  brakeInput?: boolean;
  handbrakeInput?: boolean;
}

export class VehicleController {
  public config: VehicleHandlingConfig;
  public currentProfile: VehicleHandlingProfile;

  // Kinematic & physical state
  public position: Vector3;
  public yawAngle: number; // in world radians
  public forwardSpeed: number = 0; // m/s along car longitudinal axis
  public lateralSpeed: number = 0; // m/s along car transverse axis
  public yawRate: number = 0; // rad/s
  public steeringAngle: number = 0; // rad
  public wheelSpinAngle: number = 0; // rad
  public velocity: Vector3 = new Vector3(0, 0, 0);
  public forwardAcceleration: number = 0; // m/s^2
  public lateralAcceleration: number = 0; // m/s^2
  public isHandbrakeEngaged: boolean = false;

  // Diagnostics and live physics measurements
  public latestEffectiveGrip: number = 13.0;
  public latestAeroBonus: number = 0.0;
  public lastInputState: InputState = {
    forward: false,
    backward: false,
    steerLeft: false,
    steerRight: false,
    handbrake: false,
    reset: false,
    pause: false,
    toggleCamera: false,
  };

  // Transmission & powertrain state
  public currentGear: number = 0; // 0: N, 1-6: Drive, -1: R
  public engineRpm: number = 950;
  public throttleLoad: number = 0;
  public didShiftThisFrame: boolean = false;

  // Surface and boundary parameters
  public roadSurfaceY: number = 0.05;
  /** Motion scale factor to tune movement speed to track scale without reducing speedometer top speed */
  public speedScale: number = 0.75;
  private startPosition: Vector3;
  private startYaw: number;

  constructor(
    initialPosition: Vector3 = new Vector3(0, 0.05, 0),
    initialYaw: number = 0,
    config: VehicleHandlingConfig = DEFAULT_VEHICLE_CONFIG
  ) {
    this.config = { ...config };
    // Default profile based on standard flagship specifications
    this.currentProfile = createHandlingProfile({
      topSpeedKmH: Math.round(config.maxForwardSpeed * 3.6),
      accelerationSec: 4.0,
      handlingRating: 83,
      weightKg: 1280,
      powerHp: 420,
      drivetrain: 'RWD',
      brakingForce: config.brakeForce,
      downforceRating: 68,
    });
    this.position = initialPosition.clone();
    this.startPosition = initialPosition.clone();
    this.yawAngle = initialYaw;
    this.startYaw = initialYaw;
    this.roadSurfaceY = initialPosition.y;
  }

  /**
   * Applies a per-vehicle handling profile derived from catalog performance specifications.
   */
  public applyHandlingProfile(profile: VehicleHandlingProfile): void {
    this.currentProfile = { ...profile };
    this.config = { ...profile };
  }

  public update(deltaTime: number, input: InputState): void {
    this.lastInputState = { ...input };

    // Clamp delta time to avoid large physics steps on frame drops
    const dt = Math.min(deltaTime, 0.1);
    if (dt <= 0) return;

    // Handle vehicle reset
    if (input.reset) {
      this.reset();
      return;
    }

    const prevForwardSpeed = this.forwardSpeed;
    this.isHandbrakeEngaged = input.handbrake;

    // 1. STEERING DYNAMICS (Speed-sensitive steering)
    const speedRatio = Math.min(1.0, Math.abs(this.forwardSpeed) / this.config.maxForwardSpeed);
    // As vehicle speed increases, steering angle authority is smoothly shaped without crippling turn-in
    const steerAuthority = 1.0 - Math.pow(speedRatio, 1.8) * this.config.highSpeedSteerReduction;
    const targetMaxSteer = this.config.maxSteerAngle * steerAuthority;

    let targetSteer = 0;
    if (input.steerLeft) {
      targetSteer -= targetMaxSteer;
    }
    if (input.steerRight) {
      targetSteer += targetMaxSteer;
    }

    // Smoothly transition steering angle towards target with weighted rack response
    const steerDelta = targetSteer - this.steeringAngle;
    const maxSteerStep = this.config.steerRate * dt;
    this.steeringAngle += Math.max(-maxSteerStep, Math.min(maxSteerStep, steerDelta));

    // 2. LONGITUDINAL DYNAMICS (Acceleration / Braking / Reverse)
    if (input.forward) {
      if (this.forwardSpeed < -0.2) {
        // Moving backward: pressing forward applies service brakes to stop reverse motion
        this.forwardSpeed += this.config.brakeForce * dt;
        if (this.forwardSpeed > 0) this.forwardSpeed = 0;
      } else {
        // Accelerating forward: progressive power falloff toward top speed
        const speedFraction = Math.max(0, this.forwardSpeed) / this.config.maxForwardSpeed;
        const powerCurve = Math.max(0.18, 1.0 - Math.pow(Math.min(1.0, speedFraction), 1.25));

        // Low-speed launch traction modulation (boosted for multi-motor AWD, slip for FWD)
        let launchMultiplier = 1.0;
        if (this.forwardSpeed < 16.0) {
          const launchBlend = 1.0 - (Math.max(0, this.forwardSpeed) / 16.0);
          launchMultiplier = 1.0 + (this.currentProfile.launchTractionFactor - 1.0) * launchBlend;
        }

        this.forwardSpeed += this.config.acceleration * powerCurve * launchMultiplier * dt;
        if (this.forwardSpeed > this.config.maxForwardSpeed) {
          this.forwardSpeed = this.config.maxForwardSpeed;
        }
      }
    } else if (input.backward) {
      if (this.forwardSpeed > 0.2) {
        // Moving forward: pressing backward applies service brakes
        this.forwardSpeed -= this.config.brakeForce * dt;
        if (this.forwardSpeed < 0) this.forwardSpeed = 0;
        // Trail-braking yaw stabilization helps regain control entering turns
        this.yawRate *= Math.max(0, 1.0 - dt * 2.2);
      } else {
        // Vehicle stopped or near-zero: engage reverse gear and accelerate backward
        this.forwardSpeed -= this.config.reverseAcceleration * dt;
        if (this.forwardSpeed < -this.config.maxReverseSpeed) {
          this.forwardSpeed = -this.config.maxReverseSpeed;
        }
      }
    } else {
      // Natural rolling resistance & engine braking when off-throttle
      if (this.forwardSpeed > 0) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - this.config.engineBraking * dt);
      } else if (this.forwardSpeed < 0) {
        this.forwardSpeed = Math.min(0, this.forwardSpeed + this.config.engineBraking * dt);
      }
    }

    // Aerodynamic drag resisting forward velocity (F = c * v * |v|)
    const drag = this.config.aerodynamicDrag * this.forwardSpeed * Math.abs(this.forwardSpeed) * dt;
    this.forwardSpeed -= drag;

    // Handbrake application: reduces speed smoothly and initiates slide
    if (input.handbrake) {
      if (this.forwardSpeed > 0) {
        this.forwardSpeed = Math.max(0, this.forwardSpeed - (this.config.brakeForce * 0.38) * dt);
      }
    }

    // 3. LATERAL DYNAMICS & DRIFTING
    // Centrifugal transfer: turning at speed induces lateral acceleration in the vehicle frame
    const centrifugalAccel = this.yawRate * this.forwardSpeed;
    this.lateralSpeed -= centrifugalAccel * dt;

    // Dynamic aerodynamic downforce grip bonus (scales with velocity squared v²)
    const speedFraction = Math.min(1.0, Math.max(0, this.forwardSpeed) / this.config.maxForwardSpeed);
    const aeroGripBonus = this.currentProfile.maxAeroGripBonus * Math.pow(speedFraction, 2);
    this.latestAeroBonus = aeroGripBonus;

    // Base effective grip combining mechanical tire grip with downforce
    let effectiveGrip = this.config.normalLateralGrip + aeroGripBonus;
    if (input.handbrake) {
      // Handbrake breaks rear traction, dropping lateral grip to induce oversteer
      effectiveGrip *= this.config.handbrakeGripMultiplier;
    } else if (Math.abs(this.lateralSpeed) > 1.8) {
      // Vehicle is sliding; dynamic friction coefficient applies with aero support
      effectiveGrip = Math.min(effectiveGrip, this.config.driftSlipGrip + aeroGripBonus * 0.45);
    }
    this.latestEffectiveGrip = effectiveGrip;

    // Lateral tire friction resisting sideways motion
    const lateralFriction = this.lateralSpeed * effectiveGrip * dt;
    this.lateralSpeed -= lateralFriction;
    // Lateral damping converts sliding momentum into straight-line alignment
    this.lateralSpeed *= Math.max(0, 1.0 - this.config.lateralDamping * dt * 0.35);

    // 4. YAW DYNAMICS (Turning, Drivetrain Oversteer/Understeer, and Counter-Steer Control)
    // Turning authority ramps in quickly from rest for responsive low-speed maneuverability
    const turnAuthority = Math.min(1.0, Math.abs(this.forwardSpeed) / 1.8);
    let steerTorque = this.steeringAngle * Math.sign(this.forwardSpeed >= 0 ? 1 : -1) * this.config.yawResponse * turnAuthority;

    // FWD Power Understeer: When driver floors throttle while turning, driven front wheels lose lateral turning bite
    if (this.currentProfile.powerUndersteerFactor > 0 && this.throttleLoad > 0.3 && Math.abs(this.steeringAngle) > 0.04) {
      const understeerFactor = this.currentProfile.powerUndersteerFactor * 0.28 * this.throttleLoad;
      steerTorque *= (1.0 - understeerFactor);
      this.lateralSpeed -= Math.sign(this.steeringAngle) * understeerFactor * 1.6 * dt;
    }

    // Oversteer induced by handbrake and lateral slide
    let driftOversteer = 0;
    if (input.handbrake) {
      driftOversteer = -this.lateralSpeed * 0.22;
    } else if (Math.abs(this.lateralSpeed) > 1.8) {
      driftOversteer = -this.lateralSpeed * 0.10;
    }

    // RWD Power Oversteer: Throttle applied while cornering kicks the rear out for intentional power-slides
    if (
      this.currentProfile.powerOversteerFactor > 0 &&
      this.throttleLoad > 0.4 &&
      Math.abs(this.steeringAngle) > 0.08 &&
      Math.abs(this.forwardSpeed) > 4.5
    ) {
      const powerKick = -Math.sign(this.steeringAngle) * this.throttleLoad * (this.currentProfile.powerOversteerFactor * 0.38);
      driftOversteer += powerKick;
    }

    // Counter-steer stabilization: if driver turns opposite to the vehicle rotation during a slide, provide catching torque
    const isCounterSteering =
      Math.sign(this.steeringAngle) !== 0 &&
      Math.abs(this.yawRate) > 0.35 &&
      Math.sign(this.steeringAngle) !== Math.sign(this.yawRate) &&
      Math.abs(this.lateralSpeed) > 1.0;

    if (isCounterSteering) {
      steerTorque *= this.config.counterSteerAssist;
      // Active counter-steer grip recovery
      this.lateralSpeed *= Math.max(0, 1.0 - dt * 2.8);
    }

    const targetYawRate = steerTorque + driftOversteer;
    // Rotational inertia factor scales yaw acceleration (heavier cars have more rotational inertia)
    const yawAcceleration = ((targetYawRate - this.yawRate) * 12.0) / this.currentProfile.rotationalInertia;
    this.yawRate += yawAcceleration * dt;

    // Angular damping prevents uncontrolled perpetual spinning
    this.yawRate -= this.yawRate * this.config.yawDamping * dt;
    this.yawAngle += this.yawRate * dt;

    // 5. KINEMATIC INTEGRATION & POSITION UPDATE
    const forwardDir = new Vector3(Math.sin(this.yawAngle), 0, Math.cos(this.yawAngle));
    const rightDir = new Vector3(Math.cos(this.yawAngle), 0, -Math.sin(this.yawAngle));

    // Global velocity combines forward driving vector and lateral slip vector scaled for track scale
    this.velocity = forwardDir
      .scale(this.forwardSpeed * this.speedScale)
      .add(rightDir.scale(this.lateralSpeed * this.speedScale));
    this.position.addInPlace(this.velocity.scale(dt));
    this.position.y = this.roadSurfaceY;

    // 6. WHEEL SPIN MATH
    // Wheel pitch rotation increment: Δθ = (v * dt) / radius
    if (!input.handbrake || Math.abs(this.forwardSpeed) > 0.1) {
      const dWheel = (this.forwardSpeed * this.speedScale * dt) / this.config.wheelRadius;
      this.wheelSpinAngle += dWheel;
    }

    // 7. LINEAR & LATERAL ACCELERATION FOR VISUAL SUSPENSION
    this.forwardAcceleration = (this.forwardSpeed - prevForwardSpeed) / dt;
    this.lateralAcceleration = this.yawRate * this.forwardSpeed;

    // 8. 6-SPEED TRANSMISSION, RPM & THROTTLE LOAD
    if (input.forward && this.forwardSpeed >= -0.2) {
      this.throttleLoad = 1.0;
    } else if (input.backward && this.forwardSpeed <= 0.2) {
      this.throttleLoad = 1.0;
    } else {
      this.throttleLoad = 0.0;
    }

    const absSpeed = Math.abs(this.forwardSpeed);
    const topV = Math.max(30.0, this.config.maxForwardSpeed);

    let targetGear = 1;
    if (this.forwardSpeed < -0.3) {
      targetGear = -1; // Reverse
    } else if (absSpeed < 0.2 && this.throttleLoad === 0) {
      targetGear = 0; // Neutral
    } else {
      // Dynamic forward gear thresholds proportioned to vehicle maximum speed
      if (absSpeed < topV * 0.18) targetGear = 1;
      else if (absSpeed < topV * 0.35) targetGear = 2;
      else if (absSpeed < topV * 0.52) targetGear = 3;
      else if (absSpeed < topV * 0.68) targetGear = 4;
      else if (absSpeed < topV * 0.84) targetGear = 5;
      else targetGear = 6;
    }

    this.didShiftThisFrame = (targetGear !== this.currentGear && this.currentGear !== 0 && targetGear !== 0);
    this.currentGear = targetGear;

    // Engine RPM calculation
    if (this.currentGear === 0) {
      // Neutral: idle with revving on throttle
      const targetRpm = this.throttleLoad > 0 ? 4500 : 950;
      this.engineRpm += (targetRpm - this.engineRpm) * Math.min(1.0, dt * 8.0);
    } else if (this.currentGear === -1) {
      // Reverse
      const revFraction = Math.min(1.0, absSpeed / this.config.maxReverseSpeed);
      const targetRpm = 1200 + revFraction * 5000;
      this.engineRpm += (targetRpm - this.engineRpm) * Math.min(1.0, dt * 10.0);
    } else {
      // Forward gears: dynamically calculated bounds based on vehicle top speed
      const gMin = this.currentGear === 1 ? 0.0 : topV * (0.16 * (this.currentGear - 1) - 0.02);
      const gMax = topV * (0.16 * this.currentGear + 0.04);
      const gearProgress = Math.max(0, Math.min(1.0, (absSpeed - gMin) / Math.max(1.0, gMax - gMin)));
      const baseRpm = 2200 + gearProgress * 4800;
      const targetRpm = this.throttleLoad > 0 ? baseRpm : Math.max(1200, baseRpm * 0.82);
      this.engineRpm += (targetRpm - this.engineRpm) * Math.min(1.0, dt * 12.0);
    }
  }

  public reset(): void {
    this.position.copyFrom(this.startPosition);
    this.position.y = this.roadSurfaceY;
    this.yawAngle = this.startYaw;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.yawRate = 0;
    this.steeringAngle = 0;
    this.velocity.set(0, 0, 0);
    this.forwardAcceleration = 0;
    this.lateralAcceleration = 0;
    this.isHandbrakeEngaged = false;
    this.currentGear = 0;
    this.engineRpm = 950;
    this.throttleLoad = 0;
    this.didShiftThisFrame = false;
  }

  public resetTo(pos: Vector3, yaw: number): void {
    this.position.copyFrom(pos);
    this.position.y = this.roadSurfaceY;
    this.yawAngle = yaw;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.yawRate = 0;
    this.steeringAngle = 0;
    this.velocity.set(0, 0, 0);
    this.forwardAcceleration = 0;
    this.lateralAcceleration = 0;
    this.isHandbrakeEngaged = false;
    this.currentGear = 0;
    this.engineRpm = 950;
    this.throttleLoad = 0;
    this.didShiftThisFrame = false;
  }

  public setStartPosition(pos: Vector3, yaw: number): void {
    this.startPosition.copyFrom(pos);
    this.startYaw = yaw;
    this.reset();
  }

  public get slipAngle(): number {
    return Math.atan2(this.lateralSpeed, Math.abs(this.forwardSpeed) + 0.1);
  }

  public getTelemetry(): VehicleTelemetry {
    const speedKmh = Math.abs(this.forwardSpeed) * 3.6;
    const slipAngleRad = this.slipAngle;
    const slipAngleDeg = (slipAngleRad * 180) / Math.PI;
    const steeringAngleDeg = (this.steeringAngle * 180) / Math.PI;

    let gearDisplay = 'N';
    if (this.currentGear === -1) gearDisplay = 'R';
    else if (this.currentGear > 0) gearDisplay = `${this.currentGear}`;

    const isDrifting = Math.abs(this.lateralSpeed) > 1.4 && Math.abs(this.forwardSpeed) > 4.0;

    return {
      speedKmh: Math.round(speedKmh),
      forwardSpeed: this.forwardSpeed,
      lateralSpeed: this.lateralSpeed,
      slipAngleDeg: Math.round(slipAngleDeg * 10) / 10,
      steeringAngleDeg: Math.round(steeringAngleDeg * 10) / 10,
      isDrifting,
      handbrakeActive: Math.abs(this.lateralSpeed) > 1.3 && isDrifting,
      gear: gearDisplay,
      gearNumber: this.currentGear,
      engineRpm: Math.round(this.engineRpm),
      throttleLoad: this.throttleLoad,
      didShiftThisFrame: this.didShiftThisFrame,

      // Live physical attributes for debug overlay
      profileName: this.currentProfile.name,
      tier: this.currentProfile.tier,
      drivetrain: this.currentProfile.drivetrain,
      weightKg: this.currentProfile.weightKg,
      powerHp: this.currentProfile.powerHp,
      downforceRating: this.currentProfile.downforceRating,
      handlingRating: this.currentProfile.handlingRating,
      effectiveGrip: Math.round(this.latestEffectiveGrip * 100) / 100,
      baseGrip: this.currentProfile.normalLateralGrip,
      aeroGripBonus: Math.round(this.latestAeroBonus * 100) / 100,
      forwardAcceleration: Math.round(this.forwardAcceleration * 100) / 100,
      lateralAcceleration: Math.round(this.lateralAcceleration * 100) / 100,
      rotationalInertia: Math.round(this.currentProfile.rotationalInertia * 100) / 100,
      throttleInput: this.lastInputState.forward,
      brakeInput: this.lastInputState.backward,
      handbrakeInput: this.lastInputState.handbrake,
    };
  }
}
