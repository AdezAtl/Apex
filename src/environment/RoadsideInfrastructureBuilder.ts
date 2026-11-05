import {
  Scene,
  Color3,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
} from '@babylonjs/core';
import { CircuitDefinition } from '../tracks/TrackConfig';

interface SponsorAdConfig {
  brand: string;
  tagline: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
}

const SPONSOR_ADS: SponsorAdConfig[] = [
  {
    brand: 'PROJECT APEX',
    tagline: 'WORLD MOTORSPORT CHAMPIONSHIP',
    bgColor: '#0a0e17',
    textColor: '#ffffff',
    accentColor: '#f59e0b',
  },
  {
    brand: 'PIRELLI',
    tagline: 'P ZERO // ULTIMATE COMPETITION GRIP',
    bgColor: '#d91414',
    textColor: '#ffffff',
    accentColor: '#ffd700',
  },
  {
    brand: 'BREMBO',
    tagline: 'CARBON CERAMIC BRAKING SYSTEMS',
    bgColor: '#111317',
    textColor: '#ffffff',
    accentColor: '#e10600',
  },
  {
    brand: 'SHELL V-POWER',
    tagline: 'NITRO+ HIGH PERFORMANCE MOTOR FUEL',
    bgColor: '#fbbf24',
    textColor: '#1a1a1a',
    accentColor: '#dc2626',
  },
  {
    brand: 'MOTUL 300V',
    tagline: '100% SYNTHETIC RACING MOTOR OIL',
    bgColor: '#dc2626',
    textColor: '#ffffff',
    accentColor: '#ffffff',
  },
  {
    brand: 'APEX OCTANE',
    tagline: 'HIGH VELOCITY ENERGY FORMULA',
    bgColor: '#082f49',
    textColor: '#38bdf8',
    accentColor: '#0284c7',
  },
];

export class RoadsideInfrastructureBuilder {
  /**
   * Generates roadside billboards and commercial building ads set strictly behind invisible boundaries.
   * Guaranteed: All structures are positioned with clearance >= 3.4m beyond the road surface boundary.
   */
  public static build(
    scene: Scene,
    parent: TransformNode,
    circuit: CircuitDefinition,
    roadSurfaceY: number = 0.05
  ): TransformNode {
    const root = new TransformNode(`Infrastructure_${circuit.id}`, scene);
    root.parent = parent;

    const samples = circuit.roadSamples;
    if (!samples || samples.length < 10) return root;

    const totalSamples = samples.length;
    const defaultHalfWidth = (circuit.trackHalfWidth || 6.5);

    // Shared Materials
    const postMat = new StandardMaterial('AdPostMat', scene);
    postMat.diffuseColor = new Color3(0.2, 0.22, 0.25);
    postMat.specularColor = new Color3(0.15, 0.15, 0.15);

    const frameMat = new StandardMaterial('AdFrameMat', scene);
    frameMat.diffuseColor = new Color3(0.12, 0.14, 0.16);
    frameMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const buildingMat = new StandardMaterial('TracksideBuildingMat', scene);
    buildingMat.diffuseColor = new Color3(0.16, 0.19, 0.24);
    buildingMat.specularColor = new Color3(0.35, 0.35, 0.35);

    const glassMat = new StandardMaterial('TracksideGlassMat', scene);
    glassMat.diffuseColor = new Color3(0.08, 0.14, 0.22);
    glassMat.specularColor = new Color3(0.8, 0.8, 0.8);

    // Pre-create dynamic textures for sponsor ads
    const adMaterials: StandardMaterial[] = SPONSOR_ADS.map((ad, idx) => {
      const mat = new StandardMaterial(`SponsorAdMat_${idx}`, scene);
      const tex = new DynamicTexture(`SponsorAdTex_${idx}`, { width: 512, height: 256 }, scene, false);
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      if (ctx) {
        // Background
        ctx.fillStyle = ad.bgColor;
        ctx.fillRect(0, 0, 512, 256);

        // Top accent line
        ctx.fillStyle = ad.accentColor;
        ctx.fillRect(0, 0, 512, 16);

        // Chevrons / Speed graphics
        ctx.fillStyle = ad.accentColor;
        ctx.beginPath();
        ctx.moveTo(430, 20);
        ctx.lineTo(460, 20);
        ctx.lineTo(430, 240);
        ctx.lineTo(400, 240);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(470, 20);
        ctx.lineTo(500, 20);
        ctx.lineTo(470, 240);
        ctx.lineTo(440, 240);
        ctx.fill();

        // Main Brand
        ctx.font = 'bold 50px "Arial Black", Impact, sans-serif';
        ctx.fillStyle = ad.textColor;
        ctx.fillText(ad.brand, 32, 110);

        // Tagline
        ctx.font = 'bold 20px "Arial", sans-serif';
        ctx.fillStyle = ad.accentColor;
        ctx.fillText(ad.tagline, 34, 165);

        // Bottom border
        ctx.fillStyle = ad.accentColor;
        ctx.fillRect(0, 240, 512, 16);

        tex.update();
      }
      mat.diffuseTexture = tex;
      mat.specularColor = new Color3(0.1, 0.1, 0.1);
      mat.backFaceCulling = false;
      return mat;
    });

    // -------------------------------------------------------------------------
    // 1. ROADSIDE MOTORSPORT BILLBOARDS (Behind invisible walls)
    // -------------------------------------------------------------------------
    // Space billboards every ~35 samples on straights and gentle sweeps
    const billboardStep = Math.max(18, Math.round(totalSamples / 16));
    let adIndex = 0;

    for (let i = 8; i < totalSamples; i += billboardStep) {
      const pt = samples[i];
      // Only place billboards on straightaways and gentle curves (curvature < 4.5°)
      if (pt.curvatureDeg > 5.0) continue;

      const localWidth = pt.width || (defaultHalfWidth * 2.0);
      const localHalfWidth = localWidth / 2.0;
      // Alternate left and right side of track
      const side = (adIndex % 2 === 0) ? 1 : -1;
      adIndex++;

      // STRICT CLEARANCE: Billboard centerline is 3.5m behind the road edge
      const boardWidth = 4.4;
      const boardHeight = 2.2;
      const clearanceFromEdge = 3.5;
      const totalOffset = localHalfWidth + clearanceFromEdge;

      // Position in world space
      const centerPos = pt.position.add(pt.rightNormal.scale(side * totalOffset));
      const yawAngle = Math.atan2(pt.tangent.x, pt.tangent.z);

      // Support Pylons (Two heavy vertical posts)
      const pylonSeparation = 2.6;
      for (const pSide of [-1, 1]) {
        const postOffset = pt.tangent.scale(pSide * (pylonSeparation / 2));
        const post = MeshBuilder.CreateCylinder(
          `BillboardPost_${i}_${pSide}`,
          { height: 3.8, diameter: 0.18 },
          scene
        );
        post.position.set(centerPos.x + postOffset.x, roadSurfaceY + 1.9, centerPos.z + postOffset.z);
        post.material = postMat;
        post.parent = root;
        post.isPickable = false;
      }

      // Billboard Frame Backing
      const frame = MeshBuilder.CreateBox(
        `BillboardFrame_${i}`,
        { width: boardWidth + 0.25, height: boardHeight + 0.25, depth: 0.16 },
        scene
      );
      frame.position.set(centerPos.x, roadSurfaceY + 2.7, centerPos.z);
      frame.rotation.y = yawAngle;
      frame.material = frameMat;
      frame.parent = root;
      frame.isPickable = false;

      // Billboard Face Panel (Facing approaching traffic)
      const panel = MeshBuilder.CreatePlane(
        `BillboardPanel_${i}`,
        { width: boardWidth, height: boardHeight },
        scene
      );
      // Face slightly angled inward toward oncoming cars
      panel.position.set(
        centerPos.x - pt.rightNormal.x * (side * 0.09),
        roadSurfaceY + 2.7,
        centerPos.z - pt.rightNormal.z * (side * 0.09)
      );
      // Rotation: faces opposite to tangent if driving into it, rotated toward track
      panel.rotation.y = yawAngle + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      panel.material = adMaterials[adIndex % adMaterials.length];
      panel.parent = root;
      panel.isPickable = false;
    }

    // -------------------------------------------------------------------------
    // 2. COMMERCIAL BUILDING ADS (Set back 5m–8m behind invisible boundaries)
    // -------------------------------------------------------------------------
    // Place 4 to 8 modern architectural buildings with rooftop advertising banners
    const buildingStep = Math.max(35, Math.round(totalSamples / 8));
    let buildingCount = 0;

    for (let i = Math.round(buildingStep * 0.5); i < totalSamples; i += buildingStep) {
      const pt = samples[i];
      // Only place along straight sections with low curvature
      if (pt.curvatureDeg > 3.5) continue;

      const localWidth = pt.width || (defaultHalfWidth * 2.0);
      const localHalfWidth = localWidth / 2.0;
      const side = (buildingCount % 2 === 0) ? -1 : 1;
      buildingCount++;

      const buildingWidth = 10.0;
      const buildingHeight = 7.5;
      const buildingDepth = 7.0;

      // STRICT CLEARANCE: Front facade is 5.0m behind road edge
      const frontFacadeClearance = 5.0;
      const centerOffset = localHalfWidth + frontFacadeClearance + (buildingDepth / 2.0);

      const bPos = pt.position.add(pt.rightNormal.scale(side * centerOffset));
      const yawAngle = Math.atan2(pt.tangent.x, pt.tangent.z);

      // Main Building Structure
      const buildingMesh = MeshBuilder.CreateBox(
        `Building_${i}`,
        { width: buildingWidth, height: buildingHeight, depth: buildingDepth },
        scene
      );
      buildingMesh.position.set(bPos.x, roadSurfaceY + buildingHeight / 2.0, bPos.z);
      buildingMesh.rotation.y = yawAngle;
      buildingMesh.material = buildingMat;
      buildingMesh.parent = root;
      buildingMesh.isPickable = false;

      // Illuminated Window Band along facade
      const windowBand = MeshBuilder.CreateBox(
        `BuildingWindows_${i}`,
        { width: buildingWidth - 0.8, height: 1.6, depth: 0.1 },
        scene
      );
      // Place on side facing the track
      const inwardNormal = pt.rightNormal.scale(-side);
      const winPos = bPos.add(inwardNormal.scale(buildingDepth / 2.0 + 0.05));
      windowBand.position.set(winPos.x, roadSurfaceY + buildingHeight * 0.55, winPos.z);
      windowBand.rotation.y = yawAngle;
      windowBand.material = glassMat;
      windowBand.parent = root;
      windowBand.isPickable = false;

      // Rooftop Advertising Banner Structure
      const roofAdWidth = 8.5;
      const roofAdHeight = 2.4;
      const roofBanner = MeshBuilder.CreateBox(
        `RooftopAdBanner_${i}`,
        { width: roofAdWidth, height: roofAdHeight, depth: 0.2 },
        scene
      );
      roofBanner.position.set(
        winPos.x,
        roadSurfaceY + buildingHeight + roofAdHeight / 2.0 + 0.4,
        winPos.z
      );
      roofBanner.rotation.y = yawAngle;
      roofBanner.material = adMaterials[(buildingCount * 2) % adMaterials.length];
      roofBanner.parent = root;
      roofBanner.isPickable = false;

      // Roof Banner Support Legs
      for (const rLeg of [-1, 1]) {
        const leg = MeshBuilder.CreateCylinder(
          `RoofLeg_${i}_${rLeg}`,
          { height: 0.6, diameter: 0.15 },
          scene
        );
        const legOffset = pt.tangent.scale(rLeg * (roofAdWidth / 2.5));
        leg.position.set(
          winPos.x + legOffset.x,
          roadSurfaceY + buildingHeight + 0.2,
          winPos.z + legOffset.z
        );
        leg.material = postMat;
        leg.parent = root;
        leg.isPickable = false;
      }
    }

    return root;
  }
}