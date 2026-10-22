const fs = require('fs');

const circuitData = JSON.parse(fs.readFileSync('ProjectApex/scripts/circuit_samples.json', 'utf8'));
const sceneryData = JSON.parse(fs.readFileSync('ProjectApex/scripts/scenery_positions.json', 'utf8'));

const samples = circuitData.uniformSamples;
const N = samples.length;

// Generate TypeScript code
let out = `import {
  Scene,
  Vector3,
  Color3,
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  SceneLoader,
} from '@babylonjs/core';
import { CircuitDefinition } from './TrackConfig';
import { RaceEventConfig } from '../events/EventConfig';
import { RoadSamplePoint } from '../environment/RoadMeshBuilder';

// 294 discrete road sample points along the 980.0m continuous motorsport circuit (13.0m wide)
const forestValleyRoadSamples: RoadSamplePoint[] = [
`;

for (let i = 0; i < N; i++) {
  const p = samples[i];
  out += `  { position: new Vector3(${p.x.toFixed(2)}, 0.05, ${p.z.toFixed(2)}), tangent: new Vector3(${p.tx.toFixed(3)}, 0, ${p.tz.toFixed(3)}), rightNormal: new Vector3(${p.nx.toFixed(3)}, 0, ${p.nz.toFixed(3)}), distance: ${p.dist.toFixed(2)}, curvatureDeg: ${p.curvatureDeg.toFixed(2)} },\n`;
}

out += `];

// 294 centerline segments for silky-smooth barrier deflection & AI navigation
const forestValleyCenterline = forestValleyRoadSamples.map((s, idx) => {
  const next = forestValleyRoadSamples[(idx + 1) % forestValleyRoadSamples.length];
  return {
    id: idx,
    start: s.position.clone(),
    end: next.position.clone(),
  };
});

// 10 Sequential Timing Gates (14.8m wide gantry spanning the 13.0m wide road)
const forestValleyCheckpoints = [
${circuitData.checkpoints.map(cp => `  { id: '${cp.id}', order: ${cp.order}, position: new Vector3(${cp.position.x.toFixed(2)}, 0.05, ${cp.position.z.toFixed(2)}), direction: new Vector3(${cp.direction.x.toFixed(3)}, 0, ${cp.direction.z.toFixed(3)}), width: ${cp.width.toFixed(1)} },`).join('\n')}
];

const forestValleyEvents: RaceEventConfig[] = [
  {
    id: 'forest_loop_220m',
    mode: 'time_trial',
    name: 'Apex Circuit Time Trial',
    subtitle: 'Forest Valley Circuit • 980m Grand Course',
    badgeText: 'TIME ATTACK',
    lapsBadge: '1 LAP BENCHMARK',
    description:
      'Complete a timed lap around the 980-meter paved circuit with 10 sequential timing gates. High-speed straights, technical chicanes, and demanding sweepers test precision and momentum.',
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
    lapsBadge: '90s FREESTYLE',
    description:
      'A 90-second timed freestyle drift session across the expansive 13-meter asphalt. Initiate continuous high-angle slides through broad sweepers and chicane transitions.',
    specs: {
      length: '980 M',
      sectors: 'DRIFT ARENA',
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

export const ForestValleyCircuit: CircuitDefinition = {
  id: 'forest_valley',
  name: 'Forest Valley Circuit',
  subtitle: 'Grand Motorsport Park • 980m Asphalt Loop',
  measuredLengthMeters: 980.0,
  tileCount: 98,
  description:
    'A premier 980-meter arcade motorsport circuit carved into dense alpine pine hills. Features broad 13-meter asphalt, the 160+ km/h Grand Back Straight, flowing chicane complexes, and the Arena Drift Sweeper.',
  surface: 'ASPHALT',
  roadSurfaceY: 0.05,
  startPosition: new Vector3(1.8, 0.05, -10.0),
  startYaw: 0,
  aiGridSlots: [
    { gridSlot: 1, position: new Vector3(-2.8, 0.05, 14.0), yaw: 0 },
    { gridSlot: 2, position: new Vector3(2.8, 0.05, 6.0), yaw: 0 },
    { gridSlot: 3, position: new Vector3(-2.8, 0.05, -2.0), yaw: 0 },
  ],
  sections: [],
  roadSamples: forestValleyRoadSamples,
  centerlineSegments: forestValleyCenterline,
  checkpoints: forestValleyCheckpoints,
  boundaries: {
    minX: -85,
    maxX: 175,
    minZ: -210,
    maxZ: 180,
    minY: -1.5,
  },
  environment: {
    clearColor: new Color3(0.06, 0.10, 0.16),
    ambientColor: new Color3(0.18, 0.22, 0.28),
    sunDirection: new Vector3(0.6, -1.2, 0.8),
    sunDiffuse: new Color3(1.0, 0.98, 0.95),
    sunSpecular: new Color3(0.8, 0.8, 0.8),
    groundColor: new Color3(0.16, 0.22, 0.14),
  },
  events: forestValleyEvents,
  minimap: {
    svgViewBox: '-65 -160 215 350',
    fullCircuitSvgPath: '${circuitData.fullCircuitSvgPath}',
    sprintSvgPath: '${circuitData.sprintSvgPath}',
    sprintStart: { x: 0, y: 0 },
    sprintFinish: { x: ${circuitData.sprintFinish.x.toFixed(1)}, y: ${circuitData.sprintFinish.y.toFixed(1)} },
    startFinishMarker: { x: 0, y: 0, labelPos: { x: -8, y: 3 } },
    driftZones: [
      { path: 'M 0.0,-45.0 L 25.0,-75.0 L 60.0,-80.0', label: 'DRIFT ZONE 1', labelPos: { x: 30, y: -85 } },
      { path: 'M 65.0,-45.0 L 75.0,-20.0 L 80.0,-5.0', label: 'DRIFT ZONE 2', labelPos: { x: 70, y: -15 } },
      { path: 'M 65.0,95.0 L 25.0,90.0 L -15.0,80.0', label: 'DRIFT ARENA', labelPos: { x: 25, y: 98 } },
    ],
    gateMarkers: [
${circuitData.checkpoints.slice(1).map(cp => `      { x: ${(cp.position.x * 0.55).toFixed(1)}, y: ${(-cp.position.z * 0.55).toFixed(1)} },`).join('\n')}
    ],
  },

  buildRoadMarkings: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const yMarking = yOffset + 0.002;

    // Start/Finish Checkered strip across 13.0m road (X in [-6.5, 6.5], Z = 0)
    const sfTex = new DynamicTexture('FV_SF_Checkered_Tex', { width: 512, height: 64 }, scene, false);
    const sfCtx = sfTex.getContext() as CanvasRenderingContext2D;
    if (sfCtx) {
      sfCtx.fillStyle = '#ffffff';
      sfCtx.fillRect(0, 0, 512, 64);
      sfCtx.fillStyle = '#111111';
      const checkSize = 32;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 16; c++) {
          if ((r + c) % 2 === 0) {
            sfCtx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
          }
        }
      }
      sfTex.update();
    }
    const sfMat = new StandardMaterial('FV_SF_Checkered_Mat', scene);
    sfMat.diffuseTexture = sfTex;
    sfMat.backFaceCulling = false;

    const sfLine = MeshBuilder.CreatePlane('FV_StartFinishStrip', { width: 13.0, height: 1.0 }, scene);
    sfLine.rotation.x = Math.PI / 2;
    sfLine.position.set(0, yMarking, 0);
    sfLine.material = sfMat;
    sfLine.parent = parent;
    sfLine.isPickable = false;

    // Motorsport Starting Grid Boxes (Clean transparent interior with white perimeter)
    const gridTex = new DynamicTexture('FV_GridBox_Tex', { width: 256, height: 512 }, scene, false);
    gridTex.hasAlpha = true;
    const gCtx = gridTex.getContext() as CanvasRenderingContext2D;
    if (gCtx) {
      gCtx.clearRect(0, 0, 256, 512);
      gCtx.strokeStyle = '#ffffff';
      gCtx.lineWidth = 16;
      gCtx.strokeRect(8, 8, 240, 496);
      gridTex.update();
    }
    const gridMat = new StandardMaterial('FV_GridBoxMat', scene);
    gridMat.diffuseTexture = gridTex;
    gridMat.useAlphaFromDiffuseTexture = true;
    gridMat.backFaceCulling = false;

    // Grid starting boxes (Spacious 13m road slots)
    const gridZ = [14.0, 6.0, -2.0, -10.0];
    const gridX = [-2.8, 2.8, -2.8, 2.8];
    for (let g = 0; g < 4; g++) {
      const box = MeshBuilder.CreatePlane(\`FV_GridBox_\${g}\`, { width: 2.4, height: 4.2 }, scene);
      box.rotation.x = Math.PI / 2;
      box.position.set(gridX[g], yMarking, gridZ[g]);
      box.material = gridMat;
      box.parent = parent;
      box.isPickable = false;
    }
  },

  buildRoadVerges: (_scene: Scene, _parent: TransformNode, _yOffset: number) => {
    // Verges are built continuously along the full spline by RoadMeshBuilder.buildVerges
  },

  buildRoadsideInfrastructure: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const boardMat = new StandardMaterial('FV_BrakeBoardMat', scene);
    boardMat.diffuseColor = new Color3(0.9, 0.9, 0.9);
    const postMat = new StandardMaterial('FV_PostMat', scene);
    postMat.diffuseColor = new Color3(0.2, 0.2, 0.2);

    const makeBrakeBoard = (name: string, pos: Vector3, rotY: number) => {
      const post = MeshBuilder.CreateCylinder(\`\${name}_post\`, { height: 1.4, diameter: 0.08 }, scene);
      post.position.set(pos.x, yOffset + 0.7, pos.z);
      post.material = postMat;
      post.parent = parent;
      post.isPickable = false;

      const board = MeshBuilder.CreateBox(\`\${name}_panel\`, { width: 0.9, height: 0.6, depth: 0.06 }, scene);
      board.position.set(pos.x, yOffset + 1.2, pos.z);
      board.rotation.y = rotY;
      board.material = boardMat;
      board.parent = parent;
      board.isPickable = false;
    };

    // 100m, 50m boards approaching Turn 1 on North Straight (placed at 8.5m lateral distance, outside 6.5m road)
    makeBrakeBoard('FV_BB_North_100', new Vector3(8.5, 0, 65), 0);
    makeBrakeBoard('FV_BB_North_50', new Vector3(8.5, 0, 80), 0);

    // 150m, 100m, 50m boards along Grand Back Straight approaching South Sweeper
    makeBrakeBoard('FV_BB_Back_150', new Vector3(154.5, 0, -50), Math.PI);
    makeBrakeBoard('FV_BB_Back_100', new Vector3(154.5, 0, -80), Math.PI);
    makeBrakeBoard('FV_BB_Back_50', new Vector3(154.5, 0, -110), Math.PI);
  },

  buildScenery: async (scene: Scene, parent: TransformNode) => {
    const sceneryRoot = new TransformNode('ForestSceneryContainer', scene);
    sceneryRoot.parent = parent;

    const vegMat = new StandardMaterial('FV_VegetationMat', scene);
    vegMat.diffuseColor = new Color3(1, 1, 1);
    vegMat.specularColor = new Color3(0.02, 0.02, 0.02);

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

    // Spruce
    const trunkS = createColoredPart(
      MeshBuilder.CreateCylinder('TrunkS', { height: 1.8, diameterTop: 0.35, diameterBottom: 0.5, tessellation: 6 }, scene),
      new Color3(0.28, 0.22, 0.16)
    );
    trunkS.position.y = 0.9;
    const c1 = createColoredPart(MeshBuilder.CreateCylinder('Cone1', { height: 2.2, diameterTop: 0.2, diameterBottom: 2.6, tessellation: 6 }, scene), new Color3(0.12, 0.25, 0.10));
    c1.position.y = 2.2;
    const c2 = createColoredPart(MeshBuilder.CreateCylinder('Cone2', { height: 1.8, diameterTop: 0.1, diameterBottom: 2.0, tessellation: 6 }, scene), new Color3(0.15, 0.30, 0.12));
    c2.position.y = 3.3;
    const c3 = createColoredPart(MeshBuilder.CreateCylinder('Cone3', { height: 1.4, diameterTop: 0.0, diameterBottom: 1.4, tessellation: 6 }, scene), new Color3(0.18, 0.35, 0.15));
    c3.position.y = 4.2;
    const masterSpruce = Mesh.MergeMeshes([trunkS, c1, c2, c3], true, true, undefined, false, true)!;
    masterSpruce.material = vegMat;
    masterSpruce.useVertexColors = true;
    masterSpruce.isVisible = false;
    masterSpruce.isPickable = false;

    // Oak
    const trunkO = createColoredPart(MeshBuilder.CreateCylinder('TrunkO', { height: 2.2, diameterTop: 0.42, diameterBottom: 0.58, tessellation: 6 }, scene), new Color3(0.30, 0.24, 0.18));
    trunkO.position.y = 1.1;
    const cr1 = createColoredPart(MeshBuilder.CreateSphere('Cr1', { diameterX: 3.4, diameterY: 2.4, diameterZ: 3.2, segments: 5 }, scene), new Color3(0.18, 0.29, 0.11));
    cr1.position.set(0, 2.9, 0);
    const cr2 = createColoredPart(MeshBuilder.CreateSphere('Cr2', { diameterX: 2.6, diameterY: 2.2, diameterZ: 2.6, segments: 5 }, scene), new Color3(0.24, 0.37, 0.15));
    cr2.position.set(0.3, 3.9, -0.2);
    const masterOak = Mesh.MergeMeshes([trunkO, cr1, cr2], true, true, undefined, false, true)!;
    masterOak.material = vegMat;
    masterOak.useVertexColors = true;
    masterOak.isVisible = false;
    masterOak.isPickable = false;

    // Rock
    const masterRock = createColoredPart(MeshBuilder.CreateSphere('Rock', { diameterX: 1.4, diameterY: 0.9, diameterZ: 1.2, segments: 3 }, scene), new Color3(0.35, 0.37, 0.39));
    masterRock.position.y = 0.45;
    masterRock.bakeCurrentTransformIntoVertices();
    masterRock.material = vegMat;
    masterRock.useVertexColors = true;
    masterRock.isVisible = false;
    masterRock.isPickable = false;

    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const spawn = (master: Mesh, locations: Vector3[], prefix: string, sMin: number, sMax: number) => {
      for (let i = 0; i < locations.length; i++) {
        const inst = master.createInstance(\`\${prefix}_\${i}\`);
        inst.parent = sceneryRoot;
        inst.position.copyFrom(locations[i]);
        inst.rotation.y = pseudoRandom() * Math.PI * 2;
        const s = sMin + pseudoRandom() * (sMax - sMin);
        inst.scaling.set(s, s * (0.95 + pseudoRandom() * 0.25), s);
        inst.isPickable = false;
      }
    };

    const spruces: Vector3[] = [
${sceneryData.spruces.map(p => `      new Vector3(${p.x}, 0, ${p.z}),`).join('\n')}
    ];
    spawn(masterSpruce, spruces, 'FV_Spruce', 0.85, 1.45);

    const oaks: Vector3[] = [
${sceneryData.oaks.map(p => `      new Vector3(${p.x}, 0, ${p.z}),`).join('\n')}
    ];
    spawn(masterOak, oaks, 'FV_Oak', 0.85, 1.35);

    const rocks: Vector3[] = [
${sceneryData.rocks.map(p => `      new Vector3(${p.x}, 0, ${p.z}),`).join('\n')}
    ];
    spawn(masterRock, rocks, 'FV_Rock', 0.8, 1.6);

    try {
      const templateResult = await SceneLoader.ImportMeshAsync('', './assets/tracks/', 'decoration-forest.glb', scene);
      const templateMesh = templateResult.meshes.find(m => m instanceof Mesh && m.name !== '__root__') as Mesh;
      if (templateMesh) {
        templateMesh.isVisible = false;
        templateMesh.isPickable = false;
        const forestClusters: Vector3[] = [
${sceneryData.kenney.map(p => `          new Vector3(${p.x}, 0, ${p.z}),`).join('\n')}
        ];
        for (let i = 0; i < forestClusters.length; i++) {
          const inst = templateMesh.createInstance(\`FV_Kenney_\${i}\`);
          inst.parent = sceneryRoot;
          inst.position.copyFrom(forestClusters[i]);
          inst.rotation.y = pseudoRandom() * Math.PI * 2;
          const s = 0.9 + pseudoRandom() * 0.35;
          inst.scaling.set(s, s * (0.95 + pseudoRandom() * 0.2), s);
          inst.isPickable = false;
        }
      }
    } catch (err) {
      console.warn('Failed to load decoration-forest.glb cluster:', err);
    }
  },
};
`;

fs.writeFileSync('ProjectApex/src/tracks/ForestValleyCircuit.ts', out);
console.log('ForestValleyCircuit.ts written successfully!');
