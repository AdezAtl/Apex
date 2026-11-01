/**
 * Project Apex — Vehicle Catalog, Attribute Specifications & Progression System
 * Defines real performance attributes, handling characteristics, progression tiers,
 * and unlock/monetization rules for all showcase and playable vehicles.
 */

export type VehicleTier = 1 | 2 | 3 | 4 | 5;

export type DrivetrainType = 'FWD' | 'RWD' | 'AWD' | '6WD' | 'Dual-Motor AWD' | 'Tri-Motor AWD';

export type UnlockMethod = 
  | 'starter'         // Free starter car
  | 'credits'         // Purchased with in-game prize money
  | 'career_trophy'   // Unlocked by completing specific race championships
  | 'drift_milestone' // Unlocked via drift high-score mastery
  | 'premium_iap';    // Real-money micro-transaction / VIP DLC

export interface VehiclePerformanceSpecs {
  topSpeedKmH: number;      // Maximum velocity in km/h
  accelerationSec: number;  // 0 - 100 km/h sprint time in seconds
  handlingRating: number;   // 1 - 100 agility and cornering authority index
  weightKg: number;         // Curb weight in kilograms
  powerHp: number;          // Engine output in horsepower
  drivetrain: DrivetrainType;
  brakingForce: number;     // Deceleration authority (m/s²)
  downforceRating: number;  // Aerodynamic road-holding (1 - 100)

  // Direct physical specifications
  engineForce?: number;     // Engine tractive force (Newtons)
  brakeForce?: number;      // Braking system force (Newtons)
  massKg?: number;          // Physical mass in kilograms
  gripFactor?: number;      // Lateral tire traction factor (0.70 - 0.98)
  turnRadiusRad?: number;   // Steering authority / maximum steering angle (radians)
  drag?: number;            // Aerodynamic drag coefficient (Cd)
}

// Compatibility alias
export type VehicleSpecs = VehiclePerformanceSpecs;

export interface VehicleCatalogItem {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  tier: VehicleTier;
  priceCredits: number;
  fileName: string;
  yawOffset?: number; // Visual yaw offset in radians for models authored with inverted/flipped headings
  defaultPaintId?: string;
  sourceZip?: string;
  specs: VehiclePerformanceSpecs;
  unlock: {
    method: UnlockMethod;
    creditCost?: number;
    requiredLevel?: number;
    trophyRequirement?: string;
    realMoneyPriceUsd?: number;
    isPremiumExclusive?: boolean;
  };
  description: string;
  badges: string[];
}

export const VEHICLE_CATALOG: VehicleCatalogItem[] = [
  // ==========================================
  // TIER 1: STREET & NOVICE (FREE / EARLY PROGRESSION)
  // ==========================================
  {
    id: 'mercedes_slc',
    name: 'Stuttgart SLC Roadster',
    subtitle: '2.0L Turbocharged Compact Roadster',
    category: 'Roadster',
    tier: 1,
    priceCredits: 0,
    fileName: 'slc.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'metallic_silver',
    specs: {
      topSpeedKmH: 250,
      accelerationSec: 4.6,
      handlingRating: 82,
      weightKg: 1550,
      powerHp: 385,
      drivetrain: 'RWD',
      brakingForce: 25.0,
      downforceRating: 62,
      engineForce: 6200,
      brakeForce: 7200,
      massKg: 1550,
      gripFactor: 0.84,
      turnRadiusRad: 0.60,
      drag: 0.30,
    },
    unlock: {
      method: 'starter',
      creditCost: 0,
      requiredLevel: 1,
    },
    description: 'Lightweight, agile German roadster featuring quick steering rack response, balanced rear-drive dynamics, and open-top acoustic excitement.',
    badges: ['STARTER VEHICLE', 'ROADSTER AGILITY', 'RWD'],
  },
  {
    id: 'bmw_x6',
    name: 'Bavaria X6M Coupe SUV',
    subtitle: 'Twin-Turbo 4.4L V8 Sport Activity Coupe',
    category: 'Performance SUV',
    tier: 1,
    priceCredits: 12000,
    fileName: 'x6.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'deep_blue',
    specs: {
      topSpeedKmH: 250,
      accelerationSec: 3.9,
      handlingRating: 72,
      weightKg: 2100,
      powerHp: 617,
      drivetrain: 'AWD',
      brakingForce: 24.0,
      downforceRating: 55,
      engineForce: 7800,
      brakeForce: 8500,
      massKg: 2100,
      gripFactor: 0.78,
      turnRadiusRad: 0.52,
      drag: 0.34,
    },
    unlock: {
      method: 'credits',
      creditCost: 12000,
      requiredLevel: 2,
    },
    description: 'Heavyweight twin-turbo V8 coupe SUV offering planted all-weather grip, high-speed touring stability, and robust impact deflection.',
    badges: ['V8 BITURBO', 'PERFORMANCE SUV', 'AWD'],
  },
  {
    id: 'velociraptor',
    name: 'Mammoth F-1500 VelociRaptor',
    subtitle: 'Twin-Turbo 6-Wheel Drive Heavyweight',
    category: 'Off-Road 6x6 Truck',
    tier: 1,
    priceCredits: 15000,
    fileName: 'F-1500.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'emerald_green',
    specs: {
      topSpeedKmH: 215,
      accelerationSec: 4.9,
      handlingRating: 66,
      weightKg: 2800,
      powerHp: 600,
      drivetrain: 'AWD',
      brakingForce: 22.0,
      downforceRating: 48,
      engineForce: 9800,
      brakeForce: 8000,
      massKg: 2800,
      gripFactor: 0.70,
      turnRadiusRad: 0.46,
      drag: 0.48,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 15000,
      requiredLevel: 2,
      trophyRequirement: 'Win Savanna Rookie Sprint',
    },
    description: 'Massive six-wheel-drive juggernaut. Unmatched launch traction and collision resistance that bulldozes through opponent grids.',
    badges: ['6X6 DRIVETRAIN', 'HEAVY TRUCK', 'COLLISION PROOF'],
  },

  // ==========================================
  // TIER 2: CLUB SPORT & HYPER EV
  // ==========================================
  {
    id: 'cybertruck',
    name: 'Cyber Wedge Beast',
    subtitle: 'Tri-Motor Armored AWD Wedge',
    category: 'Electric Truck',
    tier: 2,
    priceCredits: 22000,
    fileName: 'cubertrick.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'metallic_silver',
    specs: {
      topSpeedKmH: 225,
      accelerationSec: 2.7,
      handlingRating: 68,
      weightKg: 3100,
      powerHp: 845,
      drivetrain: 'AWD',
      brakingForce: 24.5,
      downforceRating: 52,
      engineForce: 11200,
      brakeForce: 9500,
      massKg: 3100,
      gripFactor: 0.72,
      turnRadiusRad: 0.55,
      drag: 0.39,
    },
    unlock: {
      method: 'credits',
      creditCost: 22000,
      requiredLevel: 4,
    },
    description: 'Stainless steel armored body with brutal low-speed torque delivery. Unstoppable pushing authority and high-speed highway stability.',
    badges: ['ALL-WHEEL DRIVE', 'ARMORED EXOSKELETON', 'INSTANT TORQUE'],
  },
  {
    id: 'toyota_supra',
    name: 'A90 GR Sopra Spec',
    subtitle: '3.0L Inline-6 Turbocharged Sport Coupe',
    category: 'JDM Sports Coupe',
    tier: 2,
    priceCredits: 28000,
    fileName: 'sopra.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'sunset_orange',
    specs: {
      topSpeedKmH: 265,
      accelerationSec: 3.9,
      handlingRating: 85,
      weightKg: 1520,
      powerHp: 382,
      drivetrain: 'RWD',
      brakingForce: 26.5,
      downforceRating: 70,
      engineForce: 7100,
      brakeForce: 8200,
      massKg: 1520,
      gripFactor: 0.85,
      turnRadiusRad: 0.61,
      drag: 0.29,
    },
    unlock: {
      method: 'drift_milestone',
      creditCost: 28000,
      requiredLevel: 5,
      trophyRequirement: 'Score 12,000+ Points in Drift Challenge',
    },
    description: 'Sharp, responsive front-engine rear-drive sports coupe. Wide steering angle authority and predictable power oversteer for high-speed drifting.',
    badges: ['TUNER ICON', 'DRIFT SPECIAL', 'RWD'],
  },

  // ==========================================
  // TIER 3: PRO RACING & AMERICAN MUSCLE
  // ==========================================
  {
    id: 'bmw_m3',
    name: 'Bavaria 3M Competition',
    subtitle: '3.0L Twin-Turbo S58 Competition Saloon',
    category: 'Performance Sedan',
    tier: 3,
    priceCredits: 36000,
    fileName: '3M.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'deep_blue',
    specs: {
      topSpeedKmH: 290,
      accelerationSec: 3.5,
      handlingRating: 86,
      weightKg: 1730,
      powerHp: 503,
      drivetrain: 'RWD',
      brakingForce: 27.5,
      downforceRating: 72,
      engineForce: 7600,
      brakeForce: 8800,
      massKg: 1730,
      gripFactor: 0.86,
      turnRadiusRad: 0.58,
      drag: 0.31,
    },
    unlock: {
      method: 'credits',
      creditCost: 36000,
      requiredLevel: 6,
    },
    description: 'Motorsport-bred competition saloon featuring high-revving twin-turbo power, stiffened anti-roll geometry, and surgical apex clipping.',
    badges: ['COMPETITION SPEC', 'PRO SALOON', 'RWD'],
  },
  {
    id: 'chevy_camaro',
    name: 'Detroit Camara ZL1',
    subtitle: '6.2L Supercharged LT4 V8 Muscle',
    category: 'American Muscle',
    tier: 3,
    priceCredits: 38000,
    fileName: 'camara.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'racing_yellow',
    specs: {
      topSpeedKmH: 318,
      accelerationSec: 3.5,
      handlingRating: 79,
      weightKg: 1670,
      powerHp: 650,
      drivetrain: 'RWD',
      brakingForce: 26.0,
      downforceRating: 68,
      engineForce: 8900,
      brakeForce: 8600,
      massKg: 1670,
      gripFactor: 0.80,
      turnRadiusRad: 0.54,
      drag: 0.35,
    },
    unlock: {
      method: 'credits',
      creditCost: 38000,
      requiredLevel: 7,
    },
    description: 'Supercharged American muscle delivering earth-shaking torque. Long-geared top speed reaching 318 km/h with visceral tire-smoking throttle response.',
    badges: ['SUPERCHARGED V8', '650 HP', '318 KM/H TOP SPEED'],
  },

  // ==========================================
  // TIER 4: MOTORSPORT & JDM LEGENDS
  // ==========================================
  {
    id: 'nissan_gtr_r34',
    name: 'Skyline GT34R V-Spec',
    subtitle: 'Twin-Turbo RB26DETT ATTESA All-Wheel Drive',
    category: 'Legendary JDM',
    tier: 4,
    priceCredits: 52000,
    fileName: 'GT34R.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'deep_blue',
    specs: {
      topSpeedKmH: 300,
      accelerationSec: 3.3,
      handlingRating: 90,
      weightKg: 1560,
      powerHp: 550,
      drivetrain: 'AWD',
      brakingForce: 28.5,
      downforceRating: 78,
      engineForce: 8100,
      brakeForce: 9000,
      massKg: 1560,
      gripFactor: 0.91,
      turnRadiusRad: 0.59,
      drag: 0.34,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 52000,
      requiredLevel: 8,
      trophyRequirement: 'Win Performance Series Championship',
    },
    description: 'Immortal Japanese engineering icon with computer-controlled torque split AWD. Tenacious corner-exit traction and high-speed straight-line stability.',
    badges: ['JDM LEGEND', 'ATTESA AWD', 'RB26 TWIN-TURBO'],
  },
  {
    id: 'gt3rs',
    name: 'Stuttgart 911 GTRS3',
    subtitle: '4.0L Naturally Aspirated 9000-RPM Track Weapon',
    category: 'Track Weapons',
    tier: 4,
    priceCredits: 75000,
    fileName: 'GTRS3.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'racing_red',
    specs: {
      topSpeedKmH: 296,
      accelerationSec: 3.0,
      handlingRating: 98,
      weightKg: 1450,
      powerHp: 518,
      drivetrain: 'RWD',
      brakingForce: 32.0,
      downforceRating: 96,
      engineForce: 8400,
      brakeForce: 12000,
      massKg: 1450,
      gripFactor: 0.98,
      turnRadiusRad: 0.62,
      drag: 0.35,
    },
    unlock: {
      method: 'credits',
      creditCost: 75000,
      requiredLevel: 10,
      realMoneyPriceUsd: 3.99,
      isPremiumExclusive: false,
    },
    description: 'Pure motorsport aerodynamic mastery. Giant swan-neck rear wing, carbon ceramic stopping authority, and 98/100 cornering precision.',
    badges: ['98/100 GRIP', 'CARBON CERAMICS', '9000 RPM FLAT-6'],
  },

  // ==========================================
  // TIER 5: PINNACLE & HYPERCAR APEX (ULTIMATE UNLOCKS)
  // ==========================================
  {
    id: 'aventador',
    name: 'Toro Aventador SVJ',
    subtitle: '6.5L Naturally Aspirated V12 Aerodinamica',
    category: 'V12 Supercar',
    tier: 5,
    priceCredits: 110000,
    fileName: 'aventador.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'racing_yellow',
    specs: {
      topSpeedKmH: 350,
      accelerationSec: 2.8,
      handlingRating: 92,
      weightKg: 1525,
      powerHp: 770,
      drivetrain: 'AWD',
      brakingForce: 30.5,
      downforceRating: 88,
      engineForce: 10200,
      brakeForce: 11000,
      massKg: 1525,
      gripFactor: 0.94,
      turnRadiusRad: 0.54,
      drag: 0.31,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 110000,
      requiredLevel: 12,
      trophyRequirement: 'Win Supercar Championship Cup',
      realMoneyPriceUsd: 4.99,
      isPremiumExclusive: false,
    },
    description: 'Screaming Italian atmospheric V12 masterpiece with active aerodynamics. 350 km/h top end with intoxicating high-speed lateral poise.',
    badges: ['V12 ATMOSPHERIC', '350 KM/H', 'ACTIVE AERO'],
  },
  {
    id: 'tesla_roadster',
    name: 'Volt Apex Roadster',
    subtitle: 'Tri-Motor All-Wheel Drive Hyper EV',
    category: 'Electric Hypercar',
    tier: 5,
    priceCredits: 135000,
    fileName: 'roadster.glb',
    yawOffset: Math.PI,
    defaultPaintId: 'racing_red',
    specs: {
      topSpeedKmH: 400,
      accelerationSec: 2.0,
      handlingRating: 91,
      weightKg: 2000,
      powerHp: 1020,
      drivetrain: 'AWD',
      brakingForce: 30.0,
      downforceRating: 84,
      engineForce: 12500,
      brakeForce: 10500,
      massKg: 2000,
      gripFactor: 0.92,
      turnRadiusRad: 0.56,
      drag: 0.21,
    },
    unlock: {
      method: 'premium_iap',
      creditCost: 135000,
      requiredLevel: 15,
      realMoneyPriceUsd: 6.99,
      isPremiumExclusive: true,
    },
    description: 'Unrivaled 400 km/h velocity with tri-motor torque vectoring. Ground-breaking low drag coefficient (0.21) and ferocious straight-line thrust.',
    badges: ['400 KM/H HYPERCAR', '0.21 DRAG', 'VIP PASS ($6.99)'],
  },
];

/**
 * Helper utilities for the Garage Showcase and Career Progression
 */
export function getVehiclesByTier(tier: VehicleTier): VehicleCatalogItem[] {
  return VEHICLE_CATALOG.filter((v) => v.tier === tier);
}

export function getPremiumVehicles(): VehicleCatalogItem[] {
  return VEHICLE_CATALOG.filter((v) => v.unlock.realMoneyPriceUsd !== undefined);
}

// Fallback alias map so legacy AI / Career configs ('apex_sport_coupe', 'azura_coupe', 'stratos_sedan') resolve cleanly
const LEGACY_ID_MAP: Record<string, string> = {
  apex_sport_coupe: 'gt3rs',
  azura_coupe: 'toyota_supra',
  stratos_sedan: 'bmw_m3',
};

export function getVehicleById(id: string): VehicleCatalogItem | undefined {
  const mappedId = LEGACY_ID_MAP[id] || id;
  return VEHICLE_CATALOG.find((v) => v.id === mappedId) || VEHICLE_CATALOG[0];
}