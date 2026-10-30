import {
  Scene,
  Vector3,
  Color3,
  Mesh,
  TransformNode,
  VertexData,
  PBRMaterial,
  StandardMaterial,
  Texture,
} from '@babylonjs/core';

export interface RoadSamplePoint {
  position: Vector3;
  tangent: Vector3;
  rightNormal: Vector3;
  distance: number;
  curvatureDeg: number;
  width?: number;
}

export class RoadMeshBuilder {
  private scene: Scene;
  public masterRoadMaterial: PBRMaterial | null = null;
  public whiteMarkingMaterial: StandardMaterial | null = null;
  public kerbMaterial: StandardMaterial | null = null;
  public vergeMaterial: StandardMaterial | null = null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initMaterials();
  }

  private initMaterials(): void {
    // 1. Realistic Asphalt PBR Material utilizing downloaded 1K PBR maps
    const roadMat = new PBRMaterial('MasterRoadAsphaltPBR', this.scene);
    
    const colorTex = new Texture('./Textures/Road/Road008C_1K-PNG_Color.png', this.scene, false, false);
    colorTex.wrapU = Texture.WRAP_ADDRESSMODE;
    colorTex.wrapV = Texture.WRAP_ADDRESSMODE;
    roadMat.albedoTexture = colorTex;

    const normalTex = new Texture('./Textures/Road/Road008C_1K-PNG_NormalGL.png', this.scene, false, false);
    normalTex.wrapU = Texture.WRAP_ADDRESSMODE;
    normalTex.wrapV = Texture.WRAP_ADDRESSMODE;
    roadMat.bumpTexture = normalTex;
    roadMat.invertNormalMapY = false;

    const aoTex = new Texture('./Textures/Road/Road008C_1K-PNG_AmbientOcclusion.png', this.scene, false, false);
    aoTex.wrapU = Texture.WRAP_ADDRESSMODE;
    aoTex.wrapV = Texture.WRAP_ADDRESSMODE;
    roadMat.ambientTexture = aoTex;

    const roughTex = new Texture('./Textures/Road/Road008C_1K-PNG_Roughness.png', this.scene, false, false);
    roughTex.wrapU = Texture.WRAP_ADDRESSMODE;
    roughTex.wrapV = Texture.WRAP_ADDRESSMODE;
    roadMat.metallicTexture = roughTex;

    roadMat.roughness = 0.86;
    roadMat.metallic = 0.04;
    roadMat.useRoughnessFromMetallicTextureAlpha = false;
    roadMat.useRoughnessFromMetallicTextureGreen = true;
    roadMat.specularIntensity = 0.35;
    roadMat.backFaceCulling = false;
    this.masterRoadMaterial = roadMat;

    // 2. White Edge Markings
    const whiteMat = new StandardMaterial('RoadMarkingWhiteMat', this.scene);
    whiteMat.diffuseColor = new Color3(0.94, 0.96, 0.98);
    whiteMat.specularColor = new Color3(0.1, 0.1, 0.1);
    whiteMat.backFaceCulling = false;
    this.whiteMarkingMaterial = whiteMat;

    // 3. Rumble Strip Kerbs (Vertex Colored)
    const kerbMat = new StandardMaterial('RoadKerbVertexColorMat', this.scene);
    kerbMat.diffuseColor = new Color3(1, 1, 1);
    kerbMat.specularColor = new Color3(0.12, 0.12, 0.12);
    kerbMat.backFaceCulling = false;
    this.kerbMaterial = kerbMat;

    // 4. Runoff Shoulder / Verge Material
    const vergeMat = new StandardMaterial('RoadVergeGrassMat', this.scene);
    vergeMat.diffuseColor = new Color3(0.16, 0.22, 0.14);
    vergeMat.specularColor = new Color3(0.01, 0.01, 0.01);
    vergeMat.backFaceCulling = false;
    this.vergeMaterial = vergeMat;
  }

  /**
   * Builds the continuous road surface split into discrete segments for frustum culling.
   * Total length 980.0m divided into segmentCount segments (default 98 segments of 10.0m each).
   */
  public buildRoadSegments(
    parent: TransformNode,
    samples: RoadSamplePoint[],
    segmentCount: number = 98,
    roadWidth: number = 13.0,
    roadSurfaceY: number = 0.05
  ): Mesh[] {
    const meshes: Mesh[] = [];
    const totalSamples = samples.length;
    const samplesPerSegment = totalSamples / segmentCount;
    const totalLength = samples[totalSamples - 1].distance +
      Vector3.Distance(samples[totalSamples - 1].position, samples[0].position);
    
    // UV tile repeats seamlessly modulo 1.0 (~8.0m per repeat)
    const repeatCount = Math.max(1, Math.round(totalLength / 8.0));
    const tileLength = totalLength / repeatCount;
    const defaultHalfWidth = roadWidth / 2.0;

    for (let segIdx = 0; segIdx < segmentCount; segIdx++) {
      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      const startIdx = Math.round(segIdx * samplesPerSegment);
      const endIdx = Math.round((segIdx + 1) * samplesPerSegment);
      const stepCount = endIdx - startIdx;

      for (let s = 0; s <= stepCount; s++) {
        const sampleIndex = (startIdx + s) % totalSamples;
        const pt = samples[sampleIndex];
        const halfWidth = pt.width !== undefined ? pt.width / 2.0 : defaultHalfWidth;

        // Left, Center, Right
        const left = pt.position.subtract(pt.rightNormal.scale(halfWidth));
        const center = pt.position;
        const right = pt.position.add(pt.rightNormal.scale(halfWidth));

        const dist = (startIdx + s) * (totalLength / totalSamples);
        const v = dist / tileLength;

        // Left: U = 0.0
        positions.push(left.x, roadSurfaceY, left.z);
        normals.push(0, 1, 0);
        uvs.push(0.0, v);

        // Center: U = 0.5 (aligns with dashed yellow line in Road008C texture)
        positions.push(center.x, roadSurfaceY, center.z);
        normals.push(0, 1, 0);
        uvs.push(0.5, v);

        // Right: U = 1.0
        positions.push(right.x, roadSurfaceY, right.z);
        normals.push(0, 1, 0);
        uvs.push(1.0, v);

        if (s < stepCount) {
          const r0 = s * 3;
          const r1 = (s + 1) * 3;

          // Left quad (clockwise from above)
          indices.push(r0, r1 + 1, r1);
          indices.push(r0, r0 + 1, r1 + 1);

          // Right quad (clockwise from above)
          indices.push(r0 + 1, r1 + 2, r1 + 1);
          indices.push(r0 + 1, r0 + 2, r1 + 2);
        }
      }

      VertexData.ComputeNormals(positions, indices, normals);

      const mesh = new Mesh(`Road_Section_${segIdx}`, this.scene);
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.normals = normals;
      vertexData.uvs = uvs;
      vertexData.indices = indices;
      vertexData.applyToMesh(mesh);

      mesh.material = this.masterRoadMaterial;
      mesh.parent = parent;
      mesh.receiveShadows = true;
      mesh.isPickable = true;
      mesh.checkCollisions = false;

      meshes.push(mesh);
    }

    return meshes;
  }

  /**
   * Builds continuous white road boundary edge markings (raised to 0.052 to prevent z-fighting).
   */
  public buildWhiteEdgeLines(
    parent: TransformNode,
    samples: RoadSamplePoint[],
    roadWidth: number = 13.0,
    lineWidth: number = 0.22,
    roadSurfaceY: number = 0.05
  ): Mesh[] {
    const yLine = roadSurfaceY + 0.002;
    const defaultHalfRoad = roadWidth / 2.0;
    const halfLine = lineWidth / 2.0;
    const totalSamples = samples.length;

    const buildSideLine = (name: string, isRight: boolean): Mesh => {
      const positions: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];
      const sideFactor = isRight ? 1 : -1;

      for (let i = 0; i <= totalSamples; i++) {
        const pt = samples[i % totalSamples];
        const halfRoad = pt.width !== undefined ? pt.width / 2.0 : defaultHalfRoad;
        const centerLinePos = pt.position.add(pt.rightNormal.scale(sideFactor * (halfRoad - halfLine)));
        const innerPt = centerLinePos.subtract(pt.rightNormal.scale(sideFactor * halfLine));
        const outerPt = centerLinePos.add(pt.rightNormal.scale(sideFactor * halfLine));

        positions.push(innerPt.x, yLine, innerPt.z);
        normals.push(0, 1, 0);

        positions.push(outerPt.x, yLine, outerPt.z);
        normals.push(0, 1, 0);

        if (i < totalSamples) {
          const r0 = i * 2;
          const r1 = (i + 1) * 2;
          indices.push(r0, r1 + 1, r1);
          indices.push(r0, r0 + 1, r1 + 1);
        }
      }

      VertexData.ComputeNormals(positions, indices, normals);

      const mesh = new Mesh(name, this.scene);
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.normals = normals;
      vertexData.indices = indices;
      vertexData.applyToMesh(mesh);

      mesh.material = this.whiteMarkingMaterial;
      mesh.parent = parent;
      mesh.isPickable = false;
      return mesh;
    };

    return [
      buildSideLine('Road_EdgeLine_Left', false),
      buildSideLine('Road_EdgeLine_Right', true),
    ];
  }

  /**
   * Builds alternating red and white racing rumble strips (kerbs) along corner apexes and exits.
   */
  public buildKerbs(
    parent: TransformNode,
    samples: RoadSamplePoint[],
    roadWidth: number = 13.0,
    kerbWidth: number = 0.85,
    roadSurfaceY: number = 0.05
  ): Mesh[] {
    const kerbMeshes: Mesh[] = [];
    const totalSamples = samples.length;
    const defaultHalfRoad = roadWidth / 2.0;

    // Filter contiguous corner apex regions where curvature is greater than 2.0 degrees
    const isApex = (i: number) => {
      const pt = samples[i % totalSamples];
      return pt.curvatureDeg > 2.0;
    };

    // Find apex intervals
    const intervals: Array<{ start: number; end: number; side: 'inside' | 'outside' | 'both' }> = [];
    let inApex = false;
    let startIdx = 0;

    for (let i = 0; i < totalSamples; i++) {
      if (isApex(i)) {
        if (!inApex) {
          inApex = true;
          startIdx = i;
        }
      } else {
        if (inApex) {
          inApex = false;
          // Pad interval by 2 samples on each end for smooth lead-in and exit
          intervals.push({
            start: Math.max(0, startIdx - 2),
            end: Math.min(totalSamples - 1, i + 2),
            side: 'both',
          });
        }
      }
    }

    // Colors for alternating red and white rumble strips
    const red = [0.85, 0.12, 0.12, 1.0];
    const white = [0.95, 0.95, 0.95, 1.0];

    intervals.forEach((interval, intIdx) => {
      ['Left', 'Right'].forEach(sideStr => {
        const isRight = sideStr === 'Right';
        const sideFactor = isRight ? 1 : -1;
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const count = interval.end - interval.start;
        if (count < 2) return;

        for (let s = 0; s <= count; s++) {
          const sampleIdx = (interval.start + s) % totalSamples;
          const pt = samples[sampleIdx];
          const halfRoad = pt.width !== undefined ? pt.width / 2.0 : defaultHalfRoad;

          const innerPos = pt.position.add(pt.rightNormal.scale(sideFactor * halfRoad));
          const outerPos = pt.position.add(pt.rightNormal.scale(sideFactor * (halfRoad + kerbWidth)));

          // Rumble strip is slightly raised ramp: 0.050 at road edge, 0.078 at outer edge
          const yInner = roadSurfaceY;
          const yOuter = roadSurfaceY + 0.028;

          positions.push(innerPos.x, yInner, innerPos.z);
          normals.push(0, 1, 0);

          positions.push(outerPos.x, yOuter, outerPos.z);
          normals.push(0, 1, 0);

          // Alternate red and white color every 1.0 meter
          const stripeColor = Math.floor(pt.distance / 1.0) % 2 === 0 ? red : white;
          colors.push(...stripeColor);
          colors.push(...stripeColor);

          if (s < count) {
            const r0 = s * 2;
            const r1 = (s + 1) * 2;
            indices.push(r0, r1 + 1, r1);
            indices.push(r0, r0 + 1, r1 + 1);
          }
        }

        VertexData.ComputeNormals(positions, indices, normals);

        const mesh = new Mesh(`Road_Kerb_${sideStr}_${intIdx}`, this.scene);
        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.normals = normals;
        vertexData.colors = colors;
        vertexData.indices = indices;
        vertexData.applyToMesh(mesh);

        mesh.material = this.kerbMaterial;
        mesh.parent = parent;
        mesh.isPickable = false;
        kerbMeshes.push(mesh);
      });
    });

    return kerbMeshes;
  }

  /**
   * Builds soft shoulder/verge runoffs along outer edges of the asphalt (elevated at 0.045m).
   */
  public buildVerges(
    parent: TransformNode,
    samples: RoadSamplePoint[],
    roadWidth: number = 13.0,
    vergeWidth: number = 4.5,
    roadSurfaceY: number = 0.05
  ): Mesh[] {
    const yVerge = roadSurfaceY - 0.005;
    const defaultHalfRoad = roadWidth / 2.0;
    const totalSamples = samples.length;

    const buildSideVerge = (name: string, isRight: boolean): Mesh => {
      const positions: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];
      const sideFactor = isRight ? 1 : -1;

      for (let i = 0; i <= totalSamples; i++) {
        const pt = samples[i % totalSamples];
        const halfRoad = pt.width !== undefined ? pt.width / 2.0 : defaultHalfRoad;
        const innerPt = pt.position.add(pt.rightNormal.scale(sideFactor * halfRoad));
        const outerPt = pt.position.add(pt.rightNormal.scale(sideFactor * (halfRoad + vergeWidth)));

        positions.push(innerPt.x, yVerge, innerPt.z);
        normals.push(0, 1, 0);

        positions.push(outerPt.x, yVerge, outerPt.z);
        normals.push(0, 1, 0);

        if (i < totalSamples) {
          const r0 = i * 2;
          const r1 = (i + 1) * 2;
          indices.push(r0, r1 + 1, r1);
          indices.push(r0, r0 + 1, r1 + 1);
        }
      }

      VertexData.ComputeNormals(positions, indices, normals);

      const mesh = new Mesh(name, this.scene);
      const vertexData = new VertexData();
      vertexData.positions = positions;
      vertexData.normals = normals;
      vertexData.indices = indices;
      vertexData.applyToMesh(mesh);

      mesh.material = this.vergeMaterial;
      mesh.parent = parent;
      mesh.isPickable = false;
      return mesh;
    };

    return [
      buildSideVerge('Road_Verge_Left', false),
      buildSideVerge('Road_Verge_Right', true),
    ];
  }
}
