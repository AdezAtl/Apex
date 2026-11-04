const fs = require('fs');
const path = require('path');

console.log('=== BUILDING OSM CIRCUITS: AKOBO HIGHWAY & ELEYELE RING ===');

const userGeoJsonPath = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/d7d4953d-cff7-4e7c-9606-82ddfbdd214a/scratch/user_raw_geojson.txt');
const content = fs.readFileSync(userGeoJsonPath, 'utf8');

// Parse JSON blocks
const jsonMatches = [];
let depth = 0, start = -1;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') {
    if (depth === 0) start = i;
    depth++;
  } else if (content[i] === '}') {
    depth--;
    if (depth === 0 && start !== -1) {
      try {
        jsonMatches.push(JSON.parse(content.substring(start, i + 1)));
      } catch (e) {}
      start = -1;
    }
  }
}

// Catmull-Rom spline
function getT(t, p0, p1, alpha = 0.5) {
  const d = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  return t + Math.pow(Math.max(d, 1e-4), alpha);
}

function centripetalCatmullRom(p0, p1, p2, p3, steps) {
  const t0 = 0;
  const t1 = getT(t0, p0, p1);
  const t2 = getT(t1, p1, p2);
  const t3 = getT(t2, p2, p3);

  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = t1 + (i / steps) * (t2 - t1);

    const a1_x = ((t1 - t) / (t1 - t0)) * p0.x + ((t - t0) / (t1 - t0)) * p1.x;
    const a1_z = ((t1 - t) / (t1 - t0)) * p0.z + ((t - t0) / (t1 - t0)) * p1.z;
    const a2_x = ((t2 - t) / (t2 - t1)) * p1.x + ((t - t1) / (t2 - t1)) * p2.x;
    const a2_z = ((t2 - t) / (t2 - t1)) * p1.z + ((t - t1) / (t2 - t1)) * p2.z;
    const a3_x = ((t3 - t) / (t3 - t2)) * p2.x + ((t - t2) / (t3 - t2)) * p3.x;
    const a3_z = ((t3 - t) / (t3 - t2)) * p2.z + ((t - t2) / (t3 - t2)) * p3.z;

    const b1_x = ((t2 - t) / (t2 - t0)) * a1_x + ((t - t0) / (t2 - t0)) * a2_x;
    const b1_z = ((t2 - t) / (t2 - t0)) * a1_z + ((t - t0) / (t2 - t0)) * a2_z;
    const b2_x = ((t3 - t) / (t3 - t1)) * a2_x + ((t - t1) / (t3 - t1)) * a3_x;
    const b2_z = ((t3 - t) / (t3 - t1)) * a2_z + ((t - t1) / (t3 - t1)) * a3_z;

    const c_x = ((t2 - t) / (t2 - t1)) * b1_x + ((t - t1) / (t2 - t1)) * b2_x;
    const c_z = ((t2 - t) / (t2 - t1)) * b1_z + ((t - t1) / (t2 - t1)) * b2_z;

    pts.push({ x: c_x, z: c_z });
  }
  return pts;
}

function sampleSplineClosed(controlPoints, stepsPerSegment = 24) {
  const n = controlPoints.length;
  const rawSpline = [];
  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];
    const seg = centripetalCatmullRom(p0, p1, p2, p3, stepsPerSegment);
    rawSpline.push(...seg);
  }
  return rawSpline;
}

function resampleEquidistant(points, targetSpacing, widthConfig) {
  const cumDists = [0];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
    cumDists.push(cumDists[cumDists.length - 1] + d);
  }
  const dClose = Math.hypot(points[0].x - points[points.length - 1].x, points[0].z - points[points.length - 1].z);
  cumDists.push(cumDists[cumDists.length - 1] + dClose);
  points.push({ ...points[0] });

  const totalLength = cumDists[cumDists.length - 1];
  const count = Math.round(totalLength / targetSpacing);
  const actualSpacing = totalLength / count;

  const resampled = [];
  let curOrigIdx = 0;

  for (let i = 0; i < count; i++) {
    const targetDist = i * actualSpacing;
    while (curOrigIdx < cumDists.length - 1 && cumDists[curOrigIdx + 1] < targetDist) {
      curOrigIdx++;
    }
    const d0 = cumDists[curOrigIdx];
    const d1 = cumDists[curOrigIdx + 1];
    const t = d1 > d0 ? (targetDist - d0) / (d1 - d0) : 0;

    const p0 = points[curOrigIdx];
    const p1 = points[curOrigIdx + 1];

    resampled.push({
      x: p0.x + t * (p1.x - p0.x),
      z: p0.z + t * (p1.z - p0.z),
      distance: targetDist,
    });
  }

  const finalSamples = [];
  const n = resampled.length;

  for (let i = 0; i < n; i++) {
    const prev = resampled[(i - 1 + n) % n];
    const next = resampled[(i + 1) % n];

    let tx = next.x - prev.x;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, tz);
    if (len > 1e-5) {
      tx /= len;
      tz /= len;
    }

    const nx = tz;
    const nz = -tx;

    const prevTx = (resampled[i].x - prev.x);
    const prevTz = (resampled[i].z - prev.z);
    const prevLen = Math.hypot(prevTx, prevTz);
    const nextTx = (next.x - resampled[i].x);
    const nextTz = (next.z - resampled[i].z);
    const nextLen = Math.hypot(nextTx, nextTz);

    let curvatureDeg = 0;
    if (prevLen > 1e-5 && nextLen > 1e-5) {
      const dot = (prevTx * nextTx + prevTz * nextTz) / (prevLen * nextLen);
      const clamped = Math.max(-1, Math.min(1, dot));
      curvatureDeg = Math.acos(clamped) * (180 / Math.PI);
    }

    const { minWidth, maxWidth, maxCurvRef } = widthConfig;
    const curvFactor = Math.min(1.0, curvatureDeg / maxCurvRef);
    const dynamicWidth = maxWidth - curvFactor * (maxWidth - minWidth);

    finalSamples.push({
      x: Number(resampled[i].x.toFixed(2)),
      z: Number(resampled[i].z.toFixed(2)),
      tx: Number(tx.toFixed(3)),
      tz: Number(tz.toFixed(3)),
      nx: Number(nx.toFixed(3)),
      nz: Number(nz.toFixed(3)),
      distance: Number(resampled[i].distance.toFixed(2)),
      curvatureDeg: Number(curvatureDeg.toFixed(2)),
      width: Number(dynamicWidth.toFixed(2)),
    });
  }

  return { samples: finalSamples, totalLength };
}

// -------------------------------------------------------------
// 1. BUILD ELEYELE RING CIRCUIT
// -------------------------------------------------------------
console.log('Building Eleyele Ring Circuit...');
const b1 = jsonMatches[0].features;
const w292 = b1.find(f => f.id === 'way/563516292').geometry.coordinates;
const w274 = b1.find(f => f.id === 'way/563516274').geometry.coordinates;
const w276 = b1.find(f => f.id === 'way/563516276').geometry.coordinates;
const w275 = b1.find(f => f.id === 'way/563516275').geometry.coordinates;
const w277 = b1.find(f => f.id === 'way/563516277').geometry.coordinates;

const eleyeleRaw = [];
for (let i = 0; i <= 12; i++) eleyeleRaw.push(w292[i]);
for (let i = w274.length - 2; i >= 0; i--) eleyeleRaw.push(w274[i]);
for (let i = w276.length - 2; i >= 0; i--) eleyeleRaw.push(w276[i]);
for (let i = w275.length - 2; i >= 0; i--) eleyeleRaw.push(w275[i]);
for (let i = 17; i <= 21; i++) eleyeleRaw.push(w292[i]);
for (let i = 0; i < w277.length; i++) eleyeleRaw.push(w277[i]);

const R = 6378137;
let eLon = 0, eLat = 0;
eleyeleRaw.forEach(([lon, lat]) => { eLon += lon; eLat += lat; });
const eOrigin = [eLon / eleyeleRaw.length, eLat / eleyeleRaw.length];
const eLat0 = eOrigin[1] * Math.PI / 180;
const eScale = 2.15;

const eleyeleBase = eleyeleRaw.map(([lon, lat]) => ({
  x: (lon - eOrigin[0]) * Math.PI / 180 * R * Math.cos(eLat0) * eScale,
  z: (lat - eOrigin[1]) * Math.PI / 180 * R * eScale
}));

const eleyeleControls = [eleyeleBase[0]];
for (let i = 1; i < eleyeleBase.length; i++) {
  const prev = eleyeleControls[eleyeleControls.length - 1];
  const cur = eleyeleBase[i];
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) >= 8.0) {
    eleyeleControls.push(cur);
  }
}

// Collinear North Carousel into eleyeleBase[0]
const northArc = [
  { x: 25.0,   z: 140.0 },
  { x: -10.0,  z: 195.0 },
  { x: -55.0,  z: 240.0 },
  { x: -110.0, z: 265.0 },
  { x: -155.0, z: 260.0 }
];
const fullEleyeleControls = [...eleyeleControls, ...northArc];
const eleyeleSpline = sampleSplineClosed(fullEleyeleControls, 24);
const eleyeleResult = resampleEquidistant(eleyeleSpline, 4.5, { minWidth: 10.5, maxWidth: 13.5, maxCurvRef: 12.0 });

console.log(`Eleyele: ${eleyeleResult.samples.length} samples, ${eleyeleResult.totalLength.toFixed(1)}m length`);

// -------------------------------------------------------------
// 2. BUILD AKOBO HIGHWAY CIRCUIT
// -------------------------------------------------------------
console.log('Building Akobo Highway Express...');
const b2 = jsonMatches[1].features;
const w1425 = b2.find(f => f.id === 'way/1425872872').geometry.coordinates;

let aLon = 0, aLat = 0;
w1425.forEach(([lon, lat]) => { aLon += lon; aLat += lat; });
const aOrigin = [aLon / w1425.length, aLat / w1425.length];
const aLat0 = aOrigin[1] * Math.PI / 180;
const aScale = 0.68;

const akoboRaw = w1425.map(([lon, lat]) => ({
  x: (lon - aOrigin[0]) * Math.PI / 180 * R * Math.cos(aLat0) * aScale,
  z: (lat - aOrigin[1]) * Math.PI / 180 * R * aScale
}));

const akoboControls = [akoboRaw[0]];
for (let i = 1; i < akoboRaw.length; i++) {
  const prev = akoboControls[akoboControls.length - 1];
  const cur = akoboRaw[i];
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) >= 15.0 || i === akoboRaw.length - 1) {
    akoboControls.push(cur);
  }
}

const pEnd = akoboControls[akoboControls.length - 1];
const pStart = akoboControls[0];

// Smooth North Carousel and Eastern Valley return expressway
const returnControls = [
  { x: pEnd.x - 70.0, z: pEnd.z + 100.0 },
  { x: pEnd.x - 40.0, z: pEnd.z + 220.0 },
  { x: pEnd.x + 80.0, z: pEnd.z + 280.0 },
  { x: pEnd.x + 220.0, z: pEnd.z + 240.0 },
  { x: pEnd.x + 320.0, z: pEnd.z + 120.0 },
  { x: pEnd.x + 360.0, z: pEnd.z - 80.0 },
  { x: pEnd.x + 320.0, z: pEnd.z - 380.0 },
  { x: pEnd.x + 240.0, z: pEnd.z - 750.0 },
  { x: pEnd.x + 120.0, z: pEnd.z - 1150.0 },
  { x: pEnd.x - 40.0,  z: pEnd.z - 1550.0 },
  { x: pEnd.x - 260.0, z: pEnd.z - 1950.0 },
  { x: pEnd.x - 550.0, z: pEnd.z - 2300.0 },
  { x: pEnd.x - 900.0, z: pEnd.z - 2580.0 },
  { x: pEnd.x - 1300.0, z: pEnd.z - 2750.0 },
  { x: pEnd.x - 1700.0, z: pEnd.z - 2780.0 },
  { x: pEnd.x - 2050.0, z: pEnd.z - 2650.0 },
  { x: pStart.x - 60.0, z: pStart.z - 200.0 },
  { x: pStart.x - 30.0, z: pStart.z - 100.0 }
];

const fullAkoboControls = [...akoboControls, ...returnControls];
const akoboSpline = sampleSplineClosed(fullAkoboControls, 20);
const akoboResult = resampleEquidistant(akoboSpline, 8.0, { minWidth: 11.5, maxWidth: 14.5, maxCurvRef: 10.0 });

let sprintFinishIdx = 0;
let minTerminusDist = Infinity;
akoboResult.samples.forEach((s, idx) => {
  const d = Math.hypot(s.x - pEnd.x, s.z - pEnd.z);
  if (d < minTerminusDist && idx < akoboResult.samples.length * 0.6) {
    minTerminusDist = d;
    sprintFinishIdx = idx;
  }
});
const sprintFinishSample = akoboResult.samples[sprintFinishIdx];
console.log(`Akobo: ${akoboResult.samples.length} samples, ${akoboResult.totalLength.toFixed(1)}m length. Sprint Finish at #${sprintFinishIdx} (${sprintFinishSample.distance.toFixed(1)}m)`);

// -------------------------------------------------------------
// HELPER TO GENERATE TYPESCRIPT CODE FOR A CIRCUIT
// -------------------------------------------------------------
function generateCircuitTS(config) {
  const {
    varName,
    id,
    name,
    subtitle,
    description,
    measuredLength,
    samples,
    checkpoints,
    events,
    sprintFinishIdx,
    driftZones,
    bounds,
    env,
    prefix
  } = config;

  const startPt = samples[0];
  const startYaw = Math.atan2(startPt.tx, startPt.tz);

  const aiSlots = [
    { slot: 1, distOffset: -12.0, sideOffset: 3.2 },
    { slot: 2, distOffset: -24.0, sideOffset: -3.2 },
    { slot: 3, distOffset: -36.0, sideOffset: 3.2 }
  ].map(s => {
    const sLen = samples.length;
    const stepBack = Math.round(Math.abs(s.distOffset) / (samples[1].distance - samples[0].distance));
    const targetIdx = (sLen - stepBack) % sLen;
    const refPt = samples[targetIdx];
    const pos = {
      x: Number((refPt.x + s.sideOffset * refPt.nx).toFixed(2)),
      y: 0.05,
      z: Number((refPt.z + s.sideOffset * refPt.nz).toFixed(2))
    };
    const yaw = Number(Math.atan2(refPt.tx, refPt.tz).toFixed(3));
    return { gridSlot: s.slot, position: pos, yaw };
  });

  const fullSvgPath = 'M ' + samples.map(s => `${s.x},${s.z}`).join(' L ') + ' Z';
  const sprintSvgPath = sprintFinishIdx > 0
    ? 'M ' + samples.slice(0, sprintFinishIdx + 1).map(s => `${s.x},${s.z}`).join(' L ')
    : fullSvgPath;

  const eventsCode = events.map(e => `  {
    id: '${e.id}',
    mode: '${e.mode}',
    name: '${e.name.replace(/'/g, "\\'")}',
    subtitle: '${e.subtitle.replace(/'/g, "\\'")}',
    badgeText: '${e.badgeText.replace(/'/g, "\\'")}',
    lapsBadge: '${e.lapsBadge.replace(/'/g, "\\'")}',
    description: '${e.description.replace(/'/g, "\\'")}',
    specs: {
      length: '${e.specs.length}',
      sectors: '${e.specs.sectors}',
      surface: '${e.specs.surface}',
    },
    startPosition: new Vector3(${startPt.x}, 0.05, ${startPt.z}),
    startYaw: ${Number(startYaw.toFixed(3))},
    checkpointIds: [
${e.checkpointIds.map(cid => `      '${cid}',`).join('\n')}
    ],
    finishCheckpointId: '${e.finishCheckpointId}',
    mapType: '${e.mapType}',
  },`).join('\n');

  const code = `import {
  Scene,
  Vector3,
  Color3,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
} from '@babylonjs/core';
import { CircuitDefinition } from './TrackConfig';
import { RaceEventConfig } from '../events/EventConfig';
import { RoadSamplePoint } from '../environment/RoadMeshBuilder';
import { CheckpointData } from '../checkpoints/CheckpointManager';

// ${samples.length} discrete road sample points derived from OpenStreetMap road network geometry
// Total circuit measured length: ${measuredLength.toFixed(1)}m
// Dynamic asphalt width: ${config.minWidth}m to ${config.maxWidth}m
const ${prefix}RoadSamples: RoadSamplePoint[] = [
${samples.map(s => `  { position: new Vector3(${s.x}, 0.05, ${s.z}), tangent: new Vector3(${s.tx}, 0, ${s.tz}), rightNormal: new Vector3(${s.nx}, 0, ${s.nz}), distance: ${s.distance}, curvatureDeg: ${s.curvatureDeg}, width: ${s.width} },`).join('\n')}
];

const ${prefix}Centerline = ${prefix}RoadSamples.map((s, idx) => {
  const next = ${prefix}RoadSamples[(idx + 1) % ${prefix}RoadSamples.length];
  return {
    id: idx,
    start: s.position.clone(),
    end: next.position.clone(),
  };
});

const ${prefix}Checkpoints: CheckpointData[] = [
${checkpoints.map(cp => `  {
    id: '${cp.id}',
    order: ${cp.order},
    position: new Vector3(${cp.x}, 0.05, ${cp.z}),
    direction: new Vector3(${cp.tx}, 0, ${cp.tz}),
    width: ${cp.width},
  },`).join('\n')}
];

const ${prefix}Events: RaceEventConfig[] = [
${eventsCode}
];

export const ${varName}: CircuitDefinition = {
  id: '${id}',
  name: '${name}',
  subtitle: '${subtitle}',
  measuredLengthMeters: ${measuredLength.toFixed(1)},
  tileCount: ${samples.length},
  description:
    '${description.replace(/'/g, "\\'")}',
  surface: 'ASPHALT',
  roadSurfaceY: 0.05,
  startPosition: new Vector3(${startPt.x}, 0.05, ${startPt.z}),
  startYaw: ${Number(startYaw.toFixed(3))},
  aiGridSlots: [
${aiSlots.map(s => `    { gridSlot: ${s.gridSlot}, position: new Vector3(${s.position.x}, ${s.position.y}, ${s.position.z}), yaw: ${s.yaw} },`).join('\n')}
  ],
  sections: [],
  roadSamples: ${prefix}RoadSamples,
  centerlineSegments: ${prefix}Centerline,
  checkpoints: ${prefix}Checkpoints,
  boundaries: {
    minX: ${bounds.minX},
    maxX: ${bounds.maxX},
    minZ: ${bounds.minZ},
    maxZ: ${bounds.maxZ},
    minY: -10,
  },
  trackHalfWidth: ${config.trackHalfWidth || 7.5},
  barrierLimit: ${config.barrierLimit || 8.5},
  environment: {
    clearColor: new Color3(${env.clearColor.r}, ${env.clearColor.g}, ${env.clearColor.b}),
    ambientColor: new Color3(${env.ambientColor.r}, ${env.ambientColor.g}, ${env.ambientColor.b}),
    sunDirection: new Vector3(${env.sunDirection.x}, ${env.sunDirection.y}, ${env.sunDirection.z}),
    sunDiffuse: new Color3(${env.sunDiffuse.r}, ${env.sunDiffuse.g}, ${env.sunDiffuse.b}),
    sunSpecular: new Color3(${env.sunSpecular.r}, ${env.sunSpecular.g}, ${env.sunSpecular.b}),
    groundColor: new Color3(${env.groundColor.r}, ${env.groundColor.g}, ${env.groundColor.b}),
    fogStart: ${env.fogStart},
    fogEnd: ${env.fogEnd},
  },
  events: ${prefix}Events,
  minimap: {
    svgViewBox: '${bounds.minX - 50} ${bounds.minZ - 50} ${(bounds.maxX - bounds.minX) + 100} ${(bounds.maxZ - bounds.minZ) + 100}',
    fullCircuitSvgPath: '${fullSvgPath}',
    sprintSvgPath: '${sprintSvgPath}',
    sprintStart: { x: ${startPt.x}, y: ${startPt.z} },
    sprintFinish: { x: ${sprintFinishSample ? sprintFinishSample.x : startPt.x}, y: ${sprintFinishSample ? sprintFinishSample.z : startPt.z} },
    startFinishMarker: { x: ${startPt.x}, y: ${startPt.z}, labelPos: { x: 15, y: -10 } },
    driftZones: ${JSON.stringify(driftZones, null, 6)},
    gateMarkers: [
${checkpoints.map(cp => `      { x: ${cp.x}, y: ${cp.z} },`).join('\n')}
    ],
  },

  buildRoadMarkings: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const yMarking = yOffset + 0.002;

    // Start/Finish Checkered Line
    const sfTex = new DynamicTexture('${prefix}_SF_Tex', { width: 512, height: 64 }, scene, false);
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

    const sfMat = new StandardMaterial('${prefix}_SF_Mat', scene);
    sfMat.diffuseTexture = sfTex;
    sfMat.specularColor = new Color3(0.05, 0.05, 0.05);
    sfMat.backFaceCulling = false;

    const sfStrip = MeshBuilder.CreateGround('${prefix}_SF_Strip', { width: ${config.maxWidth}, height: 2.0 }, scene);
    sfStrip.position.set(${startPt.x}, yMarking, ${startPt.z});
    sfStrip.rotation.y = ${Number(startYaw.toFixed(3))};
    sfStrip.material = sfMat;
    sfStrip.parent = parent;
    sfStrip.isPickable = false;

    ${sprintFinishIdx > 0 ? `
    // Sprint Finish Line Marker
    const sprintEnd = ${prefix}RoadSamples[${sprintFinishIdx}];
    const sprintStrip = MeshBuilder.CreateGround('${prefix}_SprintFinish_Strip', { width: ${config.maxWidth}, height: 2.0 }, scene);
    sprintStrip.position.set(sprintEnd.position.x, yMarking, sprintEnd.position.z);
    sprintStrip.rotation.y = Math.atan2(sprintEnd.tangent.x, sprintEnd.tangent.z);
    sprintStrip.material = sfMat;
    sprintStrip.parent = parent;
    sprintStrip.isPickable = false;
    ` : ''}
  },

  buildRoadVerges: (_scene: Scene, _parent: TransformNode, _yOffset: number) => {
    // Built continuously along full spline by RoadMeshBuilder.buildVerges
  },

  buildRoadsideInfrastructure: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const postMat = new StandardMaterial('${prefix}_PostMat', scene);
    postMat.diffuseColor = new Color3(0.25, 0.25, 0.25);
    postMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const bannerMat = new StandardMaterial('${prefix}_BannerMat', scene);
    bannerMat.diffuseColor = new Color3(0.9, 0.2, 0.15);
    bannerMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const totalSamples = ${prefix}RoadSamples.length;
    for (let i = 0; i < totalSamples; i += ${config.infraInterval || 30}) {
      const pt = ${prefix}RoadSamples[i];
      const curWidth = pt.width || ${config.maxWidth};
      const rightPos = pt.position.add(pt.rightNormal.scale(curWidth / 2 + 1.8));

      const post = MeshBuilder.CreateCylinder('${prefix}_BoardPost_' + i, { height: 1.8, diameter: 0.12 }, scene);
      post.position.set(rightPos.x, yOffset + 0.9, rightPos.z);
      post.material = postMat;
      post.parent = parent;
      post.isPickable = false;

      const board = MeshBuilder.CreateBox('${prefix}_BoardPanel_' + i, { width: 1.4, height: 0.8, depth: 0.08 }, scene);
      board.position.set(rightPos.x, yOffset + 1.4, rightPos.z);
      board.rotation.y = Math.atan2(pt.tangent.x, pt.tangent.z);
      board.material = bannerMat;
      board.parent = parent;
      board.isPickable = false;
    }
  },

  buildScenery: async (scene: Scene, parent: TransformNode) => {
    const sceneryRoot = new TransformNode('${prefix}_SceneryContainer', scene);
    sceneryRoot.parent = parent;

    const foliageMat = new StandardMaterial('${prefix}_FoliageMat', scene);
    foliageMat.diffuseColor = new Color3(${env.foliageColor.r}, ${env.foliageColor.g}, ${env.foliageColor.b});
    foliageMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const trunkMat = new StandardMaterial('${prefix}_TrunkMat', scene);
    trunkMat.diffuseColor = new Color3(0.28, 0.18, 0.10);
    trunkMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const totalSamples = ${prefix}RoadSamples.length;
    for (let i = 0; i < totalSamples; i += ${config.sceneryInterval || 25}) {
      const pt = ${prefix}RoadSamples[i];
      const curWidth = pt.width || ${config.maxWidth};
      
      for (const side of [-1, 1]) {
        const offset = curWidth / 2 + 4.5 + Math.random() * 4.0;
        const pos = pt.position.add(pt.rightNormal.scale(side * offset));

        const trunk = MeshBuilder.CreateCylinder('${prefix}_Trunk_' + i + '_' + side, { height: 3.2, diameter: 0.35 }, scene);
        trunk.position.set(pos.x, 1.6, pos.z);
        trunk.material = trunkMat;
        trunk.parent = sceneryRoot;
        trunk.isPickable = false;

        const canopy = MeshBuilder.CreateSphere('${prefix}_Canopy_' + i + '_' + side, { diameter: 3.6, segments: 6 }, scene);
        canopy.position.set(pos.x, 3.8, pos.z);
        canopy.material = foliageMat;
        canopy.parent = sceneryRoot;
        canopy.isPickable = false;
      }
    }
  },
};
`;

  return code;
}

// -------------------------------------------------------------
// ASSEMBLE CONFIGS AND WRITE FILES
// -------------------------------------------------------------

// 1. Eleyele Ring Config
const eSamples = eleyeleResult.samples;
const eCheckpointsCount = 12;
const eStep = Math.floor(eSamples.length / eCheckpointsCount);
const eCheckpoints = [];
for (let i = 0; i < eCheckpointsCount; i++) {
  const s = eSamples[i * eStep];
  eCheckpoints.push({
    id: `EY_CP_${i + 1}`,
    x: s.x,
    z: s.z,
    tx: s.tx,
    tz: s.tz,
    width: s.width ? Number((s.width + 3.0).toFixed(1)) : 16.0,
    order: i,
  });
}

const eMinX = Math.floor(Math.min(...eSamples.map(s => s.x)) - 60);
const eMaxX = Math.ceil(Math.max(...eSamples.map(s => s.x)) + 60);
const eMinZ = Math.floor(Math.min(...eSamples.map(s => s.z)) - 60);
const eMaxZ = Math.ceil(Math.max(...eSamples.map(s => s.z)) + 60);

const eAllCpIds = eCheckpoints.map(c => c.id);

const eleyeleEvents = [
  {
    id: 'eleyele_grand_prix',
    mode: 'time_trial',
    name: 'Eleyele Ring Grand Prix',
    subtitle: 'Authentic 1.5km Ibadan North Circuit • 3 Laps',
    badgeText: 'CIRCUIT RACE',
    lapsBadge: '3 LAPS',
    description: '3-lap urban circuit showdown through the technical chicanes and high-speed carousels of Ibadan North.',
    specs: {
      length: '1,507 M',
      sectors: '12 GATES',
      surface: 'ASPHALT',
    },
    checkpointIds: eAllCpIds,
    finishCheckpointId: eAllCpIds[eAllCpIds.length - 1],
    mapType: 'loop',
  },
  {
    id: 'eleyele_elimination',
    mode: 'elimination',
    name: 'Ibadan North Knockout',
    subtitle: '20-Second Knockout Rounds • Elimination',
    badgeText: 'ELIMINATION',
    lapsBadge: '20S KNOCKOUT',
    description: 'Every 20 seconds, the driver in last position is eliminated. Maintain the lead at all costs.',
    specs: {
      length: '1,507 M',
      sectors: '12 GATES',
      surface: 'ASPHALT',
    },
    checkpointIds: eAllCpIds,
    finishCheckpointId: eAllCpIds[eAllCpIds.length - 1],
    mapType: 'loop',
  },
  {
    id: 'eleyele_speed_trap',
    mode: 'speed_trap',
    name: 'Eleyele Street Radar Challenge',
    subtitle: 'Street Radar Traps • Top Velocity Benchmark',
    badgeText: 'SPEED TRAP',
    lapsBadge: '3 RADAR TRAPS',
    description: 'Maximum speed traps stationed along the West Main Straight and East Back Straight.',
    specs: {
      length: '1,507 M',
      sectors: '3 RADARS',
      surface: 'ASPHALT',
    },
    checkpointIds: eAllCpIds,
    finishCheckpointId: eAllCpIds[eAllCpIds.length - 1],
    mapType: 'loop',
  },
];

const eleyeleCode = generateCircuitTS({
  varName: 'EleyeleRingCircuit',
  id: 'eleyele_ring',
  name: 'Eleyele Ring Circuit',
  subtitle: 'Authentic 1.5km Ibadan North Technical Circuit',
  description: 'Constructed directly from real-world OpenStreetMap road network geometry (Ways 563516274, 563516275, 563516276, 563516277, 563516292) in Ibadan North near Eleyele. A tight, technical urban motorsport ring featuring the high-speed North Carousel, an infield technical S-chicane, and a sweeping East Back Straight.',
  measuredLength: eleyeleResult.totalLength,
  samples: eSamples,
  checkpoints: eCheckpoints,
  events: eleyeleEvents,
  sprintFinishIdx: 0,
  driftZones: [
    { path: 'M -80,110 L -73,85 L -118,45', label: 'INFIELD CHICANE', labelPos: { x: -90, y: 75 } },
    { path: 'M -110,265 L -55,240 L 25,140', label: 'NORTH CAROUSEL', labelPos: { x: -50, y: 220 } },
  ],
  bounds: { minX: eMinX, maxX: eMaxX, minZ: eMinZ, maxZ: eMaxZ },
  minWidth: 10.5,
  maxWidth: 13.5,
  trackHalfWidth: 7.0,
  barrierLimit: 8.0,
  infraInterval: 25,
  sceneryInterval: 20,
  env: {
    clearColor: { r: 0.06, g: 0.10, b: 0.16 },
    ambientColor: { r: 0.24, g: 0.25, b: 0.28 },
    sunDirection: { x: 0.6, y: -1.2, z: 0.4 },
    sunDiffuse: { r: 1.0, g: 0.96, b: 0.90 },
    sunSpecular: { r: 0.9, g: 0.9, b: 0.9 },
    groundColor: { r: 0.18, g: 0.22, b: 0.16 },
    foliageColor: { r: 0.20, g: 0.35, b: 0.18 },
    fogStart: 300.0,
    fogEnd: 1800.0,
  },
  prefix: 'eleyele',
});

const outDir = path.resolve(__dirname, '../src/tracks');
fs.writeFileSync(path.join(outDir, 'EleyeleRingCircuit.ts'), eleyeleCode);
console.log('Saved src/tracks/EleyeleRingCircuit.ts');

// 2. Akobo Highway Config
const aSamples = akoboResult.samples;
const aCheckpointsCount = 18;
const aStep = Math.floor(aSamples.length / aCheckpointsCount);
const aCheckpoints = [];
let sprintFinishCpId = 'AK_CP_10';

for (let i = 0; i < aCheckpointsCount; i++) {
  const s = aSamples[i * aStep];
  const isSprintFinish = Math.abs(i * aStep - sprintFinishIdx) < aStep / 2;
  const cpId = `AK_CP_${i + 1}`;
  if (isSprintFinish) {
    sprintFinishCpId = cpId;
  }
  aCheckpoints.push({
    id: cpId,
    x: s.x,
    z: s.z,
    tx: s.tx,
    tz: s.tz,
    width: s.width ? Number((s.width + 3.0).toFixed(1)) : 17.0,
    order: i,
  });
}

const aMinX = Math.floor(Math.min(...aSamples.map(s => s.x)) - 100);
const aMaxX = Math.ceil(Math.max(...aSamples.map(s => s.x)) + 100);
const aMinZ = Math.floor(Math.min(...aSamples.map(s => s.z)) - 100);
const aMaxZ = Math.ceil(Math.max(...aSamples.map(s => s.z)) + 100);

const aAllCpIds = aCheckpoints.map(c => c.id);
const sprintCpEndIdx = aCheckpoints.findIndex(c => c.id === sprintFinishCpId);
const aSprintCpIds = aAllCpIds.slice(0, (sprintCpEndIdx >= 0 ? sprintCpEndIdx + 1 : 10));

const akoboEvents = [
  {
    id: 'akobo_highway_sprint',
    mode: 'sprint',
    name: 'Akobo Highway Grand Sprint',
    subtitle: 'Authentic 4.1km Artery Point-to-Point Sprint',
    badgeText: 'SPRINT STAGE',
    lapsBadge: 'POINT TO POINT',
    description: 'Blistering 4.1km point-to-point highway sprint along the real Akobo - Olorunda Abba secondary artery.',
    specs: {
      length: '4,064 M',
      sectors: `${aSprintCpIds.length} GATES`,
      surface: 'ASPHALT',
    },
    checkpointIds: aSprintCpIds,
    finishCheckpointId: sprintFinishCpId,
    mapType: 'sprint',
  },
  {
    id: 'akobo_expressway_gp',
    mode: 'time_trial',
    name: 'Akobo Expressway Grand Prix',
    subtitle: '9.7km Grand Multi-Lane Expressway • 2 Laps',
    badgeText: 'CIRCUIT RACE',
    lapsBadge: '2 LAPS',
    description: '2 full laps around the 9.7km grand expressway loop, pairing the authentic highway spine with the sweeping Eastern Valley bypass.',
    specs: {
      length: '9,769 M',
      sectors: '18 GATES',
      surface: 'ASPHALT',
    },
    checkpointIds: aAllCpIds,
    finishCheckpointId: aAllCpIds[aAllCpIds.length - 1],
    mapType: 'loop',
  },
  {
    id: 'akobo_pursuit',
    mode: 'pursuit',
    name: 'Akobo Highway Pursuit',
    subtitle: 'Highway Interceptor Challenge • Sprint Pursuit',
    badgeText: 'PURSUIT',
    lapsBadge: 'INTERCEPTOR SPRINT',
    description: 'High-speed highway chase across the Akobo corridor. Outrun law enforcement and reach the northern terminus.',
    specs: {
      length: '4,064 M',
      sectors: `${aSprintCpIds.length} GATES`,
      surface: 'ASPHALT',
    },
    checkpointIds: aSprintCpIds,
    finishCheckpointId: sprintFinishCpId,
    mapType: 'sprint',
  },
  {
    id: 'akobo_radar_blitz',
    mode: 'speed_trap',
    name: 'Akobo Radar Blitz',
    subtitle: '4 Expressway Radar Cameras • Speed Benchmark',
    badgeText: 'SPEED TRAP',
    lapsBadge: '4 RADAR TRAPS',
    description: 'Trigger 4 highway radar speed traps at speeds exceeding 250 km/h along the sweeping expressway.',
    specs: {
      length: '9,769 M',
      sectors: '4 RADARS',
      surface: 'ASPHALT',
    },
    checkpointIds: aAllCpIds,
    finishCheckpointId: aAllCpIds[aAllCpIds.length - 1],
    mapType: 'loop',
  },
  {
    id: 'akobo_highway_elimination',
    mode: 'elimination',
    name: 'Akobo Highway Survivor',
    subtitle: '25-Second Knockout Rounds • 2 Laps',
    badgeText: 'ELIMINATION',
    lapsBadge: '25S KNOCKOUT',
    description: 'High-speed knockout survival across the vast expressway loop. Every 25 seconds the slowest chassis is eliminated.',
    specs: {
      length: '9,769 M',
      sectors: '18 GATES',
      surface: 'ASPHALT',
    },
    checkpointIds: aAllCpIds,
    finishCheckpointId: aAllCpIds[aAllCpIds.length - 1],
    mapType: 'loop',
  },
];

const akoboCode = generateCircuitTS({
  varName: 'AkoboHighwayCircuit',
  id: 'akobo_highway',
  name: 'Akobo Highway Express',
  subtitle: 'Authentic 4.1km Artery Sprint & 9.7km Grand Expressway',
  description: 'Modeled directly from real-world OpenStreetMap highway data (Ways 1425872872 & 1460397505) traversing Akobo and Olorunda Abba in Ibadan. Features a blistering 4.1km Point-to-Point Grand Highway Sprint stage, expanding into a 9.7km high-speed multi-lane expressway loop with sweeping valley curves and radar speed traps.',
  measuredLength: akoboResult.totalLength,
  samples: aSamples,
  checkpoints: aCheckpoints,
  events: akoboEvents,
  sprintFinishIdx: sprintFinishIdx,
  driftZones: [
    { path: 'M 1300,900 L 1400,1200 L 1500,1000', label: 'NORTH CAROUSEL', labelPos: { x: 1400, y: 1050 } },
    { path: 'M -500,-2300 L -900,-2580 L -1300,-2750', label: 'VALLEY SWEEP', labelPos: { x: -900, y: -2500 } },
  ],
  bounds: { minX: aMinX, maxX: aMaxX, minZ: aMinZ, maxZ: aMaxZ },
  minWidth: 11.5,
  maxWidth: 14.5,
  trackHalfWidth: 8.0,
  barrierLimit: 9.0,
  infraInterval: 40,
  sceneryInterval: 35,
  env: {
    clearColor: { r: 0.08, g: 0.12, b: 0.18 },
    ambientColor: { r: 0.25, g: 0.26, b: 0.28 },
    sunDirection: { x: 0.5, y: -1.1, z: 0.7 },
    sunDiffuse: { r: 1.0, g: 0.95, b: 0.88 },
    sunSpecular: { r: 0.85, g: 0.85, b: 0.85 },
    groundColor: { r: 0.20, g: 0.22, b: 0.16 },
    foliageColor: { r: 0.24, g: 0.36, b: 0.17 },
    fogStart: 600.0,
    fogEnd: 4200.0,
  },
  prefix: 'akobo',
});

fs.writeFileSync(path.join(outDir, 'AkoboHighwayCircuit.ts'), akoboCode);
console.log('Saved src/tracks/AkoboHighwayCircuit.ts');
console.log('=== TRACK BUILD COMPLETE ===');
