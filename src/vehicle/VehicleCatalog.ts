export interface VehicleSpecs {
  topSpeedKmH: number;
  accelerationSec: number; // 0-100 km/h
  handlingRating: number;  // 1-100
  weightKg: number;
  powerHp: number;
  drivetrain: 'RWD' | 'AWD' | 'FWD' | '6WD';
  brakingForce: number;
  downforceRating: number;
}

export interface VehicleCatalogItem {
  id: string;
  name: string;
  category: string;
  tier: 1 | 2 | 3 | 4 | 5;
  priceCredits: number;
  fileName: string;
  yawOffset?: number;
  defaultPaintId: string;
  specs: VehicleSpecs;
}

export const VEHICLE_CATALOG: VehicleCatalogItem[] = [
  {
    id: 'mercedes_slc',
    name: 'Stuttgart SLC Roadster',
    category: 'Roadster',
    tier: 1,
    priceCredits: 0,
    fileName: 'slc.glb',
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
    },
  },
  {
    id: 'bmw_x6',
    name: 'Bavaria X6M Coupe SUV',
    category: 'Performance SUV',
    tier: 1,
    priceCredits: 12000,
    fileName: 'x6.glb',
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
    },
  },
  {
    id: 'velociraptor',
    name: 'Mammoth F-1500 VelociRaptor',
    category: 'Off-Road 6x6 Truck',
    tier: 1,
    priceCredits: 15000,
    fileName: 'F-1500.glb',
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
    },
  },
  {
    id: 'cybertruck',
    name: 'Cyber Wedge Beast',
    category: 'Electric Truck',
    tier: 2,
    priceCredits: 22000,
    fileName: 'cubertrick.glb',
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
    },
  },
  {
    id: 'toyota_supra',
    name: 'A90 GR Sopra Spec',
    category: 'JDM Sports Coupe',
    tier: 2,
    priceCredits: 28000,
    fileName: 'sopra.glb',
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
    },
  },
  {
    id: 'bmw_m3',
    name: 'Bavaria 3M Competition',
    category: 'Performance Sedan',
    tier: 3,
    priceCredits: 36000,
    fileName: '3M.glb',
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
    },
  },
  {
    id: 'chevy_camaro',
    name: 'Detroit Camara ZL1',
    category: 'American Muscle',
    tier: 3,
    priceCredits: 38000,
    fileName: 'camara.glb',
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
    },
  },
  {
    id: 'nissan_gtr_r34',
    name: 'Skyline GT34R V-Spec',
    category: 'Legendary JDM',
    tier: 4,
    priceCredits: 52000,
    fileName: 'GT34R.glb',
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
    },
  },
  {
    id: 'gt3rs',
    name: 'Stuttgart 911 GTRS3',
    category: 'Track Weapons',
    tier: 4,
    priceCredits: 75000,
    fileName: 'GTRS3.glb',
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
    },
  },
  {
    id: 'aventador',
    name: 'Toro Aventador SVJ',
    category: 'V12 Supercar',
    tier: 5,
    priceCredits: 110000,
    fileName: 'aventador.glb',
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
    },
  },
  {
    id: 'tesla_roadster',
    name: 'Volt Apex Roadster',
    category: 'Electric Hypercar',
    tier: 5,
    priceCredits: 135000,
    fileName: 'roadster.glb',
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
    },
  },
];

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