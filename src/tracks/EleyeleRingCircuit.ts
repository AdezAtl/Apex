import {
  Scene,
  Vector3,
  Color3,
  TransformNode,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
} from '@babylonjs/core';
import { CircuitDefinition } from './TrackConfig';
import { RaceEventConfig } from '../events/EventConfig';
import { RoadSamplePoint } from '../environment/RoadMeshBuilder';
import { CheckpointData } from '../checkpoints/CheckpointManager';

// 335 discrete road sample points derived from OpenStreetMap road network geometry
// Total circuit measured length: 1507.2m
// Dynamic asphalt width: 10.5m to 13.5m
const eleyeleRoadSamples: RoadSamplePoint[] = [
  { position: new Vector3(-133.96, 0.05, 239.91), tangent: new Vector3(0.788, 0, -0.616), rightNormal: new Vector3(-0.616, 0, -0.788), distance: 0, curvatureDeg: 0.31, width: 13.42 },
  { position: new Vector3(-130.41, 0.05, 237.15), tangent: new Vector3(0.798, 0, -0.602), rightNormal: new Vector3(-0.602, 0, -0.798), distance: 4.5, curvatureDeg: 1.69, width: 13.08 },
  { position: new Vector3(-126.78, 0.05, 234.5), tangent: new Vector3(0.812, 0, -0.583), rightNormal: new Vector3(-0.583, 0, -0.812), distance: 9, curvatureDeg: 1.01, width: 13.25 },
  { position: new Vector3(-123.1, 0.05, 231.91), tangent: new Vector3(0.822, 0, -0.57), rightNormal: new Vector3(-0.57, 0, -0.822), distance: 13.5, curvatureDeg: 0.8, width: 13.3 },
  { position: new Vector3(-119.39, 0.05, 229.37), tangent: new Vector3(0.828, 0, -0.561), rightNormal: new Vector3(-0.561, 0, -0.828), distance: 18, curvatureDeg: 0.46, width: 13.38 },
  { position: new Vector3(-115.65, 0.05, 226.86), tangent: new Vector3(0.832, 0, -0.555), rightNormal: new Vector3(-0.555, 0, -0.832), distance: 22.5, curvatureDeg: 0.38, width: 13.41 },
  { position: new Vector3(-111.9, 0.05, 224.37), tangent: new Vector3(0.835, 0, -0.55), rightNormal: new Vector3(-0.55, 0, -0.835), distance: 26.99, curvatureDeg: 0.23, width: 13.44 },
  { position: new Vector3(-108.14, 0.05, 221.9), tangent: new Vector3(0.837, 0, -0.548), rightNormal: new Vector3(-0.548, 0, -0.837), distance: 31.49, curvatureDeg: 0.13, width: 13.47 },
  { position: new Vector3(-104.38, 0.05, 219.44), tangent: new Vector3(0.837, 0, -0.547), rightNormal: new Vector3(-0.547, 0, -0.837), distance: 35.99, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(-100.61, 0.05, 216.99), tangent: new Vector3(0.837, 0, -0.547), rightNormal: new Vector3(-0.547, 0, -0.837), distance: 40.49, curvatureDeg: 0.06, width: 13.48 },
  { position: new Vector3(-96.84, 0.05, 214.52), tangent: new Vector3(0.836, 0, -0.548), rightNormal: new Vector3(-0.548, 0, -0.836), distance: 44.99, curvatureDeg: 0.17, width: 13.46 },
  { position: new Vector3(-93.08, 0.05, 212.05), tangent: new Vector3(0.834, 0, -0.552), rightNormal: new Vector3(-0.552, 0, -0.834), distance: 49.49, curvatureDeg: 0.34, width: 13.42 },
  { position: new Vector3(-89.34, 0.05, 209.56), tangent: new Vector3(0.83, 0, -0.558), rightNormal: new Vector3(-0.558, 0, -0.83), distance: 53.99, curvatureDeg: 0.53, width: 13.37 },
  { position: new Vector3(-85.62, 0.05, 207.03), tangent: new Vector3(0.823, 0, -0.569), rightNormal: new Vector3(-0.569, 0, -0.823), distance: 58.49, curvatureDeg: 0.88, width: 13.28 },
  { position: new Vector3(-81.94, 0.05, 204.44), tangent: new Vector3(0.809, 0, -0.587), rightNormal: new Vector3(-0.587, 0, -0.809), distance: 62.99, curvatureDeg: 1.74, width: 13.06 },
  { position: new Vector3(-78.34, 0.05, 201.74), tangent: new Vector3(0.789, 0, -0.614), rightNormal: new Vector3(-0.614, 0, -0.789), distance: 67.49, curvatureDeg: 2.15, width: 12.96 },
  { position: new Vector3(-74.84, 0.05, 198.91), tangent: new Vector3(0.771, 0, -0.637), rightNormal: new Vector3(-0.637, 0, -0.771), distance: 71.99, curvatureDeg: 1.09, width: 13.23 },
  { position: new Vector3(-71.4, 0.05, 196.02), tangent: new Vector3(0.703, 0, -0.711), rightNormal: new Vector3(-0.711, 0, -0.703), distance: 76.48, curvatureDeg: 10.53, width: 10.87 },
  { position: new Vector3(-68.55, 0.05, 192.55), tangent: new Vector3(0.561, 0, -0.828), rightNormal: new Vector3(-0.828, 0, -0.561), distance: 80.98, curvatureDeg: 10.49, width: 10.88 },
  { position: new Vector3(-66.38, 0.05, 188.61), tangent: new Vector3(0.438, 0, -0.899), rightNormal: new Vector3(-0.899, 0, -0.438), distance: 85.48, curvatureDeg: 5.82, width: 12.04 },
  { position: new Vector3(-64.62, 0.05, 184.47), tangent: new Vector3(0.366, 0, -0.931), rightNormal: new Vector3(-0.931, 0, -0.366), distance: 89.98, curvatureDeg: 3.18, width: 12.7 },
  { position: new Vector3(-63.08, 0.05, 180.24), tangent: new Vector3(0.321, 0, -0.947), rightNormal: new Vector3(-0.947, 0, -0.321), distance: 94.48, curvatureDeg: 2.33, width: 12.92 },
  { position: new Vector3(-61.73, 0.05, 175.95), tangent: new Vector3(0.285, 0, -0.959), rightNormal: new Vector3(-0.959, 0, -0.285), distance: 98.98, curvatureDeg: 2.04, width: 12.99 },
  { position: new Vector3(-60.52, 0.05, 171.62), tangent: new Vector3(0.249, 0, -0.968), rightNormal: new Vector3(-0.968, 0, -0.249), distance: 103.48, curvatureDeg: 2.13, width: 12.97 },
  { position: new Vector3(-59.48, 0.05, 167.24), tangent: new Vector3(0.207, 0, -0.978), rightNormal: new Vector3(-0.978, 0, -0.207), distance: 107.98, curvatureDeg: 2.86, width: 12.78 },
  { position: new Vector3(-58.66, 0.05, 162.82), tangent: new Vector3(0.143, 0, -0.99), rightNormal: new Vector3(-0.99, 0, -0.143), distance: 112.48, curvatureDeg: 4.62, width: 12.34 },
  { position: new Vector3(-58.2, 0.05, 158.35), tangent: new Vector3(0.041, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.041), distance: 116.98, curvatureDeg: 7.11, width: 11.72 },
  { position: new Vector3(-58.3, 0.05, 153.85), tangent: new Vector3(-0.113, 0, -0.994), rightNormal: new Vector3(-0.994, 0, 0.113), distance: 121.48, curvatureDeg: 10.51, width: 10.87 },
  { position: new Vector3(-59.21, 0.05, 149.45), tangent: new Vector3(-0.303, 0, -0.953), rightNormal: new Vector3(-0.953, 0, 0.303), distance: 125.98, curvatureDeg: 11.84, width: 10.54 },
  { position: new Vector3(-61, 0.05, 145.34), tangent: new Vector3(-0.476, 0, -0.88), rightNormal: new Vector3(-0.88, 0, 0.476), distance: 130.47, curvatureDeg: 9.69, width: 11.08 },
  { position: new Vector3(-63.47, 0.05, 141.58), tangent: new Vector3(-0.573, 0, -0.82), rightNormal: new Vector3(-0.82, 0, 0.573), distance: 134.97, curvatureDeg: 3.39, width: 12.65 },
  { position: new Vector3(-66.15, 0.05, 137.97), tangent: new Vector3(-0.607, 0, -0.795), rightNormal: new Vector3(-0.795, 0, 0.607), distance: 139.47, curvatureDeg: 1.42, width: 13.15 },
  { position: new Vector3(-68.93, 0.05, 134.43), tangent: new Vector3(-0.649, 0, -0.76), rightNormal: new Vector3(-0.76, 0, 0.649), distance: 143.97, curvatureDeg: 4.87, width: 12.28 },
  { position: new Vector3(-71.99, 0.05, 131.13), tangent: new Vector3(-0.672, 0, -0.741), rightNormal: new Vector3(-0.741, 0, 0.672), distance: 148.47, curvatureDeg: 1.5, width: 13.12 },
  { position: new Vector3(-74.97, 0.05, 127.76), tangent: new Vector3(-0.603, 0, -0.797), rightNormal: new Vector3(-0.797, 0, 0.603), distance: 152.97, curvatureDeg: 8.65, width: 11.34 },
  { position: new Vector3(-77.4, 0.05, 123.99), tangent: new Vector3(-0.475, 0, -0.88), rightNormal: new Vector3(-0.88, 0, 0.475), distance: 157.47, curvatureDeg: 8.79, width: 11.3 },
  { position: new Vector3(-79.23, 0.05, 119.88), tangent: new Vector3(-0.363, 0, -0.932), rightNormal: new Vector3(-0.932, 0, 0.363), distance: 161.97, curvatureDeg: 5.47, width: 12.13 },
  { position: new Vector3(-80.66, 0.05, 115.62), tangent: new Vector3(-0.26, 0, -0.966), rightNormal: new Vector3(-0.966, 0, 0.26), distance: 166.47, curvatureDeg: 6.9, width: 11.77 },
  { position: new Vector3(-81.56, 0.05, 111.21), tangent: new Vector3(-0.099, 0, -0.995), rightNormal: new Vector3(-0.995, 0, 0.099), distance: 170.97, curvatureDeg: 11.85, width: 10.54 },
  { position: new Vector3(-81.54, 0.05, 106.73), tangent: new Vector3(0.186, 0, -0.982), rightNormal: new Vector3(-0.982, 0, -0.186), distance: 175.47, curvatureDeg: 21.02, width: 10.5 },
  { position: new Vector3(-79.92, 0.05, 102.55), tangent: new Vector3(0.424, 0, -0.906), rightNormal: new Vector3(-0.906, 0, -0.424), distance: 179.96, curvatureDeg: 7.65, width: 11.59 },
  { position: new Vector3(-77.74, 0.05, 98.62), tangent: new Vector3(0.437, 0, -0.9), rightNormal: new Vector3(-0.9, 0, -0.437), distance: 184.46, curvatureDeg: 6.06, width: 11.99 },
  { position: new Vector3(-76, 0.05, 94.47), tangent: new Vector3(0.405, 0, -0.914), rightNormal: new Vector3(-0.914, 0, -0.405), distance: 188.96, curvatureDeg: 2.03, width: 12.99 },
  { position: new Vector3(-74.1, 0.05, 90.39), tangent: new Vector3(0.307, 0, -0.952), rightNormal: new Vector3(-0.952, 0, -0.307), distance: 193.46, curvatureDeg: 14.04, width: 10.5 },
  { position: new Vector3(-73.26, 0.05, 86.01), tangent: new Vector3(-0.085, 0, -0.996), rightNormal: new Vector3(-0.996, 0, 0.085), distance: 197.96, curvatureDeg: 31.49, width: 10.5 },
  { position: new Vector3(-74.83, 0.05, 81.86), tangent: new Vector3(-0.518, 0, -0.855), rightNormal: new Vector3(-0.855, 0, 0.518), distance: 202.46, curvatureDeg: 21.04, width: 10.5 },
  { position: new Vector3(-77.81, 0.05, 78.5), tangent: new Vector3(-0.71, 0, -0.704), rightNormal: new Vector3(-0.704, 0, 0.71), distance: 206.96, curvatureDeg: 7.16, width: 11.71 },
  { position: new Vector3(-81.2, 0.05, 75.54), tangent: new Vector3(-0.773, 0, -0.634), rightNormal: new Vector3(-0.634, 0, 0.773), distance: 211.46, curvatureDeg: 3.66, width: 12.58 },
  { position: new Vector3(-84.77, 0.05, 72.8), tangent: new Vector3(-0.804, 0, -0.595), rightNormal: new Vector3(-0.595, 0, 0.804), distance: 215.96, curvatureDeg: 2.05, width: 12.99 },
  { position: new Vector3(-88.43, 0.05, 70.19), tangent: new Vector3(-0.82, 0, -0.572), rightNormal: new Vector3(-0.572, 0, 0.82), distance: 220.46, curvatureDeg: 1.17, width: 13.21 },
  { position: new Vector3(-92.15, 0.05, 67.66), tangent: new Vector3(-0.829, 0, -0.559), rightNormal: new Vector3(-0.559, 0, 0.829), distance: 224.96, curvatureDeg: 0.58, width: 13.35 },
  { position: new Vector3(-95.89, 0.05, 65.16), tangent: new Vector3(-0.832, 0, -0.554), rightNormal: new Vector3(-0.554, 0, 0.832), distance: 229.45, curvatureDeg: 0.09, width: 13.48 },
  { position: new Vector3(-99.64, 0.05, 62.67), tangent: new Vector3(-0.83, 0, -0.557), rightNormal: new Vector3(-0.557, 0, 0.83), distance: 233.95, curvatureDeg: 0.49, width: 13.38 },
  { position: new Vector3(-103.36, 0.05, 60.15), tangent: new Vector3(-0.821, 0, -0.571), rightNormal: new Vector3(-0.571, 0, 0.821), distance: 238.45, curvatureDeg: 1.41, width: 13.15 },
  { position: new Vector3(-107.03, 0.05, 57.53), tangent: new Vector3(-0.797, 0, -0.604), rightNormal: new Vector3(-0.604, 0, 0.797), distance: 242.95, curvatureDeg: 3.26, width: 12.68 },
  { position: new Vector3(-110.53, 0.05, 54.71), tangent: new Vector3(-0.744, 0, -0.668), rightNormal: new Vector3(-0.668, 0, 0.744), distance: 247.45, curvatureDeg: 6.21, width: 11.95 },
  { position: new Vector3(-113.71, 0.05, 51.53), tangent: new Vector3(-0.686, 0, -0.728), rightNormal: new Vector3(-0.728, 0, 0.686), distance: 251.95, curvatureDeg: 3.37, width: 12.66 },
  { position: new Vector3(-116.7, 0.05, 48.17), tangent: new Vector3(-0.567, 0, -0.824), rightNormal: new Vector3(-0.824, 0, 0.567), distance: 256.45, curvatureDeg: 14.28, width: 10.5 },
  { position: new Vector3(-118.76, 0.05, 44.2), tangent: new Vector3(-0.298, 0, -0.955), rightNormal: new Vector3(-0.955, 0, 0.298), distance: 260.95, curvatureDeg: 20.01, width: 10.5 },
  { position: new Vector3(-119.33, 0.05, 39.76), tangent: new Vector3(0.011, 0, -1), rightNormal: new Vector3(-1, 0, -0.011), distance: 265.45, curvatureDeg: 15.87, width: 10.5 },
  { position: new Vector3(-118.66, 0.05, 35.32), tangent: new Vector3(0.194, 0, -0.981), rightNormal: new Vector3(-0.981, 0, -0.194), distance: 269.95, curvatureDeg: 5.32, width: 12.17 },
  { position: new Vector3(-117.58, 0.05, 30.95), tangent: new Vector3(0.266, 0, -0.964), rightNormal: new Vector3(-0.964, 0, -0.266), distance: 274.45, curvatureDeg: 3.1, width: 12.73 },
  { position: new Vector3(-116.27, 0.05, 26.65), tangent: new Vector3(0.31, 0, -0.951), rightNormal: new Vector3(-0.951, 0, -0.31), distance: 278.95, curvatureDeg: 2.24, width: 12.94 },
  { position: new Vector3(-114.79, 0.05, 22.4), tangent: new Vector3(0.337, 0, -0.941), rightNormal: new Vector3(-0.941, 0, -0.337), distance: 283.44, curvatureDeg: 1.07, width: 13.23 },
  { position: new Vector3(-113.24, 0.05, 18.18), tangent: new Vector3(0.352, 0, -0.936), rightNormal: new Vector3(-0.936, 0, -0.352), distance: 287.94, curvatureDeg: 0.74, width: 13.31 },
  { position: new Vector3(-111.62, 0.05, 13.98), tangent: new Vector3(0.363, 0, -0.932), rightNormal: new Vector3(-0.932, 0, -0.363), distance: 292.44, curvatureDeg: 0.55, width: 13.36 },
  { position: new Vector3(-109.97, 0.05, 9.79), tangent: new Vector3(0.371, 0, -0.929), rightNormal: new Vector3(-0.929, 0, -0.371), distance: 296.94, curvatureDeg: 0.46, width: 13.38 },
  { position: new Vector3(-108.28, 0.05, 5.62), tangent: new Vector3(0.378, 0, -0.926), rightNormal: new Vector3(-0.926, 0, -0.378), distance: 301.44, curvatureDeg: 0.41, width: 13.4 },
  { position: new Vector3(-106.57, 0.05, 1.46), tangent: new Vector3(0.384, 0, -0.923), rightNormal: new Vector3(-0.923, 0, -0.384), distance: 305.94, curvatureDeg: 0.29, width: 13.43 },
  { position: new Vector3(-104.83, 0.05, -2.69), tangent: new Vector3(0.388, 0, -0.922), rightNormal: new Vector3(-0.922, 0, -0.388), distance: 310.44, curvatureDeg: 0.25, width: 13.44 },
  { position: new Vector3(-103.08, 0.05, -6.83), tangent: new Vector3(0.392, 0, -0.92), rightNormal: new Vector3(-0.92, 0, -0.392), distance: 314.94, curvatureDeg: 0.22, width: 13.44 },
  { position: new Vector3(-101.3, 0.05, -10.97), tangent: new Vector3(0.396, 0, -0.918), rightNormal: new Vector3(-0.918, 0, -0.396), distance: 319.44, curvatureDeg: 0.29, width: 13.43 },
  { position: new Vector3(-99.51, 0.05, -15.09), tangent: new Vector3(0.4, 0, -0.916), rightNormal: new Vector3(-0.916, 0, -0.4), distance: 323.94, curvatureDeg: 0.2, width: 13.45 },
  { position: new Vector3(-97.7, 0.05, -19.21), tangent: new Vector3(0.403, 0, -0.915), rightNormal: new Vector3(-0.915, 0, -0.403), distance: 328.44, curvatureDeg: 0.17, width: 13.46 },
  { position: new Vector3(-95.88, 0.05, -23.33), tangent: new Vector3(0.406, 0, -0.914), rightNormal: new Vector3(-0.914, 0, -0.406), distance: 332.93, curvatureDeg: 0.18, width: 13.45 },
  { position: new Vector3(-94.05, 0.05, -27.44), tangent: new Vector3(0.409, 0, -0.912), rightNormal: new Vector3(-0.912, 0, -0.409), distance: 337.43, curvatureDeg: 0.25, width: 13.44 },
  { position: new Vector3(-92.2, 0.05, -31.54), tangent: new Vector3(0.413, 0, -0.911), rightNormal: new Vector3(-0.911, 0, -0.413), distance: 341.93, curvatureDeg: 0.16, width: 13.46 },
  { position: new Vector3(-90.34, 0.05, -35.63), tangent: new Vector3(0.415, 0, -0.91), rightNormal: new Vector3(-0.91, 0, -0.415), distance: 346.43, curvatureDeg: 0.17, width: 13.46 },
  { position: new Vector3(-88.46, 0.05, -39.72), tangent: new Vector3(0.418, 0, -0.908), rightNormal: new Vector3(-0.908, 0, -0.418), distance: 350.93, curvatureDeg: 0.22, width: 13.45 },
  { position: new Vector3(-86.57, 0.05, -43.81), tangent: new Vector3(0.422, 0, -0.907), rightNormal: new Vector3(-0.907, 0, -0.422), distance: 355.43, curvatureDeg: 0.24, width: 13.44 },
  { position: new Vector3(-84.67, 0.05, -47.88), tangent: new Vector3(0.426, 0, -0.905), rightNormal: new Vector3(-0.905, 0, -0.426), distance: 359.93, curvatureDeg: 0.21, width: 13.45 },
  { position: new Vector3(-82.74, 0.05, -51.95), tangent: new Vector3(0.429, 0, -0.903), rightNormal: new Vector3(-0.903, 0, -0.429), distance: 364.43, curvatureDeg: 0.24, width: 13.44 },
  { position: new Vector3(-80.8, 0.05, -56.01), tangent: new Vector3(0.433, 0, -0.901), rightNormal: new Vector3(-0.901, 0, -0.433), distance: 368.93, curvatureDeg: 0.28, width: 13.43 },
  { position: new Vector3(-78.84, 0.05, -60.06), tangent: new Vector3(0.438, 0, -0.899), rightNormal: new Vector3(-0.899, 0, -0.438), distance: 373.43, curvatureDeg: 0.34, width: 13.41 },
  { position: new Vector3(-76.86, 0.05, -64.1), tangent: new Vector3(0.444, 0, -0.896), rightNormal: new Vector3(-0.896, 0, -0.444), distance: 377.93, curvatureDeg: 0.44, width: 13.39 },
  { position: new Vector3(-74.85, 0.05, -68.12), tangent: new Vector3(0.452, 0, -0.892), rightNormal: new Vector3(-0.892, 0, -0.452), distance: 382.42, curvatureDeg: 0.59, width: 13.35 },
  { position: new Vector3(-72.79, 0.05, -72.12), tangent: new Vector3(0.464, 0, -0.886), rightNormal: new Vector3(-0.886, 0, -0.464), distance: 386.92, curvatureDeg: 0.9, width: 13.27 },
  { position: new Vector3(-70.67, 0.05, -76.09), tangent: new Vector3(0.479, 0, -0.878), rightNormal: new Vector3(-0.878, 0, -0.479), distance: 391.42, curvatureDeg: 0.99, width: 13.25 },
  { position: new Vector3(-68.49, 0.05, -80.02), tangent: new Vector3(0.486, 0, -0.874), rightNormal: new Vector3(-0.874, 0, -0.486), distance: 395.92, curvatureDeg: 0.02, width: 13.49 },
  { position: new Vector3(-66.3, 0.05, -83.95), tangent: new Vector3(0.495, 0, -0.869), rightNormal: new Vector3(-0.869, 0, -0.495), distance: 400.42, curvatureDeg: 1.13, width: 13.22 },
  { position: new Vector3(-64.03, 0.05, -87.84), tangent: new Vector3(0.536, 0, -0.844), rightNormal: new Vector3(-0.844, 0, -0.536), distance: 404.92, curvatureDeg: 4.31, width: 12.42 },
  { position: new Vector3(-61.48, 0.05, -91.55), tangent: new Vector3(0.637, 0, -0.771), rightNormal: new Vector3(-0.771, 0, -0.637), distance: 409.42, curvatureDeg: 10.1, width: 10.97 },
  { position: new Vector3(-58.33, 0.05, -94.74), tangent: new Vector3(0.79, 0, -0.613), rightNormal: new Vector3(-0.613, 0, -0.79), distance: 413.92, curvatureDeg: 15.15, width: 10.5 },
  { position: new Vector3(-54.45, 0.05, -97), tangent: new Vector3(0.929, 0, -0.37), rightNormal: new Vector3(-0.37, 0, -0.929), distance: 418.42, curvatureDeg: 17.03, width: 10.5 },
  { position: new Vector3(-50.09, 0.05, -98.02), tangent: new Vector3(0.992, 0, -0.13), rightNormal: new Vector3(-0.13, 0, -0.992), distance: 422.92, curvatureDeg: 11.42, width: 10.64 },
  { position: new Vector3(-45.59, 0.05, -98.16), tangent: new Vector3(1, 0, 0.03), rightNormal: new Vector3(0.03, 0, -1), distance: 427.42, curvatureDeg: 6.95, width: 11.76 },
  { position: new Vector3(-41.12, 0.05, -97.75), tangent: new Vector3(0.985, 0, 0.17), rightNormal: new Vector3(0.17, 0, -0.985), distance: 431.91, curvatureDeg: 9.22, width: 11.19 },
  { position: new Vector3(-36.77, 0.05, -96.63), tangent: new Vector3(0.958, 0, 0.285), rightNormal: new Vector3(0.285, 0, -0.958), distance: 436.41, curvatureDeg: 4.32, width: 12.42 },
  { position: new Vector3(-32.51, 0.05, -95.18), tangent: new Vector3(0.941, 0, 0.338), rightNormal: new Vector3(0.338, 0, -0.941), distance: 440.91, curvatureDeg: 2.07, width: 12.98 },
  { position: new Vector3(-28.3, 0.05, -93.59), tangent: new Vector3(0.931, 0, 0.364), rightNormal: new Vector3(0.364, 0, -0.931), distance: 445.41, curvatureDeg: 1.05, width: 13.24 },
  { position: new Vector3(-24.13, 0.05, -91.91), tangent: new Vector3(0.927, 0, 0.375), rightNormal: new Vector3(0.375, 0, -0.927), distance: 449.91, curvatureDeg: 0.28, width: 13.43 },
  { position: new Vector3(-19.96, 0.05, -90.22), tangent: new Vector3(0.927, 0, 0.375), rightNormal: new Vector3(0.375, 0, -0.927), distance: 454.41, curvatureDeg: 0.22, width: 13.44 },
  { position: new Vector3(-15.78, 0.05, -88.54), tangent: new Vector3(0.93, 0, 0.368), rightNormal: new Vector3(0.368, 0, -0.93), distance: 458.91, curvatureDeg: 0.7, width: 13.33 },
  { position: new Vector3(-11.59, 0.05, -86.91), tangent: new Vector3(0.936, 0, 0.353), rightNormal: new Vector3(0.353, 0, -0.936), distance: 463.41, curvatureDeg: 1.05, width: 13.24 },
  { position: new Vector3(-7.37, 0.05, -85.36), tangent: new Vector3(0.944, 0, 0.33), rightNormal: new Vector3(0.33, 0, -0.944), distance: 467.91, curvatureDeg: 1.83, width: 13.04 },
  { position: new Vector3(-3.1, 0.05, -83.94), tangent: new Vector3(0.955, 0, 0.296), rightNormal: new Vector3(0.296, 0, -0.955), distance: 472.41, curvatureDeg: 2.29, width: 12.93 },
  { position: new Vector3(1.23, 0.05, -82.7), tangent: new Vector3(0.969, 0, 0.248), rightNormal: new Vector3(0.248, 0, -0.969), distance: 476.91, curvatureDeg: 3.38, width: 12.65 },
  { position: new Vector3(5.61, 0.05, -81.71), tangent: new Vector3(0.984, 0, 0.179), rightNormal: new Vector3(0.179, 0, -0.984), distance: 481.41, curvatureDeg: 4.7, width: 12.32 },
  { position: new Vector3(10.07, 0.05, -81.09), tangent: new Vector3(0.997, 0, 0.074), rightNormal: new Vector3(0.074, 0, -0.997), distance: 485.9, curvatureDeg: 7.42, width: 11.65 },
  { position: new Vector3(14.56, 0.05, -81.05), tangent: new Vector3(0.996, 0, -0.085), rightNormal: new Vector3(-0.085, 0, -0.996), distance: 490.4, curvatureDeg: 10.86, width: 10.79 },
  { position: new Vector3(18.97, 0.05, -81.85), tangent: new Vector3(0.953, 0, -0.302), rightNormal: new Vector3(-0.302, 0, -0.953), distance: 494.9, curvatureDeg: 14.6, width: 10.5 },
  { position: new Vector3(23.04, 0.05, -83.73), tangent: new Vector3(0.857, 0, -0.515), rightNormal: new Vector3(-0.515, 0, -0.857), distance: 499.4, curvatureDeg: 12.23, width: 10.5 },
  { position: new Vector3(26.61, 0.05, -86.45), tangent: new Vector3(0.749, 0, -0.663), rightNormal: new Vector3(-0.663, 0, -0.749), distance: 503.9, curvatureDeg: 8.77, width: 11.31 },
  { position: new Vector3(29.74, 0.05, -89.67), tangent: new Vector3(0.655, 0, -0.755), rightNormal: new Vector3(-0.755, 0, -0.655), distance: 508.4, curvatureDeg: 6.3, width: 11.92 },
  { position: new Vector3(32.5, 0.05, -93.23), tangent: new Vector3(0.581, 0, -0.814), rightNormal: new Vector3(-0.814, 0, -0.581), distance: 512.9, curvatureDeg: 4.58, width: 12.35 },
  { position: new Vector3(34.96, 0.05, -96.99), tangent: new Vector3(0.526, 0, -0.85), rightNormal: new Vector3(-0.85, 0, -0.526), distance: 517.4, curvatureDeg: 2.95, width: 12.76 },
  { position: new Vector3(37.23, 0.05, -100.88), tangent: new Vector3(0.485, 0, -0.874), rightNormal: new Vector3(-0.874, 0, -0.485), distance: 521.9, curvatureDeg: 2.49, width: 12.88 },
  { position: new Vector3(39.33, 0.05, -104.86), tangent: new Vector3(0.455, 0, -0.891), rightNormal: new Vector3(-0.891, 0, -0.455), distance: 526.4, curvatureDeg: 1.43, width: 13.14 },
  { position: new Vector3(41.32, 0.05, -108.89), tangent: new Vector3(0.435, 0, -0.901), rightNormal: new Vector3(-0.901, 0, -0.435), distance: 530.9, curvatureDeg: 1.17, width: 13.21 },
  { position: new Vector3(43.24, 0.05, -112.96), tangent: new Vector3(0.421, 0, -0.907), rightNormal: new Vector3(-0.907, 0, -0.421), distance: 535.39, curvatureDeg: 0.5, width: 13.37 },
  { position: new Vector3(45.11, 0.05, -117.05), tangent: new Vector3(0.417, 0, -0.909), rightNormal: new Vector3(-0.909, 0, -0.417), distance: 539.89, curvatureDeg: 0.11, width: 13.47 },
  { position: new Vector3(46.98, 0.05, -121.14), tangent: new Vector3(0.419, 0, -0.908), rightNormal: new Vector3(-0.908, 0, -0.419), distance: 544.39, curvatureDeg: 0.36, width: 13.41 },
  { position: new Vector3(48.88, 0.05, -125.22), tangent: new Vector3(0.429, 0, -0.903), rightNormal: new Vector3(-0.903, 0, -0.429), distance: 548.89, curvatureDeg: 1.01, width: 13.25 },
  { position: new Vector3(50.85, 0.05, -129.27), tangent: new Vector3(0.45, 0, -0.893), rightNormal: new Vector3(-0.893, 0, -0.45), distance: 553.39, curvatureDeg: 1.57, width: 13.11 },
  { position: new Vector3(52.93, 0.05, -133.26), tangent: new Vector3(0.484, 0, -0.875), rightNormal: new Vector3(-0.875, 0, -0.484), distance: 557.89, curvatureDeg: 2.89, width: 12.78 },
  { position: new Vector3(55.2, 0.05, -137.14), tangent: new Vector3(0.522, 0, -0.853), rightNormal: new Vector3(-0.853, 0, -0.522), distance: 562.39, curvatureDeg: 2.18, width: 12.95 },
  { position: new Vector3(57.62, 0.05, -140.93), tangent: new Vector3(0.54, 0, -0.842), rightNormal: new Vector3(-0.842, 0, -0.54), distance: 566.89, curvatureDeg: 0.17, width: 13.46 },
  { position: new Vector3(60.06, 0.05, -144.71), tangent: new Vector3(0.541, 0, -0.841), rightNormal: new Vector3(-0.841, 0, -0.541), distance: 571.39, curvatureDeg: 0.03, width: 13.49 },
  { position: new Vector3(62.49, 0.05, -148.49), tangent: new Vector3(0.542, 0, -0.841), rightNormal: new Vector3(-0.841, 0, -0.542), distance: 575.89, curvatureDeg: 0.02, width: 13.49 },
  { position: new Vector3(64.93, 0.05, -152.28), tangent: new Vector3(0.542, 0, -0.84), rightNormal: new Vector3(-0.84, 0, -0.542), distance: 580.39, curvatureDeg: 0.02, width: 13.49 },
  { position: new Vector3(67.37, 0.05, -156.06), tangent: new Vector3(0.542, 0, -0.84), rightNormal: new Vector3(-0.84, 0, -0.542), distance: 584.88, curvatureDeg: 0.02, width: 13.5 },
  { position: new Vector3(69.81, 0.05, -159.84), tangent: new Vector3(0.542, 0, -0.84), rightNormal: new Vector3(-0.84, 0, -0.542), distance: 589.38, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(72.25, 0.05, -163.62), tangent: new Vector3(0.542, 0, -0.84), rightNormal: new Vector3(-0.84, 0, -0.542), distance: 593.88, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(74.69, 0.05, -167.4), tangent: new Vector3(0.542, 0, -0.84), rightNormal: new Vector3(-0.84, 0, -0.542), distance: 598.38, curvatureDeg: 0, width: 13.5 },
  { position: new Vector3(77.13, 0.05, -171.18), tangent: new Vector3(0.542, 0, -0.84), rightNormal: new Vector3(-0.84, 0, -0.542), distance: 602.88, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(79.57, 0.05, -174.96), tangent: new Vector3(0.547, 0, -0.837), rightNormal: new Vector3(-0.837, 0, -0.547), distance: 607.38, curvatureDeg: 0.67, width: 13.33 },
  { position: new Vector3(82.05, 0.05, -178.71), tangent: new Vector3(0.559, 0, -0.829), rightNormal: new Vector3(-0.829, 0, -0.559), distance: 611.88, curvatureDeg: 0.95, width: 13.26 },
  { position: new Vector3(84.6, 0.05, -182.42), tangent: new Vector3(0.565, 0, -0.825), rightNormal: new Vector3(-0.825, 0, -0.565), distance: 616.38, curvatureDeg: 0.15, width: 13.46 },
  { position: new Vector3(87.14, 0.05, -186.13), tangent: new Vector3(0.553, 0, -0.833), rightNormal: new Vector3(-0.833, 0, -0.553), distance: 620.88, curvatureDeg: 1.44, width: 13.14 },
  { position: new Vector3(89.58, 0.05, -189.91), tangent: new Vector3(0.528, 0, -0.849), rightNormal: new Vector3(-0.849, 0, -0.528), distance: 625.38, curvatureDeg: 1.98, width: 13 },
  { position: new Vector3(91.89, 0.05, -193.77), tangent: new Vector3(0.494, 0, -0.87), rightNormal: new Vector3(-0.87, 0, -0.494), distance: 629.88, curvatureDeg: 2.63, width: 12.84 },
  { position: new Vector3(94.02, 0.05, -197.73), tangent: new Vector3(0.432, 0, -0.902), rightNormal: new Vector3(-0.902, 0, -0.432), distance: 634.37, curvatureDeg: 5.31, width: 12.17 },
  { position: new Vector3(95.77, 0.05, -201.88), tangent: new Vector3(0.365, 0, -0.931), rightNormal: new Vector3(-0.931, 0, -0.365), distance: 638.87, curvatureDeg: 3.09, width: 12.73 },
  { position: new Vector3(97.3, 0.05, -206.11), tangent: new Vector3(0.323, 0, -0.946), rightNormal: new Vector3(-0.946, 0, -0.323), distance: 643.37, curvatureDeg: 1.99, width: 13 },
  { position: new Vector3(98.68, 0.05, -210.39), tangent: new Vector3(0.299, 0, -0.954), rightNormal: new Vector3(-0.954, 0, -0.299), distance: 647.87, curvatureDeg: 0.97, width: 13.26 },
  { position: new Vector3(99.99, 0.05, -214.69), tangent: new Vector3(0.287, 0, -0.958), rightNormal: new Vector3(-0.958, 0, -0.287), distance: 652.37, curvatureDeg: 0.48, width: 13.38 },
  { position: new Vector3(101.26, 0.05, -219.01), tangent: new Vector3(0.282, 0, -0.96), rightNormal: new Vector3(-0.96, 0, -0.282), distance: 656.87, curvatureDeg: 0.12, width: 13.47 },
  { position: new Vector3(102.52, 0.05, -223.33), tangent: new Vector3(0.283, 0, -0.959), rightNormal: new Vector3(-0.959, 0, -0.283), distance: 661.37, curvatureDeg: 0.22, width: 13.44 },
  { position: new Vector3(103.8, 0.05, -227.64), tangent: new Vector3(0.289, 0, -0.957), rightNormal: new Vector3(-0.957, 0, -0.289), distance: 665.87, curvatureDeg: 0.57, width: 13.36 },
  { position: new Vector3(105.12, 0.05, -231.94), tangent: new Vector3(0.301, 0, -0.954), rightNormal: new Vector3(-0.954, 0, -0.301), distance: 670.37, curvatureDeg: 0.86, width: 13.29 },
  { position: new Vector3(106.51, 0.05, -236.22), tangent: new Vector3(0.318, 0, -0.948), rightNormal: new Vector3(-0.948, 0, -0.318), distance: 674.87, curvatureDeg: 1.2, width: 13.2 },
  { position: new Vector3(107.99, 0.05, -240.47), tangent: new Vector3(0.341, 0, -0.94), rightNormal: new Vector3(-0.94, 0, -0.341), distance: 679.37, curvatureDeg: 1.61, width: 13.1 },
  { position: new Vector3(109.58, 0.05, -244.68), tangent: new Vector3(0.372, 0, -0.928), rightNormal: new Vector3(-0.928, 0, -0.372), distance: 683.87, curvatureDeg: 2.12, width: 12.97 },
  { position: new Vector3(111.33, 0.05, -248.82), tangent: new Vector3(0.416, 0, -0.909), rightNormal: new Vector3(-0.909, 0, -0.416), distance: 688.36, curvatureDeg: 3.42, width: 12.65 },
  { position: new Vector3(113.33, 0.05, -252.85), tangent: new Vector3(0.475, 0, -0.88), rightNormal: new Vector3(-0.88, 0, -0.475), distance: 692.86, curvatureDeg: 4.07, width: 12.48 },
  { position: new Vector3(115.6, 0.05, -256.73), tangent: new Vector3(0.551, 0, -0.834), rightNormal: new Vector3(-0.834, 0, -0.551), distance: 697.36, curvatureDeg: 6.13, width: 11.97 },
  { position: new Vector3(118.27, 0.05, -260.34), tangent: new Vector3(0.658, 0, -0.753), rightNormal: new Vector3(-0.753, 0, -0.658), distance: 701.86, curvatureDeg: 9.3, width: 11.18 },
  { position: new Vector3(121.49, 0.05, -263.48), tangent: new Vector3(0.8, 0, -0.601), rightNormal: new Vector3(-0.601, 0, -0.8), distance: 706.36, curvatureDeg: 14.59, width: 10.5 },
  { position: new Vector3(125.39, 0.05, -265.69), tangent: new Vector3(0.935, 0, -0.355), rightNormal: new Vector3(-0.355, 0, -0.935), distance: 710.86, curvatureDeg: 17.62, width: 10.5 },
  { position: new Vector3(129.77, 0.05, -266.62), tangent: new Vector3(0.996, 0, -0.094), rightNormal: new Vector3(-0.094, 0, -0.996), distance: 715.36, curvatureDeg: 13.17, width: 10.5 },
  { position: new Vector3(134.26, 0.05, -266.52), tangent: new Vector3(0.997, 0, 0.082), rightNormal: new Vector3(0.082, 0, -0.997), distance: 719.86, curvatureDeg: 7.05, width: 11.74 },
  { position: new Vector3(138.7, 0.05, -265.88), tangent: new Vector3(0.983, 0, 0.184), rightNormal: new Vector3(0.184, 0, -0.983), distance: 724.36, curvatureDeg: 4.72, width: 12.32 },
  { position: new Vector3(143.09, 0.05, -264.87), tangent: new Vector3(0.968, 0, 0.253), rightNormal: new Vector3(0.253, 0, -0.968), distance: 728.86, curvatureDeg: 3.35, width: 12.66 },
  { position: new Vector3(147.4, 0.05, -263.61), tangent: new Vector3(0.953, 0, 0.302), rightNormal: new Vector3(0.302, 0, -0.953), distance: 733.36, curvatureDeg: 2.51, width: 12.87 },
  { position: new Vector3(151.66, 0.05, -262.16), tangent: new Vector3(0.939, 0, 0.344), rightNormal: new Vector3(0.344, 0, -0.939), distance: 737.85, curvatureDeg: 2.57, width: 12.86 },
  { position: new Vector3(155.85, 0.05, -260.52), tangent: new Vector3(0.926, 0, 0.378), rightNormal: new Vector3(0.378, 0, -0.926), distance: 742.35, curvatureDeg: 1.59, width: 13.1 },
  { position: new Vector3(159.99, 0.05, -258.76), tangent: new Vector3(0.916, 0, 0.401), rightNormal: new Vector3(0.401, 0, -0.916), distance: 746.85, curvatureDeg: 1.32, width: 13.17 },
  { position: new Vector3(164.09, 0.05, -256.91), tangent: new Vector3(0.907, 0, 0.421), rightNormal: new Vector3(0.421, 0, -0.907), distance: 751.35, curvatureDeg: 1.19, width: 13.2 },
  { position: new Vector3(168.15, 0.05, -254.97), tangent: new Vector3(0.896, 0, 0.443), rightNormal: new Vector3(0.443, 0, -0.896), distance: 755.85, curvatureDeg: 1.65, width: 13.09 },
  { position: new Vector3(172.16, 0.05, -252.92), tangent: new Vector3(0.886, 0, 0.463), rightNormal: new Vector3(0.463, 0, -0.886), distance: 760.35, curvatureDeg: 0.88, width: 13.28 },
  { position: new Vector3(176.13, 0.05, -250.81), tangent: new Vector3(0.879, 0, 0.476), rightNormal: new Vector3(0.476, 0, -0.879), distance: 764.85, curvatureDeg: 0.84, width: 13.29 },
  { position: new Vector3(180.07, 0.05, -248.64), tangent: new Vector3(0.87, 0, 0.493), rightNormal: new Vector3(0.493, 0, -0.87), distance: 769.35, curvatureDeg: 1.36, width: 13.16 },
  { position: new Vector3(183.96, 0.05, -246.37), tangent: new Vector3(0.86, 0, 0.51), rightNormal: new Vector3(0.51, 0, -0.86), distance: 773.85, curvatureDeg: 0.87, width: 13.28 },
  { position: new Vector3(187.81, 0.05, -244.05), tangent: new Vector3(0.853, 0, 0.522), rightNormal: new Vector3(0.522, 0, -0.853), distance: 778.35, curvatureDeg: 0.77, width: 13.31 },
  { position: new Vector3(191.63, 0.05, -241.67), tangent: new Vector3(0.844, 0, 0.537), rightNormal: new Vector3(0.537, 0, -0.844), distance: 782.85, curvatureDeg: 1.23, width: 13.19 },
  { position: new Vector3(195.4, 0.05, -239.22), tangent: new Vector3(0.833, 0, 0.554), rightNormal: new Vector3(0.554, 0, -0.833), distance: 787.34, curvatureDeg: 1.04, width: 13.24 },
  { position: new Vector3(199.12, 0.05, -236.69), tangent: new Vector3(0.823, 0, 0.568), rightNormal: new Vector3(0.568, 0, -0.823), distance: 791.84, curvatureDeg: 0.91, width: 13.27 },
  { position: new Vector3(202.81, 0.05, -234.11), tangent: new Vector3(0.813, 0, 0.582), rightNormal: new Vector3(0.582, 0, -0.813), distance: 796.34, curvatureDeg: 1.11, width: 13.22 },
  { position: new Vector3(206.44, 0.05, -231.46), tangent: new Vector3(0.799, 0, 0.601), rightNormal: new Vector3(0.601, 0, -0.799), distance: 800.84, curvatureDeg: 1.64, width: 13.09 },
  { position: new Vector3(210, 0.05, -228.7), tangent: new Vector3(0.783, 0, 0.622), rightNormal: new Vector3(0.622, 0, -0.783), distance: 805.34, curvatureDeg: 1.39, width: 13.15 },
  { position: new Vector3(213.48, 0.05, -225.86), tangent: new Vector3(0.766, 0, 0.643), rightNormal: new Vector3(0.643, 0, -0.766), distance: 809.84, curvatureDeg: 1.72, width: 13.07 },
  { position: new Vector3(216.88, 0.05, -222.91), tangent: new Vector3(0.743, 0, 0.669), rightNormal: new Vector3(0.669, 0, -0.743), distance: 814.34, curvatureDeg: 2.24, width: 12.94 },
  { position: new Vector3(220.17, 0.05, -219.84), tangent: new Vector3(0.711, 0, 0.703), rightNormal: new Vector3(0.703, 0, -0.711), distance: 818.84, curvatureDeg: 3.13, width: 12.72 },
  { position: new Vector3(223.27, 0.05, -216.59), tangent: new Vector3(0.661, 0, 0.75), rightNormal: new Vector3(0.75, 0, -0.661), distance: 823.34, curvatureDeg: 4.74, width: 12.32 },
  { position: new Vector3(226.1, 0.05, -213.1), tangent: new Vector3(0.574, 0, 0.819), rightNormal: new Vector3(0.819, 0, -0.574), distance: 827.84, curvatureDeg: 7.94, width: 11.52 },
  { position: new Vector3(228.42, 0.05, -209.25), tangent: new Vector3(0.345, 0, 0.939), rightNormal: new Vector3(0.939, 0, -0.345), distance: 832.34, curvatureDeg: 21.91, width: 10.5 },
  { position: new Vector3(229.12, 0.05, -204.88), tangent: new Vector3(-0.131, 0, 0.991), rightNormal: new Vector3(0.991, 0, 0.131), distance: 836.84, curvatureDeg: 33.29, width: 10.5 },
  { position: new Vector3(227.3, 0.05, -200.82), tangent: new Vector3(-0.549, 0, 0.836), rightNormal: new Vector3(0.836, 0, 0.549), distance: 841.33, curvatureDeg: 18.24, width: 10.5 },
  { position: new Vector3(224.27, 0.05, -197.5), tangent: new Vector3(-0.724, 0, 0.69), rightNormal: new Vector3(0.69, 0, 0.724), distance: 845.83, curvatureDeg: 7.94, width: 11.52 },
  { position: new Vector3(220.81, 0.05, -194.63), tangent: new Vector3(-0.791, 0, 0.612), rightNormal: new Vector3(0.612, 0, 0.791), distance: 850.33, curvatureDeg: 3.95, width: 12.51 },
  { position: new Vector3(217.16, 0.05, -192), tangent: new Vector3(-0.82, 0, 0.572), rightNormal: new Vector3(0.572, 0, 0.82), distance: 854.83, curvatureDeg: 1.71, width: 13.07 },
  { position: new Vector3(213.43, 0.05, -189.48), tangent: new Vector3(-0.83, 0, 0.558), rightNormal: new Vector3(0.558, 0, 0.83), distance: 859.33, curvatureDeg: 0.21, width: 13.45 },
  { position: new Vector3(209.7, 0.05, -186.98), tangent: new Vector3(-0.824, 0, 0.567), rightNormal: new Vector3(0.567, 0, 0.824), distance: 863.83, curvatureDeg: 1.46, width: 13.14 },
  { position: new Vector3(206.02, 0.05, -184.38), tangent: new Vector3(-0.797, 0, 0.604), rightNormal: new Vector3(0.604, 0, 0.797), distance: 868.33, curvatureDeg: 3.82, width: 12.54 },
  { position: new Vector3(202.53, 0.05, -181.54), tangent: new Vector3(-0.729, 0, 0.685), rightNormal: new Vector3(0.685, 0, 0.729), distance: 872.83, curvatureDeg: 8.28, width: 11.43 },
  { position: new Vector3(199.49, 0.05, -178.24), tangent: new Vector3(-0.646, 0, 0.763), rightNormal: new Vector3(0.763, 0, 0.646), distance: 877.33, curvatureDeg: 4.73, width: 12.32 },
  { position: new Vector3(196.73, 0.05, -174.69), tangent: new Vector3(-0.595, 0, 0.804), rightNormal: new Vector3(0.804, 0, 0.595), distance: 881.83, curvatureDeg: 2.81, width: 12.8 },
  { position: new Vector3(194.14, 0.05, -171.01), tangent: new Vector3(-0.556, 0, 0.831), rightNormal: new Vector3(0.831, 0, 0.556), distance: 886.33, curvatureDeg: 2.55, width: 12.86 },
  { position: new Vector3(191.72, 0.05, -167.21), tangent: new Vector3(-0.524, 0, 0.852), rightNormal: new Vector3(0.852, 0, 0.524), distance: 890.82, curvatureDeg: 1.86, width: 13.03 },
  { position: new Vector3(189.43, 0.05, -163.34), tangent: new Vector3(-0.499, 0, 0.866), rightNormal: new Vector3(0.866, 0, 0.499), distance: 895.32, curvatureDeg: 1.43, width: 13.14 },
  { position: new Vector3(187.23, 0.05, -159.42), tangent: new Vector3(-0.467, 0, 0.884), rightNormal: new Vector3(0.884, 0, 0.467), distance: 899.82, curvatureDeg: 2.82, width: 12.8 },
  { position: new Vector3(185.23, 0.05, -155.39), tangent: new Vector3(-0.429, 0, 0.903), rightNormal: new Vector3(0.903, 0, 0.429), distance: 904.32, curvatureDeg: 2.05, width: 12.99 },
  { position: new Vector3(183.37, 0.05, -151.29), tangent: new Vector3(-0.409, 0, 0.913), rightNormal: new Vector3(0.913, 0, 0.409), distance: 908.82, curvatureDeg: 0.45, width: 13.39 },
  { position: new Vector3(181.55, 0.05, -147.18), tangent: new Vector3(-0.41, 0, 0.912), rightNormal: new Vector3(0.912, 0, 0.41), distance: 913.32, curvatureDeg: 0.59, width: 13.35 },
  { position: new Vector3(179.68, 0.05, -143.09), tangent: new Vector3(-0.413, 0, 0.911), rightNormal: new Vector3(0.911, 0, 0.413), distance: 917.82, curvatureDeg: 0.21, width: 13.45 },
  { position: new Vector3(177.83, 0.05, -138.98), tangent: new Vector3(-0.407, 0, 0.914), rightNormal: new Vector3(0.914, 0, 0.407), distance: 922.32, curvatureDeg: 0.6, width: 13.35 },
  { position: new Vector3(176.02, 0.05, -134.86), tangent: new Vector3(-0.399, 0, 0.917), rightNormal: new Vector3(0.917, 0, 0.399), distance: 926.82, curvatureDeg: 0.3, width: 13.42 },
  { position: new Vector3(174.23, 0.05, -130.74), tangent: new Vector3(-0.396, 0, 0.918), rightNormal: new Vector3(0.918, 0, 0.396), distance: 931.32, curvatureDeg: 0.09, width: 13.48 },
  { position: new Vector3(172.45, 0.05, -126.6), tangent: new Vector3(-0.396, 0, 0.918), rightNormal: new Vector3(0.918, 0, 0.396), distance: 935.82, curvatureDeg: 0.06, width: 13.49 },
  { position: new Vector3(170.67, 0.05, -122.47), tangent: new Vector3(-0.398, 0, 0.917), rightNormal: new Vector3(0.917, 0, 0.398), distance: 940.31, curvatureDeg: 0.18, width: 13.46 },
  { position: new Vector3(168.87, 0.05, -118.35), tangent: new Vector3(-0.402, 0, 0.916), rightNormal: new Vector3(0.916, 0, 0.402), distance: 944.81, curvatureDeg: 0.28, width: 13.43 },
  { position: new Vector3(167.06, 0.05, -114.23), tangent: new Vector3(-0.407, 0, 0.914), rightNormal: new Vector3(0.914, 0, 0.407), distance: 949.31, curvatureDeg: 0.36, width: 13.41 },
  { position: new Vector3(165.21, 0.05, -110.13), tangent: new Vector3(-0.413, 0, 0.911), rightNormal: new Vector3(0.911, 0, 0.413), distance: 953.81, curvatureDeg: 0.44, width: 13.39 },
  { position: new Vector3(163.34, 0.05, -106.04), tangent: new Vector3(-0.421, 0, 0.907), rightNormal: new Vector3(0.907, 0, 0.421), distance: 958.31, curvatureDeg: 0.57, width: 13.36 },
  { position: new Vector3(161.42, 0.05, -101.97), tangent: new Vector3(-0.431, 0, 0.903), rightNormal: new Vector3(0.903, 0, 0.431), distance: 962.81, curvatureDeg: 0.62, width: 13.35 },
  { position: new Vector3(159.46, 0.05, -97.92), tangent: new Vector3(-0.441, 0, 0.897), rightNormal: new Vector3(0.897, 0, 0.441), distance: 967.31, curvatureDeg: 0.7, width: 13.32 },
  { position: new Vector3(157.46, 0.05, -93.89), tangent: new Vector3(-0.453, 0, 0.891), rightNormal: new Vector3(0.891, 0, 0.453), distance: 971.81, curvatureDeg: 0.86, width: 13.28 },
  { position: new Vector3(155.39, 0.05, -89.9), tangent: new Vector3(-0.465, 0, 0.885), rightNormal: new Vector3(0.885, 0, 0.465), distance: 976.31, curvatureDeg: 0.62, width: 13.35 },
  { position: new Vector3(153.27, 0.05, -85.92), tangent: new Vector3(-0.474, 0, 0.88), rightNormal: new Vector3(0.88, 0, 0.474), distance: 980.81, curvatureDeg: 0.62, width: 13.34 },
  { position: new Vector3(151.12, 0.05, -81.98), tangent: new Vector3(-0.483, 0, 0.876), rightNormal: new Vector3(0.876, 0, 0.483), distance: 985.31, curvatureDeg: 0.47, width: 13.38 },
  { position: new Vector3(148.93, 0.05, -78.04), tangent: new Vector3(-0.489, 0, 0.872), rightNormal: new Vector3(0.872, 0, 0.489), distance: 989.8, curvatureDeg: 0.4, width: 13.4 },
  { position: new Vector3(146.72, 0.05, -74.13), tangent: new Vector3(-0.495, 0, 0.869), rightNormal: new Vector3(0.869, 0, 0.495), distance: 994.3, curvatureDeg: 0.35, width: 13.41 },
  { position: new Vector3(144.48, 0.05, -70.23), tangent: new Vector3(-0.5, 0, 0.866), rightNormal: new Vector3(0.866, 0, 0.5), distance: 998.8, curvatureDeg: 0.33, width: 13.42 },
  { position: new Vector3(142.22, 0.05, -66.34), tangent: new Vector3(-0.505, 0, 0.863), rightNormal: new Vector3(0.863, 0, 0.505), distance: 1003.3, curvatureDeg: 0.25, width: 13.44 },
  { position: new Vector3(139.94, 0.05, -62.46), tangent: new Vector3(-0.508, 0, 0.861), rightNormal: new Vector3(0.861, 0, 0.508), distance: 1007.8, curvatureDeg: 0.21, width: 13.45 },
  { position: new Vector3(137.64, 0.05, -58.59), tangent: new Vector3(-0.511, 0, 0.86), rightNormal: new Vector3(0.86, 0, 0.511), distance: 1012.3, curvatureDeg: 0.17, width: 13.46 },
  { position: new Vector3(135.34, 0.05, -54.72), tangent: new Vector3(-0.513, 0, 0.858), rightNormal: new Vector3(0.858, 0, 0.513), distance: 1016.8, curvatureDeg: 0.14, width: 13.46 },
  { position: new Vector3(133.03, 0.05, -50.86), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1021.3, curvatureDeg: 0.11, width: 13.47 },
  { position: new Vector3(130.7, 0.05, -47.01), tangent: new Vector3(-0.517, 0, 0.856), rightNormal: new Vector3(0.856, 0, 0.517), distance: 1025.8, curvatureDeg: 0.08, width: 13.48 },
  { position: new Vector3(128.38, 0.05, -43.16), tangent: new Vector3(-0.518, 0, 0.856), rightNormal: new Vector3(0.856, 0, 0.518), distance: 1030.3, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(126.05, 0.05, -39.31), tangent: new Vector3(-0.518, 0, 0.855), rightNormal: new Vector3(0.855, 0, 0.518), distance: 1034.8, curvatureDeg: 0.02, width: 13.5 },
  { position: new Vector3(123.72, 0.05, -35.46), tangent: new Vector3(-0.518, 0, 0.855), rightNormal: new Vector3(0.855, 0, 0.518), distance: 1039.3, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(121.39, 0.05, -31.61), tangent: new Vector3(-0.518, 0, 0.856), rightNormal: new Vector3(0.856, 0, 0.518), distance: 1043.79, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(119.06, 0.05, -27.76), tangent: new Vector3(-0.517, 0, 0.856), rightNormal: new Vector3(0.856, 0, 0.517), distance: 1048.29, curvatureDeg: 0.07, width: 13.48 },
  { position: new Vector3(116.73, 0.05, -23.91), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1052.79, curvatureDeg: 0.12, width: 13.47 },
  { position: new Vector3(114.42, 0.05, -20.05), tangent: new Vector3(-0.514, 0, 0.858), rightNormal: new Vector3(0.858, 0, 0.514), distance: 1057.29, curvatureDeg: 0.14, width: 13.46 },
  { position: new Vector3(112.11, 0.05, -16.19), tangent: new Vector3(-0.512, 0, 0.859), rightNormal: new Vector3(0.859, 0, 0.512), distance: 1061.79, curvatureDeg: 0.12, width: 13.47 },
  { position: new Vector3(109.82, 0.05, -12.32), tangent: new Vector3(-0.511, 0, 0.86), rightNormal: new Vector3(0.86, 0, 0.511), distance: 1066.29, curvatureDeg: 0, width: 13.5 },
  { position: new Vector3(107.52, 0.05, -8.45), tangent: new Vector3(-0.511, 0, 0.86), rightNormal: new Vector3(0.86, 0, 0.511), distance: 1070.79, curvatureDeg: 0.05, width: 13.49 },
  { position: new Vector3(105.22, 0.05, -4.59), tangent: new Vector3(-0.512, 0, 0.859), rightNormal: new Vector3(0.859, 0, 0.512), distance: 1075.29, curvatureDeg: 0.05, width: 13.49 },
  { position: new Vector3(102.92, 0.05, -0.72), tangent: new Vector3(-0.512, 0, 0.859), rightNormal: new Vector3(0.859, 0, 0.512), distance: 1079.79, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(100.61, 0.05, 3.14), tangent: new Vector3(-0.513, 0, 0.858), rightNormal: new Vector3(0.858, 0, 0.513), distance: 1084.29, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(98.3, 0.05, 7), tangent: new Vector3(-0.514, 0, 0.858), rightNormal: new Vector3(0.858, 0, 0.514), distance: 1088.79, curvatureDeg: 0.03, width: 13.49 },
  { position: new Vector3(95.99, 0.05, 10.86), tangent: new Vector3(-0.514, 0, 0.858), rightNormal: new Vector3(0.858, 0, 0.514), distance: 1093.28, curvatureDeg: 0.03, width: 13.49 },
  { position: new Vector3(93.67, 0.05, 14.72), tangent: new Vector3(-0.514, 0, 0.858), rightNormal: new Vector3(0.858, 0, 0.514), distance: 1097.78, curvatureDeg: 0.02, width: 13.49 },
  { position: new Vector3(91.36, 0.05, 18.58), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1102.28, curvatureDeg: 0.02, width: 13.5 },
  { position: new Vector3(89.04, 0.05, 22.44), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1106.78, curvatureDeg: 0.02, width: 13.5 },
  { position: new Vector3(86.73, 0.05, 26.29), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1111.28, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(84.41, 0.05, 30.15), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1115.78, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(82.09, 0.05, 34), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1120.28, curvatureDeg: 0, width: 13.5 },
  { position: new Vector3(79.77, 0.05, 37.86), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1124.78, curvatureDeg: 0, width: 13.5 },
  { position: new Vector3(77.45, 0.05, 41.72), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1129.28, curvatureDeg: 0, width: 13.5 },
  { position: new Vector3(75.13, 0.05, 45.57), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1133.78, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(72.81, 0.05, 49.43), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1138.28, curvatureDeg: 0.01, width: 13.5 },
  { position: new Vector3(70.5, 0.05, 53.28), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1142.77, curvatureDeg: 0.02, width: 13.5 },
  { position: new Vector3(68.18, 0.05, 57.14), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1147.27, curvatureDeg: 0.03, width: 13.49 },
  { position: new Vector3(65.87, 0.05, 61), tangent: new Vector3(-0.515, 0, 0.857), rightNormal: new Vector3(0.857, 0, 0.515), distance: 1151.77, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(63.55, 0.05, 64.86), tangent: new Vector3(-0.518, 0, 0.855), rightNormal: new Vector3(0.855, 0, 0.518), distance: 1156.27, curvatureDeg: 0.41, width: 13.4 },
  { position: new Vector3(61.21, 0.05, 68.7), tangent: new Vector3(-0.524, 0, 0.852), rightNormal: new Vector3(0.852, 0, 0.524), distance: 1160.77, curvatureDeg: 0.39, width: 13.4 },
  { position: new Vector3(58.84, 0.05, 72.52), tangent: new Vector3(-0.529, 0, 0.849), rightNormal: new Vector3(0.849, 0, 0.529), distance: 1165.27, curvatureDeg: 0.26, width: 13.43 },
  { position: new Vector3(56.45, 0.05, 76.33), tangent: new Vector3(-0.531, 0, 0.847), rightNormal: new Vector3(0.847, 0, 0.531), distance: 1169.77, curvatureDeg: 0.1, width: 13.48 },
  { position: new Vector3(54.05, 0.05, 80.14), tangent: new Vector3(-0.531, 0, 0.847), rightNormal: new Vector3(0.847, 0, 0.531), distance: 1174.27, curvatureDeg: 0.09, width: 13.48 },
  { position: new Vector3(51.67, 0.05, 83.96), tangent: new Vector3(-0.529, 0, 0.849), rightNormal: new Vector3(0.849, 0, 0.529), distance: 1178.77, curvatureDeg: 0.3, width: 13.43 },
  { position: new Vector3(49.3, 0.05, 87.78), tangent: new Vector3(-0.522, 0, 0.853), rightNormal: new Vector3(0.853, 0, 0.522), distance: 1183.27, curvatureDeg: 0.53, width: 13.37 },
  { position: new Vector3(46.96, 0.05, 91.63), tangent: new Vector3(-0.512, 0, 0.859), rightNormal: new Vector3(0.859, 0, 0.512), distance: 1187.77, curvatureDeg: 0.82, width: 13.29 },
  { position: new Vector3(44.69, 0.05, 95.51), tangent: new Vector3(-0.498, 0, 0.867), rightNormal: new Vector3(0.867, 0, 0.498), distance: 1192.27, curvatureDeg: 1.04, width: 13.24 },
  { position: new Vector3(42.48, 0.05, 99.43), tangent: new Vector3(-0.481, 0, 0.877), rightNormal: new Vector3(0.877, 0, 0.481), distance: 1196.76, curvatureDeg: 1.3, width: 13.18 },
  { position: new Vector3(40.36, 0.05, 103.4), tangent: new Vector3(-0.457, 0, 0.89), rightNormal: new Vector3(0.89, 0, 0.457), distance: 1201.26, curvatureDeg: 1.78, width: 13.05 },
  { position: new Vector3(38.37, 0.05, 107.43), tangent: new Vector3(-0.423, 0, 0.906), rightNormal: new Vector3(0.906, 0, 0.423), distance: 1205.76, curvatureDeg: 2.5, width: 12.88 },
  { position: new Vector3(36.55, 0.05, 111.55), tangent: new Vector3(-0.387, 0, 0.922), rightNormal: new Vector3(0.922, 0, 0.387), distance: 1210.26, curvatureDeg: 2.1, width: 12.98 },
  { position: new Vector3(34.89, 0.05, 115.73), tangent: new Vector3(-0.359, 0, 0.933), rightNormal: new Vector3(0.933, 0, 0.359), distance: 1214.76, curvatureDeg: 1.32, width: 13.17 },
  { position: new Vector3(33.33, 0.05, 119.95), tangent: new Vector3(-0.345, 0, 0.939), rightNormal: new Vector3(0.939, 0, 0.345), distance: 1219.26, curvatureDeg: 0.36, width: 13.41 },
  { position: new Vector3(31.79, 0.05, 124.17), tangent: new Vector3(-0.347, 0, 0.938), rightNormal: new Vector3(0.938, 0, 0.347), distance: 1223.76, curvatureDeg: 0.62, width: 13.34 },
  { position: new Vector3(30.2, 0.05, 128.38), tangent: new Vector3(-0.364, 0, 0.931), rightNormal: new Vector3(0.931, 0, 0.364), distance: 1228.26, curvatureDeg: 1.47, width: 13.13 },
  { position: new Vector3(28.51, 0.05, 132.55), tangent: new Vector3(-0.393, 0, 0.919), rightNormal: new Vector3(0.919, 0, 0.393), distance: 1232.76, curvatureDeg: 2.11, width: 12.97 },
  { position: new Vector3(26.66, 0.05, 136.65), tangent: new Vector3(-0.429, 0, 0.903), rightNormal: new Vector3(0.903, 0, 0.429), distance: 1237.26, curvatureDeg: 2.43, width: 12.89 },
  { position: new Vector3(24.65, 0.05, 140.68), tangent: new Vector3(-0.459, 0, 0.889), rightNormal: new Vector3(0.889, 0, 0.459), distance: 1241.76, curvatureDeg: 1.33, width: 13.17 },
  { position: new Vector3(22.53, 0.05, 144.65), tangent: new Vector3(-0.474, 0, 0.88), rightNormal: new Vector3(0.88, 0, 0.474), distance: 1246.25, curvatureDeg: 0.65, width: 13.34 },
  { position: new Vector3(20.38, 0.05, 148.6), tangent: new Vector3(-0.484, 0, 0.875), rightNormal: new Vector3(0.875, 0, 0.484), distance: 1250.75, curvatureDeg: 0.66, width: 13.34 },
  { position: new Vector3(18.18, 0.05, 152.52), tangent: new Vector3(-0.494, 0, 0.87), rightNormal: new Vector3(0.87, 0, 0.494), distance: 1255.25, curvatureDeg: 0.6, width: 13.35 },
  { position: new Vector3(15.94, 0.05, 156.42), tangent: new Vector3(-0.503, 0, 0.864), rightNormal: new Vector3(0.864, 0, 0.503), distance: 1259.75, curvatureDeg: 0.59, width: 13.35 },
  { position: new Vector3(13.66, 0.05, 160.3), tangent: new Vector3(-0.512, 0, 0.859), rightNormal: new Vector3(0.859, 0, 0.512), distance: 1264.25, curvatureDeg: 0.68, width: 13.33 },
  { position: new Vector3(11.33, 0.05, 164.15), tangent: new Vector3(-0.522, 0, 0.853), rightNormal: new Vector3(0.853, 0, 0.522), distance: 1268.75, curvatureDeg: 0.61, width: 13.35 },
  { position: new Vector3(8.96, 0.05, 167.98), tangent: new Vector3(-0.531, 0, 0.847), rightNormal: new Vector3(0.847, 0, 0.531), distance: 1273.25, curvatureDeg: 0.68, width: 13.33 },
  { position: new Vector3(6.55, 0.05, 171.77), tangent: new Vector3(-0.542, 0, 0.84), rightNormal: new Vector3(0.84, 0, 0.542), distance: 1277.75, curvatureDeg: 0.73, width: 13.32 },
  { position: new Vector3(4.08, 0.05, 175.54), tangent: new Vector3(-0.552, 0, 0.834), rightNormal: new Vector3(0.834, 0, 0.552), distance: 1282.25, curvatureDeg: 0.71, width: 13.32 },
  { position: new Vector3(1.58, 0.05, 179.27), tangent: new Vector3(-0.564, 0, 0.826), rightNormal: new Vector3(0.826, 0, 0.564), distance: 1286.75, curvatureDeg: 0.89, width: 13.28 },
  { position: new Vector3(-0.99, 0.05, 182.97), tangent: new Vector3(-0.576, 0, 0.817), rightNormal: new Vector3(0.817, 0, 0.576), distance: 1291.25, curvatureDeg: 0.84, width: 13.29 },
  { position: new Vector3(-3.61, 0.05, 186.63), tangent: new Vector3(-0.589, 0, 0.808), rightNormal: new Vector3(0.808, 0, 0.589), distance: 1295.74, curvatureDeg: 1.01, width: 13.25 },
  { position: new Vector3(-6.29, 0.05, 190.24), tangent: new Vector3(-0.604, 0, 0.797), rightNormal: new Vector3(0.797, 0, 0.604), distance: 1300.24, curvatureDeg: 1.11, width: 13.22 },
  { position: new Vector3(-9.05, 0.05, 193.8), tangent: new Vector3(-0.619, 0, 0.786), rightNormal: new Vector3(0.786, 0, 0.619), distance: 1304.74, curvatureDeg: 0.98, width: 13.26 },
  { position: new Vector3(-11.86, 0.05, 197.31), tangent: new Vector3(-0.629, 0, 0.777), rightNormal: new Vector3(0.777, 0, 0.629), distance: 1309.24, curvatureDeg: 0.58, width: 13.36 },
  { position: new Vector3(-14.71, 0.05, 200.79), tangent: new Vector3(-0.637, 0, 0.771), rightNormal: new Vector3(0.771, 0, 0.637), distance: 1313.74, curvatureDeg: 0.57, width: 13.36 },
  { position: new Vector3(-17.59, 0.05, 204.24), tangent: new Vector3(-0.645, 0, 0.764), rightNormal: new Vector3(0.764, 0, 0.645), distance: 1318.24, curvatureDeg: 0.63, width: 13.34 },
  { position: new Vector3(-20.51, 0.05, 207.67), tangent: new Vector3(-0.654, 0, 0.756), rightNormal: new Vector3(0.756, 0, 0.654), distance: 1322.74, curvatureDeg: 0.77, width: 13.31 },
  { position: new Vector3(-23.48, 0.05, 211.05), tangent: new Vector3(-0.665, 0, 0.747), rightNormal: new Vector3(0.747, 0, 0.665), distance: 1327.24, curvatureDeg: 0.86, width: 13.28 },
  { position: new Vector3(-26.5, 0.05, 214.39), tangent: new Vector3(-0.676, 0, 0.736), rightNormal: new Vector3(0.736, 0, 0.676), distance: 1331.74, curvatureDeg: 0.91, width: 13.27 },
  { position: new Vector3(-29.57, 0.05, 217.67), tangent: new Vector3(-0.689, 0, 0.725), rightNormal: new Vector3(0.725, 0, 0.689), distance: 1336.24, curvatureDeg: 1.08, width: 13.23 },
  { position: new Vector3(-32.7, 0.05, 220.91), tangent: new Vector3(-0.703, 0, 0.711), rightNormal: new Vector3(0.711, 0, 0.703), distance: 1340.74, curvatureDeg: 1.2, width: 13.2 },
  { position: new Vector3(-35.89, 0.05, 224.07), tangent: new Vector3(-0.718, 0, 0.696), rightNormal: new Vector3(0.696, 0, 0.718), distance: 1345.23, curvatureDeg: 1.25, width: 13.19 },
  { position: new Vector3(-39.16, 0.05, 227.16), tangent: new Vector3(-0.734, 0, 0.679), rightNormal: new Vector3(0.679, 0, 0.734), distance: 1349.73, curvatureDeg: 1.42, width: 13.14 },
  { position: new Vector3(-42.5, 0.05, 230.18), tangent: new Vector3(-0.752, 0, 0.659), rightNormal: new Vector3(0.659, 0, 0.752), distance: 1354.23, curvatureDeg: 1.63, width: 13.09 },
  { position: new Vector3(-45.93, 0.05, 233.09), tangent: new Vector3(-0.771, 0, 0.637), rightNormal: new Vector3(0.637, 0, 0.771), distance: 1358.73, curvatureDeg: 1.67, width: 13.08 },
  { position: new Vector3(-49.44, 0.05, 235.91), tangent: new Vector3(-0.79, 0, 0.613), rightNormal: new Vector3(0.613, 0, 0.79), distance: 1363.23, curvatureDeg: 1.83, width: 13.04 },
  { position: new Vector3(-53.04, 0.05, 238.61), tangent: new Vector3(-0.81, 0, 0.586), rightNormal: new Vector3(0.586, 0, 0.81), distance: 1367.73, curvatureDeg: 2.01, width: 13 },
  { position: new Vector3(-56.73, 0.05, 241.18), tangent: new Vector3(-0.827, 0, 0.562), rightNormal: new Vector3(0.562, 0, 0.827), distance: 1372.23, curvatureDeg: 1.4, width: 13.15 },
  { position: new Vector3(-60.48, 0.05, 243.66), tangent: new Vector3(-0.84, 0, 0.543), rightNormal: new Vector3(0.543, 0, 0.84), distance: 1376.73, curvatureDeg: 1.23, width: 13.19 },
  { position: new Vector3(-64.28, 0.05, 246.06), tangent: new Vector3(-0.851, 0, 0.524), rightNormal: new Vector3(0.524, 0, 0.851), distance: 1381.23, curvatureDeg: 1.24, width: 13.19 },
  { position: new Vector3(-68.14, 0.05, 248.38), tangent: new Vector3(-0.863, 0, 0.505), rightNormal: new Vector3(0.505, 0, 0.863), distance: 1385.73, curvatureDeg: 1.39, width: 13.15 },
  { position: new Vector3(-72.05, 0.05, 250.61), tangent: new Vector3(-0.875, 0, 0.484), rightNormal: new Vector3(0.484, 0, 0.875), distance: 1390.23, curvatureDeg: 1.36, width: 13.16 },
  { position: new Vector3(-76.01, 0.05, 252.74), tangent: new Vector3(-0.887, 0, 0.463), rightNormal: new Vector3(0.463, 0, 0.887), distance: 1394.73, curvatureDeg: 1.42, width: 13.15 },
  { position: new Vector3(-80.03, 0.05, 254.77), tangent: new Vector3(-0.898, 0, 0.439), rightNormal: new Vector3(0.439, 0, 0.898), distance: 1399.22, curvatureDeg: 1.59, width: 13.1 },
  { position: new Vector3(-84.1, 0.05, 256.69), tangent: new Vector3(-0.911, 0, 0.413), rightNormal: new Vector3(0.413, 0, 0.911), distance: 1403.72, curvatureDeg: 1.76, width: 13.06 },
  { position: new Vector3(-88.22, 0.05, 258.48), tangent: new Vector3(-0.923, 0, 0.384), rightNormal: new Vector3(0.384, 0, 0.923), distance: 1408.22, curvatureDeg: 1.85, width: 13.04 },
  { position: new Vector3(-92.4, 0.05, 260.14), tangent: new Vector3(-0.936, 0, 0.352), rightNormal: new Vector3(0.352, 0, 0.936), distance: 1412.72, curvatureDeg: 2.08, width: 12.98 },
  { position: new Vector3(-96.64, 0.05, 261.64), tangent: new Vector3(-0.949, 0, 0.315), rightNormal: new Vector3(0.315, 0, 0.949), distance: 1417.22, curvatureDeg: 2.38, width: 12.9 },
  { position: new Vector3(-100.94, 0.05, 262.97), tangent: new Vector3(-0.962, 0, 0.271), rightNormal: new Vector3(0.271, 0, 0.962), distance: 1421.72, curvatureDeg: 2.84, width: 12.79 },
  { position: new Vector3(-105.3, 0.05, 264.08), tangent: new Vector3(-0.975, 0, 0.22), rightNormal: new Vector3(0.22, 0, 0.975), distance: 1426.22, curvatureDeg: 3.24, width: 12.69 },
  { position: new Vector3(-109.72, 0.05, 264.95), tangent: new Vector3(-0.987, 0, 0.161), rightNormal: new Vector3(0.161, 0, 0.987), distance: 1430.72, curvatureDeg: 3.71, width: 12.57 },
  { position: new Vector3(-114.18, 0.05, 265.53), tangent: new Vector3(-0.995, 0, 0.101), rightNormal: new Vector3(0.101, 0, 0.995), distance: 1435.22, curvatureDeg: 3.15, width: 12.71 },
  { position: new Vector3(-118.66, 0.05, 265.86), tangent: new Vector3(-0.999, 0, 0.053), rightNormal: new Vector3(0.053, 0, 0.999), distance: 1439.72, curvatureDeg: 2.35, width: 12.91 },
  { position: new Vector3(-123.16, 0.05, 266.01), tangent: new Vector3(-1, 0, 0.015), rightNormal: new Vector3(0.015, 0, 1), distance: 1444.22, curvatureDeg: 2.04, width: 12.99 },
  { position: new Vector3(-127.66, 0.05, 266), tangent: new Vector3(-1, 0, -0.019), rightNormal: new Vector3(-0.019, 0, 1), distance: 1448.71, curvatureDeg: 1.89, width: 13.03 },
  { position: new Vector3(-132.15, 0.05, 265.84), tangent: new Vector3(-0.999, 0, -0.053), rightNormal: new Vector3(-0.053, 0, 0.999), distance: 1453.21, curvatureDeg: 1.97, width: 13.01 },
  { position: new Vector3(-136.64, 0.05, 265.52), tangent: new Vector3(-0.996, 0, -0.09), rightNormal: new Vector3(-0.09, 0, 0.996), distance: 1457.71, curvatureDeg: 2.27, width: 12.93 },
  { position: new Vector3(-141.11, 0.05, 265.03), tangent: new Vector3(-0.991, 0, -0.135), rightNormal: new Vector3(-0.135, 0, 0.991), distance: 1462.21, curvatureDeg: 2.95, width: 12.76 },
  { position: new Vector3(-145.55, 0.05, 264.31), tangent: new Vector3(-0.98, 0, -0.201), rightNormal: new Vector3(-0.201, 0, 0.98), distance: 1466.71, curvatureDeg: 4.78, width: 12.3 },
  { position: new Vector3(-149.92, 0.05, 263.22), tangent: new Vector3(-0.942, 0, -0.335), rightNormal: new Vector3(-0.335, 0, 0.942), distance: 1471.21, curvatureDeg: 11.13, width: 10.72 },
  { position: new Vector3(-153.97, 0.05, 261.32), tangent: new Vector3(-0.611, 0, -0.792), rightNormal: new Vector3(-0.792, 0, 0.611), distance: 1475.71, curvatureDeg: 57.85, width: 10.5 },
  { position: new Vector3(-154.46, 0.05, 257.33), tangent: new Vector3(0.307, 0, -0.952), rightNormal: new Vector3(-0.952, 0, -0.307), distance: 1480.21, curvatureDeg: 46.97, width: 10.5 },
  { position: new Vector3(-151.58, 0.05, 253.89), tangent: new Vector3(0.699, 0, -0.716), rightNormal: new Vector3(-0.716, 0, -0.699), distance: 1484.71, curvatureDeg: 8.68, width: 11.33 },
  { position: new Vector3(-148.2, 0.05, 250.92), tangent: new Vector3(0.768, 0, -0.641), rightNormal: new Vector3(-0.641, 0, -0.768), distance: 1489.21, curvatureDeg: 3.03, width: 12.74 },
  { position: new Vector3(-144.67, 0.05, 248.13), tangent: new Vector3(0.791, 0, -0.612), rightNormal: new Vector3(-0.612, 0, -0.791), distance: 1493.71, curvatureDeg: 1.14, width: 13.22 },
  { position: new Vector3(-141.09, 0.05, 245.41), tangent: new Vector3(0.797, 0, -0.604), rightNormal: new Vector3(-0.604, 0, -0.797), distance: 1498.2, curvatureDeg: 0.04, width: 13.49 },
  { position: new Vector3(-137.5, 0.05, 242.69), tangent: new Vector3(0.792, 0, -0.611), rightNormal: new Vector3(-0.611, 0, -0.792), distance: 1502.7, curvatureDeg: 1.02, width: 13.24 },
];

const eleyeleCenterline = eleyeleRoadSamples.map((s, idx) => {
  const next = eleyeleRoadSamples[(idx + 1) % eleyeleRoadSamples.length];
  return {
    id: idx,
    start: s.position.clone(),
    end: next.position.clone(),
  };
});

const eleyeleCheckpoints: CheckpointData[] = [
  {
    id: 'EY_CP_1',
    order: 0,
    position: new Vector3(-133.96, 0.05, 239.91),
    direction: new Vector3(0.788, 0, -0.616),
    width: 16.4,
  },
  {
    id: 'EY_CP_2',
    order: 1,
    position: new Vector3(-58.3, 0.05, 153.85),
    direction: new Vector3(-0.113, 0, -0.994),
    width: 13.9,
  },
  {
    id: 'EY_CP_3',
    order: 2,
    position: new Vector3(-107.03, 0.05, 57.53),
    direction: new Vector3(-0.797, 0, -0.604),
    width: 15.7,
  },
  {
    id: 'EY_CP_4',
    order: 3,
    position: new Vector3(-82.74, 0.05, -51.95),
    direction: new Vector3(0.429, 0, -0.903),
    width: 16.4,
  },
  {
    id: 'EY_CP_5',
    order: 4,
    position: new Vector3(10.07, 0.05, -81.09),
    direction: new Vector3(0.997, 0, 0.074),
    width: 14.7,
  },
  {
    id: 'EY_CP_6',
    order: 5,
    position: new Vector3(79.57, 0.05, -174.96),
    direction: new Vector3(0.547, 0, -0.837),
    width: 16.3,
  },
  {
    id: 'EY_CP_7',
    order: 6,
    position: new Vector3(143.09, 0.05, -264.87),
    direction: new Vector3(0.968, 0, 0.253),
    width: 15.7,
  },
  {
    id: 'EY_CP_8',
    order: 7,
    position: new Vector3(220.81, 0.05, -194.63),
    direction: new Vector3(-0.791, 0, 0.612),
    width: 15.5,
  },
  {
    id: 'EY_CP_9',
    order: 8,
    position: new Vector3(157.46, 0.05, -93.89),
    direction: new Vector3(-0.453, 0, 0.891),
    width: 16.3,
  },
  {
    id: 'EY_CP_10',
    order: 9,
    position: new Vector3(95.99, 0.05, 10.86),
    direction: new Vector3(-0.514, 0, 0.858),
    width: 16.5,
  },
  {
    id: 'EY_CP_11',
    order: 10,
    position: new Vector3(34.89, 0.05, 115.73),
    direction: new Vector3(-0.359, 0, 0.933),
    width: 16.2,
  },
  {
    id: 'EY_CP_12',
    order: 11,
    position: new Vector3(-29.57, 0.05, 217.67),
    direction: new Vector3(-0.689, 0, 0.725),
    width: 16.2,
  },
];

const eleyeleEvents: RaceEventConfig[] = [
  {
    id: 'eleyele_grand_prix',
    mode: 'time_trial',
    name: 'Eleyele Ring Grand Prix',
    subtitle: 'Authentic 1.5km Ibadan North Circuit • 3 Laps',
    badgeText: 'CIRCUIT RACE',
    lapsBadge: '3 LAPS',
    description: '3-lap urban circuit showdown through the technical chicanes and high-speed carousels of Ibadan North.',
    specs: {
      length: '1,507 M',
      sectors: '12 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(-133.96, 0.05, 239.91),
    startYaw: 2.234,
    checkpointIds: [
      'EY_CP_1',
      'EY_CP_2',
      'EY_CP_3',
      'EY_CP_4',
      'EY_CP_5',
      'EY_CP_6',
      'EY_CP_7',
      'EY_CP_8',
      'EY_CP_9',
      'EY_CP_10',
      'EY_CP_11',
      'EY_CP_12',
    ],
    finishCheckpointId: 'EY_CP_12',
    mapType: 'loop',
  },
  {
    id: 'eleyele_elimination',
    mode: 'elimination',
    name: 'Ibadan North Knockout',
    subtitle: '20-Second Knockout Rounds • Elimination',
    badgeText: 'ELIMINATION',
    lapsBadge: '20S KNOCKOUT',
    description: 'Every 20 seconds, the driver in last position is eliminated. Maintain the lead at all costs.',
    specs: {
      length: '1,507 M',
      sectors: '12 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(-133.96, 0.05, 239.91),
    startYaw: 2.234,
    checkpointIds: [
      'EY_CP_1',
      'EY_CP_2',
      'EY_CP_3',
      'EY_CP_4',
      'EY_CP_5',
      'EY_CP_6',
      'EY_CP_7',
      'EY_CP_8',
      'EY_CP_9',
      'EY_CP_10',
      'EY_CP_11',
      'EY_CP_12',
    ],
    finishCheckpointId: 'EY_CP_12',
    mapType: 'loop',
  },
  {
    id: 'eleyele_speed_trap',
    mode: 'speed_trap',
    name: 'Eleyele Street Radar Challenge',
    subtitle: 'Street Radar Traps • Top Velocity Benchmark',
    badgeText: 'SPEED TRAP',
    lapsBadge: '3 RADAR TRAPS',
    description: 'Maximum speed traps stationed along the West Main Straight and East Back Straight.',
    specs: {
      length: '1,507 M',
      sectors: '3 RADARS',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(-133.96, 0.05, 239.91),
    startYaw: 2.234,
    checkpointIds: [
      'EY_CP_1',
      'EY_CP_2',
      'EY_CP_3',
      'EY_CP_4',
      'EY_CP_5',
      'EY_CP_6',
      'EY_CP_7',
      'EY_CP_8',
      'EY_CP_9',
      'EY_CP_10',
      'EY_CP_11',
      'EY_CP_12',
    ],
    finishCheckpointId: 'EY_CP_12',
    mapType: 'loop',
  },
];

export const EleyeleRingCircuit: CircuitDefinition = {
  id: 'eleyele_ring',
  name: 'Eleyele Ring Circuit',
  subtitle: 'Authentic 1.5km Ibadan North Technical Circuit',
  measuredLengthMeters: 1507.2,
  tileCount: 335,
  description:
    'Constructed directly from real-world OpenStreetMap road network geometry (Ways 563516274, 563516275, 563516276, 563516277, 563516292) in Ibadan North near Eleyele. A tight, technical urban motorsport ring featuring the high-speed North Carousel, an infield technical S-chicane, and a sweeping East Back Straight.',
  surface: 'ASPHALT',
  roadSurfaceY: 0.05,
  startPosition: new Vector3(-133.96, 0.05, 239.91),
  startYaw: 2.234,
  aiGridSlots: [
    { gridSlot: 1, position: new Vector3(-146.63, 0.05, 245.6), yaw: 2.229 },
    { gridSlot: 2, position: new Vector3(-149.29, 0.05, 256.13), yaw: 2.368 },
    { gridSlot: 3, position: new Vector3(-150.99, 0.05, 266.23), yaw: -1.912 },
  ],
  sections: [],
  roadSamples: eleyeleRoadSamples,
  centerlineSegments: eleyeleCenterline,
  checkpoints: eleyeleCheckpoints,
  boundaries: {
    minX: -215,
    maxX: 290,
    minZ: -327,
    maxZ: 327,
    minY: -10,
  },
  trackHalfWidth: 7,
  barrierLimit: 8,
  environment: {
    clearColor: new Color3(0.06, 0.1, 0.16),
    ambientColor: new Color3(0.24, 0.25, 0.28),
    sunDirection: new Vector3(0.6, -1.2, 0.4),
    sunDiffuse: new Color3(1, 0.96, 0.9),
    sunSpecular: new Color3(0.9, 0.9, 0.9),
    groundColor: new Color3(0.18, 0.22, 0.16),
    fogStart: 300,
    fogEnd: 1800,
  },
  events: eleyeleEvents,
  minimap: {
    svgViewBox: '-265 -377 605 754',
    fullCircuitSvgPath: 'M -133.96,239.91 L -130.41,237.15 L -126.78,234.5 L -123.1,231.91 L -119.39,229.37 L -115.65,226.86 L -111.9,224.37 L -108.14,221.9 L -104.38,219.44 L -100.61,216.99 L -96.84,214.52 L -93.08,212.05 L -89.34,209.56 L -85.62,207.03 L -81.94,204.44 L -78.34,201.74 L -74.84,198.91 L -71.4,196.02 L -68.55,192.55 L -66.38,188.61 L -64.62,184.47 L -63.08,180.24 L -61.73,175.95 L -60.52,171.62 L -59.48,167.24 L -58.66,162.82 L -58.2,158.35 L -58.3,153.85 L -59.21,149.45 L -61,145.34 L -63.47,141.58 L -66.15,137.97 L -68.93,134.43 L -71.99,131.13 L -74.97,127.76 L -77.4,123.99 L -79.23,119.88 L -80.66,115.62 L -81.56,111.21 L -81.54,106.73 L -79.92,102.55 L -77.74,98.62 L -76,94.47 L -74.1,90.39 L -73.26,86.01 L -74.83,81.86 L -77.81,78.5 L -81.2,75.54 L -84.77,72.8 L -88.43,70.19 L -92.15,67.66 L -95.89,65.16 L -99.64,62.67 L -103.36,60.15 L -107.03,57.53 L -110.53,54.71 L -113.71,51.53 L -116.7,48.17 L -118.76,44.2 L -119.33,39.76 L -118.66,35.32 L -117.58,30.95 L -116.27,26.65 L -114.79,22.4 L -113.24,18.18 L -111.62,13.98 L -109.97,9.79 L -108.28,5.62 L -106.57,1.46 L -104.83,-2.69 L -103.08,-6.83 L -101.3,-10.97 L -99.51,-15.09 L -97.7,-19.21 L -95.88,-23.33 L -94.05,-27.44 L -92.2,-31.54 L -90.34,-35.63 L -88.46,-39.72 L -86.57,-43.81 L -84.67,-47.88 L -82.74,-51.95 L -80.8,-56.01 L -78.84,-60.06 L -76.86,-64.1 L -74.85,-68.12 L -72.79,-72.12 L -70.67,-76.09 L -68.49,-80.02 L -66.3,-83.95 L -64.03,-87.84 L -61.48,-91.55 L -58.33,-94.74 L -54.45,-97 L -50.09,-98.02 L -45.59,-98.16 L -41.12,-97.75 L -36.77,-96.63 L -32.51,-95.18 L -28.3,-93.59 L -24.13,-91.91 L -19.96,-90.22 L -15.78,-88.54 L -11.59,-86.91 L -7.37,-85.36 L -3.1,-83.94 L 1.23,-82.7 L 5.61,-81.71 L 10.07,-81.09 L 14.56,-81.05 L 18.97,-81.85 L 23.04,-83.73 L 26.61,-86.45 L 29.74,-89.67 L 32.5,-93.23 L 34.96,-96.99 L 37.23,-100.88 L 39.33,-104.86 L 41.32,-108.89 L 43.24,-112.96 L 45.11,-117.05 L 46.98,-121.14 L 48.88,-125.22 L 50.85,-129.27 L 52.93,-133.26 L 55.2,-137.14 L 57.62,-140.93 L 60.06,-144.71 L 62.49,-148.49 L 64.93,-152.28 L 67.37,-156.06 L 69.81,-159.84 L 72.25,-163.62 L 74.69,-167.4 L 77.13,-171.18 L 79.57,-174.96 L 82.05,-178.71 L 84.6,-182.42 L 87.14,-186.13 L 89.58,-189.91 L 91.89,-193.77 L 94.02,-197.73 L 95.77,-201.88 L 97.3,-206.11 L 98.68,-210.39 L 99.99,-214.69 L 101.26,-219.01 L 102.52,-223.33 L 103.8,-227.64 L 105.12,-231.94 L 106.51,-236.22 L 107.99,-240.47 L 109.58,-244.68 L 111.33,-248.82 L 113.33,-252.85 L 115.6,-256.73 L 118.27,-260.34 L 121.49,-263.48 L 125.39,-265.69 L 129.77,-266.62 L 134.26,-266.52 L 138.7,-265.88 L 143.09,-264.87 L 147.4,-263.61 L 151.66,-262.16 L 155.85,-260.52 L 159.99,-258.76 L 164.09,-256.91 L 168.15,-254.97 L 172.16,-252.92 L 176.13,-250.81 L 180.07,-248.64 L 183.96,-246.37 L 187.81,-244.05 L 191.63,-241.67 L 195.4,-239.22 L 199.12,-236.69 L 202.81,-234.11 L 206.44,-231.46 L 210,-228.7 L 213.48,-225.86 L 216.88,-222.91 L 220.17,-219.84 L 223.27,-216.59 L 226.1,-213.1 L 228.42,-209.25 L 229.12,-204.88 L 227.3,-200.82 L 224.27,-197.5 L 220.81,-194.63 L 217.16,-192 L 213.43,-189.48 L 209.7,-186.98 L 206.02,-184.38 L 202.53,-181.54 L 199.49,-178.24 L 196.73,-174.69 L 194.14,-171.01 L 191.72,-167.21 L 189.43,-163.34 L 187.23,-159.42 L 185.23,-155.39 L 183.37,-151.29 L 181.55,-147.18 L 179.68,-143.09 L 177.83,-138.98 L 176.02,-134.86 L 174.23,-130.74 L 172.45,-126.6 L 170.67,-122.47 L 168.87,-118.35 L 167.06,-114.23 L 165.21,-110.13 L 163.34,-106.04 L 161.42,-101.97 L 159.46,-97.92 L 157.46,-93.89 L 155.39,-89.9 L 153.27,-85.92 L 151.12,-81.98 L 148.93,-78.04 L 146.72,-74.13 L 144.48,-70.23 L 142.22,-66.34 L 139.94,-62.46 L 137.64,-58.59 L 135.34,-54.72 L 133.03,-50.86 L 130.7,-47.01 L 128.38,-43.16 L 126.05,-39.31 L 123.72,-35.46 L 121.39,-31.61 L 119.06,-27.76 L 116.73,-23.91 L 114.42,-20.05 L 112.11,-16.19 L 109.82,-12.32 L 107.52,-8.45 L 105.22,-4.59 L 102.92,-0.72 L 100.61,3.14 L 98.3,7 L 95.99,10.86 L 93.67,14.72 L 91.36,18.58 L 89.04,22.44 L 86.73,26.29 L 84.41,30.15 L 82.09,34 L 79.77,37.86 L 77.45,41.72 L 75.13,45.57 L 72.81,49.43 L 70.5,53.28 L 68.18,57.14 L 65.87,61 L 63.55,64.86 L 61.21,68.7 L 58.84,72.52 L 56.45,76.33 L 54.05,80.14 L 51.67,83.96 L 49.3,87.78 L 46.96,91.63 L 44.69,95.51 L 42.48,99.43 L 40.36,103.4 L 38.37,107.43 L 36.55,111.55 L 34.89,115.73 L 33.33,119.95 L 31.79,124.17 L 30.2,128.38 L 28.51,132.55 L 26.66,136.65 L 24.65,140.68 L 22.53,144.65 L 20.38,148.6 L 18.18,152.52 L 15.94,156.42 L 13.66,160.3 L 11.33,164.15 L 8.96,167.98 L 6.55,171.77 L 4.08,175.54 L 1.58,179.27 L -0.99,182.97 L -3.61,186.63 L -6.29,190.24 L -9.05,193.8 L -11.86,197.31 L -14.71,200.79 L -17.59,204.24 L -20.51,207.67 L -23.48,211.05 L -26.5,214.39 L -29.57,217.67 L -32.7,220.91 L -35.89,224.07 L -39.16,227.16 L -42.5,230.18 L -45.93,233.09 L -49.44,235.91 L -53.04,238.61 L -56.73,241.18 L -60.48,243.66 L -64.28,246.06 L -68.14,248.38 L -72.05,250.61 L -76.01,252.74 L -80.03,254.77 L -84.1,256.69 L -88.22,258.48 L -92.4,260.14 L -96.64,261.64 L -100.94,262.97 L -105.3,264.08 L -109.72,264.95 L -114.18,265.53 L -118.66,265.86 L -123.16,266.01 L -127.66,266 L -132.15,265.84 L -136.64,265.52 L -141.11,265.03 L -145.55,264.31 L -149.92,263.22 L -153.97,261.32 L -154.46,257.33 L -151.58,253.89 L -148.2,250.92 L -144.67,248.13 L -141.09,245.41 L -137.5,242.69 Z',
    sprintSvgPath: 'M -133.96,239.91 L -130.41,237.15 L -126.78,234.5 L -123.1,231.91 L -119.39,229.37 L -115.65,226.86 L -111.9,224.37 L -108.14,221.9 L -104.38,219.44 L -100.61,216.99 L -96.84,214.52 L -93.08,212.05 L -89.34,209.56 L -85.62,207.03 L -81.94,204.44 L -78.34,201.74 L -74.84,198.91 L -71.4,196.02 L -68.55,192.55 L -66.38,188.61 L -64.62,184.47 L -63.08,180.24 L -61.73,175.95 L -60.52,171.62 L -59.48,167.24 L -58.66,162.82 L -58.2,158.35 L -58.3,153.85 L -59.21,149.45 L -61,145.34 L -63.47,141.58 L -66.15,137.97 L -68.93,134.43 L -71.99,131.13 L -74.97,127.76 L -77.4,123.99 L -79.23,119.88 L -80.66,115.62 L -81.56,111.21 L -81.54,106.73 L -79.92,102.55 L -77.74,98.62 L -76,94.47 L -74.1,90.39 L -73.26,86.01 L -74.83,81.86 L -77.81,78.5 L -81.2,75.54 L -84.77,72.8 L -88.43,70.19 L -92.15,67.66 L -95.89,65.16 L -99.64,62.67 L -103.36,60.15 L -107.03,57.53 L -110.53,54.71 L -113.71,51.53 L -116.7,48.17 L -118.76,44.2 L -119.33,39.76 L -118.66,35.32 L -117.58,30.95 L -116.27,26.65 L -114.79,22.4 L -113.24,18.18 L -111.62,13.98 L -109.97,9.79 L -108.28,5.62 L -106.57,1.46 L -104.83,-2.69 L -103.08,-6.83 L -101.3,-10.97 L -99.51,-15.09 L -97.7,-19.21 L -95.88,-23.33 L -94.05,-27.44 L -92.2,-31.54 L -90.34,-35.63 L -88.46,-39.72 L -86.57,-43.81 L -84.67,-47.88 L -82.74,-51.95 L -80.8,-56.01 L -78.84,-60.06 L -76.86,-64.1 L -74.85,-68.12 L -72.79,-72.12 L -70.67,-76.09 L -68.49,-80.02 L -66.3,-83.95 L -64.03,-87.84 L -61.48,-91.55 L -58.33,-94.74 L -54.45,-97 L -50.09,-98.02 L -45.59,-98.16 L -41.12,-97.75 L -36.77,-96.63 L -32.51,-95.18 L -28.3,-93.59 L -24.13,-91.91 L -19.96,-90.22 L -15.78,-88.54 L -11.59,-86.91 L -7.37,-85.36 L -3.1,-83.94 L 1.23,-82.7 L 5.61,-81.71 L 10.07,-81.09 L 14.56,-81.05 L 18.97,-81.85 L 23.04,-83.73 L 26.61,-86.45 L 29.74,-89.67 L 32.5,-93.23 L 34.96,-96.99 L 37.23,-100.88 L 39.33,-104.86 L 41.32,-108.89 L 43.24,-112.96 L 45.11,-117.05 L 46.98,-121.14 L 48.88,-125.22 L 50.85,-129.27 L 52.93,-133.26 L 55.2,-137.14 L 57.62,-140.93 L 60.06,-144.71 L 62.49,-148.49 L 64.93,-152.28 L 67.37,-156.06 L 69.81,-159.84 L 72.25,-163.62 L 74.69,-167.4 L 77.13,-171.18 L 79.57,-174.96 L 82.05,-178.71 L 84.6,-182.42 L 87.14,-186.13 L 89.58,-189.91 L 91.89,-193.77 L 94.02,-197.73 L 95.77,-201.88 L 97.3,-206.11 L 98.68,-210.39 L 99.99,-214.69 L 101.26,-219.01 L 102.52,-223.33 L 103.8,-227.64 L 105.12,-231.94 L 106.51,-236.22 L 107.99,-240.47 L 109.58,-244.68 L 111.33,-248.82 L 113.33,-252.85 L 115.6,-256.73 L 118.27,-260.34 L 121.49,-263.48 L 125.39,-265.69 L 129.77,-266.62 L 134.26,-266.52 L 138.7,-265.88 L 143.09,-264.87 L 147.4,-263.61 L 151.66,-262.16 L 155.85,-260.52 L 159.99,-258.76 L 164.09,-256.91 L 168.15,-254.97 L 172.16,-252.92 L 176.13,-250.81 L 180.07,-248.64 L 183.96,-246.37 L 187.81,-244.05 L 191.63,-241.67 L 195.4,-239.22 L 199.12,-236.69 L 202.81,-234.11 L 206.44,-231.46 L 210,-228.7 L 213.48,-225.86 L 216.88,-222.91 L 220.17,-219.84 L 223.27,-216.59 L 226.1,-213.1 L 228.42,-209.25 L 229.12,-204.88 L 227.3,-200.82 L 224.27,-197.5 L 220.81,-194.63 L 217.16,-192 L 213.43,-189.48 L 209.7,-186.98 L 206.02,-184.38 L 202.53,-181.54 L 199.49,-178.24 L 196.73,-174.69 L 194.14,-171.01 L 191.72,-167.21 L 189.43,-163.34 L 187.23,-159.42 L 185.23,-155.39 L 183.37,-151.29 L 181.55,-147.18 L 179.68,-143.09 L 177.83,-138.98 L 176.02,-134.86 L 174.23,-130.74 L 172.45,-126.6 L 170.67,-122.47 L 168.87,-118.35 L 167.06,-114.23 L 165.21,-110.13 L 163.34,-106.04 L 161.42,-101.97 L 159.46,-97.92 L 157.46,-93.89 L 155.39,-89.9 L 153.27,-85.92 L 151.12,-81.98 L 148.93,-78.04 L 146.72,-74.13 L 144.48,-70.23 L 142.22,-66.34 L 139.94,-62.46 L 137.64,-58.59 L 135.34,-54.72 L 133.03,-50.86 L 130.7,-47.01 L 128.38,-43.16 L 126.05,-39.31 L 123.72,-35.46 L 121.39,-31.61 L 119.06,-27.76 L 116.73,-23.91 L 114.42,-20.05 L 112.11,-16.19 L 109.82,-12.32 L 107.52,-8.45 L 105.22,-4.59 L 102.92,-0.72 L 100.61,3.14 L 98.3,7 L 95.99,10.86 L 93.67,14.72 L 91.36,18.58 L 89.04,22.44 L 86.73,26.29 L 84.41,30.15 L 82.09,34 L 79.77,37.86 L 77.45,41.72 L 75.13,45.57 L 72.81,49.43 L 70.5,53.28 L 68.18,57.14 L 65.87,61 L 63.55,64.86 L 61.21,68.7 L 58.84,72.52 L 56.45,76.33 L 54.05,80.14 L 51.67,83.96 L 49.3,87.78 L 46.96,91.63 L 44.69,95.51 L 42.48,99.43 L 40.36,103.4 L 38.37,107.43 L 36.55,111.55 L 34.89,115.73 L 33.33,119.95 L 31.79,124.17 L 30.2,128.38 L 28.51,132.55 L 26.66,136.65 L 24.65,140.68 L 22.53,144.65 L 20.38,148.6 L 18.18,152.52 L 15.94,156.42 L 13.66,160.3 L 11.33,164.15 L 8.96,167.98 L 6.55,171.77 L 4.08,175.54 L 1.58,179.27 L -0.99,182.97 L -3.61,186.63 L -6.29,190.24 L -9.05,193.8 L -11.86,197.31 L -14.71,200.79 L -17.59,204.24 L -20.51,207.67 L -23.48,211.05 L -26.5,214.39 L -29.57,217.67 L -32.7,220.91 L -35.89,224.07 L -39.16,227.16 L -42.5,230.18 L -45.93,233.09 L -49.44,235.91 L -53.04,238.61 L -56.73,241.18 L -60.48,243.66 L -64.28,246.06 L -68.14,248.38 L -72.05,250.61 L -76.01,252.74 L -80.03,254.77 L -84.1,256.69 L -88.22,258.48 L -92.4,260.14 L -96.64,261.64 L -100.94,262.97 L -105.3,264.08 L -109.72,264.95 L -114.18,265.53 L -118.66,265.86 L -123.16,266.01 L -127.66,266 L -132.15,265.84 L -136.64,265.52 L -141.11,265.03 L -145.55,264.31 L -149.92,263.22 L -153.97,261.32 L -154.46,257.33 L -151.58,253.89 L -148.2,250.92 L -144.67,248.13 L -141.09,245.41 L -137.5,242.69 Z',
    sprintStart: { x: -133.96, y: 239.91 },
    sprintFinish: { x: 1373.42, y: 1064.1 },
    startFinishMarker: { x: -133.96, y: 239.91, labelPos: { x: 15, y: -10 } },
    driftZones: [
      {
            "path": "M -80,110 L -73,85 L -118,45",
            "label": "INFIELD CHICANE",
            "labelPos": {
                  "x": -90,
                  "y": 75
            }
      },
      {
            "path": "M -110,265 L -55,240 L 25,140",
            "label": "NORTH CAROUSEL",
            "labelPos": {
                  "x": -50,
                  "y": 220
            }
      }
],
    gateMarkers: [
      { x: -133.96, y: 239.91 },
      { x: -58.3, y: 153.85 },
      { x: -107.03, y: 57.53 },
      { x: -82.74, y: -51.95 },
      { x: 10.07, y: -81.09 },
      { x: 79.57, y: -174.96 },
      { x: 143.09, y: -264.87 },
      { x: 220.81, y: -194.63 },
      { x: 157.46, y: -93.89 },
      { x: 95.99, y: 10.86 },
      { x: 34.89, y: 115.73 },
      { x: -29.57, y: 217.67 },
    ],
  },

  buildRoadMarkings: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const yMarking = yOffset + 0.002;

    // Start/Finish Checkered Line
    const sfTex = new DynamicTexture('eleyele_SF_Tex', { width: 512, height: 64 }, scene, false);
    const sfCtx = sfTex.getContext() as CanvasRenderingContext2D;
    if (sfCtx) {
      sfCtx.fillStyle = '#ffffff';
      sfCtx.fillRect(0, 0, 512, 64);
      sfCtx.fillStyle = '#111111';
      const checkSize = 32;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 16; c++) {
          if ((r + c) % 2 === 0) {
            sfCtx.fillRect(c * checkSize, r * checkSize, checkSize, checkSize);
          }
        }
      }
      sfTex.update();
    }

    const sfMat = new StandardMaterial('eleyele_SF_Mat', scene);
    sfMat.diffuseTexture = sfTex;
    sfMat.specularColor = new Color3(0.05, 0.05, 0.05);
    sfMat.backFaceCulling = false;

    const sfStrip = MeshBuilder.CreateGround('eleyele_SF_Strip', { width: 13.5, height: 2.0 }, scene);
    sfStrip.position.set(-133.96, yMarking, 239.91);
    sfStrip.rotation.y = 2.234;
    sfStrip.material = sfMat;
    sfStrip.parent = parent;
    sfStrip.isPickable = false;

    
  },

  buildRoadVerges: (_scene: Scene, _parent: TransformNode, _yOffset: number) => {
    // Built continuously along full spline by RoadMeshBuilder.buildVerges
  },

  buildRoadsideInfrastructure: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const postMat = new StandardMaterial('eleyele_PostMat', scene);
    postMat.diffuseColor = new Color3(0.25, 0.25, 0.25);
    postMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const bannerMat = new StandardMaterial('eleyele_BannerMat', scene);
    bannerMat.diffuseColor = new Color3(0.9, 0.2, 0.15);
    bannerMat.specularColor = new Color3(0.2, 0.2, 0.2);

    const totalSamples = eleyeleRoadSamples.length;
    for (let i = 0; i < totalSamples; i += 25) {
      const pt = eleyeleRoadSamples[i];
      const curWidth = pt.width || 13.5;
      const rightPos = pt.position.add(pt.rightNormal.scale(curWidth / 2 + 1.8));

      const post = MeshBuilder.CreateCylinder('eleyele_BoardPost_' + i, { height: 1.8, diameter: 0.12 }, scene);
      post.position.set(rightPos.x, yOffset + 0.9, rightPos.z);
      post.material = postMat;
      post.parent = parent;
      post.isPickable = false;

      const board = MeshBuilder.CreateBox('eleyele_BoardPanel_' + i, { width: 1.4, height: 0.8, depth: 0.08 }, scene);
      board.position.set(rightPos.x, yOffset + 1.4, rightPos.z);
      board.rotation.y = Math.atan2(pt.tangent.x, pt.tangent.z);
      board.material = bannerMat;
      board.parent = parent;
      board.isPickable = false;
    }
  },

  buildScenery: async (scene: Scene, parent: TransformNode) => {
    const sceneryRoot = new TransformNode('eleyele_SceneryContainer', scene);
    sceneryRoot.parent = parent;

    const foliageMat = new StandardMaterial('eleyele_FoliageMat', scene);
    foliageMat.diffuseColor = new Color3(0.2, 0.35, 0.18);
    foliageMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const trunkMat = new StandardMaterial('eleyele_TrunkMat', scene);
    trunkMat.diffuseColor = new Color3(0.28, 0.18, 0.10);
    trunkMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const totalSamples = eleyeleRoadSamples.length;
    for (let i = 0; i < totalSamples; i += 20) {
      const pt = eleyeleRoadSamples[i];
      const curWidth = pt.width || 13.5;
      
      for (const side of [-1, 1]) {
        const offset = curWidth / 2 + 4.5 + Math.random() * 4.0;
        const pos = pt.position.add(pt.rightNormal.scale(side * offset));

        const trunk = MeshBuilder.CreateCylinder('eleyele_Trunk_' + i + '_' + side, { height: 3.2, diameter: 0.35 }, scene);
        trunk.position.set(pos.x, 1.6, pos.z);
        trunk.material = trunkMat;
        trunk.parent = sceneryRoot;
        trunk.isPickable = false;

        const canopy = MeshBuilder.CreateSphere('eleyele_Canopy_' + i + '_' + side, { diameter: 3.6, segments: 6 }, scene);
        canopy.position.set(pos.x, 3.8, pos.z);
        canopy.material = foliageMat;
        canopy.parent = sceneryRoot;
        canopy.isPickable = false;
      }
    }
  },
};
