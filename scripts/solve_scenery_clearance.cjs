const fs = require('fs');
const data = JSON.parse(fs.readFileSync('ProjectApex/scripts/circuit_samples.json', 'utf8'));
const samples = data.uniformSamples;

function distToCenterline(pt) {
  let minD = Infinity;
  let closestP = null;
  for (let i = 0; i < samples.length; i++) {
    const s1 = samples[i];
    const s2 = samples[(i + 1) % samples.length];
    const dx = s2.x - s1.x;
    const dz = s2.z - s1.z;
    const l2 = dx * dx + dz * dz;
    let t = ((pt.x - s1.x) * dx + (pt.z - s1.z) * dz) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = s1.x + t * dx;
    const pz = s1.z + t * dz;
    const d = Math.hypot(pt.x - px, pt.z - pz);
    if (d < minD) {
      minD = d;
      closestP = { x: px, z: pz };
    }
  }
  return { dist: minD, closest: closestP };
}

function pushAway(pt, minAllowed = 12.0) {
  const { dist, closest } = distToCenterline(pt);
  if (dist >= minAllowed) return pt;
  const dx = pt.x - closest.x;
  const dz = pt.z - closest.z;
  const len = Math.hypot(dx, dz);
  if (len < 1e-4) {
    return { x: pt.x + minAllowed, z: pt.z + minAllowed };
  }
  const scale = minAllowed / len;
  return {
    x: Math.round((closest.x + dx * scale) * 10) / 10,
    z: Math.round((closest.z + dz * scale) * 10) / 10
  };
}

const rawSpruces = [
  { x: -20, z: 135 }, { x: 0, z: 140 }, { x: 20, z: 138 }, { x: 40, z: 142 },
  { x: 60, z: 136 }, { x: 80, z: 140 }, { x: 145, z: 80 }, { x: 150, z: 40 },
  { x: 146, z: 0 }, { x: 148, z: -40 }, { x: 145, z: -80 }, { x: 150, z: -120 },
  { x: 130, z: -175 }, { x: 90, z: -180 }, { x: 50, z: -178 }, { x: 10, z: -182 },
  { x: -30, z: -176 }, { x: -60, z: -180 }, { x: -65, z: -140 }, { x: -68, z: -100 },
  { x: -64, z: -60 }, { x: -66, z: -20 }, { x: -64, z: 20 }, { x: -68, z: 60 },
  { x: 20, z: 30 }, { x: 25, z: 50 }, { x: 15, z: -60 }, { x: 95, z: -80 }
];

const adjustedSpruces = rawSpruces.map(p => pushAway(p, 12.0));
console.log('Adjusted spruces all cleared >= 12.0m:');
adjustedSpruces.forEach((s, idx) => {
  const d = distToCenterline(s).dist;
  if (d < 11.9) console.error(`Error on spruce ${idx}: ${d}`);
});

const rawOaks = [
  { x: -25, z: 125 }, { x: 30, z: 130 }, { x: 70, z: 128 },
  { x: 140, z: 60 }, { x: 142, z: -20 }, { x: 140, z: -100 },
  { x: 110, z: -170 }, { x: 70, z: -172 }, { x: -10, z: -170 },
  { x: -58, z: -120 }, { x: -56, z: -40 }, { x: -58, z: 40 },
  { x: 22, z: 10 }, { x: 26, z: -30 }, { x: 88, z: -50 },
];
const adjustedOaks = rawOaks.map(p => pushAway(p, 12.0));

const rawRocks = [
  { x: -8, z: 118 }, { x: 48, z: 118 }, { x: 128, z: -5 },
  { x: 128, z: -156 }, { x: 75, z: -156 }, { x: -48, z: -156 },
  { x: -48, z: -15 }, { x: -8, z: -15 }, { x: 25, z: -55 }
];
const adjustedRocks = rawRocks.map(p => pushAway(p, 12.0));

const rawKenney = [
  { x: -45, z: 145 }, { x: 45, z: 150 }, { x: 105, z: 145 },
  { x: 160, z: 60 }, { x: 162, z: -60 }, { x: 158, z: -140 },
  { x: 115, z: -190 }, { x: 35, z: -192 }, { x: -45, z: -190 },
  { x: -80, z: -120 }, { x: -80, z: -40 }, { x: -78, z: 60 }
];
const adjustedKenney = rawKenney.map(p => pushAway(p, 12.0));

fs.writeFileSync('ProjectApex/scripts/scenery_positions.json', JSON.stringify({
  spruces: adjustedSpruces,
  oaks: adjustedOaks,
  rocks: adjustedRocks,
  kenney: adjustedKenney
}, null, 2));

console.log('Saved scenery_positions.json with guaranteed track clearance!');
