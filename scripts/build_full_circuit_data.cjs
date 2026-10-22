const fs = require('fs');

const moves = [
  { dir: 'N', count: 11, name: 'Main North Straight' },
  { dir: 'E', count: 4, name: 'T1 Sweeper & East Blast' },
  { dir: 'S', count: 4, name: 'T2 & Infield Drop' },
  { dir: 'E', count: 4, name: 'T3 Chicane Entry' },
  { dir: 'S', count: 5, name: 'T4 & South Descent' },
  { dir: 'W', count: 3, name: 'T5 Carousel Entry' },
  { dir: 'S', count: 3, name: 'T6 Carousel Apex' },
  { dir: 'E', count: 7, name: 'T7 & East Shoot' },
  { dir: 'S', count: 14, name: 'T8 & Grand Back Straight' },
  { dir: 'W', count: 5, name: 'T9 South Sweeper' },
  { dir: 'N', count: 4, name: 'T10 Arena Infield' },
  { dir: 'W', count: 6, name: 'T11 Arena Drift Sweeper' },
  { dir: 'S', count: 4, name: 'T12 Arena Hairpin' },
  { dir: 'W', count: 5, name: 'T13 Outer Link' },
  { dir: 'N', count: 13, name: 'T14 West Return Straight' },
  { dir: 'E', count: 4, name: 'T15 Final Sector Link' },
  { dir: 'N', count: 2, name: 'T16 & Pre-Finish' }
];

// Determine tile type (straight vs corner vs finish) and rotation
// For 10m grid:
// Turn rotations:
// Right turns:
// N -> E: Math.PI / 2
// E -> S: Math.PI
// S -> W: 3 * Math.PI / 2
// W -> N: 0
// Left turns:
// N -> W: Math.PI
// W -> S: Math.PI / 2
// S -> E: 0
// E -> N: 3 * Math.PI / 2

// Straight rotations:
// N or S: 0
// E or W: Math.PI / 2

function getTurnRotation(inDir, outDir) {
  if (inDir === 'N' && outDir === 'E') return 'Math.PI / 2';
  if (inDir === 'E' && outDir === 'S') return 'Math.PI';
  if (inDir === 'S' && outDir === 'W') return '(3 * Math.PI) / 2';
  if (inDir === 'W' && outDir === 'N') return '0';

  if (inDir === 'N' && outDir === 'W') return 'Math.PI';
  if (inDir === 'W' && outDir === 'S') return 'Math.PI / 2';
  if (inDir === 'S' && outDir === 'E') return '0';
  if (inDir === 'E' && outDir === 'N') return '(3 * Math.PI) / 2';

  throw new Error(`Invalid turn from ${inDir} to ${outDir}`);
}

function generateTrackSections() {
  const steps = [];
  for (const m of moves) {
    for (let i = 0; i < m.count; i++) {
      steps.push(m.dir);
    }
  }

  const sections = [];
  let curX = 0;
  let curZ = 0;

  for (let i = 0; i < steps.length; i++) {
    const curDir = steps[i];
    const prevDir = steps[(i - 1 + steps.length) % steps.length];
    const nextDir = steps[(i + 1) % steps.length];

    let file = 'track-straight.glb';
    let rot = curDir === 'N' || curDir === 'S' ? '0' : 'Math.PI / 2';

    if (curX === 0 && curZ === 0) {
      file = 'track-finish.glb';
      rot = '0';
    } else if (prevDir !== curDir) {
      file = 'track-corner.glb';
      rot = getTurnRotation(prevDir, curDir);
    }

    sections.push({
      index: i + 1,
      file,
      x: curX,
      z: curZ,
      rotationY: rot,
      curDir,
      isCorner: prevDir !== curDir
    });

    if (curDir === 'N') curZ += 10;
    else if (curDir === 'S') curZ -= 10;
    else if (curDir === 'E') curX += 10;
    else if (curDir === 'W') curX -= 10;
  }

  return sections;
}

const sections = generateTrackSections();
console.log(`Generated ${sections.length} sections.`);
console.log(`Corners count: ${sections.filter(s => s.isCorner).length}`);

let tsOutput = 'const circuitSections: TrackSectionConfig[] = [\n';
for (const s of sections) {
  tsOutput += `  // ${s.index}. ${s.file === 'track-finish.glb' ? 'Start/Finish' : s.isCorner ? 'Corner' : 'Straight'} at (${s.x}, ${s.z})\n`;
  tsOutput += `  { file: '${s.file}', position: new Vector3(${s.x}, 0, ${s.z}), rotationY: ${s.rotationY} },\n`;
}
tsOutput += '];\n';

fs.writeFileSync('scripts/sections_output.ts', tsOutput);
console.log('Written to scripts/sections_output.ts');
