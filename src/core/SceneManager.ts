import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  Color4,
  Color3,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  AbstractMesh,
  Mesh,
  TransformNode,
  PBRMaterial,
} from '@babylonjs/core';
import { ChaseCamera } from '../camera/ChaseCamera';
import { GraphicsQuality } from '../settings/SettingsManager';
import { GameplayCameraMode } from '../camera/CameraConfig';
import { TrackEnvironmentConfig } from '../tracks/TrackConfig';

export type CameraMode = 'chase' | 'close' | 'wide' | 'orbit' | 'cinematic';

export class SceneManager {
  public canvas: HTMLCanvasElement;
  public engine: Engine;
  public scene: Scene;
  public orbitCamera: ArcRotateCamera;
  public chaseCamera: ChaseCamera | null = null;
  private activeTrackEnvironment: TrackEnvironmentConfig | null = null;
  public currentCameraMode: CameraMode = 'chase';
  public ambientLight: HemisphericLight;
  public sunLight: DirectionalLight;
  public shadowGenerator: ShadowGenerator | null = null;
  public skybox: AbstractMesh | null = null;
  public groundTerrain: AbstractMesh | null = null;
  public mountainRidges: AbstractMesh | null = null;

  // Showroom studio presentation elements
  public showroomPlatform: Mesh | null = null;
  public showroomKeyLight: DirectionalLight | null = null;
  public showroomFillLight: HemisphericLight | null = null;
  public showroomRimLight: DirectionalLight | null = null;
  public isGarageMode: boolean = false;
  public isUserInteractingWithCamera: boolean = false;

  constructor(canvasId: string = 'renderCanvas') {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found.`);
    }
    this.canvas = canvas;

    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      adaptToDeviceRatio: true,
      powerPreference: 'high-performance',
    });

    const dpr = window.devicePixelRatio || 1.0;
    this.engine.setHardwareScalingLevel(1 / Math.min(dpr, 1.5));

    this.scene = new Scene(this.engine);

    // Orbit inspection camera
    this.orbitCamera = new ArcRotateCamera(
      'OrbitCamera',
      -Math.PI / 2.2,
      Math.PI / 3.2,
      8.5,
      new Vector3(0, 1.0, 0),
      this.scene
    );
    this.orbitCamera.lowerRadiusLimit = 2.0;
    this.orbitCamera.upperRadiusLimit = 25.0;
    this.orbitCamera.wheelPrecision = 40;
    this.orbitCamera.pinchPrecision = 40;

    // 1. Ambient skylight & ground bounce
    this.ambientLight = new HemisphericLight(
      'AmbientLight',
      new Vector3(0, 1, 0),
      this.scene
    );
    this.ambientLight.intensity = 0.75;
    this.ambientLight.diffuse = new Color3(0.68, 0.78, 0.90); // Sky hemisphere
    this.ambientLight.groundColor = new Color3(0.24, 0.28, 0.20); // Grassy ground bounce

    // 2. Coherent directional daytime sunlight
    this.sunLight = new DirectionalLight(
      'SunLight',
      new Vector3(-0.45, -0.85, 0.35).normalize(),
      this.scene
    );
    this.sunLight.intensity = 1.35;
    this.sunLight.diffuse = new Color3(1.0, 0.96, 0.90); // Warm solar spectrum
    this.sunLight.specular = new Color3(0.85, 0.85, 0.80);

    // 3. Selective shadow generator (1024x1024 Poisson-filtered, highly optimized for Intel iGPU)
    this.shadowGenerator = new ShadowGenerator(1024, this.sunLight);
    this.shadowGenerator.usePoissonSampling = true;
    this.shadowGenerator.bias = 0.0015;
    this.shadowGenerator.normalBias = 0.0025;

    this.createAtmosphericEnvironment();
    this.createGroundTerrain();
    this.createShowroomEnvironment();

    // Track user interaction with orbit camera so auto-rotation gently pauses when user drags
    this.canvas.addEventListener('pointerdown', () => {
      this.isUserInteractingWithCamera = true;
    });
    window.addEventListener('pointerup', () => {
      this.isUserInteractingWithCamera = false;
    });

    window.addEventListener('resize', this.onResize);
  }

  public initChaseCamera(
    carPosition: Vector3,
    carYaw: number,
    preferredMode: GameplayCameraMode = 'chase'
  ): void {
    if (this.chaseCamera) {
      this.chaseCamera.dispose();
    }
    this.chaseCamera = new ChaseCamera(this.scene, carPosition, carYaw, preferredMode);
    this.setCameraMode(preferredMode);
  }

  public setCameraMode(mode: CameraMode): void {
    this.currentCameraMode = mode;
    if (mode === 'orbit') {
      this.scene.activeCamera = this.orbitCamera;
      this.orbitCamera.attachControl(this.canvas, true);
    } else if (this.chaseCamera) {
      this.scene.activeCamera = this.chaseCamera.camera;
      this.orbitCamera.detachControl();
      if (mode === 'chase' || mode === 'close' || mode === 'wide') {
        this.chaseCamera.clearCinematic();
        this.chaseCamera.setMode(mode);
      }
    }
  }

  public cycleGameplayCamera(): GameplayCameraMode {
    let next: GameplayCameraMode = 'chase';
    if (this.currentCameraMode === 'chase') next = 'close';
    else if (this.currentCameraMode === 'close') next = 'wide';
    else next = 'chase';

    this.setCameraMode(next);
    return next;
  }

  public toggleCameraMode(): CameraMode {
    return this.cycleGameplayCamera();
  }

  public updateChaseCamera(
    carPosition: Vector3,
    carYaw: number,
    forwardSpeed: number,
    lateralSpeed: number,
    steeringAngle: number = 0,
    dt: number = 0.016
  ): void {
    if (this.chaseCamera && this.currentCameraMode !== 'orbit') {
      this.chaseCamera.update(carPosition, carYaw, forwardSpeed, lateralSpeed, steeringAngle, dt);
      if (this.skybox) {
        this.skybox.position.copyFrom(this.chaseCamera.camera.position);
      }
    }
  }

  public updateGridSweep(progress: number, carPos: Vector3, carYaw: number): void {
    if (this.chaseCamera) {
      this.currentCameraMode = 'cinematic';
      this.scene.activeCamera = this.chaseCamera.camera;
      this.chaseCamera.updateGridSweep(progress, carPos, carYaw);
    }
  }

  public updateFinishSweep(progress: number, carPos: Vector3, carYaw: number): void {
    if (this.chaseCamera) {
      this.currentCameraMode = 'cinematic';
      this.scene.activeCamera = this.chaseCamera.camera;
      this.chaseCamera.updateFinishSweep(progress, carPos, carYaw);
    }
  }

  public restoreGameplayCamera(preferredMode: GameplayCameraMode = 'chase'): void {
    if (this.chaseCamera) {
      this.chaseCamera.clearCinematic();
      this.setCameraMode(preferredMode);
    }
  }

  public triggerCameraShake(intensity: number = 0.8): void {
    if (this.chaseCamera) {
      this.chaseCamera.triggerImpactShake(intensity);
    }
  }

  public resetCameras(carPosition: Vector3, carYaw: number): void {
    if (this.chaseCamera) {
      this.chaseCamera.reset(carPosition, carYaw);
    }
    this.orbitCamera.setTarget(carPosition.add(new Vector3(0, 1.0, 0)));
  }

  public applyGraphicsQuality(quality: GraphicsQuality): void {
    if (quality === 'low') {
      this.engine.setHardwareScalingLevel(1.5);
      if (this.chaseCamera) {
        this.chaseCamera.config.shakeIntensity = 0;
      }
      if (this.shadowGenerator) {
        const sm = this.shadowGenerator.getShadowMap();
        if (sm) sm.renderList = [];
      }
    } else if (quality === 'high') {
      const dpr = window.devicePixelRatio || 1.0;
      this.engine.setHardwareScalingLevel(1.0 / Math.min(dpr, 1.5));
      if (this.chaseCamera) {
        this.chaseCamera.config.shakeIntensity = 0.20;
      }
      if (this.shadowGenerator) {
        this.shadowGenerator.usePoissonSampling = true;
      }
    } else {
      // medium
      this.engine.setHardwareScalingLevel(1.0);
      if (this.chaseCamera) {
        this.chaseCamera.config.shakeIntensity = 0.14;
      }
      if (this.shadowGenerator) {
        this.shadowGenerator.usePoissonSampling = true;
      }
    }
  }

  public addShadowCaster(node: TransformNode | AbstractMesh, includeChildren: boolean = true): void {
    if (!this.shadowGenerator) return;
    if (node instanceof AbstractMesh) {
      this.shadowGenerator.addShadowCaster(node, includeChildren);
    } else {
      const childMeshes = node.getChildMeshes(false);
      for (const m of childMeshes) {
        this.shadowGenerator.addShadowCaster(m, false);
      }
    }
  }

  public updateMenuCamera(carPosition: Vector3, dt: number): void {
    if (this.currentCameraMode === 'orbit') {
      this.orbitCamera.alpha += 0.06 * dt; // Smooth, cinematic showcase turntable rotation
      this.orbitCamera.radius = 5.8;
      this.orbitCamera.beta = 1.28; // Ground-level three-quarter perspective
      this.orbitCamera.setTarget(carPosition.add(new Vector3(0, 0.85, 0)));
    } else if (this.chaseCamera) {
      this.chaseCamera.update(carPosition, 0, 0, 0, 0, dt);
    }
  }

  /**
   * Constructs the dedicated showroom studio turntable platform and 3-point studio lighting
   */
  private createShowroomEnvironment(): void {
    // 1. Showroom studio platform turntable (diameter 14m, flush with ground at Y=0)
    const platform = MeshBuilder.CreateCylinder('GarageShowroomFloor', {
      diameter: 14.0,
      height: 0.1,
      tessellation: 64,
    }, this.scene);
    platform.position = new Vector3(0, -0.05, 0);
    platform.isPickable = false;

    const platMat = new PBRMaterial('GaragePlatformMat', this.scene);
    platMat.albedoColor = new Color3(0.08, 0.10, 0.13);
    platMat.roughness = 0.36;
    platMat.metallic = 0.52;

    // Procedural circular turntable markings with precision radial concentric lines
    const platTex = new DynamicTexture('GaragePlatformTex', { width: 512, height: 512 }, this.scene, false);
    const pCtx = platTex.getContext() as CanvasRenderingContext2D;
    if (pCtx) {
      pCtx.fillStyle = '#11151c';
      pCtx.fillRect(0, 0, 512, 512);

      // Concentric rings
      pCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      pCtx.lineWidth = 2;
      pCtx.beginPath();
      pCtx.arc(256, 256, 120, 0, Math.PI * 2);
      pCtx.stroke();

      pCtx.strokeStyle = 'rgba(225, 6, 0, 0.35)'; // Red inner guide
      pCtx.lineWidth = 3;
      pCtx.beginPath();
      pCtx.arc(256, 256, 200, 0, Math.PI * 2);
      pCtx.stroke();

      pCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      pCtx.lineWidth = 1.5;
      pCtx.beginPath();
      pCtx.arc(256, 256, 240, 0, Math.PI * 2);
      pCtx.stroke();

      platTex.update();
    }
    platMat.albedoTexture = platTex;
    platform.material = platMat;
    platform.setEnabled(false);
    this.showroomPlatform = platform;

    // 2. Studio Key Light: Warm, directional key light from high front-left
    this.showroomKeyLight = new DirectionalLight(
      'ShowroomKeyLight',
      new Vector3(-0.45, -0.75, 0.48).normalize(),
      this.scene
    );
    this.showroomKeyLight.intensity = 1.45;
    this.showroomKeyLight.diffuse = new Color3(1.0, 0.98, 0.95);
    this.showroomKeyLight.specular = new Color3(1.0, 1.0, 1.0);
    this.showroomKeyLight.setEnabled(false);

    // 3. Studio Fill Light: Neutral cool ambient illumination
    this.showroomFillLight = new HemisphericLight(
      'ShowroomFillLight',
      new Vector3(0, 1, 0),
      this.scene
    );
    this.showroomFillLight.intensity = 0.55;
    this.showroomFillLight.diffuse = new Color3(0.42, 0.50, 0.65);
    this.showroomFillLight.groundColor = new Color3(0.06, 0.08, 0.11);
    this.showroomFillLight.setEnabled(false);

    // 4. Studio Rim Light: Cool blue-white edge silhouette illumination from high rear-right
    this.showroomRimLight = new DirectionalLight(
      'ShowroomRimLight',
      new Vector3(0.55, -0.45, -0.70).normalize(),
      this.scene
    );
    this.showroomRimLight.intensity = 1.25;
    this.showroomRimLight.diffuse = new Color3(0.68, 0.84, 1.0);
    this.showroomRimLight.specular = new Color3(0.85, 0.92, 1.0);
    this.showroomRimLight.setEnabled(false);
  }

  /**
   * Activates full-screen showroom mode: swaps daylight environment for dedicated dark studio presentation
   */
  public enableGarageShowroom(
    trackRoot: TransformNode,
    checkpointRoot: TransformNode | null,
    carPosition: Vector3
  ): void {
    this.isGarageMode = true;

    // Position turntable platform exactly beneath car
    if (this.showroomPlatform) {
      this.showroomPlatform.position.x = carPosition.x;
      this.showroomPlatform.position.z = carPosition.z;
      this.showroomPlatform.setEnabled(true);
    }

    // Enable studio lights
    this.showroomKeyLight?.setEnabled(true);
    this.showroomFillLight?.setEnabled(true);
    this.showroomRimLight?.setEnabled(true);

    // Suppress outdoor track, checkpoints, scenery, terrain, and daylight
    trackRoot.setEnabled(false);
    if (checkpointRoot) checkpointRoot.setEnabled(false);
    if (this.skybox) this.skybox.setEnabled(false);
    if (this.groundTerrain) this.groundTerrain.setEnabled(false);
    if (this.mountainRidges) this.mountainRidges.setEnabled(false);

    this.ambientLight.intensity = 0;
    this.sunLight.intensity = 0;

    // Showroom atmosphere: deep charcoal studio background with zero fog distraction
    this.scene.clearColor = new Color4(0.04, 0.05, 0.08, 1.0);
    this.scene.fogMode = Scene.FOGMODE_NONE;

    // Set up showroom orbit camera with constrained pitch to prevent clipping through turntable
    this.setCameraMode('orbit');
    this.orbitCamera.setTarget(carPosition.add(new Vector3(0, 0.75, 0)));
    this.orbitCamera.alpha = 2.35; // Front 3/4 showcase angle highlighting nose, headlights, and wheels
    this.orbitCamera.beta = 1.25;
    this.orbitCamera.radius = 5.5;
    this.orbitCamera.lowerRadiusLimit = 3.2;
    this.orbitCamera.upperRadiusLimit = 8.5;
    this.orbitCamera.lowerBetaLimit = 0.35;
    this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.05; // Never go below ground
    this.orbitCamera.attachControl(this.canvas, true);
  }

  /**
   * Restores normal racing / menu outdoor daylight environment upon leaving garage
   */
  public disableGarageShowroom(trackRoot: TransformNode, checkpointRoot: TransformNode | null): void {
    this.isGarageMode = false;

    // Disable showroom studio elements
    this.showroomPlatform?.setEnabled(false);
    this.showroomKeyLight?.setEnabled(false);
    this.showroomFillLight?.setEnabled(false);
    this.showroomRimLight?.setEnabled(false);

    // Restore outdoor track, checkpoints, terrain, skybox, and daylight
    trackRoot.setEnabled(true);
    if (checkpointRoot) checkpointRoot.setEnabled(true);
    if (this.skybox) this.skybox.setEnabled(true);
    if (this.groundTerrain) this.groundTerrain.setEnabled(true);
    if (this.mountainRidges) this.mountainRidges.setEnabled(true);

    this.ambientLight.intensity = 0.75;
    this.sunLight.intensity = 1.35;

    if (this.activeTrackEnvironment) {
      this.applyTrackEnvironment(this.activeTrackEnvironment);
    } else {
      this.scene.clearColor = new Color4(0.55, 0.68, 0.82, 1.0);
      this.scene.fogMode = Scene.FOGMODE_LINEAR;
    }

    // Reset orbit camera boundaries
    this.orbitCamera.lowerRadiusLimit = 2.0;
    this.orbitCamera.upperRadiusLimit = 25.0;
    this.orbitCamera.lowerBetaLimit = 0.0;
    this.orbitCamera.upperBetaLimit = Math.PI;
  }

  /**
   * Applies circuit-specific lighting, atmospheric fog, and sky clear colors.
   */
  public applyTrackEnvironment(env: TrackEnvironmentConfig): void {
    this.activeTrackEnvironment = env;
    this.scene.clearColor = env.clearColor.toColor4(1.0);
    this.scene.ambientColor = env.ambientColor;
    this.ambientLight.diffuse = env.ambientColor;
    this.ambientLight.groundColor = env.groundColor;
    this.ambientLight.intensity = 0.75;

    this.sunLight.direction = env.sunDirection;
    this.sunLight.diffuse = env.sunDiffuse;
    this.sunLight.specular = env.sunSpecular;
    this.sunLight.intensity = 1.35;
  }

  /**
   * Updates garage showroom camera with gentle auto-rotation when user is not manually dragging
   */
  public updateGarageCamera(dt: number): void {
    if (this.isGarageMode && this.currentCameraMode === 'orbit') {
      if (!this.isUserInteractingWithCamera) {
        this.orbitCamera.alpha += 0.04 * dt;
      }
    }
  }

  private createAtmosphericEnvironment(): void {
    // 1. Natural daylight clear color & atmospheric linear depth fog
    this.scene.clearColor = new Color4(0.55, 0.68, 0.82, 1.0);
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.68, 0.77, 0.86);
    this.scene.fogStart = 80.0;
    this.scene.fogEnd = 260.0;

    // 2. Continuous 360-degree daytime sky dome
    const skybox = MeshBuilder.CreateSphere('SkyBox', { diameter: 1200.0, segments: 32 }, this.scene);
    skybox.infiniteDistance = true;
    skybox.isPickable = false;

    const skyMat = new StandardMaterial('SkyBoxMat', this.scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;

    // High-resolution procedural sky gradient with cirrus clouds & solar bloom
    const skyTex = new DynamicTexture('SkyTexture', { width: 1024, height: 512 }, this.scene, false);
    const ctx = skyTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      // Atmospheric vertical gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.00, '#133d6b'); // Deep upper zenith blue
      grad.addColorStop(0.28, '#336fa3'); // Mid daylight azure
      grad.addColorStop(0.50, '#689fcc'); // Lower atmospheric sky
      grad.addColorStop(0.62, '#b0cfe8'); // Soft atmospheric horizon glow
      grad.addColorStop(0.67, '#d6e6f2'); // Crisp luminous horizon line
      grad.addColorStop(0.74, '#87a2b0'); // Low horizon valley mist
      grad.addColorStop(0.86, '#2e422f'); // Distant forest silhouette
      grad.addColorStop(1.00, '#182417'); // Dark ground base
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      // Subtle solar bloom disc at sun's azimuth
      const sunGrad = ctx.createRadialGradient(340, 130, 8, 340, 130, 120);
      sunGrad.addColorStop(0.0, 'rgba(255, 255, 245, 0.75)');
      sunGrad.addColorStop(0.3, 'rgba(255, 245, 220, 0.28)');
      sunGrad.addColorStop(0.7, 'rgba(235, 240, 255, 0.08)');
      sunGrad.addColorStop(1.0, 'rgba(200, 225, 255, 0.0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(340, 130, 120, 0, Math.PI * 2);
      ctx.fill();

      // Soft natural cirrus cloud bands in upper atmosphere
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      const cloudBands = [
        { y: 85, h: 14, x: 50, w: 420 },
        { y: 110, h: 22, x: 280, w: 560 },
        { y: 140, h: 18, x: 120, w: 680 },
        { y: 165, h: 26, x: 520, w: 460 },
        { y: 195, h: 16, x: 40, w: 500 },
        { y: 220, h: 12, x: 340, w: 620 },
      ];
      for (const cb of cloudBands) {
        ctx.beginPath();
        ctx.ellipse(cb.x + cb.w * 0.5, cb.y, cb.w * 0.5, cb.h * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      skyTex.update();
    }

    skyMat.diffuseTexture = skyTex;
    skyMat.emissiveTexture = skyTex;
    skyMat.specularColor = new Color3(0, 0, 0);
    skybox.material = skyMat;
    this.skybox = skybox;
  }

  private createGroundTerrain(): void {
    // 1. Broad flat valley floor underpinning track & infield
    const terrain = MeshBuilder.CreateGround(
      'GroundTerrain',
      { width: 500, height: 500, subdivisions: 6 },
      this.scene
    );
    terrain.position.y = -0.04;
    terrain.isPickable = false;
    terrain.receiveShadows = true;

    const terrainMat = new StandardMaterial('TerrainMaterial', this.scene);
    // Procedural multi-toned motorsport turf & meadow soil
    const turfTex = new DynamicTexture('TurfTexture', { width: 512, height: 512 }, this.scene, true);
    const ctx = turfTex.getContext() as CanvasRenderingContext2D;
    if (ctx) {
      // Base natural alpine meadow green
      ctx.fillStyle = '#2a3b23';
      ctx.fillRect(0, 0, 512, 512);

      // Fine stippling for natural soil/grass variation
      const colors = ['#202e1c', '#314429', '#3a5030', '#25321d', '#425132', '#4b5b37'];
      for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const rad = 1.0 + Math.random() * 2.8;
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      turfTex.update();
    }

    turfTex.uScale = 40;
    turfTex.vScale = 40;
    terrainMat.diffuseTexture = turfTex;
    terrainMat.diffuseColor = new Color3(0.85, 0.90, 0.82);
    terrainMat.specularColor = new Color3(0.02, 0.02, 0.02);
    terrain.material = terrainMat;
    this.groundTerrain = terrain;

    // Distant mountain ridges removed so the expanded 980m Grand Course has completely open, unobstructed terrain
  }

  private onResize = (): void => {
    this.engine.resize();
  };

  public focusCameraOn(targetPosition: Vector3, distance: number = 7.0): void {
    this.orbitCamera.setTarget(targetPosition);
    this.orbitCamera.radius = distance;
  }

  public render(): void {
    this.scene.render();
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize);
    if (this.chaseCamera) this.chaseCamera.dispose();
    this.orbitCamera.dispose();
    if (this.skybox) this.skybox.dispose();
    if (this.groundTerrain) this.groundTerrain.dispose();
    if (this.mountainRidges) this.mountainRidges.dispose();
    if (this.shadowGenerator) this.shadowGenerator.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
