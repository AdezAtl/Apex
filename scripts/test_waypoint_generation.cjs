// Script to generate and validate AI waypoint path from track layout
const fs = require('fs');

// The 16 centerline segments covering the 980m Grand Course
const segments = [
  // 1. Main North Straight (130m)
  { start: { x: 0, z: -20 }, end: { x: 0, z: 110 }, type: 'straight' },
  // 2. Turn 1 East Blast (40m)
  { start: { x: 0, z: 110 }, end: { x: 40, z: 110 }, type: 'corner_east' },
  // 3. Turn 2 Infield Drop (40m)
  { start: { x: 40, z: 110 }, end: { x: 40, z: 70 }, type: 'corner_south' },
  // 4. Turn 3 Infield Chicane Mid (40m)
  { start: { x: 40, z: 70 }, end: { x: 80, z: 70 }, type: 'corner_east' },
  // 5. Turn 4 South Descent (50m)
  { start: { x: 80, z: 70 }, end: { x: 80, z: 20 }, type: 'straight' },
  // 6. Turn 5 Carousel Top (30m)
  { start: { x: 80, z: 20 }, end: { x: 50, z: 20 }, type: 'corner_west' },
  // 7. Turn 6 Carousel Drop (30m)
  { start: { x: 50, z: 20 }, end: { x: 50, z: -10 }, type: 'corner_south' },
  // 8. Turn 7 East Shoot (70m)
  { start: { x: 50, z: -10 }, end: { x: 120, z: -10 }, type: 'straight' },
  // 9. Grand Back Straight (140m)
  { start: { x: 120, z: -10 }, end: { x: 120, z: -150 }, type: 'straight' },
  // 10. Turn 9 South Sweeper (50m)
  { start: { x: 120, z: -150 }, end: { x: 70, z: -150 }, type: 'corner_west' },
  // 11. Turn 10 Arena Infield (40m)
  { start: { x: 70, z: -150 }, end: { x: 70, z: -110 }, type: 'corner_north' },
  // 12. Turn 11 Arena Drift Sweeper (60m)
  { start: { x: 70, z: -110 }, end: { x: 10, z: -110 }, type: 'corner_west' },
  // 13. Turn 12 Arena Hairpin (40m)
  { start: { x: 10, z: -110 }, end: { x: 10, z: -150 }, type: 'corner_south' },
  // 14. Turn 13 Outer Link (50m)
  { start: { x: 10, z: -150 }, end: { x: -40, z: -150 }, type: 'straight' },
  // 15. West Return Straight (130m)
  { start: { x: -40, z: -150 }, end: { x: -40, z: -20 }, type: 'straight' },
  // 16. Pit Approach to S/F Straight (40m)
  { start: { x: -40, z: -20 }, end: { x: 0, z: -20 }, type: 'corner_east' },
];

function generateWaypoints(stepDistance = 5.0) {
  const waypoints = [];
  let totalDistance = 0;

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const dx = seg.end.x - seg.start.x;
    const dz = seg.end.z - seg.start.z;
    const segLen = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.max(1, Math.round(segLen / stepDistance));

    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const x = seg.start.x + dx * t;
      const z = seg.start.z + dz * t;
      
      const dirX = dx / segLen;
      const dirZ = dz / segLen;

      waypoints.push({
        index: waypoints.length,
        x: Math.round(x * 100) / 100,
        y: 0.05,
        z: Math.round(z * 100) / 100,
        dirX: Math.round(dirX * 1000) / 1000,
        dirZ: Math.round(dirZ * 1000) / 1000,
        segmentIndex: sIdx,
        targetSpeed: 28.0, // Default nominal speed in m/s
      });
    }
  }

  // Calculate curvature and corner speed for each waypoint
  const n = waypoints.length;
  for (let i = 0; i < n; i++) {
    const prev = waypoints[(i - 1 + n) % n];
    const curr = waypoints[i];
    const next = waypoints[(i + 1) % n];

    // Angle change between incoming and outgoing directions
    const dot = prev.dirX * next.dirX + prev.dirZ * next.dirZ;
    const clampedDot = Math.max(-1, Math.min(1, dot));
    const angleChange = Math.acos(clampedDot);

    curr.angleChange = Math.round(angleChange * 180 / Math.PI);

    // If approaching or in a sharp corner, reduce target speed
    if (curr.angleChange > 30) {
      curr.targetSpeed = 16.0; // Sharp corner: ~58 km/h
    } else if (curr.angleChange > 15) {
      curr.targetSpeed = 22.0; // Moderate bend: ~79 km/h
    } else {
      curr.targetSpeed = 33.0; // Straight: ~118 km/h
    }
  }

  // Propagate braking distances backward so cars brake before corners
  for (let pass = 0; pass < 3; pass++) {
    for (let i = n - 1; i >= 0; i--) {
      const curr = waypoints[i];
      const next = waypoints[(i + 1) % n];
      const maxDecel = 9.0; // comfortable braking in m/s²
      const dist = 5.0; // ~stepDistance
      // v_curr <= sqrt(v_next^2 + 2 * a * d)
      const allowedSpeed = Math.sqrt(next.targetSpeed * next.targetSpeed + 2 * maxDecel * dist);
      curr.targetSpeed = Math.min(curr.targetSpeed, allowedSpeed);
    }
  }

  return waypoints;
}

const wps = generateWaypoints(6.0);
console.log(`Generated ${wps.length} waypoints across Grand Course.`);
console.log(`First waypoint:`, wps[0]);
console.log(`Midfield waypoint:`, wps[Math.floor(wps.length / 2)]);
console.log(`Last waypoint:`, wps[wps.length - 1]);

// Check continuity
let maxDist = 0;
for (let i = 0; i < wps.length; i++) {
  const a = wps[i];
  const b = wps[(i + 1) % wps.length];
  const d = Math.sqrt((b.x - a.x) ** 2 + (b.z - a.z) ** 2);
  if (d > maxDist) maxDist = d;
}
console.log(`Max distance between adjacent waypoints: ${maxDist.toFixed(2)}m (continuous loop)`);
