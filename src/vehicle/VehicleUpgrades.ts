import { VehiclePerformanceSpecs, VehicleTier } from './VehicleCatalog';

export type UpgradeCategory = 'engine' | 'handling' | 'brakes' | 'suspension';

export interface VehicleUpgradeLevels {
  engine: number;      // 0 - 3
  handling: number;    // 0 - 3
  brakes: number;      // 0 - 3
  suspension: number;  // 0 - 3
}

export const MAX_UPGRADE_LEVEL = 3;

export const DEFAULT_UPGRADE_LEVELS: VehicleUpgradeLevels = {
  engine: 0,
  handling: 0,
  brakes: 0,
  suspension: 0,
};

export interface UpgradeCategoryInfo {
  id: UpgradeCategory;
  name: string;
  icon: string;
  subtitle: string;
  levelNames: [string, string, string, string]; // [Stock, Stage 1, Stage 2, Stage 3]
  descriptions: [string, string, string, string];
}

export const UPGRADE_CATEGORIES: Record<UpgradeCategory, UpgradeCategoryInfo> = {
  engine: {
    id: 'engine',
    name: 'Engine & Power Unit',
    icon: '⚡',
    subtitle: 'Power Delivery, Throttle Response & Top Velocity',
    levelNames: [
      'Factory Stock OEM',
      'Stage 1: Sport ECU & Cold Air Intake',
      'Stage 2: High-Flow Exhaust & Camshafts',
      'Stage 3: Twin-Scroll Turbo / Race Plenum',
    ],
    descriptions: [
      'Standard production factory output calibration.',
      'Optimized ignition timing and free-breathing intake for sharper throttle punch.',
      'Lightened valvetrain and free-flowing mandrel exhaust releasing high-RPM power.',
      'Forced induction boost and race plenum maximizing top-end acceleration and velocity.',
    ],
  },
  handling: {
    id: 'handling',
    name: 'Handling & Tire Compound',
    icon: '🎯',
    subtitle: 'Turn-in Bite, Lateral Grip & Steering Precision',
    levelNames: [
      'Factory All-Season Tires',
      'Stage 1: Performance Street Compound',
      'Stage 2: Semi-Slick Track Compound',
      'Stage 3: Competition Slicks & Quick Rack',
    ],
    descriptions: [
      'Standard high-treadwear road tires with forgiving progressive slip.',
      'Softer polymer compound providing higher cornering bite and reduced understeer.',
      'Track-day semi-slick compound with stiffened sidewalls and aggressive apex holding.',
      'Full motorsport slick compound and fast-ratio steering rack for instant direction changes.',
    ],
  },
  brakes: {
    id: 'brakes',
    name: 'Braking System',
    icon: '🛑',
    subtitle: 'Deceleration Authority & Thermal Stability',
    levelNames: [
      'Factory Solid Discs',
      'Stage 1: Slotted Rotors & Sport Pads',
      'Stage 2: 4-Piston Monobloc Calipers',
      'Stage 3: Carbon-Ceramic Matrix Kit',
    ],
    descriptions: [
      'Standard production cast-iron brake package.',
      'Slotted heat-dispersing rotors with high-friction metallic compound brake pads.',
      'Forged monobloc aluminum calipers providing firmer pedal feel and shorter stopping distance.',
      'Ultra-lightweight carbon-ceramic discs delivering relentless fade-free stopping power.',
    ],
  },
  suspension: {
    id: 'suspension',
    name: 'Suspension & Aerodynamics',
    icon: '🏎️',
    subtitle: 'Chassis Roll Control, Downforce & High-Speed Stability',
    levelNames: [
      'Factory Damping & Springs',
      'Stage 1: Lowered Springs & Anti-Roll Bars',
      'Stage 2: 2-Way Adjustable Coilovers',
      'Stage 3: Active Track Aero & Underbody Diffuser',
    ],
    descriptions: [
      'Compliant road-going ride height and comfort-tuned damper valving.',
      'Lower center of gravity and stiffened roll bars minimizing body roll in quick transitions.',
      'High-rate competition coilovers keeping the tire contact patch firmly planted under load.',
      'Underbody venturi ground-effects and front splitter generating high aerodynamic stability.',
    ],
  },
};

/**
 * Economy cost table for upgrades, strictly scaled by vehicle performance tier.
 * Keeps starter car upgrades affordable while ensuring high-tier upgrades represent meaningful investments.
 */
const TIER_UPGRADE_COST_TABLE: Record<VehicleTier, [number, number, number]> = {
  1: [1500, 3000, 5500],       // Tier 1 (Novice): total ~10,000 CR to max a category
  2: [3500, 7000, 12000],      // Tier 2 (Club): total ~22,500 CR
  3: [8000, 16000, 28000],     // Tier 3 (Pro): total ~52,000 CR
  4: [18000, 36000, 60000],    // Tier 4 (Elite): total ~114,000 CR
  5: [35000, 70000, 120000],   // Tier 5 (Pinnacle): total ~225,000 CR
};

/**
 * Returns the in-game credit cost to purchase the next upgrade level.
 * Returns 0 if already at or above MAX_UPGRADE_LEVEL.
 */
export function getUpgradeCost(tier: VehicleTier, _category: UpgradeCategory, currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  const costs = TIER_UPGRADE_COST_TABLE[tier] || TIER_UPGRADE_COST_TABLE[1];
  return costs[currentLevel] ?? costs[costs.length - 1];
}

/**
 * Calculates the effective performance specifications of a vehicle with upgrades applied.
 * Invariant: Never mutates the base catalog specifications.
 */
export function calculateEffectiveSpecs(
  baseSpecs: VehiclePerformanceSpecs,
  upgradeLevels: Partial<VehicleUpgradeLevels> = {}
): VehiclePerformanceSpecs {
  const levels: VehicleUpgradeLevels = {
    engine: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgradeLevels.engine ?? 0)),
    handling: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgradeLevels.handling ?? 0)),
    brakes: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgradeLevels.brakes ?? 0)),
    suspension: Math.max(0, Math.min(MAX_UPGRADE_LEVEL, upgradeLevels.suspension ?? 0)),
  };

  // 1. Engine multipliers
  // Power: +7% / +15% / +24%
  const powerMult = [1.0, 1.07, 1.15, 1.24][levels.engine];
  const effectivePowerHp = Math.round(baseSpecs.powerHp * powerMult);

  // Top Speed: +3% / +6% / +10%
  const speedMult = [1.0, 1.03, 1.06, 1.10][levels.engine];
  const effectiveTopSpeedKmH = Math.round(baseSpecs.topSpeedKmH * speedMult);

  // 0-100 Acceleration (seconds): -6% / -12% / -18% (lower is faster)
  const accelMult = [1.0, 0.94, 0.88, 0.82][levels.engine];
  const effectiveAccelerationSec = Math.round(baseSpecs.accelerationSec * accelMult * 10) / 10;

  // 2. Handling bonus
  // Rating 1-100: +5 / +11 / +18 points (capped at 99)
  const handlingBonus = [0, 5, 11, 18][levels.handling];
  const effectiveHandlingRating = Math.min(99, baseSpecs.handlingRating + handlingBonus);

  // 3. Braking force bonus
  // Force (m/s²): +10% / +20% / +32%
  const brakeMult = [1.0, 1.10, 1.20, 1.32][levels.brakes];
  const effectiveBrakingForce = Math.round(baseSpecs.brakingForce * brakeMult * 10) / 10;

  // 4. Suspension & Aero bonuses
  // Downforce rating 1-100: +6 / +14 / +22 points (capped at 100)
  const downforceBonus = [0, 6, 14, 22][levels.suspension];
  const effectiveDownforceRating = Math.min(100, baseSpecs.downforceRating + downforceBonus);

  // Weight reduction: light alloy arms, roll bars (-2% / -4% / -6%)
  const weightMult = [1.0, 0.98, 0.96, 0.94][levels.suspension];
  const effectiveWeightKg = Math.round(baseSpecs.weightKg * weightMult);

  return {
    ...baseSpecs,
    powerHp: effectivePowerHp,
    topSpeedKmH: effectiveTopSpeedKmH,
    accelerationSec: effectiveAccelerationSec,
    handlingRating: effectiveHandlingRating,
    brakingForce: effectiveBrakingForce,
    downforceRating: effectiveDownforceRating,
    weightKg: effectiveWeightKg,
  };
}

export interface UpgradeDeltaPreview {
  category: UpgradeCategory;
  currentLevel: number;
  nextLevel: number;
  isMaxLevel: boolean;
  cost: number;
  currentLevelName: string;
  nextLevelName: string;
  nextDescription: string;
  statDeltas: { label: string; from: string | number; to: string | number; deltaFormatted: string }[];
}

/**
 * Returns a human-readable preview of the stat changes that will occur if the specified upgrade is purchased.
 */
export function getUpgradeDeltaPreview(
  baseSpecs: VehiclePerformanceSpecs,
  currentLevels: VehicleUpgradeLevels,
  category: UpgradeCategory,
  tier: VehicleTier
): UpgradeDeltaPreview {
  const currentLevel = currentLevels[category];
  const isMaxLevel = currentLevel >= MAX_UPGRADE_LEVEL;
  const nextLevel = isMaxLevel ? currentLevel : currentLevel + 1;
  const cost = getUpgradeCost(tier, category, currentLevel);
  const info = UPGRADE_CATEGORIES[category];

  const currentSpecs = calculateEffectiveSpecs(baseSpecs, currentLevels);
  const nextLevels = { ...currentLevels, [category]: nextLevel };
  const nextSpecs = calculateEffectiveSpecs(baseSpecs, nextLevels);

  const statDeltas: { label: string; from: string | number; to: string | number; deltaFormatted: string }[] = [];

  switch (category) {
    case 'engine':
      statDeltas.push({
        label: 'HORSEPOWER',
        from: `${currentSpecs.powerHp} HP`,
        to: `${nextSpecs.powerHp} HP`,
        deltaFormatted: `+${nextSpecs.powerHp - currentSpecs.powerHp} HP`,
      });
      statDeltas.push({
        label: 'TOP SPEED',
        from: `${currentSpecs.topSpeedKmH} KM/H`,
        to: `${nextSpecs.topSpeedKmH} KM/H`,
        deltaFormatted: `+${nextSpecs.topSpeedKmH - currentSpecs.topSpeedKmH} KM/H`,
      });
      statDeltas.push({
        label: '0–100 ACCEL',
        from: `${currentSpecs.accelerationSec.toFixed(1)}s`,
        to: `${nextSpecs.accelerationSec.toFixed(1)}s`,
        deltaFormatted: `-${(currentSpecs.accelerationSec - nextSpecs.accelerationSec).toFixed(1)}s`,
      });
      break;

    case 'handling':
      statDeltas.push({
        label: 'HANDLING RATING',
        from: `${currentSpecs.handlingRating}/100`,
        to: `${nextSpecs.handlingRating}/100`,
        deltaFormatted: `+${nextSpecs.handlingRating - currentSpecs.handlingRating}`,
      });
      break;

    case 'brakes':
      statDeltas.push({
        label: 'BRAKING FORCE',
        from: `${currentSpecs.brakingForce.toFixed(1)} m/s²`,
        to: `${nextSpecs.brakingForce.toFixed(1)} m/s²`,
        deltaFormatted: `+${(nextSpecs.brakingForce - currentSpecs.brakingForce).toFixed(1)} m/s²`,
      });
      break;

    case 'suspension':
      statDeltas.push({
        label: 'DOWNFORCE',
        from: `${currentSpecs.downforceRating}/100`,
        to: `${nextSpecs.downforceRating}/100`,
        deltaFormatted: `+${nextSpecs.downforceRating - currentSpecs.downforceRating}`,
      });
      statDeltas.push({
        label: 'CURB WEIGHT',
        from: `${currentSpecs.weightKg.toLocaleString()} KG`,
        to: `${nextSpecs.weightKg.toLocaleString()} KG`,
        deltaFormatted: `-${(currentSpecs.weightKg - nextSpecs.weightKg).toLocaleString()} KG`,
      });
      break;
  }

  return {
    category,
    currentLevel,
    nextLevel,
    isMaxLevel,
    cost,
    currentLevelName: info.levelNames[currentLevel],
    nextLevelName: isMaxLevel ? 'MAXIMUM STAGE' : info.levelNames[nextLevel],
    nextDescription: isMaxLevel ? 'Vehicle has reached peak performance potential for this component.' : info.descriptions[nextLevel],
    statDeltas,
  };
}
