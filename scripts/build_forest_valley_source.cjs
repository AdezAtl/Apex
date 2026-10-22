const fs = require('fs');

const circuitData = JSON.parse(fs.readFileSync('ProjectApex/scripts/circuit_samples.json', 'utf8'));
const sceneryData = JSON.parse(fs.readFileSync('ProjectApex/scripts/scenery_positions.json', 'utf8'));

const samples = circuitData.uniformSamples;

// Checkpoint positions from tune_circuit_spline2
const gates = [
  { id: 'CP_0_START_FINISH', order: 0, s: 0.0, pos: { x: 0.0, y: 0.05, z: 0.0 }, dir: { x: 0.0, y: 0, z: 1.0 } },
  { id: 'CP_1_NORTH_ENTRY', order: 1, s: 85.0, pos: { x: -0.66, y: 0.05, z: 84.99 }, dir: { x: 0.040, y: 0, z: 0.999 } },
  { id: 'CP_2_EAST_CHUTE', order: 2, s: 195.0, pos: { x: 67.54, y: 0.05, z: 143.62 }, dir: { x: 0.920, y: 0, z: -0.392 } },
  { id: 'CP_3_INFIELD_DESCENT', order: 3, s: 270.0, pos: { x: 88.28, y: 0.05, z: 80.37 }, dir: { x: 0.151, y: 0, z: -0.989 } },
  { id: 'CP_4_CAROUSEL_SHOOT', order: 4, s: 340.0, pos: { x: 126.12, y: 0.05, z: 23.45 }, dir: { x: 0.642, y: 0, z: -0.767 } },
  { id: 'CP_5_BACK_STRAIGHT_LAUNCH', order: 5, s: 440.0, pos: { x: 141.19, y: 0.05, z: -72.93 }, dir: { x: 0.014, y: 0, z: -1.0 } },
  { id: 'CP_6_BACK_STRAIGHT_BRAKING', order: 6, s: 550.0, pos: { x: 111.48, y: 0.05, z: -174.54 }, dir: { x: -0.913, y: 0, z: -0.408 } },
  { id: 'CP_7_ARENA_DRIFT_SWEEPER', order: 7, s: 660.0, pos: { x: 31.35, y: 0.05, z: -118.02 }, dir: { x: -0.995, y: 0, z: 0.095 } },
  { id: 'CP_8_WEST_STRAIGHT_ENTRY', order: 8, s: 780.0, pos: { x: -53.38, y: 0.05, z: -133.27 }, dir: { x: -0.054, y: 0, z: 0.999 } },
  { id: 'CP_9_WEST_STRAIGHT_MID', order: 9, s: 880.0, pos: { x: -47.57, y: 0.05, z: -33.86 }, dir: { x: 0.325, y: 0, z: 0.946 } },
];

console.log(`Samples count: ${samples.length}`);
console.log(`True length: ${circuitData.trueLength}`);
