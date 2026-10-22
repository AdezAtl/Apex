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
  vehicleId: string = 'apex01_flagship',
  name: string = 'APEX-01 PRO-SPEC',
  tier: VehicleTier = 3
): VehicleHandlingProfile {
  // 1. Top Speed (km/h -> m/s)
  const maxForwardSpeed = specs.topSpeedKmH / 3.6;
  const maxReverseSpeed = Math.min(15.0, Math.max(9.0, maxForwardSpeed * 0.22));

  // 2. Acceleration: calibrated so 0-100 km/h (27.78 m/s) matches catalog accelerationSec
  // Given average powerCurve falloff (~0.76 over 0-100 km/h), a_peak = 27.78 / (accelSec * 0.76)
  const rawAccel = 27.78 / (Math.max(1.5, specs.accelerationSec) * 0.76);
  const acceleration = Math.round(rawAccel * 100) / 100;

  // 3. Braking Deceleration (m/s²) directly from specifications (18.0 to 34.0 m/s²)
  const brakeForce = specs.brakingForce;

  // 4. Weight & Rotational Inertia
  // Benchmark: 1,350 kg has rotationalInertia = 1.0. Heavy cars (2,980 kg) reach ~1.55; light cars (798 kg) reach ~0.72.
  const rotationalInertia = Math.max(0.68, Math.min(1.65, Math.pow(specs.weightKg / 1350, 0.45)));

  // 5. Handling & Cornering Grip (handlingRating 1-100)
  // Base lateral grip: 9.5 (loose/soft vintage) to 17.5 (sticky slick ground-effect)
  const normalLateralGrip = Math.round((9.2 + (specs.handlingRating / 100) * 8.2) * 100) / 100;

  // Steering rack actuation rate: 4.2 rad/s to 8.2 rad/s
  const steerRate = Math.round((4.2 + (specs.handlingRating / 100) * 4.0) * 100) / 100;

  // Maximum steering angle: 0.50 rad (~28.6°) to 0.58 rad (~33.2°)
  const maxSteerAngle = Math.round((0.50 + (specs.handlingRating / 100) * 0.08) * 1000) / 1000;

  // Yaw turn-in responsiveness: 2.2 to 4.6
  const yawResponse = Math.round((2.2 + (specs.handlingRating / 100) * 2.4) * 100) / 100;

  // High-speed steering reduction: aero downforce counteracts artificial steering reduction
  const highSpeedSteerReduction = Math.max(
    0.16,
    Math.min(0.40, 0.38 - (specs.downforceRating / 100) * 0.18)
  );

  // Aerodynamic downforce grip bonus at top speed (up to +45% base grip for Formula 1 / GT2 cars)
  const maxAeroGripBonus = Math.round(((specs.downforceRating / 100) * 0.45 * normalLateralGrip) * 100) / 100;

  // Dynamic sliding friction & damping
  const driftSlipGrip = Math.round((3.8 + (specs.handlingRating / 100) * 2.2) * 100) / 100;
  const lateralDamping = Math.round((4.8 + (specs.handlingRating / 100) * 2.0) * 100) / 100;
  const yawDamping = Math.round((3.8 + (specs.weightKg / 1400) * 1.8) * 100) / 100;

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
      launchTractionFactor = 0.95; // Slight front-wheel spin under hard launch
      handbrakeGripMultiplier = 0.32; // Handbrake locks rear wheels sharply for lift-off / handbrake pivots
      counterSteerAssist = 1.6;
      break;

    case 'RWD':
      // Rear-wheel drive: throttle-sensitive corner exit, power oversteer slides, responsive drift transitions
      powerOversteerFactor = 1.0;
      powerUndersteerFactor = 0.0;
      launchTractionFactor = 1.0;
      handbrakeGripMultiplier = 0.38;
      counterSteerAssist = 2.4; // Rewarding counter-steer catch authority
      break;

    case 'AWD':
      // All-wheel drive: balanced launch traction, stable corner exit with mild progressive slip
      powerOversteerFactor = 0.25;
      powerUndersteerFactor = 0.15;
      launchTractionFactor = 1.18;
      handbrakeGripMultiplier = 0.42;
      counterSteerAssist = 2.0;
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
    aerodynamicDrag: DEFAULT_VEHICLE_CONFIG.aerodynamicDrag,
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
