import { Vector3 } from '@babylonjs/core';

export type RaceMode = 'time_trial' | 'sprint' | 'drift';

export interface EventSpecs {
  length: string;
  sectors: string;
  surface: string;
}

export interface RaceEventConfig {
  id: string;
  mode: RaceMode;
  name: string;
  subtitle: string;
  badgeText: string;
  lapsBadge: string;
  description: string;
  specs: EventSpecs;
  startPosition: Vector3;
  startYaw: number;
  checkpointIds: string[];
  finishCheckpointId: string;
  mapType: 'loop' | 'sprint' | 'drift';
}

export const RACE_EVENTS: RaceEventConfig[] = [
  {
    id: 'forest_loop_220m',
    mode: 'time_trial',
    name: 'Apex Circuit Time Trial',
    subtitle: 'Forest Valley Circuit • 980m Grand Course',
    badgeText: 'TIME ATTACK',
    lapsBadge: '1 LAP BENCHMARK',
    description:
      'Complete a timed lap around the expanded 980-meter paved circuit with 10 sequential timing gates. High-speed straights, technical chicanes, and demanding sweepers test precision and momentum.',
    specs: {
      length: '980 M',
      sectors: '10 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(1.8, 0.05, -10.0),
    startYaw: 0,
    checkpointIds: [
      'CP_1_NORTH_ENTRY',
      'CP_2_EAST_CHUTE',
      'CP_3_INFIELD_DESCENT',
      'CP_4_CAROUSEL_SHOOT',
      'CP_5_BACK_STRAIGHT_LAUNCH',
      'CP_6_BACK_STRAIGHT_BRAKING',
      'CP_7_ARENA_DRIFT_SWEEPER',
      'CP_8_WEST_STRAIGHT_ENTRY',
      'CP_9_WEST_STRAIGHT_MID',
      'CP_0_START_FINISH',
    ],
    finishCheckpointId: 'CP_0_START_FINISH',
    mapType: 'loop',
  },
  {
    id: 'forest_sprint_130m',
    mode: 'sprint',
    name: 'Forest Sector Sprint',
    subtitle: 'Sector 1-4 Point-to-Point Sprint • 340m',
    badgeText: 'SPRINT RACE',
    lapsBadge: 'POINT TO POINT',
    description:
      'High-intensity 340-meter point-to-point sprint from the North main straight through the Eastern sweeper and technical chicane, concluding at the Carousel timing gantry.',
    specs: {
      length: '340 M',
      sectors: '4 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(1.8, 0.05, -10.0),
    startYaw: 0,
    checkpointIds: [
      'CP_1_NORTH_ENTRY',
      'CP_2_EAST_CHUTE',
      'CP_3_INFIELD_DESCENT',
      'CP_4_CAROUSEL_SHOOT',
    ],
    finishCheckpointId: 'CP_4_CAROUSEL_SHOOT',
    mapType: 'sprint',
  },
  {
    id: 'forest_drift_90s',
    mode: 'drift',
    name: 'Forest Drift Challenge',
    subtitle: 'Forest Valley Circuit • 90s Freestyle Arena',
    badgeText: 'DRIFT CHALLENGE',
    lapsBadge: '90S TIMED FREESTYLE',
    description:
      'Score maximum drift points across the complete 980-meter circuit in a 90-second session. Maintain speed and slip angle through the dedicated drift sweepers and chain transitions to grow your combo.',
    specs: {
      length: '980 M',
      sectors: 'OPEN ARENA',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(0, 0.05, -2.0),
    startYaw: 0,
    checkpointIds: [
      'CP_1_NORTH_ENTRY',
      'CP_2_EAST_CHUTE',
      'CP_3_INFIELD_DESCENT',
      'CP_4_CAROUSEL_SHOOT',
      'CP_5_BACK_STRAIGHT_LAUNCH',
      'CP_6_BACK_STRAIGHT_BRAKING',
      'CP_7_ARENA_DRIFT_SWEEPER',
      'CP_8_WEST_STRAIGHT_ENTRY',
      'CP_9_WEST_STRAIGHT_MID',
      'CP_0_START_FINISH',
    ],
    finishCheckpointId: '',
    mapType: 'drift',
  },
];

export const DEFAULT_EVENT: RaceEventConfig = RACE_EVENTS[0];

export function getEventById(id: string): RaceEventConfig {
  const found = RACE_EVENTS.find((e) => e.id === id);
  return found || DEFAULT_EVENT;
}
