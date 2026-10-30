import { Scene, Vector3, Color3, TransformNode } from '@babylonjs/core';
import { CheckpointData } from '../checkpoints/CheckpointManager';
import { RaceEventConfig } from '../events/EventConfig';
import { RoadSamplePoint } from '../environment/RoadMeshBuilder';

export interface TrackSectionConfig {
  file: string;
  position: Vector3;
  rotationY?: number;
}

export interface CenterlineSegment {
  id: number;
  name?: string;
  start: Vector3;
  end: Vector3;
}

export interface TrackBoundaryConfig {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
}

export interface TrackEnvironmentConfig {
  clearColor: Color3;
  ambientColor: Color3;
  sunDirection: Vector3;
  sunDiffuse: Color3;
  sunSpecular: Color3;
  groundColor: Color3;
  fogMode?: number;
  fogDensity?: number;
  fogColor?: Color3;
  fogStart?: number;
  fogEnd?: number;
}

export interface MinimapDriftZone {
  path: string;
  label: string;
  labelPos: { x: number; y: number };
}

export interface CircuitMinimapConfig {
  svgViewBox: string;
  fullCircuitSvgPath: string;
  sprintSvgPath: string;
  sprintStart: { x: number; y: number };
  sprintFinish: { x: number; y: number };
  startFinishMarker: { x: number; y: number; labelPos: { x: number; y: number } };
  driftZones: MinimapDriftZone[];
  gateMarkers: Array<{ x: number; y: number }>;
}

export interface AIGridSlotConfig {
  gridSlot: number;
  position: Vector3;
  yaw: number;
}

export interface CircuitDefinition {
  id: string;
  name: string;
  subtitle: string;
  measuredLengthMeters: number;
  tileCount: number;
  description: string;
  surface: string;
  roadSurfaceY: number;
  startPosition: Vector3;
  startYaw: number;
  aiGridSlots: AIGridSlotConfig[];
  sections: TrackSectionConfig[];
  roadSamples?: RoadSamplePoint[];
  centerlineSegments: CenterlineSegment[];
  checkpoints: CheckpointData[];
  boundaries: TrackBoundaryConfig;
  environment: TrackEnvironmentConfig;
  events: RaceEventConfig[];
  minimap: CircuitMinimapConfig;
  trackHalfWidth?: number;
  barrierLimit?: number;
  buildRoadMarkings: (scene: Scene, parent: TransformNode, yOffset: number) => void;
  buildRoadVerges: (scene: Scene, parent: TransformNode, yOffset: number) => void;
  buildRoadsideInfrastructure: (scene: Scene, parent: TransformNode, yOffset: number) => void;
  buildScenery: (scene: Scene, parent: TransformNode) => Promise<void>;
}
