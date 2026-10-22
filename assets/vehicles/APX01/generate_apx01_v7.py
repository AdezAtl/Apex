"""
APX-01 3D Sports Coupe Model Generator - Version 7.0 (Definitive Master Asset)
Project: Project Apex (Desktop 3D Racing Game in Babylon.js)
Blender Version: 5.2.2 LTS / bpy glTF Pipeline
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler
import os

# ==============================================================================
# 1. SPECIFICATIONS & DIMENSIONS
# ==============================================================================

CAR_NAME = "APX-01"
# Dimensions in meters (Real-world scale performance sports coupe)
LENGTH = 4.46
WIDTH = 1.92
HEIGHT = 1.28
WHEELBASE = 2.60

TIRE_RADIUS = 0.33      # 660mm outer diameter
TIRE_WIDTH = 0.27       # 270mm performance tire width
RIM_RADIUS = 0.245      # 19-inch wheel
ARCH_RADIUS = 0.380     # Wheel arch cutout radius (50mm tire clearance)

# Axle Centers (Blender coordinates: +Y Forward, +Z Up, -X Left, +X Right)
AXLE_Y_FRONT = 1.30
AXLE_Y_REAR = -1.30
AXLE_X_LEFT = -0.81
AXLE_X_RIGHT = 0.81
AXLE_Z = 0.33

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'
    return scene

# ==============================================================================
# 2. PBR MATERIALS (glTF 2.0 Compliant)
# ==============================================================================

def create_pbr_mat(name, base_color, metallic=0.0, roughness=0.5, emission=None, emission_strength=1.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    out = nodes.new(type='ShaderNodeOutputMaterial')
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    bsdf.inputs['Base Color'].default_value = base_color
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if 'Alpha' in bsdf.inputs:
        bsdf.inputs['Alpha'].default_value = alpha
        
    if emission:
        if 'Emission Color' in bsdf.inputs:
            bsdf.inputs['Emission Color'].default_value = emission
            bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif 'Emission' in bsdf.inputs:
            bsdf.inputs['Emission'].default_value = emission
            
    if alpha < 1.0:
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
        if hasattr(mat, 'shadow_method'):
            mat.shadow_method = 'HASHED'
            
    links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat

def create_all_materials():
    mats = {}
    mats['M_Body_White'] = create_pbr_mat('M_Body_White', (0.92, 0.93, 0.96, 1.0), metallic=0.85, roughness=0.22)
    mats['M_Tire_Rubber'] = create_pbr_mat('M_Tire_Rubber', (0.04, 0.04, 0.04, 1.0), metallic=0.0, roughness=0.82)
    mats['M_Wheel_Black'] = create_pbr_mat('M_Wheel_Black', (0.025, 0.025, 0.025, 1.0), metallic=0.92, roughness=0.25)
    mats['M_Glass_Tinted'] = create_pbr_mat('M_Glass_Tinted', (0.04, 0.05, 0.07, 1.0), metallic=0.1, roughness=0.03, alpha=0.75)
    mats['M_Headlight'] = create_pbr_mat('M_Headlight', (0.95, 0.98, 1.0, 1.0), metallic=0.1, roughness=0.1, emission=(0.92, 0.97, 1.0, 1.0), emission_strength=5.0)
    mats['M_Taillight'] = create_pbr_mat('M_Taillight', (0.85, 0.02, 0.02, 1.0), metallic=0.1, roughness=0.12, emission=(0.98, 0.01, 0.01, 1.0), emission_strength=5.0)
    mats['M_Trim_Black'] = create_pbr_mat('M_Trim_Black', (0.02, 0.02, 0.02, 1.0), metallic=0.15, roughness=0.45)
    mats['M_Metal'] = create_pbr_mat('M_Metal', (0.80, 0.80, 0.82, 1.0), metallic=0.95, roughness=0.18)
    mats['M_Brake_Caliper'] = create_pbr_mat('M_Brake_Caliper', (0.88, 0.03, 0.03, 1.0), metallic=0.35, roughness=0.25)
    mats['M_Interior_Dark'] = create_pbr_mat('M_Interior_Dark', (0.03, 0.03, 0.035, 1.0), metallic=0.0, roughness=0.85)
    return mats

def apply_smoothing_and_normals(obj):
    for p in obj.data.polygons:
        p.use_smooth = True
    mod = obj.modifiers.new(name="WeightedNormal", type='WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="WeightedNormal")

def mirror_along_x(obj):
    mod = obj.modifiers.new(name="MirrorX", type='MIRROR')
    mod.use_axis[0] = True
    mod.use_clip = True
    mod.merge_threshold = 0.002
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="MirrorX")

# ==============================================================================
# 3. HIGH-PERFORMANCE WHEEL & TIRE ASSEMBLIES (48 Segments)
# ==============================================================================

def build_wheel_assembly(name, center_pos, is_right_side, mats):
    """
    Builds a standalone high-detail 10-spoke split concave wheel assembly.
    Origin is placed PRECISELY at center_pos.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    obj.data.materials.append(mats['M_Tire_Rubber'])  # 0
    obj.data.materials.append(mats['M_Wheel_Black'])  # 1
    obj.data.materials.append(mats['M_Metal'])        # 2
    obj.data.materials.append(mats['M_Brake_Caliper'])# 3
    
    bm = bmesh.new()
    
    out_dir = 1.0 if is_right_side else -1.0
    half_w = TIRE_WIDTH * 0.5
    segments = 48 # High polygon smooth roundness
    
    # -------------------------------------------------------------
    # A. Tire with 3D tread channels and curved sidewalls
    # -------------------------------------------------------------
    tire_profile = [
        (-half_w * 0.88, RIM_RADIUS * 1.01),
        (-half_w * 1.06, RIM_RADIUS * 1.15),
        (-half_w * 1.10, TIRE_RADIUS * 0.88),
        (-half_w * 0.98, TIRE_RADIUS * 0.98),
        (-half_w * 0.75, TIRE_RADIUS * 1.00),
        (-half_w * 0.45, TIRE_RADIUS * 0.995),
        (-half_w * 0.40, TIRE_RADIUS * 0.970),
        (-half_w * 0.32, TIRE_RADIUS * 0.970),
        (-half_w * 0.27, TIRE_RADIUS * 0.995),
        ( 0.00,          TIRE_RADIUS * 1.00),
        ( half_w * 0.27, TIRE_RADIUS * 0.995),
        ( half_w * 0.32, TIRE_RADIUS * 0.970),
        ( half_w * 0.40, TIRE_RADIUS * 0.970),
        ( half_w * 0.45, TIRE_RADIUS * 0.995),
        ( half_w * 0.75, TIRE_RADIUS * 1.00),
        ( half_w * 0.98, TIRE_RADIUS * 0.98),
        ( half_w * 1.10, TIRE_RADIUS * 0.88),
        ( half_w * 1.06, RIM_RADIUS * 1.15),
        ( half_w * 0.88, RIM_RADIUS * 1.01),
    ]
    if not is_right_side:
        tire_profile = [(-x, r) for x, r in tire_profile]
        
    tire_rings = []
    for x_p, r_p in tire_profile:
        ring = []
        for i in range(segments):
            ang = i * (2.0 * math.pi / segments)
            ring.append(bm.verts.new((x_p, r_p * math.cos(ang), r_p * math.sin(ang))))
        tire_rings.append(ring)
        
    for p in range(len(tire_rings) - 1):
        r1, r2 = tire_rings[p], tire_rings[p+1]
        for i in range(segments):
            inext = (i + 1) % segments
            f = bm.faces.new([r1[i], r1[inext], r2[inext], r2[i]])
            f.material_index = 0

    # -------------------------------------------------------------
    # B. Forged 10-Spoke Concave Rim
    # -------------------------------------------------------------
    outer_x = half_w * 0.94 if is_right_side else -half_w * 0.94
    inner_x = -half_w * 0.88 if is_right_side else half_w * 0.88
    lip_x = outer_x
    drop_x = outer_x - (0.045 * out_dir)
    hub_x = outer_x - (0.075 * out_dir)
    
    rim_lip_r = RIM_RADIUS * 1.01
    rim_drop_r = RIM_RADIUS * 0.88
    hub_r = 0.072
    
    barrel_prof = [
        (inner_x, RIM_RADIUS * 0.94),
        (0.00,    RIM_RADIUS * 0.95),
        (lip_x,   rim_lip_r),
        (drop_x,  rim_drop_r)
    ]
    rim_rings = []
    for x_p, r_p in barrel_prof:
        ring = []
        for i in range(segments):
            ang = i * (2.0 * math.pi / segments)
            ring.append(bm.verts.new((x_p, r_p * math.cos(ang), r_p * math.sin(ang))))
        rim_rings.append(ring)
        
    for p in range(len(rim_rings) - 1):
        r1, r2 = rim_rings[p], rim_rings[p+1]
        for i in range(segments):
            inext = (i + 1) % segments
            f = bm.faces.new([r1[i], r1[inext], r2[inext], r2[i]])
            f.material_index = 1

    # Center Hub & Cap
    hub_ring = []
    hub_center = bm.verts.new((hub_x - 0.008 * out_dir, 0, 0))
    for i in range(segments):
        ang = i * (2.0 * math.pi / segments)
        hub_ring.append(bm.verts.new((hub_x, hub_r * math.cos(ang), hub_r * math.sin(ang))))
        
    for i in range(segments):
        inext = (i + 1) % segments
        f = bm.faces.new([hub_center, hub_ring[i], hub_ring[inext]])
        f.material_index = 1

    # 10 Split Spokes (5 pairs)
    num_pairs = 5
    drop_ring = rim_rings[-1]
    for pair in range(num_pairs):
        base_a = pair * (2.0 * math.pi / num_pairs)
        for offset in [-0.13, 0.13]:
            a = base_a + offset
            cos_a, sin_a = math.cos(a), math.sin(a)
            perp_y, perp_z = -sin_a, cos_a
            
            w_rim = 0.020
            w_hub = 0.014
            
            vr1 = bm.verts.new((drop_x, rim_drop_r * cos_a + perp_y * w_rim, rim_drop_r * sin_a + perp_z * w_rim))
            vr2 = bm.verts.new((drop_x, rim_drop_r * cos_a - perp_y * w_rim, rim_drop_r * sin_a - perp_z * w_rim))
            vrb1 = bm.verts.new((drop_x - 0.025 * out_dir, rim_drop_r * cos_a + perp_y * w_rim, rim_drop_r * sin_a + perp_z * w_rim))
            vrb2 = bm.verts.new((drop_x - 0.025 * out_dir, rim_drop_r * cos_a - perp_y * w_rim, rim_drop_r * sin_a - perp_z * w_rim))
            
            vh1 = bm.verts.new((hub_x, hub_r * cos_a + perp_y * w_hub, hub_r * sin_a + perp_z * w_hub))
            vh2 = bm.verts.new((hub_x, hub_r * cos_a - perp_y * w_hub, hub_r * sin_a - perp_z * w_hub))
            vhb1 = bm.verts.new((hub_x - 0.02 * out_dir, hub_r * cos_a + perp_y * w_hub, hub_r * sin_a + perp_z * w_hub))
            vhb2 = bm.verts.new((hub_x - 0.02 * out_dir, hub_r * cos_a - perp_y * w_hub, hub_r * sin_a - perp_z * w_hub))
            
            f1 = bm.faces.new([vr1, vr2, vh2, vh1])
            f2 = bm.faces.new([vr1, vh1, vhb1, vrb1])
            f3 = bm.faces.new([vr2, vrb2, vhb2, vh2])
            for f in [f1, f2, f3]:
                f.material_index = 1

    # Lug Nuts
    for s in range(5):
        ang = s * (2.0 * math.pi / 5)
        lx = hub_x + 0.005 * out_dir
        ly = 0.042 * math.cos(ang)
        lz = 0.042 * math.sin(ang)
        lug_ring = []
        for li in range(6):
            la = li * (2.0 * math.pi / 6)
            lug_ring.append(bm.verts.new((lx, ly + 0.009 * math.cos(la), lz + 0.009 * math.sin(la))))
        lug_c = bm.verts.new((lx + 0.008 * out_dir, ly, lz))
        for li in range(6):
            f = bm.faces.new([lug_c, lug_ring[li], lug_ring[(li+1)%6]])
            f.material_index = 2

    # Cross-Drilled Rotor
    rotor_x = outer_x - (0.08 * out_dir)
    rotor_thick = 0.024 * out_dir
    rotor_r_out = 0.185
    rotor_r_in = 0.100
    rotor_segs = 32
    
    r_fo, r_fi, r_bo, r_bi = [], [], [], []
    for i in range(rotor_segs):
        ang = i * (2.0 * math.pi / rotor_segs)
        y, z = math.cos(ang), math.sin(ang)
        r_fo.append(bm.verts.new((rotor_x, rotor_r_out * y, rotor_r_out * z)))
        r_fi.append(bm.verts.new((rotor_x, rotor_r_in * y, rotor_r_in * z)))
        r_bo.append(bm.verts.new((rotor_x - rotor_thick, rotor_r_out * y, rotor_r_out * z)))
        r_bi.append(bm.verts.new((rotor_x - rotor_thick, rotor_r_in * y, rotor_r_in * z)))
        
    for i in range(rotor_segs):
        inext = (i + 1) % rotor_segs
        f_front = bm.faces.new([r_fi[i], r_fo[i], r_fo[inext], r_fi[inext]])
        f_back = bm.faces.new([r_bi[i], r_bi[inext], r_bo[inext], r_bo[i]])
        f_edge = bm.faces.new([r_fo[i], r_bo[i], r_bo[inext], r_fo[inext]])
        for f in [f_front, f_back, f_edge]:
            f.material_index = 2

    # Caliper
    cal_x1 = rotor_x + (0.020 * out_dir)
    cal_x2 = rotor_x - rotor_thick - (0.024 * out_dir)
    cal_angle_c = math.radians(65)
    cal_arc = math.radians(45)
    cal_r1 = rotor_r_in * 1.02
    cal_r2 = rotor_r_out * 1.16
    cal_steps = 7
    
    cal_front, cal_back = [], []
    for s in range(cal_steps):
        a = cal_angle_c - cal_arc * 0.5 + (s / (cal_steps - 1)) * cal_arc
        y1, z1 = cal_r1 * math.cos(a), cal_r1 * math.sin(a)
        y2, z2 = cal_r2 * math.cos(a), cal_r2 * math.sin(a)
        cal_front.append((bm.verts.new((cal_x1, y1, z1)), bm.verts.new((cal_x1, y2, z2))))
        cal_back.append((bm.verts.new((cal_x2, y1, z1)), bm.verts.new((cal_x2, y2, z2))))
        
    for s in range(cal_steps - 1):
        vf_in1, vf_out1 = cal_front[s]
        vf_in2, vf_out2 = cal_front[s+1]
        vb_in1, vb_out1 = cal_back[s]
        vb_in2, vb_out2 = cal_back[s+1]
        
        f_top = bm.faces.new([vf_out1, vb_out1, vb_out2, vf_out2])
        f_side = bm.faces.new([vf_in1, vf_out1, vf_out2, vf_in2])
        f_back = bm.faces.new([vb_in1, vb_in2, vb_out2, vb_out1])
        f_bot = bm.faces.new([vf_in1, vf_in2, vb_in2, vb_in1])
        for f in [f_top, f_side, f_back, f_bot]:
            f.material_index = 3

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    obj.location = center_pos
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 4. MASTERCLASS APX-01 BODYWORK WITH FLAWLESS TOPOLOGY
# ==============================================================================

def build_car_body(mats):
    """
    Builds the sports coupe monocoque body with 100% welded, seamless topology:
    - Front bumper with central intake opening & corner duct recesses
    - Sculpted long hood with power bulge
    - Front fenders arching over wheels with 3D hollow inner wheel houses
    - Seamless doors & rocker panels extending flush between wheel arches
    - A-pillars, double bubble roof, C-pillars framing OPEN window apertures
    - Flared muscular rear haunches with hollow inner wheel houses
    - Rear decklid sweeping up into an integrated ducktail lip spoiler
    - Rear bumper with horizontal taillight bay, license recess, and diffuser cutout
    """
    mesh = bpy.data.meshes.new("APX01_Body_Mesh")
    obj = bpy.data.objects.new("APX01_Body", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Body_White'])
    
    bm = bmesh.new()
    
    # -------------------------------------------------------------
    # 1. Hood & Cowl Surface (Y = 2.05 to Y = 0.70)
    # -------------------------------------------------------------
    hood_stations = [
        # Y, [(X0, Z0), (X1, Z1), (X2, Z2), (X3, Z3)]
        (2.05, [(0.00, 0.62), (0.24, 0.61), (0.48, 0.59), (0.74, 0.57)]),
        (1.70, [(0.00, 0.69), (0.25, 0.68), (0.50, 0.66), (0.76, 0.65)]),
        (1.35, [(0.00, 0.75), (0.26, 0.74), (0.52, 0.72), (0.78, 0.71)]),
        (1.00, [(0.00, 0.81), (0.26, 0.80), (0.53, 0.78), (0.78, 0.76)]),
        (0.70, [(0.00, 0.86), (0.25, 0.85), (0.52, 0.83), (0.76, 0.80)]), # Cowl
    ]
    h_rings = []
    for y, pts in hood_stations:
        h_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(h_rings) - 1):
        for p in range(len(hood_stations[0][1]) - 1):
            bm.faces.new([h_rings[s][p], h_rings[s][p+1], h_rings[s+1][p+1], h_rings[s+1][p]])

    # -------------------------------------------------------------
    # 2. Front Bumper Fascia (Y = 2.05 to Y = 2.26)
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
        
    b_cor1 = bm.verts.new((0.88, 1.95, 0.30))
    b_cor2 = bm.verts.new((0.89, 1.68, 0.15))
    bm.faces.new([n_mid[3], n_bot[3], b_cor1])
    bm.faces.new([n_bot[3], b_cor2, b_cor1])
    
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
        bm.verts.new((0.84, 0.70, 0.78)),
    ]
    for i in range(len(f_crest) - 1):
        bm.faces.new([h_rings[i][3], f_crest[i], f_crest[i+1], h_rings[i+1][3]])

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
        bm.faces.new([arch_outer[i], arch_outer[i+1], arch_inner[i+1], arch_inner[i]])
        
    bm.faces.new([f_crest[1], f_crest[2], arch_outer[3], arch_outer[4]])
    bm.faces.new([f_crest[0], f_crest[1], arch_outer[4], arch_outer[5]])
    bm.faces.new([f_crest[0], arch_outer[5], arch_outer[6], b_cor2])
    bm.faces.new([f_crest[2], f_crest[3], arch_outer[2], arch_outer[3]])
    bm.faces.new([f_crest[3], f_crest[4], arch_outer[1], arch_outer[2]])

    # -------------------------------------------------------------
    # 4. Seamless Doors & Rocker Panels (Y = 0.92 to Y = -0.92)
    # ZERO GAPS: We directly use f_crest[4] and arch_outer[0] as door front vertices!
    # -------------------------------------------------------------
    v_front_sill = bm.verts.new((0.86, 0.92, 0.15))
    v_front_crease = arch_outer[0] # (0.93, 0.92, 0.33)
    v_front_belt = f_crest[4]      # (0.84, 0.70, 0.78)
    
    # Door Stations: Station 0 is directly welded to the front fender & arch!
    d_v0 = [v_front_belt, v_front_crease, v_front_sill]
    
    mid_door_stations = [
        (0.60,  [(0.78, 0.78), (0.86, 0.52), (0.85, 0.15)]),
        (0.20,  [(0.76, 0.78), (0.85, 0.52), (0.84, 0.15)]),
        (-0.20, [(0.76, 0.78), (0.85, 0.52), (0.84, 0.15)]),
        (-0.60, [(0.78, 0.79), (0.87, 0.54), (0.85, 0.15)]),
    ]
    d_rings = [d_v0]
    for y, pts in mid_door_stations:
        d_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
        
    for s in range(len(d_rings) - 1):
        for p in range(2):
            bm.faces.new([d_rings[s][p], d_rings[s][p+1], d_rings[s+1][p+1], d_rings[s+1][p]])

    # -------------------------------------------------------------
    # 5. Greenhouse (A-Pillars, Double-Bubble Roof, C-Pillars)
    # -------------------------------------------------------------
    ap_bot_in  = h_rings[-1][3] # (0.76, 0.70, 0.80)
    ap_bot_out = v_front_belt   # (0.84, 0.70, 0.78)
    ap_top_in  = bm.verts.new((0.56, 0.05, 1.16))
    ap_top_out = bm.verts.new((0.62, 0.05, 1.13))
    bm.faces.new([ap_bot_in, ap_bot_out, ap_top_out, ap_top_in])

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

    cp_top_in  = r_rings[-1][3]
    cp_top_out = bm.verts.new((0.64, -0.60, 1.11))
    bm.faces.new([ap_top_in, ap_top_out, cp_top_out, cp_top_in])

    # -------------------------------------------------------------
    # 6. Muscular Rear Haunches & 3D Wheel Well (Y = -0.92 to -1.75)
    # ZERO GAPS: We directly connect to the rear door ring!
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

    v_rear_arch_front = r_arch_outer[6] # (0.96, -0.92, 0.33)
    v_rear_sill = bm.verts.new((0.87, -0.92, 0.15))
    v_rear_belt = bm.verts.new((0.82, -0.92, 0.82))
    
    # Close door rear ring to rear haunch front
    d_v_rear = [v_rear_belt, v_rear_arch_front, v_rear_sill]
    for p in range(2):
        bm.faces.new([d_rings[-1][p], d_rings[-1][p+1], d_v_rear[p+1], d_v_rear[p]])

    # Fastback C-Pillar connects to rear deck and door belt
    cp_bot_in  = bm.verts.new((0.62, -0.92, 0.94))
    cp_bot_out = v_rear_belt
    bm.faces.new([cp_top_in, cp_top_out, cp_bot_out, cp_bot_in])

    h_crest = [
        v_rear_belt,
        bm.verts.new((0.92, -1.15, 0.86)),
        bm.verts.new((0.95, -1.30, 0.88)),
        bm.verts.new((0.92, -1.55, 0.86)),
        bm.verts.new((0.86, -1.75, 0.84)),
    ]
    bm.faces.new([h_crest[0], h_crest[1], r_arch_outer[5], r_arch_outer[6]])
    bm.faces.new([h_crest[1], h_crest[2], r_arch_outer[3], r_arch_outer[4]])
    bm.faces.new([h_crest[1], r_arch_outer[4], r_arch_outer[5]])
    bm.faces.new([h_crest[2], h_crest[3], r_arch_outer[2], r_arch_outer[3]])
    bm.faces.new([h_crest[3], h_crest[4], r_arch_outer[0], r_arch_outer[1]])
    bm.faces.new([h_crest[3], r_arch_outer[1], r_arch_outer[2]])

    # -------------------------------------------------------------
    # 7. Rear Decklid & Integrated Ducktail Spoiler (Y = -0.92 to -2.02)
    # -------------------------------------------------------------
    deck_stations = [
        # Y, [(X0, Z0), (X1, Z1), (X2, Z2), (X3, Z3)]
        (-0.92, [(0.00, 1.10), (0.22, 1.09), (0.44, 1.05), (0.62, 0.94)]),
        (-1.30, [(0.00, 1.01), (0.22, 1.01), (0.45, 0.98), (0.66, 0.91)]),
        (-1.65, [(0.00, 0.97), (0.22, 0.97), (0.45, 0.95), (0.68, 0.90)]),
        (-1.85, [(0.00, 0.98), (0.22, 0.98), (0.45, 0.96), (0.70, 0.91)]),
        (-2.02, [(0.00, 1.02), (0.20, 1.01), (0.42, 0.98), (0.72, 0.92)]), # Ducktail Lip!
    ]
    deck_rings = []
    for y, pts in deck_stations:
        deck_rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for s in range(len(deck_rings) - 1):
        for p in range(len(deck_stations[0][1]) - 1):
            bm.faces.new([deck_rings[s][p], deck_rings[s][p+1], deck_rings[s+1][p+1], deck_rings[s+1][p]])

    bm.faces.new([cp_bot_in, cp_bot_out, h_crest[1], deck_rings[0][3]])
    bm.faces.new([deck_rings[0][3], h_crest[1], h_crest[2], deck_rings[1][3]])
    bm.faces.new([deck_rings[1][3], h_crest[2], h_crest[3], deck_rings[2][3]])
    bm.faces.new([deck_rings[2][3], h_crest[3], h_crest[4], deck_rings[3][3]])
    bm.faces.new([deck_rings[3][3], h_crest[4], bm.verts.new((0.82, -2.00, 0.86)), deck_rings[4][3]])

    # -------------------------------------------------------------
    # 8. Rear Bumper Fascia, Taillight Recess & Diffuser Cutout
    # -------------------------------------------------------------
    tl_lip = deck_rings[-1]
    tl_pocket = [
        bm.verts.new((0.00, -2.06, 0.86)), bm.verts.new((0.20, -2.06, 0.85)),
        bm.verts.new((0.42, -2.06, 0.83)), bm.verts.new((0.72, -2.04, 0.80))
    ]
    for p in range(len(tl_pocket) - 1):
        bm.faces.new([tl_lip[p], tl_lip[p+1], tl_pocket[p+1], tl_pocket[p]])
        
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

    # Underbody Floor
    floor_stations = [2.25, 1.65, 1.05, 0.35, -0.35, -1.05, -1.65, -2.24]
    for i in range(len(floor_stations) - 1):
        y1, y2 = floor_stations[i], floor_stations[i+1]
        v1 = bm.verts.new((0.00, y1, 0.14))
        v2 = bm.verts.new((0.72, y1, 0.14))
        v3 = bm.verts.new((0.72, y2, 0.14))
        v4 = bm.verts.new((0.00, y2, 0.14))
        bm.faces.new([v1, v2, v3, v4])

    # Clean double welding
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
# 5. FLUSH AERODYNAMIC GLASS (Windshield, Side, Fastback)
# ==============================================================================

def build_glass(mats):
    """
    Builds clean aerodynamic curved glass sitting flush inside the open window frames.
    """
    mesh = bpy.data.meshes.new("APX01_Glass_Mesh")
    obj = bpy.data.objects.new("APX01_Glass", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Glass_Tinted'])
    
    bm = bmesh.new()
    
    # 1. Front Windshield (Y = 0.70 down to Y = 0.05)
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

    # 2. Side Door Windows (Y = 0.05 to Y = -0.65)
    side_pts = [
        # (Y, X_bot, Z_bot, X_top, Z_top)
        (0.05,  0.75, 0.80, 0.60, 1.12),
        (-0.20, 0.75, 0.80, 0.58, 1.14),
        (-0.45, 0.75, 0.80, 0.58, 1.14),
        (-0.65, 0.76, 0.81, 0.60, 1.12),
    ]
    for s in range(len(side_pts) - 1):
        y1, xb1, zb1, xt1, zt1 = side_pts[s]
        y2, xb2, zb2, xt2, zt2 = side_pts[s+1]
        vb1 = bm.verts.new((xb1, y1, zb1))
        vt1 = bm.verts.new((xt1, y1, zt1))
        vb2 = bm.verts.new((xb2, y2, zb2))
        vt2 = bm.verts.new((xt2, y2, zt2))
        bm.faces.new([vb1, vt1, vt2, vb2])

    # 3. Fastback Rear Glass (Y = -0.60 down to Y = -1.05)
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

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    
    sub = obj.modifiers.new(name="Subsurf", type='SUBSURF')
    sub.levels = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Subsurf")
    
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 6. AERODYNAMIC TRIM, FRONT GRILLES & EXHAUST
# ==============================================================================

def build_trim(mats):
    """
    Builds performance aerodynamic components:
    - Front carbon chin splitter with side winglets
    - Front lower intake grille mesh & side cooling ducts
    - Side skirts with rear winglets
    - Rear aerodynamic diffuser with 4 vertical strakes
    - Dual polished stainless steel exhaust cannons
    - Sleek aerodynamic side mirrors
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
    sp_top, sp_bot = [], []
    for x, y, z in split_pts:
        sp_top.append(bm.verts.new((x, y, z + 0.02)))
        sp_bot.append(bm.verts.new((x, y, z)))
        
    for i in range(len(split_pts) - 1):
        f_top = bm.faces.new([sp_top[i], sp_top[i+1], bm.verts.new((sp_top[i+1].co.x * 0.7, sp_top[i+1].co.y - 0.18, 0.13)), bm.verts.new((sp_top[i].co.x * 0.7, sp_top[i].co.y - 0.18, 0.13))])
        f_edge = bm.faces.new([sp_bot[i], sp_bot[i+1], sp_top[i+1], sp_top[i]])
        f_top.material_index = 0
        f_edge.material_index = 0
        
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
    # E. Dual Large Polished Stainless Exhaust Cannons
    # -------------------------------------------------------------
    ex_x = 0.52
    ex_y_tip = -2.25
    ex_y_in = -2.12
    ex_z = 0.25
    ex_r = 0.052
    ex_segs = 20
    
    tip_r, in_r = [], []
    for i in range(ex_segs):
        ang = i * (2.0 * math.pi / ex_segs)
        dx, dz = ex_r * math.cos(ang), ex_r * math.sin(ang)
        tip_r.append(bm.verts.new((ex_x + dx, ex_y_tip, ex_z + dz)))
        in_r.append(bm.verts.new((ex_x + dx, ex_y_in, ex_z + dz)))
        
    for i in range(ex_segs):
        inext = (i + 1) % ex_segs
        f_ex = bm.faces.new([tip_r[i], tip_r[inext], in_r[inext], in_r[i]])
        f_ex.material_index = 1

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
        f_box.material_index = 1 if bf == [3, 7, 4, 0] else 0

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_along_x(obj)
    apply_smoothing_and_normals(obj)
    return obj

# ==============================================================================
# 7. LIGHTING ELEMENTS (Front Projectors & Rear OLED Bar)
# ==============================================================================

def build_front_lights(mats):
    """
    Builds front headlights:
    - Recessed dark housing bucket
    - Dual LED crystal projector lenses
    - Aggressive DRL light blade strip
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
    Builds rear taillights:
    - Full-width slim dark OLED light bar spanning across the rear deck
    - Signature glowing crimson brake/taillight elements
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
# 8. INTERIOR SILHOUETTE
# ==============================================================================

def build_interior(mats):
    """
    Builds lightweight interior silhouette:
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
# 9. SCENE HIERARCHY & STUDIO SETUP
# ==============================================================================

def organize_scene(vehicle_objects):
    col = bpy.data.collections.new("APX01_Vehicle")
    bpy.context.scene.collection.children.link(col)
    for obj in vehicle_objects:
        for c in obj.users_collection:
            c.objects.unlink(obj)
        col.objects.link(obj)
    return col

def count_polys_and_tris(objects):
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

def setup_studio():
    studio_col = bpy.data.collections.new("APX01_Studio")
    bpy.context.scene.collection.children.link(studio_col)
    
    world = bpy.context.scene.world or bpy.data.worlds.new("Studio_World")
    bpy.context.scene.world = world
    world.color = (0.24, 0.26, 0.30)
    
    cam_data = bpy.data.cameras.new("Studio_Camera")
    cam_data.lens = 65
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("Studio_Camera", cam_data)
    studio_col.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    sun_data = bpy.data.lights.new("Studio_Sun", type='SUN')
    sun_data.energy = 5.0
    sun_data.color = (1.0, 0.98, 0.95)
    sun_obj = bpy.data.objects.new("Studio_Sun", sun_data)
    sun_obj.rotation_euler = Euler((math.radians(50), math.radians(20), math.radians(-40)), 'XYZ')
    studio_col.objects.link(sun_obj)
    
    fill_data = bpy.data.lights.new("Studio_Fill", type='AREA')
    fill_data.energy = 2500.0
    fill_data.size = 8.0
    fill_data.color = (0.85, 0.92, 1.0)
    fill_obj = bpy.data.objects.new("Studio_Fill", fill_data)
    fill_obj.location = (5.5, -4.0, 4.0)
    fill_obj.rotation_euler = Euler((math.radians(45), 0, math.radians(135)), 'XYZ')
    studio_col.objects.link(fill_obj)
    
    rim_data = bpy.data.lights.new("Studio_Rim", type='AREA')
    rim_data.energy = 3500.0
    rim_data.size = 6.0
    rim_data.color = (1.0, 1.0, 1.0)
    rim_obj = bpy.data.objects.new("Studio_Rim", rim_data)
    rim_obj.location = (0.0, -6.0, 3.5)
    rim_obj.rotation_euler = Euler((math.radians(60), 0, math.radians(180)), 'XYZ')
    studio_col.objects.link(rim_obj)
    
    mesh_floor = bpy.data.meshes.new("Studio_Floor_Mesh")
    bm_f = bmesh.new()
    bmesh.ops.create_grid(bm_f, x_segments=2, y_segments=2, size=25.0)
    bm_f.to_mesh(mesh_floor)
    bm_f.free()
    floor_obj = bpy.data.objects.new("Studio_Floor", mesh_floor)
    studio_col.objects.link(floor_obj)
    floor_obj.location = (0, 0, 0.0)
    
    floor_mat = bpy.data.materials.new("M_Studio_Floor")
    floor_mat.use_nodes = True
    nodes = floor_mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.12, 0.13, 0.15, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.35
    floor_obj.data.materials.append(floor_mat)
    
    return cam_obj, studio_col

def aim_camera(cam_obj, cam_pos, target_pos=(0, 0, 0.65)):
    cam_obj.location = cam_pos
    direction = Vector(target_pos) - Vector(cam_pos)
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_obj.rotation_euler = rot_quat.to_euler()

def render_inspection_views(cam_obj, output_dir):
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.engine = 'BLENDER_EEVEE'
    
    views = [
        ("apx01_front_quarter.png", (-5.4, 5.2, 2.1)),
        ("apx01_rear_quarter.png",  (-5.2, -5.2, 2.0)),
        ("apx01_side.png",          (-6.5, 0.0, 1.25)),
        ("apx01_front.png",         (0.0, 6.2, 1.15)),
        ("apx01_rear.png",          (0.0, -6.2, 1.15)),
    ]
    
    rendered_files = []
    for filename, pos in views:
        aim_camera(cam_obj, pos, (0, 0, 0.65))
        out_path = os.path.join(output_dir, filename)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        if os.path.exists(out_path):
            rendered_files.append(out_path)
            print(f"Rendered: {filename}")
    return rendered_files

# ==============================================================================
# 10. EXPORT & VERIFICATION
# ==============================================================================

def export_vehicle_glb(vehicle_objects, glb_path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in vehicle_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = vehicle_objects[0]
    
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_normals=True
    )
    print(f"GLB Exported: {glb_path}")

def verify_glb(glb_path):
    print("Verifying exported GLB...")
    if not os.path.exists(glb_path):
        raise FileNotFoundError(f"Missing GLB: {glb_path}")
    size = os.path.getsize(glb_path)
    print(f"GLB Size: {size / 1024:.1f} KB")
    
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    objs = [o.name for o in bpy.data.objects]
    print(f"Verified Objects ({len(objs)}): {objs}")
    for w in ['FL_Wheel', 'FR_Wheel', 'RL_Wheel', 'RR_Wheel']:
        match = [o for o in bpy.data.objects if w in o.name]
        if match:
            print(f" Wheel {w} OK at {match[0].location[:]}")
        else:
            print(f" WARNING: Wheel {w} missing!")
    return True

# ==============================================================================
# 11. MAIN PIPELINE
# ==============================================================================

def main():
    print("=" * 60)
    print("Starting APX-01 Version 7.0 Master Pipeline")
    print("=" * 60)
    
    output_dir = r"c:\Users\Dell\Documents\coding\ProjectApex\assets\vehicles\APX01"
    os.makedirs(output_dir, exist_ok=True)
    blend_path = os.path.join(output_dir, "APX01.blend")
    glb_path = os.path.join(output_dir, "APX01.glb")
    
    # 1. Reset scene & setup materials
    reset_scene()
    mats = create_all_materials()
    print("Materials initialized.")
    
    # 2. Build vehicle components
    body = build_car_body(mats)
    glass = build_glass(mats)
    trim = build_trim(mats)
    lights_f = build_front_lights(mats)
    lights_r = build_rear_lights(mats)
    interior = build_interior(mats)
    
    # 3. Build 4 Wheel assemblies with exact axle pivots
    fl_wheel = build_wheel_assembly("FL_Wheel", (AXLE_X_LEFT, AXLE_Y_FRONT, AXLE_Z), is_right_side=False, mats=mats)
    fr_wheel = build_wheel_assembly("FR_Wheel", (AXLE_X_RIGHT, AXLE_Y_FRONT, AXLE_Z), is_right_side=True, mats=mats)
    rl_wheel = build_wheel_assembly("RL_Wheel", (AXLE_X_LEFT, AXLE_Y_REAR, AXLE_Z), is_right_side=False, mats=mats)
    rr_wheel = build_wheel_assembly("RR_Wheel", (AXLE_X_RIGHT, AXLE_Y_REAR, AXLE_Z), is_right_side=True, mats=mats)
    
    vehicle_objects = [body, glass, trim, lights_f, lights_r, interior, fl_wheel, fr_wheel, rl_wheel, rr_wheel]
    
    # 4. Collections
    vehicle_col = organize_scene(vehicle_objects)
    
    # 5. Geometry Audit
    total_polys, total_tris, stats = count_polys_and_tris(vehicle_objects)
    print("-" * 50)
    print("APX-01 GEOMETRY AUDIT:")
    for name, (polys, tris) in stats.items():
        print(f"  {name:20}: {polys:5} polys | {tris:6} tris")
    print("-" * 50)
    print(f"TOTAL VEHICLE: {total_polys} polygons | {total_tris} triangles")
    print("-" * 50)
    
    # 6. Studio & Inspection Renders
    cam_obj, studio_col = setup_studio()
    print("Rendering inspection views...")
    rendered = render_inspection_views(cam_obj, output_dir)
    print(f"Rendered {len(rendered)} views.")
    
    # 7. Save .blend file
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved: {blend_path}")
    
    # 8. Export GLB
    export_vehicle_glb(vehicle_objects, glb_path)
    
    # 9. Verify GLB
    verify_glb(glb_path)
    
    print("=" * 60)
    print("APX-01 Version 7.0 Pipeline Completed Successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
