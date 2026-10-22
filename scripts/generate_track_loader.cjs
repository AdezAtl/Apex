const fs = require('fs');

// Read the generated sections
const sectionsStr = fs.readFileSync('scripts/sections_output.ts', 'utf8');

// Road markings data
// Centerlines along all major straights
// Straights list:
// 1. North Straight: X=0, Z from -16 to 104 (gap at 0)
// 2. East Blast: Z=110, X from 6 to 34
// 3. Infield Drop: X=40, Z from 104 to 76
// 4. Chicane Mid: Z=70, X from 46 to 74
// 5. South Descent: X=80, Z from 64 to 26
// 6. Carousel Top: Z=20, X from 74 down to 56
// 7. Carousel Drop: X=50, Z from 14 down to -4
// 8. East Shoot: Z=-10, X from 56 to 114
// 9. Grand Back Straight: X=120, Z from -16 down to -144
// 10. South Sweeper: Z=-150, X from 114 down to 76
// 11. Arena Infield: X=70, Z from -144 up to -116
// 12. Arena Drift Sweeper: Z=-110, X from 64 down to 16
// 13. Arena Hairpin: X=10, Z from -116 down to -144
// 14. Outer Link: Z=-150, X from 4 down to -34
// 15. West Return Straight: X=-40, Z from -144 up to -26
// 16. Pit Approach: Z=-20, X from -34 to -6

const trackLoaderContent = `import {
  Scene,
  TransformNode,
  Vector3,
  SceneLoader,
  AbstractMesh,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Texture,
  DynamicTexture,
  Color3,
  VertexBuffer,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { CheckpointData } from '../checkpoints/CheckpointManager';

export interface TrackSectionConfig {
  file: string;
  position: Vector3;
  rotationY?: number;
}

export class TrackLoader {
  private scene: Scene;
  public trackRoot: TransformNode;
  public startPosition: Vector3 = new Vector3(0, 0.05, -2.0);
  public startForward: Vector3 = new Vector3(0, 0, 1);
  public roadSurfaceY: number = 0.05;
  public pieces: AbstractMesh[] = [];
  public checkpoints: CheckpointData[] = [];
  public masterTrackMaterial: PBRMaterial | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.trackRoot = new TransformNode('TrackRoot', this.scene);
  }

  public async loadFullCircuit(onProgress?: (progress: number) => void): Promise<void> {
    // 98-segment (980 meters) expanded motorsport circuit
    ${sectionsStr}

    // Create single shared, optimized Master Track Material with procedural asphalt micro-texture
    this.createMasterTrackMaterial();

    const total = circuitSections.length;

    // Load and configure all 98 circuit tiles
    for (let i = 0; i < total; i++) {
      const section = circuitSections[i];
      const result = await SceneLoader.ImportMeshAsync(
        '',
        './assets/tracks/',
        section.file,
        this.scene
      );

      const sectionRoot = new TransformNode(\`Section_\${i}_\${section.file}\`, this.scene);
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

        if (mesh instanceof Mesh) {
          if (this.masterTrackMaterial) {
            mesh.material = this.masterTrackMaterial;
          }
          this.applyWorldSpaceUV2(mesh);
        }

        this.pieces.push(mesh);
      }

      if (onProgress) {
        onProgress((i + 1) / (total + 2));
      }
    }

    // Add continuous motorsport painted road markings
    this.createRoadMarkings();

    // Add roadside gravel/earth verges bridging track to terrain
    this.createRoadVerges();

    // Add roadside infrastructure: distance braking boards and tire barrier cushions
    this.createRoadsideInfrastructure();

    // Load and distribute multi-archetype instanced forest scenery
    await this.createForestScenery();

    if (onProgress) {
      onProgress(1.0);
    }

    this.roadSurfaceY = 0.05;
    this.startPosition = new Vector3(0, this.roadSurfaceY, -2.0);
    this.startForward = new Vector3(0, 0, 1);

    // Setup 10 ordered checkpoints along the 980m circuit
    this.checkpoints = [
      {
        id: 'CP_0_START_FINISH',
        order: 0,
        position: new Vector3(0, this.roadSurfaceY, 0),
        direction: new Vector3(0, 0, 1),
        width: 8.0,
      },
      {
        id: 'CP_1_NORTH_ENTRY',
        order: 1,
        position: new Vector3(0, this.roadSurfaceY, 90),
        direction: new Vector3(0, 0, 1),
        width: 8.0,
      },
      {
        id: 'CP_2_EAST_CHUTE',
        order: 2,
        position: new Vector3(40, this.roadSurfaceY, 90),
        direction: new Vector3(0, 0, -1),
        width: 8.0,
      },
      {
        id: 'CP_3_INFIELD_DESCENT',
        order: 3,
        position: new Vector3(80, this.roadSurfaceY, 50),
        direction: new Vector3(0, 0, -1),
        width: 8.0,
      },
      {
        id: 'CP_4_CAROUSEL_SHOOT',
        order: 4,
        position: new Vector3(80, this.roadSurfaceY, -10),
        direction: new Vector3(1, 0, 0),
        width: 8.0,
      },
      {
        id: 'CP_5_BACK_STRAIGHT_LAUNCH',
        order: 5,
        position: new Vector3(120, this.roadSurfaceY, -30),
        direction: new Vector3(0, 0, -1),
        width: 8.0,
      },
      {
        id: 'CP_6_BACK_STRAIGHT_BRAKING',
        order: 6,
        position: new Vector3(120, this.roadSurfaceY, -130),
        direction: new Vector3(0, 0, -1),
        width: 8.0,
      },
      {
        id: 'CP_7_ARENA_DRIFT_SWEEPER',
        order: 7,
        position: new Vector3(40, this.roadSurfaceY, -110),
        direction: new Vector3(-1, 0, 0),
        width: 8.0,
      },
      {
        id: 'CP_8_WEST_STRAIGHT_ENTRY',
        order: 8,
        position: new Vector3(-40, this.roadSurfaceY, -130),
        direction: new Vector3(0, 0, 1),
        width: 8.0,
      },
      {
        id: 'CP_9_WEST_STRAIGHT_MID',
        order: 9,
        position: new Vector3(-40, this.roadSurfaceY, -50),
        direction: new Vector3(0, 0, 1),
        width: 8.0,
      },
    ];
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

  private createRoadMarkings(): void {
    const markingPlanes: Mesh[] = [];
    const whiteMat = new StandardMaterial('RoadMarkingWhiteMat', this.scene);
    whiteMat.diffuseColor = new Color3(0.92, 0.94, 0.96);
    whiteMat.specularColor = new Color3(0.08, 0.08, 0.08);

    const lineThickness = 0.14;
    const yMarking = 0.052;

    // Outer Boundary lines helper along Z straights
    const addZBoundaries = (name: string, centerX: number, zMin: number, zMax: number) => {
      const depth = zMax - zMin;
      const centerZ = (zMin + zMax) / 2;
      markingPlanes.push(
        this.createMarkingStrip(\`\${name}_L\`, new Vector3(centerX - 3.75, yMarking, centerZ), lineThickness, depth, 0),
        this.createMarkingStrip(\`\${name}_R\`, new Vector3(centerX + 3.75, yMarking, centerZ), lineThickness, depth, 0)
      );
    };

    // Outer Boundary lines helper along X straights
    const addXBoundaries = (name: string, centerZ: number, xMin: number, xMax: number) => {
      const width = xMax - xMin;
      const centerX = (xMin + xMax) / 2;
      markingPlanes.push(
        this.createMarkingStrip(\`\${name}_T\`, new Vector3(centerX, yMarking, centerZ + 3.75), width, lineThickness, 0),
        this.createMarkingStrip(\`\${name}_B\`, new Vector3(centerX, yMarking, centerZ - 3.75), width, lineThickness, 0)
      );
    };

    // 1. Boundary lines on all 16 straights
    addZBoundaries('Line_Main', 0, -15, 105);
    addXBoundaries('Line_T1_East', 110, 5, 35);
    addZBoundaries('Line_Infield_Drop', 40, 75, 105);
    addXBoundaries('Line_Chicane_Mid', 70, 45, 75);
    addZBoundaries('Line_South_Descent', 80, 25, 65);
    addXBoundaries('Line_Carousel_Top', 20, 55, 75);
    addZBoundaries('Line_Carousel_Drop', 50, -5, 15);
    addXBoundaries('Line_East_Shoot', -10, 55, 115);
    addZBoundaries('Line_Grand_Back', 120, -145, -15);
    addXBoundaries('Line_South_Sweeper', -150, 75, 115);
    addZBoundaries('Line_Arena_Infield', 70, -145, -115);
    addXBoundaries('Line_Arena_Drift', -110, 15, 65);
    addZBoundaries('Line_Arena_Hairpin', 10, -145, -115);
    addXBoundaries('Line_Outer_Link', -150, -35, 5);
    addZBoundaries('Line_West_Return', -40, -145, -25);
    addXBoundaries('Line_Pit_Approach', -20, -35, -5);

    // 2. Dashed Centerline Markings (2.5m dash, 3.5m gap = 6m period)
    const addZDashes = (centerX: number, zMin: number, zMax: number, skipZero: boolean = false) => {
      for (let z = zMin; z <= zMax; z += 6.0) {
        if (skipZero && Math.abs(z) < 3.0) continue;
        markingPlanes.push(this.createMarkingStrip(\`Dash_Z_\${centerX}_\${z}\`, new Vector3(centerX, yMarking, z), 0.16, 2.5, 0));
      }
    };
    const addXDashes = (centerZ: number, xMin: number, xMax: number) => {
      for (let x = xMin; x <= xMax; x += 6.0) {
        markingPlanes.push(this.createMarkingStrip(\`Dash_X_\${x}_\${centerZ}\`, new Vector3(x, yMarking, centerZ), 2.5, 0.16, 0));
      }
    };

    addZDashes(0, -12, 102, true);
    addXDashes(110, 8, 32);
    addZDashes(40, 78, 102);
    addXDashes(70, 48, 72);
    addZDashes(80, 28, 62);
    addXDashes(20, 58, 72);
    addZDashes(50, -2, 12);
    addXDashes(-10, 58, 112);
    addZDashes(120, -142, -18);
    addXDashes(-150, 78, 112);
    addZDashes(70, -142, -118);
    addXDashes(-110, 18, 62);
    addZDashes(10, -142, -118);
    addXDashes(-150, -32, 2);
    addZDashes(-40, -142, -28);
    addXDashes(-20, -32, -8);

    // 3. Staggered Starting Grid Boxes before Finish Line
    const gridPositions = [
      { x: -1.6, z: -3.5 },
      { x: 1.6, z: -6.5 },
      { x: -1.6, z: -9.5 },
      { x: 1.6, z: -12.5 },
    ];
    for (let g = 0; g < gridPositions.length; g++) {
      const gp = gridPositions[g];
      markingPlanes.push(this.createMarkingStrip(\`Grid_F_\${g}\`, new Vector3(gp.x, yMarking, gp.z), 1.9, 0.12, 0));
      markingPlanes.push(this.createMarkingStrip(\`Grid_L_\${g}\`, new Vector3(gp.x - 0.95, yMarking, gp.z - 0.5), 0.10, 1.0, 0));
      markingPlanes.push(this.createMarkingStrip(\`Grid_R_\${g}\`, new Vector3(gp.x + 0.95, yMarking, gp.z - 0.5), 0.10, 1.0, 0));
    }

    // Merge road markings into a single static mesh (1 draw call)
    if (markingPlanes.length > 0) {
      const mergedMarkings = Mesh.MergeMeshes(markingPlanes, true, true, undefined, false, true);
      if (mergedMarkings) {
        mergedMarkings.name = 'CircuitRoadMarkings';
        mergedMarkings.parent = this.trackRoot;
        mergedMarkings.material = whiteMat;
        mergedMarkings.isPickable = false;
        mergedMarkings.receiveShadows = true;
      }
    }
  }

  private createMarkingStrip(name: string, pos: Vector3, width: number, depth: number, rotY: number = 0): Mesh {
    const strip = MeshBuilder.CreatePlane(name, { width, height: depth }, this.scene);
    strip.rotation.x = Math.PI / 2;
    if (rotY) strip.rotation.y = rotY;
    strip.position.copyFrom(pos);
    return strip;
  }

  private createRoadVerges(): void {
    const vergePlanes: Mesh[] = [];
    const yVerge = 0.015;

    // Outer gravel shoulders along straights
    vergePlanes.push(
      this.createMarkingStrip('Verge_Main_L', new Vector3(-6.1, yVerge, 45), 2.2, 125),
      this.createMarkingStrip('Verge_Main_R', new Vector3(6.1, yVerge, 45), 2.2, 125),
      this.createMarkingStrip('Verge_T1_E', new Vector3(20, yVerge, 116.1), 35, 2.2),
      this.createMarkingStrip('Verge_Back_R', new Vector3(126.1, yVerge, -80), 2.2, 135),
      this.createMarkingStrip('Verge_South_B', new Vector3(95, yVerge, -156.1), 45, 2.2),
      this.createMarkingStrip('Verge_West_L', new Vector3(-46.1, yVerge, -85), 2.2, 125)
    );

    // Corner Runoff Beds at high-speed exits
    vergePlanes.push(
      this.createMarkingStrip('Runoff_T1', new Vector3(-1.0, yVerge, 117.5), 14, 8),
      this.createMarkingStrip('Runoff_T2', new Vector3(47.5, yVerge, 117.5), 12, 12),
      this.createMarkingStrip('Runoff_T8', new Vector3(127.5, yVerge, -2.5), 12, 12),
      this.createMarkingStrip('Runoff_T9', new Vector3(127.5, yVerge, -157.5), 12, 12),
      this.createMarkingStrip('Runoff_T13', new Vector3(-47.5, yVerge, -157.5), 12, 12),
      this.createMarkingStrip('Runoff_T15', new Vector3(-47.5, yVerge, -13.5), 12, 12)
    );

    if (vergePlanes.length > 0) {
      const mergedVerge = Mesh.MergeMeshes(vergePlanes, true, true, undefined, false, true);
      if (mergedVerge) {
        mergedVerge.name = 'CircuitRoadVerges';
        mergedVerge.parent = this.trackRoot;
        const vergeMat = new StandardMaterial('VergeGravelMat', this.scene);

        const gravelTex = new DynamicTexture('GravelNoiseTex', { width: 256, height: 256 }, this.scene, true);
        const gCtx = gravelTex.getContext() as CanvasRenderingContext2D;
        if (gCtx) {
          gCtx.fillStyle = '#4a4235';
          gCtx.fillRect(0, 0, 256, 256);
          const tones = ['#383228', '#5a5040', '#635948', '#322b22', '#726754', '#847967'];
          for (let i = 0; i < 2400; i++) {
            const x = Math.random() * 256;
            const y = Math.random() * 256;
            const rad = 0.8 + Math.random() * 1.8;
            gCtx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
            gCtx.beginPath();
            gCtx.arc(x, y, rad, 0, Math.PI * 2);
            gCtx.fill();
          }
          gravelTex.update();
        }
        gravelTex.uScale = 12;
        gravelTex.vScale = 12;
        vergeMat.diffuseTexture = gravelTex;
        vergeMat.diffuseColor = new Color3(0.85, 0.82, 0.78);
        vergeMat.specularColor = new Color3(0.02, 0.02, 0.02);
        mergedVerge.material = vergeMat;
        mergedVerge.isPickable = false;
        mergedVerge.receiveShadows = true;
      }
    }
  }

  private createRoadsideInfrastructure(): void {
    const infraRoot = new TransformNode('CircuitRoadsideInfraRoot', this.scene);
    infraRoot.parent = this.trackRoot;

    // 1. Distance Braking Boards
    this.createDistanceBrakeBoards(infraRoot);

    // 2. Corner Outer Runoff Tire Barrier Cushions
    this.createTireBarriers(infraRoot);
  }

  private createDistanceBrakeBoards(parent: TransformNode): void {
    const postMat = new StandardMaterial('BrakePostMat', this.scene);
    postMat.diffuseColor = new Color3(0.20, 0.22, 0.24);
    postMat.specularColor = new Color3(0.10, 0.10, 0.10);

    const makeBoardTexture = (text: string): DynamicTexture => {
      const tex = new DynamicTexture(\`BrakeTex_\${text}\`, { width: 256, height: 128 }, this.scene, false);
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      if (ctx) {
        ctx.fillStyle = '#f0f2f5';
        ctx.fillRect(0, 0, 256, 128);

        ctx.fillStyle = '#d32f2f';
        ctx.fillRect(0, 0, 256, 12);
        ctx.fillRect(0, 116, 256, 12);

        ctx.fillStyle = '#11161d';
        ctx.font = 'bold 68px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 64);
        tex.update();
      }
      return tex;
    };

    const mat100 = new StandardMaterial('BrakeMat_100', this.scene);
    mat100.diffuseTexture = makeBoardTexture('100');
    mat100.specularColor = new Color3(0.04, 0.04, 0.04);

    const mat50 = new StandardMaterial('BrakeMat_50', this.scene);
    mat50.diffuseTexture = makeBoardTexture('50');
    mat50.specularColor = new Color3(0.04, 0.04, 0.04);

    interface BoardConfig {
      distance: '100' | '50';
      pos: Vector3;
      rotY: number;
    }

    const boards: BoardConfig[] = [
      // Turn 1 entry (Main North Straight)
      { distance: '100', pos: new Vector3(-4.8, 0, 60), rotY: 0 },
      { distance: '50', pos: new Vector3(-4.8, 0, 85), rotY: 0 },
      // Turn 8 entry (East Shoot into Grand Back Straight)
      { distance: '100', pos: new Vector3(85, 0, -14.8), rotY: Math.PI / 2 },
      { distance: '50', pos: new Vector3(105, 0, -14.8), rotY: Math.PI / 2 },
      // Turn 9 entry (Grand Back Straight braking into South Sweeper)
      { distance: '100', pos: new Vector3(124.8, 0, -100), rotY: Math.PI },
      { distance: '50', pos: new Vector3(124.8, 0, -130), rotY: Math.PI },
      // Turn 14 entry (Outer Link into West Return)
      { distance: '100', pos: new Vector3(0, 0, -154.8), rotY: (3 * Math.PI) / 2 },
      { distance: '50', pos: new Vector3(-25, 0, -154.8), rotY: (3 * Math.PI) / 2 },
      // Turn 16 entry (West Return approaching Pit Entry)
      { distance: '100', pos: new Vector3(-44.8, 0, -80), rotY: 0 },
      { distance: '50', pos: new Vector3(-44.8, 0, -50), rotY: 0 },
    ];

    const posts: Mesh[] = [];
    const boards100: Mesh[] = [];
    const boards50: Mesh[] = [];

    for (let i = 0; i < boards.length; i++) {
      const b = boards[i];
      const post = MeshBuilder.CreateCylinder(\`BrakePost_\${i}\`, { height: 1.4, diameter: 0.08, tessellation: 6 }, this.scene);
      post.position = new Vector3(b.pos.x, 0.7, b.pos.z);
      posts.push(post);

      const panel = MeshBuilder.CreatePlane(\`BrakePanel_\${i}\`, { width: 1.15, height: 0.65 }, this.scene);
      panel.position = new Vector3(b.pos.x, 1.15, b.pos.z);
      panel.rotation.y = b.rotY;
      if (b.distance === '100') boards100.push(panel);
      else boards50.push(panel);
    }

    if (posts.length > 0) {
      const mergedPosts = Mesh.MergeMeshes(posts, true, true, undefined, false, true);
      if (mergedPosts) {
        mergedPosts.name = 'CircuitBrakePosts';
        mergedPosts.parent = parent;
        mergedPosts.material = postMat;
        mergedPosts.isPickable = false;
      }
    }
    if (boards100.length > 0) {
      const merged100 = Mesh.MergeMeshes(boards100, true, true, undefined, false, true);
      if (merged100) {
        merged100.name = 'CircuitBrakeBoards100';
        merged100.parent = parent;
        merged100.material = mat100;
        merged100.isPickable = false;
      }
    }
    if (boards50.length > 0) {
      const merged50 = Mesh.MergeMeshes(boards50, true, true, undefined, false, true);
      if (merged50) {
        merged50.name = 'CircuitBrakeBoards50';
        merged50.parent = parent;
        merged50.material = mat50;
        merged50.isPickable = false;
      }
    }
  }

  private createTireBarriers(parent: TransformNode): void {
    const tireMat = new StandardMaterial('TireRubberMat', this.scene);
    tireMat.diffuseColor = new Color3(0.12, 0.12, 0.13);
    tireMat.specularColor = new Color3(0.04, 0.04, 0.04);

    const tireMeshes: Mesh[] = [];

    const addTireLine = (start: Vector3, step: Vector3, count: number) => {
      for (let i = 0; i < count; i++) {
        const p = start.add(step.scale(i));
        const stack = MeshBuilder.CreateCylinder(\`Tire_\${tireMeshes.length}\`, {
          height: 0.85,
          diameter: 0.85,
          tessellation: 8,
        }, this.scene);
        stack.position = new Vector3(p.x, 0.425, p.z);
        tireMeshes.push(stack);
      }
    };

    // Major corner outer runoff barriers
    addTireLine(new Vector3(-6.5, 0, 121.2), new Vector3(1.15, 0, 0), 12); // Turn 1 North
    addTireLine(new Vector3(53.6, 0, 108.0), new Vector3(0, 0, 1.15), 12); // Turn 2 East
    addTireLine(new Vector3(133.6, 0, -2.5), new Vector3(0, 0, 1.15), 14); // Turn 8 East/South
    addTireLine(new Vector3(133.6, 0, -162.5), new Vector3(0, 0, 1.15), 14); // Turn 9 South
    addTireLine(new Vector3(-53.6, 0, -162.5), new Vector3(0, 0, 1.15), 14); // Turn 13 South/West
    addTireLine(new Vector3(-53.6, 0, -12.5), new Vector3(0, 0, 1.15), 12); // Turn 15 West/North

    if (tireMeshes.length > 0) {
      const mergedTires = Mesh.MergeMeshes(tireMeshes, true, true, undefined, false, true);
      if (mergedTires) {
        mergedTires.name = 'CircuitTireBarriers';
        mergedTires.parent = parent;
        mergedTires.material = tireMat;
        mergedTires.isPickable = false;
        mergedTires.receiveShadows = true;
      }
    }
  }

  private createColoredPart(mesh: Mesh, color: Color3): Mesh {
    const vertexCount = mesh.getTotalVertices();
    const colors: number[] = [];
    for (let i = 0; i < vertexCount; i++) {
      colors.push(color.r, color.g, color.b, 1.0);
    }
    mesh.setVerticesData(VertexBuffer.ColorKind, colors);
    return mesh;
  }

  private createMasterSpruce(): Mesh {
    const trunk = this.createColoredPart(
      MeshBuilder.CreateCylinder('TrunkSpruce', { height: 1.8, diameterTop: 0.30, diameterBottom: 0.45, tessellation: 6 }, this.scene),
      new Color3(0.32, 0.20, 0.12)
    );
    trunk.position.y = 0.9;

    const c1 = this.createColoredPart(
      MeshBuilder.CreateCylinder('Cone1', { height: 2.2, diameterTop: 0.4, diameterBottom: 3.2, tessellation: 7 }, this.scene),
      new Color3(0.10, 0.20, 0.12)
    );
    c1.position.y = 2.0;

    const c2 = this.createColoredPart(
      MeshBuilder.CreateCylinder('Cone2', { height: 2.0, diameterTop: 0.3, diameterBottom: 2.4, tessellation: 7 }, this.scene),
      new Color3(0.14, 0.26, 0.16)
    );
    c2.position.y = 3.2;

    const c3 = this.createColoredPart(
      MeshBuilder.CreateCylinder('Cone3', { height: 1.8, diameterTop: 0.05, diameterBottom: 1.6, tessellation: 7 }, this.scene),
      new Color3(0.17, 0.32, 0.20)
    );
    c3.position.y = 4.4;

    const merged = Mesh.MergeMeshes([trunk, c1, c2, c3], true, true, undefined, false, true);
    if (!merged) throw new Error('Failed to merge master spruce mesh');
    merged.name = 'MasterAlpineSpruce';
    return merged;
  }

  private createMasterOak(): Mesh {
    const trunk = this.createColoredPart(
      MeshBuilder.CreateCylinder('TrunkOak', { height: 2.2, diameterTop: 0.42, diameterBottom: 0.58, tessellation: 6 }, this.scene),
      new Color3(0.30, 0.24, 0.18)
    );
    trunk.position.y = 1.1;

    const crown1 = this.createColoredPart(
      MeshBuilder.CreateSphere('Crown1', { diameterX: 3.4, diameterY: 2.4, diameterZ: 3.2, segments: 5 }, this.scene),
      new Color3(0.18, 0.29, 0.11)
    );
    crown1.position.set(0, 2.9, 0);

    const crown2 = this.createColoredPart(
      MeshBuilder.CreateSphere('Crown2', { diameterX: 2.6, diameterY: 2.2, diameterZ: 2.6, segments: 5 }, this.scene),
      new Color3(0.24, 0.37, 0.15)
    );
    crown2.position.set(0.3, 3.9, -0.2);

    const merged = Mesh.MergeMeshes([trunk, crown1, crown2], true, true, undefined, false, true);
    if (!merged) throw new Error('Failed to merge master oak mesh');
    merged.name = 'MasterDeciduousOak';
    return merged;
  }

  private createMasterShrub(): Mesh {
    const bush = this.createColoredPart(
      MeshBuilder.CreateSphere('ShrubBush', { diameterX: 1.8, diameterY: 1.1, diameterZ: 1.6, segments: 4 }, this.scene),
      new Color3(0.20, 0.30, 0.14)
    );
    bush.position.y = 0.55;
    bush.bakeCurrentTransformIntoVertices();
    bush.name = 'MasterWildShrub';
    return bush;
  }

  private createMasterRock(): Mesh {
    const rock = this.createColoredPart(
      MeshBuilder.CreateSphere('RockBoulder', { diameterX: 1.4, diameterY: 0.9, diameterZ: 1.2, segments: 3 }, this.scene),
      new Color3(0.35, 0.37, 0.39)
    );
    rock.position.y = 0.45;
    rock.bakeCurrentTransformIntoVertices();
    rock.name = 'MasterGraniteRock';
    return rock;
  }

  private async createForestScenery(): Promise<void> {
    const sceneryRoot = new TransformNode('ForestSceneryRoot', this.scene);
    sceneryRoot.parent = this.trackRoot;

    const vegMat = new StandardMaterial('MasterVegetationMat', this.scene);
    vegMat.diffuseColor = new Color3(1, 1, 1);
    vegMat.specularColor = new Color3(0.02, 0.02, 0.02);

    const masterSpruce = this.createMasterSpruce();
    masterSpruce.material = vegMat;
    masterSpruce.useVertexColors = true;
    masterSpruce.isVisible = false;
    masterSpruce.isPickable = false;

    const masterOak = this.createMasterOak();
    masterOak.material = vegMat;
    masterOak.useVertexColors = true;
    masterOak.isVisible = false;
    masterOak.isPickable = false;

    const masterShrub = this.createMasterShrub();
    masterShrub.material = vegMat;
    masterShrub.useVertexColors = true;
    masterShrub.isVisible = false;
    masterShrub.isPickable = false;

    const masterRock = this.createMasterRock();
    masterRock.material = vegMat;
    masterRock.useVertexColors = true;
    masterRock.isVisible = false;
    masterRock.isPickable = false;

    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const spawnInstances = (
      master: Mesh,
      locations: Vector3[],
      prefix: string,
      scaleMin: number,
      scaleMax: number,
      heightJitter: number = 0.2
    ) => {
      for (let i = 0; i < locations.length; i++) {
        const inst = master.createInstance(\`\${prefix}_\${i}\`);
        inst.parent = sceneryRoot;
        inst.position.copyFrom(locations[i]);
        inst.rotation.y = pseudoRandom() * Math.PI * 2;

        const sXZ = scaleMin + pseudoRandom() * (scaleMax - scaleMin);
        const sY = sXZ * (1.0 + (pseudoRandom() - 0.5) * heightJitter);
        inst.scaling.set(sXZ, sY, sXZ);

        inst.isPickable = false;
        inst.receiveShadows = true;
      }
    };

    // Scaled coordinates distributed across the 160m x 260m circuit landscape
    const sprucePositions: Vector3[] = [
      // North Horizon Backdrop (Z: 125 to 160)
      new Vector3(-20, 0, 135), new Vector3(0, 0, 140), new Vector3(20, 0, 138),
      new Vector3(40, 0, 142), new Vector3(60, 0, 136), new Vector3(80, 0, 140),
      // East Horizon Backdrop (X: 135 to 170)
      new Vector3(145, 0, 80), new Vector3(150, 0, 40), new Vector3(146, 0, 0),
      new Vector3(148, 0, -40), new Vector3(145, 0, -80), new Vector3(150, 0, -120),
      new Vector3(142, 0, -150),
      // South Horizon Backdrop (Z: -165 to -195)
      new Vector3(130, 0, -175), new Vector3(90, 0, -180), new Vector3(50, 0, -178),
      new Vector3(10, 0, -182), new Vector3(-30, 0, -176), new Vector3(-60, 0, -180),
      // West Horizon Backdrop (X: -55 to -90)
      new Vector3(-65, 0, -140), new Vector3(-68, 0, -100), new Vector3(-64, 0, -60),
      new Vector3(-66, 0, -20), new Vector3(-64, 0, 20), new Vector3(-68, 0, 60),
      new Vector3(-65, 0, 100),
      // Infield safe copses (clear of road by at least 15m)
      new Vector3(20, 0, 30), new Vector3(25, 0, 50), new Vector3(15, 0, -60),
      new Vector3(45, 0, -50), new Vector3(95, 0, -80), new Vector3(-15, 0, -80)
    ];
    spawnInstances(masterSpruce, sprucePositions, 'Spruce_Inst', 0.85, 1.45, 0.3);

    const oakPositions: Vector3[] = [
      new Vector3(-25, 0, 125), new Vector3(30, 0, 130), new Vector3(70, 0, 128),
      new Vector3(140, 0, 60), new Vector3(142, 0, -20), new Vector3(140, 0, -100),
      new Vector3(110, 0, -170), new Vector3(70, 0, -172), new Vector3(-10, 0, -170),
      new Vector3(-58, 0, -120), new Vector3(-56, 0, -40), new Vector3(-58, 0, 40),
      // Infield glades
      new Vector3(22, 0, 10), new Vector3(26, 0, -30), new Vector3(88, 0, -50),
      new Vector3(-20, 0, -100), new Vector3(38, 0, -80)
    ];
    spawnInstances(masterOak, oakPositions, 'Oak_Inst', 0.85, 1.35, 0.2);

    const shrubPositions: Vector3[] = [
      new Vector3(-10, 0, 40), new Vector3(-10, 0, 80), new Vector3(20, 0, 120),
      new Vector3(130, 0, -40), new Vector3(130, 0, -100), new Vector3(100, 0, -160),
      new Vector3(30, 0, -160), new Vector3(-50, 0, -100), new Vector3(-50, 0, -40),
      new Vector3(15, 0, 20), new Vector3(50, 0, 50), new Vector3(90, 0, -70)
    ];
    spawnInstances(masterShrub, shrubPositions, 'Shrub_Inst', 0.75, 1.30, 0.25);

    const rockPositions: Vector3[] = [
      new Vector3(-8, 0, 118), new Vector3(48, 0, 118), new Vector3(128, 0, -5),
      new Vector3(128, 0, -156), new Vector3(75, 0, -156), new Vector3(-48, 0, -156),
      new Vector3(-48, 0, -15), new Vector3(-8, 0, -15), new Vector3(25, 0, -55)
    ];
    spawnInstances(masterRock, rockPositions, 'Rock_Inst', 0.8, 1.6, 0.4);

    // Kenney Forest deep backdrop clusters
    try {
      const templateResult = await SceneLoader.ImportMeshAsync(
        '',
        './assets/tracks/',
        'decoration-forest.glb',
        this.scene
      );

      const templateMesh = templateResult.meshes.find(m => m instanceof Mesh && m.name !== '__root__') as Mesh;
      if (templateMesh) {
        templateMesh.isVisible = false;
        templateMesh.isPickable = false;

        const kenneyPositions: Vector3[] = [
          new Vector3(-45, 0, 145), new Vector3(45, 0, 150), new Vector3(105, 0, 145),
          new Vector3(160, 0, 60), new Vector3(162, 0, -60), new Vector3(158, 0, -140),
          new Vector3(115, 0, -190), new Vector3(35, 0, -192), new Vector3(-45, 0, -190),
          new Vector3(-80, 0, -120), new Vector3(-80, 0, -40), new Vector3(-78, 0, 60)
        ];

        for (let i = 0; i < kenneyPositions.length; i++) {
          const inst = templateMesh.createInstance(\`Kenney_Inst_\${i}\`);
          inst.parent = sceneryRoot;
          inst.position.copyFrom(kenneyPositions[i]);
          inst.rotation.y = pseudoRandom() * Math.PI * 2;
          const s = 0.9 + pseudoRandom() * 0.35;
          inst.scaling.set(s, s * (0.95 + pseudoRandom() * 0.2), s);
          inst.isPickable = false;
          inst.receiveShadows = true;
        }
      }
    } catch (err) {
      console.warn('Failed to load decoration-forest.glb cluster template:', err);
    }
  }
}
`;

fs.writeFileSync('src/environment/TrackLoader.ts', trackLoaderContent);
console.log('Successfully written updated TrackLoader.ts with 980m circuit!');
