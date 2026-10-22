import { RaceMode } from '../events/EventConfig';
import { AIDifficulty } from '../ai/AIOpponent';
import { VehicleTier } from '../vehicle/VehicleCatalog';

export interface CareerTierInfo {
  tierNumber: number;
  name: string;
  subtitle: string;
  requiredReputation: number;
  description: string;
  badge: string;
  colorHex: string;
}

export interface CareerEventObjective {
  id: string;
  description: string;
  bonusCredits: number;
}

export interface CareerRewardTable {
  gold: number;
  silver: number;
  bronze: number;
  completion: number;
}

export interface CareerEventEligibility {
  allowedTiers: VehicleTier[];
  minHandlingRating?: number;
}

export interface CareerEventDefinition {
  id: string;
  tier: number;
  orderInTier: number;
  name: string;
  subtitle: string;
  circuitId: 'forest_valley' | 'azure_coast';
  mode: RaceMode;
  opponentsCount: number;
  aiDifficulty: AIDifficulty;
  description: string;
  rewards: CareerRewardTable;
  reputationReward: number;
  eligibility: CareerEventEligibility;
  unlockRequirement: {
    previousEventId?: string;
    requiredReputation?: number;
    trophyRequirement?: string;
  };
  targetBenchmark?: {
    gold: number;   // Max time in seconds or min drift score in points
    silver: number;
    bronze: number;
  };
  objectives: CareerEventObjective[];
}

export const CAREER_TIERS: CareerTierInfo[] = [
  {
    tierNumber: 1,
    name: 'Rookie Circuit',
    subtitle: 'Grassroots Motorsport & Novice Academy',
    requiredReputation: 0,
    description: 'Introductory tarmac competitions and accessible opponents designed to establish foundational car control and racing lines.',
    badge: 'CLASS D • NOVICE',
    colorHex: '#10b981',
  },
  {
    tierNumber: 2,
    name: 'Street League',
    subtitle: 'Club Sport & Tuner Championship',
    requiredReputation: 450,
    description: 'Step up into turbocharged hot hatches and all-weather sport saloons across the tight, scenic coastal ribbon.',
    badge: 'CLASS C • CLUB',
    colorHex: '#00d2ff',
  },
  {
    tierNumber: 3,
    name: 'Performance Series',
    subtitle: 'Pro Racing & Time-Attack Shootout',
    requiredReputation: 1100,
    description: 'Demanding competitions featuring high-output GT coupes, mid-engine platforms, and precision chassis dynamics.',
    badge: 'CLASS B • PRO',
    colorHex: '#f59e0b',
  },
  {
    tierNumber: 4,
    name: 'Supercar Championship',
    subtitle: 'Endurance GT & Hyper-EV Series',
    requiredReputation: 2200,
    description: 'High-downforce GT2 endurance racers and multi-motor electric prototypes pushing aggressive speeds through crowded grids.',
    badge: 'CLASS A • ELITE',
    colorHex: '#e10600',
  },
  {
    tierNumber: 5,
    name: 'Apex Championship',
    subtitle: 'Pinnacle Prototype & Formula Grand Prix',
    requiredReputation: 3800,
    description: 'The definitive benchmark of global motorsport. 1000+ horsepower, ground-effect aero, and unforgiving 5G cornering.',
    badge: 'PINNACLE • APEX',
    colorHex: '#a855f7',
  },
];

export const CAREER_EVENTS: CareerEventDefinition[] = [
  // ==========================================
  // TIER 1: ROOKIE CIRCUIT (NOVICE)
  // ==========================================
  {
    id: 'rookie_sprint_1',
    tier: 1,
    orderInTier: 1,
    name: 'Rookie Debut Sprint',
    subtitle: 'Forest Valley Circuit • 420m Main Straight Chute',
    circuitId: 'forest_valley',
    mode: 'sprint',
    opponentsCount: 2,
    aiDifficulty: 'amateur',
    description: 'Your career debut. 2-car grid race down the Forest Valley straight chute into the northern braking chicane.',
    rewards: { gold: 3500, silver: 2200, bronze: 1400, completion: 700 },
    reputationReward: 150,
    eligibility: { allowedTiers: [1] },
    unlockRequirement: {},
    objectives: [
      { id: 'first_place', description: 'Finish in 1st Place', bonusCredits: 1000 },
      { id: 'clean_race', description: 'Clean Drive: No barrier collisions', bonusCredits: 600 },
    ],
  },
  {
    id: 'rookie_time_trial_2',
    tier: 1,
    orderInTier: 2,
    name: 'Forest Valley Novice Trial',
    subtitle: 'Forest Valley Circuit • 980m Grand Course Benchmark',
    circuitId: 'forest_valley',
    mode: 'time_trial',
    opponentsCount: 0,
    aiDifficulty: 'amateur',
    description: 'A complete solo flying lap around the 980-meter Grand Course. Master apex clipping and trail braking.',
    rewards: { gold: 4000, silver: 2600, bronze: 1600, completion: 800 },
    reputationReward: 180,
    eligibility: { allowedTiers: [1] },
    unlockRequirement: { previousEventId: 'rookie_sprint_1' },
    targetBenchmark: { gold: 72.0, silver: 82.0, bronze: 95.0 },
    objectives: [
      { id: 'beat_gold', description: 'Beat Gold Target Time (< 72.0s)', bonusCredits: 1200 },
    ],
  },
  {
    id: 'rookie_drift_3',
    tier: 1,
    orderInTier: 3,
    name: 'Grassroots Drift Clinic',
    subtitle: 'Forest Valley Circuit • 90s Freestyle Arena',
    circuitId: 'forest_valley',
    mode: 'drift',
    opponentsCount: 0,
    aiDifficulty: 'rookie',
    description: 'Learn weight transfer and throttle modulation. Sustain lateral slides through the wide stadium corners.',
    rewards: { gold: 4500, silver: 3000, bronze: 1800, completion: 900 },
    reputationReward: 200,
    eligibility: { allowedTiers: [1] },
    unlockRequirement: { previousEventId: 'rookie_time_trial_2' },
    targetBenchmark: { gold: 6000, silver: 4000, bronze: 2000 },
    objectives: [
      { id: 'target_score', description: 'Bank 6,000+ Drift Points', bonusCredits: 1500 },
      { id: 'multiplier', description: 'Achieve a x1.5+ Combo Multiplier', bonusCredits: 800 },
    ],
  },

  // ==========================================
  // TIER 2: STREET LEAGUE (CLUB)
  // ==========================================
  {
    id: 'street_sprint_1',
    tier: 2,
    orderInTier: 1,
    name: 'Coastal Club Sprint',
    subtitle: 'Azure Coast Circuit • 280m Promenade Sprint',
    circuitId: 'azure_coast',
    mode: 'sprint',
    opponentsCount: 3,
    aiDifficulty: 'rookie',
    description: 'High-speed wheel-to-wheel sprint along the Mediterranean waterfront against a full 3-opponent fleet.',
    rewards: { gold: 6500, silver: 4500, bronze: 2800, completion: 1400 },
    reputationReward: 260,
    eligibility: { allowedTiers: [1, 2] },
    unlockRequirement: { requiredReputation: 450 },
    objectives: [
      { id: 'first_place', description: 'Finish in 1st Place', bonusCredits: 1800 },
      { id: 'top_speed', description: 'Exceed 170 km/h during race', bonusCredits: 900 },
    ],
  },
  {
    id: 'street_time_trial_2',
    tier: 2,
    orderInTier: 2,
    name: 'Azure GP Time Benchmark',
    subtitle: 'Azure Coast Circuit • 580m GP Track',
    circuitId: 'azure_coast',
    mode: 'time_trial',
    opponentsCount: 0,
    aiDifficulty: 'rookie',
    description: 'A technical qualifying trial around Azure Coast. Demands quick directional agility through chicanes.',
    rewards: { gold: 7200, silver: 5000, bronze: 3200, completion: 1600 },
    reputationReward: 300,
    eligibility: { allowedTiers: [1, 2] },
    unlockRequirement: { previousEventId: 'street_sprint_1' },
    targetBenchmark: { gold: 44.0, silver: 49.0, bronze: 56.0 },
    objectives: [
      { id: 'beat_gold', description: 'Beat Gold Target Time (< 44.0s)', bonusCredits: 2000 },
    ],
  },
  {
    id: 'street_drift_3',
    tier: 2,
    orderInTier: 3,
    name: 'Harbor Technical Drift',
    subtitle: 'Azure Coast Circuit • 90s Coastal Arena',
    circuitId: 'azure_coast',
    mode: 'drift',
    opponentsCount: 0,
    aiDifficulty: 'pro',
    description: 'Tight hairpins and rapid elevation transitions test counter-steer precision and angle retention.',
    rewards: { gold: 8000, silver: 5500, bronze: 3500, completion: 1800 },
    reputationReward: 340,
    eligibility: { allowedTiers: [1, 2] },
    unlockRequirement: { previousEventId: 'street_time_trial_2' },
    targetBenchmark: { gold: 10000, silver: 7000, bronze: 4000 },
    objectives: [
      { id: 'target_score', description: 'Bank 10,000+ Drift Points', bonusCredits: 2200 },
      { id: 'combo', description: 'Achieve a x1.8+ Combo Multiplier', bonusCredits: 1000 },
    ],
  },

  // ==========================================
  // TIER 3: PERFORMANCE SERIES (PRO)
  // ==========================================
  {
    id: 'perf_sprint_1',
    tier: 3,
    orderInTier: 1,
    name: 'Grand Course Trophy Sprint',
    subtitle: 'Forest Valley Circuit • 420m Sprint Trophy',
    circuitId: 'forest_valley',
    mode: 'sprint',
    opponentsCount: 3,
    aiDifficulty: 'pro',
    description: 'Pro-spec competition featuring balanced sports coupes and time-attack flagship chassis.',
    rewards: { gold: 12000, silver: 8200, bronze: 5200, completion: 2600 },
    reputationReward: 420,
    eligibility: { allowedTiers: [2, 3] },
    unlockRequirement: { requiredReputation: 1100 },
    objectives: [
      { id: 'first_place', description: 'Finish in 1st Place', bonusCredits: 3000 },
      { id: 'clean_drive', description: 'Zero wall impacts during sprint', bonusCredits: 1500 },
    ],
  },
  {
    id: 'perf_time_trial_2',
    tier: 3,
    orderInTier: 2,
    name: 'Apex Flagship Shootout',
    subtitle: 'Forest Valley Circuit • 980m Grand Course',
    circuitId: 'forest_valley',
    mode: 'time_trial',
    opponentsCount: 0,
    aiDifficulty: 'pro',
    description: 'Extract every ounce of apex grip and high-speed stability across the high-speed back straight.',
    rewards: { gold: 13500, silver: 9200, bronze: 5800, completion: 2900 },
    reputationReward: 460,
    eligibility: { allowedTiers: [2, 3] },
    unlockRequirement: { previousEventId: 'perf_sprint_1' },
    targetBenchmark: { gold: 55.0, silver: 60.0, bronze: 68.0 },
    objectives: [
      { id: 'beat_gold', description: 'Beat Gold Target Time (< 55.0s)', bonusCredits: 3500 },
    ],
  },
  {
    id: 'perf_drift_3',
    tier: 3,
    orderInTier: 3,
    name: 'Pro Drift Masters Showcase',
    subtitle: 'Forest Valley Circuit • 90s Pro Arena',
    circuitId: 'forest_valley',
    mode: 'drift',
    opponentsCount: 0,
    aiDifficulty: 'elite',
    description: 'Championship drift event requiring high entry speeds and linked transition slides.',
    rewards: { gold: 15000, silver: 10200, bronze: 6500, completion: 3200 },
    reputationReward: 500,
    eligibility: { allowedTiers: [2, 3] },
    unlockRequirement: { previousEventId: 'perf_time_trial_2' },
    targetBenchmark: { gold: 16000, silver: 11000, bronze: 7000 },
    objectives: [
      { id: 'target_score', description: 'Bank 16,000+ Drift Points', bonusCredits: 4000 },
      { id: 'multiplier', description: 'Achieve a x2.0+ Combo Multiplier', bonusCredits: 2000 },
    ],
  },

  // ==========================================
  // TIER 4: SUPERCAR CHAMPIONSHIP (ELITE)
  // ==========================================
  {
    id: 'super_sprint_1',
    tier: 4,
    orderInTier: 1,
    name: 'Riviera GT Invitational',
    subtitle: 'Azure Coast Circuit • 280m GT Sprint',
    circuitId: 'azure_coast',
    mode: 'sprint',
    opponentsCount: 3,
    aiDifficulty: 'elite',
    description: 'High-downforce GT2 homologation monsters battle wheel-to-wheel with aggressive late braking.',
    rewards: { gold: 22000, silver: 15000, bronze: 9500, completion: 4800 },
    reputationReward: 650,
    eligibility: { allowedTiers: [3, 4] },
    unlockRequirement: { requiredReputation: 2200 },
    objectives: [
      { id: 'first_place', description: 'Win 1st Place against Elite AI', bonusCredits: 5500 },
      { id: 'fast_lap', description: 'Reach top speed over 240 km/h', bonusCredits: 2500 },
    ],
  },
  {
    id: 'super_time_trial_2',
    tier: 4,
    orderInTier: 2,
    name: 'Coastal GT2 Time Attack',
    subtitle: 'Azure Coast Circuit • 580m GP Track',
    circuitId: 'azure_coast',
    mode: 'time_trial',
    opponentsCount: 0,
    aiDifficulty: 'elite',
    description: 'Ultra-precision qualifying lap pushing downforce aero to its maximum cornering threshold.',
    rewards: { gold: 24000, silver: 16500, bronze: 10500, completion: 5200 },
    reputationReward: 700,
    eligibility: { allowedTiers: [3, 4] },
    unlockRequirement: { previousEventId: 'super_sprint_1' },
    targetBenchmark: { gold: 35.0, silver: 38.5, bronze: 44.0 },
    objectives: [
      { id: 'beat_gold', description: 'Beat Gold Target Time (< 35.0s)', bonusCredits: 6000 },
    ],
  },
  {
    id: 'super_drift_3',
    tier: 4,
    orderInTier: 3,
    name: 'Supercar High-Angle Drift',
    subtitle: 'Azure Coast Circuit • 90s Coastal Arena',
    circuitId: 'azure_coast',
    mode: 'drift',
    opponentsCount: 0,
    aiDifficulty: 'apex_elite',
    description: 'Tame 800+ horsepower monsters sideways through coastal chicanes and waterfront sweepers.',
    rewards: { gold: 26000, silver: 18000, bronze: 11500, completion: 5800 },
    reputationReward: 750,
    eligibility: { allowedTiers: [3, 4] },
    unlockRequirement: { previousEventId: 'super_time_trial_2' },
    targetBenchmark: { gold: 22000, silver: 15000, bronze: 10000 },
    objectives: [
      { id: 'target_score', description: 'Bank 22,000+ Drift Points', bonusCredits: 6500 },
      { id: 'multiplier', description: 'Achieve a x2.2+ Combo Multiplier', bonusCredits: 3000 },
    ],
  },

  // ==========================================
  // TIER 5: APEX CHAMPIONSHIP (PINNACLE)
  // ==========================================
  {
    id: 'apex_sprint_1',
    tier: 5,
    orderInTier: 1,
    name: 'Apex Grand Prix Invitational',
    subtitle: 'Forest Valley Circuit • 420m Grand Course Sprint',
    circuitId: 'forest_valley',
    mode: 'sprint',
    opponentsCount: 3,
    aiDifficulty: 'apex_elite',
    description: 'The pinnacle of motorsport racing. 1000+ horsepower open-wheel and hypercar prototypes at extreme pace.',
    rewards: { gold: 38000, silver: 26000, bronze: 17000, completion: 8500 },
    reputationReward: 1000,
    eligibility: { allowedTiers: [4, 5] },
    unlockRequirement: { requiredReputation: 3800 },
    objectives: [
      { id: 'first_place', description: 'Win 1st Place in the Apex Grand Prix', bonusCredits: 10000 },
      { id: 'clean_drive', description: 'Zero collisions during pinnacle sprint', bonusCredits: 5000 },
    ],
  },
  {
    id: 'apex_time_trial_2',
    tier: 5,
    orderInTier: 2,
    name: 'Formula Apex Benchmark',
    subtitle: 'Forest Valley Circuit • 980m Grand Course',
    circuitId: 'forest_valley',
    mode: 'time_trial',
    opponentsCount: 0,
    aiDifficulty: 'apex_elite',
    description: 'The ultimate solo speed benchmark. Exploit ground-effect tunnels and blistering acceleration.',
    rewards: { gold: 42000, silver: 29000, bronze: 19000, completion: 9500 },
    reputationReward: 1100,
    eligibility: { allowedTiers: [4, 5] },
    unlockRequirement: { previousEventId: 'apex_sprint_1' },
    targetBenchmark: { gold: 45.0, silver: 49.0, bronze: 56.0 },
    objectives: [
      { id: 'beat_gold', description: 'Beat Gold Target Time (< 45.0s)', bonusCredits: 12000 },
    ],
  },
  {
    id: 'apex_drift_3',
    tier: 5,
    orderInTier: 3,
    name: 'Ultimate Drift Colosseum',
    subtitle: 'Forest Valley Circuit • 90s Arena Final',
    circuitId: 'forest_valley',
    mode: 'drift',
    opponentsCount: 0,
    aiDifficulty: 'apex_elite',
    description: 'The grand finale of Project Apex career mode. Score 30,000+ points to become an immortal drift icon.',
    rewards: { gold: 50000, silver: 35000, bronze: 23000, completion: 11500 },
    reputationReward: 1300,
    eligibility: { allowedTiers: [4, 5] },
    unlockRequirement: { previousEventId: 'apex_time_trial_2' },
    targetBenchmark: { gold: 30000, silver: 20000, bronze: 14000 },
    objectives: [
      { id: 'target_score', description: 'Bank 30,000+ Drift Points', bonusCredits: 15000 },
      { id: 'multiplier', description: 'Achieve a x2.5+ Combo Multiplier', bonusCredits: 6000 },
    ],
  },
];

export function getTierInfo(tierNumber: number): CareerTierInfo {
  const found = CAREER_TIERS.find((t) => t.tierNumber === tierNumber);
  return found || CAREER_TIERS[0];
}

export function getEventsByTier(tierNumber: number): CareerEventDefinition[] {
  return CAREER_EVENTS.filter((e) => e.tier === tierNumber);
}

export function getCareerEventById(id: string): CareerEventDefinition | undefined {
  return CAREER_EVENTS.find((e) => e.id === id);
}
