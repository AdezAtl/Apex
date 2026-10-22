const fs = require('fs');

class Vec2 {
  constructor(x, z) {
    this.x = x;
    this.z = z;
  }
  sub(v) { return new Vec2(this.x - v.x, this.z - v.z); }
  add(v) { return new Vec2(this.x + v.x, this.z + v.z); }
  scale(s) { return new Vec2(this.x * s, this.z * s); }
  length() { return Math.hypot(this.x, this.z); }
  normalize() {
    const l = this.length();
    return l > 1e-6 ? new Vec2(this.x / l, this.z / l) : new Vec2(0, 0);
  }
}

// Centripetal Catmull-Rom spline
function getT(tPrev, pA, pB, alpha = 0.5) {
  const d = Math.hypot(pB.x - pA.x, pB.z - pA.z);
  return tPrev + Math.pow(Math.max(d, 1e-4), alpha);
}

function catmullRomPoint(p0, p1, p2, p3, t) {
  const t0 = 0;
  const t1 = getT(t0, p0, p1);
  const t2 = getT(t1, p1, p2);
  const t3 = getT(t2, p2, p3);
  const tVal = t1 + t * (t2 - t1);

  const a1_x = ((t1 - tVal) * p0.x + (tVal - t0) * p1.x) / (t1 - t0);
  const a1_z = ((t1 - tVal) * p0.z + (tVal - t0) * p1.z) / (t1 - t0);
  const a2_x = ((t2 - tVal) * p1.x + (tVal - t1) * p2.x) / (t2 - t1);
  const a2_z = ((t2 - tVal) * p1.z + (tVal - t1) * p2.z) / (t2 - t1);
  const a3_x = ((t3 - tVal) * p2.x + (tVal - t2) * p3.x) / (t3 - t2);
  const a3_z = ((t3 - tVal) * p2.z + (tVal - t2) * p3.z) / (t3 - t2);

  const b1_x = ((t2 - tVal) * a1_x + (tVal - t0) * a2_x) / (t2 - t0);
  const b1_z = ((t2 - tVal) * a1_z + (tVal - t0) * a2_z) / (t2 - t0);
  const b2_x = ((t3 - tVal) * a2_x + (tVal - t1) * a3_x) / (t3 - t1);
  const b2_z = ((t3 - tVal) * a2_z + (tVal - t1) * a3_z) / (t3 - t1);

  const c_x = ((t2 - tVal) * b1_x + (tVal - t1) * b2_x) / (t2 - t1);
  const c_z = ((t2 - tVal) * b1_z + (tVal - t1) * b2_z) / (t2 - t1);

  return new Vec2(c_x, c_z);
}

// Asphalt Nitro 13-meter Wide Racing Flow Control Points:
const controlPoints = [
  // 1. North Main Straight (strictly X = 0, +Z heading)
  new Vec2(0, -10),
  new Vec2(0, 10),
  new Vec2(0, 45),
  new Vec2(0, 75),

  // 2. Northern Sweeper Carousel (broad, sweeping 50m radius right turn)
  new Vec2(6, 105),
  new Vec2(26, 134),
  new Vec2(62, 146),
  new Vec2(98, 138),
  new Vec2(120, 114),

  // 3. Flowing Infield S-Chicane (progressive transition without angular kinks)
  new Vec2(124, 85),
  new Vec2(112, 60),
  new Vec2(116, 35),
  new Vec2(132, 12),

  // 4. Grand Back Straight (ultra high speed 160+ km/h straightaway)
  new Vec2(142, -15),
  new Vec2(145, -50),
  new Vec2(145, -90),
  new Vec2(138, -128),

  // 5. Broad South Sweeper Carousel
  new Vec2(118, -162),
  new Vec2(82, -178),
  new Vec2(45, -176),
  new Vec2(12, -156),

  // 6. Arena Drift Complex (broad, progressive curve without Z-wiggle)
  new Vec2(-15, -145),
  new Vec2(-32, -135),
  new Vec2(-48, -120),
  new Vec2(-58, -100),

  // 7. West Return Chute
  new Vec2(-56, -80),
  new Vec2(-46, -68),

  // 8. Smooth, progressive final corner into the S/F straight (monotonic Z)
  new Vec2(-30, -58),
  new Vec2(-18, -48),
  new Vec2(-8, -36),
  new Vec2(-2, -22),
];

const N = controlPoints.length;
const SAMPLES_PER_SEGMENT = 60;

// High-res evaluation to calculate initial closed loop length
let rawSamples = [];
for (let i = 0; i < N; i++) {
  const p0 = controlPoints[(i - 1 + N) % N];
  const p1 = controlPoints[i];
  const p2 = controlPoints[(i + 1) % N];
  const p3 = controlPoints[(i + 2) % N];

  for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
    const t = s / SAMPLES_PER_SEGMENT;
    rawSamples.push(catmullRomPoint(p0, p1, p2, p3, t));
  }
}

let initialLen = 0;
for (let i = 0; i < rawSamples.length; i++) {
  const next = rawSamples[(i + 1) % rawSamples.length];
  initialLen += next.sub(rawSamples[i]).length();
}

const targetLength = 980.0;
const scaleFactor = targetLength / initialLen;
console.log(`Initial length: ${initialLen.toFixed(2)}m -> scale factor: ${scaleFactor.toFixed(4)}`);

const scaledCPs = controlPoints.map(p => new Vec2(p.x * scaleFactor, p.z * scaleFactor));

// Sample scaled spline at high resolution
const highResSamples = [];
for (let i = 0; i < N; i++) {
  const p0 = scaledCPs[(i - 1 + N) % N];
  const p1 = scaledCPs[i];
  const p2 = scaledCPs[(i + 1) % N];
  const p3 = scaledCPs[(i + 2) % N];

  for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
    const t = s / SAMPLES_PER_SEGMENT;
    highResSamples.push(catmullRomPoint(p0, p1, p2, p3, t));
  }
}

// Compute cumulative distances
const highResDistances = [0];
let totalLen = 0;
for (let i = 0; i < highResSamples.length; i++) {
  const next = highResSamples[(i + 1) % highResSamples.length];
  totalLen += next.sub(highResSamples[i]).length();
  if (i < highResSamples.length - 1) {
    highResDistances.push(totalLen);
  }
}

console.log(`Scaled total spline length: ${totalLen.toFixed(2)}m`);

// Find the high-res point closest to (0, 0) along the North Straight heading +Z
let sfIndex = 0;
let minSfDist = Infinity;
for (let i = 0; i < highResSamples.length; i++) {
  const p = highResSamples[i];
  const next = highResSamples[(i + 1) % highResSamples.length];
  // Must be heading north (dz > 0) and near X = 0
  if (next.z > p.z && Math.abs(p.x) < 2.0) {
    const d = Math.hypot(p.x, p.z);
    if (d < minSfDist) {
      minSfDist = d;
      sfIndex = i;
    }
  }
}

const sfDist = highResDistances[sfIndex];
console.log(`Start/Finish anchor found at highRes index ${sfIndex}, dist: ${sfDist.toFixed(2)}m`);

// Resample 294 uniformly spaced samples starting from sfDist
const NUM_UNIFORM_SAMPLES = 294;
const stepLen = totalLen / NUM_UNIFORM_SAMPLES;
const uniformSamples = [];

for (let i = 0; i < NUM_UNIFORM_SAMPLES; i++) {
  let targetDist = (sfDist + i * stepLen) % totalLen;
  let idx = 0;
  while (idx < highResDistances.length - 1 && highResDistances[idx + 1] <= targetDist) {
    idx++;
  }
  const nextIdx = (idx + 1) % highResSamples.length;
  const d0 = highResDistances[idx];
  const d1 = idx < highResDistances.length - 1 ? highResDistances[idx + 1] : totalLen;
  const segFraction = (d1 - d0) > 1e-6 ? (targetDist - d0) / (d1 - d0) : 0;

  const pA = highResSamples[idx];
  const pB = highResSamples[nextIdx];
  let pt = new Vec2(
    pA.x + segFraction * (pB.x - pA.x),
    pA.z + segFraction * (pB.z - pA.z)
  );

  // Pin Sample 0 strictly to (0, 0)
  if (i === 0) {
    pt = new Vec2(0, 0);
  }

  uniformSamples.push(pt);
}

// Compute tangents, normals, curvature, and verify max turn angle
let maxCurvDeg = 0;
const enrichedSamples = [];

for (let i = 0; i < NUM_UNIFORM_SAMPLES; i++) {
  const p = uniformSamples[i];
  const prev = uniformSamples[(i - 1 + NUM_UNIFORM_SAMPLES) % NUM_UNIFORM_SAMPLES];
  const next = uniformSamples[(i + 1) % NUM_UNIFORM_SAMPLES];

  let dx = next.x - prev.x;
  let dz = next.z - prev.z;
  let len = Math.hypot(dx, dz);
  let tx = len > 1e-5 ? dx / len : 0;
  let tz = len > 1e-5 ? dz / len : 1;

  if (i === 0) {
    tx = 0;
    tz = 1;
  }

  const nx = tz;
  const nz = -tx;

  const d1x = p.x - prev.x;
  const d1z = p.z - prev.z;
  const l1 = Math.hypot(d1x, d1z);
  const d2x = next.x - p.x;
  const d2z = next.z - p.z;
  const l2 = Math.hypot(d2x, d2z);
  const dot = (d1x * d2x + d1z * d2z) / (l1 * l2);
  const curvDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;
  if (curvDeg > maxCurvDeg) maxCurvDeg = curvDeg;

  enrichedSamples.push({
    x: Number(p.x.toFixed(2)),
    y: 0.05,
    z: Number(p.z.toFixed(2)),
    tx: Number(tx.toFixed(3)),
    tz: Number(tz.toFixed(3)),
    nx: Number(nx.toFixed(3)),
    nz: Number(nz.toFixed(3)),
    dist: Number((i * stepLen).toFixed(2)),
    curvatureDeg: Number(curvDeg.toFixed(2))
  });
}

console.log(`Max sample curvature: ${maxCurvDeg.toFixed(2)} deg`);

// 10 Checkpoints spaced sequentially:
// CP 0: 0.0m (Start/Finish)
// CP 1: 86.7m (Northern entry)
// CP 2: 176.7m (Eastern chute)
// CP 3: 260.0m (Infield descent)
// CP 4: 340.0m (Sprint Finish)
// CP 5: 450.0m (Grand Back Straight launch)
// CP 6: 580.0m (Grand Back Straight braking)
// CP 7: 700.0m (South Carousel exit / Arena Drift entry)
// CP 8: 810.0m (West Return Chute)
// CP 9: 900.0m (West sweeper / approach to S/F)
const gateDistances = [0.0, 86.7, 176.7, 260.0, 340.0, 450.0, 580.0, 700.0, 810.0, 900.0];
const gateNames = [
  'CP_0_START_FINISH',
  'CP_1_NORTH_ENTRY',
  'CP_2_EAST_CHUTE',
  'CP_3_INFIELD_DESCENT',
  'CP_4_CAROUSEL_SHOOT',
  'CP_5_BACK_STRAIGHT_LAUNCH',
  'CP_6_BACK_STRAIGHT_BRAKING',
  'CP_7_ARENA_DRIFT_SWEEPER',
  'CP_8_WEST_STRAIGHT_ENTRY',
  'CP_9_WEST_STRAIGHT_MID'
];

const checkpoints = [];
for (let g = 0; g < 10; g++) {
  const targetD = gateDistances[g];
  const sampleIdx = Math.round(targetD / stepLen) % NUM_UNIFORM_SAMPLES;
  const s = enrichedSamples[sampleIdx];
  checkpoints.push({
    id: gateNames[g],
    order: g,
    sampleIndex: sampleIdx,
    targetDist: targetD,
    position: { x: s.x, y: 0.05, z: s.z },
    direction: { x: s.tx, y: 0, z: s.tz },
    width: 14.8 // 14.8m wide gantry spanning the 13.0m wide road with 0.9m side clearance
  });
}

// Generate SVG Paths
const svgScale = 0.55;
const svgPts = enrichedSamples.map(s => `${(s.x * svgScale).toFixed(1)},${(-s.z * svgScale).toFixed(1)}`);
const fullCircuitSvgPath = `M ${svgPts[0]} ` + svgPts.slice(1).map(p => `L ${p}`).join(' ') + ' Z';

// Sprint path from sample 0 to sample 102 (340m)
const sprintSampleEnd = checkpoints[4].sampleIndex;
const sprintPts = enrichedSamples.slice(0, sprintSampleEnd + 1).map(s => `${(s.x * svgScale).toFixed(1)},${(-s.z * svgScale).toFixed(1)}`);
const sprintSvgPath = `M ${sprintPts[0]} ` + sprintPts.slice(1).map(p => `L ${p}`).join(' ');

// Save circuit samples JSON
const circuitDataOutput = {
  trueLength: 980.0,
  stepLen: Number(stepLen.toFixed(4)),
  scaledControlPoints: scaledCPs.map(p => ({ x: Number(p.x.toFixed(2)), z: Number(p.z.toFixed(2)) })),
  uniformSamples: enrichedSamples,
  checkpoints,
  fullCircuitSvgPath,
  sprintSvgPath,
  sprintFinish: {
    x: Number((checkpoints[4].position.x * svgScale).toFixed(1)),
    y: Number((-checkpoints[4].position.z * svgScale).toFixed(1))
  }
};

fs.writeFileSync('ProjectApex/scripts/circuit_samples.json', JSON.stringify(circuitDataOutput, null, 2));
console.log('circuit_samples.json successfully written!');
