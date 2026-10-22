/**
 * Project Apex — Vehicle Catalog, Attribute Specifications & Progression System
 * Defines real performance attributes, handling characteristics, progression tiers,
 * and unlock/monetization rules for all showcase and playable vehicles.
 */

export type VehicleTier = 1 | 2 | 3 | 4 | 5;

export type DrivetrainType = 'FWD' | 'RWD' | 'AWD' | 'Dual-Motor AWD' | 'Tri-Motor AWD';

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
}

export interface VehicleCatalogItem {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  tier: VehicleTier;
  fileName: string;
  yawOffset?: number; // Visual yaw offset in radians for models authored with inverted/flipped headings
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
    id: 'detective_cruiser',
    name: 'VALIANT ENFORCER',
    subtitle: '1984 V8 Heavy Duty Sedan',
    category: 'Class D • Vintage Utility',
    tier: 1,
    fileName: 'generic_detective_car.glb',
    specs: {
      topSpeedKmH: 155,
      accelerationSec: 9.6,
      handlingRating: 46,
      weightKg: 1720,
      powerHp: 185,
      drivetrain: 'RWD',
      brakingForce: 18.0,
      downforceRating: 15,
    },
    unlock: {
      method: 'starter',
      creditCost: 0,
      requiredLevel: 1,
    },
    description: 'Rugged rear-wheel-drive sedan with a low-compression cast-iron V8. Heavy body inertia with predictable, forgiving slides.',
    badges: ['STARTER VEHICLE', 'HEAVY CHASSIS'],
  },
  {
    id: 'fairhaven_lt80',
    name: 'FAIRHAVEN LT-80',
    subtitle: 'Classic Lightweight Touring Coupe',
    category: 'Class D • Classic Sport',
    tier: 1,
    fileName: 'fairheaven_lt_80_-_low_poly_model.glb',
    specs: {
      topSpeedKmH: 168,
      accelerationSec: 8.4,
      handlingRating: 58,
      weightKg: 1080,
      powerHp: 150,
      drivetrain: 'RWD',
      brakingForce: 20.0,
      downforceRating: 22,
    },
    unlock: {
      method: 'credits',
      creditCost: 8000,
      requiredLevel: 2,
    },
    description: 'A beloved 1980s lightweight platform offering balanced corner turn-in, agile weight transfer, and accessible driver engagement.',
    badges: ['LIGHTWEIGHT', 'AGILE TURN-IN'],
  },
  {
    id: 'sanremo_70',
    name: 'SANREMO CORSA 70',
    subtitle: '1974 Historic Tarmac Rally Car',
    category: 'Class D • Classic Rally',
    tier: 1,
    fileName: 'sanremo_70_-_low_poly_model.glb',
    yawOffset: Math.PI / 2, // Model authored facing -X; rotate +90° to face forward (+Z)
    specs: {
      topSpeedKmH: 175,
      accelerationSec: 7.8,
      handlingRating: 66,
      weightKg: 940,
      powerHp: 165,
      drivetrain: 'RWD',
      brakingForce: 21.0,
      downforceRating: 28,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 14000,
      requiredLevel: 3,
      trophyRequirement: 'Win Forest Loop Sprint Challenge',
    },
    description: 'Sub-1,000kg historic Italian rally machine. High steering responsiveness and sharp direction changes through tight chicanes.',
    badges: ['RALLY HERITAGE', 'SUB-TON WEIGHT'],
  },
  {
    id: 'fairhaven_pursuit',
    name: 'FAIRHAVEN INTERCEPTOR',
    subtitle: 'Highway Patrol Pursuit Edition',
    category: 'Class D • Pursuit Special',
    tier: 1,
    fileName: 'fairheaven_lt_80_cop_cruiser_-_low_poly_model.glb',
    specs: {
      topSpeedKmH: 182,
      accelerationSec: 7.4,
      handlingRating: 60,
      weightKg: 1190,
      powerHp: 190,
      drivetrain: 'RWD',
      brakingForce: 22.0,
      downforceRating: 30,
    },
    unlock: {
      method: 'credits',
      creditCost: 18500,
      requiredLevel: 4,
    },
    description: 'Factory-tuned interceptor variant equipped with stiffened anti-roll bars, high-rate dampers, and a tuned twin-cam powerplant.',
    badges: ['PURSUIT TUNED', 'REINFORCED BARS'],
  },

  // ==========================================
  // TIER 2: CLUB SPORT & TUNER (INTERMEDIATE PROGRESSION)
  // ==========================================
  {
    id: 'velocity_hatch',
    name: 'VELOCITY GT HATCH',
    subtitle: '2.0L Turbo Hot Hatchback',
    category: 'Class C • Sport Hatch',
    tier: 2,
    fileName: 'car_generic_hatchback_gameready_with_interior.glb',
    specs: {
      topSpeedKmH: 215,
      accelerationSec: 6.0,
      handlingRating: 69,
      weightKg: 1320,
      powerHp: 275,
      drivetrain: 'FWD',
      brakingForce: 23.0,
      downforceRating: 42,
    },
    unlock: {
      method: 'credits',
      creditCost: 28000,
      requiredLevel: 5,
    },
    description: 'Punchy turbocharged modern hot hatch with mechanical limited-slip differential. Exceptional front-end pull through mid-speed apexes.',
    badges: ['TURBOCHARGED', 'HIGH-SPEED STABILITY'],
  },
  {
    id: 'stratos_sedan',
    name: 'APEX STRATOS AWD',
    subtitle: 'All-Weather Sport Saloon',
    category: 'Class C • Executive Sport',
    tier: 2,
    fileName: 'generic_sedan_car.glb',
    specs: {
      topSpeedKmH: 224,
      accelerationSec: 5.6,
      handlingRating: 67,
      weightKg: 1560,
      powerHp: 320,
      drivetrain: 'AWD',
      brakingForce: 23.5,
      downforceRating: 40,
    },
    unlock: {
      method: 'credits',
      creditCost: 34000,
      requiredLevel: 7,
    },
    description: 'Permanent all-wheel-drive platform providing maximum corner-exit traction and rock-solid wet or dry tarmac stability.',
    badges: ['ALL-WHEEL DRIVE', 'PLANTED TRACTION'],
  },
  {
    id: 'toyama_xr',
    name: 'TOYAMA XR-300',
    subtitle: 'Twin-Cam Drift Masterpiece',
    category: 'Class C • Pro Drift Tuner',
    tier: 2,
    fileName: 'generic_toyama_xr_sedan.glb',
    specs: {
      topSpeedKmH: 236,
      accelerationSec: 5.1,
      handlingRating: 75,
      weightKg: 1380,
      powerHp: 360,
      drivetrain: 'RWD',
      brakingForce: 24.0,
      downforceRating: 45,
    },
    unlock: {
      method: 'drift_milestone',
      creditCost: 42000,
      requiredLevel: 8,
      trophyRequirement: 'Score 15,000+ Points in Drift Challenge',
    },
    description: 'Legendary Japanese drift icon with wide steering angle lock, linear counter-steer response, and progressive power oversteer.',
    badges: ['DRIFT SPECIAL', 'HIGH-STEER LOCK'],
  },
  {
    id: 'titan_suv',
    name: 'TITAN SPORT V8',
    subtitle: 'High-Output Performance SUV',
    category: 'Class C • Super SUV',
    tier: 2,
    fileName: 'lowpoly_generic_suv.glb',
    specs: {
      topSpeedKmH: 228,
      accelerationSec: 5.2,
      handlingRating: 59,
      weightKg: 2150,
      powerHp: 480,
      drivetrain: 'AWD',
      brakingForce: 25.0,
      downforceRating: 35,
    },
    unlock: {
      method: 'credits',
      creditCost: 48000,
      requiredLevel: 9,
    },
    description: 'Twin-turbocharged heavyweight muscle. Heavy straight-line punch with solid vehicle-to-vehicle collision deflection resistance.',
    badges: ['COLLISION RESISTANT', 'V8 TWIN-TURBO'],
  },

  // ==========================================
  // TIER 3: PRO RACING & SPORTS COUPES (CHAMPIONSHIP TIER)
  // ==========================================
  {
    id: 'azura_coupe',
    name: 'AZURA GT COUPE',
    subtitle: 'Mid-Engine Naturally Aspirated V6',
    category: 'Class B • Track Sport',
    tier: 3,
    fileName: 'generic_coupe_azura.glb',
    specs: {
      topSpeedKmH: 252,
      accelerationSec: 4.6,
      handlingRating: 78,
      weightKg: 1420,
      powerHp: 385,
      drivetrain: 'RWD',
      brakingForce: 25.5,
      downforceRating: 58,
    },
    unlock: {
      method: 'credits',
      creditCost: 65000,
      requiredLevel: 11,
    },
    description: 'Crisp 50:50 weight balance sports coupe. High corner apex apex-rotation authority with linear throttle modulation.',
    badges: ['50:50 BALANCE', 'NATURALLY ASPIRATED'],
  },
  {
    id: 'apex01_flagship',
    name: 'APEX-01 PRO-SPEC',
    subtitle: 'Time-Attack Production Flagship',
    category: 'Class B • Time Attack',
    tier: 3,
    fileName: 'APX01.glb',
    specs: {
      topSpeedKmH: 260,
      accelerationSec: 4.0,
      handlingRating: 83,
      weightKg: 1280,
      powerHp: 420,
      drivetrain: 'RWD',
      brakingForce: 26.0,
      downforceRating: 68,
    },
    unlock: {
      method: 'starter',
      creditCost: 0,
      requiredLevel: 1,
    },
    description: 'The definitive Project Apex flagship chassis. Perfectly balanced spring damping, sticky slicks, and track-optimized steering.',
    badges: ['SERIES FLAGSHIP', 'TIME ATTACK HERO'],
  },
  {
    id: 'apex_sport_coupe',
    name: 'MONARCH RS COUPE',
    subtitle: '3.0L Twin-Turbo Competition Spec',
    category: 'Class B • Pro-Sport',
    tier: 3,
    fileName: 'generic_sport_coupe_car.glb',
    specs: {
      topSpeedKmH: 270,
      accelerationSec: 3.9,
      handlingRating: 81,
      weightKg: 1390,
      powerHp: 460,
      drivetrain: 'RWD',
      brakingForce: 26.5,
      downforceRating: 65,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 82000,
      requiredLevel: 13,
      trophyRequirement: 'Win Grand Course Sprint Trophy',
    },
    description: 'Aggressive aero package with active carbon rear wing. High high-speed grip with immediate high-load braking performance.',
    badges: ['ACTIVE AERO', 'CARBON COMPOSITE'],
  },
  {
    id: 'vector_ev',
    name: 'VECTOR EV SEDAN',
    subtitle: 'Dual-Motor High-Voltage Performance',
    category: 'Class B • Electric Super-Sedan',
    tier: 3,
    fileName: 'generic_electric_sedan_vector.glb',
    yawOffset: -Math.PI / 2, // Model authored facing +X; rotate -90° to face forward (+Z)
    specs: {
      topSpeedKmH: 280,
      accelerationSec: 3.1,
      handlingRating: 79,
      weightKg: 1960,
      powerHp: 650,
      drivetrain: 'Dual-Motor AWD',
      brakingForce: 27.0,
      downforceRating: 62,
    },
    unlock: {
      method: 'credits',
      creditCost: 98000,
      requiredLevel: 15,
    },
    description: 'Floor-mounted battery architecture delivering an ultra-low center of gravity and instantaneous zero-RPM launch acceleration.',
    badges: ['DUAL-MOTOR AWD', 'SUB-3.5S 0-100'],
  },
  {
    id: 'executive_rs',
    name: 'SOVEREIGN RS SALOON',
    subtitle: 'Twin-Turbo V8 Autobahn Cruiser',
    category: 'Class B • Grand Tourer',
    tier: 3,
    fileName: 'modern_luxury_sports_sedan_3d_model__car.glb',
    yawOffset: -Math.PI / 2, // Model authored facing +X; rotate -90° to face forward (+Z)
    specs: {
      topSpeedKmH: 290,
      accelerationSec: 3.5,
      handlingRating: 82,
      weightKg: 1780,
      powerHp: 610,
      drivetrain: 'AWD',
      brakingForce: 27.5,
      downforceRating: 70,
    },
    unlock: {
      method: 'credits',
      creditCost: 115000,
      requiredLevel: 17,
    },
    description: 'Effortless high-speed stability and luxury endurance pacing. Long wheelbase keeps high-speed corners calm and planted.',
    badges: ['AUTOBAHN SPEC', 'V8 BITURBO'],
  },

  // ==========================================
  // TIER 4: MOTORSPORT & HYPERCARS (ELITE & VIP RESERVES)
  // ==========================================
  {
    id: 'm3_gtr_gt2',
    name: 'BAVARIA M3 GTR GT2',
    subtitle: '4.0L P60 V8 Endurance Champion',
    category: 'Class A • GT2 Homologation',
    tier: 4,
    fileName: 'bmw_m3_gtr.glb',
    sourceZip: 'bmw-m3-gtr-gt2.zip',
    specs: {
      topSpeedKmH: 305,
      accelerationSec: 3.3,
      handlingRating: 90,
      weightKg: 1120,
      powerHp: 500,
      drivetrain: 'RWD',
      brakingForce: 28.5,
      downforceRating: 85,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 160000,
      requiredLevel: 20,
      trophyRequirement: 'Win Apex Elite Championship',
      realMoneyPriceUsd: 2.99,
      isPremiumExclusive: false,
    },
    description: 'Iconic GT homologation hero featuring straight-cut gearbox acoustics, flat-plane V8 scream, and track-sculpted aero diffusers.',
    badges: ['GT2 CHAMPION', 'STRAIGHT-CUT GEARS', 'CREDITS OR $2.99'],
  },
  {
    id: 'cybertruck_racing',
    name: 'CYBERBEAST APEX R',
    subtitle: 'Tri-Motor Armored Track Prototype',
    category: 'Class A • Heavy Hyper-EV',
    tier: 4,
    fileName: 'tesla_cybertruck__racing_free_model.glb',
    specs: {
      topSpeedKmH: 220,
      accelerationSec: 2.6,
      handlingRating: 73,
      weightKg: 2980,
      powerHp: 845,
      drivetrain: 'Tri-Motor AWD',
      brakingForce: 28.0,
      downforceRating: 50,
    },
    unlock: {
      method: 'premium_iap',
      creditCost: 200000,
      realMoneyPriceUsd: 3.99,
      isPremiumExclusive: true,
    },
    description: 'Stainless exoskeleton bulletproof prototype. Monster launch acceleration with devastating pushing power through crowded race grids.',
    badges: ['RESERVE IAP ($3.99)', 'ARMORED BODY', '845 HP TRI-MOTOR'],
  },
  {
    id: 'roadster_hyper',
    name: 'AERO ROADSTER 2026',
    subtitle: 'Next-Gen Tri-Motor Electric Hypercar',
    category: 'Class A • Hyper EV',
    tier: 4,
    fileName: 'tesla_roadster_2020.glb',
    specs: {
      topSpeedKmH: 345,
      accelerationSec: 2.0,
      handlingRating: 92,
      weightKg: 1740,
      powerHp: 1100,
      drivetrain: 'Tri-Motor AWD',
      brakingForce: 29.5,
      downforceRating: 88,
    },
    unlock: {
      method: 'career_trophy',
      creditCost: 240000,
      requiredLevel: 25,
      trophyRequirement: 'Apex Elite 1st Place Gold Cup',
      realMoneyPriceUsd: 4.99,
      isPremiumExclusive: false,
    },
    description: 'Unprecedented 2.0-second sprint velocity with tri-motor torque vectoring. Claws through corners at physics-defying speed.',
    badges: ['SUB-2.0S 0-100', 'TORQUE VECTORING', 'CREDITS OR $4.99'],
  },

  // ==========================================
  // TIER 5: PINNACLE & HERITAGE (ULTIMATE UNLOCKS & VIP PASS)
  // ==========================================
  {
    id: 'mclaren_f1_legend',
    name: 'MONACO F1 ROAD CAR',
    subtitle: '6.1L Naturally Aspirated V12 Legend',
    category: 'Apex Legend • Ultimate Heritage',
    tier: 5,
    fileName: 'mclaren_f1_1993_by_alex.ka.glb',
    specs: {
      topSpeedKmH: 386,
      accelerationSec: 3.2,
      handlingRating: 96,
      weightKg: 1138,
      powerHp: 627,
      drivetrain: 'RWD',
      brakingForce: 30.0,
      downforceRating: 92,
    },
    unlock: {
      method: 'premium_iap',
      creditCost: 450000,
      realMoneyPriceUsd: 4.99,
      isPremiumExclusive: true,
    },
    description: 'The golden era of automotive purism. Carbon monocoque, central driver command cockpit, gold-leaf heat shielding, and an immortal 386 km/h record.',
    badges: ['LEGENDARY HERITAGE', '386 KM/H RECORD', 'VIP PASS ($4.99)'],
  },
  {
    id: 'f1_2022_pinnacle',
    name: 'FORMULA APEX GP-22',
    subtitle: '1.6L Turbo Hybrid Ground-Effect Racer',
    category: 'Apex Pinnacle • Open-Wheel Formula',
    tier: 5,
    fileName: 'f1_2022_generic_free_for_theodevf12.glb',
    specs: {
      topSpeedKmH: 362,
      accelerationSec: 1.8,
      handlingRating: 99,
      weightKg: 798,
      powerHp: 1020,
      drivetrain: 'RWD',
      brakingForce: 34.0,
      downforceRating: 100,
    },
    unlock: {
      method: 'premium_iap',
      creditCost: 600000,
      realMoneyPriceUsd: 6.99,
      isPremiumExclusive: true,
    },
    description: 'Ground-effect underfloor venturi tunnels generating over 5G lateral cornering authority. The undisputed benchmark of motorsport engineering.',
    badges: ['PINNACLE 99 HANDLING', '5G CORNERING', 'VIP GP PASS ($6.99)'],
  },
];

/**
 * Helper utilities for the Garage Showcase
 */
export function getVehiclesByTier(tier: VehicleTier): VehicleCatalogItem[] {
  return VEHICLE_CATALOG.filter((v) => v.tier === tier);
}

export function getVehicleById(id: string): VehicleCatalogItem | undefined {
  return VEHICLE_CATALOG.find((v) => v.id === id);
}

export function getPremiumVehicles(): VehicleCatalogItem[] {
  return VEHICLE_CATALOG.filter((v) => v.unlock.realMoneyPriceUsd !== undefined);
}
