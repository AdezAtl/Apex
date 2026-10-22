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

// Asphalt Nitro arcade flow:
// 1. Long, wide North Main Straight (strictly X = 0 from Z = -25 to Z = 80)
// 2. High-speed sweeping Northern Turn 1-2 Carousel (R ~ 55m)
// 3. Flowing East Infield Chute (progressive S-chicane)
// 4. Grand Back Straight (X ~ 140, Z = 15 down to -125, ultra high speed)
// 5. Broad South Sweeper (flowing curve from East to West)
// 6. Arena Drift Carousel (sweeping 180 curve with wide runoff)
// 7. West Return Straight (X ~ -55, Z = -135 to -50)
// 8. Smooth final sweeping turn into the North Main Straight without any sharp kink
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

console.log('Testing raw spline with', controlPoints.length, 'control points...');

// High-resolution sampling to compute arc lengths
const N = controlPoints.length;
const rawSamples = [];
const SAMPLES_PER_SEGMENT = 50;

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

// Compute cumulative distance
let curDist = 0;
const rawDistances = [0];
for (let i = 0; i < rawSamples.length; i++) {
  const next = rawSamples[(i + 1) % rawSamples.length];
  curDist += next.sub(rawSamples[i]).length();
  if (i < rawSamples.length - 1) {
    rawDistances.push(curDist);
  }
}

console.log('Raw closed-loop spline length:', curDist.toFixed(2), 'm');

// Find scale factor to make it exactly 980.0m
const targetLength = 980.0;
const scaleFactor = targetLength / curDist;
console.log('Scale factor needed:', scaleFactor.toFixed(4));

// Scale control points relative to origin (preserving X=0 on main straight)
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

const highResDistances = [0];
let totalLen = 0;
for (let i = 0; i < highResSamples.length; i++) {
  const next = highResSamples[(i + 1) % highResSamples.length];
  totalLen += next.sub(highResSamples[i]).length();
  if (i < highResSamples.length - 1) {
    highResDistances.push(totalLen);
  }
}

// Resample into 294 uniformly spaced samples
const NUM_UNIFORM_SAMPLES = 294;
const stepLen = totalLen / NUM_UNIFORM_SAMPLES;
const uniformPoints = [];

for (let i = 0; i < NUM_UNIFORM_SAMPLES; i++) {
  const targetDist = i * stepLen;
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
  uniformPoints.push(new Vec2(
    pA.x + segFraction * (pB.x - pA.x),
    pA.z + segFraction * (pB.z - pA.z)
  ));
}

// Compute curvature angles between adjacent uniform samples
let maxDeg = 0;
let sharpCount = 0;
for (let i = 0; i < uniformPoints.length; i++) {
  const p0 = uniformPoints[(i - 1 + uniformPoints.length) % uniformPoints.length];
  const p1 = uniformPoints[i];
  const p2 = uniformPoints[(i + 1) % uniformPoints.length];

  const v1 = p1.sub(p0);
  const v2 = p2.sub(p1);
  const a1 = Math.atan2(v1.x, v1.z);
  const a2 = Math.atan2(v2.x, v2.z);
  let diff = a2 - a1;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const deg = Math.abs(diff * 180 / Math.PI);
  if (deg > maxDeg) maxDeg = deg;
  if (deg > 10) {
    sharpCount++;
    console.log(`Sample ${i} has sharp turn: ${deg.toFixed(1)} deg at (${p1.x.toFixed(1)}, ${p1.z.toFixed(1)})`);
  }
}

console.log('Total circuit length:', totalLen.toFixed(2), 'm');
console.log('Max turn angle between 3.3m samples:', maxDeg.toFixed(2), 'deg');
console.log('Samples > 10 deg:', sharpCount);
