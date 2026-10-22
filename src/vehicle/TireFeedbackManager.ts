import {
  Scene,
  ParticleSystem,
  DynamicTexture,
  Color4,
  Color3,
  Vector3,
  Mesh,
  VertexData,
  VertexBuffer,
  StandardMaterial,
} from '@babylonjs/core';
import { Vehicle } from './Vehicle';
import { VehicleController } from './VehicleController';

export class TireFeedbackManager {
  private scene: Scene;

  // Tire smoke particle systems
  public leftSmoke: ParticleSystem | null = null;
  public rightSmoke: ParticleSystem | null = null;
  private smokeTexture: DynamicTexture | null = null;
  private leftEmitterPos: Vector3 = new Vector3(0, 0, 0);
  private rightEmitterPos: Vector3 = new Vector3(0, 0, 0);

  // Skid mark ribbons
  public leftSkidMesh: Mesh | null = null;
  public rightSkidMesh: Mesh | null = null;
  private skidMaterial: StandardMaterial | null = null;

  public static readonly MAX_SKID_POINTS = 160; // 159 quad segments per wheel
  public leftPositions: Float32Array;
  public leftColors: Float32Array;
  public rightPositions: Float32Array;
  public rightColors: Float32Array;
  private skidIndices: Uint32Array;

  public leftPointCount: number = 0;
  public rightPointCount: number = 0;
  private lastLeftPos: Vector3 = new Vector3(0, 0, 0);
  private lastRightPos: Vector3 = new Vector3(0, 0, 0);
  private leftIsNewStroke: boolean = true;
  private rightIsNewStroke: boolean = true;
  private minSegmentDistanceSq: number = 0.22 * 0.22; // ~22cm minimum segment spacing

  public roadSurfaceY: number = 0.05;
  private tireTreadWidth: number = 0.22; // 22cm tire tread contact patch
  private skidElevation: number = 0.003; // Elevation above road surface to prevent z-fighting

  constructor(scene: Scene, roadSurfaceY: number = 0.05) {
    this.scene = scene;
    this.roadSurfaceY = roadSurfaceY;

    const numVerts = TireFeedbackManager.MAX_SKID_POINTS * 2;
    this.leftPositions = new Float32Array(numVerts * 3);
    this.leftColors = new Float32Array(numVerts * 4);
    this.rightPositions = new Float32Array(numVerts * 3);
    this.rightColors = new Float32Array(numVerts * 4);
    this.skidIndices = new Uint32Array((TireFeedbackManager.MAX_SKID_POINTS - 1) * 6);

    for (let i = 0; i < TireFeedbackManager.MAX_SKID_POINTS - 1; i++) {
      const v = i * 2;
      const idx = i * 6;
      this.skidIndices[idx] = v;
      this.skidIndices[idx + 1] = v + 1;
      this.skidIndices[idx + 2] = v + 2;
      this.skidIndices[idx + 3] = v + 2;
      this.skidIndices[idx + 4] = v + 1;
      this.skidIndices[idx + 5] = v + 3;
    }

    this.initSmokeParticles();
    this.initSkidMeshes();
  }

  private initSmokeParticles(): void {
    // Shared soft radial gradient texture (no harsh box edges)
    this.smokeTexture = new DynamicTexture('SmokePuffTex', { width: 64, height: 64 }, this.scene, false);
    const ctx = this.smokeTexture.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);
      const grad = ctx.createRadialGradient(32, 32, 3, 32, 32, 31);
      grad.addColorStop(0.0, 'rgba(235, 235, 240, 0.45)');
      grad.addColorStop(0.35, 'rgba(215, 215, 222, 0.26)');
      grad.addColorStop(0.75, 'rgba(195, 195, 202, 0.08)');
      grad.addColorStop(1.0, 'rgba(180, 180, 188, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      this.smokeTexture.update();
    }

    // Left Rear Tire Smoke
    this.leftSmoke = new ParticleSystem('LeftTireSmoke', 60, this.scene);
    this.setupSmokeProperties(this.leftSmoke, this.leftEmitterPos);

    // Right Rear Tire Smoke
    this.rightSmoke = new ParticleSystem('RightTireSmoke', 60, this.scene);
    this.setupSmokeProperties(this.rightSmoke, this.rightEmitterPos);

    this.leftSmoke.start();
    this.rightSmoke.start();
  }

  private setupSmokeProperties(ps: ParticleSystem, emitter: Vector3): void {
    ps.particleTexture = this.smokeTexture;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD; // Soft natural alpha blending
    ps.emitter = emitter;
    ps.minSize = 0.25;
    ps.maxSize = 0.65;
    ps.minLifeTime = 0.35;
    ps.maxLifeTime = 0.65;
    ps.emitRate = 0; // Starts silent
    ps.color1 = new Color4(0.82, 0.82, 0.85, 0.35);
    ps.color2 = new Color4(0.75, 0.75, 0.78, 0.20);
    ps.colorDead = new Color4(0.68, 0.68, 0.70, 0.0);
    ps.gravity = new Vector3(0, 0.35, 0); // Gentle buoyancy
    ps.minEmitPower = 0.2;
    ps.maxEmitPower = 0.8;
    ps.minAngularSpeed = -0.8;
    ps.maxAngularSpeed = 0.8;
    ps.direction1 = new Vector3(-0.25, 0.3, -0.6);
    ps.direction2 = new Vector3(0.25, 0.5, -0.2);
  }

  private initSkidMeshes(): void {
    this.skidMaterial = new StandardMaterial('SkidMarkMaterial', this.scene);
    this.skidMaterial.diffuseColor = new Color3(0.06, 0.06, 0.06);
    this.skidMaterial.specularColor = new Color3(0, 0, 0);
    this.skidMaterial.backFaceCulling = false;
    this.skidMaterial.disableLighting = true; // Natural flat rubber mark

    this.leftSkidMesh = new Mesh('LeftSkidMesh', this.scene);
    this.leftSkidMesh.isPickable = false;
    this.leftSkidMesh.hasVertexAlpha = true;
    this.leftSkidMesh.useVertexColors = true;
    this.leftSkidMesh.material = this.skidMaterial;
    const leftVd = new VertexData();
    leftVd.positions = this.leftPositions;
    leftVd.colors = this.leftColors;
    leftVd.indices = this.skidIndices;
    leftVd.applyToMesh(this.leftSkidMesh, true);

    this.rightSkidMesh = new Mesh('RightSkidMesh', this.scene);
    this.rightSkidMesh.isPickable = false;
    this.rightSkidMesh.hasVertexAlpha = true;
    this.rightSkidMesh.useVertexColors = true;
    this.rightSkidMesh.material = this.skidMaterial;
    const rightVd = new VertexData();
    rightVd.positions = this.rightPositions;
    rightVd.colors = this.rightColors;
    rightVd.indices = this.skidIndices;
    rightVd.applyToMesh(this.rightSkidMesh, true);
  }

  public update(dt: number, vehicle: Vehicle, controller: VehicleController, isRacing: boolean): void {
    if (!isRacing) {
      if (this.leftSmoke) this.leftSmoke.emitRate = 0;
      if (this.rightSmoke) this.rightSmoke.emitRate = 0;
      this.leftIsNewStroke = true;
      this.rightIsNewStroke = true;
      return;
    }

    // Natural rubber wear-off over time
    const fade = Math.max(0, 1.0 - dt * 0.035);
    if (this.leftPointCount > 0) {
      const total = this.leftPointCount * 2;
      for (let i = 0; i < total; i++) {
        this.leftColors[i * 4 + 3] *= fade;
      }
    }
    if (this.rightPointCount > 0) {
      const total = this.rightPointCount * 2;
      for (let i = 0; i < total; i++) {
        this.rightColors[i * 4 + 3] *= fade;
      }
    }

    const forwardSpeed = Math.abs(controller.forwardSpeed);
    const lateralSpeed = Math.abs(controller.lateralSpeed);
    const isHandbraking = controller.isHandbrakeEngaged;

    // Get true 3D world coordinates for rear tires
    const leftWheelPos = vehicle.getRearLeftWheelWorldPosition();
    const rightWheelPos = vehicle.getRearRightWheelWorldPosition();

    // 1. UPDATE SMOKE EMITTERS
    this.leftEmitterPos.copyFrom(leftWheelPos);
    this.leftEmitterPos.y = this.roadSurfaceY + 0.08;
    this.rightEmitterPos.copyFrom(rightWheelPos);
    this.rightEmitterPos.y = this.roadSurfaceY + 0.08;

    // Calculate slip intensity & emission
    // Genuinely sliding: lateral speed > 1.2 m/s or active handbrake with vehicle moving > 2.0 m/s
    const isStationary = forwardSpeed < 2.0;
    const slipIntensity = Math.min(
      1.0,
      Math.max(0, (lateralSpeed - 1.2) / 3.0) + (isHandbraking ? 0.45 : 0.0)
    );
    const speedFactor = Math.min(1.0, Math.max(0, (forwardSpeed - 2.0) / 10.0));
    const isTireSlipping = !isStationary && slipIntensity > 0.08 && speedFactor > 0.05;

    if (isTireSlipping) {
      const emitRate = Math.round(slipIntensity * speedFactor * 50);
      if (this.leftSmoke) this.leftSmoke.emitRate = emitRate;
      if (this.rightSmoke) this.rightSmoke.emitRate = emitRate;
    } else {
      if (this.leftSmoke) this.leftSmoke.emitRate = 0;
      if (this.rightSmoke) this.rightSmoke.emitRate = 0;
    }

    // 2. SKID MARKS GENERATION
    // Ground elevation just above asphalt deck
    const groundY = this.roadSurfaceY + this.skidElevation;
    const yaw = controller.yawAngle;
    const normalX = Math.cos(yaw);
    const normalZ = -Math.sin(yaw);

    // If tires are sliding, lay down dark semi-transparent rubber
    if (isTireSlipping) {
      const skidAlpha = Math.min(0.65, 0.25 + slipIntensity * 0.40);

      // Left wheel skid point
      const distSqLeft =
        Math.pow(leftWheelPos.x - this.lastLeftPos.x, 2) +
        Math.pow(leftWheelPos.z - this.lastLeftPos.z, 2);

      if (this.leftIsNewStroke || distSqLeft >= this.minSegmentDistanceSq) {
        this.addSkidPoint(
          true,
          leftWheelPos.x,
          groundY,
          leftWheelPos.z,
          normalX,
          normalZ,
          skidAlpha,
          this.leftIsNewStroke
        );
        this.lastLeftPos.copyFrom(leftWheelPos);
        this.leftIsNewStroke = false;
        if (this.leftSkidMesh) {
          this.leftSkidMesh.updateVerticesData(VertexBuffer.PositionKind, this.leftPositions);
          this.leftSkidMesh.updateVerticesData(VertexBuffer.ColorKind, this.leftColors);
        }
      }

      // Right wheel skid point
      const distSqRight =
        Math.pow(rightWheelPos.x - this.lastRightPos.x, 2) +
        Math.pow(rightWheelPos.z - this.lastRightPos.z, 2);

      if (this.rightIsNewStroke || distSqRight >= this.minSegmentDistanceSq) {
        this.addSkidPoint(
          false,
          rightWheelPos.x,
          groundY,
          rightWheelPos.z,
          normalX,
          normalZ,
          skidAlpha,
          this.rightIsNewStroke
        );
        this.lastRightPos.copyFrom(rightWheelPos);
        this.rightIsNewStroke = false;
        if (this.rightSkidMesh) {
          this.rightSkidMesh.updateVerticesData(VertexBuffer.PositionKind, this.rightPositions);
          this.rightSkidMesh.updateVerticesData(VertexBuffer.ColorKind, this.rightColors);
        }
      }
    } else {
      // Normal grip restored: next slide will begin a fresh continuous stroke
      this.leftIsNewStroke = true;
      this.rightIsNewStroke = true;
    }
  }

  private addSkidPoint(
    isLeft: boolean,
    px: number,
    py: number,
    pz: number,
    nx: number,
    nz: number,
    alpha: number,
    isNewStroke: boolean
  ): void {
    const halfW = this.tireTreadWidth * 0.5;
    const leftX = px - nx * halfW;
    const leftZ = pz - nz * halfW;
    const rightX = px + nx * halfW;
    const rightZ = pz + nz * halfW;
    const ptAlpha = isNewStroke ? 0.0 : alpha;

    const positions = isLeft ? this.leftPositions : this.rightPositions;
    const colors = isLeft ? this.leftColors : this.rightColors;
    const currentCount = isLeft ? this.leftPointCount : this.rightPointCount;

    if (currentCount < TireFeedbackManager.MAX_SKID_POINTS) {
      const v = currentCount * 2;
      positions[v * 3] = leftX;
      positions[v * 3 + 1] = py;
      positions[v * 3 + 2] = leftZ;

      positions[(v + 1) * 3] = rightX;
      positions[(v + 1) * 3 + 1] = py;
      positions[(v + 1) * 3 + 2] = rightZ;

      const c = v * 4;
      colors[c] = 0.06; colors[c + 1] = 0.06; colors[c + 2] = 0.06; colors[c + 3] = ptAlpha;
      colors[c + 4] = 0.06; colors[c + 5] = 0.06; colors[c + 6] = 0.06; colors[c + 7] = ptAlpha;

      if (isLeft) this.leftPointCount++;
      else this.rightPointCount++;
    } else {
      // Fixed ring-buffer: shift vertices back by 1 point (2 vertices = 6 floats in pos, 8 in col)
      positions.copyWithin(0, 6);
      colors.copyWithin(0, 8);

      const lastV = (TireFeedbackManager.MAX_SKID_POINTS - 1) * 2;
      positions[lastV * 3] = leftX;
      positions[lastV * 3 + 1] = py;
      positions[lastV * 3 + 2] = leftZ;

      positions[(lastV + 1) * 3] = rightX;
      positions[(lastV + 1) * 3 + 1] = py;
      positions[(lastV + 1) * 3 + 2] = rightZ;

      const c = lastV * 4;
      colors[c] = 0.06; colors[c + 1] = 0.06; colors[c + 2] = 0.06; colors[c + 3] = ptAlpha;
      colors[c + 4] = 0.06; colors[c + 5] = 0.06; colors[c + 6] = 0.06; colors[c + 7] = ptAlpha;
    }
  }

  public reset(): void {
    if (this.leftSmoke) {
      this.leftSmoke.emitRate = 0;
      this.leftSmoke.reset();
    }
    if (this.rightSmoke) {
      this.rightSmoke.emitRate = 0;
      this.rightSmoke.reset();
    }

    this.leftPointCount = 0;
    this.rightPointCount = 0;
    this.leftIsNewStroke = true;
    this.rightIsNewStroke = true;

    this.leftPositions.fill(0);
    this.leftColors.fill(0);
    this.rightPositions.fill(0);
    this.rightColors.fill(0);

    if (this.leftSkidMesh) {
      this.leftSkidMesh.updateVerticesData(VertexBuffer.PositionKind, this.leftPositions);
      this.leftSkidMesh.updateVerticesData(VertexBuffer.ColorKind, this.leftColors);
    }
    if (this.rightSkidMesh) {
      this.rightSkidMesh.updateVerticesData(VertexBuffer.PositionKind, this.rightPositions);
      this.rightSkidMesh.updateVerticesData(VertexBuffer.ColorKind, this.rightColors);
    }
  }

  public dispose(): void {
    if (this.leftSmoke) {
      this.leftSmoke.dispose();
      this.leftSmoke = null;
    }
    if (this.rightSmoke) {
      this.rightSmoke.dispose();
      this.rightSmoke = null;
    }
    if (this.smokeTexture) {
      this.smokeTexture.dispose();
      this.smokeTexture = null;
    }
    if (this.leftSkidMesh) {
      this.leftSkidMesh.dispose();
      this.leftSkidMesh = null;
    }
    if (this.rightSkidMesh) {
      this.rightSkidMesh.dispose();
      this.rightSkidMesh = null;
    }
    if (this.skidMaterial) {
      this.skidMaterial.dispose();
      this.skidMaterial = null;
    }
  }
}
