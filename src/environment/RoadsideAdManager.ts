import {
  Scene,
  TransformNode,
  Vector3,
  Color3,
  SceneLoader,
  Mesh,
  StandardMaterial,
  Texture,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/**
 * RoadsideAdManager
 * Manages loading, caching, material application, and instantiation of unified roadside
 * structures and separated illuminated ad screens across Savanna Ridge and Forest Valley.
 */
export class RoadsideAdManager {
  private static instance: RoadsideAdManager | null = null;

  private scene: Scene;
  private isLoaded: boolean = false;
  private loadPromise: Promise<void> | null = null;

  // Materials
  public landscapeAdMaterial!: StandardMaterial;
  public portraitAdMaterial!: StandardMaterial;

  // Cached template structures (from roadside_asset_kit.glb & big_ad_screen.glb)
  private gantryStructTemplate: Mesh | null = null;
  private highwayMegaStructTemplate: Mesh | null = null;
  private roadsideDualStructTemplate: Mesh | null = null;
  private barrierBannerStructTemplate: Mesh | null = null;
  private towerStructTemplate: TransformNode | null = null;
  private rooftopStructTemplate: TransformNode | null = null;
  private fillerMedStructTemplate: TransformNode | null = null;
  private fillerSmallStructTemplate: TransformNode | null = null;
  private bigAdStructTemplate: Mesh | null = null;

  // Cached template ad screens
  private gantryScreenTemplate: Mesh | null = null;
  private highwayMegaFrontScreenTemplate: Mesh | null = null;
  private highwayMegaBackScreenTemplate: Mesh | null = null;
  private roadsideDualFrontScreenTemplate: Mesh | null = null;
  private roadsideDualBackScreenTemplate: Mesh | null = null;
  private barrierBannerScreenTemplate: Mesh | null = null;
  private towerScreenTemplate: Mesh | null = null;
  private rooftopScreenTemplate: Mesh | null = null;
  private bigAdScreenTemplate: Mesh | null = null;

  private constructor(scene: Scene) {
    this.scene = scene;
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

    // Hide raw kit root so templates do not render at authoring positions
    const kitRoot = kitResult.meshes.find((m) => m.name === '__root__');
    if (kitRoot) {
      kitRoot.setEnabled(false);
      kitRoot.position.set(0, -5000, 0);
    }

    const kitMeshes = kitResult.meshes as Mesh[];
    const kitNodes = kitResult.transformNodes;

    // Helper to search nodes and meshes
    const findNodeOrMesh = (name: string): TransformNode | Mesh | null => {
      const node = kitNodes.find((t) => t.name.includes(name));
      if (node) return node;
      const mesh = kitMeshes.find((m) => m.name.includes(name));
      return mesh || null;
    };

    // 3. Extract and cache structural base frames
    this.gantryStructTemplate = findNodeOrMesh('Track_Sponsor_Gantry_Struct') as Mesh;
    this.highwayMegaStructTemplate = findNodeOrMesh('Billboard_Highway_Mega_Struct') as Mesh;
    this.roadsideDualStructTemplate = findNodeOrMesh('Billboard_Roadside_Dual_Struct') as Mesh;
    this.barrierBannerStructTemplate = findNodeOrMesh('Track_Barrier_Banner_Struct') as Mesh;
    this.towerStructTemplate = findNodeOrMesh('Bldg_Tower_WallAd_Struct') as TransformNode;
    this.rooftopStructTemplate = findNodeOrMesh('Bldg_Rooftop_Ad_Struct') as TransformNode;
    this.fillerMedStructTemplate = findNodeOrMesh('Bldg_Filler_Med_Struct') as TransformNode;
    this.fillerSmallStructTemplate = findNodeOrMesh('Bldg_Filler_Small_Struct') as TransformNode;

    // 4. Extract and cache screen meshes
    this.gantryScreenTemplate = findNodeOrMesh('Ad_Screen_Track_Sponsor_Gantry') as Mesh;
    this.highwayMegaFrontScreenTemplate = findNodeOrMesh('Ad_Screen_Billboard_Highway_Mega_Front') as Mesh;
    this.highwayMegaBackScreenTemplate = findNodeOrMesh('Ad_Screen_Billboard_Highway_Mega_Back') as Mesh;
    this.roadsideDualFrontScreenTemplate = findNodeOrMesh('Ad_Screen_Billboard_Roadside_Dual_Front') as Mesh;
    this.roadsideDualBackScreenTemplate = findNodeOrMesh('Ad_Screen_Billboard_Roadside_Dual_Back') as Mesh;
    this.barrierBannerScreenTemplate = findNodeOrMesh('Ad_Screen_Track_Barrier_Banner') as Mesh;
    this.towerScreenTemplate = findNodeOrMesh('Ad_Screen_Bldg_Tower_WallAd') as Mesh;
    this.rooftopScreenTemplate = findNodeOrMesh('Ad_Screen_Bldg_Rooftop_Ad') as Mesh;

    // Apply ad materials to template screens
    if (this.gantryScreenTemplate) this.gantryScreenTemplate.material = this.landscapeAdMaterial;
    if (this.highwayMegaFrontScreenTemplate) this.highwayMegaFrontScreenTemplate.material = this.landscapeAdMaterial;
    if (this.highwayMegaBackScreenTemplate) this.highwayMegaBackScreenTemplate.material = this.landscapeAdMaterial;
    if (this.roadsideDualFrontScreenTemplate) this.roadsideDualFrontScreenTemplate.material = this.landscapeAdMaterial;
    if (this.roadsideDualBackScreenTemplate) this.roadsideDualBackScreenTemplate.material = this.landscapeAdMaterial;
    if (this.barrierBannerScreenTemplate) this.barrierBannerScreenTemplate.material = this.landscapeAdMaterial;
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

      const bigRoot = bigResult.meshes.find((m) => m.name === '__root__');
      if (bigRoot) {
        bigRoot.setEnabled(false);
        bigRoot.position.set(0, -5000, 0);
      }

      this.bigAdScreenTemplate = bigResult.meshes.find(
        (m) => m.name.includes('Ad_Screen_Billboard_Roadside_Dual_Front')
      ) as Mesh;
      this.bigAdStructTemplate = bigResult.meshes.find(
        (m) => m.name.includes('Billboard_Roadside_Dual_Struct')
      ) as Mesh;

      if (this.bigAdScreenTemplate) {
        this.bigAdScreenTemplate.material = this.landscapeAdMaterial;
      }
    } catch (e) {
      console.warn('[RoadsideAdManager] Could not load big_ad_screen.glb directly, using roadside template', e);
    }

    this.isLoaded = true;
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

  private instantiateStruct(
    template: TransformNode | Mesh | null,
    name: string,
    parent: TransformNode
  ): TransformNode | Mesh | null {
    if (!template) return null;
    const clone = template.clone(name, parent);
    if (!clone) return null;
    clone.setEnabled(true);
    clone.position.set(0, 0, 0);
    clone.rotation.set(0, 0, 0);

    clone.getChildMeshes().forEach((m) => {
      m.setEnabled(true);
      m.isVisible = true;
      m.isPickable = false;
      m.receiveShadows = true;
    });

    if (clone instanceof Mesh) {
      clone.isVisible = true;
      clone.isPickable = false;
      clone.receiveShadows = true;
    }

    return clone;
  }

  private instantiateScreen(
    template: Mesh | null,
    name: string,
    pos: Vector3,
    material: StandardMaterial,
    parent: TransformNode,
    scale?: Vector3
  ): Mesh | null {
    if (!template) return null;
    const clone = template.clone(name, parent);
    if (!clone) return null;
    clone.setEnabled(true);
    clone.isVisible = true;
    clone.isPickable = false;
    clone.receiveShadows = false;
    clone.position.copyFrom(pos);
    if (scale) {
      clone.scaling.copyFrom(scale);
    }
    clone.material = material;
    return clone;
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
    this.instantiateStruct(this.gantryStructTemplate, `${name}_Frame`, root);

    // Separate ad screen attached at 6.6m clearance
    this.instantiateScreen(
      this.gantryScreenTemplate,
      `${name}_Screen`,
      new Vector3(0, 6.6, 0.32),
      this.landscapeAdMaterial,
      root
    );

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
    const frameTemplate = this.bigAdStructTemplate || this.roadsideDualStructTemplate;
    const frame = this.instantiateStruct(frameTemplate, `${name}_Frame`, root);
    if (frame) {
      frame.scaling.set(2.8, 1.8, 2.0);
    }

    // 3x scaled separate ad screen (24m x 11.4m)
    const screenTemplate = this.bigAdScreenTemplate || this.roadsideDualFrontScreenTemplate;
    this.instantiateScreen(
      screenTemplate,
      `${name}_Screen`,
      new Vector3(0, 10.5, 0.32),
      this.landscapeAdMaterial,
      root,
      new Vector3(3.0, 3.0, 1.0)
    );

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
    this.instantiateStruct(this.roadsideDualStructTemplate, `${name}_Frame`, root);

    // Separate front ad screen
    this.instantiateScreen(
      this.roadsideDualFrontScreenTemplate,
      `${name}_ScreenFront`,
      new Vector3(0, 5.2, 0.32),
      this.landscapeAdMaterial,
      root
    );

    // Separate back ad screen
    this.instantiateScreen(
      this.roadsideDualBackScreenTemplate,
      `${name}_ScreenBack`,
      new Vector3(0, 5.2, -0.32),
      this.landscapeAdMaterial,
      root
    );

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
    this.instantiateStruct(this.highwayMegaStructTemplate, `${name}_Frame`, root);

    // Separate front screen
    this.instantiateScreen(
      this.highwayMegaFrontScreenTemplate,
      `${name}_ScreenFront`,
      new Vector3(0, 11.5, 0.32),
      this.landscapeAdMaterial,
      root
    );

    // Separate back screen
    this.instantiateScreen(
      this.highwayMegaBackScreenTemplate,
      `${name}_ScreenBack`,
      new Vector3(0, 11.5, -0.32),
      this.landscapeAdMaterial,
      root
    );

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

    this.instantiateStruct(this.barrierBannerStructTemplate, `${name}_Frame`, root);

    this.instantiateScreen(
      this.barrierBannerScreenTemplate,
      `${name}_Screen`,
      new Vector3(0, 0.65, 0.14),
      this.landscapeAdMaterial,
      root
    );

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

    this.instantiateStruct(this.towerStructTemplate, `${name}_Body`, root);

    // Separate 4:3 LED ad wall screen
    this.instantiateScreen(
      this.towerScreenTemplate,
      `${name}_Screen`,
      new Vector3(0, 16.0, 8.25),
      this.portraitAdMaterial,
      root
    );

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

    this.instantiateStruct(this.rooftopStructTemplate, `${name}_Body`, root);

    this.instantiateScreen(
      this.rooftopScreenTemplate,
      `${name}_Screen`,
      new Vector3(0, 21.5, 4.9),
      this.landscapeAdMaterial,
      root
    );

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

    const template = size === 'med' ? this.fillerMedStructTemplate : this.fillerSmallStructTemplate;
    this.instantiateStruct(template, `${name}_Body`, root);

    return root;
  }
}
