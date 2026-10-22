// Test and optimize the spline circuit control points
const fs = require('fs');

class Vector2 {
  constructor(x, z) {
    this.x = x;
    this.z = z;
  }
  add(v) { return new Vector2(this.x + v.x, this.z + v.z); }
  sub(v) { return new Vector2(this.x - v.x, this.z - v.z); }
  scale(s) { return new Vector2(this.x * s, this.z * s); }
  length() { return Math.hypot(this.x, this.z); }
  normalize() {
    const l = this.length();
    return l > 0.0001 ? new Vector2(this.x / l, this.z / l) : new Vector2(0, 0);
  }
}

// Catmull-Rom spline interpolation (centripetal or standard alpha=0.5)
function catmullRom(p0, p1, p2, p3, t, alpha = 0.5) {
  function getT(tPrev, pA, pB) {
    const d = Math.hypot(pB.x - pA.x, pB.z - pA.z);
    return tPrev + Math.pow(Math.max(d, 0.0001), alpha);
  }

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

  return new Vector2(c_x, c_z);
}

// Candidate control points for a 980m flowing motorsport circuit:
// 1. Start/Finish Straight: runs along X=0 from Z=-20 to Z=100
// 2. Turn 1-2: Broad flowing right sweeper swinging towards X=60, Z=120
// 3. Technical Infield: flowing transition through X=85, Z=70
// 4. Back Straight: high-speed straight from X=130, Z=10 down to X=130, Z=-130
// 5. Heavy Braking & Chicane: X=110, Z=-155 -> X=70, Z=-145
// 6. Arena Carousel / Drift Sweeper: X=40, Z=-110 -> X=-10, Z=-135
// 7. West Straight / Return Chute: X=-45, Z=-110 -> X=-45, Z=-10
// 8. Pit entry sweeper back to S/F: X=-20, Z=-20 -> X=0, Z=-20

const rawControlPoints = [
  // S/F Main Straight (straight line along X=0)
  new Vector2(0, -30),
  new Vector2(0, 10),
  new Vector2(0, 50),
  new Vector2(0, 95),

  // Turn 1-2: Broad Forest Sweeper
  new Vector2(8, 125),
  new Vector2(30, 142),
  new Vector2(62, 140),
  new Vector2(85, 118),

  // Midfield Infield Flow (gentle S-curve)
  new Vector2(82, 85),
  new Vector2(92, 55),
  new Vector2(115, 30),

  // Launch onto Grand Back Straight
  new Vector2(132, 5),
  new Vector2(135, -45),
  new Vector2(135, -95),
  new Vector2(130, -135),

  // South Braking & Sweeping Chicane
  new Vector2(115, -165),
  new Vector2(85, -170),
  new Vector2(65, -145),

  // Arena Drift Carousel
  new Vector2(45, -115),
  new Vector2(20, -112),
  new Vector2(-5, -130),
  new Vector2(-28, -155),

  // West Return Straight
  new Vector2(-48, -140),
  new Vector2(-50, -90),
  new Vector2(-48, -40),

  // Final Corner (Club Chicane) swinging onto S/F straight
  new Vector2(-38, -15),
  new Vector2(-18, -26),
];

console.log('Number of control points:', rawControlPoints.length);

// Sample spline with N points
const NUM_SAMPLES = 400;
const sampledPoints = [];
const N = rawControlPoints.length;

for (let i = 0; i < N; i++) {
  const p0 = rawControlPoints[(i - 1 + N) % N];
  const p1 = rawControlPoints[i];
  const p2 = rawControlPoints[(i + 1) % N];
  const p3 = rawControlPoints[(i + 2) % N];

  const stepsPerSeg = Math.round(NUM_SAMPLES / N);
  for (let s = 0; s < stepsPerSeg; s++) {
    const t = s / stepsPerSeg;
    sampledPoints.push(catmullRom(p0, p1, p2, p3, t));
  }
}

// Compute total length
let totalLength = 0;
for (let i = 0; i < sampledPoints.length; i++) {
  const next = sampledPoints[(i + 1) % sampledPoints.length];
  totalLength += next.sub(sampledPoints[i]).length();
}
console.log(`Original total circuit length: ${totalLength.toFixed(2)} meters`);

// Scale factor to tune exactly to 980.0m
const targetLength = 980.0;
const scaleFactor = targetLength / totalLength;
console.log(`Scale factor for 980m: ${scaleFactor.toFixed(4)}`);

// Rescale control points around track center
let avgX = 0, avgZ = 0;
for (const cp of rawControlPoints) {
  avgX += cp.x;
  avgZ += cp.z;
}
avgX /= rawControlPoints.length;
avgZ /= rawControlPoints.length;

const scaledPoints = rawControlPoints.map(p => {
  return new Vector2(
    avgX + (p.x - avgX) * scaleFactor,
    avgZ + (p.z - avgZ) * scaleFactor
  );
});

// Resample scaled points
const scaledSamples = [];
for (let i = 0; i < N; i++) {
  const p0 = scaledPoints[(i - 1 + N) % N];
  const p1 = scaledPoints[i];
  const p2 = scaledPoints[(i + 1) % N];
  const p3 = scaledPoints[(i + 2) % N];

  const stepsPerSeg = Math.round(NUM_SAMPLES / N);
  for (let s = 0; s < stepsPerSeg; s++) {
    const t = s / stepsPerSeg;
    scaledSamples.push(catmullRom(p0, p1, p2, p3, t));
  }
}

let scaledLength = 0;
for (let i = 0; i < scaledSamples.length; i++) {
  const next = scaledSamples[(i + 1) % scaledSamples.length];
  scaledLength += next.sub(scaledSamples[i]).length();
}
console.log(`Scaled circuit length: ${scaledLength.toFixed(2)} meters`);

// Check maximum curvature (angle change per meter)
let maxCurvatureDeg = 0;
let avgCurvatureDeg = 0;
for (let i = 0; i < scaledSamples.length; i++) {
  const prev = scaledSamples[(i - 1 + scaledSamples.length) % scaledSamples.length];
  const curr = scaledSamples[i];
  const next = scaledSamples[(i + 1) % scaledSamples.length];

  const d1 = curr.sub(prev).normalize();
  const d2 = next.sub(curr).normalize();
  const dot = Math.max(-1, Math.min(1, d1.x * d2.x + d1.z * d2.z));
  const angleDeg = (Math.acos(dot) * 180) / Math.PI;

  if (angleDeg > maxCurvatureDeg) maxCurvatureDeg = angleDeg;
  avgCurvatureDeg += angleDeg;
}
avgCurvatureDeg /= scaledSamples.length;
console.log(`Max sample curvature: ${maxCurvatureDeg.toFixed(2)} deg, Avg: ${avgCurvatureDeg.toFixed(2)} deg`);

