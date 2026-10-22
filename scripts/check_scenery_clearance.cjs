// Verify scenery tree clearance from track centerline
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('ProjectApex/scripts/circuit_samples.json', 'utf8'));
const samples = data.uniformSamples;

function distToCenterline(pt) {
  let minD = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const s1 = samples[i];
    const s2 = samples[(i + 1) % samples.length];
    // Distance from pt to segment (s1, s2)
    const dx = s2.x - s1.x;
    const dz = s2.z - s1.z;
    const l2 = dx * dx + dz * dz;
    let t = ((pt.x - s1.x) * dx + (pt.z - s1.z) * dz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = s1.x + t * dx;
    const pz = s1.z + t * dz;
    const d = Math.hypot(pt.x - px, pt.z - pz);
    if (d < minD) minD = d;
  }
  return minD;
}

const spruces = [
  { x: -20, z: 135 }, { x: 0, z: 140 }, { x: 20, z: 138 }, { x: 40, z: 142 },
  { x: 60, z: 136 }, { x: 80, z: 140 }, { x: 145, z: 80 }, { x: 150, z: 40 },
  { x: 146, z: 0 }, { x: 148, z: -40 }, { x: 145, z: -80 }, { x: 150, z: -120 },
  { x: 130, z: -175 }, { x: 90, z: -180 }, { x: 50, z: -178 }, { x: 10, z: -182 },
  { x: -30, z: -176 }, { x: -60, z: -180 }, { x: -65, z: -140 }, { x: -68, z: -100 },
  { x: -64, z: -60 }, { x: -66, z: -20 }, { x: -64, z: 20 }, { x: -68, z: 60 },
  { x: 20, z: 30 }, { x: 25, z: 50 }, { x: 15, z: -60 }, { x: 95, z: -80 }
];

console.log('Checking spruces clearance (road width is 8.0m -> road edge is 4.0m):');
spruces.forEach((s, idx) => {
  const d = distToCenterline(s);
  if (d < 5.0) {
    console.log(`Warning: spruce ${idx} at (${s.x}, ${s.z}) is close to road: ${d.toFixed(2)}m`);
  }
});
console.log('Spruces clearance check complete.');
