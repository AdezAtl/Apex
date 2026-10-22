import {
  Scene,
  Vector3,
  Color3,
  TransformNode,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  SceneLoader,
} from '@babylonjs/core';
import { CircuitDefinition } from './TrackConfig';
import { RaceEventConfig } from '../events/EventConfig';
import { RoadSamplePoint } from '../environment/RoadMeshBuilder';

// 294 discrete road sample points along the 980.0m continuous motorsport circuit (13.0m wide)
const forestValleyRoadSamples: RoadSamplePoint[] = [
  { position: new Vector3(0.00, 0.05, 0.00), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 0.00, curvatureDeg: 5.96 },
  { position: new Vector3(0.11, 0.05, 3.33), tangent: new Vector3(0.007, 0, 1.000), rightNormal: new Vector3(1.000, 0, -0.007), distance: 3.33, curvatureDeg: 3.13 },
  { position: new Vector3(0.04, 0.05, 6.66), tangent: new Vector3(-0.016, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.016), distance: 6.67, curvatureDeg: 0.51 },
  { position: new Vector3(0.00, 0.05, 9.99), tangent: new Vector3(-0.007, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.007), distance: 10.00, curvatureDeg: 0.63 },
  { position: new Vector3(0.00, 0.05, 13.33), tangent: new Vector3(-0.001, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.001), distance: 13.33, curvatureDeg: 0.06 },
  { position: new Vector3(0.00, 0.05, 16.66), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 16.67, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 19.99), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 20.00, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 23.33), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 23.33, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 26.66), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 26.67, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 29.99), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 30.00, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 33.33), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 33.33, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 36.66), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 36.67, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 39.99), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 40.00, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 43.33), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 43.33, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 46.66), tangent: new Vector3(0.000, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.000), distance: 46.67, curvatureDeg: 0.00 },
  { position: new Vector3(0.00, 0.05, 49.99), tangent: new Vector3(-0.004, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.004), distance: 50.00, curvatureDeg: 0.41 },
  { position: new Vector3(-0.02, 0.05, 53.33), tangent: new Vector3(-0.014, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.014), distance: 53.33, curvatureDeg: 0.78 },
  { position: new Vector3(-0.09, 0.05, 56.66), tangent: new Vector3(-0.025, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.025), distance: 56.67, curvatureDeg: 0.50 },
  { position: new Vector3(-0.19, 0.05, 59.99), tangent: new Vector3(-0.031, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.031), distance: 60.00, curvatureDeg: 0.18 },
  { position: new Vector3(-0.30, 0.05, 63.32), tangent: new Vector3(-0.031, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.031), distance: 63.33, curvatureDeg: 0.16 },
  { position: new Vector3(-0.40, 0.05, 66.66), tangent: new Vector3(-0.025, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.025), distance: 66.67, curvatureDeg: 0.51 },
  { position: new Vector3(-0.47, 0.05, 69.99), tangent: new Vector3(-0.013, 0, 1.000), rightNormal: new Vector3(1.000, 0, 0.013), distance: 70.00, curvatureDeg: 0.86 },
  { position: new Vector3(-0.49, 0.05, 73.32), tangent: new Vector3(0.005, 0, 1.000), rightNormal: new Vector3(1.000, 0, -0.005), distance: 73.33, curvatureDeg: 1.21 },
  { position: new Vector3(-0.44, 0.05, 76.65), tangent: new Vector3(0.029, 0, 1.000), rightNormal: new Vector3(1.000, 0, -0.029), distance: 76.67, curvatureDeg: 1.56 },
  { position: new Vector3(-0.30, 0.05, 79.98), tangent: new Vector3(0.059, 0, 0.998), rightNormal: new Vector3(0.998, 0, -0.059), distance: 80.00, curvatureDeg: 1.88 },
  { position: new Vector3(-0.04, 0.05, 83.31), tangent: new Vector3(0.087, 0, 0.996), rightNormal: new Vector3(0.996, 0, -0.087), distance: 83.33, curvatureDeg: 1.33 },
  { position: new Vector3(0.28, 0.05, 86.63), tangent: new Vector3(0.101, 0, 0.995), rightNormal: new Vector3(0.995, 0, -0.101), distance: 86.67, curvatureDeg: 0.26 },
  { position: new Vector3(0.63, 0.05, 89.94), tangent: new Vector3(0.108, 0, 0.994), rightNormal: new Vector3(0.994, 0, -0.108), distance: 90.00, curvatureDeg: 0.57 },
  { position: new Vector3(1.00, 0.05, 93.25), tangent: new Vector3(0.121, 0, 0.993), rightNormal: new Vector3(0.993, 0, -0.121), distance: 93.33, curvatureDeg: 0.90 },
  { position: new Vector3(1.43, 0.05, 96.56), tangent: new Vector3(0.139, 0, 0.990), rightNormal: new Vector3(0.990, 0, -0.139), distance: 96.67, curvatureDeg: 1.24 },
  { position: new Vector3(1.93, 0.05, 99.85), tangent: new Vector3(0.163, 0, 0.987), rightNormal: new Vector3(0.987, 0, -0.163), distance: 100.00, curvatureDeg: 1.58 },
  { position: new Vector3(2.52, 0.05, 103.14), tangent: new Vector3(0.193, 0, 0.981), rightNormal: new Vector3(0.981, 0, -0.193), distance: 103.33, curvatureDeg: 1.92 },
  { position: new Vector3(3.22, 0.05, 106.39), tangent: new Vector3(0.229, 0, 0.973), rightNormal: new Vector3(0.973, 0, -0.229), distance: 106.67, curvatureDeg: 2.27 },
  { position: new Vector3(4.04, 0.05, 109.62), tangent: new Vector3(0.270, 0, 0.963), rightNormal: new Vector3(0.963, 0, -0.270), distance: 110.00, curvatureDeg: 2.61 },
  { position: new Vector3(5.02, 0.05, 112.81), tangent: new Vector3(0.317, 0, 0.949), rightNormal: new Vector3(0.949, 0, -0.317), distance: 113.33, curvatureDeg: 2.94 },
  { position: new Vector3(6.15, 0.05, 115.94), tangent: new Vector3(0.365, 0, 0.931), rightNormal: new Vector3(0.931, 0, -0.365), distance: 116.67, curvatureDeg: 2.90 },
  { position: new Vector3(7.45, 0.05, 119.02), tangent: new Vector3(0.401, 0, 0.916), rightNormal: new Vector3(0.916, 0, -0.401), distance: 120.00, curvatureDeg: 1.57 },
  { position: new Vector3(8.83, 0.05, 122.05), tangent: new Vector3(0.425, 0, 0.905), rightNormal: new Vector3(0.905, 0, -0.425), distance: 123.33, curvatureDeg: 1.46 },
  { position: new Vector3(10.28, 0.05, 125.05), tangent: new Vector3(0.449, 0, 0.894), rightNormal: new Vector3(0.894, 0, -0.449), distance: 126.67, curvatureDeg: 1.58 },
  { position: new Vector3(11.82, 0.05, 128.01), tangent: new Vector3(0.474, 0, 0.880), rightNormal: new Vector3(0.880, 0, -0.474), distance: 130.00, curvatureDeg: 1.73 },
  { position: new Vector3(13.44, 0.05, 130.92), tangent: new Vector3(0.502, 0, 0.865), rightNormal: new Vector3(0.865, 0, -0.502), distance: 133.33, curvatureDeg: 1.91 },
  { position: new Vector3(15.16, 0.05, 133.77), tangent: new Vector3(0.532, 0, 0.847), rightNormal: new Vector3(0.847, 0, -0.532), distance: 136.67, curvatureDeg: 2.14 },
  { position: new Vector3(16.99, 0.05, 136.56), tangent: new Vector3(0.565, 0, 0.825), rightNormal: new Vector3(0.825, 0, -0.565), distance: 140.00, curvatureDeg: 2.40 },
  { position: new Vector3(18.93, 0.05, 139.27), tangent: new Vector3(0.602, 0, 0.799), rightNormal: new Vector3(0.799, 0, -0.602), distance: 143.33, curvatureDeg: 2.71 },
  { position: new Vector3(21.00, 0.05, 141.88), tangent: new Vector3(0.641, 0, 0.767), rightNormal: new Vector3(0.767, 0, -0.641), distance: 146.67, curvatureDeg: 3.09 },
  { position: new Vector3(23.20, 0.05, 144.38), tangent: new Vector3(0.684, 0, 0.729), rightNormal: new Vector3(0.729, 0, -0.684), distance: 150.00, curvatureDeg: 3.54 },
  { position: new Vector3(25.56, 0.05, 146.74), tangent: new Vector3(0.731, 0, 0.682), rightNormal: new Vector3(0.682, 0, -0.731), distance: 153.33, curvatureDeg: 4.09 },
  { position: new Vector3(28.07, 0.05, 148.93), tangent: new Vector3(0.781, 0, 0.625), rightNormal: new Vector3(0.625, 0, -0.781), distance: 156.67, curvatureDeg: 4.54 },
  { position: new Vector3(30.76, 0.05, 150.90), tangent: new Vector3(0.825, 0, 0.565), rightNormal: new Vector3(0.565, 0, -0.825), distance: 160.00, curvatureDeg: 3.95 },
  { position: new Vector3(33.57, 0.05, 152.69), tangent: new Vector3(0.859, 0, 0.511), rightNormal: new Vector3(0.511, 0, -0.859), distance: 163.33, curvatureDeg: 3.42 },
  { position: new Vector3(36.48, 0.05, 154.31), tangent: new Vector3(0.887, 0, 0.462), rightNormal: new Vector3(0.462, 0, -0.887), distance: 166.67, curvatureDeg: 3.02 },
  { position: new Vector3(39.48, 0.05, 155.77), tangent: new Vector3(0.909, 0, 0.417), rightNormal: new Vector3(0.417, 0, -0.909), distance: 170.00, curvatureDeg: 2.70 },
  { position: new Vector3(42.54, 0.05, 157.09), tangent: new Vector3(0.927, 0, 0.376), rightNormal: new Vector3(0.376, 0, -0.927), distance: 173.33, curvatureDeg: 2.52 },
  { position: new Vector3(45.65, 0.05, 158.28), tangent: new Vector3(0.942, 0, 0.336), rightNormal: new Vector3(0.336, 0, -0.942), distance: 176.67, curvatureDeg: 2.32 },
  { position: new Vector3(48.81, 0.05, 159.33), tangent: new Vector3(0.954, 0, 0.298), rightNormal: new Vector3(0.298, 0, -0.954), distance: 180.00, curvatureDeg: 2.25 },
  { position: new Vector3(52.02, 0.05, 160.26), tangent: new Vector3(0.965, 0, 0.261), rightNormal: new Vector3(0.261, 0, -0.965), distance: 183.33, curvatureDeg: 2.16 },
  { position: new Vector3(55.25, 0.05, 161.07), tangent: new Vector3(0.974, 0, 0.224), rightNormal: new Vector3(0.224, 0, -0.974), distance: 186.67, curvatureDeg: 2.18 },
  { position: new Vector3(58.51, 0.05, 161.76), tangent: new Vector3(0.982, 0, 0.187), rightNormal: new Vector3(0.187, 0, -0.982), distance: 190.00, curvatureDeg: 2.20 },
  { position: new Vector3(61.80, 0.05, 162.32), tangent: new Vector3(0.989, 0, 0.148), rightNormal: new Vector3(0.148, 0, -0.989), distance: 193.33, curvatureDeg: 2.29 },
  { position: new Vector3(65.10, 0.05, 162.75), tangent: new Vector3(0.994, 0, 0.107), rightNormal: new Vector3(0.107, 0, -0.994), distance: 196.67, curvatureDeg: 2.47 },
  { position: new Vector3(68.42, 0.05, 163.03), tangent: new Vector3(0.998, 0, 0.062), rightNormal: new Vector3(0.062, 0, -0.998), distance: 200.00, curvatureDeg: 2.69 },
  { position: new Vector3(71.75, 0.05, 163.16), tangent: new Vector3(1.000, 0, 0.015), rightNormal: new Vector3(0.015, 0, -1.000), distance: 203.33, curvatureDeg: 2.71 },
  { position: new Vector3(75.09, 0.05, 163.14), tangent: new Vector3(1.000, 0, -0.030), rightNormal: new Vector3(-0.030, 0, -1.000), distance: 206.67, curvatureDeg: 2.50 },
  { position: new Vector3(78.41, 0.05, 162.96), tangent: new Vector3(0.997, 0, -0.072), rightNormal: new Vector3(-0.072, 0, -0.997), distance: 210.00, curvatureDeg: 2.35 },
  { position: new Vector3(81.73, 0.05, 162.66), tangent: new Vector3(0.994, 0, -0.113), rightNormal: new Vector3(-0.113, 0, -0.994), distance: 213.33, curvatureDeg: 2.29 },
  { position: new Vector3(85.04, 0.05, 162.21), tangent: new Vector3(0.988, 0, -0.152), rightNormal: new Vector3(-0.152, 0, -0.988), distance: 216.67, curvatureDeg: 2.22 },
  { position: new Vector3(88.32, 0.05, 161.64), tangent: new Vector3(0.982, 0, -0.190), rightNormal: new Vector3(-0.190, 0, -0.982), distance: 220.00, curvatureDeg: 2.24 },
  { position: new Vector3(91.58, 0.05, 160.95), tangent: new Vector3(0.973, 0, -0.229), rightNormal: new Vector3(-0.229, 0, -0.973), distance: 223.33, curvatureDeg: 2.33 },
  { position: new Vector3(94.81, 0.05, 160.12), tangent: new Vector3(0.963, 0, -0.269), rightNormal: new Vector3(-0.269, 0, -0.963), distance: 226.67, curvatureDeg: 2.41 },
  { position: new Vector3(98.00, 0.05, 159.15), tangent: new Vector3(0.951, 0, -0.311), rightNormal: new Vector3(-0.311, 0, -0.951), distance: 230.00, curvatureDeg: 2.58 },
  { position: new Vector3(101.14, 0.05, 158.05), tangent: new Vector3(0.935, 0, -0.355), rightNormal: new Vector3(-0.355, 0, -0.935), distance: 233.33, curvatureDeg: 2.83 },
  { position: new Vector3(104.23, 0.05, 156.79), tangent: new Vector3(0.915, 0, -0.404), rightNormal: new Vector3(-0.404, 0, -0.915), distance: 236.67, curvatureDeg: 3.17 },
  { position: new Vector3(107.24, 0.05, 155.36), tangent: new Vector3(0.889, 0, -0.457), rightNormal: new Vector3(-0.457, 0, -0.889), distance: 240.00, curvatureDeg: 3.62 },
  { position: new Vector3(110.15, 0.05, 153.74), tangent: new Vector3(0.858, 0, -0.514), rightNormal: new Vector3(-0.514, 0, -0.858), distance: 243.33, curvatureDeg: 3.82 },
  { position: new Vector3(112.95, 0.05, 151.93), tangent: new Vector3(0.823, 0, -0.568), rightNormal: new Vector3(-0.568, 0, -0.823), distance: 246.67, curvatureDeg: 3.51 },
  { position: new Vector3(115.64, 0.05, 149.96), tangent: new Vector3(0.789, 0, -0.615), rightNormal: new Vector3(-0.615, 0, -0.789), distance: 250.00, curvatureDeg: 3.20 },
  { position: new Vector3(118.21, 0.05, 147.84), tangent: new Vector3(0.754, 0, -0.656), rightNormal: new Vector3(-0.656, 0, -0.754), distance: 253.33, curvatureDeg: 2.97 },
  { position: new Vector3(120.67, 0.05, 145.59), tangent: new Vector3(0.720, 0, -0.694), rightNormal: new Vector3(-0.694, 0, -0.720), distance: 256.67, curvatureDeg: 2.85 },
  { position: new Vector3(123.01, 0.05, 143.22), tangent: new Vector3(0.685, 0, -0.728), rightNormal: new Vector3(-0.728, 0, -0.685), distance: 260.00, curvatureDeg: 2.78 },
  { position: new Vector3(125.23, 0.05, 140.73), tangent: new Vector3(0.649, 0, -0.761), rightNormal: new Vector3(-0.761, 0, -0.649), distance: 263.33, curvatureDeg: 2.76 },
  { position: new Vector3(127.34, 0.05, 138.15), tangent: new Vector3(0.611, 0, -0.791), rightNormal: new Vector3(-0.791, 0, -0.611), distance: 266.67, curvatureDeg: 2.83 },
  { position: new Vector3(129.31, 0.05, 135.46), tangent: new Vector3(0.570, 0, -0.821), rightNormal: new Vector3(-0.821, 0, -0.570), distance: 270.00, curvatureDeg: 3.00 },
  { position: new Vector3(131.14, 0.05, 132.67), tangent: new Vector3(0.525, 0, -0.851), rightNormal: new Vector3(-0.851, 0, -0.525), distance: 273.33, curvatureDeg: 3.22 },
  { position: new Vector3(132.80, 0.05, 129.79), tangent: new Vector3(0.473, 0, -0.881), rightNormal: new Vector3(-0.881, 0, -0.473), distance: 276.67, curvatureDeg: 3.62 },
  { position: new Vector3(134.29, 0.05, 126.80), tangent: new Vector3(0.413, 0, -0.911), rightNormal: new Vector3(-0.911, 0, -0.413), distance: 280.00, curvatureDeg: 4.11 },
  { position: new Vector3(135.55, 0.05, 123.72), tangent: new Vector3(0.349, 0, -0.937), rightNormal: new Vector3(-0.937, 0, -0.349), distance: 283.33, curvatureDeg: 3.85 },
  { position: new Vector3(136.61, 0.05, 120.56), tangent: new Vector3(0.288, 0, -0.958), rightNormal: new Vector3(-0.958, 0, -0.288), distance: 286.67, curvatureDeg: 3.50 },
  { position: new Vector3(137.47, 0.05, 117.34), tangent: new Vector3(0.231, 0, -0.973), rightNormal: new Vector3(-0.973, 0, -0.231), distance: 290.00, curvatureDeg: 3.26 },
  { position: new Vector3(138.15, 0.05, 114.08), tangent: new Vector3(0.176, 0, -0.984), rightNormal: new Vector3(-0.984, 0, -0.176), distance: 293.33, curvatureDeg: 3.11 },
  { position: new Vector3(138.65, 0.05, 110.78), tangent: new Vector3(0.123, 0, -0.992), rightNormal: new Vector3(-0.992, 0, -0.123), distance: 296.67, curvatureDeg: 3.06 },
  { position: new Vector3(138.97, 0.05, 107.46), tangent: new Vector3(0.070, 0, -0.998), rightNormal: new Vector3(-0.998, 0, -0.070), distance: 300.00, curvatureDeg: 3.07 },
  { position: new Vector3(139.11, 0.05, 104.13), tangent: new Vector3(0.016, 0, -1.000), rightNormal: new Vector3(-1.000, 0, -0.016), distance: 303.33, curvatureDeg: 3.18 },
  { position: new Vector3(139.07, 0.05, 100.80), tangent: new Vector3(-0.042, 0, -0.999), rightNormal: new Vector3(-0.999, 0, 0.042), distance: 306.67, curvatureDeg: 3.40 },
  { position: new Vector3(138.84, 0.05, 97.48), tangent: new Vector3(-0.106, 0, -0.994), rightNormal: new Vector3(-0.994, 0, 0.106), distance: 310.00, curvatureDeg: 3.97 },
  { position: new Vector3(138.37, 0.05, 94.18), tangent: new Vector3(-0.212, 0, -0.977), rightNormal: new Vector3(-0.977, 0, 0.212), distance: 313.33, curvatureDeg: 8.34 },
  { position: new Vector3(137.43, 0.05, 90.98), tangent: new Vector3(-0.348, 0, -0.938), rightNormal: new Vector3(-0.938, 0, 0.348), distance: 316.67, curvatureDeg: 7.87 },
  { position: new Vector3(136.06, 0.05, 87.95), tangent: new Vector3(-0.451, 0, -0.892), rightNormal: new Vector3(-0.892, 0, 0.451), distance: 320.00, curvatureDeg: 5.10 },
  { position: new Vector3(134.42, 0.05, 85.04), tangent: new Vector3(-0.512, 0, -0.859), rightNormal: new Vector3(-0.859, 0, 0.512), distance: 323.33, curvatureDeg: 2.86 },
  { position: new Vector3(132.65, 0.05, 82.22), tangent: new Vector3(-0.540, 0, -0.842), rightNormal: new Vector3(-0.842, 0, 0.540), distance: 326.67, curvatureDeg: 0.94 },
  { position: new Vector3(130.82, 0.05, 79.43), tangent: new Vector3(-0.540, 0, -0.841), rightNormal: new Vector3(-0.841, 0, 0.540), distance: 330.00, curvatureDeg: 0.90 },
  { position: new Vector3(129.04, 0.05, 76.61), tangent: new Vector3(-0.512, 0, -0.859), rightNormal: new Vector3(-0.859, 0, 0.512), distance: 333.33, curvatureDeg: 2.91 },
  { position: new Vector3(127.41, 0.05, 73.71), tangent: new Vector3(-0.449, 0, -0.894), rightNormal: new Vector3(-0.894, 0, 0.449), distance: 336.67, curvatureDeg: 5.40 },
  { position: new Vector3(126.06, 0.05, 70.67), tangent: new Vector3(-0.337, 0, -0.942), rightNormal: new Vector3(-0.942, 0, 0.337), distance: 340.00, curvatureDeg: 8.56 },
  { position: new Vector3(125.18, 0.05, 67.46), tangent: new Vector3(-0.189, 0, -0.982), rightNormal: new Vector3(-0.982, 0, 0.189), distance: 343.33, curvatureDeg: 9.02 },
  { position: new Vector3(124.81, 0.05, 64.14), tangent: new Vector3(-0.067, 0, -0.998), rightNormal: new Vector3(-0.998, 0, 0.067), distance: 346.67, curvatureDeg: 5.05 },
  { position: new Vector3(124.73, 0.05, 60.81), tangent: new Vector3(0.015, 0, -1.000), rightNormal: new Vector3(-1.000, 0, -0.015), distance: 350.00, curvatureDeg: 4.40 },
  { position: new Vector3(124.91, 0.05, 57.49), tangent: new Vector3(0.088, 0, -0.996), rightNormal: new Vector3(-0.996, 0, -0.088), distance: 353.33, curvatureDeg: 3.88 },
  { position: new Vector3(125.31, 0.05, 54.18), tangent: new Vector3(0.151, 0, -0.989), rightNormal: new Vector3(-0.989, 0, -0.151), distance: 356.67, curvatureDeg: 3.46 },
  { position: new Vector3(125.92, 0.05, 50.90), tangent: new Vector3(0.208, 0, -0.978), rightNormal: new Vector3(-0.978, 0, -0.208), distance: 360.00, curvatureDeg: 3.11 },
  { position: new Vector3(126.70, 0.05, 47.66), tangent: new Vector3(0.258, 0, -0.966), rightNormal: new Vector3(-0.966, 0, -0.258), distance: 363.33, curvatureDeg: 2.83 },
  { position: new Vector3(127.63, 0.05, 44.46), tangent: new Vector3(0.304, 0, -0.953), rightNormal: new Vector3(-0.953, 0, -0.304), distance: 366.67, curvatureDeg: 2.62 },
  { position: new Vector3(128.72, 0.05, 41.31), tangent: new Vector3(0.347, 0, -0.938), rightNormal: new Vector3(-0.938, 0, -0.347), distance: 370.00, curvatureDeg: 2.69 },
  { position: new Vector3(129.95, 0.05, 38.21), tangent: new Vector3(0.415, 0, -0.910), rightNormal: new Vector3(-0.910, 0, -0.415), distance: 373.33, curvatureDeg: 5.74 },
  { position: new Vector3(131.48, 0.05, 35.25), tangent: new Vector3(0.501, 0, -0.865), rightNormal: new Vector3(-0.865, 0, -0.501), distance: 376.67, curvatureDeg: 5.35 },
  { position: new Vector3(133.29, 0.05, 32.45), tangent: new Vector3(0.568, 0, -0.823), rightNormal: new Vector3(-0.823, 0, -0.568), distance: 380.00, curvatureDeg: 3.70 },
  { position: new Vector3(135.27, 0.05, 29.77), tangent: new Vector3(0.610, 0, -0.793), rightNormal: new Vector3(-0.793, 0, -0.610), distance: 383.33, curvatureDeg: 2.20 },
  { position: new Vector3(137.35, 0.05, 27.17), tangent: new Vector3(0.631, 0, -0.776), rightNormal: new Vector3(-0.776, 0, -0.631), distance: 386.67, curvatureDeg: 0.90 },
  { position: new Vector3(139.47, 0.05, 24.60), tangent: new Vector3(0.635, 0, -0.773), rightNormal: new Vector3(-0.773, 0, -0.635), distance: 390.00, curvatureDeg: 0.31 },
  { position: new Vector3(141.58, 0.05, 22.02), tangent: new Vector3(0.622, 0, -0.783), rightNormal: new Vector3(-0.783, 0, -0.622), distance: 393.33, curvatureDeg: 1.51 },
  { position: new Vector3(143.62, 0.05, 19.38), tangent: new Vector3(0.593, 0, -0.805), rightNormal: new Vector3(-0.805, 0, -0.593), distance: 396.67, curvatureDeg: 2.76 },
  { position: new Vector3(145.53, 0.05, 16.65), tangent: new Vector3(0.543, 0, -0.839), rightNormal: new Vector3(-0.839, 0, -0.543), distance: 400.00, curvatureDeg: 4.13 },
  { position: new Vector3(147.24, 0.05, 13.79), tangent: new Vector3(0.485, 0, -0.875), rightNormal: new Vector3(-0.875, 0, -0.485), distance: 403.33, curvatureDeg: 3.75 },
  { position: new Vector3(148.76, 0.05, 10.82), tangent: new Vector3(0.445, 0, -0.896), rightNormal: new Vector3(-0.896, 0, -0.445), distance: 406.67, curvatureDeg: 1.44 },
  { position: new Vector3(150.20, 0.05, 7.82), tangent: new Vector3(0.422, 0, -0.907), rightNormal: new Vector3(-0.907, 0, -0.422), distance: 410.00, curvatureDeg: 1.45 },
  { position: new Vector3(151.57, 0.05, 4.78), tangent: new Vector3(0.398, 0, -0.917), rightNormal: new Vector3(-0.917, 0, -0.398), distance: 413.33, curvatureDeg: 1.51 },
  { position: new Vector3(152.86, 0.05, 1.70), tangent: new Vector3(0.374, 0, -0.928), rightNormal: new Vector3(-0.928, 0, -0.374), distance: 416.67, curvatureDeg: 1.54 },
  { position: new Vector3(154.06, 0.05, -1.40), tangent: new Vector3(0.348, 0, -0.937), rightNormal: new Vector3(-0.937, 0, -0.348), distance: 420.00, curvatureDeg: 1.58 },
  { position: new Vector3(155.18, 0.05, -4.54), tangent: new Vector3(0.322, 0, -0.947), rightNormal: new Vector3(-0.947, 0, -0.322), distance: 423.33, curvatureDeg: 1.60 },
  { position: new Vector3(156.21, 0.05, -7.72), tangent: new Vector3(0.295, 0, -0.955), rightNormal: new Vector3(-0.955, 0, -0.295), distance: 426.67, curvatureDeg: 1.62 },
  { position: new Vector3(157.15, 0.05, -10.91), tangent: new Vector3(0.268, 0, -0.963), rightNormal: new Vector3(-0.963, 0, -0.268), distance: 430.00, curvatureDeg: 1.63 },
  { position: new Vector3(158.00, 0.05, -14.14), tangent: new Vector3(0.241, 0, -0.971), rightNormal: new Vector3(-0.971, 0, -0.241), distance: 433.33, curvatureDeg: 1.64 },
  { position: new Vector3(158.75, 0.05, -17.38), tangent: new Vector3(0.209, 0, -0.978), rightNormal: new Vector3(-0.978, 0, -0.209), distance: 436.67, curvatureDeg: 2.07 },
  { position: new Vector3(159.39, 0.05, -20.65), tangent: new Vector3(0.174, 0, -0.985), rightNormal: new Vector3(-0.985, 0, -0.174), distance: 440.00, curvatureDeg: 2.01 },
  { position: new Vector3(159.91, 0.05, -23.95), tangent: new Vector3(0.142, 0, -0.990), rightNormal: new Vector3(-0.990, 0, -0.142), distance: 443.33, curvatureDeg: 1.70 },
  { position: new Vector3(160.34, 0.05, -27.25), tangent: new Vector3(0.115, 0, -0.993), rightNormal: new Vector3(-0.993, 0, -0.115), distance: 446.67, curvatureDeg: 1.43 },
  { position: new Vector3(160.68, 0.05, -30.57), tangent: new Vector3(0.092, 0, -0.996), rightNormal: new Vector3(-0.996, 0, -0.092), distance: 450.00, curvatureDeg: 1.17 },
  { position: new Vector3(160.95, 0.05, -33.89), tangent: new Vector3(0.074, 0, -0.997), rightNormal: new Vector3(-0.997, 0, -0.074), distance: 453.33, curvatureDeg: 0.93 },
  { position: new Vector3(161.17, 0.05, -37.22), tangent: new Vector3(0.060, 0, -0.998), rightNormal: new Vector3(-0.998, 0, -0.060), distance: 456.67, curvatureDeg: 0.71 },
  { position: new Vector3(161.35, 0.05, -40.55), tangent: new Vector3(0.049, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.049), distance: 460.00, curvatureDeg: 0.51 },
  { position: new Vector3(161.50, 0.05, -43.88), tangent: new Vector3(0.042, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.042), distance: 463.33, curvatureDeg: 0.31 },
  { position: new Vector3(161.63, 0.05, -47.21), tangent: new Vector3(0.038, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.038), distance: 466.67, curvatureDeg: 0.13 },
  { position: new Vector3(161.76, 0.05, -50.54), tangent: new Vector3(0.038, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.038), distance: 470.00, curvatureDeg: 0.06 },
  { position: new Vector3(161.88, 0.05, -53.87), tangent: new Vector3(0.040, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.040), distance: 473.33, curvatureDeg: 0.21 },
  { position: new Vector3(162.02, 0.05, -57.20), tangent: new Vector3(0.042, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.042), distance: 476.67, curvatureDeg: 0.04 },
  { position: new Vector3(162.17, 0.05, -60.53), tangent: new Vector3(0.042, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.042), distance: 480.00, curvatureDeg: 0.10 },
  { position: new Vector3(162.30, 0.05, -63.86), tangent: new Vector3(0.039, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.039), distance: 483.33, curvatureDeg: 0.19 },
  { position: new Vector3(162.43, 0.05, -67.19), tangent: new Vector3(0.035, 0, -0.999), rightNormal: new Vector3(-0.999, 0, -0.035), distance: 486.67, curvatureDeg: 0.27 },
  { position: new Vector3(162.54, 0.05, -70.52), tangent: new Vector3(0.030, 0, -1.000), rightNormal: new Vector3(-1.000, 0, -0.030), distance: 490.00, curvatureDeg: 0.36 },
  { position: new Vector3(162.62, 0.05, -73.85), tangent: new Vector3(0.023, 0, -1.000), rightNormal: new Vector3(-1.000, 0, -0.023), distance: 493.33, curvatureDeg: 0.44 },
  { position: new Vector3(162.69, 0.05, -77.19), tangent: new Vector3(0.014, 0, -1.000), rightNormal: new Vector3(-1.000, 0, -0.014), distance: 496.67, curvatureDeg: 0.52 },
  { position: new Vector3(162.72, 0.05, -80.52), tangent: new Vector3(0.004, 0, -1.000), rightNormal: new Vector3(-1.000, 0, -0.004), distance: 500.00, curvatureDeg: 0.61 },
  { position: new Vector3(162.72, 0.05, -83.85), tangent: new Vector3(-0.007, 0, -1.000), rightNormal: new Vector3(-1.000, 0, 0.007), distance: 503.33, curvatureDeg: 0.70 },
  { position: new Vector3(162.67, 0.05, -87.19), tangent: new Vector3(-0.020, 0, -1.000), rightNormal: new Vector3(-1.000, 0, 0.020), distance: 506.67, curvatureDeg: 0.81 },
  { position: new Vector3(162.58, 0.05, -90.52), tangent: new Vector3(-0.035, 0, -0.999), rightNormal: new Vector3(-0.999, 0, 0.035), distance: 510.00, curvatureDeg: 0.89 },
  { position: new Vector3(162.44, 0.05, -93.85), tangent: new Vector3(-0.052, 0, -0.999), rightNormal: new Vector3(-0.999, 0, 0.052), distance: 513.33, curvatureDeg: 1.02 },
  { position: new Vector3(162.24, 0.05, -97.18), tangent: new Vector3(-0.070, 0, -0.998), rightNormal: new Vector3(-0.998, 0, 0.070), distance: 516.67, curvatureDeg: 1.12 },
  { position: new Vector3(161.97, 0.05, -100.50), tangent: new Vector3(-0.086, 0, -0.996), rightNormal: new Vector3(-0.996, 0, 0.086), distance: 520.00, curvatureDeg: 0.71 },
  { position: new Vector3(161.66, 0.05, -103.82), tangent: new Vector3(-0.095, 0, -0.996), rightNormal: new Vector3(-0.996, 0, 0.095), distance: 523.33, curvatureDeg: 0.27 },
  { position: new Vector3(161.34, 0.05, -107.13), tangent: new Vector3(-0.101, 0, -0.995), rightNormal: new Vector3(-0.995, 0, 0.101), distance: 526.67, curvatureDeg: 0.42 },
  { position: new Vector3(160.99, 0.05, -110.45), tangent: new Vector3(-0.109, 0, -0.994), rightNormal: new Vector3(-0.994, 0, 0.109), distance: 530.00, curvatureDeg: 0.58 },
  { position: new Vector3(160.61, 0.05, -113.76), tangent: new Vector3(-0.121, 0, -0.993), rightNormal: new Vector3(-0.993, 0, 0.121), distance: 533.33, curvatureDeg: 0.73 },
  { position: new Vector3(160.19, 0.05, -117.07), tangent: new Vector3(-0.135, 0, -0.991), rightNormal: new Vector3(-0.991, 0, 0.135), distance: 536.67, curvatureDeg: 0.90 },
  { position: new Vector3(159.71, 0.05, -120.37), tangent: new Vector3(-0.152, 0, -0.988), rightNormal: new Vector3(-0.988, 0, 0.152), distance: 540.00, curvatureDeg: 1.05 },
  { position: new Vector3(159.18, 0.05, -123.66), tangent: new Vector3(-0.171, 0, -0.985), rightNormal: new Vector3(-0.985, 0, 0.171), distance: 543.33, curvatureDeg: 1.23 },
  { position: new Vector3(158.57, 0.05, -126.93), tangent: new Vector3(-0.194, 0, -0.981), rightNormal: new Vector3(-0.981, 0, 0.194), distance: 546.67, curvatureDeg: 1.40 },
  { position: new Vector3(157.88, 0.05, -130.20), tangent: new Vector3(-0.219, 0, -0.976), rightNormal: new Vector3(-0.976, 0, 0.219), distance: 550.00, curvatureDeg: 1.57 },
  { position: new Vector3(157.11, 0.05, -133.44), tangent: new Vector3(-0.248, 0, -0.969), rightNormal: new Vector3(-0.969, 0, 0.248), distance: 553.33, curvatureDeg: 1.78 },
  { position: new Vector3(156.23, 0.05, -136.65), tangent: new Vector3(-0.279, 0, -0.960), rightNormal: new Vector3(-0.960, 0, 0.279), distance: 556.67, curvatureDeg: 1.95 },
  { position: new Vector3(155.25, 0.05, -139.84), tangent: new Vector3(-0.313, 0, -0.950), rightNormal: new Vector3(-0.950, 0, 0.313), distance: 560.00, curvatureDeg: 2.13 },
  { position: new Vector3(154.14, 0.05, -142.98), tangent: new Vector3(-0.343, 0, -0.939), rightNormal: new Vector3(-0.939, 0, 0.343), distance: 563.33, curvatureDeg: 1.52 },
  { position: new Vector3(152.96, 0.05, -146.10), tangent: new Vector3(-0.363, 0, -0.932), rightNormal: new Vector3(-0.932, 0, 0.363), distance: 566.67, curvatureDeg: 0.84 },
  { position: new Vector3(151.73, 0.05, -149.20), tangent: new Vector3(-0.378, 0, -0.926), rightNormal: new Vector3(-0.926, 0, 0.378), distance: 570.00, curvatureDeg: 1.01 },
  { position: new Vector3(150.44, 0.05, -152.27), tangent: new Vector3(-0.395, 0, -0.919), rightNormal: new Vector3(-0.919, 0, 0.395), distance: 573.33, curvatureDeg: 1.14 },
  { position: new Vector3(149.10, 0.05, -155.32), tangent: new Vector3(-0.414, 0, -0.910), rightNormal: new Vector3(-0.910, 0, 0.414), distance: 576.67, curvatureDeg: 1.33 },
  { position: new Vector3(147.68, 0.05, -158.34), tangent: new Vector3(-0.437, 0, -0.900), rightNormal: new Vector3(-0.900, 0, 0.437), distance: 580.00, curvatureDeg: 1.49 },
  { position: new Vector3(146.18, 0.05, -161.32), tangent: new Vector3(-0.462, 0, -0.887), rightNormal: new Vector3(-0.887, 0, 0.462), distance: 583.33, curvatureDeg: 1.69 },
  { position: new Vector3(144.60, 0.05, -164.25), tangent: new Vector3(-0.489, 0, -0.872), rightNormal: new Vector3(-0.872, 0, 0.489), distance: 586.67, curvatureDeg: 1.94 },
  { position: new Vector3(142.92, 0.05, -167.13), tangent: new Vector3(-0.520, 0, -0.854), rightNormal: new Vector3(-0.854, 0, 0.520), distance: 590.00, curvatureDeg: 2.17 },
  { position: new Vector3(141.13, 0.05, -169.94), tangent: new Vector3(-0.555, 0, -0.832), rightNormal: new Vector3(-0.832, 0, 0.555), distance: 593.33, curvatureDeg: 2.52 },
  { position: new Vector3(139.22, 0.05, -172.67), tangent: new Vector3(-0.593, 0, -0.805), rightNormal: new Vector3(-0.805, 0, 0.593), distance: 596.67, curvatureDeg: 2.82 },
  { position: new Vector3(137.18, 0.05, -175.31), tangent: new Vector3(-0.635, 0, -0.772), rightNormal: new Vector3(-0.772, 0, 0.635), distance: 600.00, curvatureDeg: 3.28 },
  { position: new Vector3(134.99, 0.05, -177.82), tangent: new Vector3(-0.681, 0, -0.732), rightNormal: new Vector3(-0.732, 0, 0.681), distance: 603.33, curvatureDeg: 3.70 },
  { position: new Vector3(132.64, 0.05, -180.19), tangent: new Vector3(-0.729, 0, -0.685), rightNormal: new Vector3(-0.685, 0, 0.729), distance: 606.67, curvatureDeg: 4.06 },
  { position: new Vector3(130.14, 0.05, -182.38), tangent: new Vector3(-0.774, 0, -0.633), rightNormal: new Vector3(-0.633, 0, 0.774), distance: 610.00, curvatureDeg: 3.72 },
  { position: new Vector3(127.49, 0.05, -184.41), tangent: new Vector3(-0.811, 0, -0.585), rightNormal: new Vector3(-0.585, 0, 0.811), distance: 613.33, curvatureDeg: 3.26 },
  { position: new Vector3(124.73, 0.05, -186.28), tangent: new Vector3(-0.841, 0, -0.541), rightNormal: new Vector3(-0.541, 0, 0.841), distance: 616.67, curvatureDeg: 2.90 },
  { position: new Vector3(121.88, 0.05, -188.01), tangent: new Vector3(-0.866, 0, -0.500), rightNormal: new Vector3(-0.500, 0, 0.866), distance: 620.00, curvatureDeg: 2.63 },
  { position: new Vector3(118.96, 0.05, -189.61), tangent: new Vector3(-0.887, 0, -0.461), rightNormal: new Vector3(-0.461, 0, 0.887), distance: 623.33, curvatureDeg: 2.39 },
  { position: new Vector3(115.97, 0.05, -191.08), tangent: new Vector3(-0.905, 0, -0.425), rightNormal: new Vector3(-0.425, 0, 0.905), distance: 626.67, curvatureDeg: 2.20 },
  { position: new Vector3(112.93, 0.05, -192.44), tangent: new Vector3(-0.920, 0, -0.391), rightNormal: new Vector3(-0.391, 0, 0.920), distance: 630.00, curvatureDeg: 2.08 },
  { position: new Vector3(109.84, 0.05, -193.69), tangent: new Vector3(-0.933, 0, -0.359), rightNormal: new Vector3(-0.359, 0, 0.933), distance: 633.33, curvatureDeg: 1.94 },
  { position: new Vector3(106.71, 0.05, -194.84), tangent: new Vector3(-0.945, 0, -0.327), rightNormal: new Vector3(-0.327, 0, 0.945), distance: 636.67, curvatureDeg: 1.88 },
  { position: new Vector3(103.54, 0.05, -195.88), tangent: new Vector3(-0.955, 0, -0.297), rightNormal: new Vector3(-0.297, 0, 0.955), distance: 640.00, curvatureDeg: 1.83 },
  { position: new Vector3(100.34, 0.05, -196.81), tangent: new Vector3(-0.964, 0, -0.266), rightNormal: new Vector3(-0.266, 0, 0.964), distance: 643.33, curvatureDeg: 1.81 },
  { position: new Vector3(97.11, 0.05, -197.65), tangent: new Vector3(-0.972, 0, -0.235), rightNormal: new Vector3(-0.235, 0, 0.972), distance: 646.67, curvatureDeg: 1.84 },
  { position: new Vector3(93.86, 0.05, -198.38), tangent: new Vector3(-0.979, 0, -0.203), rightNormal: new Vector3(-0.203, 0, 0.979), distance: 650.00, curvatureDeg: 1.91 },
  { position: new Vector3(90.59, 0.05, -199.01), tangent: new Vector3(-0.986, 0, -0.168), rightNormal: new Vector3(-0.168, 0, 0.986), distance: 653.33, curvatureDeg: 2.20 },
  { position: new Vector3(87.29, 0.05, -199.50), tangent: new Vector3(-0.992, 0, -0.130), rightNormal: new Vector3(-0.130, 0, 0.992), distance: 656.67, curvatureDeg: 2.22 },
  { position: new Vector3(83.98, 0.05, -199.87), tangent: new Vector3(-0.996, 0, -0.092), rightNormal: new Vector3(-0.092, 0, 0.996), distance: 660.00, curvatureDeg: 2.15 },
  { position: new Vector3(80.66, 0.05, -200.12), tangent: new Vector3(-0.998, 0, -0.055), rightNormal: new Vector3(-0.055, 0, 0.998), distance: 663.33, curvatureDeg: 2.11 },
  { position: new Vector3(77.32, 0.05, -200.24), tangent: new Vector3(-1.000, 0, -0.019), rightNormal: new Vector3(-0.019, 0, 1.000), distance: 666.67, curvatureDeg: 2.06 },
  { position: new Vector3(73.99, 0.05, -200.24), tangent: new Vector3(-1.000, 0, 0.017), rightNormal: new Vector3(0.017, 0, 1.000), distance: 670.00, curvatureDeg: 2.05 },
  { position: new Vector3(70.66, 0.05, -200.13), tangent: new Vector3(-0.999, 0, 0.053), rightNormal: new Vector3(0.053, 0, 0.999), distance: 673.33, curvatureDeg: 2.08 },
  { position: new Vector3(67.34, 0.05, -199.89), tangent: new Vector3(-0.996, 0, 0.090), rightNormal: new Vector3(0.090, 0, 0.996), distance: 676.67, curvatureDeg: 2.11 },
  { position: new Vector3(64.02, 0.05, -199.53), tangent: new Vector3(-0.992, 0, 0.127), rightNormal: new Vector3(0.127, 0, 0.992), distance: 680.00, curvatureDeg: 2.15 },
  { position: new Vector3(60.72, 0.05, -199.04), tangent: new Vector3(-0.986, 0, 0.164), rightNormal: new Vector3(0.164, 0, 0.986), distance: 683.33, curvatureDeg: 2.22 },
  { position: new Vector3(57.45, 0.05, -198.43), tangent: new Vector3(-0.979, 0, 0.203), rightNormal: new Vector3(0.203, 0, 0.979), distance: 686.67, curvatureDeg: 2.31 },
  { position: new Vector3(54.20, 0.05, -197.69), tangent: new Vector3(-0.970, 0, 0.244), rightNormal: new Vector3(0.244, 0, 0.970), distance: 690.00, curvatureDeg: 2.44 },
  { position: new Vector3(50.98, 0.05, -196.81), tangent: new Vector3(-0.956, 0, 0.292), rightNormal: new Vector3(0.292, 0, 0.956), distance: 693.33, curvatureDeg: 3.37 },
  { position: new Vector3(47.83, 0.05, -195.74), tangent: new Vector3(-0.933, 0, 0.359), rightNormal: new Vector3(0.359, 0, 0.933), distance: 696.67, curvatureDeg: 4.68 },
  { position: new Vector3(44.77, 0.05, -194.42), tangent: new Vector3(-0.904, 0, 0.427), rightNormal: new Vector3(0.427, 0, 0.904), distance: 700.00, curvatureDeg: 3.84 },
  { position: new Vector3(41.80, 0.05, -192.90), tangent: new Vector3(-0.877, 0, 0.481), rightNormal: new Vector3(0.481, 0, 0.877), distance: 703.33, curvatureDeg: 3.04 },
  { position: new Vector3(38.92, 0.05, -191.22), tangent: new Vector3(-0.854, 0, 0.521), rightNormal: new Vector3(0.521, 0, 0.854), distance: 706.67, curvatureDeg: 2.28 },
  { position: new Vector3(36.11, 0.05, -189.42), tangent: new Vector3(-0.835, 0, 0.550), rightNormal: new Vector3(0.550, 0, 0.835), distance: 710.00, curvatureDeg: 1.65 },
  { position: new Vector3(33.36, 0.05, -187.55), tangent: new Vector3(-0.822, 0, 0.570), rightNormal: new Vector3(0.570, 0, 0.822), distance: 713.33, curvatureDeg: 1.06 },
  { position: new Vector3(30.64, 0.05, -185.63), tangent: new Vector3(-0.814, 0, 0.581), rightNormal: new Vector3(0.581, 0, 0.814), distance: 716.67, curvatureDeg: 0.52 },
  { position: new Vector3(27.93, 0.05, -183.68), tangent: new Vector3(-0.812, 0, 0.584), rightNormal: new Vector3(0.584, 0, 0.812), distance: 720.00, curvatureDeg: 0.03 },
  { position: new Vector3(25.23, 0.05, -181.73), tangent: new Vector3(-0.815, 0, 0.580), rightNormal: new Vector3(0.580, 0, 0.815), distance: 723.33, curvatureDeg: 0.59 },
  { position: new Vector3(22.50, 0.05, -179.81), tangent: new Vector3(-0.824, 0, 0.567), rightNormal: new Vector3(0.567, 0, 0.824), distance: 726.67, curvatureDeg: 1.21 },
  { position: new Vector3(19.73, 0.05, -177.95), tangent: new Vector3(-0.839, 0, 0.544), rightNormal: new Vector3(0.544, 0, 0.839), distance: 730.00, curvatureDeg: 1.92 },
  { position: new Vector3(16.91, 0.05, -176.19), tangent: new Vector3(-0.861, 0, 0.509), rightNormal: new Vector3(0.509, 0, 0.861), distance: 733.33, curvatureDeg: 2.79 },
  { position: new Vector3(14.00, 0.05, -174.56), tangent: new Vector3(-0.886, 0, 0.464), rightNormal: new Vector3(0.464, 0, 0.886), distance: 736.67, curvatureDeg: 3.19 },
  { position: new Vector3(11.00, 0.05, -173.09), tangent: new Vector3(-0.906, 0, 0.423), rightNormal: new Vector3(0.423, 0, 0.906), distance: 740.00, curvatureDeg: 2.08 },
  { position: new Vector3(7.96, 0.05, -171.74), tangent: new Vector3(-0.920, 0, 0.393), rightNormal: new Vector3(0.393, 0, 0.920), distance: 743.33, curvatureDeg: 1.64 },
  { position: new Vector3(4.88, 0.05, -170.48), tangent: new Vector3(-0.929, 0, 0.370), rightNormal: new Vector3(0.370, 0, 0.929), distance: 746.67, curvatureDeg: 1.21 },
  { position: new Vector3(1.77, 0.05, -169.28), tangent: new Vector3(-0.935, 0, 0.354), rightNormal: new Vector3(0.354, 0, 0.935), distance: 750.00, curvatureDeg: 0.76 },
  { position: new Vector3(-1.36, 0.05, -168.12), tangent: new Vector3(-0.939, 0, 0.345), rightNormal: new Vector3(0.345, 0, 0.939), distance: 753.33, curvatureDeg: 0.29 },
  { position: new Vector3(-4.49, 0.05, -166.97), tangent: new Vector3(-0.939, 0, 0.345), rightNormal: new Vector3(0.345, 0, 0.939), distance: 756.67, curvatureDeg: 0.24 },
  { position: new Vector3(-7.62, 0.05, -165.82), tangent: new Vector3(-0.935, 0, 0.353), rightNormal: new Vector3(0.353, 0, 0.935), distance: 760.00, curvatureDeg: 0.82 },
  { position: new Vector3(-10.73, 0.05, -164.62), tangent: new Vector3(-0.928, 0, 0.372), rightNormal: new Vector3(0.372, 0, 0.928), distance: 763.33, curvatureDeg: 1.51 },
  { position: new Vector3(-13.80, 0.05, -163.34), tangent: new Vector3(-0.915, 0, 0.403), rightNormal: new Vector3(0.403, 0, 0.915), distance: 766.67, curvatureDeg: 2.30 },
  { position: new Vector3(-16.83, 0.05, -161.93), tangent: new Vector3(-0.901, 0, 0.435), rightNormal: new Vector3(0.435, 0, 0.901), distance: 770.00, curvatureDeg: 1.69 },
  { position: new Vector3(-19.81, 0.05, -160.44), tangent: new Vector3(-0.891, 0, 0.454), rightNormal: new Vector3(0.454, 0, 0.891), distance: 773.33, curvatureDeg: 0.82 },
  { position: new Vector3(-22.77, 0.05, -158.90), tangent: new Vector3(-0.883, 0, 0.470), rightNormal: new Vector3(0.470, 0, 0.883), distance: 776.67, curvatureDeg: 1.21 },
  { position: new Vector3(-25.69, 0.05, -157.30), tangent: new Vector3(-0.871, 0, 0.492), rightNormal: new Vector3(0.492, 0, 0.871), distance: 780.00, curvatureDeg: 1.61 },
  { position: new Vector3(-28.57, 0.05, -155.62), tangent: new Vector3(-0.855, 0, 0.518), rightNormal: new Vector3(0.518, 0, 0.855), distance: 783.33, curvatureDeg: 1.95 },
  { position: new Vector3(-31.39, 0.05, -153.85), tangent: new Vector3(-0.836, 0, 0.549), rightNormal: new Vector3(0.549, 0, 0.836), distance: 786.67, curvatureDeg: 2.16 },
  { position: new Vector3(-34.14, 0.05, -151.97), tangent: new Vector3(-0.815, 0, 0.580), rightNormal: new Vector3(0.580, 0, 0.815), distance: 790.00, curvatureDeg: 2.12 },
  { position: new Vector3(-36.82, 0.05, -149.98), tangent: new Vector3(-0.798, 0, 0.603), rightNormal: new Vector3(0.603, 0, 0.798), distance: 793.33, curvatureDeg: 1.24 },
  { position: new Vector3(-39.46, 0.05, -147.94), tangent: new Vector3(-0.784, 0, 0.621), rightNormal: new Vector3(0.621, 0, 0.784), distance: 796.67, curvatureDeg: 1.32 },
  { position: new Vector3(-42.05, 0.05, -145.85), tangent: new Vector3(-0.767, 0, 0.641), rightNormal: new Vector3(0.641, 0, 0.767), distance: 800.00, curvatureDeg: 1.66 },
  { position: new Vector3(-44.57, 0.05, -143.67), tangent: new Vector3(-0.747, 0, 0.665), rightNormal: new Vector3(0.665, 0, 0.747), distance: 803.33, curvatureDeg: 2.02 },
  { position: new Vector3(-47.02, 0.05, -141.41), tangent: new Vector3(-0.720, 0, 0.694), rightNormal: new Vector3(0.694, 0, 0.720), distance: 806.67, curvatureDeg: 2.43 },
  { position: new Vector3(-49.37, 0.05, -139.05), tangent: new Vector3(-0.687, 0, 0.727), rightNormal: new Vector3(0.727, 0, 0.687), distance: 810.00, curvatureDeg: 2.90 },
  { position: new Vector3(-51.60, 0.05, -136.57), tangent: new Vector3(-0.646, 0, 0.763), rightNormal: new Vector3(0.763, 0, 0.646), distance: 813.33, curvatureDeg: 3.44 },
  { position: new Vector3(-53.68, 0.05, -133.96), tangent: new Vector3(-0.603, 0, 0.798), rightNormal: new Vector3(0.798, 0, 0.603), distance: 816.67, curvatureDeg: 2.80 },
  { position: new Vector3(-55.62, 0.05, -131.25), tangent: new Vector3(-0.569, 0, 0.822), rightNormal: new Vector3(0.822, 0, 0.569), distance: 820.00, curvatureDeg: 2.03 },
  { position: new Vector3(-57.47, 0.05, -128.48), tangent: new Vector3(-0.538, 0, 0.843), rightNormal: new Vector3(0.843, 0, 0.538), distance: 823.33, curvatureDeg: 2.32 },
  { position: new Vector3(-59.20, 0.05, -125.63), tangent: new Vector3(-0.500, 0, 0.866), rightNormal: new Vector3(0.866, 0, 0.500), distance: 826.67, curvatureDeg: 2.69 },
  { position: new Vector3(-60.80, 0.05, -122.71), tangent: new Vector3(-0.455, 0, 0.891), rightNormal: new Vector3(0.891, 0, 0.455), distance: 830.00, curvatureDeg: 3.20 },
  { position: new Vector3(-62.24, 0.05, -119.70), tangent: new Vector3(-0.399, 0, 0.917), rightNormal: new Vector3(0.917, 0, 0.399), distance: 833.33, curvatureDeg: 3.90 },
  { position: new Vector3(-63.46, 0.05, -116.60), tangent: new Vector3(-0.328, 0, 0.945), rightNormal: new Vector3(0.945, 0, 0.328), distance: 836.67, curvatureDeg: 4.86 },
  { position: new Vector3(-64.42, 0.05, -113.41), tangent: new Vector3(-0.237, 0, 0.972), rightNormal: new Vector3(0.972, 0, 0.237), distance: 840.00, curvatureDeg: 6.00 },
  { position: new Vector3(-65.04, 0.05, -110.14), tangent: new Vector3(-0.138, 0, 0.990), rightNormal: new Vector3(0.990, 0, 0.138), distance: 843.33, curvatureDeg: 5.54 },
  { position: new Vector3(-65.34, 0.05, -106.82), tangent: new Vector3(-0.049, 0, 0.999), rightNormal: new Vector3(0.999, 0, 0.049), distance: 846.67, curvatureDeg: 4.67 },
  { position: new Vector3(-65.36, 0.05, -103.48), tangent: new Vector3(0.028, 0, 1.000), rightNormal: new Vector3(1.000, 0, -0.028), distance: 850.00, curvatureDeg: 4.24 },
  { position: new Vector3(-65.15, 0.05, -100.16), tangent: new Vector3(0.102, 0, 0.995), rightNormal: new Vector3(0.995, 0, -0.102), distance: 853.33, curvatureDeg: 4.19 },
  { position: new Vector3(-64.69, 0.05, -96.86), tangent: new Vector3(0.176, 0, 0.984), rightNormal: new Vector3(0.984, 0, -0.176), distance: 856.67, curvatureDeg: 4.42 },
  { position: new Vector3(-63.97, 0.05, -93.60), tangent: new Vector3(0.257, 0, 0.966), rightNormal: new Vector3(0.966, 0, -0.257), distance: 860.00, curvatureDeg: 5.12 },
  { position: new Vector3(-62.97, 0.05, -90.42), tangent: new Vector3(0.356, 0, 0.934), rightNormal: new Vector3(0.934, 0, -0.356), distance: 863.33, curvatureDeg: 6.78 },
  { position: new Vector3(-61.60, 0.05, -87.39), tangent: new Vector3(0.474, 0, 0.880), rightNormal: new Vector3(0.880, 0, -0.474), distance: 866.67, curvatureDeg: 8.15 },
  { position: new Vector3(-59.82, 0.05, -84.58), tangent: new Vector3(0.585, 0, 0.811), rightNormal: new Vector3(0.811, 0, -0.585), distance: 870.00, curvatureDeg: 6.77 },
  { position: new Vector3(-57.72, 0.05, -81.99), tangent: new Vector3(0.664, 0, 0.747), rightNormal: new Vector3(0.747, 0, -0.664), distance: 873.33, curvatureDeg: 4.93 },
  { position: new Vector3(-55.40, 0.05, -79.60), tangent: new Vector3(0.715, 0, 0.699), rightNormal: new Vector3(0.699, 0, -0.715), distance: 876.67, curvatureDeg: 3.15 },
  { position: new Vector3(-52.95, 0.05, -77.34), tangent: new Vector3(0.746, 0, 0.666), rightNormal: new Vector3(0.666, 0, -0.746), distance: 880.00, curvatureDeg: 2.02 },
  { position: new Vector3(-50.42, 0.05, -75.16), tangent: new Vector3(0.787, 0, 0.617), rightNormal: new Vector3(0.617, 0, -0.787), distance: 883.33, curvatureDeg: 5.24 },
  { position: new Vector3(-47.71, 0.05, -73.23), tangent: new Vector3(0.834, 0, 0.551), rightNormal: new Vector3(0.551, 0, -0.834), distance: 886.67, curvatureDeg: 4.08 },
  { position: new Vector3(-44.87, 0.05, -71.49), tangent: new Vector3(0.863, 0, 0.506), rightNormal: new Vector3(0.506, 0, -0.863), distance: 890.00, curvatureDeg: 2.05 },
  { position: new Vector3(-41.96, 0.05, -69.85), tangent: new Vector3(0.873, 0, 0.488), rightNormal: new Vector3(0.488, 0, -0.873), distance: 893.33, curvatureDeg: 0.35 },
  { position: new Vector3(-39.05, 0.05, -68.24), tangent: new Vector3(0.869, 0, 0.495), rightNormal: new Vector3(0.495, 0, -0.869), distance: 896.67, curvatureDeg: 1.33 },
  { position: new Vector3(-36.17, 0.05, -66.55), tangent: new Vector3(0.848, 0, 0.530), rightNormal: new Vector3(0.530, 0, -0.848), distance: 900.00, curvatureDeg: 3.31 },
  { position: new Vector3(-33.40, 0.05, -64.71), tangent: new Vector3(0.818, 0, 0.575), rightNormal: new Vector3(0.575, 0, -0.818), distance: 903.33, curvatureDeg: 2.81 },
  { position: new Vector3(-30.72, 0.05, -62.72), tangent: new Vector3(0.797, 0, 0.603), rightNormal: new Vector3(0.603, 0, -0.797), distance: 906.67, curvatureDeg: 1.27 },
  { position: new Vector3(-28.08, 0.05, -60.68), tangent: new Vector3(0.782, 0, 0.623), rightNormal: new Vector3(0.623, 0, -0.782), distance: 910.00, curvatureDeg: 1.60 },
  { position: new Vector3(-25.50, 0.05, -58.57), tangent: new Vector3(0.763, 0, 0.647), rightNormal: new Vector3(0.647, 0, -0.763), distance: 913.33, curvatureDeg: 1.90 },
  { position: new Vector3(-23.00, 0.05, -56.37), tangent: new Vector3(0.739, 0, 0.673), rightNormal: new Vector3(0.673, 0, -0.739), distance: 916.67, curvatureDeg: 2.15 },
  { position: new Vector3(-20.58, 0.05, -54.08), tangent: new Vector3(0.715, 0, 0.699), rightNormal: new Vector3(0.699, 0, -0.715), distance: 920.00, curvatureDeg: 1.90 },
  { position: new Vector3(-18.23, 0.05, -51.71), tangent: new Vector3(0.695, 0, 0.719), rightNormal: new Vector3(0.719, 0, -0.695), distance: 923.33, curvatureDeg: 1.42 },
  { position: new Vector3(-15.95, 0.05, -49.29), tangent: new Vector3(0.673, 0, 0.740), rightNormal: new Vector3(0.740, 0, -0.673), distance: 926.67, curvatureDeg: 1.97 },
  { position: new Vector3(-13.75, 0.05, -46.78), tangent: new Vector3(0.643, 0, 0.766), rightNormal: new Vector3(0.766, 0, -0.643), distance: 930.00, curvatureDeg: 2.61 },
  { position: new Vector3(-11.66, 0.05, -44.18), tangent: new Vector3(0.602, 0, 0.798), rightNormal: new Vector3(0.798, 0, -0.602), distance: 933.33, curvatureDeg: 3.33 },
  { position: new Vector3(-9.73, 0.05, -41.46), tangent: new Vector3(0.550, 0, 0.835), rightNormal: new Vector3(0.835, 0, -0.550), distance: 936.67, curvatureDeg: 4.06 },
  { position: new Vector3(-8.00, 0.05, -38.62), tangent: new Vector3(0.491, 0, 0.871), rightNormal: new Vector3(0.871, 0, -0.491), distance: 940.00, curvatureDeg: 3.81 },
  { position: new Vector3(-6.46, 0.05, -35.66), tangent: new Vector3(0.437, 0, 0.900), rightNormal: new Vector3(0.900, 0, -0.437), distance: 943.33, curvatureDeg: 3.19 },
  { position: new Vector3(-5.09, 0.05, -32.62), tangent: new Vector3(0.389, 0, 0.921), rightNormal: new Vector3(0.921, 0, -0.389), distance: 946.67, curvatureDeg: 2.78 },
  { position: new Vector3(-3.87, 0.05, -29.52), tangent: new Vector3(0.346, 0, 0.938), rightNormal: new Vector3(0.938, 0, -0.346), distance: 950.00, curvatureDeg: 2.55 },
  { position: new Vector3(-2.78, 0.05, -26.37), tangent: new Vector3(0.304, 0, 0.953), rightNormal: new Vector3(0.953, 0, -0.304), distance: 953.33, curvatureDeg: 2.58 },
  { position: new Vector3(-1.84, 0.05, -23.17), tangent: new Vector3(0.253, 0, 0.968), rightNormal: new Vector3(0.968, 0, -0.253), distance: 956.67, curvatureDeg: 3.51 },
  { position: new Vector3(-1.10, 0.05, -19.92), tangent: new Vector3(0.192, 0, 0.981), rightNormal: new Vector3(0.981, 0, -0.192), distance: 960.00, curvatureDeg: 3.65 },
  { position: new Vector3(-0.57, 0.05, -16.63), tangent: new Vector3(0.137, 0, 0.991), rightNormal: new Vector3(0.991, 0, -0.137), distance: 963.33, curvatureDeg: 2.78 },
  { position: new Vector3(-0.19, 0.05, -13.32), tangent: new Vector3(0.098, 0, 0.995), rightNormal: new Vector3(0.995, 0, -0.098), distance: 966.67, curvatureDeg: 1.71 },
  { position: new Vector3(0.08, 0.05, -10.00), tangent: new Vector3(0.061, 0, 0.998), rightNormal: new Vector3(0.998, 0, -0.061), distance: 970.00, curvatureDeg: 2.47 },
  { position: new Vector3(0.22, 0.05, -6.67), tangent: new Vector3(0.023, 0, 1.000), rightNormal: new Vector3(1.000, 0, -0.023), distance: 973.33, curvatureDeg: 1.97 },
  { position: new Vector3(0.23, 0.05, -3.34), tangent: new Vector3(-0.033, 0, 0.999), rightNormal: new Vector3(0.999, 0, 0.033), distance: 976.67, curvatureDeg: 4.33 },
];

// 294 centerline segments for silky-smooth barrier deflection & AI navigation
const forestValleyCenterline = forestValleyRoadSamples.map((s, idx) => {
  const next = forestValleyRoadSamples[(idx + 1) % forestValleyRoadSamples.length];
  return {
    id: idx,
    start: s.position.clone(),
    end: next.position.clone(),
  };
});

// 10 Sequential Timing Gates (14.8m wide gantry spanning the 13.0m wide road)
const forestValleyCheckpoints = [
  { id: 'CP_0_START_FINISH', order: 0, position: new Vector3(0.00, 0.05, 0.00), direction: new Vector3(0.000, 0, 1.000), width: 14.8 },
  { id: 'CP_1_NORTH_ENTRY', order: 1, position: new Vector3(0.28, 0.05, 86.63), direction: new Vector3(0.101, 0, 0.995), width: 14.8 },
  { id: 'CP_2_EAST_CHUTE', order: 2, position: new Vector3(45.65, 0.05, 158.28), direction: new Vector3(0.942, 0, 0.336), width: 14.8 },
  { id: 'CP_3_INFIELD_DESCENT', order: 3, position: new Vector3(123.01, 0.05, 143.22), direction: new Vector3(0.685, 0, -0.728), width: 14.8 },
  { id: 'CP_4_CAROUSEL_SHOOT', order: 4, position: new Vector3(126.06, 0.05, 70.67), direction: new Vector3(-0.337, 0, -0.942), width: 14.8 },
  { id: 'CP_5_BACK_STRAIGHT_LAUNCH', order: 5, position: new Vector3(160.68, 0.05, -30.57), direction: new Vector3(0.092, 0, -0.996), width: 14.8 },
  { id: 'CP_6_BACK_STRAIGHT_BRAKING', order: 6, position: new Vector3(147.68, 0.05, -158.34), direction: new Vector3(-0.437, 0, -0.900), width: 14.8 },
  { id: 'CP_7_ARENA_DRIFT_SWEEPER', order: 7, position: new Vector3(44.77, 0.05, -194.42), direction: new Vector3(-0.904, 0, 0.427), width: 14.8 },
  { id: 'CP_8_WEST_STRAIGHT_ENTRY', order: 8, position: new Vector3(-49.37, 0.05, -139.05), direction: new Vector3(-0.687, 0, 0.727), width: 14.8 },
  { id: 'CP_9_WEST_STRAIGHT_MID', order: 9, position: new Vector3(-36.17, 0.05, -66.55), direction: new Vector3(0.848, 0, 0.530), width: 14.8 },
];

const forestValleyEvents: RaceEventConfig[] = [
  {
    id: 'forest_loop_220m',
    mode: 'time_trial',
    name: 'Apex Circuit Time Trial',
    subtitle: 'Forest Valley Circuit • 980m Grand Course',
    badgeText: 'TIME ATTACK',
    lapsBadge: '1 LAP BENCHMARK',
    description:
      'Complete a timed lap around the 980-meter paved circuit with 10 sequential timing gates. High-speed straights, technical chicanes, and demanding sweepers test precision and momentum.',
    specs: {
      length: '980 M',
      sectors: '10 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(1.8, 0.05, -10.0),
    startYaw: 0,
    checkpointIds: [
      'CP_1_NORTH_ENTRY',
      'CP_2_EAST_CHUTE',
      'CP_3_INFIELD_DESCENT',
      'CP_4_CAROUSEL_SHOOT',
      'CP_5_BACK_STRAIGHT_LAUNCH',
      'CP_6_BACK_STRAIGHT_BRAKING',
      'CP_7_ARENA_DRIFT_SWEEPER',
      'CP_8_WEST_STRAIGHT_ENTRY',
      'CP_9_WEST_STRAIGHT_MID',
      'CP_0_START_FINISH',
    ],
    finishCheckpointId: 'CP_0_START_FINISH',
    mapType: 'loop',
  },
  {
    id: 'forest_sprint_130m',
    mode: 'sprint',
    name: 'Forest Sector Sprint',
    subtitle: 'Sector 1-4 Point-to-Point Sprint • 340m',
    badgeText: 'SPRINT RACE',
    lapsBadge: 'POINT TO POINT',
    description:
      'High-intensity 340-meter point-to-point sprint from the North main straight through the Eastern sweeper and technical chicane, concluding at the Carousel timing gantry.',
    specs: {
      length: '340 M',
      sectors: '4 GATES',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(1.8, 0.05, -10.0),
    startYaw: 0,
    checkpointIds: [
      'CP_1_NORTH_ENTRY',
      'CP_2_EAST_CHUTE',
      'CP_3_INFIELD_DESCENT',
      'CP_4_CAROUSEL_SHOOT',
    ],
    finishCheckpointId: 'CP_4_CAROUSEL_SHOOT',
    mapType: 'sprint',
  },
  {
    id: 'forest_drift_90s',
    mode: 'drift',
    name: 'Forest Drift Challenge',
    subtitle: 'Forest Valley Circuit • 90s Freestyle Arena',
    badgeText: 'DRIFT CHALLENGE',
    lapsBadge: '90s FREESTYLE',
    description:
      'A 90-second timed freestyle drift session across the expansive 13-meter asphalt. Initiate continuous high-angle slides through broad sweepers and chicane transitions.',
    specs: {
      length: '980 M',
      sectors: 'DRIFT ARENA',
      surface: 'ASPHALT',
    },
    startPosition: new Vector3(0, 0.05, -2.0),
    startYaw: 0,
    checkpointIds: [
      'CP_1_NORTH_ENTRY',
      'CP_2_EAST_CHUTE',
      'CP_3_INFIELD_DESCENT',
      'CP_4_CAROUSEL_SHOOT',
      'CP_5_BACK_STRAIGHT_LAUNCH',
      'CP_6_BACK_STRAIGHT_BRAKING',
      'CP_7_ARENA_DRIFT_SWEEPER',
      'CP_8_WEST_STRAIGHT_ENTRY',
      'CP_9_WEST_STRAIGHT_MID',
      'CP_0_START_FINISH',
    ],
    finishCheckpointId: '',
    mapType: 'drift',
  },
];

export const ForestValleyCircuit: CircuitDefinition = {
  id: 'forest_valley',
  name: 'Forest Valley Circuit',
  subtitle: 'Grand Motorsport Park • 980m Asphalt Loop',
  measuredLengthMeters: 980.0,
  tileCount: 98,
  description:
    'A premier 980-meter arcade motorsport circuit carved into dense alpine pine hills. Features broad 13-meter asphalt, the 160+ km/h Grand Back Straight, flowing chicane complexes, and the Arena Drift Sweeper.',
  surface: 'ASPHALT',
  roadSurfaceY: 0.05,
  startPosition: new Vector3(1.8, 0.05, -10.0),
  startYaw: 0,
  aiGridSlots: [
    { gridSlot: 1, position: new Vector3(-2.8, 0.05, 14.0), yaw: 0 },
    { gridSlot: 2, position: new Vector3(2.8, 0.05, 6.0), yaw: 0 },
    { gridSlot: 3, position: new Vector3(-2.8, 0.05, -2.0), yaw: 0 },
  ],
  sections: [],
  roadSamples: forestValleyRoadSamples,
  centerlineSegments: forestValleyCenterline,
  checkpoints: forestValleyCheckpoints,
  boundaries: {
    minX: -85,
    maxX: 175,
    minZ: -210,
    maxZ: 180,
    minY: -1.5,
  },
  environment: {
    clearColor: new Color3(0.06, 0.10, 0.16),
    ambientColor: new Color3(0.18, 0.22, 0.28),
    sunDirection: new Vector3(0.6, -1.2, 0.8),
    sunDiffuse: new Color3(1.0, 0.98, 0.95),
    sunSpecular: new Color3(0.8, 0.8, 0.8),
    groundColor: new Color3(0.16, 0.22, 0.14),
  },
  events: forestValleyEvents,
  minimap: {
    svgViewBox: '-65 -160 215 350',
    fullCircuitSvgPath: 'M 0.0,0.0 L 0.1,-1.8 L 0.0,-3.7 L 0.0,-5.5 L 0.0,-7.3 L 0.0,-9.2 L 0.0,-11.0 L 0.0,-12.8 L 0.0,-14.7 L 0.0,-16.5 L 0.0,-18.3 L 0.0,-20.2 L 0.0,-22.0 L 0.0,-23.8 L 0.0,-25.7 L 0.0,-27.5 L -0.0,-29.3 L -0.0,-31.2 L -0.1,-33.0 L -0.2,-34.8 L -0.2,-36.7 L -0.3,-38.5 L -0.3,-40.3 L -0.2,-42.2 L -0.2,-44.0 L -0.0,-45.8 L 0.2,-47.6 L 0.3,-49.5 L 0.6,-51.3 L 0.8,-53.1 L 1.1,-54.9 L 1.4,-56.7 L 1.8,-58.5 L 2.2,-60.3 L 2.8,-62.0 L 3.4,-63.8 L 4.1,-65.5 L 4.9,-67.1 L 5.7,-68.8 L 6.5,-70.4 L 7.4,-72.0 L 8.3,-73.6 L 9.3,-75.1 L 10.4,-76.6 L 11.6,-78.0 L 12.8,-79.4 L 14.1,-80.7 L 15.4,-81.9 L 16.9,-83.0 L 18.5,-84.0 L 20.1,-84.9 L 21.7,-85.7 L 23.4,-86.4 L 25.1,-87.1 L 26.8,-87.6 L 28.6,-88.1 L 30.4,-88.6 L 32.2,-89.0 L 34.0,-89.3 L 35.8,-89.5 L 37.6,-89.7 L 39.5,-89.7 L 41.3,-89.7 L 43.1,-89.6 L 45.0,-89.5 L 46.8,-89.2 L 48.6,-88.9 L 50.4,-88.5 L 52.1,-88.1 L 53.9,-87.5 L 55.6,-86.9 L 57.3,-86.2 L 59.0,-85.4 L 60.6,-84.6 L 62.1,-83.6 L 63.6,-82.5 L 65.0,-81.3 L 66.4,-80.1 L 67.7,-78.8 L 68.9,-77.4 L 70.0,-76.0 L 71.1,-74.5 L 72.1,-73.0 L 73.0,-71.4 L 73.9,-69.7 L 74.6,-68.0 L 75.1,-66.3 L 75.6,-64.5 L 76.0,-62.7 L 76.3,-60.9 L 76.4,-59.1 L 76.5,-57.3 L 76.5,-55.4 L 76.4,-53.6 L 76.1,-51.8 L 75.6,-50.0 L 74.8,-48.4 L 73.9,-46.8 L 73.0,-45.2 L 72.0,-43.7 L 71.0,-42.1 L 70.1,-40.5 L 69.3,-38.9 L 68.8,-37.1 L 68.6,-35.3 L 68.6,-33.4 L 68.7,-31.6 L 68.9,-29.8 L 69.3,-28.0 L 69.7,-26.2 L 70.2,-24.5 L 70.8,-22.7 L 71.5,-21.0 L 72.3,-19.4 L 73.3,-17.8 L 74.4,-16.4 L 75.5,-14.9 L 76.7,-13.5 L 77.9,-12.1 L 79.0,-10.7 L 80.0,-9.2 L 81.0,-7.6 L 81.8,-6.0 L 82.6,-4.3 L 83.4,-2.6 L 84.1,-0.9 L 84.7,0.8 L 85.3,2.5 L 85.9,4.2 L 86.4,6.0 L 86.9,7.8 L 87.3,9.6 L 87.7,11.4 L 88.0,13.2 L 88.2,15.0 L 88.4,16.8 L 88.5,18.6 L 88.6,20.5 L 88.7,22.3 L 88.8,24.1 L 88.9,26.0 L 89.0,27.8 L 89.0,29.6 L 89.1,31.5 L 89.2,33.3 L 89.3,35.1 L 89.3,37.0 L 89.4,38.8 L 89.4,40.6 L 89.5,42.5 L 89.5,44.3 L 89.5,46.1 L 89.5,48.0 L 89.4,49.8 L 89.3,51.6 L 89.2,53.4 L 89.1,55.3 L 88.9,57.1 L 88.7,58.9 L 88.5,60.7 L 88.3,62.6 L 88.1,64.4 L 87.8,66.2 L 87.5,68.0 L 87.2,69.8 L 86.8,71.6 L 86.4,73.4 L 85.9,75.2 L 85.4,76.9 L 84.8,78.6 L 84.1,80.4 L 83.5,82.1 L 82.7,83.7 L 82.0,85.4 L 81.2,87.1 L 80.4,88.7 L 79.5,90.3 L 78.6,91.9 L 77.6,93.5 L 76.6,95.0 L 75.4,96.4 L 74.2,97.8 L 73.0,99.1 L 71.6,100.3 L 70.1,101.4 L 68.6,102.5 L 67.0,103.4 L 65.4,104.3 L 63.8,105.1 L 62.1,105.8 L 60.4,106.5 L 58.7,107.2 L 56.9,107.7 L 55.2,108.2 L 53.4,108.7 L 51.6,109.1 L 49.8,109.5 L 48.0,109.7 L 46.2,109.9 L 44.4,110.1 L 42.5,110.1 L 40.7,110.1 L 38.9,110.1 L 37.0,109.9 L 35.2,109.7 L 33.4,109.5 L 31.6,109.1 L 29.8,108.7 L 28.0,108.2 L 26.3,107.7 L 24.6,106.9 L 23.0,106.1 L 21.4,105.2 L 19.9,104.2 L 18.3,103.2 L 16.9,102.1 L 15.4,101.0 L 13.9,100.0 L 12.4,98.9 L 10.9,97.9 L 9.3,96.9 L 7.7,96.0 L 6.1,95.2 L 4.4,94.5 L 2.7,93.8 L 1.0,93.1 L -0.7,92.5 L -2.5,91.8 L -4.2,91.2 L -5.9,90.5 L -7.6,89.8 L -9.3,89.1 L -10.9,88.2 L -12.5,87.4 L -14.1,86.5 L -15.7,85.6 L -17.3,84.6 L -18.8,83.6 L -20.3,82.5 L -21.7,81.4 L -23.1,80.2 L -24.5,79.0 L -25.9,77.8 L -27.2,76.5 L -28.4,75.1 L -29.5,73.7 L -30.6,72.2 L -31.6,70.7 L -32.6,69.1 L -33.4,67.5 L -34.2,65.8 L -34.9,64.1 L -35.4,62.4 L -35.8,60.6 L -35.9,58.8 L -35.9,56.9 L -35.8,55.1 L -35.6,53.3 L -35.2,51.5 L -34.6,49.7 L -33.9,48.1 L -32.9,46.5 L -31.7,45.1 L -30.5,43.8 L -29.1,42.5 L -27.7,41.3 L -26.2,40.3 L -24.7,39.3 L -23.1,38.4 L -21.5,37.5 L -19.9,36.6 L -18.4,35.6 L -16.9,34.5 L -15.4,33.4 L -14.0,32.2 L -12.7,31.0 L -11.3,29.7 L -10.0,28.4 L -8.8,27.1 L -7.6,25.7 L -6.4,24.3 L -5.4,22.8 L -4.4,21.2 L -3.6,19.6 L -2.8,17.9 L -2.1,16.2 L -1.5,14.5 L -1.0,12.7 L -0.6,11.0 L -0.3,9.1 L -0.1,7.3 L 0.0,5.5 L 0.1,3.7 L 0.1,1.8 Z',
    sprintSvgPath: 'M 0.0,0.0 L 0.1,-1.8 L 0.0,-3.7 L 0.0,-5.5 L 0.0,-7.3 L 0.0,-9.2 L 0.0,-11.0 L 0.0,-12.8 L 0.0,-14.7 L 0.0,-16.5 L 0.0,-18.3 L 0.0,-20.2 L 0.0,-22.0 L 0.0,-23.8 L 0.0,-25.7 L 0.0,-27.5 L -0.0,-29.3 L -0.0,-31.2 L -0.1,-33.0 L -0.2,-34.8 L -0.2,-36.7 L -0.3,-38.5 L -0.3,-40.3 L -0.2,-42.2 L -0.2,-44.0 L -0.0,-45.8 L 0.2,-47.6 L 0.3,-49.5 L 0.6,-51.3 L 0.8,-53.1 L 1.1,-54.9 L 1.4,-56.7 L 1.8,-58.5 L 2.2,-60.3 L 2.8,-62.0 L 3.4,-63.8 L 4.1,-65.5 L 4.9,-67.1 L 5.7,-68.8 L 6.5,-70.4 L 7.4,-72.0 L 8.3,-73.6 L 9.3,-75.1 L 10.4,-76.6 L 11.6,-78.0 L 12.8,-79.4 L 14.1,-80.7 L 15.4,-81.9 L 16.9,-83.0 L 18.5,-84.0 L 20.1,-84.9 L 21.7,-85.7 L 23.4,-86.4 L 25.1,-87.1 L 26.8,-87.6 L 28.6,-88.1 L 30.4,-88.6 L 32.2,-89.0 L 34.0,-89.3 L 35.8,-89.5 L 37.6,-89.7 L 39.5,-89.7 L 41.3,-89.7 L 43.1,-89.6 L 45.0,-89.5 L 46.8,-89.2 L 48.6,-88.9 L 50.4,-88.5 L 52.1,-88.1 L 53.9,-87.5 L 55.6,-86.9 L 57.3,-86.2 L 59.0,-85.4 L 60.6,-84.6 L 62.1,-83.6 L 63.6,-82.5 L 65.0,-81.3 L 66.4,-80.1 L 67.7,-78.8 L 68.9,-77.4 L 70.0,-76.0 L 71.1,-74.5 L 72.1,-73.0 L 73.0,-71.4 L 73.9,-69.7 L 74.6,-68.0 L 75.1,-66.3 L 75.6,-64.5 L 76.0,-62.7 L 76.3,-60.9 L 76.4,-59.1 L 76.5,-57.3 L 76.5,-55.4 L 76.4,-53.6 L 76.1,-51.8 L 75.6,-50.0 L 74.8,-48.4 L 73.9,-46.8 L 73.0,-45.2 L 72.0,-43.7 L 71.0,-42.1 L 70.1,-40.5 L 69.3,-38.9',
    sprintStart: { x: 0, y: 0 },
    sprintFinish: { x: 69.3, y: -38.9 },
    startFinishMarker: { x: 0, y: 0, labelPos: { x: -8, y: 3 } },
    driftZones: [
      { path: 'M 0.0,-45.0 L 25.0,-75.0 L 60.0,-80.0', label: 'DRIFT ZONE 1', labelPos: { x: 30, y: -85 } },
      { path: 'M 65.0,-45.0 L 75.0,-20.0 L 80.0,-5.0', label: 'DRIFT ZONE 2', labelPos: { x: 70, y: -15 } },
      { path: 'M 65.0,95.0 L 25.0,90.0 L -15.0,80.0', label: 'DRIFT ARENA', labelPos: { x: 25, y: 98 } },
    ],
    gateMarkers: [
      { x: 0.2, y: -47.6 },
      { x: 25.1, y: -87.1 },
      { x: 67.7, y: -78.8 },
      { x: 69.3, y: -38.9 },
      { x: 88.4, y: 16.8 },
      { x: 81.2, y: 87.1 },
      { x: 24.6, y: 106.9 },
      { x: -27.2, y: 76.5 },
      { x: -19.9, y: 36.6 },
    ],
  },

  buildRoadMarkings: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const yMarking = yOffset + 0.002;

    // Start/Finish Checkered strip across 13.0m road (X in [-6.5, 6.5], Z = 0)
    const sfTex = new DynamicTexture('FV_SF_Checkered_Tex', { width: 512, height: 64 }, scene, false);
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
    const sfMat = new StandardMaterial('FV_SF_Checkered_Mat', scene);
    sfMat.diffuseTexture = sfTex;
    sfMat.backFaceCulling = false;

    const sfLine = MeshBuilder.CreatePlane('FV_StartFinishStrip', { width: 13.0, height: 1.0 }, scene);
    sfLine.rotation.x = Math.PI / 2;
    sfLine.position.set(0, yMarking, 0);
    sfLine.material = sfMat;
    sfLine.parent = parent;
    sfLine.isPickable = false;

    // Motorsport Starting Grid Boxes (Clean transparent interior with white perimeter)
    const gridTex = new DynamicTexture('FV_GridBox_Tex', { width: 256, height: 512 }, scene, false);
    gridTex.hasAlpha = true;
    const gCtx = gridTex.getContext() as CanvasRenderingContext2D;
    if (gCtx) {
      gCtx.clearRect(0, 0, 256, 512);
      gCtx.strokeStyle = '#ffffff';
      gCtx.lineWidth = 16;
      gCtx.strokeRect(8, 8, 240, 496);
      gridTex.update();
    }
    const gridMat = new StandardMaterial('FV_GridBoxMat', scene);
    gridMat.diffuseTexture = gridTex;
    gridMat.useAlphaFromDiffuseTexture = true;
    gridMat.backFaceCulling = false;

    // Grid starting boxes (Spacious 13m road slots)
    const gridZ = [14.0, 6.0, -2.0, -10.0];
    const gridX = [-2.8, 2.8, -2.8, 2.8];
    for (let g = 0; g < 4; g++) {
      const box = MeshBuilder.CreatePlane(`FV_GridBox_${g}`, { width: 2.4, height: 4.2 }, scene);
      box.rotation.x = Math.PI / 2;
      box.position.set(gridX[g], yMarking, gridZ[g]);
      box.material = gridMat;
      box.parent = parent;
      box.isPickable = false;
    }
  },

  buildRoadVerges: (_scene: Scene, _parent: TransformNode, _yOffset: number) => {
    // Verges are built continuously along the full spline by RoadMeshBuilder.buildVerges
  },

  buildRoadsideInfrastructure: (scene: Scene, parent: TransformNode, yOffset: number) => {
    const boardMat = new StandardMaterial('FV_BrakeBoardMat', scene);
    boardMat.diffuseColor = new Color3(0.9, 0.9, 0.9);
    const postMat = new StandardMaterial('FV_PostMat', scene);
    postMat.diffuseColor = new Color3(0.2, 0.2, 0.2);

    const makeBrakeBoard = (name: string, pos: Vector3, rotY: number) => {
      const post = MeshBuilder.CreateCylinder(`${name}_post`, { height: 1.4, diameter: 0.08 }, scene);
      post.position.set(pos.x, yOffset + 0.7, pos.z);
      post.material = postMat;
      post.parent = parent;
      post.isPickable = false;

      const board = MeshBuilder.CreateBox(`${name}_panel`, { width: 0.9, height: 0.6, depth: 0.06 }, scene);
      board.position.set(pos.x, yOffset + 1.2, pos.z);
      board.rotation.y = rotY;
      board.material = boardMat;
      board.parent = parent;
      board.isPickable = false;
    };

    // 100m, 50m boards approaching Turn 1 on North Straight (placed at 8.5m lateral distance, outside 6.5m road)
    makeBrakeBoard('FV_BB_North_100', new Vector3(8.5, 0, 65), 0);
    makeBrakeBoard('FV_BB_North_50', new Vector3(8.5, 0, 80), 0);

    // 150m, 100m, 50m boards along Grand Back Straight approaching South Sweeper
    makeBrakeBoard('FV_BB_Back_150', new Vector3(154.5, 0, -50), Math.PI);
    makeBrakeBoard('FV_BB_Back_100', new Vector3(154.5, 0, -80), Math.PI);
    makeBrakeBoard('FV_BB_Back_50', new Vector3(154.5, 0, -110), Math.PI);
  },

  buildScenery: async (scene: Scene, parent: TransformNode) => {
    const sceneryRoot = new TransformNode('ForestSceneryContainer', scene);
    sceneryRoot.parent = parent;

    const vegMat = new StandardMaterial('FV_VegetationMat', scene);
    vegMat.diffuseColor = new Color3(1, 1, 1);
    vegMat.specularColor = new Color3(0.02, 0.02, 0.02);

    const createColoredPart = (mesh: Mesh, col: Color3): Mesh => {
      const count = mesh.getTotalVertices();
      const colors = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        colors[i * 4 + 0] = col.r;
        colors[i * 4 + 1] = col.g;
        colors[i * 4 + 2] = col.b;
        colors[i * 4 + 3] = 1.0;
      }
      mesh.setVerticesData('color', colors);
      return mesh;
    };

    // Spruce
    const trunkS = createColoredPart(
      MeshBuilder.CreateCylinder('TrunkS', { height: 1.8, diameterTop: 0.35, diameterBottom: 0.5, tessellation: 6 }, scene),
      new Color3(0.28, 0.22, 0.16)
    );
    trunkS.position.y = 0.9;
    const c1 = createColoredPart(MeshBuilder.CreateCylinder('Cone1', { height: 2.2, diameterTop: 0.2, diameterBottom: 2.6, tessellation: 6 }, scene), new Color3(0.12, 0.25, 0.10));
    c1.position.y = 2.2;
    const c2 = createColoredPart(MeshBuilder.CreateCylinder('Cone2', { height: 1.8, diameterTop: 0.1, diameterBottom: 2.0, tessellation: 6 }, scene), new Color3(0.15, 0.30, 0.12));
    c2.position.y = 3.3;
    const c3 = createColoredPart(MeshBuilder.CreateCylinder('Cone3', { height: 1.4, diameterTop: 0.0, diameterBottom: 1.4, tessellation: 6 }, scene), new Color3(0.18, 0.35, 0.15));
    c3.position.y = 4.2;
    const masterSpruce = Mesh.MergeMeshes([trunkS, c1, c2, c3], true, true, undefined, false, true)!;
    masterSpruce.material = vegMat;
    masterSpruce.useVertexColors = true;
    masterSpruce.isVisible = false;
    masterSpruce.isPickable = false;

    // Oak
    const trunkO = createColoredPart(MeshBuilder.CreateCylinder('TrunkO', { height: 2.2, diameterTop: 0.42, diameterBottom: 0.58, tessellation: 6 }, scene), new Color3(0.30, 0.24, 0.18));
    trunkO.position.y = 1.1;
    const cr1 = createColoredPart(MeshBuilder.CreateSphere('Cr1', { diameterX: 3.4, diameterY: 2.4, diameterZ: 3.2, segments: 5 }, scene), new Color3(0.18, 0.29, 0.11));
    cr1.position.set(0, 2.9, 0);
    const cr2 = createColoredPart(MeshBuilder.CreateSphere('Cr2', { diameterX: 2.6, diameterY: 2.2, diameterZ: 2.6, segments: 5 }, scene), new Color3(0.24, 0.37, 0.15));
    cr2.position.set(0.3, 3.9, -0.2);
    const masterOak = Mesh.MergeMeshes([trunkO, cr1, cr2], true, true, undefined, false, true)!;
    masterOak.material = vegMat;
    masterOak.useVertexColors = true;
    masterOak.isVisible = false;
    masterOak.isPickable = false;

    // Rock
    const masterRock = createColoredPart(MeshBuilder.CreateSphere('Rock', { diameterX: 1.4, diameterY: 0.9, diameterZ: 1.2, segments: 3 }, scene), new Color3(0.35, 0.37, 0.39));
    masterRock.position.y = 0.45;
    masterRock.bakeCurrentTransformIntoVertices();
    masterRock.material = vegMat;
    masterRock.useVertexColors = true;
    masterRock.isVisible = false;
    masterRock.isPickable = false;

    let seed = 42;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const spawn = (master: Mesh, locations: Vector3[], prefix: string, sMin: number, sMax: number) => {
      for (let i = 0; i < locations.length; i++) {
        const inst = master.createInstance(`${prefix}_${i}`);
        inst.parent = sceneryRoot;
        inst.position.copyFrom(locations[i]);
        inst.rotation.y = pseudoRandom() * Math.PI * 2;
        const s = sMin + pseudoRandom() * (sMax - sMin);
        inst.scaling.set(s, s * (0.95 + pseudoRandom() * 0.25), s);
        inst.isPickable = false;
      }
    };

    const spruces: Vector3[] = [
      new Vector3(-20, 0, 135),
      new Vector3(0, 0, 140),
      new Vector3(28.4, 0, 132),
      new Vector3(40, 0, 142),
      new Vector3(60, 0, 136),
      new Vector3(80, 0, 140),
      new Vector3(145.3, 0, 79.8),
      new Vector3(150, 0, 40),
      new Vector3(141.4, 0, -1.9),
      new Vector3(148, 0, -40),
      new Vector3(145, 0, -80),
      new Vector3(147.7, 0, -119.6),
      new Vector3(125.4, 0, -170.4),
      new Vector3(90, 0, -180),
      new Vector3(50, 0, -178),
      new Vector3(8.4, 0, -185.2),
      new Vector3(-30, 0, -176),
      new Vector3(-60, 0, -180),
      new Vector3(-65, 0, -140),
      new Vector3(-77.1, 0, -99.4),
      new Vector3(-64, 0, -60),
      new Vector3(-66, 0, -20),
      new Vector3(-64, 0, 20),
      new Vector3(-68, 0, 60),
      new Vector3(20, 0, 30),
      new Vector3(25, 0, 50),
      new Vector3(15, 0, -60),
      new Vector3(95, 0, -80),
    ];
    spawn(masterSpruce, spruces, 'FV_Spruce', 0.85, 1.45);

    const oaks: Vector3[] = [
      new Vector3(-25, 0, 125),
      new Vector3(30, 0, 130),
      new Vector3(70, 0, 128),
      new Vector3(140, 0, 60),
      new Vector3(142, 0, -20),
      new Vector3(140, 0, -100),
      new Vector3(110, 0, -170),
      new Vector3(70, 0, -172),
      new Vector3(-12.6, 0, -176.8),
      new Vector3(-50.5, 0, -116.4),
      new Vector3(-56, 0, -40),
      new Vector3(-58, 0, 40),
      new Vector3(22, 0, 10),
      new Vector3(26, 0, -30),
      new Vector3(88, 0, -50),
    ];
    spawn(masterOak, oaks, 'FV_Oak', 0.85, 1.35);

    const rocks: Vector3[] = [
      new Vector3(-8, 0, 118),
      new Vector3(48, 0, 118),
      new Vector3(128, 0, -5),
      new Vector3(128, 0, -156),
      new Vector3(75, 0, -156),
      new Vector3(-48.2, 0, -156.3),
      new Vector3(-48, 0, -15),
      new Vector3(-12.4, 0, -14.5),
      new Vector3(25, 0, -55),
    ];
    spawn(masterRock, rocks, 'FV_Rock', 0.8, 1.6);

    try {
      const templateResult = await SceneLoader.ImportMeshAsync('', './assets/tracks/', 'decoration-forest.glb', scene);
      const templateMesh = templateResult.meshes.find(m => m instanceof Mesh && m.name !== '__root__') as Mesh;
      if (templateMesh) {
        templateMesh.isVisible = false;
        templateMesh.isPickable = false;
        const forestClusters: Vector3[] = [
          new Vector3(-45, 0, 145),
          new Vector3(46.8, 0, 145.9),
          new Vector3(104, 0, 143.4),
          new Vector3(160, 0, 60),
          new Vector3(150.2, 0, -60.5),
          new Vector3(166.9, 0, -142.7),
          new Vector3(110.7, 0, -180.3),
          new Vector3(30, 0, -199.8),
          new Vector3(-45, 0, -190),
          new Vector3(-80, 0, -120),
          new Vector3(-80, 0, -40),
          new Vector3(-78, 0, 60),
        ];
        for (let i = 0; i < forestClusters.length; i++) {
          const inst = templateMesh.createInstance(`FV_Kenney_${i}`);
          inst.parent = sceneryRoot;
          inst.position.copyFrom(forestClusters[i]);
          inst.rotation.y = pseudoRandom() * Math.PI * 2;
          const s = 0.9 + pseudoRandom() * 0.35;
          inst.scaling.set(s, s * (0.95 + pseudoRandom() * 0.2), s);
          inst.isPickable = false;
        }
      }
    } catch (err) {
      console.warn('Failed to load decoration-forest.glb cluster:', err);
    }
  },
};
