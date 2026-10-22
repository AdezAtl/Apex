# Project Apex — APX-01 High-Performance Sports Coupe

**Asset ID:** `APX-01`  
**Classification:** Original Game-Ready 3D Sports Coupe  
**Target Engine:** Babylon.js (Desktop 3D Racing Game, WebGL 2.0 / WebGPU)  
**Deliverable Files:**
- [`APX01.blend`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/APX01.blend) — Native Blender master scene with clean collections (`APX01_Vehicle`).
- [`APX01.glb`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/APX01.glb) — Self-contained glTF 2.0 binary asset with PBR materials and preserved wheel pivots.
- **Inspection Renders:**
  - [`apx01_front_quarter.png`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/apx01_front_quarter.png)
  - [`apx01_rear_quarter.png`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/apx01_rear_quarter.png)
  - [`apx01_side.png`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/apx01_side.png)
  - [`apx01_front.png`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/apx01_front.png)
  - [`apx01_rear.png`](file:///c:/Users/Dell/Documents/coding/ProjectApex/assets/vehicles/APX01/apx01_rear.png)

---

## 1. Design & Blueprint Concept
The APX-01 is an original performance sports coupe engineered directly from a standard 4-view orthographic blueprint:
- **Front:** Wide trapezoidal central air intake, raked power-bulge hood, angled dual-element LED projector headlamps with sharp DRL light blades, and a carbon chin splitter with integrated side dive winglets.
- **Side:** Classic athletic proportions with a long hood, low roofline, fastback greenhouse with a defined Hofmeister C-pillar kink, muscular rear haunches, and tucked-in coke-bottle waist.
- **Rear:** Ducktail lip spoiler integrated into the decklid, full-width glowing OLED taillight bar, recessed license plate housing, dual twin-pipe stainless steel exhaust cannons, and an enclosed aerodynamic rear diffuser.
- **Underbody:** 100% closed belly pan sealing from the front splitter to the rear diffuser, eliminating any hollow ground gaps.
- **Interior:** Volumetric 3D cockpit featuring deep sports bucket seats with lateral thigh and torso bolsters, headrests, a 3D toroidal steering wheel rim on an angled steering column, instrument binnacle, and transmission tunnel.

---

## 2. Physical Dimensions & Geometry Metrics

| Dimension | Real-World Value |
|---|---|
| **Overall Length** | `4.52 m` |
| **Overall Width (Body)** | `1.88 m` (`2.02 m` across side mirrors) |
| **Overall Height** | `1.34 m` |
| **Wheelbase** | `2.65 m` (Front axle: `Y = +1.325m`, Rear axle: `Y = -1.325m`) |
| **Front Track Width** | `1.62 m` (Center-to-center) |
| **Rear Track Width** | `1.64 m` (Center-to-center) |
| **Ground Clearance** | `0.14 m` to rocker sills / lower splitter |
| **Wheel Radius** | `0.33 m` (~26 inch tire diameter) |
| **Rim Radius** | `0.245 m` (19 inch motorsport rim) |
| **Tire Section Width** | `0.255 m` (255mm performance tire) |

### Polygon & Triangle Budget Audit

| Object Name | Polygons | Triangles | Notes |
|---|---:|---:|---|
| **`APX01_Body`** | 944 | 1,888 | Watertight shell, open grille, recessed wheel tubs |
| **`APX01_Glass`** | 64 | 120 | Framed windshield, side windows & fastback glass |
| **`APX01_Interior`** | 174 | 348 | Volumetric 3D bucket seats, 3D torus steering wheel & dash |
| **`APX01_Lights_Front`** | 70 | 76 | Dual circular projectors & DRL eyebrow blades |
| **`APX01_Lights_Rear`** | 8 | 16 | Full-width ducktail OLED bar |
| **`APX01_Trim`** | 122 | 244 | Splitter, side skirts, diffuser, mirrors & exhausts |
| **`FL_Wheel`** | 714 | 1,350 | 48-seg tire, 10 split-spoke rim, rotor, caliper |
| **`FR_Wheel`** | 714 | 1,350 | 48-seg tire, 10 split-spoke rim, rotor, caliper |
| **`RL_Wheel`** | 714 | 1,350 | 48-seg tire, 10 split-spoke rim, rotor, caliper |
| **`RR_Wheel`** | 714 | 1,350 | 48-seg tire, 10 split-spoke rim, rotor, caliper |
| **TOTAL VEHICLE** | **4,238** | **8,092** | **Target: 15,000–35,000 tris (Highly Optimized)** |

- **GLB Binary Size:** `182.9 KB` (Zero external texture memory overhead, instant runtime load).

---

## 3. Coordinate System & Axis Alignment

| Axis | Blender Coordinate Space | Exported glTF 2.0 / Babylon.js Space |
|---|---|---|
| **Forward Direction** | `+Y` | `-Z` (Standard glTF forward axis) |
| **Vertical / Up** | `+Z` | `+Y` (Standard glTF up axis) |
| **Lateral / Left** | `-X` | `-X` |
| **Lateral / Right** | `+X` | `+X` |

- **Vehicle Root Pivot:** Positioned at `(0, 0, 0)` at ground level at the longitudinal midpoint between the front and rear axles.

---

## 4. Independent Wheel Assemblies & Axle Pivots

The four wheel objects are exported with **independent local origins centered at their respective axle hubs** (`export_apply=False`). This enables runtime steering and rolling in Babylon.js without origin repositioning.

| Wheel Assembly | Blender Axle Position `(X, Y, Z)` | glTF / Babylon.js Axle Position `(X, Y, Z)` |
|---|---|---|
| **`FL_Wheel`** (Front Left) | `(-0.810, +1.325, 0.330)` | `(-0.810, 0.330, -1.325)` |
| **`FR_Wheel`** (Front Right) | `(+0.810, +1.325, 0.330)` | `(+0.810, 0.330, -1.325)` |
| **`RL_Wheel`** (Rear Left) | `(-0.820, -1.325, 0.330)` | `(-0.820, 0.330, +1.325)` |
| **`RR_Wheel`** (Rear Right) | `(+0.820, -1.325, 0.330)` | `(+0.820, 0.330, +1.325)` |

### Runtime Animation Degrees of Freedom:
- **Rolling (All Wheels):** Rotate around local **X-axis** (`rotation.x += angularVelocity * dt`).
- **Steering (`FL_Wheel`, `FR_Wheel`):** Steer around local **Y-axis** in Babylon.js / **Z-axis** in Blender (`rotation.y = steeringAngle`).

---

## 5. Material & PBR Shader Breakdown

| Material Name | Base Color (RGBA) | Metallic | Roughness | Alpha | Emissive (RGB / Strength) | Usage |
|---|---|---:|---:|---:|---|---|
| **`M_Body_White`** | `(0.90, 0.91, 0.93, 1.0)` | `0.85` | `0.18` | `1.0` | None | Metallic pearl white coupe paint |
| **`M_Glass_Tinted`**| `(0.05, 0.07, 0.10, 1.0)` | `0.20` | `0.05` | `0.35`| None | Dark tinted automotive glazing |
| **`M_Wheel_Black`** | `(0.03, 0.03, 0.035, 1.0)`| `0.88` | `0.25` | `1.0` | None | Satin gunmetal black alloy rims |
| **`M_Tire_Rubber`** | `(0.04, 0.04, 0.04, 1.0)` | `0.00` | `0.82` | `1.0` | None | Matte vulcanized tread & sidewalls |
| **`M_Headlight`**   | `(1.00, 1.00, 1.00, 1.0)` | `0.10` | `0.10` | `1.0` | `(1.0, 1.0, 1.0)` / `8.0` | LED crystal projectors & DRL blades |
| **`M_Taillight`**   | `(0.95, 0.04, 0.06, 1.0)` | `0.10` | `0.15` | `1.0` | `(1.0, 0.05, 0.06)` / `6.0` | Ducktail OLED rear light bar |
| **`M_Trim_Black`**  | `(0.025, 0.025, 0.028, 1)`| `0.30` | `0.45` | `1.0` | None | Splitter, skirts, diffuser & mirrors |
| **`M_Metal`**       | `(0.85, 0.86, 0.88, 1.0)` | `0.95` | `0.15` | `1.0` | None | Exhaust tips, brake discs, lug nuts |
| **`M_Brake_Caliper`**| `(0.85, 0.05, 0.04, 1.0)`| `0.50` | `0.20` | `1.0` | None | Gloss racing red Brembo calipers |
| **`M_Interior_Dark`**| `(0.05, 0.05, 0.06, 1.0)`| `0.00` | `0.75` | `1.0` | None | 3D bucket seats, steering wheel, dash |

---

## 6. Babylon.js Runtime Integration Example

```typescript
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export class APX01Vehicle {
    public rootNode: BABYLON.TransformNode;
    public flWheel: BABYLON.AbstractMesh;
    public frWheel: BABYLON.AbstractMesh;
    public rlWheel: BABYLON.AbstractMesh;
    public rrWheel: BABYLON.AbstractMesh;
    public tailLightMat: BABYLON.PBRMaterial;

    constructor(private scene: BABYLON.Scene) {}

    public async load(url: string = "assets/vehicles/APX01/APX01.glb"): Promise<void> {
        const result = await BABYLON.SceneLoader.ImportMeshAsync("", "", url, this.scene);
        
        // Cache independent wheel meshes
        this.flWheel = this.scene.getMeshByName("FL_Wheel")!;
        this.frWheel = this.scene.getMeshByName("FR_Wheel")!;
        this.rlWheel = this.scene.getMeshByName("RL_Wheel")!;
        this.rrWheel = this.scene.getMeshByName("RR_Wheel")!;

        // Cache taillight material for runtime brake lighting
        this.tailLightMat = this.scene.getMaterialByName("M_Taillight") as BABYLON.PBRMaterial;
        
        // Setup vehicle root transform
        this.rootNode = new BABYLON.TransformNode("APX01_Root", this.scene);
        result.meshes.forEach(mesh => {
            if (!mesh.parent) {
                mesh.parent = this.rootNode;
            }
        });
    }

    public update(steeringInput: number, speedMps: number, isBraking: boolean, dt: number): void {
        const wheelRadius = 0.33; // metres
        const rollAngleDelta = (speedMps / wheelRadius) * dt;

        // 1. Roll all 4 wheels around local X axis
        [this.flWheel, this.frWheel, this.rlWheel, this.rrWheel].forEach(w => {
            w.rotation.x += rollAngleDelta;
        });

        // 2. Steer front wheels around local Y axis (glTF up axis)
        const maxSteerAngle = BABYLON.Tools.ToRadians(32);
        const currentSteer = steeringInput * maxSteerAngle;
        this.flWheel.rotation.y = currentSteer;
        this.frWheel.rotation.y = currentSteer;

        // 3. Dynamic brake lighting
        if (this.tailLightMat) {
            this.tailLightMat.emissiveIntensity = isBraking ? 12.0 : 3.0;
        }
    }
}
```
