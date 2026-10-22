// Circuit Layout Validator
// Tests grid connectivity, turn directions, loop closure, and total length.

function validateCircuit(sections) {
  console.log(`Total sections: ${sections.length}`);
  let totalLength = 0;
  const occupiedTiles = new Map();
  let errors = [];

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    const key = `${s.x},${s.z}`;
    if (occupiedTiles.has(key)) {
      errors.push(`Overlap at ${key} between section ${occupiedTiles.get(key)} and ${i}`);
    } else {
      occupiedTiles.set(key, i);
    }

    // Check step to next section
    const next = sections[(i + 1) % sections.length];
    const dx = next.x - s.x;
    const dz = next.z - s.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (Math.abs(dist - 10) > 0.001) {
      errors.push(`Discontinuity between section ${i} (${s.x},${s.z}) and section ${(i + 1) % sections.length} (${next.x},${next.z}): dist = ${dist}`);
    }
    totalLength += 10;
  }

  console.log(`Total track length: ${totalLength} meters`);
  if (errors.length > 0) {
    console.error('Validation errors:', errors);
    return false;
  } else {
    console.log('SUCCESS: Circuit is perfectly continuous, non-overlapping, and closed!');
    return true;
  }
}

// Let's test our planned layout:
// Grid steps: dx, dz are in { (+10, 0), (-10, 0), (0, +10), (0, -10) }

function buildTrackFromSegments(moves) {
  let curX = 0;
  let curZ = 0;
  const sections = [];

  for (const move of moves) {
    const { dir, count, type, name } = move;
    for (let c = 0; c < count; c++) {
      sections.push({ x: curX, z: curZ, dir, name });
      if (dir === 'N') curZ += 10;
      else if (dir === 'S') curZ -= 10;
      else if (dir === 'E') curX += 10;
      else if (dir === 'W') curX -= 10;
    }
  }
  return sections;
}

// Design: A grand 920m - 1050m racing circuit:
// 1. Main Straight: 110m North (X=0, Z=0 to 100)
// 2. T1 Right: turn East (X=0, Z=110)
// 3. Short East: 30m East (X=10 to 30, Z=110)
// 4. T2 Right: turn South (X=40, Z=110)
// 5. Infield Drop: 30m South (X=40, Z=100 to 80)
// 6. T3 Left: turn East (X=40, Z=70)
// 7. Mid East: 30m East (X=50 to 70, Z=70)
// 8. T4 Right: turn South (X=80, Z=70)
// 9. South Drop: 40m South (X=80, Z=60 to 30)
// 10. T5 Right: turn West (X=80, Z=20)
// 11. Short West: 20m West (X=70 to 60, Z=20)
// 12. T6 Left: turn South (X=50, Z=20)
// 13. Drop: 20m South (X=50, Z=10 to 0)
// 14. T7 Left: turn East (X=50, Z=-10)
// 15. East Shoot: 60m East (X=60 to 110, Z=-10)
// 16. T8 Right: turn South (X=120, Z=-10)
// 17. The Grand Back Straight: 130m South (X=120, Z=-20 to -140)
// 18. T9 Right: turn West (X=120, Z=-150)
// 19. South Bottom: 40m West (X=110 to 80, Z=-150)
// 20. T10 Right: turn North (X=70, Z=-150)
// 21. North Shoot: 30m North (X=70, Z=-140 to -120)
// 22. T11 Left: turn West (X=70, Z=-110)
// 23. Mid West Drift Sweeper: 50m West (X=60 to 20, Z=-110)
// 24. T12 Left: turn South (X=10, Z=-110)
// 25. South Return: 30m South (X=10, Z=-120 to -140)
// 26. T13 Right: turn West (X=10, Z=-150)
// 27. Far West Run: 40m West (X=0 to -30, Z=-150)
// 28. T14 Right: turn North (X=-40, Z=-150)
// 29. The West Return Straight: 120m North (X=-40, Z=-140 to -30)
// 30. T15 Right: turn East (X=-40, Z=-20)
// 31. Pit Approach: 30m East (X=-30 to -10, Z=-20)
// 32. T16 Left: turn North (X=0, Z=-20)
// 33. Pre-finish: 10m North (X=0, Z=-10)
// Connects back to Start/Finish at (X=0, Z=0)!

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

const totalMoves = moves.reduce((sum, m) => sum + m.count, 0);
console.log(`Total planned tiles: ${totalMoves} (${totalMoves * 10} meters)`);

const sections = buildTrackFromSegments(moves);
const ok = validateCircuit(sections);
console.log(`Final section lands at (${sections[sections.length - 1].x}, ${sections[sections.length - 1].z}), next is (0,0)`);
