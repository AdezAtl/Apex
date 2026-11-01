import {
  Scene,
  Vector3,
  Mesh,
  MeshBuilder,
  DynamicTexture,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';
import { Vehicle } from '../vehicle/Vehicle';
import { RacerSnapshot } from './MultiplayerTypes';
import { getVehicleById } from '../vehicle/VehicleCatalog';

interface TimedSnapshot {
  time: number;
  snapshot: RacerSnapshot;
}

export class RemoteVehicle {
  public id: string;
  public name: string;
  public vehicleId: string;
  public paintId: string;
  public isHost: boolean;

  public vehicle: Vehicle;
  public isLoaded: boolean = false;

  public position: Vector3 = new Vector3(0, 0.05, 0);
  public yawAngle: number = 0;
  public forwardSpeed: number = 0;
  public lateralSpeed: number = 0;
  public steeringAngle: number = 0;
  public wheelSpinAngle: number = 0;

  public currentLap: number = 1;
  public currentGate: number = 0;
  public isFinished: boolean = false;
  public finishTimeSeconds: number = 0;

  private snapshotBuffer: TimedSnapshot[] = [];
  // Tight 45ms buffer for low-latency LAN responsiveness
  private static readonly INTERPOLATION_DELAY_MS = 45;
  private static readonly MAX_BUFFER_SIZE = 30;

  private nameplateMesh: Mesh | null = null;
  private nameplateTexture: DynamicTexture | null = null;
  private scene: Scene;

  constructor(
    scene: Scene,
    id: string,
    name: string,
    vehicleId: string,
    paintId: string,
    isHost: boolean = false
  ) {
    this.scene = scene;
    this.id = id;
    this.name = name;
    this.vehicleId = vehicleId;
    this.paintId = paintId;
    this.isHost = isHost;

    this.vehicle = new Vehicle(this.scene);
  }

  public async load(initialPos: Vector3, initialYaw: number = 0): Promise<void> {
    this.position.copyFrom(initialPos);
    this.yawAngle = initialYaw;

    const catalogItem = getVehicleById(this.vehicleId);
    const fileName = catalogItem ? catalogItem.fileName : '3M.glb';
    const yawOffset = catalogItem?.yawOffset || 0;

    await this.vehicle.load(fileName, this.position, this.yawAngle, this.paintId, yawOffset);
    this.isLoaded = true;

    this.createNameplate();
  }

  public pushSnapshot(snapshot: RacerSnapshot, receiveTime: number = performance.now()): void {
    this.currentLap = snapshot.currentLap;
    this.currentGate = snapshot.currentGate;
    this.isFinished = snapshot.isFinished;
    this.finishTimeSeconds = snapshot.finishTimeSeconds;

    this.snapshotBuffer.push({
      time: receiveTime,
      snapshot,
    });

    if (this.snapshotBuffer.length > RemoteVehicle.MAX_BUFFER_SIZE) {
      this.snapshotBuffer.shift();
    }
  }

  public update(dt: number, currentTime: number = performance.now()): void {
    if (!this.isLoaded || !this.vehicle.rootNode) return;

    const renderTime = currentTime - RemoteVehicle.INTERPOLATION_DELAY_MS;

    while (this.snapshotBuffer.length > 2 && this.snapshotBuffer[1].time < renderTime) {
      this.snapshotBuffer.shift();
    }

    if (this.snapshotBuffer.length === 1) {
      const s = this.snapshotBuffer[0].snapshot;
      this.position.set(s.x, s.y, s.z);
      this.yawAngle = s.yaw;
      this.forwardSpeed = s.forwardSpeed;
      this.lateralSpeed = s.lateralSpeed;
      this.steeringAngle = s.steeringAngle;
      this.wheelSpinAngle = s.wheelSpinAngle;
    } else if (this.snapshotBuffer.length >= 2) {
      let s0: TimedSnapshot | null = null;
      let s1: TimedSnapshot | null = null;

      for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
        if (this.snapshotBuffer[i].time <= renderTime && this.snapshotBuffer[i + 1].time >= renderTime) {
          s0 = this.snapshotBuffer[i];
          s1 = this.snapshotBuffer[i + 1];
          break;
        }
      }

      if (s0 && s1) {
        const span = s1.time - s0.time;
        const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (renderTime - s0.time) / span)) : 0;
        const snap0 = s0.snapshot;
        const snap1 = s1.snapshot;

        this.position.x = snap0.x + (snap1.x - snap0.x) * alpha;
        this.position.y = snap0.y + (snap1.y - snap0.y) * alpha;
        this.position.z = snap0.z + (snap1.z - snap0.z) * alpha;
        this.yawAngle = this.lerpAngle(snap0.yaw, snap1.yaw, alpha);

        this.forwardSpeed = snap0.forwardSpeed + (snap1.forwardSpeed - snap0.forwardSpeed) * alpha;
        this.lateralSpeed = snap0.lateralSpeed + (snap1.lateralSpeed - snap0.lateralSpeed) * alpha;
        this.steeringAngle = snap0.steeringAngle + (snap1.steeringAngle - snap0.steeringAngle) * alpha;
        this.wheelSpinAngle = snap0.wheelSpinAngle + (snap1.wheelSpinAngle - snap0.wheelSpinAngle) * alpha;
      } else {
        const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
        const snap = latest.snapshot;
        const elapsedSec = Math.min(0.15, Math.max(0, (renderTime - latest.time) / 1000));

        this.position.x = snap.x + snap.vx * elapsedSec;
        this.position.y = snap.y;
        this.position.z = snap.z + snap.vz * elapsedSec;
        this.yawAngle = snap.yaw;
        this.forwardSpeed = snap.forwardSpeed;
        this.lateralSpeed = snap.lateralSpeed;
        this.steeringAngle = snap.steeringAngle;
        this.wheelSpinAngle += (this.forwardSpeed * dt) / 0.33;
      }
    }

    // CRITICAL FIX: Always apply transform even if snapshotBuffer is empty (e.g., on Host direct updates)
    this.vehicle.applyTransform(this.position, this.yawAngle);
    this.vehicle.updateWheels(this.wheelSpinAngle, this.steeringAngle);

    const approxLateralAccel = this.forwardSpeed * Math.tan(this.steeringAngle) * 2.0;
    this.vehicle.updateBodyMotion(dt, 0, approxLateralAccel);

    if (this.nameplateMesh) {
      this.nameplateMesh.position.set(this.position.x, this.position.y + 1.85, this.position.z);
    }
  }

  private lerpAngle(a: number, b: number, t: number): number {
    let diff = (b - a) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  private createNameplate(): void {
    if (this.nameplateMesh) this.nameplateMesh.dispose();

    const texWidth = 256;
    const texHeight = 64;
    this.nameplateTexture = new DynamicTexture(`NameplateTex_${this.id}`, { width: texWidth, height: texHeight }, this.scene, false);
    this.nameplateTexture.hasAlpha = true;

    const ctx = this.nameplateTexture.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      ctx.clearRect(0, 0, texWidth, texHeight);
      ctx.fillStyle = 'rgba(10, 15, 24, 0.85)';
      ctx.strokeStyle = this.isHost ? 'rgba(235, 175, 40, 0.95)' : 'rgba(0, 215, 255, 0.9)';
      ctx.lineWidth = 3;

      const r = 16;
      ctx.beginPath();
      ctx.moveTo(r, 4);
      ctx.lineTo(texWidth - r, 4);
      ctx.quadraticCurveTo(texWidth - 4, 4, texWidth - 4, r);
      ctx.lineTo(texWidth - 4, texHeight - r);
      ctx.quadraticCurveTo(texWidth - 4, texHeight - 4, texWidth - r, texHeight - 4);
      ctx.lineTo(r, texHeight - 4);
      ctx.quadraticCurveTo(4, texHeight - 4, 4, texHeight - r);
      ctx.lineTo(4, r);
      ctx.quadraticCurveTo(4, 4, r, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 22px Orbitron, Rajdhani, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const tagText = this.isHost ? `👑 ${this.name.toUpperCase()}` : this.name.toUpperCase();
      ctx.fillText(tagText, texWidth / 2, texHeight / 2);
      this.nameplateTexture.update();
    }

    const mat = new StandardMaterial(`NameplateMat_${this.id}`, this.scene);
    mat.diffuseTexture = this.nameplateTexture;
    mat.useAlphaFromDiffuseTexture = true;
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(1, 1, 1);
    mat.backFaceCulling = false;

    this.nameplateMesh = MeshBuilder.CreatePlane(`NameplatePlane_${this.id}`, { width: 1.8, height: 0.45 }, this.scene);
    this.nameplateMesh.material = mat;
    this.nameplateMesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.nameplateMesh.isPickable = false;
  }

  public dispose(): void {
    if (this.vehicle) this.vehicle.dispose();
    if (this.nameplateMesh) {
      this.nameplateMesh.dispose();
      this.nameplateMesh = null;
    }
    if (this.nameplateTexture) {
      this.nameplateTexture.dispose();
      this.nameplateTexture = null;
    }
    this.isLoaded = false;
  }
}