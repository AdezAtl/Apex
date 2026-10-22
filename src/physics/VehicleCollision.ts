import { Vector3 } from '@babylonjs/core';
import { VehicleController } from '../vehicle/VehicleController';
import { AIOpponent } from '../ai/AIOpponent';

export interface VehicleHitEvent {
  vehicleAId: string;
  vehicleBId: string;
  impactSpeed: number; // m/s relative impact velocity
  normal: Vector3;     // Collision normal pointing from A to B
  contactPoint: Vector3;
}

export class VehicleCollision {
  // Vehicle body dimensions matching APX01 sports coupe chassis
  public static readonly CAR_HALF_WIDTH: number = 0.65;  // 1.30m total body width
  public static readonly CAR_HALF_LENGTH: number = 1.45; // 2.90m total body length
  public static readonly BOUNDING_RADIUS: number = 1.62; // Bounding circle radius

  public static readonly RESTITUTION: number = 0.35;     // Bumper restitution (solid elastic bounce)
  public static readonly TANGENTIAL_FRICTION: number = 0.25; // Door-rubbing side friction
  public static readonly SEPARATION_SLOP: number = 0.02; // Small buffer to prevent re-sticking

  /**
   * Resolves all vehicle-to-vehicle solid body collisions:
   * 1. Player vs each active AI opponent
   * 2. AI opponent vs other AI opponents
   * Runs multiple iterations for rock-solid stability in tight corners.
   */
  public static resolveAll(
    player: VehicleController,
    opponents: AIOpponent[],
    onPlayerHit?: (event: VehicleHitEvent) => void
  ): void {
    if (!opponents || opponents.length === 0) return;

    const iterations = 2; // Multi-pass solver for cluster stability

    for (let iter = 0; iter < iterations; iter++) {
      // 1. Player vs AI Opponents
      for (const opp of opponents) {
        if (!opp.isLoaded || opp.isFinished) continue;

        const hit = this.resolvePair(
          player.position,
          player.yawAngle,
          player.forwardSpeed,
          player.lateralSpeed,
          player.speedScale,
          opp.position,
          opp.yawAngle,
          opp.forwardSpeed,
          opp.lateralSpeed,
          opp.speedScale
        );

        if (hit) {
          // Apply velocity and position updates back to player and AI
          player.position.x = hit.posA.x;
          player.position.z = hit.posA.z;
          player.forwardSpeed = hit.newForwardSpeedA;
          player.lateralSpeed = hit.newLateralSpeedA;
          player.yawRate += hit.torqueA;

          opp.position.x = hit.posB.x;
          opp.position.z = hit.posB.z;
          opp.forwardSpeed = hit.newForwardSpeedB;
          opp.lateralSpeed = hit.newLateralSpeedB;
          opp.yawAngle += hit.torqueB * 0.05;

          if (iter === 0 && onPlayerHit && hit.impactSpeed > 0.8) {
            onPlayerHit({
              vehicleAId: 'player',
              vehicleBId: opp.id,
              impactSpeed: hit.impactSpeed,
              normal: hit.normal,
              contactPoint: hit.contactPoint,
            });
          }
        }
      }

      // 2. AI Opponent vs AI Opponent
      for (let i = 0; i < opponents.length; i++) {
        const oppA = opponents[i];
        if (!oppA.isLoaded || oppA.isFinished) continue;

        for (let j = i + 1; j < opponents.length; j++) {
          const oppB = opponents[j];
          if (!oppB.isLoaded || oppB.isFinished) continue;

          const hit = this.resolvePair(
            oppA.position,
            oppA.yawAngle,
            oppA.forwardSpeed,
            oppA.lateralSpeed,
            oppA.speedScale,
            oppB.position,
            oppB.yawAngle,
            oppB.forwardSpeed,
            oppB.lateralSpeed,
            oppB.speedScale
          );

          if (hit) {
            oppA.position.x = hit.posA.x;
            oppA.position.z = hit.posA.z;
            oppA.forwardSpeed = hit.newForwardSpeedA;
            oppA.lateralSpeed = hit.newLateralSpeedA;
            oppA.yawAngle += hit.torqueA * 0.04;

            oppB.position.x = hit.posB.x;
            oppB.position.z = hit.posB.z;
            oppB.forwardSpeed = hit.newForwardSpeedB;
            oppB.lateralSpeed = hit.newLateralSpeedB;
            oppB.yawAngle += hit.torqueB * 0.04;
          }
        }
      }
    }
  }

  /**
   * Tests and resolves collision between two vehicles using aspect-ratio-aware 2D OBB collision.
   */
  public static resolvePair(
    posA: Vector3,
    yawA: number,
    forwardSpeedA: number,
    lateralSpeedA: number,
    speedScaleA: number,
    posB: Vector3,
    yawB: number,
    forwardSpeedB: number,
    lateralSpeedB: number,
    speedScaleB: number
  ): {
    posA: Vector3;
    posB: Vector3;
    newForwardSpeedA: number;
    newLateralSpeedA: number;
    newForwardSpeedB: number;
    newLateralSpeedB: number;
    torqueA: number;
    torqueB: number;
    impactSpeed: number;
    normal: Vector3;
    contactPoint: Vector3;
  } | null {
    // Broadphase: fast distance check using bounding circle radius
    const dx = posB.x - posA.x;
    const dz = posB.z - posA.z;
    const distSq = dx * dx + dz * dz;
    const maxDist = this.BOUNDING_RADIUS * 2;
    if (distSq > maxDist * maxDist || distSq < 0.000001) {
      return null;
    }

    // Narrowphase: 2D OBB Separating Axis Theorem (SAT)
    const forwardA = new Vector3(Math.sin(yawA), 0, Math.cos(yawA));
    const rightA = new Vector3(Math.cos(yawA), 0, -Math.sin(yawA));

    const forwardB = new Vector3(Math.sin(yawB), 0, Math.cos(yawB));
    const rightB = new Vector3(Math.cos(yawB), 0, -Math.sin(yawB));

    // Project relative center offset into Car A local frame
    const relForwardA = dx * forwardA.x + dz * forwardA.z;
    const relRightA = dx * rightA.x + dz * rightA.z;

    // 4 test axes in XZ plane
    const axes = [
      { axis: forwardA, isLongitudinal: true },
      { axis: rightA, isLongitudinal: false },
      { axis: forwardB, isLongitudinal: true },
      { axis: rightB, isLongitudinal: false },
    ];

    let overlapForwardMin = Infinity;
    let axisForward: Vector3 | null = null;
    let overlapLateralMin = Infinity;
    let axisLateral: Vector3 | null = null;

    for (const { axis, isLongitudinal } of axes) {
      const projD = Math.abs(dx * axis.x + dz * axis.z);

      // Box A radius projected on axis
      const rA =
        this.CAR_HALF_LENGTH * Math.abs(forwardA.x * axis.x + forwardA.z * axis.z) +
        this.CAR_HALF_WIDTH * Math.abs(rightA.x * axis.x + rightA.z * axis.z);

      // Box B radius projected on axis
      const rB =
        this.CAR_HALF_LENGTH * Math.abs(forwardB.x * axis.x + forwardB.z * axis.z) +
        this.CAR_HALF_WIDTH * Math.abs(rightB.x * axis.x + rightB.z * axis.z);

      const overlap = rA + rB - projD;
      if (overlap <= 0) {
        // Separating axis found: boxes do NOT overlap
        return null;
      }

      if (isLongitudinal) {
        if (overlap < overlapForwardMin) {
          overlapForwardMin = overlap;
          axisForward = axis.clone();
        }
      } else {
        if (overlap < overlapLateralMin) {
          overlapLateralMin = overlap;
          axisLateral = axis.clone();
        }
      }
    }

    // Both longitudinal and lateral overlaps are positive: vehicles INTERSECT!
    // Aspect-ratio-aware collision normal selection:
    // When cars are traveling in roughly similar directions (within ±50°):
    // If longitudinal offset is dominant relative to car dimensions, it is a bumper hit!
    const headingDot = forwardA.x * forwardB.x + forwardA.z * forwardB.z;
    const isRoughlyAligned = headingDot > 0.60;

    let minOverlap = 0;
    let collisionNormal = new Vector3(0, 0, 0);

    const normLongitudinal = Math.abs(relForwardA) / this.CAR_HALF_LENGTH;
    const normLateral = Math.abs(relRightA) / this.CAR_HALF_WIDTH;

    if (isRoughlyAligned && normLongitudinal > normLateral * 0.75 && axisForward) {
      // Dominant bumper-to-bumper hit (rear-end / front push)
      minOverlap = overlapForwardMin;
      collisionNormal = axisForward;
    } else if (isRoughlyAligned && normLateral > normLongitudinal * 0.75 && axisLateral) {
      // Dominant door-to-door hit (side scrape / door rub)
      minOverlap = overlapLateralMin;
      collisionNormal = axisLateral;
    } else {
      // Angled / T-bone / spin: use standard minimal penetration axis
      if (overlapForwardMin < overlapLateralMin && axisForward) {
        minOverlap = overlapForwardMin;
        collisionNormal = axisForward;
      } else if (axisLateral) {
        minOverlap = overlapLateralMin;
        collisionNormal = axisLateral;
      } else {
        return null;
      }
    }

    // Ensure normal points from A to B
    if (dx * collisionNormal.x + dz * collisionNormal.z < 0) {
      collisionNormal.scaleInPlace(-1);
    }

    // Positional separation (push each vehicle out along normal by half penetration + slop)
    const separationDist = (minOverlap + this.SEPARATION_SLOP) * 0.5;
    const newPosA = posA.subtract(collisionNormal.scale(separationDist));
    const newPosB = posB.add(collisionNormal.scale(separationDist));

    // Approximate contact point midway between centers along collision normal
    const contactPoint = posA.add(posB).scale(0.5);

    // World velocities in m/s
    const velAx = (forwardA.x * forwardSpeedA + rightA.x * lateralSpeedA) * speedScaleA;
    const velAz = (forwardA.z * forwardSpeedA + rightA.z * lateralSpeedA) * speedScaleA;

    const velBx = (forwardB.x * forwardSpeedB + rightB.x * lateralSpeedB) * speedScaleB;
    const velBz = (forwardB.z * forwardSpeedB + rightB.z * lateralSpeedB) * speedScaleB;

    // Relative velocity: V_rel = V_B - V_A
    const relVelX = velBx - velAx;
    const relVelZ = velBz - velAz;

    // Velocity component along collision normal
    const normalVel = relVelX * collisionNormal.x + relVelZ * collisionNormal.z;

    // Relative tangent vector
    const tangentX = -collisionNormal.z;
    const tangentZ = collisionNormal.x;
    const tangentVel = relVelX * tangentX + relVelZ * tangentZ;

    const impactSpeed = Math.abs(normalVel);

    let newVelAx = velAx;
    let newVelAz = velAz;
    let newVelBx = velBx;
    let newVelBz = velBz;

    // Only apply impulse if vehicles are approaching each other
    if (normalVel < 0) {
      // Elastic/inelastic normal impulse
      const impulseMag = -(1.0 + this.RESTITUTION) * normalVel * 0.5;
      const impX = collisionNormal.x * impulseMag;
      const impZ = collisionNormal.z * impulseMag;

      // Tangential friction impulse
      const frictionMag = -tangentVel * this.TANGENTIAL_FRICTION * 0.5;
      const frictX = tangentX * frictionMag;
      const frictZ = tangentZ * frictionMag;

      newVelAx -= impX + frictX;
      newVelAz -= impZ + frictZ;

      newVelBx += impX + frictX;
      newVelBz += impZ + frictZ;
    }

    // Convert world velocities back into local forward and lateral speeds
    const newForwardSpeedA = (newVelAx * forwardA.x + newVelAz * forwardA.z) / speedScaleA;
    const newLateralSpeedA = (newVelAx * rightA.x + newVelAz * rightA.z) / speedScaleA;

    const newForwardSpeedB = (newVelBx * forwardB.x + newVelBz * forwardB.z) / speedScaleB;
    const newLateralSpeedB = (newVelBx * rightB.x + newVelBz * rightB.z) / speedScaleB;

    // Off-center torque deflection (2D cross product of contact offset and collision normal)
    const relContactAx = contactPoint.x - posA.x;
    const relContactAz = contactPoint.z - posA.z;
    const torqueA = (relContactAx * collisionNormal.z - relContactAz * collisionNormal.x) * impactSpeed * 0.25;

    const relContactBx = contactPoint.x - posB.x;
    const relContactBz = contactPoint.z - posB.z;
    const torqueB = -(relContactBx * collisionNormal.z - relContactBz * collisionNormal.x) * impactSpeed * 0.25;

    return {
      posA: newPosA,
      posB: newPosB,
      newForwardSpeedA,
      newLateralSpeedA,
      newForwardSpeedB,
      newLateralSpeedB,
      torqueA,
      torqueB,
      impactSpeed,
      normal: collisionNormal,
      contactPoint,
    };
  }
}
