import { Vector3 } from '@babylonjs/core';
import { CircuitDefinition, CenterlineSegment } from '../tracks/TrackConfig';
import { ForestValleyCircuit } from '../tracks/ForestValleyCircuit';

export interface Waypoint {
  index: number;
  position: Vector3;
  direction: Vector3; // Unit vector pointing along track direction (+Z forward on main straight)
  normal: Vector3;    // Unit vector pointing track-right (+X right on main straight)
  distanceAlongTrack: number; // Cumulative distance from start/finish line in meters
  targetSpeed: number; // Corner-informed nominal target speed in m/s
  curvatureDeg: number; // Corner curvature in degrees
  segmentIndex: number;
}

export interface LookaheadTarget {
  targetPoint: Vector3;
  targetSpeed: number;
  distanceAlongTrack: number;
  curvatureDeg: number;
}

export class WaypointManager {
  public static readonly TRACK_LENGTH: number = 980.0;
  public static readonly SF_POSITION: Vector3 = new Vector3(0, 0.05, -2.0);

  public trackLength: number = 980.0;
  public waypoints: Waypoint[] = [];
  public totalWaypoints: number = 0;

  constructor(stepDistance: number = 5.5) {
    this.setCircuit(ForestValleyCircuit, stepDistance);
  }

  /**
   * Configures waypoints, distance scale, curvature, and braking zones for the chosen circuit.
   */
  public setCircuit(circuit: CircuitDefinition, stepDistance: number = 5.5): void {
    this.trackLength = circuit.measuredLengthMeters;
    this.generateWaypoints(circuit.centerlineSegments, this.trackLength, stepDistance);
  }

  private generateWaypoints(
    rawSegments: CenterlineSegment[],
    trackLength: number,
    stepDistance: number
  ): void {
    this.waypoints = [];
    this.trackLength = trackLength;
    let currentDistance = 0;

    for (let sIdx = 0; sIdx < rawSegments.length; sIdx++) {
      const seg = rawSegments[sIdx];
      const delta = seg.end.subtract(seg.start);
      delta.y = 0;
      const segLen = delta.length();
      if (segLen <= 0.001) continue;

      const dir = delta.scale(1.0 / segLen);
      // Right normal in XZ plane: (dir.z, 0, -dir.x)
      const norm = new Vector3(dir.z, 0, -dir.x);

      const steps = Math.max(1, Math.round(segLen / stepDistance));
      const stepLength = segLen / steps;

      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const pos = seg.start.add(delta.scale(t));
        const dist = currentDistance + s * stepLength;

        this.waypoints.push({
          index: this.waypoints.length,
          position: pos,
          direction: dir,
          normal: norm,
          distanceAlongTrack: dist,
          targetSpeed: 32.0, // Default base speed m/s (~115 km/h)
          curvatureDeg: 0,
          segmentIndex: seg.id,
        });
      }

      currentDistance += segLen;
    }

    this.totalWaypoints = this.waypoints.length;

    // Compute curvature and corner speeds
    const n = this.totalWaypoints;
    for (let i = 0; i < n; i++) {
      const prev = this.waypoints[(i - 1 + n) % n];
      const curr = this.waypoints[i];
      const next = this.waypoints[(i + 1) % n];

      // Dot product between directions
      const dot = Math.max(-1, Math.min(1, Vector3.Dot(prev.direction, next.direction)));
      const angleRad = Math.acos(dot);
      const angleDeg = (angleRad * 180) / Math.PI;

      curr.curvatureDeg = angleDeg;

      // Assign speed limit according to corner sharpness
      if (angleDeg > 35) {
        curr.targetSpeed = 15.0; // Hairpin / 90° corner apex (~54 km/h)
      } else if (angleDeg > 18) {
        curr.targetSpeed = 20.0; // Medium-radius curve apex (~72 km/h)
      } else if (angleDeg > 8) {
        curr.targetSpeed = 26.0; // Fast sweeper (~94 km/h)
      } else {
        curr.targetSpeed = 33.0; // Full throttle straight (~119 km/h)
      }
    }

    // Backward propagation pass: generate realistic braking zones before corners
    const nominalDecel = 8.5; // m/s^2 deceleration
    for (let pass = 0; pass < 3; pass++) {
      for (let i = n - 1; i >= 0; i--) {
        const curr = this.waypoints[i];
        const next = this.waypoints[(i + 1) % n];
        const d = Vector3.Distance(curr.position, next.position);
        const allowedSpeed = Math.sqrt(next.targetSpeed * next.targetSpeed + 2 * nominalDecel * d);
        curr.targetSpeed = Math.min(curr.targetSpeed, allowedSpeed);
      }
    }
  }

  /**
   * Finds the closest waypoint to an arbitrary world position.
   */
  public findClosestWaypoint(pos: Vector3): Waypoint {
    let bestDistSq = Infinity;
    let bestWp = this.waypoints[0];

    for (let i = 0; i < this.totalWaypoints; i++) {
      const wp = this.waypoints[i];
      const dx = wp.position.x - pos.x;
      const dz = wp.position.z - pos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestWp = wp;
      }
    }

    return bestWp;
  }

  /**
   * Calculates continuous distance along track (0..trackLength) for a given vehicle position.
   */
  public getTrackDistance(pos: Vector3): number {
    const closest = this.findClosestWaypoint(pos);
    const next = this.waypoints[(closest.index + 1) % this.totalWaypoints];

    // Project onto segment (closest -> next)
    const segDir = next.position.subtract(closest.position);
    segDir.y = 0;
    const segLen = segDir.length();
    if (segLen < 0.001) return closest.distanceAlongTrack;

    const toPos = pos.subtract(closest.position);
    toPos.y = 0;
    const proj = Math.max(0, Math.min(segLen, Vector3.Dot(toPos, segDir) / segLen));

    let dist = closest.distanceAlongTrack + proj;
    if (dist >= this.trackLength) {
      dist -= this.trackLength;
    }
    return dist;
  }

  /**
   * Calculates cumulative race progress distance (including completed laps).
   */
  public getProgressDistance(pos: Vector3, lap: number): number {
    const trackDist = this.getTrackDistance(pos);
    return Math.max(0, (lap - 1) * this.trackLength + trackDist);
  }

  /**
   * Finds lookahead target point and speed ahead of vehicle on racing line.
   */
  public getLookaheadTarget(
    currentPos: Vector3,
    lookaheadDistance: number,
    lateralOffset: number = 0
  ): LookaheadTarget {
    const closest = this.findClosestWaypoint(currentPos);
    let targetDist = closest.distanceAlongTrack + lookaheadDistance;
    while (targetDist >= this.trackLength) {
      targetDist -= this.trackLength;
    }

    // Find the waypoint that contains or exceeds targetDist
    let targetWp = closest;
    let minDiff = Infinity;
    for (let i = 0; i < this.totalWaypoints; i++) {
      const wp = this.waypoints[i];
      const diff = Math.abs(wp.distanceAlongTrack - targetDist);
      if (diff < minDiff) {
        minDiff = diff;
        targetWp = wp;
      }
    }

    // Apply lateral offset (e.g. for overtaking or traffic avoidance)
    let targetPos = targetWp.position.clone();
    if (Math.abs(lateralOffset) > 0.01) {
      targetPos = targetPos.add(targetWp.normal.scale(lateralOffset));
    }

    return {
      targetPoint: targetPos,
      targetSpeed: targetWp.targetSpeed,
      distanceAlongTrack: targetWp.distanceAlongTrack,
      curvatureDeg: targetWp.curvatureDeg,
    };
  }
}
