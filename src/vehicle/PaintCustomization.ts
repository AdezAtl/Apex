import { Color3 } from '@babylonjs/core';

export interface PaintOption {
  id: string;
  name: string;
  finish: string;
  hex: string;
  color: Color3;
  roughness: number;
  metallic: number;
  description: string;
}

export const PAINT_OPTIONS: PaintOption[] = [
  {
    id: 'pearl_white',
    name: 'Pearl White',
    finish: 'Tri-Coat Metallic Lacquer',
    hex: '#edf2f7',
    color: new Color3(0.93, 0.95, 0.97),
    roughness: 0.22,
    metallic: 0.15,
    description: 'High-luminance multi-stage pearl lacquer with subtle blue-silver undertones.',
  },
  {
    id: 'metallic_silver',
    name: 'Metallic Silver',
    finish: 'Liquid Billet Metal',
    hex: '#8f98a3',
    color: new Color3(0.56, 0.60, 0.64),
    roughness: 0.19,
    metallic: 0.72,
    description: 'Reflective machined aluminum finish with deep specular highlights.',
  },
  {
    id: 'gloss_black',
    name: 'Gloss Black',
    finish: 'Obsidian Deep Clearcoat',
    hex: '#14161a',
    color: new Color3(0.07, 0.08, 0.09),
    roughness: 0.16,
    metallic: 0.20,
    description: 'Ultra-dark piano lacquer with a mirror-grade gloss coat.',
  },
  {
    id: 'racing_red',
    name: 'Racing Red',
    finish: 'Apex Rosso Corsa',
    hex: '#d61515',
    color: new Color3(0.84, 0.07, 0.07),
    roughness: 0.20,
    metallic: 0.14,
    description: 'Iconic high-chroma motorsport crimson engineered for visibility on track.',
  },
  {
    id: 'deep_blue',
    name: 'Deep Blue',
    finish: 'Midnight Pacific Pearl',
    hex: '#123d75',
    color: new Color3(0.07, 0.23, 0.46),
    roughness: 0.21,
    metallic: 0.44,
    description: 'Deep cobalt sapphire flake delivering rich contrast under studio spotlights.',
  },
];

export function getPaintOptionById(id: string): PaintOption {
  return PAINT_OPTIONS.find((p) => p.id === id) || PAINT_OPTIONS[0];
}

export interface VehicleRosterEntry {
  id: string;
  name: string;
  tagline: string;
  class: string;
  modelFile: string;
  specs: {
    drivetrain: string;
    maxSpeedKmH: number;
    brakeForce: string;
    weightKg: number;
    steerAngleDeg: number;
    triangles: number;
  };
  isAvailable: boolean;
}

export const VEHICLE_ROSTER: VehicleRosterEntry[] = [
  {
    id: 'apx01',
    name: 'APX-01 COUPE',
    tagline: 'Time-Attack Lightweight Sports Coupe',
    class: 'Class A • Production Sports',
    modelFile: 'APX01.glb',
    specs: {
      drivetrain: 'RWD (Rear-Wheel Drive)',
      maxSpeedKmH: 120, // 33.3 m/s from DEFAULT_VEHICLE_CONFIG
      brakeForce: '24.0 m/s²',
      weightKg: 1280,
      steerAngleDeg: 31, // 0.54 rad from DEFAULT_VEHICLE_CONFIG
      triangles: 8092,
    },
    isAvailable: true,
  },
];
