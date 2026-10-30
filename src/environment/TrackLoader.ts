import {
  Scene,
  TransformNode,
  Vector3,
  SceneLoader,
  AbstractMesh,
  Mesh,
  PBRMaterial,
  Texture,
  DynamicTexture,
  VertexBuffer,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { CheckpointData } from '../checkpoints/CheckpointManager';
import { CircuitDefinition, TrackSectionConfig } from '../tracks/TrackConfig';
import { ForestValleyCircuit } from '../tracks/ForestValleyCircuit';
import { RoadMeshBuilder } from './RoadMeshBuilder';

export type { TrackSectionConfig };

export class TrackLoader {
  private scene: Scene;
  public trackRoot: TransformNode;
  public currentCircuit: CircuitDefinition | null = null;
  public startPosition: Vector3 = new Vector3(1.8, 0.05, -10.0);
  public startForward: Vector3 = new Vector3(0, 0, 1);
  public roadSurfaceY: number = 0.05;
  public pieces: AbstractMesh[] = [];
  public checkpoints: CheckpointData[] = [];
  public masterTrackMaterial: PBRMaterial | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.trackRoot = new TransformNode('TrackRoot', this.scene);
  }

  /**
   * Unloads and disposes all meshes, markings, verges, and scenery associated with current circuit.
   */
  public unloadCurrentCircuit(): void {
    // Dispose all child meshes and transforms under trackRoot
    const children = this.trackRoot.getChildren(undefined, false);
    for (const child of children) {
      child.dispose(false, true);
    }

    this.pieces = [];
    this.checkpoints = [];
    this.currentCircuit = null;
  }

  /**
   * Loads any CircuitDefinition with complete tile geometry, markings, verges, infrastructure, and scenery.
   */
  public async loadCircuit(
    circuit: CircuitDefinition,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    if (this.currentCircuit && this.currentCircuit.id === circuit.id) {
      if (onProgress) onProgress(1.0);
      return;
    }

    this.unloadCurrentCircuit();
    this.currentCircuit = circuit;

    this.roadSurfaceY = circuit.roadSurfaceY;
    this.startPosition = circuit.startPosition.clone();
    this.startForward = new Vector3(Math.sin(circuit.startYaw), 0, Math.cos(circuit.startYaw));
    this.checkpoints = [...circuit.checkpoints];

    // Ensure Master Track Material with asphalt detail noise is ready
    if (!this.masterTrackMaterial) {
      this.createMasterTrackMaterial();
    }

    if (circuit.roadSamples && circuit.roadSamples.length > 0) {
      const roadBuilder = new RoadMeshBuilder(this.scene);
      const segmentCount = Math.max(98, Math.round(circuit.measuredLengthMeters / 30));
      const roadMeshes = roadBuilder.buildRoadSegments(
        this.trackRoot,
        circuit.roadSamples,
        segmentCount,
        13.0,
        this.roadSurfaceY
      );
      for (const rMesh of roadMeshes) {
        this.pieces.push(rMesh);
      }

      const edgeLines = roadBuilder.buildWhiteEdgeLines(
        this.trackRoot,
        circuit.roadSamples,
        13.0,
        0.22,
        this.roadSurfaceY
      );
      for (const el of edgeLines) {
        this.pieces.push(el);
      }

      const kerbs = roadBuilder.buildKerbs(
        this.trackRoot,
        circuit.roadSamples,
        13.0,
        0.85,
        this.roadSurfaceY
      );
      for (const k of kerbs) {
        this.pieces.push(k);
      }

      const verges = roadBuilder.buildVerges(
        this.trackRoot,
        circuit.roadSamples,
        13.0,
        4.5,
        this.roadSurfaceY
      );
      for (const v of verges) {
        this.pieces.push(v);
      }

      if (onProgress) {
        onProgress(0.7);
      }
    } else {
      const sections = circuit.sections;
      const total = sections.length;

      // Load modular GLB tiles
      for (let i = 0; i < total; i++) {
        const section = sections[i];
        const result = await SceneLoader.ImportMeshAsync(
          '',
          './assets/tracks/',
          section.file,
          this.scene
        );

        const sectionRoot = new TransformNode(`Section_${circuit.id}_${i}_${section.file}`, this.scene);
        sectionRoot.parent = this.trackRoot;
        sectionRoot.position.copyFrom(section.position);
        if (section.rotationY) {
          sectionRoot.rotation.y = section.rotationY;
        }

        for (const mesh of result.meshes) {
          if (!mesh.parent || mesh.parent === this.scene.getMeshByName('__root__')) {
            mesh.parent = sectionRoot;
          }
          mesh.isPickable = true;
          mesh.receiveShadows = true;

          if (mesh instanceof Mesh && mesh.name !== '__root__') {
            if (this.masterTrackMaterial) {
              mesh.material = this.masterTrackMaterial;
            }
            this.applyWorldSpaceUV2(mesh);
            this.pieces.push(mesh);
          }
        }

        if (onProgress) {
          onProgress((i + 1) / (total + 3));
        }
      }
    }

    // Build circuit-specific continuous road markings
    circuit.buildRoadMarkings(this.scene, this.trackRoot, this.roadSurfaceY);

    // Build circuit-specific runoffs/verges
    circuit.buildRoadVerges(this.scene, this.trackRoot, this.roadSurfaceY);

    // Build circuit-specific distance boards & barriers
    circuit.buildRoadsideInfrastructure(this.scene, this.trackRoot, this.roadSurfaceY);

    // Build circuit-specific instanced scenery (forest pines/oaks vs coastal palms/cypresses/rocks)
    await circuit.buildScenery(this.scene, this.trackRoot);

    if (onProgress) {
      onProgress(1.0);
    }
  }

  /**
   * Backward compatibility entrypoint loading the primary Forest Valley Grand Course.
   */
  public async loadFullCircuit(onProgress?: (progress: number) => void): Promise<void> {
    await this.loadCircuit(ForestValleyCircuit, onProgress);
  }

  private createMasterTrackMaterial(): void {
    const mat = new PBRMaterial('MasterTrackMaterial', this.scene);
    const colormapTex = new Texture('./assets/tracks/colormap.png', this.scene, false, false);
    mat.albedoTexture = colormapTex;
    mat.roughness = 0.82;
    mat.metallic = 0.04;

    // Procedural asphalt micro-aggregate noise texture
    const noiseTex = new DynamicTexture('AsphaltDetailNoise', { width: 512, height: 512 }, this.scene, true);
    const ctx = noiseTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 512, 512);

      const imgData = ctx.getImageData(0, 0, 512, 512);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const n = (Math.random() - 0.5) * 58;
        const v = Math.max(0, Math.min(255, 128 + n));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      noiseTex.update();
    }

    noiseTex.coordinatesIndex = 1;
    mat.ambientTexture = noiseTex;
    mat.ambientTextureStrength = 0.55;

    this.masterTrackMaterial = mat;
  }

  private applyWorldSpaceUV2(mesh: Mesh): void {
    mesh.computeWorldMatrix(true);
    const worldMat = mesh.getWorldMatrix();
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    if (!positions) return;

    const uv2: number[] = [];
    for (let p = 0; p < positions.length; p += 3) {
      const local = new Vector3(positions[p], positions[p + 1], positions[p + 2]);
      const world = Vector3.TransformCoordinates(local, worldMat);
      uv2.push(world.x * 0.30, world.z * 0.30);
    }
    mesh.setVerticesData(VertexBuffer.UV2Kind, uv2);
  }
}
