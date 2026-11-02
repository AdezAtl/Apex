import {
  Scene,
  Vector3,
  Color3,
  PointLight,
  TransformNode,
  SceneLoader,
  AbstractMesh,
} from '@babylonjs/core';
import { SoundManager } from '../audio/SoundManager';
import { VehicleController } from '../vehicle/VehicleController';
import { CircuitDefinition } from '../tracks/TrackConfig';

export interface PursuitTelemetry {
  isActive: boolean;
  distanceToCopMeters: number;
  bustedProgress: number; // 0.0 - 1.0
  escapeProgress: number; // 0.0 - 1.0
  isBusted: boolean;
  isEscaped: boolean;
  bannerMessage: string | null;
  bannerDuration: number;
}

export class PursuitManager {
  private scene: Scene;
  private soundManager: SoundManager;

  public isActive: boolean = false;
  private copRoot: TransformNode | null = null;
  private copMeshes: AbstractMesh[] = [];
  private redStrobeLight: PointLight | null = null;
  private blueStrobeLight: PointLight | null = null;

  // Cop Physics State
  public position: Vector3 = new Vector3(0, 0.05, 0);
  public yawAngle: number = 0;
  public forwardSpeed: number = 0;
  public isLoaded: boolean = false;

  // Pursuit Gameplay Parameters
  public bustedProgress: number = 0;
  public escapeProgress: number = 0;
  public isBusted: boolean = false;
  public isEscaped: boolean = false;

  private bannerMessage: string | null = null;
  private bannerDuration: number = 0;
  private strobeTimer: number = 0;

  constructor(scene: Scene, soundManager: SoundManager) {
    this.scene = scene;
    this.soundManager = soundManager;
  }

  public async loadCopCruiser(): Promise<void> {
    if (this.isLoaded) return;

    this.copRoot = new TransformNode('police_cruiser_root', this.scene);
    try {
      const result = await SceneLoader.ImportMeshAsync(
        '',
        './assets/vehicles/',
        'fairheaven_lt_80_cop_cruiser_-_low_poly_model.glb',
        this.scene
      );

      this.copMeshes = result.meshes;
      for (const m of this.copMeshes) {
        if (!m.parent) {
          m.parent = this.copRoot;
        }
        m.checkCollisions = false;
      }

      // Emergency Roof Strobe Lights
      this.redStrobeLight = new PointLight('cop_red_strobe', new Vector3(-0.35, 1.45, 0), this.scene);
      this.redStrobeLight.diffuse = new Color3(1.0, 0.05, 0.05);
      this.redStrobeLight.intensity = 0;
      this.redStrobeLight.range = 22.0;
      this.redStrobeLight.parent = this.copRoot;

      this.blueStrobeLight = new PointLight('cop_blue_strobe', new Vector3(0.35, 1.45, 0), this.scene);
      this.blueStrobeLight.diffuse = new Color3(0.05, 0.25, 1.0);
      this.blueStrobeLight.intensity = 0;
      this.blueStrobeLight.range = 22.0;
      this.blueStrobeLight.parent = this.copRoot;

      this.copRoot.setEnabled(false);
      this.isLoaded = true;
    } catch (e) {
      console.warn('[PursuitManager] Error loading police cruiser model:', e);
    }
  }

  public start(playerPos: Vector3, playerYaw: number): void {
    this.isActive = true;
    this.isBusted = false;
    this.isEscaped = false;
    this.bustedProgress = 0;
    this.escapeProgress = 0;
    this.forwardSpeed = 0;

    // Spawn 22 meters behind player along heading
    const rearDir = new Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));
    this.position = playerPos.add(rearDir.scale(22.0));
    this.position.y = playerPos.y;
    this.yawAngle = playerYaw;

    if (this.copRoot) {
      this.copRoot.position.copyFrom(this.position);
      this.copRoot.rotation.y = this.yawAngle;
      this.copRoot.setEnabled(true);
    }

    this.bannerMessage = 'POLICE INTERCEPTOR DEPLOYED // EVADE!';
    this.bannerDuration = 4.0;
  }

  public reset(): void {
    this.isActive = false;
    this.isBusted = false;
    this.isEscaped = false;
    this.bustedProgress = 0;
    this.escapeProgress = 0;
    this.forwardSpeed = 0;
    this.bannerMessage = null;
    this.bannerDuration = 0;

    if (this.copRoot) {
      this.copRoot.setEnabled(false);
    }

    if (this.redStrobeLight) this.redStrobeLight.intensity = 0;
    if (this.blueStrobeLight) this.blueStrobeLight.intensity = 0;

    this.soundManager.updatePoliceSiren(999, false);
  }

  public update(
    dt: number,
    player: VehicleController,
    _circuit: CircuitDefinition
  ): { isBusted: boolean; isEscaped: boolean } {
    if (!this.isActive || !this.copRoot || this.isBusted || this.isEscaped) {
      this.soundManager.updatePoliceSiren(999, false);
      return { isBusted: this.isBusted, isEscaped: this.isEscaped };
    }

    if (this.bannerDuration > 0) {
      this.bannerDuration -= dt;
      if (this.bannerDuration <= 0) {
        this.bannerMessage = null;
      }
    }

    // 1. Alternating emergency strobe lights
    this.strobeTimer += dt * 7.0;
    const isRedPhase = Math.sin(this.strobeTimer * Math.PI) > 0;
    if (this.redStrobeLight) this.redStrobeLight.intensity = isRedPhase ? 2.5 : 0.05;
    if (this.blueStrobeLight) this.blueStrobeLight.intensity = isRedPhase ? 0.05 : 2.5;

    // 2. Chasing Navigation Math
    const toPlayer = player.position.subtract(this.position);
    toPlayer.y = 0;
    const distToPlayer = toPlayer.length();

    // Target yaw angle pointing toward player
    const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
    let yawDiff = targetYaw - this.yawAngle;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;

    const turnRate = 3.6;
    const maxSteer = turnRate * dt;
    this.yawAngle += Math.max(-maxSteer, Math.min(maxSteer, yawDiff));

    // Dynamic pursuit velocity (rubber-banding / catch-up mechanics)
    let desiredSpeed = 28.0; // ~100 km/h baseline
    if (distToPlayer > 30.0) {
      desiredSpeed = 38.0; // ~137 km/h sprint
    } else if (distToPlayer > 15.0) {
      desiredSpeed = 32.0; // ~115 km/h
    } else if (distToPlayer < 4.0) {
      desiredSpeed = Math.max(10.0, player.forwardSpeed * 0.95);
    }

    const accelRate = 18.0;
    if (this.forwardSpeed < desiredSpeed) {
      this.forwardSpeed = Math.min(desiredSpeed, this.forwardSpeed + accelRate * dt);
    } else {
      this.forwardSpeed = Math.max(desiredSpeed, this.forwardSpeed - accelRate * 1.5 * dt);
    }

    // Move cop cruiser forward
    const forwardVec = new Vector3(Math.sin(this.yawAngle), 0, Math.cos(this.yawAngle));
    this.position.addInPlace(forwardVec.scale(this.forwardSpeed * dt));
    this.position.y = player.position.y;

    this.copRoot.position.copyFrom(this.position);
    this.copRoot.rotation.y = this.yawAngle;

    // 3. Siren audio update
    this.soundManager.updatePoliceSiren(distToPlayer, true);

    // 4. Busted / Escaped Condition Tracking
    const playerSpeedKmh = Math.abs(player.forwardSpeed * 3.6);

    // Busted condition: Cop within 6.0m and player pinned (< 15 km/h), or cop within 4.5m for 4 seconds
    if (distToPlayer < 6.0 && playerSpeedKmh < 18.0) {
      this.bustedProgress = Math.min(1.0, this.bustedProgress + dt / 2.2);
    } else if (distToPlayer < 4.8) {
      this.bustedProgress = Math.min(1.0, this.bustedProgress + dt / 4.0);
    } else {
      this.bustedProgress = Math.max(0, this.bustedProgress - dt * 0.4);
    }

    if (this.bustedProgress >= 1.0) {
      this.isBusted = true;
      this.isActive = false;
      this.bannerMessage = 'BUSTED! VEHICLE INTERCEPTED';
      this.bannerDuration = 6.0;
      this.soundManager.playEliminationChime(true);
      return { isBusted: true, isEscaped: false };
    }

    // Escape condition: Distance > 75m accumulates escape progress
    if (distToPlayer > 65.0) {
      this.escapeProgress = Math.min(1.0, this.escapeProgress + dt / 12.0);
    } else {
      this.escapeProgress = Math.max(0, this.escapeProgress - dt * 0.25);
    }

    if (this.escapeProgress >= 1.0) {
      this.isEscaped = true;
      this.isActive = false;
      this.bannerMessage = 'ESCAPED! PATROL LOCK LOST';
      this.bannerDuration = 6.0;
      this.soundManager.playFinishCelebration();
      return { isBusted: false, isEscaped: true };
    }

    return { isBusted: false, isEscaped: false };
  }

  public getTelemetry(playerPos: Vector3): PursuitTelemetry {
    const dist = this.isActive ? Vector3.Distance(this.position, playerPos) : 999;
    return {
      isActive: this.isActive,
      distanceToCopMeters: Math.round(dist),
      bustedProgress: Math.round(this.bustedProgress * 100) / 100,
      escapeProgress: Math.round(this.escapeProgress * 100) / 100,
      isBusted: this.isBusted,
      isEscaped: this.isEscaped,
      bannerMessage: this.bannerMessage,
      bannerDuration: this.bannerDuration,
    };
  }

  public dispose(): void {
    if (this.redStrobeLight) this.redStrobeLight.dispose();
    if (this.blueStrobeLight) this.blueStrobeLight.dispose();
    if (this.copRoot) this.copRoot.dispose();
    this.copMeshes = [];
    this.isLoaded = false;
  }
}

