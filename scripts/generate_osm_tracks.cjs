const fs = require('fs');
const path = require('path');

const userGeoJsonPath = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/d7d4953d-cff7-4e7c-9606-82ddfbdd214a/scratch/user_raw_geojson.txt');
const content = fs.readFileSync(userGeoJsonPath, 'utf8');

// Extract all JSON blocks
const jsonMatches = [];
let depth = 0, start = -1;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '{') {
    if (depth === 0) start = i;
    depth++;
  } else if (content[i] === '}') {
    depth--;
    if (depth === 0 && start !== -1) {
      const jsonStr = content.substring(start, i + 1);
      try {
        const obj = JSON.parse(jsonStr);
        jsonMatches.push(obj);
      } catch (e) {}
      start = -1;
    }
  }
}

console.log('Loaded JSON blocks:', jsonMatches.length);

// Centripetal Catmull-Rom spline (alpha = 0.5)
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

function sampleSplineClosed(controlPoints, stepsPerSegment = 20) {
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
  // Compute cumulative distances
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

  // Calculate tangents, normals, curvatures, and dynamic widths
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

    // Right normal in XZ plane: (tz, -tx)
    const nx = tz;
    const nz = -tx;

    // Curvature from previous to next tangent
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

    // Dynamic width calculation
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

// ==========================================
// 1. GENERATE ELEYELE RING CIRCUIT
// ==========================================
console.log('\n--- GENERATING ELEYELE RING CIRCUIT ---');
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

// Clean super-close points
const eleyeleControls = [eleyeleBase[0]];
for (let i = 1; i < eleyeleBase.length; i++) {
  const prev = eleyeleControls[eleyeleControls.length - 1];
  const cur = eleyeleBase[i];
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) >= 5.0) {
    eleyeleControls.push(cur);
  }
}

// Add smooth transition points between w277[7] and w292[0] (North Carousel)
const pLast277 = eleyeleControls[eleyeleControls.length - 1];
const pFirst292 = eleyeleControls[0];
const northMid1 = {
  x: pLast277.x + 0.35 * (pFirst292.x - pLast277.x) + 30.0,
  z: pLast277.z + 0.5 * (pFirst292.z - pLast277.z) + 40.0,
};
const northMid2 = {
  x: pLast277.x + 0.75 * (pFirst292.x - pLast277.x) + 15.0,
  z: pLast277.z + 0.85 * (pFirst292.z - pLast277.z) + 25.0,
};
eleyeleControls.push(northMid1, northMid2);

const eleyeleSpline = sampleSplineClosed(eleyeleControls, 24);
const eleyeleResult = resampleEquidistant(eleyeleSpline, 4.5, { minWidth: 10.5, maxWidth: 13.5, maxCurvRef: 14.0 });
console.log('Eleyele Circuit: Total length =', eleyeleResult.totalLength.toFixed(1), 'm, samples =', eleyeleResult.samples.length);

// ==========================================
// 2. GENERATE AKOBO HIGHWAY CIRCUIT
// ==========================================
console.log('\n--- GENERATING AKOBO HIGHWAY CIRCUIT ---');
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

// Clean points along spine (< 15m)
const akoboControls = [akoboRaw[0]];
for (let i = 1; i < akoboRaw.length; i++) {
  const prev = akoboControls[akoboControls.length - 1];
  const cur = akoboRaw[i];
  if (Math.hypot(cur.x - prev.x, cur.z - prev.z) >= 15.0 || i === akoboRaw.length - 1) {
    akoboControls.push(cur);
  }
}
const sprintControlCount = akoboControls.length;
console.log('Akobo spine cleaned controls:', sprintControlCount);

// Build flowing Eastern Valley return expressway loop from terminus back to start
const terminus = akoboControls[akoboControls.length - 1];
const startPoint = akoboControls[0];
console.log('Terminus:', terminus, 'Start:', startPoint);

const returnLoopControls = [
  { x: terminus.x + 120.0, z: terminus.z - 80.0 },
  { x: terminus.x + 220.0, z: terminus.z - 280.0 },
  { x: terminus.x + 280.0, z: terminus.z - 550.0 },
  { x: terminus.x + 260.0, z: terminus.z - 900.0 },
  { x: terminus.x + 180.0, z: terminus.z - 1300.0 },
  { x: terminus.x + 20.0,  z: terminus.z - 1700.0 },
  { x: terminus.x - 200.0, z: terminus.z - 2050.0 },
  { x: terminus.x - 500.0, z: terminus.z - 2350.0 },
  { x: terminus.x - 900.0, z: terminus.z - 2550.0 },
  { x: terminus.x - 1350.0, z: terminus.z - 2650.0 },
  { x: terminus.x - 1750.0, z: terminus.z - 2600.0 },
  { x: terminus.x - 2100.0, z: terminus.z - 2450.0 },
  { x: startPoint.x + 220.0, z: startPoint.z - 60.0 },
  { x: startPoint.x + 90.0,  z: startPoint.z - 20.0 }
];

const allAkoboControls = [...akoboControls, ...returnLoopControls];
const akoboSpline = sampleSplineClosed(allAkoboControls, 20);
const akoboResult = resampleEquidistant(akoboSpline, 8.0, { minWidth: 11.5, maxWidth: 14.5, maxCurvRef: 10.0 });
console.log('Akobo Circuit: Total length =', akoboResult.totalLength.toFixed(1), 'm, samples =', akoboResult.samples.length);

// Find sprint finish sample index
let sprintFinishIdx = 0;
let minTerminusDist = Infinity;
akoboResult.samples.forEach((s, idx) => {
  const d = Math.hypot(s.x - terminus.x, s.z - terminus.z);
  if (d < minTerminusDist && idx < akoboResult.samples.length * 0.7) {
    minTerminusDist = d;
    sprintFinishIdx = idx;
  }
});
const sprintFinishSample = akoboResult.samples[sprintFinishIdx];
console.log('Akobo Sprint Stage: Finish Index =', sprintFinishIdx, 'Distance =', sprintFinishSample.distance, 'm');

// Save samples to scratch JSON
fs.writeFileSync('C:/Users/Dell/.gemini/antigravity/brain/d7d4953d-cff7-4e7c-9606-82ddfbdd214a/scratch/osm_circuits_data.json', JSON.stringify({
  eleyele: eleyeleResult,
  akobo: akoboResult,
  akoboSprintFinishIdx: sprintFinishIdx,
}, null, 2));

console.log('Data saved to osm_circuits_data.json');
