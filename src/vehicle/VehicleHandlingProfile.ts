import { VehicleHandlingConfig, DEFAULT_VEHICLE_CONFIG } from './VehicleConfig';
import { VehiclePerformanceSpecs, DrivetrainType, VehicleTier } from './VehicleCatalog';

export interface VehicleHandlingProfile extends VehicleHandlingConfig {
  vehicleId: string;
  name: string;
  tier: VehicleTier;
  drivetrain: DrivetrainType;
  weightKg: number;
  powerHp: number;
  downforceRating: number;
  handlingRating: number;
  topSpeedKmH: number;
  accelerationSec: number;

  /** Physical rotational inertia factor scaled relative to benchmark 1,350kg sports coupe */
  rotationalInertia: number;

  /** Throttle oversteer bias for RWD power-slides (0 for FWD, moderate for AWD, strong for RWD) */
  powerOversteerFactor: number;

  /** Power understeer bias for FWD corner exit (reduces steering bite under heavy cornering throttle) */
  powerUndersteerFactor: number;

  /** Launch traction bonus at low speeds (high for multi-motor AWD, neutral for RWD, slight slip for FWD) */
  launchTractionFactor: number;

  /** Maximum aerodynamic grip bonus available at top speed */
  maxAeroGripBonus: number;
}

/**
 * Derives a complete physics handling profile directly from catalog specifications.
 * Establishes consistent mathematical relationships between real-world vehicle attributes
 * and the arcade-sim hybrid controller mechanics.
 */
export function createHandlingProfile(
  specs: VehiclePerformanceSpecs,
  vehicleId: string = 'mercedes_slc',
  name: string = 'Stuttgart SLC Roadster',
  tier: VehicleTier = 1
): VehicleHandlingProfile {
  // 1. Top Speed (km/h -> m/s)
  const maxForwardSpeed = specs.topSpeedKmH / 3.6;
  const maxReverseSpeed = Math.min(15.0, Math.max(9.0, maxForwardSpeed * 0.22));

  // 2. Acceleration: Calibrated from engineForce / weightKg (or accelerationSec fallback)
  let acceleration: number;
  if (specs.engineForce && specs.weightKg) {
    const rawForceAccel = (specs.engineForce / specs.weightKg) * 1.85;
    acceleration = Math.round(rawForceAccel * 100) / 100;
  } else {
    const rawAccel = 27.78 / (Math.max(1.5, specs.accelerationSec) * 0.76);
    acceleration = Math.round(rawAccel * 100) / 100;
  }

  // 3. Braking Deceleration: Calibrated from brakeForce / weightKg (or brakingForce fallback)
  let brakeForce: number;
  if (specs.brakeForce && specs.weightKg) {
    const rawBrakeAccel = (specs.brakeForce / specs.weightKg) * 4.2;
    brakeForce = Math.round(rawBrakeAccel * 100) / 100;
  } else {
    brakeForce = specs.brakingForce;
  }

  // 4. Weight & Rotational Inertia
  // Benchmark: 1,350 kg has rotationalInertia = 1.0. Heavy cars (3,450 kg) reach ~1.65; light cars (1,450 kg) reach ~0.95.
  const rotationalInertia = Math.max(0.68, Math.min(1.65, Math.pow(specs.weightKg / 1350, 0.45)));

  // 5. Handling & Cornering Grip
  // Base lateral grip: derived from gripFactor (0.70 - 0.98) or handlingRating
  let normalLateralGrip: number;
  let driftSlipGrip: number;
  if (specs.gripFactor) {
    normalLateralGrip = Math.round(13.0 * (specs.gripFactor / 0.85) * 100) / 100;
    driftSlipGrip = Math.round(5.0 * (specs.gripFactor / 0.85) * 100) / 100;
  } else {
    normalLateralGrip = Math.round((9.2 + (specs.handlingRating / 100) * 8.2) * 100) / 100;
    driftSlipGrip = Math.round((3.8 + (specs.handlingRating / 100) * 2.2) * 100) / 100;
  }

  // Steering rack actuation rate: 4.2 rad/s to 8.2 rad/s
  const steerRate = Math.round((4.2 + (specs.handlingRating / 100) * 4.0) * 100) / 100;

  // Maximum steering angle: user turnRadiusRad (0.46 - 0.62) or derived
  const maxSteerAngle = specs.turnRadiusRad !== undefined
    ? specs.turnRadiusRad
    : Math.round((0.50 + (specs.handlingRating / 100) * 0.08) * 1000) / 1000;

  // Yaw turn-in responsiveness: 2.2 to 4.6
  const yawResponse = Math.round((2.2 + (specs.handlingRating / 100) * 2.4) * 100) / 100;

  // High-speed steering reduction: aero downforce counteracts artificial steering reduction
  const highSpeedSteerReduction = Math.max(
    0.16,
    Math.min(0.40, 0.38 - (specs.downforceRating / 100) * 0.18)
  );

  // Aerodynamic downforce grip bonus at top speed
  const maxAeroGripBonus = Math.round(((specs.downforceRating / 100) * 0.45 * normalLateralGrip) * 100) / 100;

  // Dynamic sliding friction & damping
  const lateralDamping = Math.round((4.8 + (specs.handlingRating / 100) * 2.0) * 100) / 100;
  const yawDamping = Math.round((3.8 + (specs.weightKg / 1400) * 1.8) * 100) / 100;

  // Aerodynamic drag
  const aerodynamicDrag = specs.drag !== undefined
    ? Math.round(DEFAULT_VEHICLE_CONFIG.aerodynamicDrag * (specs.drag / 0.32) * 10000) / 10000
    : DEFAULT_VEHICLE_CONFIG.aerodynamicDrag;

  // 6. Drivetrain specific dynamics
  let powerOversteerFactor = 0.0;
  let powerUndersteerFactor = 0.0;
  let launchTractionFactor = 1.0;
  let handbrakeGripMultiplier = 0.38;
  let counterSteerAssist = 2.0;

  switch (specs.drivetrain) {
    case 'FWD':
      // Front-wheel drive: high directional stability, power understeer when full throttle in turns, no power oversteer
      powerOversteerFactor = 0.0;
      powerUndersteerFactor = 0.85;
      launchTractionFactor = 0.95;
      handbrakeGripMultiplier = 0.32;
      counterSteerAssist = 1.6;
      break;

    case 'RWD':
      // Rear-wheel drive: throttle-sensitive corner exit, power oversteer slides, responsive drift transitions
      powerOversteerFactor = 1.0;
      powerUndersteerFactor = 0.0;
      launchTractionFactor = 1.0;
      handbrakeGripMultiplier = 0.38;
      counterSteerAssist = 2.4;
      break;

    case 'AWD':
      // All-wheel drive: balanced launch traction, stable corner exit with mild progressive slip
      powerOversteerFactor = 0.25;
      powerUndersteerFactor = 0.15;
      launchTractionFactor = 1.18;
      handbrakeGripMultiplier = 0.42;
      counterSteerAssist = 2.0;
      break;

    case '6WD':
      // 6-wheel drive heavy all-terrain beast: huge launch traction, solid stability, controlled slides
      powerOversteerFactor = 0.12;
      powerUndersteerFactor = 0.18;
      launchTractionFactor = 1.35;
      handbrakeGripMultiplier = 0.44;
      counterSteerAssist = 1.8;
      break;

    case 'Dual-Motor AWD':
      // High-voltage electric torque vectoring: instant launch punch, high stability
      powerOversteerFactor = 0.20;
      powerUndersteerFactor = 0.10;
      launchTractionFactor = 1.25;
      handbrakeGripMultiplier = 0.40;
      counterSteerAssist = 2.0;
      break;

    case 'Tri-Motor AWD':
      // Hypercar electric torque vectoring: maximum launch traction, extreme corner stability
      powerOversteerFactor = 0.22;
      powerUndersteerFactor = 0.08;
      launchTractionFactor = 1.30;
      handbrakeGripMultiplier = 0.42;
      counterSteerAssist = 2.1;
      break;
  }

  return {
    vehicleId,
    name,
    tier,
    drivetrain: specs.drivetrain,
    weightKg: specs.weightKg,
    powerHp: specs.powerHp,
    downforceRating: specs.downforceRating,
    handlingRating: specs.handlingRating,
    topSpeedKmH: specs.topSpeedKmH,
    accelerationSec: specs.accelerationSec,
    rotationalInertia,
    powerOversteerFactor,
    powerUndersteerFactor,
    launchTractionFactor,
    maxAeroGripBonus,

    // Standard VehicleHandlingConfig properties
    maxForwardSpeed,
    maxReverseSpeed,
    acceleration,
    brakeForce,
    reverseAcceleration: Math.min(10.0, Math.max(6.0, brakeForce * 0.30)),
    engineBraking: Math.min(4.8, Math.max(2.6, specs.weightKg / 450)),
    aerodynamicDrag,
    steerRate,
    maxSteerAngle,
    highSpeedSteerReduction,
    normalLateralGrip,
    handbrakeGripMultiplier,
    driftSlipGrip,
    lateralDamping,
    yawResponse,
    yawDamping,
    counterSteerAssist,
    wheelRadius: DEFAULT_VEHICLE_CONFIG.wheelRadius,
  };
}
