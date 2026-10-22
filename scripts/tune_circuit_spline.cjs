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

// Build control points where Main Straight is strictly on X=0
// Start/Finish line is at (0, 0)
const controlPoints = [
  // S/F Straight (strictly X = 0)
  new Vec2(0, -30),
  new Vec2(0, 0),      // S/F line
  new Vec2(0, 40),
  new Vec2(0, 85),

  // Turn 1-2 Forest Sweeper (flowing curve right)
  new Vec2(10, 118),
  new Vec2(32, 138),
  new Vec2(62, 136),
  new Vec2(84, 116),

  // Infield Flow (gentle S-curve)
  new Vec2(82, 85),
  new Vec2(90, 55),
  new Vec2(112, 30),

  // Grand Back Straight
  new Vec2(130, 8),
  new Vec2(134, -40),
  new Vec2(134, -90),
  new Vec2(128, -132),

  // South Sweeping Turn
  new Vec2(112, -162),
  new Vec2(84, -168),
  new Vec2(64, -145),

  // Arena Drift Complex
  new Vec2(46, -118),
  new Vec2(22, -114),
  new Vec2(-2, -130),
  new Vec2(-25, -156),

  // West Return Straight
  new Vec2(-48, -142),
  new Vec2(-50, -90),
  new Vec2(-48, -40),

  // Final Corner onto S/F straight
  new Vec2(-36, -16),
  new Vec2(-16, -26),
];

// Sample spline at high resolution (1000 points) to compute arc length table
const N = controlPoints.length;
const rawSamples = [];
const SAMPLES_PER_SEGMENT = 40;

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
const rawDistances = [0];
let curDist = 0;
for (let i = 0; i < rawSamples.length; i++) {
  const next = rawSamples[(i + 1) % rawSamples.length];
  curDist += next.sub(rawSamples[i]).length();
  if (i < rawSamples.length - 1) {
    rawDistances.push(curDist);
  }
}
const rawTotalLength = curDist;
console.log(`Raw circuit length: ${rawTotalLength.toFixed(2)} m`);

// Find index corresponding to (0, 0)
let sfIndex = 0;
let minSfDist = Infinity;
for (let i = 0; i < rawSamples.length; i++) {
  const d = Math.hypot(rawSamples[i].x, rawSamples[i].z);
  if (d < minSfDist && Math.abs(rawSamples[i].x) < 0.1 && rawSamples[i].z >= -1 && rawSamples[i].z <= 1) {
    minSfDist = d;
    sfIndex = i;
  }
}
console.log(`SF point closest at index ${sfIndex}, pos: (${rawSamples[sfIndex].x.toFixed(2)}, ${rawSamples[sfIndex].z.toFixed(2)})`);

// We want the circuit length to be EXACTLY 980.00 meters.
// Let's compute scale factor
const targetLength = 980.00;
const scale = targetLength / rawTotalLength;
console.log(`Scale required: ${scale.toFixed(4)}`);

// Scale control points with origin (0, 0)
const scaledControlPoints = controlPoints.map(p => new Vec2(p.x * scale, p.z * scale));

const scaledSamples = [];
for (let i = 0; i < N; i++) {
  const p0 = scaledControlPoints[(i - 1 + N) % N];
  const p1 = scaledControlPoints[i];
  const p2 = scaledControlPoints[(i + 1) % N];
  const p3 = scaledControlPoints[(i + 2) % N];

  for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
    const t = s / SAMPLES_PER_SEGMENT;
    scaledSamples.push(catmullRomPoint(p0, p1, p2, p3, t));
  }
}

// Rotate samples array so that S/F point (0, 0) is at index 0!
let bestSfIdx = 0;
let minD = Infinity;
for (let i = 0; i < scaledSamples.length; i++) {
  const d = Math.hypot(scaledSamples[i].x, scaledSamples[i].z);
  if (d < minD && Math.abs(scaledSamples[i].x) < 0.1) {
    minD = d;
    bestSfIdx = i;
  }
}

const trackSamples = [];
for (let i = 0; i < scaledSamples.length; i++) {
  trackSamples.push(scaledSamples[(i + bestSfIdx) % scaledSamples.length]);
}

// Compute cumulative arc-length from S/F (index 0)
const trackDistances = [0];
let totalFinalLength = 0;
for (let i = 0; i < trackSamples.length; i++) {
  const next = trackSamples[(i + 1) % trackSamples.length];
  const dist = next.sub(trackSamples[i]).length();
  totalFinalLength += dist;
  if (i < trackSamples.length - 1) {
    trackDistances.push(totalFinalLength);
  }
}

console.log(`Final calibrated track length: ${totalFinalLength.toFixed(2)} meters`);
console.log(`Start/finish point: (${trackSamples[0].x.toFixed(3)}, ${trackSamples[0].z.toFixed(3)})`);
console.log(`Tangent at start/finish: (${trackSamples[1].sub(trackSamples[0]).normalize().x.toFixed(3)}, ${trackSamples[1].sub(trackSamples[0]).normalize().z.toFixed(3)})`);

// Function to sample point and direction at distance s along track
function getPointAtDistance(s) {
  s = ((s % totalFinalLength) + totalFinalLength) % totalFinalLength;
  // Binary search or linear search in trackDistances
  let idx = 0;
  for (let i = 0; i < trackDistances.length; i++) {
    if (trackDistances[i] <= s) {
      idx = i;
    } else {
      break;
    }
  }
  const nextIdx = (idx + 1) % trackSamples.length;
  const d0 = trackDistances[idx];
  const d1 = idx === trackDistances.length - 1 ? totalFinalLength : trackDistances[nextIdx];
  const span = d1 - d0;
  const t = span > 1e-4 ? (s - d0) / span : 0;
  const pos = trackSamples[idx].scale(1 - t).add(trackSamples[nextIdx].scale(t));
  const dir = trackSamples[nextIdx].sub(trackSamples[idx]).normalize();
  return { pos, dir };
}

const targetGateDistances = [
  { id: 'CP_0_START_FINISH', order: 0, s: 0.0 },
  { id: 'CP_1_NORTH_ENTRY', order: 1, s: 85.0 },
  { id: 'CP_2_EAST_CHUTE', order: 2, s: 195.0 },
  { id: 'CP_3_INFIELD_DESCENT', order: 3, s: 270.0 },
  { id: 'CP_4_CAROUSEL_SHOOT', order: 4, s: 340.0 },
  { id: 'CP_5_BACK_STRAIGHT_LAUNCH', order: 5, s: 440.0 },
  { id: 'CP_6_BACK_STRAIGHT_BRAKING', order: 6, s: 550.0 },
  { id: 'CP_7_ARENA_DRIFT_SWEEPER', order: 7, s: 660.0 },
  { id: 'CP_8_WEST_STRAIGHT_ENTRY', order: 8, s: 780.0 },
  { id: 'CP_9_WEST_STRAIGHT_MID', order: 9, s: 880.0 },
];

console.log('\n--- Checkpoint Positions & Directions ---');
targetGateDistances.forEach(g => {
  const { pos, dir } = getPointAtDistance(g.s);
  console.log(`{ id: '${g.id}', order: ${g.order}, position: new Vector3(${pos.x.toFixed(2)}, 0.05, ${pos.z.toFixed(2)}), direction: new Vector3(${dir.x.toFixed(3)}, 0, ${dir.z.toFixed(3)}), width: 8.0 },`);
});
