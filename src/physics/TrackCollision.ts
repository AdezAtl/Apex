import { Vector3 } from '@babylonjs/core';
import { VehicleController } from '../vehicle/VehicleController';
import { CircuitDefinition, CenterlineSegment, TrackBoundaryConfig } from '../tracks/TrackConfig';
import { ForestValleyCircuit } from '../tracks/ForestValleyCircuit';

export interface CollisionResult {
  hitBarrier: boolean;
  isOutOfBounds: boolean;
  deflectionApplied: boolean;
}

export class TrackCollision {
  public roadSurfaceY: number = 0.05;
  public trackHalfWidth: number = 6.5;
  public barrierLimit: number = 7.0;

  private boundaries: TrackBoundaryConfig = ForestValleyCircuit.boundaries;
  private segments: CenterlineSegment[] = ForestValleyCircuit.centerlineSegments;

  constructor() {
    this.setCircuit(ForestValleyCircuit);
  }

  /**
   * Configures road surface Y, boundary box, and centerline segments for the active circuit.
   */
  public setCircuit(circuit: CircuitDefinition): void {
    this.roadSurfaceY = circuit.roadSurfaceY;
    this.boundaries = circuit.boundaries;
    this.segments = circuit.centerlineSegments;
  }

  /**
   * Applies ground clamping, barrier deflection, and out-of-bounds detection.
   */
  public resolveCollision(controller: VehicleController): CollisionResult {
    const pos = controller.position;
    let hitBarrier = false;
    let deflectionApplied = false;

    // 1. Out-of-bounds boundary check against active circuit bounds
    const isOutOfBounds =
      pos.y < this.boundaries.minY ||
      pos.x < this.boundaries.minX ||
      pos.x > this.boundaries.maxX ||
      pos.z < this.boundaries.minZ ||
      pos.z > this.boundaries.maxZ;

    if (isOutOfBounds) {
      return { hitBarrier: false, isOutOfBounds: true, deflectionApplied: false };
    }

    // 2. Ground surface clamping (ensures car never falls through or sinks)
    pos.y = this.roadSurfaceY;

    // 3. Track Barrier Deflection
    // Find closest segment of the circuit
    const distToCenterline = this.getDistanceToTrackCenterline(pos);

    if (distToCenterline.distance > this.barrierLimit) {
      hitBarrier = true;
      deflectionApplied = true;

      // Compute normal pointing back towards track center
      const normal = distToCenterline.closestPoint.subtract(pos);
      normal.y = 0;
      if (normal.lengthSquared() > 0.0001) {
        normal.normalize();

        // Reposition car right inside barrier limit
        const clampedPos = distToCenterline.closestPoint.subtract(normal.scale(this.barrierLimit));
        pos.x = clampedPos.x;
        pos.z = clampedPos.z;

        // Dampen velocity component towards wall, bounce softly back onto track
        const vDotN = controller.velocity.x * normal.x + controller.velocity.z * normal.z;
        if (vDotN < 0) {
          // Moving into the barrier: reflect with elastic restitution (0.35)
          const restitution = 0.35;
          controller.lateralSpeed = -controller.lateralSpeed * restitution;
          // Wall scrape friction on forward speed
          controller.forwardSpeed *= 0.82;
        }
      }
    }

    return { hitBarrier, isOutOfBounds: false, deflectionApplied };
  }

  /**
   * Calculates closest point on track centerline to vehicle position across the active circuit.
   */
  public getDistanceToTrackCenterline(pos: Vector3): { distance: number; closestPoint: Vector3 } {
    let minDistance = Infinity;
    let closestPoint = new Vector3(0, 0, 0);

    for (const seg of this.segments) {
      const pt = this.closestPointOnSegment(pos, seg.start, seg.end);
      const d = Vector3.Distance(new Vector3(pos.x, 0, pos.z), pt);
      if (d < minDistance) {
        minDistance = d;
        closestPoint = pt;
      }
    }

    return { distance: minDistance, closestPoint };
  }

  private closestPointOnSegment(p: Vector3, a: Vector3, b: Vector3): Vector3 {
    const ab = b.subtract(a);
    const ap = new Vector3(p.x, 0, p.z).subtract(a);
    const abLenSq = ab.lengthSquared();
    if (abLenSq === 0) return a.clone();

    const t = Math.max(0, Math.min(1, Vector3.Dot(ap, ab) / abLenSq));
    return a.add(ab.scale(t));
  }
}
