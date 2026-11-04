import { Vector3 } from '@babylonjs/core';

export type RaceMode = 'time_trial' | 'sprint' | 'drift' | 'elimination' | 'pursuit' | 'speed_trap';

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
    id: 'forest_elimination_30s',
    mode: 'elimination',
    name: 'Forest Elimination Knockout',
    subtitle: 'Forest Valley Circuit • 30s Knockout Rounds',
    badgeText: 'ELIMINATION',
    lapsBadge: '30S KNOCKOUT',
    description:
      'Every 30 seconds, the driver in last place is eliminated from the race. Maintain position and fight forward until only the champion remains.',
    specs: {
      length: '980 M',
      sectors: 'KNOCKOUT ARENA',
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
    finishCheckpointId: '',
    mapType: 'loop',
  },
  {
    id: 'forest_police_pursuit',
    mode: 'pursuit',
    name: 'Highway Police Pursuit',
    subtitle: 'Forest Valley Highway • Interceptor Chase',
    badgeText: 'PURSUIT EVASION',
    lapsBadge: 'OUTRUN PATROL',
    description:
      'An aggressive Fairheaven Interceptor is hot on your tail. Use drafting, nitro boost, and tight apex lines to break radar lock and escape before you get boxed in!',
    specs: {
      length: '980 M',
      sectors: 'PATROL ZONE',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(0, 0.05, -10.0),
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
    id: 'forest_speed_trap_radar',
    mode: 'speed_trap',
    name: 'Apex Speed Trap Challenge',
    subtitle: 'Forest Valley Circuit • 3 Radar Gates',
    badgeText: 'RADAR CHALLENGE',
    lapsBadge: 'MAX VELOCITY',
    description:
      'Hit maximum velocity through 3 designated radar speed traps placed across high-speed straights. Aggregate peak velocity decides the podium.',
    specs: {
      length: '980 M',
      sectors: '3 RADAR TRAPS',
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
];

export const DEFAULT_EVENT: RaceEventConfig = RACE_EVENTS[0];

export function getEventById(id: string): RaceEventConfig {
  const found = RACE_EVENTS.find((e) => e.id === id);
  return found || DEFAULT_EVENT;
}
