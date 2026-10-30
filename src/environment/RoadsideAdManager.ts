import {
  Scene,
  TransformNode,
  Vector3,
  Color3,
  SceneLoader,
  Mesh,
  AbstractMesh,
  StandardMaterial,
  Texture,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * RoadsideAdManager
 * Manages loading, material application, and instantiation of unified roadside structures
 * and separate illuminated ad screens across Apex circuits.
 */
export class RoadsideAdManager {
  private static instance: RoadsideAdManager | null = null;

  private scene: Scene;
  private templatesRoot: TransformNode;
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  // Materials
  public landscapeAdMaterial!: StandardMaterial;
  public portraitAdMaterial!: StandardMaterial;

  // Cached template structures (from roadside_asset_kit.glb)
  private megaFrameTemplate!: AbstractMesh;
  private roadsideFrameTemplate!: AbstractMesh;
  private gantryFrameTemplate!: AbstractMesh;
  private barrierFrameTemplate!: AbstractMesh;
  private towerBodyTemplate!: AbstractMesh;
  private rooftopBodyTemplate!: AbstractMesh;
  private fillerMedTemplate!: AbstractMesh;
  private fillerSmallTemplate!: AbstractMesh;

  // Cached template ad screens (loaded and handled separately)
  private megaScreenFrontTemplate!: Mesh;
  private megaScreenBackTemplate!: Mesh;
  private roadsideScreenFrontTemplate!: Mesh;
  private roadsideScreenBackTemplate!: Mesh;
  private gantryScreenTemplate!: Mesh;
  private barrierScreenTemplate!: Mesh;
  private towerScreenTemplate!: Mesh;
  private rooftopScreenTemplate!: Mesh;
  private bigAdScreenTemplate!: Mesh;

  private constructor(scene: Scene) {
    this.scene = scene;
    this.templatesRoot = new TransformNode('RoadsideAd_TemplatesRoot', this.scene);
    this.templatesRoot.setEnabled(false);
  }

  public static getInstance(scene: Scene): RoadsideAdManager {
    if (!RoadsideAdManager.instance || RoadsideAdManager.instance.scene !== scene) {
      RoadsideAdManager.instance = new RoadsideAdManager(scene);
    }
    return RoadsideAdManager.instance;
  }

  /**
   * Initializes and caches the unified kit assets and separated ad screens.
   */
  public async initialize(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.doLoad();
    return this.loadPromise;
  }

  private async doLoad(): Promise<void> {
    // 1. Create illuminated high-res ad materials
    this.createAdMaterials();

    // 2. Load unified roadside asset kit
    const kitResult = await SceneLoader.ImportMeshAsync(
      '',
      './assets/buildings_ads/',
      'roadside_asset_kit.glb',
      this.scene
    );

    // Parent all kit meshes under disabled templatesRoot so they don't render at raw Blender coords
    for (const mesh of kitResult.meshes) {
      if (!mesh.parent || mesh.parent === this.scene.getMeshByName('__root__')) {
        mesh.parent = this.templatesRoot;
      }
      mesh.isPickable = false;
      mesh.receiveShadows = true;
    }

    // 3. Extract and cache structural base frames
    this.megaFrameTemplate = this.findMesh(kitResult.meshes, 'Billboard_Highway_Mega_Frame')!;
    this.roadsideFrameTemplate = this.findMesh(kitResult.meshes, 'Billboard_Roadside_Dual_Frame')!;
    this.gantryFrameTemplate = this.findMesh(kitResult.meshes, 'Track_Sponsor_Gantry_Frame')!;
    this.barrierFrameTemplate = this.findMesh(kitResult.meshes, 'Track_Barrier_Banner_Frame')!;
    this.towerBodyTemplate = this.findMesh(kitResult.meshes, 'Bldg_Tower_WallAd_Body')!;
    this.rooftopBodyTemplate = this.findMesh(kitResult.meshes, 'Bldg_Rooftop_Ad_Body')!;
    this.fillerMedTemplate = this.findMesh(kitResult.meshes, 'Bldg_Filler_Med_Body')!;
    this.fillerSmallTemplate = this.findMesh(kitResult.meshes, 'Bldg_Filler_Small_Body')!;

    // 4. Extract and cache screen meshes, assigning illuminated ad materials
    this.megaScreenFrontTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Billboard_Highway_Mega_Front_Mesh') as Mesh;
    this.megaScreenBackTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Billboard_Highway_Mega_Back_Mesh') as Mesh;
    this.roadsideScreenFrontTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Billboard_Roadside_Dual_Front_Mesh') as Mesh;
    this.roadsideScreenBackTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Billboard_Roadside_Dual_Back_Mesh') as Mesh;
    this.gantryScreenTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Track_Sponsor_Gantry_Mesh') as Mesh;
    this.barrierScreenTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Track_Barrier_Banner_Mesh') as Mesh;
    this.rooftopScreenTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Bldg_Rooftop_Ad_Mesh') as Mesh;
    this.towerScreenTemplate = this.findMesh(kitResult.meshes, 'Ad_Screen_Bldg_Tower_WallAd_Mesh') as Mesh;

    // Apply ad materials to template screens
    if (this.megaScreenFrontTemplate) this.megaScreenFrontTemplate.material = this.landscapeAdMaterial;
    if (this.megaScreenBackTemplate) this.megaScreenBackTemplate.material = this.landscapeAdMaterial;
    if (this.roadsideScreenFrontTemplate) this.roadsideScreenFrontTemplate.material = this.landscapeAdMaterial;
    if (this.roadsideScreenBackTemplate) this.roadsideScreenBackTemplate.material = this.landscapeAdMaterial;
    if (this.gantryScreenTemplate) this.gantryScreenTemplate.material = this.landscapeAdMaterial;
    if (this.barrierScreenTemplate) this.barrierScreenTemplate.material = this.landscapeAdMaterial;
    if (this.rooftopScreenTemplate) this.rooftopScreenTemplate.material = this.landscapeAdMaterial;
    if (this.towerScreenTemplate) this.towerScreenTemplate.material = this.portraitAdMaterial;

    // 5. Load big_ad_screen.glb separately (3x length and 3x width of roadside billboard)
    try {
      const bigResult = await SceneLoader.ImportMeshAsync(
        '',
        './assets/buildings_ads/',
        'big_ad_screen.glb',
        this.scene
      );

      for (const mesh of bigResult.meshes) {
        if (!mesh.parent || mesh.parent === this.scene.getMeshByName('__root__')) {
          mesh.parent = this.templatesRoot;
        }
        mesh.isPickable = false;
        mesh.receiveShadows = true;
      }

      // Locate 3x big ad screen
      const bigScreen = this.findMesh(bigResult.meshes, 'Ad_Screen_Billboard_Roadside_Dual_Front_Mesh') as Mesh;
      if (bigScreen) {
        bigScreen.material = this.landscapeAdMaterial;
        this.bigAdScreenTemplate = bigScreen;
      }
    } catch (e) {
      console.warn('[RoadsideAdManager] Could not load big_ad_screen.glb directly, falling back to scaled roadside template', e);
    }

    this.isLoaded = true;
  }

  private findMesh(meshes: AbstractMesh[], nameSubstr: string): AbstractMesh | null {
    for (const m of meshes) {
      if (m.name.includes(nameSubstr)) return m;
    }
    return null;
  }

  private createAdMaterials(): void {
    // Landscape LED Ad Material (2:1 aspect ratio)
    this.landscapeAdMaterial = new StandardMaterial('AdMat_Landscape_Illuminated', this.scene);
    const landscapeTex = new Texture('./assets/buildings_ads/ads_images/ad_landscape.png', this.scene, false, false);
    this.landscapeAdMaterial.diffuseTexture = landscapeTex;
    this.landscapeAdMaterial.emissiveTexture = landscapeTex;
    this.landscapeAdMaterial.emissiveColor = new Color3(0.9, 0.9, 0.9);
    this.landscapeAdMaterial.specularColor = new Color3(0.12, 0.12, 0.12);
    this.landscapeAdMaterial.backFaceCulling = false;

    // Portrait / 4:3 LED Ad Material
    this.portraitAdMaterial = new StandardMaterial('AdMat_Portrait_Illuminated', this.scene);
    const portraitTex = new Texture('./assets/buildings_ads/ads_images/ad_4_3.jpg', this.scene, false, false);
    this.portraitAdMaterial.diffuseTexture = portraitTex;
    this.portraitAdMaterial.emissiveTexture = portraitTex;
    this.portraitAdMaterial.emissiveColor = new Color3(0.9, 0.9, 0.9);
    this.portraitAdMaterial.specularColor = new Color3(0.12, 0.12, 0.12);
    this.portraitAdMaterial.backFaceCulling = false;
  }

  /**
   * Dynamically update ad texture at runtime across all billboard screens.
   */
  public setAdImage(type: 'landscape' | 'portrait', textureUrl: string): void {
    const mat = type === 'landscape' ? this.landscapeAdMaterial : this.portraitAdMaterial;
    if (mat) {
      const tex = new Texture(textureUrl, this.scene, false, false);
      mat.diffuseTexture = tex;
      mat.emissiveTexture = tex;
    }
  }

  // ==========================================
  // SPONSOR GANTRY (Overhead across track)
  // ==========================================
  public createSponsorGantry(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    // Structural base frame from unified kit
    if (this.gantryFrameTemplate) {
      const frame = (this.gantryFrameTemplate as Mesh).createInstance(`${name}_Frame`);
      frame.position.set(0, 0, 0);
      frame.parent = root;
      frame.isPickable = false;
      frame.receiveShadows = true;
    }

    // Separate ad screen attached at 6.6m clearance
    if (this.gantryScreenTemplate) {
      const screen = this.gantryScreenTemplate.createInstance(`${name}_Screen`);
      screen.position.set(0, 6.6, 0.32);
      screen.parent = root;
      screen.isPickable = false;
      screen.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // BIG AD SCREEN (3x length and 3x width = 24m x 11.4m)
  // ==========================================
  public createBigAdScreen(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    // Support frame scaled to fit massive 24m display
    if (this.roadsideFrameTemplate) {
      const frame = (this.roadsideFrameTemplate as Mesh).createInstance(`${name}_Frame`);
      frame.position.set(0, 0, 0);
      frame.scaling.set(2.8, 1.8, 2.0);
      frame.parent = root;
      frame.isPickable = false;
      frame.receiveShadows = true;
    }

    // 3x scaled separate ad screen (24m x 11.4m)
    const screenTemplate = this.bigAdScreenTemplate || this.roadsideScreenFrontTemplate;
    if (screenTemplate) {
      const screen = screenTemplate.createInstance(`${name}_Screen`);
      // Position screen centered on support structure at 10.5m height
      screen.position.set(0, 10.5, 0.32);
      screen.scaling.set(3.0, 3.0, 1.0);
      screen.parent = root;
      screen.isPickable = false;
      screen.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // ROADSIDE DUAL BILLBOARD (8m x 3.8m, Front & Back)
  // ==========================================
  public createBillboardDual(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    // Base frame from unified kit
    if (this.roadsideFrameTemplate) {
      const frame = (this.roadsideFrameTemplate as Mesh).createInstance(`${name}_Frame`);
      frame.position.set(0, 0, 0);
      frame.parent = root;
      frame.isPickable = false;
      frame.receiveShadows = true;
    }

    // Separate front ad screen
    if (this.roadsideScreenFrontTemplate) {
      const front = this.roadsideScreenFrontTemplate.createInstance(`${name}_ScreenFront`);
      front.position.set(0, 5.2, 0.32);
      front.parent = root;
      front.isPickable = false;
      front.receiveShadows = false;
    }

    // Separate back ad screen
    if (this.roadsideScreenBackTemplate) {
      const back = this.roadsideScreenBackTemplate.createInstance(`${name}_ScreenBack`);
      back.position.set(0, 5.2, -0.32);
      back.parent = root;
      back.isPickable = false;
      back.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // HIGHWAY MEGA BILLBOARD (12m x 5m, clearance 11.5m)
  // ==========================================
  public createHighwayMegaBillboard(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    // Heavy steel frame from unified kit
    if (this.megaFrameTemplate) {
      const frame = (this.megaFrameTemplate as Mesh).createInstance(`${name}_Frame`);
      frame.position.set(0, 0, 0);
      frame.parent = root;
      frame.isPickable = false;
      frame.receiveShadows = true;
    }

    // Separate front screen
    if (this.megaScreenFrontTemplate) {
      const front = this.megaScreenFrontTemplate.createInstance(`${name}_ScreenFront`);
      front.position.set(0, 11.5, 0.32);
      front.parent = root;
      front.isPickable = false;
      front.receiveShadows = false;
    }

    // Separate back screen
    if (this.megaScreenBackTemplate) {
      const back = this.megaScreenBackTemplate.createInstance(`${name}_ScreenBack`);
      back.position.set(0, 11.5, -0.32);
      back.parent = root;
      back.isPickable = false;
      back.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // TRACK BARRIER BANNER (6m x 1.2m continuous barrier)
  // ==========================================
  public createBarrierBanner(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    if (this.barrierFrameTemplate) {
      const frame = (this.barrierFrameTemplate as Mesh).createInstance(`${name}_Frame`);
      frame.position.set(0, 0, 0);
      frame.parent = root;
      frame.isPickable = false;
      frame.receiveShadows = true;
    }

    if (this.barrierScreenTemplate) {
      const screen = this.barrierScreenTemplate.createInstance(`${name}_Screen`);
      screen.position.set(0, 0.65, 0.14);
      screen.parent = root;
      screen.isPickable = false;
      screen.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // SKYSCRAPER TOWER WITH 4:3 PORTRAIT LED WALL AD (32m high)
  // ==========================================
  public createBuildingTower(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    if (this.towerBodyTemplate) {
      const body = (this.towerBodyTemplate as Mesh).createInstance(`${name}_Body`);
      body.position.set(0, 0, 0);
      body.parent = root;
      body.isPickable = false;
      body.receiveShadows = true;
    }

    // Separate 4:3 LED ad wall screen
    if (this.towerScreenTemplate) {
      const screen = this.towerScreenTemplate.createInstance(`${name}_Screen`);
      screen.position.set(0, 16.0, 8.25);
      screen.parent = root;
      screen.isPickable = false;
      screen.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // ROOFTOP BILLBOARD BUILDING (24m high, 11m x 5m ad)
  // ==========================================
  public createBuildingRooftop(name: string, pos: Vector3, rotY: number, parent: TransformNode): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    if (this.rooftopBodyTemplate) {
      const body = (this.rooftopBodyTemplate as Mesh).createInstance(`${name}_Body`);
      body.position.set(0, 0, 0);
      body.parent = root;
      body.isPickable = false;
      body.receiveShadows = true;
    }

    if (this.rooftopScreenTemplate) {
      const screen = this.rooftopScreenTemplate.createInstance(`${name}_Screen`);
      screen.position.set(0, 21.5, 4.9);
      screen.parent = root;
      screen.isPickable = false;
      screen.receiveShadows = false;
    }

    return root;
  }

  // ==========================================
  // FILLER URBAN BUILDINGS (Medium 22m, Small 12m)
  // ==========================================
  public createBuildingFiller(
    name: string,
    pos: Vector3,
    rotY: number,
    size: 'small' | 'med',
    parent: TransformNode
  ): TransformNode {
    const root = new TransformNode(name, this.scene);
    root.position.copyFrom(pos);
    root.rotation.y = rotY;
    root.parent = parent;

    const template = size === 'med' ? this.fillerMedTemplate : this.fillerSmallTemplate;
    if (template) {
      const body = (template as Mesh).createInstance(`${name}_Body`);
      body.position.set(0, 0, 0);
      body.parent = root;
      body.isPickable = false;
      body.receiveShadows = true;
    }

    return root;
  }
}
