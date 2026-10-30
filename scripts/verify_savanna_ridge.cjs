const fs = require('fs');

console.log('=== VERIFYING SAVANNA RIDGE CIRCUIT INTEGRATION ===');

// Read the generated SavannaRidgeCircuit.ts to inspect
const tsContent = fs.readFileSync('src/tracks/SavannaRidgeCircuit.ts', 'utf8');

// 1. Verify existence and exports
if (!tsContent.includes('export const SavannaRidgeCircuit: CircuitDefinition')) {
  console.error('FAIL: SavannaRidgeCircuit export not found');
  process.exit(1);
}
console.log('PASS: SavannaRidgeCircuit properly defined and exported.');

// 2. Check TrackRegistry
const registryContent = fs.readFileSync('src/tracks/TrackRegistry.ts', 'utf8');
if (!registryContent.includes('SavannaRidgeCircuit')) {
  console.error('FAIL: SavannaRidgeCircuit not imported in TrackRegistry');
  process.exit(1);
}
if (!registryContent.includes('SavannaRidgeCircuit,') && !registryContent.includes('SavannaRidgeCircuit\n')) {
  console.error('FAIL: SavannaRidgeCircuit not included in ALL_CIRCUITS');
  process.exit(1);
}
console.log('PASS: SavannaRidgeCircuit registered in ALL_CIRCUITS in TrackRegistry.');

// 3. Inspect circuit_samples.json data
const sampleData = JSON.parse(fs.readFileSync('C:/Users/Dell/.gemini/antigravity/brain/cae9d4c6-6024-4167-a66e-403e7553d949/scratch/circuit_samples.json', 'utf8'));
const { totalLength, samples, sprintFinishIdx, sprintFinishDist } = sampleData;

console.log(`\nCircuit Stats:`);
console.log(`- Total Sample Points: ${samples.length}`);
console.log(`- Total Measured Length: ${totalLength.toFixed(1)}m`);
console.log(`- Sprint Stage Finish Sample: Index ${sprintFinishIdx} (${sprintFinishDist.toFixed(1)}m)`);

// 4. Verify Road Width Range
const widths = samples.map(s => s.width);
const minWidth = Math.min(...widths);
const maxWidth = Math.max(...widths);
console.log(`- Road Width Range: ${minWidth.toFixed(2)}m (corners) to ${maxWidth.toFixed(2)}m (straights)`);

if (minWidth < 9.9 || maxWidth > 14.1) {
  console.error(`FAIL: Road width range [${minWidth}, ${maxWidth}] outside intended 10.0m - 14.0m`);
  process.exit(1);
}
console.log('PASS: Dynamic road width is within specified 10.0m - 14.0m bounds.');

// 5. Verify Curvatures
const curvs = samples.map(s => s.curvatureDeg);
const maxCurv = Math.max(...curvs);
const avgCurv = curvs.reduce((a, b) => a + b, 0) / curvs.length;
console.log(`- Curvature: Max = ${maxCurv.toFixed(2)}°, Avg = ${avgCurv.toFixed(2)}°`);

if (maxCurv > 45.0) {
  console.error(`FAIL: Curvature exceeds 45 degrees (${maxCurv.toFixed(2)}°)`);
  process.exit(1);
}
console.log('PASS: Circuit has authentic curves within valid arcade racing limits (max < 45°).');

// 6. Verify Sprint Alignment with GeoJSON
// Real-world GeoJSON way 96662776 length was 2209.8m
const geoDiff = Math.abs(sprintFinishDist - 2209.77);
console.log(`- GeoJSON Road Length Delta: ${geoDiff.toFixed(2)}m difference from real-world OSM data`);
if (geoDiff > 10.0) {
  console.error(`FAIL: Sprint length differs by more than 10m from GeoJSON length`);
  process.exit(1);
}
console.log('PASS: Sprint stage faithfully preserves the 2.21 km GeoJSON road length.');

// 7. Verify Checkpoints & Events
const requiredCheckpoints = [
  'SR_CP_0_START_FINISH',
  'SR_CP_1_EAST_CHUTE',
  'SR_CP_2_HIGHLAND_CURVE',
  'SR_CP_3_FOREST_CHICANE',
  'SR_CP_4_WEST_RIDGE',
  'SR_CP_5_SPRINT_FINISH',
  'SR_CP_6_WEST_OVERLOOK',
  'SR_CP_7_SOUTH_HIGHWAY_WEST',
  'SR_CP_8_SOUTH_HIGHWAY_MID',
  'SR_CP_9_EAST_APPROACH',
  'SR_CP_10_FINAL_SWEEP'
];

requiredCheckpoints.forEach(cp => {
  if (!tsContent.includes(`id: '${cp}'`)) {
    console.error(`FAIL: Missing checkpoint definition for ${cp}`);
    process.exit(1);
  }
});
console.log(`PASS: All 11 timing gantries and sprint checkpoints verified.`);

const requiredEvents = [
  'savanna_sprint_2210m',
  'savanna_grand_circuit_2lap',
  'savanna_drift_sweeper'
];

requiredEvents.forEach(ev => {
  if (!tsContent.includes(`id: '${ev}'`)) {
    console.error(`FAIL: Missing event definition for ${ev}`);
    process.exit(1);
  }
});
console.log(`PASS: Sprint Stage, Grand Circuit, and Drift Challenge events verified.`);

console.log('\n=============================================');
console.log('SAVANNA RIDGE CIRCUIT: ALL VERIFICATION CHECKS PASSED! ✓');
console.log('=============================================');
