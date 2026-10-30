import {
  Scene,
  TransformNode,
  Vector3,
  SceneLoader,
  AbstractMesh,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  DynamicTexture,
  Color3,
  Node,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { PaintOption, getPaintOptionById } from './PaintCustomization';

export interface VehicleMetadata {
  fileName: string;
  totalTriangles: number;
  dimensions: Vector3;
  meshCount: number;
  wheelNodeNames: string[];
}

export interface WheelNodes {
  frontLeft: TransformNode | AbstractMesh | null;
  frontRight: TransformNode | AbstractMesh | null;
  midLeft?: TransformNode | AbstractMesh | null;
  midRight?: TransformNode | AbstractMesh | null;
  rearLeft: TransformNode | AbstractMesh | null;
  rearRight: TransformNode | AbstractMesh | null;
}

export class Vehicle {
  private scene: Scene;
  public rootNode: TransformNode;
  public modelContainer: TransformNode;
  public meshes: AbstractMesh[] = [];
  public transformNodes: TransformNode[] = [];
  public wheelMeshes: AbstractMesh[] = [];
  public contactShadow: AbstractMesh | null = null;
  public bodyMaterial: PBRMaterial | null = null;
  public bodyMaterials: PBRMaterial[] = [];
  public currentPaint: PaintOption | null = null;
  public wheels: WheelNodes = {
    frontLeft: null,
    frontRight: null,
    midLeft: null,
    midRight: null,
    rearLeft: null,
    rearRight: null,
  };
  public metadata: VehicleMetadata | null = null;
  public currentPitch: number = 0;
  public currentRoll: number = 0;
  public yawOffset: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootNode = new TransformNode('VehicleRoot', this.scene);
    this.modelContainer = new TransformNode('VehicleModelContainer', this.scene);
    this.modelContainer.parent = this.rootNode;
  }

  public async load(
    fileName: string = 'APX01.glb',
    position: Vector3 = new Vector3(0, 0, 0),
    rotationY: number = 0,
    paintId?: string,
    yawOffset: number = 0
  ): Promise<VehicleMetadata> {
    this.yawOffset = yawOffset;
    this.dispose();
    this.rootNode = new TransformNode('VehicleRoot', this.scene);
    this.modelContainer = new TransformNode('VehicleModelContainer', this.scene);
    this.modelContainer.parent = this.rootNode;

    const result = await SceneLoader.ImportMeshAsync(
      '',
      './assets/vehicles/',
      fileName,
      this.scene
    );

    this.meshes = result.meshes;
    this.transformNodes = result.transformNodes;
    this.wheelMeshes = [];

    let totalTriangles = 0;
    const wheelNodeNames: string[] = [];

    // Collect all loaded nodes (meshes and transform nodes)
    const allNodes: Node[] = [...result.meshes, ...result.transformNodes];

    // Reset Blender grid offsets on top-level car root containers
    for (const node of allNodes) {
      if (node.name.startsWith('Car_') && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        node.position.set(0, 0, 0);
      }
    }

    // Find and map discrete wheel nodes (supports 4-wheel and 6-wheel chassis)
    for (const node of allNodes) {
      const lower = node.name.toLowerCase();
      const isFrontLeft = (lower.includes('fl_wheel') || lower.includes('wheel_fl') || lower.includes('wheel-front-left') || lower.endsWith('_fl')) && !lower.includes('primitive');
      const isFrontRight = (lower.includes('fr_wheel') || lower.includes('wheel_fr') || lower.includes('wheel-front-right') || lower.endsWith('_fr')) && !lower.includes('primitive');
      const isMidLeft = (lower.includes('ml_wheel') || lower.includes('wheel_ml') || lower.endsWith('_ml')) && !lower.includes('primitive');
      const isMidRight = (lower.includes('mr_wheel') || lower.includes('wheel_mr') || lower.endsWith('_mr')) && !lower.includes('primitive');
      const isRearLeft = (lower.includes('rl_wheel') || lower.includes('wheel_rl') || lower.includes('wheel-back-left') || lower.endsWith('_rl')) && !lower.includes('primitive');
      const isRearRight = (lower.includes('rr_wheel') || lower.includes('wheel_rr') || lower.includes('wheel-back-right') || lower.endsWith('_rr')) && !lower.includes('primitive');

      if (isFrontLeft && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        this.wheels.frontLeft = node;
        wheelNodeNames.push(node.name);
      } else if (isFrontRight && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        this.wheels.frontRight = node;
        wheelNodeNames.push(node.name);
      } else if (isMidLeft && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        this.wheels.midLeft = node;
        wheelNodeNames.push(node.name);
      } else if (isMidRight && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        this.wheels.midRight = node;
        wheelNodeNames.push(node.name);
      } else if (isRearLeft && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        this.wheels.rearLeft = node;
        wheelNodeNames.push(node.name);
      } else if (isRearRight && (node instanceof TransformNode || node instanceof AbstractMesh)) {
        this.wheels.rearRight = node;
        wheelNodeNames.push(node.name);
      }

      if (node instanceof AbstractMesh) {
        if (node.getTotalIndices) {
          totalTriangles += (node.getTotalIndices() / 3);
        }
        if (lower.includes('wheel')) {
          this.wheelMeshes.push(node);
        }
      }
    }

    // Attach all imported top-level nodes to modelContainer
    for (const node of allNodes) {
      if (!node.parent || node.name === '__root__') {
        node.parent = this.modelContainer;
      }
    }

    // Prepare wheel nodes for Euler rotation
    const wheelList = [
      this.wheels.frontLeft,
      this.wheels.frontRight,
      this.wheels.midLeft,
      this.wheels.midRight,
      this.wheels.rearLeft,
      this.wheels.rearRight,
    ];
    for (const w of wheelList) {
      if (w) {
        if (w instanceof TransformNode && w.rotationQuaternion) {
          w.rotationQuaternion = null;
        } else if (w instanceof AbstractMesh && w.rotationQuaternion) {
          w.rotationQuaternion = null;
        }
      }
    }

    // Initialize modelContainer with declared yawOffset and identity scale/position
    this.modelContainer.position.set(0, 0, 0);
    this.modelContainer.rotation.set(0, yawOffset, 0);
    this.modelContainer.scaling.set(1, 1, 1);
    this.modelContainer.computeWorldMatrix(true);

    const computeBounds = () => {
      let minY = Infinity;
      let maxY = -Infinity;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;

      for (const mesh of result.meshes) {
        if (mesh.name === '__root__' || mesh.name.startsWith('Vehicle') || !mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
        mesh.computeWorldMatrix(true);
        const bInfo = mesh.getBoundingInfo();
        const bBox = bInfo.boundingBox;
        minY = Math.min(minY, bBox.minimumWorld.y);
        maxY = Math.max(maxY, bBox.maximumWorld.y);
        minX = Math.min(minX, bBox.minimumWorld.x);
        maxX = Math.max(maxX, bBox.maximumWorld.x);
        minZ = Math.min(minZ, bBox.minimumWorld.z);
        maxZ = Math.max(maxZ, bBox.maximumWorld.z);
      }
      return {
        minX, maxX, minY, maxY, minZ, maxZ,
        width: maxX - minX,
        height: maxY - minY,
        length: maxZ - minZ
      };
    };

    const bounds = computeBounds();

    // Standardize all vehicles to uniform canonical racing scale matching APX01 sports chassis
    // Ensures all cars (starter, unlocked, and premium) have consistent scale, collision, and camera framing
    const STANDARD_CAR_LENGTH = 2.75;
    const maxDimension = Math.max(bounds.width, bounds.length);
    const scaleFactor = (maxDimension > 0.05) ? (STANDARD_CAR_LENGTH / maxDimension) : 1.0;

    this.modelContainer.scaling.setAll(scaleFactor);

    // Compute unscaled center offsets
    const unscaledCenterX = (bounds.minX + bounds.maxX) / 2;
    const unscaledCenterZ = (bounds.minZ + bounds.maxZ) / 2;
    const unscaledMinY = bounds.minY;

    // Center vehicle precisely at origin (0, 0) and ground bottom of tires at local Y = 0
    this.modelContainer.position.x = -unscaledCenterX * scaleFactor;
    this.modelContainer.position.z = -unscaledCenterZ * scaleFactor;
    if (isFinite(unscaledMinY)) {
      this.modelContainer.position.y = -unscaledMinY * scaleFactor;
    }

    const finalWidth = bounds.width * scaleFactor;
    const finalHeight = bounds.height * scaleFactor;
    const finalLength = bounds.length * scaleFactor;

    // Refine vehicle automotive PBR materials for realistic grounded finish
    for (const mesh of result.meshes) {
      if (mesh.material && mesh.material instanceof PBRMaterial) {
        const mat = mesh.material;
        const mName = mat.name.toLowerCase();
        if (
          mName.includes('body') ||
          mName.includes('paint') ||
          mName.includes('car') ||
          mName.includes('exterior') ||
          mName.includes('chassis') ||
          mName.includes('colormap') ||
          mName.startsWith('mat_') ||
          mName.includes('mat_')
        ) {
          // Clone body material so each vehicle instance (player and AI) has an independent paint layer
          const uniqueBodyMat = mat.clone(`BodyMat_${this.rootNode.uniqueId}_${paintId || 'default'}`) as PBRMaterial;
          mesh.material = uniqueBodyMat;
          this.bodyMaterial = uniqueBodyMat;
          uniqueBodyMat.roughness = 0.25;
          uniqueBodyMat.metallic = 0.12;
        } else if (mName.includes('tire') || mName.includes('rubber')) {
          // Natural vulcanized matte tire rubber
          mat.roughness = 0.90;
          mat.metallic = 0.0;
        } else if (mName.includes('wheel') || mName.includes('rim')) {
          // Satin metallic alloy
          mat.roughness = 0.40;
          mat.metallic = 0.65;
        } else if (mName.includes('glass')) {
          // Tinted deep canopy glass
          mat.roughness = 0.08;
          mat.metallic = 0.15;
          mat.alpha = 0.88;
        } else if (mName.includes('metal')) {
          // Polished exhaust and chrome trims
          mat.roughness = 0.25;
          mat.metallic = 0.90;
        }
      }
    }

    // Discover paintable body materials strictly belonging to this vehicle's loaded meshes
    this.bodyMaterials = [];
    const candidateMats = new Set<PBRMaterial>();
    for (const mesh of this.meshes) {
      if (mesh.material instanceof PBRMaterial) {
        const mName = mesh.material.name.toLowerCase();
        const isExcluded = mName.includes('glass') ||
                           mName.includes('window') ||
                           mName.includes('tire') ||
                           mName.includes('wheel') ||
                           mName.includes('light') ||
                           mName.includes('lamp') ||
                           mName.includes('interior') ||
                           mName.includes('seat') ||
                           mName.includes('dash') ||
                           mName.includes('shadow') ||
                           mName.includes('caliper');
        if (!isExcluded) {
          const isBodyCandidate = mName.includes('body') ||
                                  mName.includes('paint') ||
                                  mName.includes('car') ||
                                  mName.includes('exterior') ||
                                  mName.includes('chassis') ||
                                  mName.includes('colormap') ||
                                  mName.includes('metal') ||
                                  mName.includes('material') ||
                                  mName.startsWith('mat_') ||
                                  mName.includes('mat_');
          if (isBodyCandidate) {
            candidateMats.add(mesh.material);
          }
        }
      }
    }
    this.bodyMaterials = Array.from(candidateMats);
    this.bodyMaterial = this.bodyMaterials[0] || null;

    // Apply initial / persisted paint configuration to body materials
    const initialPaint = getPaintOptionById(paintId || 'pearl_white');
    this.applyPaint(initialPaint);

    // Create soft ambient occlusion contact shadow directly beneath vehicle chassis
    if (this.contactShadow) {
      this.contactShadow.dispose();
    }
    const shadowPlane = MeshBuilder.CreatePlane('VehicleContactShadow', {
      width: Math.max(finalWidth * 1.15, 1.45),
      height: Math.max(finalLength * 1.05, 2.85),
    }, this.scene);
    shadowPlane.rotation.x = Math.PI / 2;
    shadowPlane.position.x = 0;
    shadowPlane.position.z = 0;
    shadowPlane.position.y = 0.005; // Placed at base of wheels
    shadowPlane.parent = this.rootNode;
    shadowPlane.isPickable = false;

    const shadowMat = new StandardMaterial('VehicleShadowMat', this.scene);
    shadowMat.disableLighting = true;
    const shadowTex = new DynamicTexture('ShadowBlurTex', { width: 256, height: 256 }, this.scene, false);
    const sCtx = shadowTex.getContext() as CanvasRenderingContext2D;
    if (sCtx) {
      sCtx.clearRect(0, 0, 256, 256);
      const grad = sCtx.createRadialGradient(128, 128, 20, 128, 128, 125);
      grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.72)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.15)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
      shadowTex.update();
    }
    shadowMat.diffuseTexture = shadowTex;
    shadowMat.opacityTexture = shadowTex;
    shadowMat.specularColor = new Color3(0, 0, 0);
    shadowPlane.material = shadowMat;
    this.contactShadow = shadowPlane;

    this.rootNode.position.copyFrom(position);
    this.rootNode.rotation.y = rotationY;

    this.metadata = {
      fileName,
      totalTriangles: Math.round(totalTriangles),
      dimensions: new Vector3(finalWidth, finalHeight, finalLength),
      meshCount: result.meshes.length,
      wheelNodeNames,
    };

    return this.metadata;
  }

  public applyTransform(position: Vector3, yawAngle: number): void {
    this.rootNode.position.copyFrom(position);
    this.rootNode.rotation.y = yawAngle;
  }

  public updateWheels(spinAngle: number, steerAngle: number): void {
    // Model is oriented along +Z forward; visual wheel yaw matches driver steering angle
    const visualSteer = steerAngle;
    const visualSpin = (Math.abs(this.yawOffset - Math.PI) < 0.1) ? -spinAngle : spinAngle;

    // Front wheels: spin around local pitch (X) and steer around local yaw (Y)
    if (this.wheels.frontLeft) {
      this.wheels.frontLeft.rotation.x = visualSpin;
      this.wheels.frontLeft.rotation.y = visualSteer;
    }
    if (this.wheels.frontRight) {
      this.wheels.frontRight.rotation.x = visualSpin;
      this.wheels.frontRight.rotation.y = visualSteer;
    }

    // Mid wheels (e.g. 6x6 VelociRaptor): spin around local pitch (X), steering locked to 0
    if (this.wheels.midLeft) {
      this.wheels.midLeft.rotation.x = visualSpin;
      this.wheels.midLeft.rotation.y = 0;
    }
    if (this.wheels.midRight) {
      this.wheels.midRight.rotation.x = visualSpin;
      this.wheels.midRight.rotation.y = 0;
    }

    // Rear wheels: spin around local pitch (X), steering locked to 0
    if (this.wheels.rearLeft) {
      this.wheels.rearLeft.rotation.x = visualSpin;
      this.wheels.rearLeft.rotation.y = 0;
    }
    if (this.wheels.rearRight) {
      this.wheels.rearRight.rotation.x = visualSpin;
      this.wheels.rearRight.rotation.y = 0;
    }
  }

  public updateBodyMotion(dt: number, forwardAccel: number, lateralAccel: number): void {
    // Clamped target pitch (dive under braking, squat under acceleration)
    // Max ±0.045 rad (~2.5 degrees)
    const targetPitch = Math.max(-0.045, Math.min(0.045, -forwardAccel * 0.0035));

    // Clamped target roll (outside lean under lateral acceleration)
    // Max ±0.055 rad (~3.1 degrees)
    const targetRoll = Math.max(-0.055, Math.min(0.055, lateralAccel * 0.0040));

    const smoothing = Math.min(1.0, dt * 10.0);
    this.currentPitch += (targetPitch - this.currentPitch) * smoothing;
    this.currentRoll += (targetRoll - this.currentRoll) * smoothing;

    this.modelContainer.rotation.x = this.currentPitch;
    this.modelContainer.rotation.z = this.currentRoll;
  }

  public resetBodyMotion(): void {
    this.currentPitch = 0;
    this.currentRoll = 0;
    this.modelContainer.rotation.x = 0;
    this.modelContainer.rotation.z = 0;
  }

  public getRearLeftWheelWorldPosition(): Vector3 {
    if (this.wheels.rearLeft) {
      return this.wheels.rearLeft.getAbsolutePosition();
    }
    // Fallback: vehicle root offset
    const yaw = this.rootNode.rotation.y;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.rootNode.position.add(forward.scale(-1.325)).add(right.scale(-0.82));
  }

  public getRearRightWheelWorldPosition(): Vector3 {
    if (this.wheels.rearRight) {
      return this.wheels.rearRight.getAbsolutePosition();
    }
    // Fallback: vehicle root offset
    const yaw = this.rootNode.rotation.y;
    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    return this.rootNode.position.add(forward.scale(-1.325)).add(right.scale(0.82));
  }

  public setPosition(pos: Vector3): void {
    this.rootNode.position.copyFrom(pos);
  }

  public setRotationY(angle: number): void {
    this.rootNode.rotation.y = angle;
  }

  public getPosition(): Vector3 {
    return this.rootNode.position;
  }

  public applyPaint(paint: PaintOption): void {
    this.currentPaint = paint;

    // Safety fallback: if no body materials were registered, attempt candidate scan
    if (this.bodyMaterials.length === 0) {
      for (const mesh of this.meshes) {
        if (mesh.material instanceof PBRMaterial) {
          const mName = mesh.material.name.toLowerCase();
          if (!mName.includes('tire') && !mName.includes('wheel') && !mName.includes('glass')) {
            this.bodyMaterials.push(mesh.material);
          }
        }
      }
      this.bodyMaterial = this.bodyMaterials[0] || null;
    }

    for (const mat of this.bodyMaterials) {
      mat.albedoColor = paint.color.clone();
      mat.roughness = paint.roughness;
      mat.metallic = paint.metallic;
    }
  }

  public dispose(): void {
    for (const mesh of this.meshes) {
      mesh.dispose();
    }
    this.meshes = [];
    for (const node of this.transformNodes) {
      node.dispose();
    }
    this.transformNodes = [];
    this.wheelMeshes = [];
    this.wheels = { frontLeft: null, frontRight: null, rearLeft: null, rearRight: null };
    if (this.bodyMaterial) {
      this.bodyMaterial.dispose();
      this.bodyMaterial = null;
    }
    this.bodyMaterials = [];
    if (this.contactShadow) {
      this.contactShadow.dispose();
      this.contactShadow = null;
    }
    this.resetBodyMotion();
    this.modelContainer.dispose();
    this.rootNode.dispose();
  }
}
