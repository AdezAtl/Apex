import { Vector3 } from '@babylonjs/core';
import { VehicleController } from '../vehicle/VehicleController';
import { CircuitDefinition, CenterlineSegment, TrackBoundaryConfig } from '../tracks/TrackConfig';
import { ForestValleyCircuit } from '../tracks/ForestValleyCircuit';

export interface CollisionResult {
  hitBarrier: boolean;
  isOutOfBounds: boolean;
  deflectionApplied: boolean;
}

export interface TrackCenterlineResult {
  distance: number;
  closestPoint: Vector3;
  localBarrierLimit: number;
  tangent: Vector3;
  rightNormal: Vector3;
  sideSign: number; // +1 if right of centerline, -1 if left of centerline
}

interface InternalSampleSegment {
  start: Vector3;
  end: Vector3;
  tangent: Vector3;
  rightNormal: Vector3;
  barrierLimit: number;
}

export class TrackCollision {
  public roadSurfaceY: number = 0.05;
  public trackHalfWidth: number = 6.5;
  public barrierLimit: number = 6.25;

  private boundaries: TrackBoundaryConfig = ForestValleyCircuit.boundaries;
  private segments: CenterlineSegment[] = ForestValleyCircuit.centerlineSegments;
  private sampleSegments: InternalSampleSegment[] = [];

  constructor() {
    this.setCircuit(ForestValleyCircuit);
  }

  /**
   * Configures road surface Y, boundary box, sample-accurate invisible wall limits, and centerline.
   */
  public setCircuit(circuit: CircuitDefinition): void {
    this.roadSurfaceY = circuit.roadSurfaceY;
    this.boundaries = circuit.boundaries;
    this.segments = circuit.centerlineSegments;

    const fallbackHalfWidth = circuit.trackHalfWidth || 6.5;
    this.trackHalfWidth = fallbackHalfWidth;
    // Invisible barrier limit: precise, keeping car tires securely on the road surface
    this.barrierLimit = Math.max(3.5, fallbackHalfWidth - 0.25);

    // Build sample-accurate boundary segments from roadSamples if available
    this.sampleSegments = [];
    if (circuit.roadSamples && circuit.roadSamples.length > 1) {
      const samples = circuit.roadSamples;
      const count = samples.length;
      for (let i = 0; i < count; i++) {
        const s0 = samples[i];
        const s1 = samples[(i + 1) % count];

        const localWidth = s0.width !== undefined ? s0.width : fallbackHalfWidth * 2.0;
        const localHalfWidth = localWidth / 2.0;
        // Boundary wall is set precisely at the asphalt edge so wheels stay on road
        const sampleBarrierLimit = Math.max(3.5, localHalfWidth - 0.25);

        let tangent = s0.tangent.clone();
        if (tangent.lengthSquared() < 0.001) {
          tangent = s1.position.subtract(s0.position);
          tangent.y = 0;
          if (tangent.lengthSquared() > 0.001) {
            tangent.normalize();
          } else {
            tangent = new Vector3(0, 0, 1);
          }
        }

        let rightNorm = s0.rightNormal.clone();
        if (rightNorm.lengthSquared() < 0.001) {
          rightNorm = new Vector3(tangent.z, 0, -tangent.x);
        }

        this.sampleSegments.push({
          start: s0.position.clone(),
          end: s1.position.clone(),
          tangent,
          rightNormal: rightNorm,
          barrierLimit: sampleBarrierLimit,
        });
      }
    }
  }

  /**
   * Applies ground clamping, invisible barrier deflection, speed reduction, and vehicle turn-away.
   */
  public resolveCollision(controller: VehicleController): CollisionResult {
    const pos = controller.position;
    let hitBarrier = false;
    let deflectionApplied = false;

    // 1. Out-of-bounds boundary check against active circuit world bounds
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

    // 3. Invisible Track Barrier Deflection
    const centerlineInfo = this.getDistanceToTrackCenterline(pos);

    if (centerlineInfo.distance > centerlineInfo.localBarrierLimit) {
      hitBarrier = true;
      deflectionApplied = true;

      // Normal vector pointing away from wall towards track center
      let inwardNormal = centerlineInfo.closestPoint.subtract(pos);
      inwardNormal.y = 0;
      if (inwardNormal.lengthSquared() > 0.0001) {
        inwardNormal.normalize();
      } else {
        inwardNormal = centerlineInfo.rightNormal.scale(-centerlineInfo.sideSign);
      }

      // A) SHIFT CAR: Reposition car safely inside the invisible boundary on the asphalt
      const safeRadius = Math.max(2.0, centerlineInfo.localBarrierLimit - 0.20);
      const clampedPos = centerlineInfo.closestPoint.subtract(inwardNormal.scale(safeRadius));
      pos.x = clampedPos.x;
      pos.z = clampedPos.z;

      // B) REDUCE SPEED: Significant deceleration upon wall contact and lateral rebound
      controller.forwardSpeed *= 0.65;
      controller.lateralSpeed = -Math.abs(controller.lateralSpeed) * 0.35 * centerlineInfo.sideSign;

      // C) TURN CAR AWAY FROM WALL: Rotate vehicle nose back along the racing line into track
      // Target heading combines track tangent with inward normal
      const tangentForward = centerlineInfo.tangent;
      const inwardBlend = inwardNormal.scale(0.38);
      const forwardBlend = tangentForward.scale(0.78);
      const desiredDir = forwardBlend.add(inwardBlend);
      desiredDir.y = 0;

      if (desiredDir.lengthSquared() > 0.001) {
        desiredDir.normalize();
        const targetYaw = Math.atan2(desiredDir.x, desiredDir.z);

        // Compute shortest angular delta between current yaw and target yaw
        let angleDiff = targetYaw - controller.yawAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Apply corrective turn impulse away from the wall
        const turnImpulse = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), 0.30);
        controller.yawAngle += turnImpulse;
        controller.yawRate = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff) * 3.5, 2.0);
      }
    }

    return { hitBarrier, isOutOfBounds: false, deflectionApplied };
  }

  /**
   * Calculates closest point on track centerline, perpendicular distance, local width limit, and tangents.
   */
  public getDistanceToTrackCenterline(pos: Vector3): TrackCenterlineResult {
    let minDistance = Infinity;
    let closestPoint = new Vector3(0, 0, 0);
    let chosenBarrierLimit = this.barrierLimit;
    let chosenTangent = new Vector3(0, 0, 1);
    let chosenNormal = new Vector3(1, 0, 0);

    // If sampleSegments exist, use high-resolution discrete road samples
    if (this.sampleSegments.length > 0) {
      for (const seg of this.sampleSegments) {
        const pt = this.closestPointOnSegment(pos, seg.start, seg.end);
        const d = Vector3.Distance(new Vector3(pos.x, 0, pos.z), pt);
        if (d < minDistance) {
          minDistance = d;
          closestPoint = pt;
          chosenBarrierLimit = seg.barrierLimit;
          chosenTangent = seg.tangent;
          chosenNormal = seg.rightNormal;
        }
      }
    } else {
      // Fallback to coarse centerlineSegments
      for (const seg of this.segments) {
        const pt = this.closestPointOnSegment(pos, seg.start, seg.end);
        const d = Vector3.Distance(new Vector3(pos.x, 0, pos.z), pt);
        if (d < minDistance) {
          minDistance = d;
          closestPoint = pt;
          chosenBarrierLimit = this.barrierLimit;
          const delta = seg.end.subtract(seg.start);
          delta.y = 0;
          if (delta.lengthSquared() > 0.001) {
            chosenTangent = delta.normalize();
            chosenNormal = new Vector3(chosenTangent.z, 0, -chosenTangent.x);
          }
        }
      }
    }

    // Determine whether vehicle is on the right (+1) or left (-1) of the centerline
    const toCar = new Vector3(pos.x - closestPoint.x, 0, pos.z - closestPoint.z);
    const sideDot = Vector3.Dot(toCar, chosenNormal);
    const sideSign = sideDot >= 0 ? 1 : -1;

    return {
      distance: minDistance,
      closestPoint,
      localBarrierLimit: chosenBarrierLimit,
      tangent: chosenTangent,
      rightNormal: chosenNormal,
      sideSign,
    };
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
