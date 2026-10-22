// Prototype for RoadMeshBuilder geometry & UV math
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
    return l > 0.0001 ? new Vec3(this.x / l, this.y / l, this.z / l) : new Vec3(0, 0, 0);
  }
}

// Catmull-Rom spline with closed loop
function sampleCatmullRom(points, numSamples) {
  const N = points.length;
  const samples = [];
  
  function getT(tPrev, pA, pB) {
    const d = Math.hypot(pB.x - pA.x, pB.z - pA.z);
    return tPrev + Math.pow(Math.max(d, 0.0001), 0.5);
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

    return new Vec3(c_x, 0.05, c_z);
  }

  for (let i = 0; i < N; i++) {
    const p0 = points[(i - 1 + N) % N];
    const p1 = points[i];
    const p2 = points[(i + 1) % N];
    const p3 = points[(i + 2) % N];
    const steps = Math.round(numSamples / N);
    for (let s = 0; s < steps; s++) {
      samples.push(catmullRomPoint(p0, p1, p2, p3, s / steps));
    }
  }

  return samples;
}

// Generate mesh buffers for road ribbon
function generateRoadRibbon(samples, roadWidth = 8.0, tileLength = 8.0) {
  const n = samples.length;
  // Compute cumulative distances
  const distances = [0];
  for (let i = 0; i < n; i++) {
    const next = samples[(i + 1) % n];
    const segDist = next.sub(samples[i]).length();
    if (i < n - 1) {
      distances.push(distances[i] + segDist);
    }
  }
  const totalLength = distances[distances.length - 1] + samples[0].sub(samples[n - 1]).length();

  const halfW = roadWidth / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // For each cross section, we produce 3 vertices: Left, Center, Right
  // (or 2: Left, Right)
  for (let i = 0; i < n; i++) {
    const prev = samples[(i - 1 + n) % n];
    const curr = samples[i];
    const next = samples[(i + 1) % n];

    // Tangent along centerline in XZ plane
    const tangent = next.sub(prev).normalize();
    // Normal perpendicular to tangent pointing right: (tangent.z, 0, -tangent.x)
    const normal = new Vec3(tangent.z, 0, -tangent.x);

    const left = curr.sub(normal.scale(halfW));
    const center = curr;
    const right = curr.add(normal.scale(halfW));

    const dist = distances[i];
    const v = dist / tileLength;

    // Left vertex: index = i * 3 + 0
    positions.push(left.x, left.y, left.z);
    normals.push(0, 1, 0);
    uvs.push(0.0, v);

    // Center vertex: index = i * 3 + 1
    positions.push(center.x, center.y, center.z);
    normals.push(0, 1, 0);
    uvs.push(0.5, v);

    // Right vertex: index = i * 3 + 2
    positions.push(right.x, right.y, right.z);
    normals.push(0, 1, 0);
    uvs.push(1.0, v);
  }

  // Indices for quads: between row i and row (i+1)%n
  for (let i = 0; i < n; i++) {
    const r0 = i * 3;
    const r1 = ((i + 1) % n) * 3;

    // Left quad: (r0, r0+1, r1+1) and (r0, r1+1, r1)
    indices.push(r0, r1, r1 + 1);
    indices.push(r0, r1 + 1, r0 + 1);

    // Right quad: (r0+1, r0+2, r1+2) and (r0+1, r1+2, r1+1)
    indices.push(r0 + 1, r1 + 1, r1 + 2);
    indices.push(r0 + 1, r1 + 2, r0 + 2);
  }

  return {
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
    totalLength
  };
}

const testCPs = [
  new Vec3(0, 0.05, -30),
  new Vec3(0, 0.05, 10),
  new Vec3(0, 0.05, 50),
  new Vec3(0, 0.05, 95),
  new Vec3(8, 0.05, 125),
  new Vec3(30, 0.05, 142),
  new Vec3(62, 0.05, 140),
  new Vec3(85, 0.05, 118),
  new Vec3(82, 0.05, 85),
  new Vec3(92, 0.05, 55),
  new Vec3(115, 0.05, 30),
  new Vec3(132, 0.05, 5),
  new Vec3(135, 0.05, -45),
  new Vec3(135, 0.05, -95),
  new Vec3(130, 0.05, -135),
  new Vec3(115, 0.05, -165),
  new Vec3(85, 0.05, -170),
  new Vec3(65, 0.05, -145),
  new Vec3(45, 0.05, -115),
  new Vec3(20, 0.05, -112),
  new Vec3(-5, 0.05, -130),
  new Vec3(-28, 0.05, -155),
  new Vec3(-48, 0.05, -140),
  new Vec3(-50, 0.05, -90),
  new Vec3(-48, 0.05, -40),
  new Vec3(-38, 0.05, -15),
  new Vec3(-18, 0.05, -26),
];

const samples = sampleCatmullRom(testCPs, 300);
const mesh = generateRoadRibbon(samples, 8.0, 8.0);
console.log('Road ribbon generated successfully:', mesh);
