import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  TransformNode,
  AbstractMesh,
  DynamicTexture,
} from '@babylonjs/core';
import { RaceEventConfig, DEFAULT_EVENT } from '../events/EventConfig';

export interface CheckpointData {
  id: string;
  order: number;
  position: Vector3;
  direction: Vector3; // normalized forward crossing direction
  width: number;
}

export class CheckpointManager {
  private scene: Scene;
  public checkpoints: CheckpointData[] = []; // All registered checkpoints
  public activeCheckpoints: CheckpointData[] = []; // Checkpoints for active event
  public activeEvent: RaceEventConfig = DEFAULT_EVENT;
  public currentCheckpointIndex: number = 0;
  public lapCount: number = 0;
  public lastCrossedCheckpoint: CheckpointData | null = null;
  public rootNode: TransformNode;
  private visualMeshes: AbstractMesh[] = [];
  private bannerMeshes: Map<string, AbstractMesh> = new Map();

  // Banner materials
  private finishBannerMat: StandardMaterial | null = null;
  private sprintFinishBannerMat: StandardMaterial | null = null;
  private sprintStartBannerMat: StandardMaterial | null = null;
  private sectorBannerMat: StandardMaterial | null = null;

  public onLapCompleted?: (lap: number) => void;
  public onSprintCompleted?: () => void;

  constructor(scene: Scene) {
    this.scene = scene;
    this.rootNode = new TransformNode('CheckpointsRoot', this.scene);
  }

  public clearVisualGates(): void {
    for (const mesh of this.visualMeshes) {
      mesh.dispose(false, true);
    }
    this.visualMeshes = [];
    this.bannerMeshes.clear();

    const children = this.rootNode.getChildren(undefined, false);
    for (const child of children) {
      child.dispose(false, true);
    }
  }

  public registerCheckpoints(checkpoints: CheckpointData[]): void {
    this.clearVisualGates();
    this.checkpoints = checkpoints.sort((a, b) => a.order - b.order);
    this.createBannerMaterials();
    this.createVisualGates();
    this.setActiveEvent(this.activeEvent);
  }

  public setActiveEvent(event: RaceEventConfig): void {
    this.activeEvent = event;

    // Filter and order active checkpoints according to event configuration
    this.activeCheckpoints = [];
    for (const cpId of event.checkpointIds) {
      const cp = this.checkpoints.find((c) => c.id === cpId);
      if (cp) {
        this.activeCheckpoints.push(cp);
      }
    }

    // If fallback needed
    if (this.activeCheckpoints.length === 0) {
      this.activeCheckpoints = [...this.checkpoints];
    }

    this.resetProgress();
    this.updateBannerMaterials();
  }

  private createBannerMaterials(): void {
    // 1. Time Trial Start / Finish Gantry Banner (Gold Chequered)
    const finishBannerTex = new DynamicTexture(
      'FinishBannerTex',
      { width: 512, height: 128 },
      this.scene,
      false
    );
    const fCtx = finishBannerTex.getContext() as CanvasRenderingContext2D;
    if (fCtx) {
      fCtx.fillStyle = '#12161a';
      fCtx.fillRect(0, 0, 512, 128);
      const sq = 16;
      for (let x = 0; x < 512; x += sq) {
        fCtx.fillStyle = (x / sq) % 2 === 0 ? '#f5c422' : '#111111';
        fCtx.fillRect(x, 0, sq, 16);
        fCtx.fillRect(x, 112, sq, 16);
      }
      fCtx.fillStyle = '#ffffff';
      fCtx.font = 'bold 44px sans-serif';
      fCtx.textAlign = 'center';
      fCtx.textBaseline = 'middle';
      fCtx.fillText('START / FINISH', 256, 64);
      finishBannerTex.update();
    }
    this.finishBannerMat = new StandardMaterial('FinishBannerMat', this.scene);
    this.finishBannerMat.diffuseTexture = finishBannerTex;
    this.finishBannerMat.emissiveColor = new Color3(0.3, 0.27, 0.12);
    this.finishBannerMat.backFaceCulling = false;

    // 2. Sprint Finish Banner (Red Chequered Motorsport Finish)
    const sprintFinishTex = new DynamicTexture(
      'SprintFinishBannerTex',
      { width: 512, height: 128 },
      this.scene,
      false
    );
    const sfCtx = sprintFinishTex.getContext() as CanvasRenderingContext2D;
    if (sfCtx) {
      sfCtx.fillStyle = '#180a0a';
      sfCtx.fillRect(0, 0, 512, 128);
      const sq = 16;
      for (let x = 0; x < 512; x += sq) {
        sfCtx.fillStyle = (x / sq) % 2 === 0 ? '#e10600' : '#ffffff';
        sfCtx.fillRect(x, 0, sq, 16);
        sfCtx.fillRect(x, 112, sq, 16);
      }
      sfCtx.fillStyle = '#ffffff';
      sfCtx.font = 'bold 44px sans-serif';
      sfCtx.textAlign = 'center';
      sfCtx.textBaseline = 'middle';
      sfCtx.fillText('★ SPRINT FINISH ★', 256, 64);
      sprintFinishTex.update();
    }
    this.sprintFinishBannerMat = new StandardMaterial('SprintFinishBannerMat', this.scene);
    this.sprintFinishBannerMat.diffuseTexture = sprintFinishTex;
    this.sprintFinishBannerMat.emissiveColor = new Color3(0.35, 0.08, 0.08);
    this.sprintFinishBannerMat.backFaceCulling = false;

    // 3. Sprint Start Banner
    const sprintStartTex = new DynamicTexture(
      'SprintStartBannerTex',
      { width: 512, height: 128 },
      this.scene,
      false
    );
    const ssCtx = sprintStartTex.getContext() as CanvasRenderingContext2D;
    if (ssCtx) {
      ssCtx.fillStyle = '#12161a';
      ssCtx.fillRect(0, 0, 512, 128);
      const sq = 16;
      for (let x = 0; x < 512; x += sq) {
        ssCtx.fillStyle = (x / sq) % 2 === 0 ? '#00e5ff' : '#111111';
        ssCtx.fillRect(x, 0, sq, 16);
        ssCtx.fillRect(x, 112, sq, 16);
      }
      ssCtx.fillStyle = '#ffffff';
      ssCtx.font = 'bold 44px sans-serif';
      ssCtx.textAlign = 'center';
      ssCtx.textBaseline = 'middle';
      ssCtx.fillText('SPRINT START', 256, 64);
      sprintStartTex.update();
    }
    this.sprintStartBannerMat = new StandardMaterial('SprintStartBannerMat', this.scene);
    this.sprintStartBannerMat.diffuseTexture = sprintStartTex;
    this.sprintStartBannerMat.emissiveColor = new Color3(0.08, 0.28, 0.32);
    this.sprintStartBannerMat.backFaceCulling = false;

    // 4. Sector Checkpoint Banner Texture (Cyan/Blue)
    const sectorBannerTex = new DynamicTexture(
      'SectorBannerTex',
      { width: 512, height: 128 },
      this.scene,
      false
    );
    const sCtx = sectorBannerTex.getContext() as CanvasRenderingContext2D;
    if (sCtx) {
      sCtx.fillStyle = '#101c28';
      sCtx.fillRect(0, 0, 512, 128);
      sCtx.fillStyle = '#1a82d2';
      sCtx.fillRect(0, 0, 512, 12);
      sCtx.fillRect(0, 116, 512, 12);
      sCtx.fillStyle = '#00e5ff';
      sCtx.fillRect(0, 12, 512, 4);
      sCtx.fillRect(0, 112, 512, 4);
      sCtx.fillStyle = '#ffffff';
      sCtx.font = 'bold 40px sans-serif';
      sCtx.textAlign = 'center';
      sCtx.textBaseline = 'middle';
      sCtx.fillText('SPEED TIMING SECTOR', 256, 64);
      sectorBannerTex.update();
    }
    this.sectorBannerMat = new StandardMaterial('SectorBannerMat', this.scene);
    this.sectorBannerMat.diffuseTexture = sectorBannerTex;
    this.sectorBannerMat.emissiveColor = new Color3(0.12, 0.24, 0.35);
    this.sectorBannerMat.backFaceCulling = false;
  }

  private updateBannerMaterials(): void {
    if (!this.sectorBannerMat || !this.finishBannerMat || !this.sprintFinishBannerMat) return;

    for (const [cpId, bannerMesh] of this.bannerMeshes.entries()) {
      if (this.activeEvent.mode === 'sprint') {
        if (cpId === this.activeEvent.finishCheckpointId) {
          bannerMesh.material = this.sprintFinishBannerMat;
        } else if (cpId === 'CP_0_START_FINISH') {
          bannerMesh.material = this.sprintStartBannerMat || this.finishBannerMat;
        } else {
          bannerMesh.material = this.sectorBannerMat;
        }
      } else {
        // Time trial mode
        if (cpId === 'CP_0_START_FINISH') {
          bannerMesh.material = this.finishBannerMat;
        } else {
          bannerMesh.material = this.sectorBannerMat;
        }
      }
    }
  }

  private createVisualGates(): void {
    // Clear previous
    this.visualMeshes.forEach((m) => m.dispose());
    this.visualMeshes = [];
    this.bannerMeshes.clear();

    const steelMat = new StandardMaterial('GantrySteelMat', this.scene);
    steelMat.diffuseColor = new Color3(0.18, 0.2, 0.22);
    steelMat.specularColor = new Color3(0.15, 0.15, 0.15);

    const footingMat = new StandardMaterial('GantryFootingMat', this.scene);
    footingMat.diffuseColor = new Color3(0.65, 0.67, 0.68);
    footingMat.specularColor = new Color3(0.04, 0.04, 0.04);

    for (const cp of this.checkpoints) {
      const perp = new Vector3(-cp.direction.z, 0, cp.direction.x).normalize();
      const halfWidth = cp.width * 0.5;

      // Left Concrete Footing
      const leftFooting = MeshBuilder.CreateCylinder(
        `Footing_L_${cp.id}`,
        { height: 0.35, diameter: 0.65, tessellation: 8 },
        this.scene
      );
      leftFooting.position = cp.position.add(perp.scale(-halfWidth)).add(new Vector3(0, 0.175, 0));
      leftFooting.material = footingMat;
      leftFooting.parent = this.rootNode;
      leftFooting.isPickable = false;

      // Left Steel Pylon
      const leftPost = MeshBuilder.CreateCylinder(
        `Gate_L_${cp.id}`,
        { height: 3.6, diameter: 0.28, tessellation: 8 },
        this.scene
      );
      leftPost.position = cp.position.add(perp.scale(-halfWidth)).add(new Vector3(0, 1.8, 0));
      leftPost.material = steelMat;
      leftPost.parent = this.rootNode;
      leftPost.isPickable = false;

      // Right Concrete Footing
      const rightFooting = MeshBuilder.CreateCylinder(
        `Footing_R_${cp.id}`,
        { height: 0.35, diameter: 0.65, tessellation: 8 },
        this.scene
      );
      rightFooting.position = cp.position.add(perp.scale(halfWidth)).add(new Vector3(0, 0.175, 0));
      rightFooting.material = footingMat;
      rightFooting.parent = this.rootNode;
      rightFooting.isPickable = false;

      // Right Steel Pylon
      const rightPost = MeshBuilder.CreateCylinder(
        `Gate_R_${cp.id}`,
        { height: 3.6, diameter: 0.28, tessellation: 8 },
        this.scene
      );
      rightPost.position = cp.position.add(perp.scale(halfWidth)).add(new Vector3(0, 1.8, 0));
      rightPost.material = steelMat;
      rightPost.parent = this.rootNode;
      rightPost.isPickable = false;

      // Overhead Structural Steel Crossbeam
      const beam = MeshBuilder.CreateBox(
        `Gate_Beam_${cp.id}`,
        { width: 0.3, height: 0.3, depth: cp.width },
        this.scene
      );
      beam.position = cp.position.add(new Vector3(0, 3.6, 0));
      beam.rotation.y = Math.atan2(perp.x, perp.z);
      beam.material = steelMat;
      beam.parent = this.rootNode;
      beam.isPickable = false;

      // Facing Motorsport Timing Banner
      const banner = MeshBuilder.CreatePlane(
        `Gate_Banner_${cp.id}`,
        { width: cp.width * 0.72, height: 0.7 },
        this.scene
      );
      banner.position = cp.position.add(new Vector3(0, 3.15, 0));
      banner.rotation.y = Math.atan2(cp.direction.x, cp.direction.z);
      banner.material = this.sectorBannerMat;
      banner.parent = this.rootNode;
      banner.isPickable = false;

      this.bannerMeshes.set(cp.id, banner);
      this.visualMeshes.push(leftFooting, leftPost, rightFooting, rightPost, beam, banner);
    }
  }

  /**
   * Checks if vehicle crossed the next expected checkpoint in order.
   * Continuous trajectory plane intersection test.
   */
  public update(prevPos: Vector3, curPos: Vector3): boolean {
    if (this.activeCheckpoints.length === 0) return false;
    if (this.currentCheckpointIndex >= this.activeCheckpoints.length) return false;

    const targetCP = this.activeCheckpoints[this.currentCheckpointIndex];
    if (!targetCP) return false;

    // Vector from checkpoint center to positions
    const vPrev = prevPos.subtract(targetCP.position);
    const vCur = curPos.subtract(targetCP.position);

    // Dot product with checkpoint forward direction:
    // Negative when behind checkpoint, positive when in front
    const dPrev = Vector3.Dot(vPrev, targetCP.direction);
    const dCur = Vector3.Dot(vCur, targetCP.direction);

    // Crossed from behind to in-front (or right through plane)
    if (dPrev <= 0 && dCur >= 0) {
      // Check lateral distance along perpendicular axis
      const perp = new Vector3(-targetCP.direction.z, 0, targetCP.direction.x).normalize();
      const lateralDist = Math.abs(Vector3.Dot(vCur, perp));

      // Within gate crossing width
      if (lateralDist <= targetCP.width * 0.55) {
        this.lastCrossedCheckpoint = targetCP;

        if (this.activeEvent.mode === 'drift') {
          // Drift mode: loop around the circuit seamlessly without lap limits
          this.currentCheckpointIndex = (this.currentCheckpointIndex + 1) % this.activeCheckpoints.length;
          return true;
        } else if (this.activeEvent.mode === 'sprint') {
          // Sprint mode: strictly sequential. Check if this is the finish gate.
          const isFinishGate = this.currentCheckpointIndex === this.activeCheckpoints.length - 1;
          if (isFinishGate) {
            this.currentCheckpointIndex++;
            if (this.onSprintCompleted) {
              this.onSprintCompleted();
            }
            return true;
          } else {
            this.currentCheckpointIndex++;
            return true;
          }
        } else {
          // Time trial mode: loop
          const isLastGate = this.currentCheckpointIndex === this.activeCheckpoints.length - 1;
          if (isLastGate) {
            this.lapCount++;
            if (this.onLapCompleted) {
              this.onLapCompleted(this.lapCount);
            }
            this.currentCheckpointIndex = 0;
            return true;
          } else {
            this.currentCheckpointIndex++;
            return true;
          }
        }
      }
    }

    return false;
  }

  public getCurrentGateNumber(): number {
    return Math.min(this.currentCheckpointIndex + 1, this.activeCheckpoints.length);
  }

  public getTotalGates(): number {
    return this.activeCheckpoints.length;
  }

  public getLatestResetTransform(): { position: Vector3; yaw: number } {
    if (this.lastCrossedCheckpoint) {
      const yaw = Math.atan2(
        this.lastCrossedCheckpoint.direction.x,
        this.lastCrossedCheckpoint.direction.z
      );
      return {
        position: this.lastCrossedCheckpoint.position.clone(),
        yaw,
      };
    }

    // Default to active event start position and yaw
    return {
      position: this.activeEvent.startPosition.clone(),
      yaw: this.activeEvent.startYaw,
    };
  }

  public resetProgress(): void {
    this.currentCheckpointIndex = 0;
    this.lapCount = 0;
    this.lastCrossedCheckpoint = null;
  }

  public dispose(): void {
    this.visualMeshes.forEach((m) => m.dispose());
    this.visualMeshes = [];
    this.bannerMeshes.clear();
    this.finishBannerMat?.dispose();
    this.sprintFinishBannerMat?.dispose();
    this.sprintStartBannerMat?.dispose();
    this.sectorBannerMat?.dispose();
    this.rootNode.dispose();
  }
}
