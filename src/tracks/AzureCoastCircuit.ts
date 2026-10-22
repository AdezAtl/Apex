import {
  Scene,
  Vector3,
  Color3,
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
} from '@babylonjs/core';
import { CircuitDefinition } from './TrackConfig';
import { RaceEventConfig } from '../events/EventConfig';

// 58-segment (580m) technical coastal GP circuit
const azureCoastSections = [
  // 1. Start/Finish at (0, 0)
  { file: 'track-finish.glb', position: new Vector3(0, 0, 0), rotationY: 0 },
  // 2-6. Main Straight (0, 10) to (0, 50)
  { file: 'track-straight.glb', position: new Vector3(0, 0, 10), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(0, 0, 20), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(0, 0, 30), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(0, 0, 40), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(0, 0, 50), rotationY: 0 },
  // 7. Turn 1 (Right): Corner at (0, 60) -> turns East (+X)
  { file: 'track-corner.glb', position: new Vector3(0, 0, 60), rotationY: Math.PI / 2 },
  // 8-11. East Chicane Straight (10, 60) to (40, 60)
  { file: 'track-straight.glb', position: new Vector3(10, 0, 60), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(20, 0, 60), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(30, 0, 60), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(40, 0, 60), rotationY: Math.PI / 2 },
  // 12. Turn 2 (Left): Corner at (50, 60) -> turns North (+Z)
  { file: 'track-corner.glb', position: new Vector3(50, 0, 60), rotationY: Math.PI },
  // 13-15. North Rise Straight (50, 70) to (50, 90)
  { file: 'track-straight.glb', position: new Vector3(50, 0, 70), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(50, 0, 80), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(50, 0, 90), rotationY: 0 },
  // 16. Turn 3 (Right): Corner at (50, 100) -> turns East (+X)
  { file: 'track-corner.glb', position: new Vector3(50, 0, 100), rotationY: Math.PI / 2 },
  // 17-21. Cliffside Straight (60, 100) to (100, 100)
  { file: 'track-straight.glb', position: new Vector3(60, 0, 100), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(70, 0, 100), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(80, 0, 100), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(90, 0, 100), rotationY: Math.PI / 2 },
  { file: 'track-straight.glb', position: new Vector3(100, 0, 100), rotationY: Math.PI / 2 },
  // 22. Turn 4 (Right): Hairpin Entry at (110, 100) -> turns South (-Z)
  { file: 'track-corner.glb', position: new Vector3(110, 0, 100), rotationY: Math.PI },
  // 23-28. Coastal Hairpin Straight (110, 90) to (110, 40)
  { file: 'track-straight.glb', position: new Vector3(110, 0, 90), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(110, 0, 80), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(110, 0, 70), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(110, 0, 60), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(110, 0, 50), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(110, 0, 40), rotationY: Math.PI },
  // 29. Turn 5 (Right): Corner at (110, 30) -> turns West (-X)
  { file: 'track-corner.glb', position: new Vector3(110, 0, 30), rotationY: (3 * Math.PI) / 2 },
  // 30-32. Mid Infield Return (100, 30) to (80, 30)
  { file: 'track-straight.glb', position: new Vector3(100, 0, 30), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(90, 0, 30), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(80, 0, 30), rotationY: (3 * Math.PI) / 2 },
  // 33. Turn 6 (Left): Corner at (70, 30) -> turns South (-Z)
  { file: 'track-corner.glb', position: new Vector3(70, 0, 30), rotationY: Math.PI / 2 },
  // 34-37. Infield Chute (70, 20) to (70, -10)
  { file: 'track-straight.glb', position: new Vector3(70, 0, 20), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(70, 0, 10), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(70, 0, 0), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(70, 0, -10), rotationY: Math.PI },
  // 38. Turn 7 (Right): Corner at (70, -20) -> turns West (-X)
  { file: 'track-corner.glb', position: new Vector3(70, 0, -20), rotationY: (3 * Math.PI) / 2 },
  // 39-42. Harbor Sweeper (60, -20) to (30, -20)
  { file: 'track-straight.glb', position: new Vector3(60, 0, -20), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(50, 0, -20), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(40, 0, -20), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(30, 0, -20), rotationY: (3 * Math.PI) / 2 },
  // 43. Turn 8 (Left): Corner at (20, -20) -> turns South (-Z)
  { file: 'track-corner.glb', position: new Vector3(20, 0, -20), rotationY: Math.PI / 2 },
  // 44-46. Marina Drop (20, -30) to (20, -50)
  { file: 'track-straight.glb', position: new Vector3(20, 0, -30), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(20, 0, -40), rotationY: Math.PI },
  { file: 'track-straight.glb', position: new Vector3(20, 0, -50), rotationY: Math.PI },
  // 47. Turn 9 (Right): South Promenade Turn at (20, -60) -> turns West (-X)
  { file: 'track-corner.glb', position: new Vector3(20, 0, -60), rotationY: (3 * Math.PI) / 2 },
  // 48-50. South Promenade (10, -60) to (-10, -60)
  { file: 'track-straight.glb', position: new Vector3(10, 0, -60), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(0, 0, -60), rotationY: (3 * Math.PI) / 2 },
  { file: 'track-straight.glb', position: new Vector3(-10, 0, -60), rotationY: (3 * Math.PI) / 2 },
  // 51. Turn 10 (Right): Corner at (-20, -60) -> turns North (+Z)
  { file: 'track-corner.glb', position: new Vector3(-20, 0, -60), rotationY: 0 },
  // 52-54. West Boulevard ( -20, -50) to (-20, -30)
  { file: 'track-straight.glb', position: new Vector3(-20, 0, -50), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(-20, 0, -40), rotationY: 0 },
  { file: 'track-straight.glb', position: new Vector3(-20, 0, -30), rotationY: 0 },
  // 55. Turn 11 (Right): Corner at (-20, -20) -> turns East (+X)
  { file: 'track-corner.glb', position: new Vector3(-20, 0, -20), rotationY: Math.PI / 2 },
  // 56. Final Chute (-10, -20)
  { file: 'track-straight.glb', position: new Vector3(-10, 0, -20), rotationY: Math.PI / 2 },
  // 57. Turn 12 (Left): Corner at (0, -20) -> turns North (+Z) into S/F Straight
  { file: 'track-corner.glb', position: new Vector3(0, 0, -20), rotationY: Math.PI },
  // 58. Final Straight (0, -10) -> leads back to (0, 0)
  { file: 'track-straight.glb', position: new Vector3(0, 0, -10), rotationY: 0 },
];

// Continuous 12 centerline segments summing to exactly 580.0m
const azureCoastCenterline = [
  { id: 0, name: 'Main S/F Straight', start: new Vector3(0, 0.05, -20), end: new Vector3(0, 0.05, 60) }, // 80m
  { id: 1, name: 'Turn 1 East Chicane', start: new Vector3(0, 0.05, 60), end: new Vector3(50, 0.05, 60) }, // 50m
  { id: 2, name: 'Turn 2 North Rise', start: new Vector3(50, 0.05, 60), end: new Vector3(50, 0.05, 100) }, // 40m
  { id: 3, name: 'Turn 3 Cliffside Straight', start: new Vector3(50, 0.05, 100), end: new Vector3(110, 0.05, 100) }, // 60m
  { id: 4, name: 'Turn 4 Coastal Hairpin', start: new Vector3(110, 0.05, 100), end: new Vector3(110, 0.05, 30) }, // 70m
  { id: 5, name: 'Turn 5 Mid Infield Return', start: new Vector3(110, 0.05, 30), end: new Vector3(70, 0.05, 30) }, // 40m
  { id: 6, name: 'Turn 6 Infield Chute', start: new Vector3(70, 0.05, 30), end: new Vector3(70, 0.05, -20) }, // 50m
  { id: 7, name: 'Turn 7 Harbor Sweeper', start: new Vector3(70, 0.05, -20), end: new Vector3(20, 0.05, -20) }, // 50m
  { id: 8, name: 'Turn 8 Marina Drop', start: new Vector3(20, 0.05, -20), end: new Vector3(20, 0.05, -60) }, // 40m
  { id: 9, name: 'Turn 9 South Promenade', start: new Vector3(20, 0.05, -60), end: new Vector3(-20, 0.05, -60) }, // 40m
  { id: 10, name: 'Turn 10 West Boulevard', start: new Vector3(-20, 0.05, -60), end: new Vector3(-20, 0.05, -20) }, // 40m
  { id: 11, name: 'Turn 11 Pit Hairpin Entry', start: new Vector3(-20, 0.05, -20), end: new Vector3(0, 0.05, -20) }, // 20m
];

const azureCoastCheckpoints = [
  { id: 'AZ_CP_0_START_FINISH', order: 0, position: new Vector3(0, 0.05, 0), direction: new Vector3(0, 0, 1), width: 8.0 },
  { id: 'AZ_CP_1_NORTH_APPROACH', order: 1, position: new Vector3(0, 0.05, 50), direction: new Vector3(0, 0, 1), width: 8.0 },
  { id: 'AZ_CP_2_CHICANE_EXIT', order: 2, position: new Vector3(50, 0.05, 80), direction: new Vector3(0, 0, 1), width: 8.0 },
  { id: 'AZ_CP_3_CLIFF_STRAIGHT', order: 3, position: new Vector3(90, 0.05, 100), direction: new Vector3(1, 0, 0), width: 8.0 },
  { id: 'AZ_CP_4_COASTAL_HAIRPIN', order: 4, position: new Vector3(110, 0.05, 50), direction: new Vector3(0, 0, -1), width: 8.0 },
  { id: 'AZ_CP_5_INFIELD_CHUTE', order: 5, position: new Vector3(70, 0.05, 0), direction: new Vector3(0, 0, -1), width: 8.0 },
  { id: 'AZ_CP_6_MARINA_DROP', order: 6, position: new Vector3(20, 0.05, -40), direction: new Vector3(0, 0, -1), width: 8.0 },
  { id: 'AZ_CP_7_WEST_BOULEVARD', order: 7, position: new Vector3(-20, 0.05, -40), direction: new Vector3(0, 0, 1), width: 8.0 },
];

const azureCoastEvents: RaceEventConfig[] = [
  {
    id: 'azure_loop_580m',
    mode: 'time_trial',
    name: 'Azure Coast Time Trial',
    subtitle: 'Azure Coast GP • 580m Seaside Circuit',
    badgeText: 'TIME ATTACK',
    lapsBadge: '1 LAP BENCHMARK',
    description:
      'Master the scenic 580-meter coastal Grand Prix circuit with 8 precision timing gates. Features high-speed cliffside sweepers, technical chicanes, and the iconic coastal hairpin.',
    specs: {
      length: '580 M',
      sectors: '8 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(1.8, 0.05, -10.0),
    startYaw: 0,
    checkpointIds: [
      'AZ_CP_1_NORTH_APPROACH',
      'AZ_CP_2_CHICANE_EXIT',
      'AZ_CP_3_CLIFF_STRAIGHT',
      'AZ_CP_4_COASTAL_HAIRPIN',
      'AZ_CP_5_INFIELD_CHUTE',
      'AZ_CP_6_MARINA_DROP',
      'AZ_CP_7_WEST_BOULEVARD',
      'AZ_CP_0_START_FINISH',
    ],
    finishCheckpointId: 'AZ_CP_0_START_FINISH',
    mapType: 'loop',
  },
  {
    id: 'azure_sprint_270m',
    mode: 'sprint',
    name: 'Coastal Hairpin Sprint',
    subtitle: 'Sector 1-4 Point-to-Point Sprint • 270m',
    badgeText: 'SPRINT RACE',
    lapsBadge: 'POINT TO POINT',
    description:
      'Fast-paced 270-meter point-to-point sprint from the start line through the north chicane and cliffside straight, braking hard into the coastal hairpin finish.',
    specs: {
      length: '270 M',
      sectors: '4 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(1.8, 0.05, -10.0),
    startYaw: 0,
    checkpointIds: [
      'AZ_CP_1_NORTH_APPROACH',
      'AZ_CP_2_CHICANE_EXIT',
      'AZ_CP_3_CLIFF_STRAIGHT',
      'AZ_CP_4_COASTAL_HAIRPIN',
    ],
    finishCheckpointId: 'AZ_CP_4_COASTAL_HAIRPIN',
    mapType: 'sprint',
  },
  {
    id: 'azure_drift_90s',
    mode: 'drift',
    name: 'Azure Drift Arena',
    subtitle: 'Azure Coast GP • 90s Seaside Freestyle',
    badgeText: 'DRIFT CHALLENGE',
    lapsBadge: '90S TIMED FREESTYLE',
    description:
      'Score high drift combos across the 580-meter coastal course. Maintain sustained slip angles through the chicane, coastal hairpin, and southern promenade sweepers.',
    specs: {
      length: '580 M',
      sectors: 'OPEN ARENA',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(0, 0.05, -2.0),
    startYaw: 0,
    checkpointIds: [
      'AZ_CP_1_NORTH_APPROACH',
      'AZ_CP_2_CHICANE_EXIT',
      'AZ_CP_3_CLIFF_STRAIGHT',
      'AZ_CP_4_COASTAL_HAIRPIN',
      'AZ_CP_5_INFIELD_CHUTE',
      'AZ_CP_6_MARINA_DROP',
      'AZ_CP_7_WEST_BOULEVARD',
      'AZ_CP_0_START_FINISH',
    ],
    finishCheckpointId: '',
    mapType: 'drift',
  },
];

export const AzureCoastCircuit: CircuitDefinition = {
  id: 'azure_coast',
  name: 'Azure Coast GP',
  subtitle: 'Mediterranean Coast • 580m Technical Circuit',
  measuredLengthMeters: 580.0,
  tileCount: 58,
  description:
    'A picturesque 580-meter Mediterranean coastal circuit bathed in warm golden hour light. Features a brisk 80m main straight, chicane elevation changes, a coastal hairpin, and seaside promenade sweepers.',
  surface: 'ASPHALT',
  roadSurfaceY: 0.05,
  startPosition: new Vector3(1.8, 0.05, -10.0),
  startYaw: 0,
  aiGridSlots: [
    { gridSlot: 1, position: new Vector3(-1.8, 0.05, 14.0), yaw: 0 },
    { gridSlot: 2, position: new Vector3(1.8, 0.05, 6.0), yaw: 0 },
    { gridSlot: 3, position: new Vector3(-1.8, 0.05, -2.0), yaw: 0 },
  ],
  sections: azureCoastSections,
  centerlineSegments: azureCoastCenterline,
  checkpoints: azureCoastCheckpoints,
  boundaries: {
    minX: -45,
    maxX: 135,
    minZ: -85,
    maxZ: 125,
    minY: -1.5,
  },
  environment: {
    clearColor: new Color3(0.18, 0.12, 0.22),
    ambientColor: new Color3(0.24, 0.18, 0.16),
    sunDirection: new Vector3(-0.8, -0.6, -0.6),
    sunDiffuse: new Color3(1.0, 0.78, 0.52),
    sunSpecular: new Color3(0.9, 0.8, 0.6),
    groundColor: new Color3(0.26, 0.22, 0.18),
  },
  events: azureCoastEvents,
  minimap: {
    svgViewBox: '-45 -125 180 210',
    fullCircuitSvgPath:
      'M 0,0 L 0,-60 L 50,-60 L 50,-100 L 110,-100 L 110,-30 L 70,-30 L 70,20 L 20,20 L 20,60 L -20,60 L -20,20 L 0,20 Z',
    sprintSvgPath:
      'M 0,0 L 0,-60 L 50,-60 L 50,-100 L 110,-100 L 110,-50',
    sprintStart: { x: 0, y: 0 },
    sprintFinish: { x: 110, y: -50 },
    startFinishMarker: { x: 0, y: 0, labelPos: { x: -8, y: 3 } },
    driftZones: [
      { path: 'M 0,-40 L 0,-60 L 50,-60 L 50,-80', label: 'CHICANE DRIFT', labelPos: { x: 25, y: -68 } },
      { path: 'M 90,-100 L 110,-100 L 110,-50', label: 'HAIRPIN DRIFT', labelPos: { x: 112, y: -75 } },
      { path: 'M 50,20 L 20,20 L 20,60 L -10,60', label: 'MARINA SWEEPER', labelPos: { x: 5, y: 45 } },
    ],
    gateMarkers: [
      { x: 0, y: -50 },
      { x: 50, y: -80 },
      { x: 90, y: -100 },
      { x: 110, y: -50 },
      { x: 70, y: 0 },
      { x: 20, y: 40 },
      { x: -20, y: 40 },
    ],
  },

  buildRoadMarkings: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const whiteMat = new StandardMaterial('AZ_RoadMarkingWhiteMat', scene);
    whiteMat.diffuseColor = new Color3(0.95, 0.94, 0.90);
    whiteMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const lineThickness = 0.14;
    const yMarking = yOffset + 0.002;

    const createMarkingStrip = (name: string, pos: Vector3, width: number, depth: number) => {
      const plane = MeshBuilder.CreatePlane(name, { width, height: depth }, scene);
      plane.rotation.x = Math.PI / 2;
      plane.position.copyFrom(pos);
      plane.material = whiteMat;
      plane.parent = parent;
      plane.isPickable = false;
      return plane;
    };

    const addZBoundaries = (name: string, centerX: number, zMin: number, zMax: number) => {
      const depth = zMax - zMin;
      const centerZ = (zMin + zMax) / 2;
      createMarkingStrip(`${name}_L`, new Vector3(centerX - 3.75, yMarking, centerZ), lineThickness, depth);
      createMarkingStrip(`${name}_R`, new Vector3(centerX + 3.75, yMarking, centerZ), lineThickness, depth);
    };

    const addXBoundaries = (name: string, centerZ: number, xMin: number, xMax: number) => {
      const width = xMax - xMin;
      const centerX = (xMin + xMax) / 2;
      createMarkingStrip(`${name}_T`, new Vector3(centerX, yMarking, centerZ + 3.75), width, lineThickness);
      createMarkingStrip(`${name}_B`, new Vector3(centerX, yMarking, centerZ - 3.75), width, lineThickness);
    };

    // Main straight
    addZBoundaries('AZ_MainStraight', 0, -20, 55);
    // East chicane
    addXBoundaries('AZ_Chicane', 60, 5, 45);
    // North rise
    addZBoundaries('AZ_NorthRise', 50, 65, 95);
    // Cliffside straight
    addXBoundaries('AZ_CliffStraight', 100, 55, 105);
    // Coastal hairpin straight
    addZBoundaries('AZ_HairpinStraight', 110, 35, 95);
    // Mid infield return
    addXBoundaries('AZ_MidInfield', 30, 75, 105);
    // Infield chute
    addZBoundaries('AZ_InfieldChute', 70, -15, 25);
    // Harbor sweeper
    addXBoundaries('AZ_HarborSweeper', -20, 25, 65);
    // Marina drop
    addZBoundaries('AZ_MarinaDrop', 20, -55, -25);
    // South promenade
    addXBoundaries('AZ_SouthPromenade', -60, -15, 15);
    // West boulevard
    addZBoundaries('AZ_WestBoulevard', -20, -55, -25);
    // Final link
    addXBoundaries('AZ_FinalLink', -20, -15, -5);

    // Starting grid slots
    const gridMat = new StandardMaterial('AZ_GridWhiteMat', scene);
    gridMat.diffuseColor = new Color3(0.96, 0.94, 0.88);
    const gridZ = [14.0, 6.0, -2.0, -10.0];
    const gridX = [-1.8, 1.8, -1.8, 1.8];
    for (let g = 0; g < 4; g++) {
      const box = MeshBuilder.CreatePlane(`AZ_GridBox_${g}`, { width: 2.2, height: 4.0 }, scene);
      box.rotation.x = Math.PI / 2;
      box.position.set(gridX[g], yMarking, gridZ[g]);
      box.material = gridMat;
      box.parent = parent;
      box.isPickable = false;
    }
  },

  buildRoadVerges: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const vergeMat = new StandardMaterial('AZ_VergeMat', scene);
    vergeMat.diffuseColor = new Color3(0.32, 0.28, 0.22); // Coastal sandy gravel
    vergeMat.specularColor = new Color3(0.02, 0.02, 0.02);
    const yVerge = yOffset - 0.005;

    const makeVerge = (name: string, pos: Vector3, width: number, depth: number) => {
      const plane = MeshBuilder.CreatePlane(name, { width, height: depth }, scene);
      plane.rotation.x = Math.PI / 2;
      plane.position.copyFrom(pos);
      plane.material = vergeMat;
      plane.parent = parent;
      plane.isPickable = false;
    };

    makeVerge('AZ_Verge_Main_L', new Vector3(-5.75, yVerge, 20), 3.5, 80);
    makeVerge('AZ_Verge_Main_R', new Vector3(5.75, yVerge, 20), 3.5, 80);
    makeVerge('AZ_Verge_Cliff_T', new Vector3(80, yVerge, 105.75), 60, 3.5);
    makeVerge('AZ_Verge_Cliff_B', new Vector3(80, yVerge, 94.25), 60, 3.5);
    makeVerge('AZ_Verge_Hairpin_L', new Vector3(104.25, yVerge, 65), 3.5, 70);
    makeVerge('AZ_Verge_Hairpin_R', new Vector3(115.75, yVerge, 65), 3.5, 70);
    makeVerge('AZ_Verge_South_T', new Vector3(0, yVerge, -54.25), 40, 3.5);
    makeVerge('AZ_Verge_South_B', new Vector3(0, yVerge, -65.75), 40, 3.5);
  },

  buildRoadsideInfrastructure: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const boardMat = new StandardMaterial('AZ_BrakeBoardMat', scene);
    boardMat.diffuseColor = new Color3(0.92, 0.88, 0.80);
    const postMat = new StandardMaterial('AZ_PostMat', scene);
    postMat.diffuseColor = new Color3(0.25, 0.22, 0.20);

    const makeBrakeBoard = (name: string, pos: Vector3, rotY: number) => {
      const post = MeshBuilder.CreateCylinder(`${name}_post`, { height: 1.4, diameter: 0.08 }, scene);
      post.position.set(pos.x, yOffset + 0.7, pos.z);
      post.material = postMat;
      post.parent = parent;
      post.isPickable = false;

      const board = MeshBuilder.CreateBox(`${name}_panel`, { width: 0.9, height: 0.6, depth: 0.06 }, scene);
      board.position.set(pos.x, yOffset + 1.2, pos.z);
      board.rotation.y = rotY;
      board.material = boardMat;
      board.parent = parent;
      board.isPickable = false;
    };

    // Braking boards along Main Straight approaching Turn 1
    makeBrakeBoard('AZ_BB_Main_100', new Vector3(4.8, 0, 30), 0);
    makeBrakeBoard('AZ_BB_Main_50', new Vector3(4.8, 0, 48), 0);

    // Braking boards approaching Coastal Hairpin
    makeBrakeBoard('AZ_BB_Cliff_100', new Vector3(85, 0, 104.8), Math.PI / 2);
    makeBrakeBoard('AZ_BB_Cliff_50', new Vector3(100, 0, 104.8), Math.PI / 2);

    // Braking boards approaching Turn 8 Marina Drop
    makeBrakeBoard('AZ_BB_Harbor_50', new Vector3(35, 0, -24.8), Math.PI / 2);
  },

  buildScenery: async (scene: Scene, parent: TransformNode) => {
    const sceneryRoot = new TransformNode('AzureSceneryContainer', scene);
    sceneryRoot.parent = parent;

    const coastMat = new StandardMaterial('AZ_CoastalVegetationMat', scene);
    coastMat.diffuseColor = new Color3(1, 1, 1);
    coastMat.specularColor = new Color3(0.04, 0.04, 0.03);

    const createColoredPart = (mesh: Mesh, col: Color3): Mesh => {
      const count = mesh.getTotalVertices();
      const colors = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        colors[i * 4 + 0] = col.r;
        colors[i * 4 + 1] = col.g;
        colors[i * 4 + 2] = col.b;
        colors[i * 4 + 3] = 1.0;
      }
      mesh.setVerticesData('color', colors);
      return mesh;
    };

    // Mediterranean Cypress (Slender, tall column)
    const trunkC = createColoredPart(
      MeshBuilder.CreateCylinder('TrunkC', { height: 1.2, diameterTop: 0.3, diameterBottom: 0.45, tessellation: 6 }, scene),
      new Color3(0.32, 0.24, 0.18)
    );
    trunkC.position.y = 0.6;
    const bodyC1 = createColoredPart(
      MeshBuilder.CreateCylinder('ConeC1', { height: 2.8, diameterTop: 0.8, diameterBottom: 1.5, tessellation: 6 }, scene),
      new Color3(0.12, 0.22, 0.14)
    );
    bodyC1.position.y = 2.0;
    const bodyC2 = createColoredPart(
      MeshBuilder.CreateCylinder('ConeC2', { height: 2.2, diameterTop: 0.1, diameterBottom: 1.0, tessellation: 6 }, scene),
      new Color3(0.16, 0.28, 0.18)
    );
    bodyC2.position.y = 3.6;
    const masterCypress = Mesh.MergeMeshes([trunkC, bodyC1, bodyC2], true, true, undefined, false, true)!;
    masterCypress.material = coastMat;
    masterCypress.useVertexColors = true;
    masterCypress.isVisible = false;
    masterCypress.isPickable = false;

    // Coastal Fan Palm
    const trunkP = createColoredPart(
      MeshBuilder.CreateCylinder('TrunkP', { height: 4.5, diameterTop: 0.25, diameterBottom: 0.45, tessellation: 6 }, scene),
      new Color3(0.38, 0.30, 0.22)
    );
    trunkP.position.y = 2.25;
    const fronds = createColoredPart(
      MeshBuilder.CreateSphere('Fronds', { diameterX: 3.8, diameterY: 0.8, diameterZ: 3.8, segments: 4 }, scene),
      new Color3(0.24, 0.38, 0.15)
    );
    fronds.position.y = 4.4;
    const masterPalm = Mesh.MergeMeshes([trunkP, fronds], true, true, undefined, false, true)!;
    masterPalm.material = coastMat;
    masterPalm.useVertexColors = true;
    masterPalm.isVisible = false;
    masterPalm.isPickable = false;

    // Coastal Sea Rock Boulder (Warm sandstone)
    const masterCoastalRock = createColoredPart(
      MeshBuilder.CreateSphere('CoastRock', { diameterX: 2.2, diameterY: 1.4, diameterZ: 1.8, segments: 3 }, scene),
      new Color3(0.48, 0.40, 0.32)
    );
    masterCoastalRock.position.y = 0.7;
    masterCoastalRock.bakeCurrentTransformIntoVertices();
    masterCoastalRock.material = coastMat;
    masterCoastalRock.useVertexColors = true;
    masterCoastalRock.isVisible = false;
    masterCoastalRock.isPickable = false;

    let seed = 77;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const spawn = (master: Mesh, locations: Vector3[], prefix: string, sMin: number, sMax: number) => {
      for (let i = 0; i < locations.length; i++) {
        const inst = master.createInstance(`${prefix}_${i}`);
        inst.parent = sceneryRoot;
        inst.position.copyFrom(locations[i]);
        inst.rotation.y = pseudoRandom() * Math.PI * 2;
        const s = sMin + pseudoRandom() * (sMax - sMin);
        inst.scaling.set(s, s * (0.95 + pseudoRandom() * 0.2), s);
        inst.isPickable = false;
      }
    };

    // Mediterranean Cypresses lining boulevard & inland
    const cypresses: Vector3[] = [
      new Vector3(-15, 0, 20), new Vector3(-15, 0, 45), new Vector3(-18, 0, -10),
      new Vector3(15, 0, 80), new Vector3(30, 0, 85), new Vector3(70, 0, 75),
      new Vector3(90, 0, 50), new Vector3(95, 0, 0), new Vector3(50, 0, 5),
      new Vector3(45, 0, -40), new Vector3(0, 0, -40), new Vector3(-35, 0, -45),
      new Vector3(-35, 0, -15), new Vector3(-35, 0, 25), new Vector3(125, 0, 60),
      new Vector3(125, 0, 20), new Vector3(125, 0, -10), new Vector3(90, 0, -45)
    ];
    spawn(masterCypress, cypresses, 'AZ_Cypress', 0.85, 1.4);

    // Coastal Palms along marina and waterfront
    const palms: Vector3[] = [
      new Vector3(-10, 0, 75), new Vector3(25, 0, 45), new Vector3(65, 0, 115),
      new Vector3(85, 0, 115), new Vector3(105, 0, 115), new Vector3(125, 0, 95),
      new Vector3(125, 0, 75), new Vector3(90, 0, 15), new Vector3(55, 0, -35),
      new Vector3(35, 0, -65), new Vector3(15, 0, -75), new Vector3(-5, 0, -75),
      new Vector3(-25, 0, -75), new Vector3(-35, 0, -35)
    ];
    spawn(masterPalm, palms, 'AZ_Palm', 0.8, 1.35);

    // Sea boulders along cliffside (North-East edge) and perimeter
    const coastalRocks: Vector3[] = [
      new Vector3(55, 0, 118), new Vector3(75, 0, 120), new Vector3(95, 0, 122),
      new Vector3(115, 0, 118), new Vector3(128, 0, 105), new Vector3(128, 0, 45),
      new Vector3(125, 0, -25), new Vector3(60, 0, -35), new Vector3(5, 0, -78),
      new Vector3(-30, 0, -75), new Vector3(-35, 0, 60), new Vector3(35, 0, 15)
    ];
    spawn(masterCoastalRock, coastalRocks, 'AZ_CoastRock', 0.9, 1.8);
  },
};
