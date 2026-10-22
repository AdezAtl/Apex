const fs = require('fs');

class Vec3 {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  sub(v) { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  add(v) { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  scale(s) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() {
    const l = this.length();
    return l > 1e-6 ? new Vec3(this.x / l, this.y / l, this.z / l) : new Vec3(0, 0, 0);
  }
}

const baseControlPoints = [
  new Vec3(0, 0.05, -35),
  new Vec3(0, 0.05, 0),       // S/F
  new Vec3(0, 0.05, 45),
  new Vec3(0, 0.05, 90),
  new Vec3(8, 0.05, 122),
  new Vec3(32, 0.05, 140),
  new Vec3(65, 0.05, 138),
  new Vec3(88, 0.05, 116),
  new Vec3(84, 0.05, 85),
  new Vec3(92, 0.05, 55),
  new Vec3(115, 0.05, 30),
  new Vec3(132, 0.05, 5),
  new Vec3(135, 0.05, -45),
  new Vec3(135, 0.05, -95),
  new Vec3(128, 0.05, -135),
  new Vec3(112, 0.05, -165),
  new Vec3(82, 0.05, -170),
  new Vec3(62, 0.05, -145),
  new Vec3(44, 0.05, -118),
  new Vec3(20, 0.05, -114),
  new Vec3(-2, 0.05, -130),
  new Vec3(-26, 0.05, -156),
  new Vec3(-48, 0.05, -142),
  new Vec3(-50, 0.05, -90),
  new Vec3(-48, 0.05, -40),
  new Vec3(-35, 0.05, -16),
  new Vec3(-15, 0.05, -28),
  new Vec3(-3, 0.05, -33),
];

const SCALE = 1.040464353561401;
const scaledControlPoints = baseControlPoints.map(p => new Vec3(p.x * SCALE, p.y, p.z * SCALE));

function getT(tPrev, pA, pB, alpha = 0.5) {
  const d = Math.hypot(pB.x - pA.x, pB.z - pA.z);
  return tPrev + Math.pow(Math.max(d, 1e-4), alpha);
}

function catmullRom(p0, p1, p2, p3, t) {
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

  return new Vec3(c_x, 0.05, c_z);
}

const N = scaledControlPoints.length;
const HI_RES = 2800;
const hiSamples = [];
for (let i = 0; i < N; i++) {
  const p0 = scaledControlPoints[(i - 1 + N) % N];
  const p1 = scaledControlPoints[i];
  const p2 = scaledControlPoints[(i + 1) % N];
  const p3 = scaledControlPoints[(i + 2) % N];
  const steps = HI_RES / N;
  for (let s = 0; s < steps; s++) {
    hiSamples.push(catmullRom(p0, p1, p2, p3, s / steps));
  }
}

let bestSf = 0, minD = Infinity;
for (let i = 0; i < hiSamples.length; i++) {
  const d = Math.hypot(hiSamples[i].x, hiSamples[i].z);
  if (d < minD && Math.abs(hiSamples[i].x) < 0.05) {
    minD = d;
    bestSf = i;
  }
}

const rotatedHi = [];
for (let i = 0; i < hiSamples.length; i++) {
  rotatedHi.push(hiSamples[(i + bestSf) % hiSamples.length]);
}

const hiDistances = [0];
let curD = 0;
for (let i = 0; i < rotatedHi.length; i++) {
  const next = rotatedHi[(i + 1) % rotatedHi.length];
  curD += next.sub(rotatedHi[i]).length();
  if (i < rotatedHi.length - 1) hiDistances.push(curD);
}
const trueLength = curD;

const TOTAL_SAMPLES = 294;
const stepLen = trueLength / TOTAL_SAMPLES;
const uniformSamples = [];

for (let sIdx = 0; sIdx < TOTAL_SAMPLES; sIdx++) {
  const targetDist = sIdx * stepLen;
  let lo = 0;
  for (let i = 0; i < hiDistances.length; i++) {
    if (hiDistances[i] <= targetDist) lo = i;
    else break;
  }
  const hi = (lo + 1) % rotatedHi.length;
  const d0 = hiDistances[lo];
  const d1 = lo === hiDistances.length - 1 ? trueLength : hiDistances[hi];
  const t = d1 - d0 > 1e-5 ? (targetDist - d0) / (d1 - d0) : 0;
  const pos = rotatedHi[lo].scale(1 - t).add(rotatedHi[hi].scale(t));
  uniformSamples.push(pos);
}

// Generate SVG Path
// Note: SVG Y = -world.z
const svgPoints = uniformSamples.map(p => `${p.x.toFixed(1)},${(-p.z).toFixed(1)}`);
const fullCircuitSvgPath = `M ${svgPoints[0]} L ${svgPoints.slice(1).join(' ')} Z`;

// Sprint path: from s = 0 to s = 340m (which corresponds to sample 0 to ~102)
const sprintEndSample = Math.round(340.0 / stepLen);
const sprintSvgPoints = uniformSamples.slice(0, sprintEndSample + 1).map(p => `${p.x.toFixed(1)},${(-p.z).toFixed(1)}`);
const sprintSvgPath = `M ${sprintSvgPoints[0]} L ${sprintSvgPoints.slice(1).join(' ')}`;

console.log('Full Circuit SVG Path (first 100 chars):', fullCircuitSvgPath.slice(0, 100));
console.log('Sprint SVG Path (first 100 chars):', sprintSvgPath.slice(0, 100));

fs.writeFileSync('ProjectApex/scripts/circuit_samples.json', JSON.stringify({
  trueLength,
  stepLen,
  scaledControlPoints,
  uniformSamples,
  fullCircuitSvgPath,
  sprintSvgPath,
  sprintFinish: { x: uniformSamples[sprintEndSample].x, y: -uniformSamples[sprintEndSample].z }
}, null, 2));

console.log('circuit_samples.json saved successfully!');
