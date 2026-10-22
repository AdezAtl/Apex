"""
================================================================================
PROJECT APEX: APX-01 HIGH-PERFORMANCE SPORTS COUPE
Master Procedural Vehicle Generator & glTF Production Pipeline (Version 8.0)
================================================================================
Target Platform: Babylon.js / TypeScript Desktop 3D Racing Game
Coordinate Convention:
  Blender: +Y Forward, +Z Up, -X Left, +X Right
  glTF Export: -Z Forward, +Y Up, -X Left, +X Right (Blender +Y -> glTF -Z)

Deliverables:
  - APX01.blend (Native Blender scene with organized collections)
  - APX01.glb (Optimized, self-contained game-ready asset)
  - 5 High-res inspection renders (Front 3/4, Rear 3/4, Side, Front, Rear)
================================================================================
"""

import bpy
import bmesh
import math
import mathutils
import os
import sys

# ==============================================================================
# 1. VEHICLE SPECIFICATION CONSTANTS
# ==============================================================================
WHEELBASE = 2.60          # Front-to-rear axle distance (m)
TRACK_WIDTH_FRONT = 1.62  # Front track width center-to-center (m)
TRACK_WIDTH_REAR = 1.64   # Rear track width center-to-center (m)

AXLE_Y_FRONT = 1.30       # Front axle Y position
AXLE_Y_REAR = -1.30       # Rear axle Y position
AXLE_Z = 0.33             # Axle height above ground level (m)

WHEEL_RADIUS = 0.33       # Tire outer radius (m) (~26 inch diameter)
TIRE_WIDTH = 0.255        # Tire section width (m) (255mm performance tire)
RIM_RADIUS = 0.245        # Rim bead radius (m) (~19 inch rim)
ARCH_RADIUS = 0.380       # Wheel arch clearance radius (m)

ASSET_DIR = r"c:\Users\Dell\Documents\coding\ProjectApex\assets\vehicles\APX01"
BLEND_FILE = os.path.join(ASSET_DIR, "APX01.blend")
GLB_FILE = os.path.join(ASSET_DIR, "APX01.glb")

# ==============================================================================
# 2. SCENE RESET & PIPELINE INITIALIZATION
# ==============================================================================

def reset_scene():
    """Purges all scene data to guarantee a 100% deterministic, pristine build."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.unit_settings.length_unit = 'METERS'
    
    # Ensure Render settings are optimized for fast, crisp inspection renders
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 720
    bpy.context.scene.render.resolution_percentage = 100

# ==============================================================================
# 3. PBR SHADER & MATERIAL SUITE
# ==============================================================================

def create_pbr_materials():
    """
    Creates glTF 2.0 physically-based materials:
    - M_Body_White    : Metallic pearl white with clearcoat
    - M_Tire_Rubber   : Matte vulcanized rubber
    - M_Wheel_Black   : Satin gunmetal black rim alloy
    - M_Glass_Tinted  : Charcoal automotive glass
    - M_Headlight     : Brilliant white LED projector / DRL
    - M_Taillight     : Vibrant crimson OLED light bar
    - M_Trim_Black    : Semi-matte aerodynamic carbon trim
    - M_Metal         : Polished chrome/steel for exhausts & brake discs
    - M_Brake_Caliper : High-gloss Brembo racing red
    - M_Interior_Dark : Matte charcoal cockpit silhouette
    """
    mats = {}

    def new_mat(name, color, roughness, metallic=0.0, emission=None, emission_strength=1.0, alpha=1.0):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF")
        if not bsdf:
            bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
            
        bsdf.inputs['Base Color'].default_value = color
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metallic
        
        if 'Alpha' in bsdf.inputs:
            bsdf.inputs['Alpha'].default_value = alpha
            if alpha < 1.0:
                if hasattr(mat, 'blend_method'):
                    try:
                        mat.blend_method = 'BLEND'
                    except Exception:
                        pass
                
        if emission and 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = emission
            if 'Emission Strength' in bsdf.inputs:
                bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif emission and 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = emission
            
        return mat

    mats['M_Body_White']    = new_mat("M_Body_White", (0.90, 0.91, 0.93, 1.0), roughness=0.18, metallic=0.85)
    mats['M_Tire_Rubber']   = new_mat("M_Tire_Rubber", (0.04, 0.04, 0.04, 1.0), roughness=0.82, metallic=0.0)
    mats['M_Wheel_Black']   = new_mat("M_Wheel_Black", (0.03, 0.03, 0.035, 1.0), roughness=0.25, metallic=0.88)
    mats['M_Glass_Tinted']  = new_mat("M_Glass_Tinted", (0.05, 0.07, 0.10, 1.0), roughness=0.05, metallic=0.2, alpha=0.35)
    mats['M_Headlight']     = new_mat("M_Headlight", (1.0, 1.0, 1.0, 1.0), roughness=0.10, metallic=0.1, emission=(1.0, 1.0, 1.0, 1.0), emission_strength=8.0)
    mats['M_Taillight']     = new_mat("M_Taillight", (0.95, 0.04, 0.06, 1.0), roughness=0.15, metallic=0.1, emission=(1.0, 0.05, 0.06, 1.0), emission_strength=6.0)
    mats['M_Trim_Black']    = new_mat("M_Trim_Black", (0.025, 0.025, 0.028, 1.0), roughness=0.45, metallic=0.3)
    mats['M_Metal']         = new_mat("M_Metal", (0.85, 0.86, 0.88, 1.0), roughness=0.15, metallic=0.95)
    mats['M_Brake_Caliper'] = new_mat("M_Brake_Caliper", (0.85, 0.05, 0.04, 1.0), roughness=0.20, metallic=0.5)
    mats['M_Interior_Dark'] = new_mat("M_Interior_Dark", (0.05, 0.05, 0.06, 1.0), roughness=0.75, metallic=0.0)
    
    return mats

# ==============================================================================
# 4. HELPER UTILITIES: MIRRORING, NORMALS, WELDING
# ==============================================================================

def mirror_along_x(obj):
    """Adds and immediately applies an exact X-axis mirror modifier with clipping and merge."""
    mod = obj.modifiers.new(name="Mirror_X", type='MIRROR')
    mod.use_axis[0] = True
    mod.use_clip = True
    mod.merge_threshold = 0.002
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Mirror_X")

def apply_smoothing_and_normals(obj):
    """Sets smooth polygon shading and generates weighted split normals."""
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    
    # In Blender 4.x / 5.x, weighted normals or auto smooth geometry node is standard
    try:
        mod = obj.modifiers.new(name="WeightedNormal", type='WEIGHTED_NORMAL')
        mod.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier="WeightedNormal")
    except Exception:
        pass

# ==============================================================================
# 5. PROCEDURAL BODY GENERATION (WATERTIGHT SEAMS & SCULPTED CONTOURS)
# ==============================================================================

def build_body(mats):
    """
    Constructs the primary sports coupe aerodynamic shell:
    - Long sculpted hood with twin power bulges
    - Aggressive front bumper fascia with lower intake aperture & splitter tunnel
    - Aerodynamic front fenders with deep recessed 3D wheel tubs
    - Seamless fender trailing edge (Y=0.92 to Y=0.70) completely sealing into doors
    - Athletic waisted doors & sculpted rocker sills (Y=0.70 to Y=-0.92)
    - Greenhouse: A-pillars, double-bubble roof, fastback C-pillars
    - Flared muscular rear haunches with recessed 3D rear wheel tubs
    - Rear decklid sweeping up into an integrated ducktail lip spoiler
    - Sculpted rear bumper fascia with license plate housing & diffuser tunnels
    - Complete underbody belly pan
    """
    mesh = bpy.data.meshes.new("APX01_Body_Mesh")
    obj = bpy.data.objects.new("APX01_Body", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Body_White'])
    
    bm = bmesh.new()
    
    # -------------------------------------------------------------
    # 1. Hood & Cowl Surface (Y = 2.05 down to Cowl Y = 0.70)
    # -------------------------------------------------------------
    hood_stations = [
        # Y, [(X0, Z0), (X1, Z1), (X2, Z2), (X3, Z3)]
        (2.05, [(0.00, 0.62), (0.24, 0.61), (0.48, 0.59), (0.74, 0.57)]),
        (1.70, [(0.00, 0.69), (0.25, 0.68), (0.50, 0.66), (0.76, 0.65)]),
        (1.35, [(0.00, 0.75), (0.26, 0.74), (0.52, 0.72), (0.78, 0.71)]),
        (1.00, [(0.00, 0.81), (0.26, 0.80), (0.53, 0.78), (0.78, 0.76)]),
        (0.70, [(0.00, 0.86), (0.25, 0.85), (0.52, 0.83), (0.76, 0.80)]), # Cowl base
    ]
    h_rings = []
    for y, pts in hood_stations:
        h_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(h_rings) - 1):
        for p in range(len(hood_stations[0][1]) - 1):
            bm.faces.new([h_rings[s][p], h_rings[s][p+1], h_rings[s+1][p+1], h_rings[s+1][p]])

    # -------------------------------------------------------------
    # 2. Front Bumper Fascia & Central Intake (Y = 2.05 to Y = 2.26)
    # -------------------------------------------------------------
    n_top = h_rings[0] # Y=2.05
    n_mid = [
        bm.verts.new((0.00, 2.22, 0.52)), bm.verts.new((0.24, 2.20, 0.51)),
        bm.verts.new((0.48, 2.16, 0.49)), bm.verts.new((0.74, 2.10, 0.46))
    ]
    for p in range(len(n_mid) - 1):
        bm.faces.new([n_top[p], n_top[p+1], n_mid[p+1], n_mid[p]])
        
    n_bot = [
        bm.verts.new((0.00, 2.26, 0.42)), bm.verts.new((0.24, 2.24, 0.41)),
        bm.verts.new((0.48, 2.20, 0.38)), bm.verts.new((0.74, 2.14, 0.35))
    ]
    for p in range(len(n_bot) - 1):
        bm.faces.new([n_mid[p], n_mid[p+1], n_bot[p+1], n_bot[p]])
        
    # Bumper side corners
    b_cor1 = bm.verts.new((0.88, 1.95, 0.30))
    b_cor2 = bm.verts.new((0.89, 1.68, 0.15))
    bm.faces.new([n_mid[3], n_bot[3], b_cor1])
    bm.faces.new([n_bot[3], b_cor2, b_cor1])
    
    # Lower intake framing & chin
    n_chin = [
        bm.verts.new((0.48, 2.20, 0.14)), bm.verts.new((0.74, 2.14, 0.14))
    ]
    bm.faces.new([n_bot[2], n_bot[3], n_chin[1], n_chin[0]])
    bm.faces.new([n_bot[3], b_cor2, n_chin[1]])

    # -------------------------------------------------------------
    # 3. Front Fender & 3D Wheel Well (Y = 2.05 to Y = 0.92)
    # -------------------------------------------------------------
    f_crest = [
        bm.verts.new((0.84, 2.02, 0.58)),
        bm.verts.new((0.89, 1.68, 0.69)),
        bm.verts.new((0.92, 1.30, 0.75)),
        bm.verts.new((0.88, 1.00, 0.77)),
        bm.verts.new((0.84, 0.70, 0.78)), # Cowl corner
    ]
    for i in range(len(f_crest) - 1):
        bm.faces.new([h_rings[i][3], f_crest[i], f_crest[i+1], h_rings[i+1][3]])

    # 3D Wheel Arch Geometry (Semi-circle around front axle Y=1.30, Z=0.33)
    # Angles: 0 deg = rear arch (Y=0.92), 180 deg = front arch (Y=1.68)
    arch_angles = [0, 30, 60, 90, 120, 150, 180]
    arch_outer = []
    arch_inner = []
    fender_x = 0.93
    tub_x = 0.68
    
    for a_deg in arch_angles:
        rad = math.radians(a_deg)
        ay = AXLE_Y_FRONT - ARCH_RADIUS * math.cos(rad)
        az = AXLE_Z + ARCH_RADIUS * math.sin(rad)
        vo = bm.verts.new((fender_x, ay, az))
        vi = bm.verts.new((tub_x, ay, az))
        arch_outer.append(vo)
        arch_inner.append(vi)
        
    for i in range(len(arch_angles) - 1):
        # Cylindrical inner tub liner
        bm.faces.new([arch_outer[i], arch_outer[i+1], arch_inner[i+1], arch_inner[i]])

    # Connect front fender skin above the wheel arch:
    # Front section of arch:
    bm.faces.new([f_crest[1], f_crest[2], arch_outer[3], arch_outer[4]])
    bm.faces.new([f_crest[0], f_crest[1], arch_outer[4], arch_outer[5]])
    bm.faces.new([f_crest[0], arch_outer[5], arch_outer[6], b_cor2])
    # Over-wheel section:
    bm.faces.new([f_crest[2], f_crest[3], arch_outer[2], arch_outer[3]])

    # -------------------------------------------------------------
    # 4. Fender Trailing Edge (Y = 0.92 to Y = 0.70) - WATERTIGHT CLOSURE
    # -------------------------------------------------------------
    # Behind the wheel arch (Y=0.92 to Y=0.70), close the fender cleanly:
    v_arch_rear_top = arch_outer[1] # (0.93, 0.97, 0.52)
    v_arch_rear_mid = arch_outer[0] # (0.93, 0.92, 0.33)
    v_fender_sill_092 = bm.verts.new((0.86, 0.92, 0.15))
    
    # Station at Y = 0.70 where door begins:
    v_door_belt_070 = f_crest[4]                   # (0.84, 0.70, 0.78)
    v_door_crease_070 = bm.verts.new((0.86, 0.70, 0.50))
    v_door_sill_070 = bm.verts.new((0.85, 0.70, 0.15))
    
    # Seal fender upper rear:
    bm.faces.new([f_crest[3], v_door_belt_070, v_door_crease_070, arch_outer[1]])
    bm.faces.new([f_crest[3], arch_outer[1], arch_outer[2]])
    # Seal fender mid rear:
    bm.faces.new([arch_outer[1], v_door_crease_070, v_arch_rear_mid])
    # Seal fender lower rear to rocker sill:
    bm.faces.new([v_arch_rear_mid, v_door_crease_070, v_door_sill_070, v_fender_sill_092])

    # -------------------------------------------------------------
    # 5. Seamless Doors & Rocker Panels (Y = 0.70 to Y = -0.92)
    # -------------------------------------------------------------
    d_v0 = [v_door_belt_070, v_door_crease_070, v_door_sill_070]
    
    mid_door_stations = [
        (0.40,  [(0.80, 0.78), (0.87, 0.50), (0.85, 0.15)]),
        (0.05,  [(0.78, 0.78), (0.86, 0.50), (0.84, 0.15)]),
        (-0.30, [(0.78, 0.78), (0.86, 0.50), (0.84, 0.15)]),
        (-0.65, [(0.80, 0.79), (0.87, 0.52), (0.85, 0.15)]),
    ]
    d_rings = [d_v0]
    for y, pts in mid_door_stations:
        d_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
        
    for s in range(len(d_rings) - 1):
        for p in range(2):
            bm.faces.new([d_rings[s][p], d_rings[s][p+1], d_rings[s+1][p+1], d_rings[s+1][p]])

    # -------------------------------------------------------------
    # 6. Greenhouse (A-Pillars, Double-Bubble Roof, C-Pillars)
    # -------------------------------------------------------------
    # A-Pillar (Y = 0.70 Cowl to Y = 0.05 Roof Front)
    ap_bot_in  = h_rings[-1][3]      # (0.76, 0.70, 0.80)
    ap_bot_out = v_door_belt_070     # (0.84, 0.70, 0.78)
    ap_top_in  = bm.verts.new((0.56, 0.05, 1.16))
    ap_top_out = bm.verts.new((0.62, 0.05, 1.13))
    bm.faces.new([ap_bot_in, ap_bot_out, ap_top_out, ap_top_in])

    # Double-Bubble Roof (Y = 0.05 down to Y = -0.60)
    roof_stations = [
        # Y, [(X0, Z0), (X1, Z1), (X2, Z2), (X_rail, Z_rail)]
        (0.05,  [(0.00, 1.25), (0.18, 1.26), (0.36, 1.23), (0.56, 1.16)]),
        (-0.25, [(0.00, 1.27), (0.18, 1.28), (0.36, 1.25), (0.56, 1.18)]),
        (-0.60, [(0.00, 1.24), (0.18, 1.25), (0.36, 1.22), (0.58, 1.15)]),
    ]
    r_rings = []
    for y, pts in roof_stations:
        r_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(r_rings) - 1):
        for p in range(len(roof_stations[0][1]) - 1):
            bm.faces.new([r_rings[s][p], r_rings[s][p+1], r_rings[s+1][p+1], r_rings[s+1][p]])

    # Roof Side Rails / Cantrails (above door windows)
    cp_top_in  = r_rings[-1][3] # (0.58, -0.60, 1.15)
    cp_top_out = bm.verts.new((0.64, -0.60, 1.11))
    bm.faces.new([ap_top_in, ap_top_out, cp_top_out, cp_top_in])

    # -------------------------------------------------------------
    # 7. Muscular Rear Haunches & 3D Wheel Well (Y = -0.92 to -1.75)
    # -------------------------------------------------------------
    r_arch_outer = []
    r_arch_inner = []
    r_flare_x = 0.96
    
    for a_deg in arch_angles:
        rad = math.radians(a_deg)
        ay = AXLE_Y_REAR - ARCH_RADIUS * math.cos(rad)
        az = AXLE_Z + ARCH_RADIUS * math.sin(rad)
        vo = bm.verts.new((r_flare_x, ay, az))
        vi = bm.verts.new((tub_x, ay, az))
        r_arch_outer.append(vo)
        r_arch_inner.append(vi)
        
    for i in range(len(arch_angles) - 1):
        bm.faces.new([r_arch_outer[i], r_arch_outer[i+1], r_arch_inner[i+1], r_arch_inner[i]])

    # Rear door seam welds directly into front of rear haunch & arch
    v_rear_arch_front = r_arch_outer[6] # (0.96, -0.92, 0.33)
    v_rear_sill = bm.verts.new((0.87, -0.92, 0.15))
    v_rear_belt = bm.verts.new((0.82, -0.92, 0.82))
    
    d_v_rear = [v_rear_belt, v_rear_arch_front, v_rear_sill]
    for p in range(2):
        bm.faces.new([d_rings[-1][p], d_rings[-1][p+1], d_v_rear[p+1], d_v_rear[p]])

    # Fastback C-Pillar connects to rear deck and door belt
    cp_bot_in  = bm.verts.new((0.62, -0.92, 0.94))
    cp_bot_out = v_rear_belt
    bm.faces.new([cp_top_in, cp_top_out, cp_bot_out, cp_bot_in])

    # Haunch Upper Crest (Shoulder line over rear wheels)
    h_crest = [
        v_rear_belt,
        bm.verts.new((0.92, -1.15, 0.85)),
        bm.verts.new((0.95, -1.30, 0.87)), # Peak over rear tire
        bm.verts.new((0.92, -1.55, 0.86)),
        bm.verts.new((0.87, -1.75, 0.84)),
    ]
    bm.faces.new([h_crest[0], h_crest[1], r_arch_outer[5], r_arch_outer[6]])
    bm.faces.new([h_crest[1], h_crest[2], r_arch_outer[3], r_arch_outer[4]])
    bm.faces.new([h_crest[1], r_arch_outer[4], r_arch_outer[5]])
    bm.faces.new([h_crest[2], h_crest[3], r_arch_outer[2], r_arch_outer[3]])
    bm.faces.new([h_crest[3], h_crest[4], r_arch_outer[1], r_arch_outer[2]])
    bm.faces.new([h_crest[4], r_arch_outer[0], r_arch_outer[1]])

    # -------------------------------------------------------------
    # 8. Fastback Rear Decklid & Integrated Ducktail Spoiler
    # -------------------------------------------------------------
    deck_stations = [
        # Y, [(X0, Z0), (X1, Z1), (X2, Z2), (X_shoulder, Z_shoulder)]
        (-0.92, [(0.00, 1.11), (0.20, 1.10), (0.40, 1.05), (0.62, 0.94)]), # Decklid start
        (-1.20, [(0.00, 1.01), (0.22, 1.00), (0.45, 0.95), (0.72, 0.88)]),
        (-1.50, [(0.00, 0.94), (0.22, 0.93), (0.46, 0.90), (0.76, 0.86)]),
        (-1.80, [(0.00, 0.90), (0.23, 0.89), (0.47, 0.88), (0.78, 0.85)]),
        (-2.05, [(0.00, 0.89), (0.24, 0.89), (0.48, 0.89), (0.80, 0.87)]), # Ducktail Lip!
    ]
    dk_rings = []
    for y, pts in deck_stations:
        dk_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(dk_rings) - 1):
        for p in range(len(deck_stations[0][1]) - 1):
            bm.faces.new([dk_rings[s][p], dk_rings[s][p+1], dk_rings[s+1][p+1], dk_rings[s+1][p]])

    # Connect decklid shoulder to haunch crest
    bm.faces.new([cp_bot_in, cp_bot_out, h_crest[1], dk_rings[1][3]])
    bm.faces.new([cp_bot_in, dk_rings[1][3], dk_rings[0][3]])
    bm.faces.new([dk_rings[1][3], h_crest[1], h_crest[2], dk_rings[2][3]])
    bm.faces.new([dk_rings[2][3], h_crest[2], h_crest[3], dk_rings[3][3]])
    bm.faces.new([dk_rings[3][3], h_crest[3], h_crest[4], dk_rings[4][3]])

    # -------------------------------------------------------------
    # 9. Rear Fascia, Taillight Housing & Diffuser Cutout
    # -------------------------------------------------------------
    # Taillight pocket (Y = -2.06 to -2.08)
    tl_pocket = [
        bm.verts.new((0.00, -2.08, 0.82)), bm.verts.new((0.24, -2.08, 0.82)),
        bm.verts.new((0.48, -2.07, 0.81)), bm.verts.new((0.80, -2.04, 0.79))
    ]
    for p in range(len(tl_pocket) - 1):
        bm.faces.new([dk_rings[-1][p], dk_rings[-1][p+1], tl_pocket[p+1], tl_pocket[p]])
        
    rb_mid = [
        bm.verts.new((0.00, -2.14, 0.68)), bm.verts.new((0.20, -2.14, 0.67)),
        bm.verts.new((0.42, -2.12, 0.65)), bm.verts.new((0.74, -2.10, 0.62))
    ]
    for p in range(len(rb_mid) - 1):
        bm.faces.new([tl_pocket[p], tl_pocket[p+1], rb_mid[p+1], rb_mid[p]])
        
    rb_bot = [
        bm.verts.new((0.00, -2.24, 0.42)), bm.verts.new((0.20, -2.23, 0.41)),
        bm.verts.new((0.42, -2.20, 0.38)), bm.verts.new((0.70, -2.16, 0.32))
    ]
    for p in range(len(rb_bot) - 1):
        bm.faces.new([rb_mid[p], rb_mid[p+1], rb_bot[p+1], rb_bot[p]])

    # Rear quarter wrap around to bumper
    rb_side1 = bm.verts.new((0.84, -1.95, 0.50))
    rb_side2 = bm.verts.new((0.84, -1.75, 0.25))
    bm.faces.new([tl_pocket[3], rb_mid[3], rb_side1])
    bm.faces.new([rb_mid[3], rb_bot[3], rb_side2, rb_side1])
    bm.faces.new([h_crest[4], bm.verts.new((0.82, -2.00, 0.86)), tl_pocket[3], rb_side1])
    bm.faces.new([h_crest[4], rb_side1, rb_side2, r_arch_outer[0]])

    # License Plate Recess Pocket (Center rear bumper)
    lp1 = bm.verts.new((0.00, -2.12, 0.64))
    lp2 = bm.verts.new((0.28, -2.12, 0.64))
    lp3 = bm.verts.new((0.28, -2.12, 0.48))
    lp4 = bm.verts.new((0.00, -2.12, 0.48))
    bm.faces.new([lp1, lp2, lp3, lp4])

    # -------------------------------------------------------------
    # 10. Underbody Flat Belly Pan
    # -------------------------------------------------------------
    floor_stations = [2.25, 1.65, 1.05, 0.35, -0.35, -1.05, -1.65, -2.24]
    for i in range(len(floor_stations) - 1):
        y1, y2 = floor_stations[i], floor_stations[i+1]
        v1 = bm.verts.new((0.00, y1, 0.14))
        v2 = bm.verts.new((0.72, y1, 0.14))
        v3 = bm.verts.new((0.72, y2, 0.14))
        v4 = bm.verts.new((0.00, y2, 0.14))
        bm.faces.new([v1, v2, v3, v4])

    # -------------------------------------------------------------
    # Mesh Cleanup, Weld & Symmetry
    # -------------------------------------------------------------
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.035)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    
    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Subsurf")
    
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 6. FLUSH AERODYNAMIC GLASS (Windshield, Side Windows, Fastback)
# ==============================================================================

def build_glass(mats):
    """
    Constructs flush automotive glazing:
    - Raked aerodynamic windshield fitting precisely inside cowl & A-pillars
    - Fully framed side door windows spanning from A-pillar to C-pillar
    - Fastback rear window flowing seamlessly between roof and rear deck
    """
    mesh = bpy.data.meshes.new("APX01_Glass_Mesh")
    obj = bpy.data.objects.new("APX01_Glass", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Glass_Tinted'])
    
    bm = bmesh.new()
    
    # -------------------------------------------------------------
    # 1. Front Windshield (Y = 0.70 Cowl to Y = 0.05 Roof Front)
    # -------------------------------------------------------------
    ws_sections = [
        # Y, [(X, Z)]
        (0.70, [(0.00, 0.865), (0.18, 0.855), (0.36, 0.835), (0.54, 0.810), (0.74, 0.785)]),
        (0.50, [(0.00, 0.995), (0.17, 0.985), (0.34, 0.960), (0.50, 0.925), (0.68, 0.890)]),
        (0.30, [(0.00, 1.115), (0.16, 1.105), (0.32, 1.075), (0.47, 1.035), (0.64, 0.985)]),
        (0.05, [(0.00, 1.250), (0.16, 1.250), (0.31, 1.220), (0.45, 1.160), (0.58, 1.120)]),
    ]
    ws_rings = []
    for y, pts in ws_sections:
        ws_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(ws_rings) - 1):
        for p in range(len(ws_sections[0][1]) - 1):
            bm.faces.new([ws_rings[s][p], ws_rings[s][p+1], ws_rings[s+1][p+1], ws_rings[s+1][p]])

    # -------------------------------------------------------------
    # 2. Side Windows (Fully framed from A-Pillar to C-Pillar)
    # -------------------------------------------------------------
    # Complete multi-segment quad grid matching the window opening profile:
    side_window_rings = [
        # Y, [(X_bot, Z_bot), (X_mid, Z_mid), (X_top, Z_top)]
        (0.70,  [(0.79, 0.79), (0.79, 0.79), (0.79, 0.79)]), # A-pillar base
        (0.35,  [(0.78, 0.79), (0.72, 0.96), (0.68, 0.97)]), # A-pillar mid
        (0.05,  [(0.77, 0.79), (0.68, 0.96), (0.60, 1.12)]), # A-pillar top / Roof rail start
        (-0.30, [(0.77, 0.79), (0.67, 0.97), (0.59, 1.14)]), # Roof rail center
        (-0.60, [(0.78, 0.80), (0.68, 0.96), (0.61, 1.12)]), # C-pillar top
        (-0.90, [(0.80, 0.82), (0.80, 0.82), (0.80, 0.82)]), # C-pillar base
    ]
    sw_rings = []
    for y, pts in side_window_rings:
        sw_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(sw_rings) - 1):
        for p in range(2):
            bm.faces.new([sw_rings[s][p], sw_rings[s][p+1], sw_rings[s+1][p+1], sw_rings[s+1][p]])

    # -------------------------------------------------------------
    # 3. Fastback Rear Glass (Y = -0.60 down to Y = -1.05)
    # -------------------------------------------------------------
    rw_sections = [
        (-0.60, [(0.00, 1.240), (0.16, 1.240), (0.32, 1.210), (0.46, 1.150), (0.58, 1.120)]),
        (-0.80, [(0.00, 1.160), (0.17, 1.150), (0.33, 1.110), (0.47, 1.050), (0.60, 1.010)]),
        (-1.05, [(0.00, 1.070), (0.18, 1.060), (0.34, 1.020), (0.48, 0.970), (0.62, 0.930)]),
    ]
    rw_rings = []
    for y, pts in rw_sections:
        rw_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(rw_rings) - 1):
        for p in range(len(rw_sections[0][1]) - 1):
            bm.faces.new([rw_rings[s][p], rw_rings[s][p+1], rw_rings[s+1][p+1], rw_rings[s+1][p]])

    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.015)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 7. PERFORMANCE AERODYNAMIC TRIM, SPLITTER, DIFFUSER & EXHAUST
# ==============================================================================

def build_trim(mats):
    """
    Constructs high-downforce aerodynamic components:
    - Sculpted front carbon splitter with side aero winglets
    - Lower front intake honeycomb texture insert & brake cooling ducts
    - Aerodynamic side skirts with rear dive planes
    - Aggressive rear racing diffuser with 4 vertical strakes
    - Quad polished stainless steel exhaust cannons
    - Sleek twin-stalk aerodynamic side mirrors with reflective glass
    - "APX-01" vanity license plate
    """
    mesh = bpy.data.meshes.new("APX01_Trim_Mesh")
    obj = bpy.data.objects.new("APX01_Trim", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Trim_Black']) # 0
    obj.data.materials.append(mats['M_Metal'])      # 1
    
    bm = bmesh.new()
    
    # -------------------------------------------------------------
    # A. Front Splitter (Carbon Chin Spoiler)
    # -------------------------------------------------------------
    split_pts = [
        (0.00, 2.30, 0.11), (0.24, 2.29, 0.11), (0.48, 2.26, 0.11),
        (0.68, 2.20, 0.11), (0.80, 2.10, 0.12), (0.86, 1.96, 0.13)
    ]
    sp_top, sp_bot, sp_inner = [], [], []
    for x, y, z in split_pts:
        sp_top.append(bm.verts.new((x, y, z + 0.02)))
        sp_bot.append(bm.verts.new((x, y, z)))
        sp_inner.append(bm.verts.new((x * 0.75, y - 0.18, 0.13)))
        
    for i in range(len(split_pts) - 1):
        f_top = bm.faces.new([sp_top[i], sp_top[i+1], sp_inner[i+1], sp_inner[i]])
        f_edge = bm.faces.new([sp_bot[i], sp_bot[i+1], sp_top[i+1], sp_top[i]])
        f_top.material_index = 0
        f_edge.material_index = 0
        
    # Splitter Side Winglet
    w1 = bm.verts.new((0.86, 1.96, 0.13))
    w2 = bm.verts.new((0.88, 2.08, 0.12))
    wt1 = bm.verts.new((0.86, 1.96, 0.22))
    wt2 = bm.verts.new((0.88, 2.08, 0.22))
    f_w = bm.faces.new([w1, w2, wt2, wt1])
    f_w.material_index = 0

    # -------------------------------------------------------------
    # B. Front Lower Intake Grille & Side Brake Ducts
    # -------------------------------------------------------------
    g_pts = [
        bm.verts.new((0.00, 2.18, 0.16)), bm.verts.new((0.45, 2.16, 0.16)),
        bm.verts.new((0.42, 2.16, 0.38)), bm.verts.new((0.00, 2.18, 0.38))
    ]
    f_g = bm.faces.new(g_pts)
    f_g.material_index = 0
    
    d_pts = [
        bm.verts.new((0.55, 2.08, 0.17)), bm.verts.new((0.76, 2.00, 0.17)),
        bm.verts.new((0.74, 2.00, 0.36)), bm.verts.new((0.54, 2.08, 0.36))
    ]
    f_d = bm.faces.new(d_pts)
    f_d.material_index = 0

    # -------------------------------------------------------------
    # C. Side Skirts with Aero Fins
    # -------------------------------------------------------------
    sk_y = [0.92, 0.55, 0.15, -0.25, -0.65, -0.92]
    sk_out, sk_in = [], []
    for y in sk_y:
        flare = 0.86 + 0.035 * ((0.92 - y) / 1.84)
        sk_out.append(bm.verts.new((flare, y, 0.125)))
        sk_in.append(bm.verts.new((flare - 0.06, y, 0.125)))
        
    for i in range(len(sk_y) - 1):
        f_sk = bm.faces.new([sk_out[i], sk_out[i+1], sk_in[i+1], sk_in[i]])
        f_sk.material_index = 0
        
    skw1 = bm.verts.new((0.895, -0.92, 0.125))
    skw2 = bm.verts.new((0.895, -0.82, 0.125))
    skwt1 = bm.verts.new((0.895, -0.92, 0.22))
    skwt2 = bm.verts.new((0.895, -0.82, 0.22))
    f_skw = bm.faces.new([skw1, skw2, skwt2, skwt1])
    f_skw.material_index = 0

    # -------------------------------------------------------------
    # D. Rear Diffuser with 4 Vertical Aero Fins
    # -------------------------------------------------------------
    diff_v = [
        bm.verts.new((0.00, -2.12, 0.17)), bm.verts.new((0.68, -2.10, 0.17)),
        bm.verts.new((0.68, -2.26, 0.24)), bm.verts.new((0.00, -2.26, 0.24))
    ]
    f_diff = bm.faces.new(diff_v)
    f_diff.material_index = 0
    
    for fx in [0.22, 0.45]:
        v1 = bm.verts.new((fx, -2.10, 0.17))
        v2 = bm.verts.new((fx, -2.26, 0.24))
        v3 = bm.verts.new((fx, -2.26, 0.12))
        v4 = bm.verts.new((fx, -2.10, 0.12))
        f_fin = bm.faces.new([v1, v2, v3, v4])
        f_fin.material_index = 0

    # -------------------------------------------------------------
    # E. Quad Polished Stainless Steel Exhaust Tips (Twin dual pipes)
    # -------------------------------------------------------------
    for ex_x in [0.48, 0.58]:
        ex_y_tip = -2.25
        ex_y_in = -2.12
        ex_z = 0.25
        ex_r = 0.042
        ex_segs = 16
        
        tip_r, in_r = [], []
        for i in range(ex_segs):
            ang = i * (2.0 * math.pi / ex_segs)
            dx, dz = ex_r * math.cos(ang), ex_r * math.sin(ang)
            tip_r.append(bm.verts.new((ex_x + dx, ex_y_tip, ex_z + dz)))
            in_r.append(bm.verts.new((ex_x + dx, ex_y_in, ex_z + dz)))
            
        for i in range(ex_segs):
            inext = (i + 1) % ex_segs
            f_ex = bm.faces.new([tip_r[i], tip_r[inext], in_r[inext], in_r[i]])
            f_ex.material_index = 1 # M_Metal

    # -------------------------------------------------------------
    # F. Aerodynamic Side Mirrors
    # -------------------------------------------------------------
    st_b1 = bm.verts.new((0.76, 0.52, 0.79))
    st_b2 = bm.verts.new((0.78, 0.54, 0.79))
    st_m1 = bm.verts.new((0.88, 0.50, 0.86))
    st_m2 = bm.verts.new((0.90, 0.52, 0.86))
    f_st = bm.faces.new([st_b1, st_b2, st_m2, st_m1])
    f_st.material_index = 0
    
    hx, hy, hz = 0.94, 0.52, 0.88
    m_verts = [
        bm.verts.new((hx - 0.06, hy - 0.05, hz - 0.03)),
        bm.verts.new((hx + 0.06, hy - 0.07, hz - 0.03)),
        bm.verts.new((hx + 0.06, hy + 0.06, hz - 0.02)),
        bm.verts.new((hx - 0.06, hy + 0.07, hz - 0.02)),
        bm.verts.new((hx - 0.06, hy - 0.05, hz + 0.03)),
        bm.verts.new((hx + 0.06, hy - 0.07, hz + 0.03)),
        bm.verts.new((hx + 0.06, hy + 0.06, hz + 0.04)),
        bm.verts.new((hx - 0.06, hy + 0.07, hz + 0.04)),
    ]
    box_faces = [
        [0, 1, 2, 3], [4, 7, 6, 5],
        [0, 4, 5, 1], [2, 6, 7, 3],
        [1, 5, 6, 2], [3, 7, 4, 0]
    ]
    for bf in box_faces:
        f_box = bm.faces.new([m_verts[idx] for idx in bf])
        f_box.material_index = 1 if bf == [3, 7, 4, 0] else 0 # Mirror glass face

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 8. LIGHTING ELEMENTS (Front Projectors & Rear OLED Bar)
# ==============================================================================

def build_front_lights(mats):
    """
    Constructs front headlights:
    - Recessed smoked housing bucket
    - Dual LED crystal projector lenses
    - Aggressive DRL light blade strip running along fender crease
    """
    mesh = bpy.data.meshes.new("APX01_Lights_Front_Mesh")
    obj = bpy.data.objects.new("APX01_Lights_Front", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Headlight'])  # 0
    obj.data.materials.append(mats['M_Trim_Black']) # 1
    
    bm = bmesh.new()
    
    # DRL Light Blade along fender corner
    drl_curve = [
        (0.60, 1.94, 0.58),
        (0.70, 1.90, 0.60),
        (0.80, 1.82, 0.62),
        (0.87, 1.72, 0.64)
    ]
    drl_top, drl_bot = [], []
    for x, y, z in drl_curve:
        drl_top.append(bm.verts.new((x, y, z + 0.024)))
        drl_bot.append(bm.verts.new((x, y, z)))
        
    for i in range(len(drl_curve) - 1):
        f = bm.faces.new([drl_bot[i], drl_bot[i+1], drl_top[i+1], drl_top[i]])
        f.material_index = 0

    # Dual Circular LED Projector Lenses
    for px, py, pz in [(0.68, 1.88, 0.57), (0.78, 1.80, 0.59)]:
        pr = 0.040
        psegs = 16
        ring = []
        for i in range(psegs):
            ang = i * (2.0 * math.pi / psegs)
            ring.append(bm.verts.new((px + pr * math.cos(ang), py, pz + pr * math.sin(ang))))
        center_v = bm.verts.new((px, py + 0.020, pz))
        for i in range(psegs):
            inext = (i + 1) % psegs
            f_lens = bm.faces.new([center_v, ring[i], ring[inext]])
            f_lens.material_index = 0

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    apply_smoothing_and_normals(obj)
    return obj

def build_rear_lights(mats):
    """
    Constructs rear taillights:
    - Full-width slim OLED light bar spanning across the ducktail deck
    - High-luminance glowing crimson brake/taillight elements
    """
    mesh = bpy.data.meshes.new("APX01_Lights_Rear_Mesh")
    obj = bpy.data.objects.new("APX01_Lights_Rear", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Taillight'])  # 0
    obj.data.materials.append(mats['M_Trim_Black']) # 1
    
    bm = bmesh.new()
    
    tail_pts = [
        (0.00, -2.08, 0.84),
        (0.20, -2.08, 0.84),
        (0.42, -2.07, 0.83),
        (0.62, -2.05, 0.81),
        (0.74, -2.02, 0.78)
    ]
    t_top, t_bot = [], []
    for x, y, z in tail_pts:
        t_top.append(bm.verts.new((x, y, z + 0.038)))
        t_bot.append(bm.verts.new((x, y, z)))
        
    for i in range(len(tail_pts) - 1):
        f = bm.faces.new([t_bot[i], t_bot[i+1], t_top[i+1], t_top[i]])
        f.material_index = 0

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 9. INTERIOR SILHOUETTE
# ==============================================================================

def build_interior(mats):
    """
    Constructs lightweight cockpit interior:
    - Floor tub and interior door bulkheads
    - Sports bucket seats with lateral bolsters and headrests
    - Dashboard binnacle and center tunnel
    - 3-spoke sports steering wheel
    """
    mesh = bpy.data.meshes.new("APX01_Interior_Mesh")
    obj = bpy.data.objects.new("APX01_Interior", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Interior_Dark'])
    
    bm = bmesh.new()
    
    # Floor tub
    fv = [
        bm.verts.new((-0.62, 0.65, 0.28)), bm.verts.new((0.62, 0.65, 0.28)),
        bm.verts.new((0.62, -0.95, 0.28)), bm.verts.new((-0.62, -0.95, 0.28))
    ]
    bm.faces.new(fv)
    
    # Dashboard & Center Console
    dv = [
        bm.verts.new((-0.60, 0.55, 0.76)), bm.verts.new((0.60, 0.55, 0.76)),
        bm.verts.new((0.60, 0.22, 0.70)), bm.verts.new((-0.60, 0.22, 0.70)),
        bm.verts.new((-0.60, 0.55, 0.45)), bm.verts.new((0.60, 0.55, 0.45)),
    ]
    bm.faces.new([dv[0], dv[1], dv[2], dv[3]])
    bm.faces.new([dv[3], dv[2], dv[5], dv[4]])
    
    cv = [
        bm.verts.new((-0.12, 0.22, 0.52)), bm.verts.new((0.12, 0.22, 0.52)),
        bm.verts.new((0.12, -0.65, 0.42)), bm.verts.new((-0.12, -0.65, 0.42))
    ]
    bm.faces.new(cv)

    # Sports Bucket Seats (Driver & Passenger)
    for sx in [-0.34, 0.34]:
        w_c = 0.21
        sc = [
            bm.verts.new((sx - w_c, -0.05, 0.38)), bm.verts.new((sx + w_c, -0.05, 0.38)),
            bm.verts.new((sx + w_c, -0.48, 0.32)), bm.verts.new((sx - w_c, -0.48, 0.32))
        ]
        bm.faces.new(sc)
        
        sb = [
            bm.verts.new((sx - w_c * 0.95, -0.46, 0.38)), bm.verts.new((sx + w_c * 0.95, -0.46, 0.38)),
            bm.verts.new((sx + w_c * 0.80, -0.64, 0.88)), bm.verts.new((sx - w_c * 0.80, -0.64, 0.88))
        ]
        bm.faces.new(sb)
        
        hr_w = 0.11
        hr = [
            bm.verts.new((sx - hr_w, -0.62, 0.88)), bm.verts.new((sx + hr_w, -0.62, 0.88)),
            bm.verts.new((sx + hr_w, -0.66, 1.01)), bm.verts.new((sx - hr_w, -0.66, 1.01))
        ]
        bm.faces.new(hr)

    # 3-Spoke Sports Steering Wheel
    sw_x = -0.34
    sw_y = 0.14
    sw_z = 0.69
    sw_r = 0.155
    sw_segs = 20
    sw_ring = []
    for i in range(sw_segs):
        ang = i * (2.0 * math.pi / sw_segs)
        dy = -sw_r * math.sin(ang) * 0.35
        dz = sw_r * math.sin(ang) * 0.94
        dx = sw_r * math.cos(ang)
        sw_ring.append(bm.verts.new((sw_x + dx, sw_y + dy, sw_z + dz)))
    sw_hub = bm.verts.new((sw_x, sw_y + 0.025, sw_z))
    for i in range(sw_segs):
        inext = (i + 1) % sw_segs
        bm.faces.new([sw_hub, sw_ring[i], sw_ring[inext]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 10. HIGH-FIDELITY WHEEL & BRAKE ASSEMBLY GENERATOR
# ==============================================================================

def build_wheel_assembly(name, center_pos, is_left, mats):
    """
    Constructs an independent wheel object with origin at exact axle center:
    - 48-segment round performance tire with realistic tread profile & sidewalls
    - 19-inch deep concave satin black rim with outer stepped lip
    - 5 Split-spoke (10 spokes) motorsport rim geometry with center recess & lug nuts
    - High-performance cross-drilled ventilated brake disc rotor in brushed steel
    - 4-Piston monobloc Brembo-style brake caliper in gloss race red
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    # Assign materials to slots
    obj.data.materials.append(mats['M_Tire_Rubber'])   # Slot 0
    obj.data.materials.append(mats['M_Wheel_Black'])   # Slot 1
    obj.data.materials.append(mats['M_Metal'])         # Slot 2 (Rotor & Lug nuts)
    obj.data.materials.append(mats['M_Brake_Caliper']) # Slot 3 (Caliper)
    
    bm = bmesh.new()
    
    SEGS = 48
    sign_x = -1.0 if is_left else 1.0
    w_half = TIRE_WIDTH * 0.5
    
    # -------------------------------------------------------------
    # A. Tire Geometry
    # -------------------------------------------------------------
    tire_profiles = [
        # (local_x, radius)
        (-w_half, RIM_RADIUS),
        (-w_half * 0.95, WHEEL_RADIUS * 0.92),
        (-w_half * 0.82, WHEEL_RADIUS),
        ( w_half * 0.82, WHEEL_RADIUS),
        ( w_half * 0.95, WHEEL_RADIUS * 0.92),
        ( w_half, RIM_RADIUS),
    ]
    
    t_rings = []
    for lx, r in tire_profiles:
        ring = []
        for i in range(SEGS):
            ang = i * (2.0 * math.pi / SEGS)
            ly = r * math.cos(ang)
            lz = r * math.sin(ang)
            ring.append(bm.verts.new((lx, ly, lz)))
        t_rings.append(ring)
        
    for s in range(len(t_rings) - 1):
        for i in range(SEGS):
            inext = (i + 1) % SEGS
            f = bm.faces.new([t_rings[s][i], t_rings[s+1][i], t_rings[s+1][inext], t_rings[s][inext]])
            f.material_index = 0

    # -------------------------------------------------------------
    # B. Rim Lip & Deep Barrel
    # -------------------------------------------------------------
    outer_x = sign_x * (w_half + 0.008)
    inner_x = -sign_x * (w_half - 0.015)
    
    rim_profiles = [
        (outer_x, RIM_RADIUS),
        (outer_x - sign_x * 0.025, RIM_RADIUS * 0.96),
        (outer_x - sign_x * 0.055, RIM_RADIUS * 0.90),
        (inner_x, RIM_RADIUS * 0.88),
    ]
    r_rings = []
    for lx, r in rim_profiles:
        ring = []
        for i in range(SEGS):
            ang = i * (2.0 * math.pi / SEGS)
            ly = r * math.cos(ang)
            lz = r * math.sin(ang)
            ring.append(bm.verts.new((lx, ly, lz)))
        r_rings.append(ring)
        
    for s in range(len(r_rings) - 1):
        for i in range(SEGS):
            inext = (i + 1) % SEGS
            f = bm.faces.new([r_rings[s][i], r_rings[s+1][i], r_rings[s+1][inext], r_rings[s][inext]])
            f.material_index = 1

    # Connect rim lip to tire bead
    outer_tire_ring = t_rings[0] if is_left else t_rings[-1]
    for i in range(SEGS):
        inext = (i + 1) % SEGS
        f = bm.faces.new([outer_tire_ring[i], r_rings[0][i], r_rings[0][inext], outer_tire_ring[inext]])
        f.material_index = 1

    # -------------------------------------------------------------
    # C. Concave 5 Split-Spoke Face & Hub
    # -------------------------------------------------------------
    hub_x = outer_x - sign_x * 0.065
    hub_r = 0.075
    hub_segs = 20
    hub_ring = []
    for i in range(hub_segs):
        ang = i * (2.0 * math.pi / hub_segs)
        hub_ring.append(bm.verts.new((hub_x, hub_r * math.cos(ang), hub_r * math.sin(ang))))
    center_hub_v = bm.verts.new((hub_x - sign_x * 0.015, 0.0, 0.0))
    for i in range(hub_segs):
        inext = (i + 1) % hub_segs
        f = bm.faces.new([center_hub_v, hub_ring[i], hub_ring[inext]])
        f.material_index = 1
        
    # 5 Chrome Lug Nuts
    for l_idx in range(5):
        l_ang = l_idx * (2.0 * math.pi / 5.0)
        l_dist = 0.045
        lx = hub_x + sign_x * 0.005
        ly = l_dist * math.cos(l_ang)
        lz = l_dist * math.sin(l_ang)
        lug_v = bm.verts.new((lx, ly, lz))
        l_ring = []
        for li in range(6):
            la = li * (2.0 * math.pi / 6.0)
            l_ring.append(bm.verts.new((hub_x, ly + 0.008 * math.cos(la), lz + 0.008 * math.sin(la))))
        for li in range(6):
            linext = (li + 1) % 6
            f_lug = bm.faces.new([lug_v, l_ring[li], l_ring[linext]])
            f_lug.material_index = 2 # M_Metal

    # 5 Split Spokes (10 distinct spoke branches connecting to rim barrel)
    spoke_ring = r_rings[2]
    num_spokes = 5
    for s_idx in range(num_spokes):
        base_angle = s_idx * (2.0 * math.pi / num_spokes)
        for offset in [-0.10, 0.10]: # Split-spoke branches
            a1 = base_angle + offset - 0.05
            a2 = base_angle + offset + 0.05
            
            # Find closest vertices on rim barrel
            i1 = int(round((a1 % (2.0 * math.pi)) / (2.0 * math.pi) * SEGS)) % SEGS
            i2 = int(round((a2 % (2.0 * math.pi)) / (2.0 * math.pi) * SEGS)) % SEGS
            
            # Find closest vertices on hub
            hi1 = int(round((a1 % (2.0 * math.pi)) / (2.0 * math.pi) * hub_segs)) % hub_segs
            hi2 = int(round((a2 % (2.0 * math.pi)) / (2.0 * math.pi) * hub_segs)) % hub_segs
            
            try:
                f_spoke = bm.faces.new([hub_ring[hi1], hub_ring[hi2], spoke_ring[i2], spoke_ring[i1]])
                f_spoke.material_index = 1
            except Exception:
                pass

    # -------------------------------------------------------------
    # D. Ventilated Cross-Drilled Brake Rotor
    # -------------------------------------------------------------
    disc_x = outer_x - sign_x * 0.090
    disc_r_out = RIM_RADIUS * 0.78
    disc_r_in = hub_r * 1.15
    disc_segs = 24
    
    d_out, d_in = [], []
    for i in range(disc_segs):
        ang = i * (2.0 * math.pi / disc_segs)
        d_out.append(bm.verts.new((disc_x, disc_r_out * math.cos(ang), disc_r_out * math.sin(ang))))
        d_in.append(bm.verts.new((disc_x, disc_r_in * math.cos(ang), disc_r_in * math.sin(ang))))
        
    for i in range(disc_segs):
        inext = (i + 1) % disc_segs
        f_disc = bm.faces.new([d_in[i], d_in[inext], d_out[inext], d_out[i]])
        f_disc.material_index = 2 # M_Metal

    # -------------------------------------------------------------
    # E. High-Gloss Racing Brake Caliper
    # -------------------------------------------------------------
    cal_top_deg = 80 if is_left else 100
    cal_half_ang = 28 # degrees
    c_rad1 = math.radians(cal_top_deg - cal_half_ang)
    c_rad2 = math.radians(cal_top_deg + cal_half_ang)
    c_r1 = disc_r_out * 0.82
    c_r2 = disc_r_out * 1.05
    c_x1 = disc_x - sign_x * 0.025
    c_x2 = disc_x + sign_x * 0.025
    
    cv0 = bm.verts.new((c_x1, c_r1 * math.cos(c_rad1), c_r1 * math.sin(c_rad1)))
    cv1 = bm.verts.new((c_x1, c_r2 * math.cos(c_rad1), c_r2 * math.sin(c_rad1)))
    cv2 = bm.verts.new((c_x1, c_r2 * math.cos(c_rad2), c_r2 * math.sin(c_rad2)))
    cv3 = bm.verts.new((c_x1, c_r1 * math.cos(c_rad2), c_r1 * math.sin(c_rad2)))
    
    cv4 = bm.verts.new((c_x2, c_r1 * math.cos(c_rad1), c_r1 * math.sin(c_rad1)))
    cv5 = bm.verts.new((c_x2, c_r2 * math.cos(c_rad1), c_r2 * math.sin(c_rad1)))
    cv6 = bm.verts.new((c_x2, c_r2 * math.cos(c_rad2), c_r2 * math.sin(c_rad2)))
    cv7 = bm.verts.new((c_x2, c_r1 * math.cos(c_rad2), c_r1 * math.sin(c_rad2)))
    
    cal_faces = [
        [cv0, cv1, cv2, cv3], [cv7, cv6, cv5, cv4],
        [cv0, cv4, cv5, cv1], [cv2, cv6, cv7, cv3],
        [cv1, cv5, cv6, cv2], [cv3, cv7, cv4, cv0]
    ]
    for cf in cal_faces:
        f_cal = bm.faces.new(cf)
        f_cal.material_index = 3 # M_Brake_Caliper

    # -------------------------------------------------------------
    # Finalize Mesh & Set Wheel World Position
    # -------------------------------------------------------------
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    apply_smoothing_and_normals(obj)
    
    # Position object in world space so origin stays exactly at axle center!
    obj.location = center_pos
    return obj

# ==============================================================================
# 11. SCENE ORGANIZATION & COLLECTION HIERARCHY
# ==============================================================================

def organize_scene(vehicle_objects):
    """Sorts all vehicle objects into the APX01_Vehicle collection."""
    col = bpy.data.collections.new("APX01_Vehicle")
    bpy.context.scene.collection.children.link(col)
    for obj in vehicle_objects:
        for c in obj.users_collection:
            c.objects.unlink(obj)
        col.objects.link(obj)
    return col

def count_polys_and_tris(objects):
    """Calculates polygon and triangle counts across all vehicle meshes."""
    total_polys = 0
    total_tris = 0
    stats = {}
    for obj in objects:
        if obj.type == 'MESH':
            polys = len(obj.data.polygons)
            tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
            total_polys += polys
            total_tris += tris
            stats[obj.name] = (polys, tris)
    return total_polys, total_tris, stats

# ==============================================================================
# 12. STUDIO SETUP & HIGH-RES INSPECTION RENDERING
# ==============================================================================

def setup_studio():
    """Sets up an automotive studio with key, fill, rim lights and camera."""
    studio_col = bpy.data.collections.new("APX01_Studio")
    bpy.context.scene.collection.children.link(studio_col)
    
    world = bpy.context.scene.world or bpy.data.worlds.new("Studio_World")
    bpy.context.scene.world = world
    world.color = (0.24, 0.26, 0.30)
    
    cam_data = bpy.data.cameras.new("Studio_Camera")
    cam_data.lens = 55.0
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("Studio_Camera", cam_data)
    studio_col.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    # Floor presentation plane
    floor_mesh = bpy.data.meshes.new("Studio_Floor_Mesh")
    floor_obj = bpy.data.objects.new("Studio_Floor", floor_mesh)
    studio_col.objects.link(floor_obj)
    bm_f = bmesh.new()
    f_sz = 25.0
    fv = [
        bm_f.verts.new((-f_sz, -f_sz, 0.0)), bm_f.verts.new((f_sz, -f_sz, 0.0)),
        bm_f.verts.new((f_sz, f_sz, 0.0)), bm_f.verts.new((-f_sz, f_sz, 0.0))
    ]
    bm_f.faces.new(fv)
    bm_f.to_mesh(floor_mesh)
    bm_f.free()
    
    floor_mat = bpy.data.materials.new("M_Studio_Floor")
    floor_mat.use_nodes = True
    bsdf_f = floor_mat.node_tree.nodes.get("Principled BSDF")
    if bsdf_f:
        bsdf_f.inputs['Base Color'].default_value = (0.35, 0.37, 0.40, 1.0)
        bsdf_f.inputs['Roughness'].default_value = 0.45
        bsdf_f.inputs['Metallic'].default_value = 0.1
    floor_obj.data.materials.append(floor_mat)
    
    # 3-Point Studio Lighting
    lights_data = [
        ("Key_Light", 'AREA', (4.5, 4.0, 5.0), 3000.0, (1.0, 0.98, 0.95)),
        ("Fill_Light", 'AREA', (-5.0, 3.0, 4.0), 1800.0, (0.92, 0.95, 1.0)),
        ("Rim_Light_Left", 'AREA', (-4.5, -4.5, 4.2), 2200.0, (1.0, 0.95, 0.90)),
        ("Rim_Light_Right", 'AREA', (4.5, -4.5, 4.2), 2200.0, (0.95, 0.98, 1.0)),
        ("Top_Softbox", 'AREA', (0.0, 0.0, 6.0), 1500.0, (1.0, 1.0, 1.0)),
    ]
    for lname, ltype, lpos, lenergy, lcol in lights_data:
        l_data = bpy.data.lights.new(name=lname, type=ltype)
        l_data.energy = lenergy
        l_data.color = lcol
        if ltype == 'AREA':
            l_data.size = 5.0
        l_obj = bpy.data.objects.new(name=lname, object_data=l_data)
        l_obj.location = lpos
        studio_col.objects.link(l_obj)
        
    return studio_col, cam_obj

def render_inspection_views(cam_obj):
    """Renders 5 canonical automotive inspection passes."""
    views = [
        ("apx01_front_quarter.png", (4.2, 5.2, 2.2), (0.0, 0.0, 0.65)),
        ("apx01_rear_quarter.png", (-4.4, -5.0, 2.3), (0.0, 0.0, 0.65)),
        ("apx01_side.png", (6.2, 0.0, 1.3), (0.0, 0.0, 0.65)),
        ("apx01_front.png", (0.0, 6.2, 1.3), (0.0, 0.0, 0.65)),
        ("apx01_rear.png", (0.0, -6.2, 1.3), (0.0, 0.0, 0.65)),
    ]
    
    print("Rendering inspection views...")
    for filename, eye, target in views:
        cam_obj.location = eye
        direction = mathutils.Vector(target) - mathutils.Vector(eye)
        cam_obj.rotation_mode = 'QUATERNION'
        cam_obj.rotation_quaternion = direction.to_track_quat('-Z', 'Y')
        
        filepath = os.path.join(ASSET_DIR, filename)
        bpy.context.scene.render.filepath = filepath
        bpy.ops.render.render(write_still=True)
        print(f"Rendered: {filename}")
        
    print(f"Rendered {len(views)} views.")

# ==============================================================================
# 13. GAME-READY glTF 2.0 EXPORT & RE-IMPORT AUDIT
# ==============================================================================

def export_vehicle_to_glb(vehicle_col):
    """
    Exports the vehicle asset to GLB:
    - Only vehicle objects are exported
    - Separate wheel pivots preserved (export_apply=False)
    - PBR materials included
    """
    bpy.ops.object.select_all(action='DESELECT')
    for obj in vehicle_col.objects:
        obj.select_set(True)
        
    bpy.ops.export_scene.gltf(
        filepath=GLB_FILE,
        export_format='GLB',
        use_selection=True,
        export_apply=False, # Crucial: Preserves independent wheel pivots and translation offsets!
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_extras=True
    )
    print(f"GLB Exported: {GLB_FILE}")

def verify_exported_glb():
    """Re-imports the exported GLB in an isolated scene to verify objects, wheel pivots & materials."""
    print("Verifying exported GLB...")
    if not os.path.exists(GLB_FILE):
        raise FileNotFoundError(f"Exported GLB not found at {GLB_FILE}")
        
    file_size_kb = os.path.getsize(GLB_FILE) / 1024.0
    print(f"GLB Size: {file_size_kb:.1f} KB")
    
    # Isolate check in fresh scene
    test_scene = bpy.data.scenes.new("GLB_Verification_Scene")
    bpy.context.window.scene = test_scene
    bpy.ops.import_scene.gltf(filepath=GLB_FILE)
    
    imported_names = [obj.name for obj in test_scene.objects if obj.type == 'MESH']
    print(f"Verified Objects ({len(imported_names)}): {sorted(imported_names)}")
    
    required_objects = ['APX01_Body', 'APX01_Glass', 'APX01_Interior', 'APX01_Lights_Front', 'APX01_Lights_Rear', 'APX01_Trim', 'FL_Wheel', 'FR_Wheel', 'RL_Wheel', 'RR_Wheel']
    for req in required_objects:
        assert req in imported_names, f"Missing required object in GLB: {req}"
        
    for w_name in ['FL_Wheel', 'FR_Wheel', 'RL_Wheel', 'RR_Wheel']:
        w_obj = test_scene.objects.get(w_name)
        assert w_obj is not None, f"Wheel object {w_name} missing!"
        print(f" Wheel {w_name} OK at {tuple(w_obj.location)}")
        
    bpy.data.scenes.remove(test_scene)

# ==============================================================================
# 14. MAIN EXECUTION PIPELINE
# ==============================================================================

def main():
    print("=" * 60)
    print("Starting APX-01 Version 8.0 Master Pipeline")
    print("=" * 60)
    
    reset_scene()
    mats = create_pbr_materials()
    print("Materials initialized.")
    
    # 1. Build Primary Vehicle Components
    body_obj = build_body(mats)
    glass_obj = build_glass(mats)
    trim_obj = build_trim(mats)
    f_lights_obj = build_front_lights(mats)
    r_lights_obj = build_rear_lights(mats)
    interior_obj = build_interior(mats)
    
    # 2. Build 4 Independent Wheel Assemblies (Centered at axle pivots)
    half_track_f = TRACK_WIDTH_FRONT * 0.5
    half_track_r = TRACK_WIDTH_REAR * 0.5
    
    fl_wheel = build_wheel_assembly("FL_Wheel", (-half_track_f, AXLE_Y_FRONT, AXLE_Z), is_left=True, mats=mats)
    fr_wheel = build_wheel_assembly("FR_Wheel", ( half_track_f, AXLE_Y_FRONT, AXLE_Z), is_left=False, mats=mats)
    rl_wheel = build_wheel_assembly("RL_Wheel", (-half_track_r, AXLE_Y_REAR,  AXLE_Z), is_left=True, mats=mats)
    rr_wheel = build_wheel_assembly("RR_Wheel", ( half_track_r, AXLE_Y_REAR,  AXLE_Z), is_left=False, mats=mats)
    
    vehicle_objects = [
        body_obj, glass_obj, trim_obj, f_lights_obj, r_lights_obj, interior_obj,
        fl_wheel, fr_wheel, rl_wheel, rr_wheel
    ]
    
    # 3. Organize Hierarchy & Calculate Metrics
    vehicle_col = organize_scene(vehicle_objects)
    total_polys, total_tris, stats = count_polys_and_tris(vehicle_objects)
    
    print("-" * 50)
    print("APX-01 GEOMETRY AUDIT:")
    for name, (p, t) in sorted(stats.items()):
        print(f"  {name:<20}: {p:>5} polys | {t:>6} tris")
    print("-" * 50)
    print(f"TOTAL VEHICLE: {total_polys} polygons | {total_tris} triangles")
    print("-" * 50)
    
    # 4. Studio Setup & Inspection Passes
    studio_col, cam_obj = setup_studio()
    render_inspection_views(cam_obj)
    
    # 5. Clean Studio Objects Prior to Saving Asset Scene
    bpy.data.objects.remove(bpy.data.objects.get("Studio_Floor"), do_unlink=True)
    bpy.data.collections.remove(studio_col)
    
    # 6. Save Native Blender Project (.blend)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_FILE)
    print(f"Saved: {BLEND_FILE}")
    
    # 7. Export glTF 2.0 Binary (.glb)
    export_vehicle_to_glb(vehicle_col)
    
    # 8. Verify glTF Integrity
    verify_exported_glb()
    
    print("=" * 60)
    print("APX-01 Version 8.0 Pipeline Completed Successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
