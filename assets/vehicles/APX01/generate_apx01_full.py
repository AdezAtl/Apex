"""
APX-01 Procedural 3D Sports Coupe Model Generator
Author: Project Apex Technical Artist
Environment: Blender 5.2 / Babylon.js GLTF Pipeline
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler
import os

# ==============================================================================
# 1. SCENE SETUP & CONSTANTS
# ==============================================================================

CAR_NAME = "APX-01"
# Dimensions in meters
LENGTH = 4.48
WIDTH = 1.92
HEIGHT = 1.28
WHEELBASE = 2.60
FRONT_TRACK = 1.62
REAR_TRACK = 1.64
TIRE_RADIUS = 0.33
TIRE_WIDTH = 0.26
RIM_RADIUS = 0.245

# Axle coordinates (Blender coordinate system: +Y is Forward, +Z is Up, -X is Left, +X is Right)
# Ground contact is at Z = 0.0, so axle center is at Z = TIRE_RADIUS = 0.33
AXLE_Y_FRONT = 1.30
AXLE_Y_REAR = -1.30
AXLE_X_LEFT = -0.82
AXLE_X_RIGHT = 0.82
AXLE_Z = 0.33

def reset_scene():
    """Resets the Blender scene completely."""
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
    # Pearlescent metallic white body paint
    mats['M_Body_White'] = create_pbr_mat('M_Body_White', (0.92, 0.93, 0.96, 1.0), metallic=0.85, roughness=0.22)
    # Matte performance tire rubber
    mats['M_Tire_Rubber'] = create_pbr_mat('M_Tire_Rubber', (0.04, 0.04, 0.04, 1.0), metallic=0.0, roughness=0.80)
    # Satin black forged aluminum wheels
    mats['M_Wheel_Black'] = create_pbr_mat('M_Wheel_Black', (0.03, 0.03, 0.03, 1.0), metallic=0.92, roughness=0.25)
    # Deep tinted aerodynamic glass
    mats['M_Glass_Tinted'] = create_pbr_mat('M_Glass_Tinted', (0.03, 0.04, 0.06, 1.0), metallic=0.1, roughness=0.04, alpha=0.85)
    # Crisp LED headlight / DRL glow
    mats['M_Headlight'] = create_pbr_mat('M_Headlight', (0.95, 0.98, 1.0, 1.0), metallic=0.1, roughness=0.1, emission=(0.9, 0.96, 1.0, 1.0), emission_strength=4.0)
    # Glowing crimson OLED taillight bar
    mats['M_Taillight'] = create_pbr_mat('M_Taillight', (0.85, 0.02, 0.02, 1.0), metallic=0.1, roughness=0.12, emission=(0.98, 0.01, 0.01, 1.0), emission_strength=4.0)
    # Matte/satin aerodynamic carbon/plastic trim
    mats['M_Trim_Black'] = create_pbr_mat('M_Trim_Black', (0.025, 0.025, 0.025, 1.0), metallic=0.15, roughness=0.45)
    # Polished stainless steel exhaust & drilled brake disc rotor
    mats['M_Metal'] = create_pbr_mat('M_Metal', (0.78, 0.78, 0.80, 1.0), metallic=0.95, roughness=0.20)
    # High performance racing red brake calipers
    mats['M_Brake_Caliper'] = create_pbr_mat('M_Brake_Caliper', (0.88, 0.03, 0.03, 1.0), metallic=0.35, roughness=0.25)
    # Dark sports cabin interior
    mats['M_Interior_Dark'] = create_pbr_mat('M_Interior_Dark', (0.035, 0.035, 0.038, 1.0), metallic=0.0, roughness=0.85)
    return mats

# ==============================================================================
# 3. HELPER FUNCTIONS
# ==============================================================================

def add_smooth_and_normals(obj, use_auto_smooth=True, angle=math.radians(35)):
    """Applies smooth shading and weighted normal modifiers for clean automotive reflections."""
    mesh = obj.data
    for p in mesh.polygons:
        p.use_smooth = True
    # Weighted Normal modifier
    mod = obj.modifiers.new(name="WeightedNormal", type='WEIGHTED_NORMAL')
    mod.keep_sharp = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="WeightedNormal")

def mirror_and_apply(obj):
    """Mirrors the mesh along X axis and applies the mirror modifier with clipping."""
    mod = obj.modifiers.new(name="MirrorX", type='MIRROR')
    mod.use_axis[0] = True
    mod.use_clip = True
    mod.merge_threshold = 0.002
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="MirrorX")

# ==============================================================================
# 4. WHEEL & TIRE GENERATION
# ==============================================================================

def build_wheel_assembly(name, center_pos, is_right_side, mats):
    """
    Creates an independent wheel assembly (Tire, Rim, Hub, Brake Rotor, Caliper).
    Origin is placed PRECISELY at center_pos.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    
    bm = bmesh.new()
    
    # Wheel orientation: Wheel axis of rotation is X axis in local coordinates.
    # Outward direction: +X for Right wheels, -X for Left wheels.
    out_dir = 1.0 if is_right_side else -1.0
    half_width = TIRE_WIDTH * 0.5  # ~0.13m
    
    # -------------------------------------------------------------
    # A. Tire Geometry (Realistic performance tire with tread profile)
    # -------------------------------------------------------------
    tire_segments = 36
    # Profile points in local (X, Radial): (x_offset_from_center, radius)
    tire_profile = [
        (-half_width * 0.85, RIM_RADIUS * 1.02),      # Inner bead
        (-half_width * 1.05, RIM_RADIUS * 1.15),      # Inner sidewall bulge
        (-half_width * 1.08, TIRE_RADIUS * 0.88),     # Inner shoulder transition
        (-half_width * 0.95, TIRE_RADIUS * 0.98),     # Inner shoulder
        (-half_width * 0.70, TIRE_RADIUS * 1.00),     # Tread inner
        (-half_width * 0.25, TIRE_RADIUS * 0.995),    # Tread center groove inner
        (-half_width * 0.20, TIRE_RADIUS * 0.975),    # Rain groove channel
        ( half_width * 0.20, TIRE_RADIUS * 0.975),    # Rain groove channel
        ( half_width * 0.25, TIRE_RADIUS * 0.995),    # Tread center groove outer
        ( half_width * 0.70, TIRE_RADIUS * 1.00),     # Tread outer
        ( half_width * 0.95, TIRE_RADIUS * 0.98),     # Outer shoulder
        ( half_width * 1.08, TIRE_RADIUS * 0.88),     # Outer shoulder transition
        ( half_width * 1.05, RIM_RADIUS * 1.15),      # Outer sidewall bulge
        ( half_width * 0.85, RIM_RADIUS * 1.02),      # Outer bead
    ]
    
    # Reverse profile if left side so outward is oriented correctly
    if not is_right_side:
        tire_profile = [(-x, r) for x, r in tire_profile]
        
    tire_rings = []
    for x_prof, r_prof in tire_profile:
        ring = []
        for i in range(tire_segments):
            angle = i * (2.0 * math.pi / tire_segments)
            y = r_prof * math.cos(angle)
            z = r_prof * math.sin(angle)
            v = bm.verts.new((x_prof, y, z))
            ring.append(v)
        tire_rings.append(ring)
        
    for p_idx in range(len(tire_rings) - 1):
        r1 = tire_rings[p_idx]
        r2 = tire_rings[p_idx + 1]
        for i in range(tire_segments):
            i_next = (i + 1) % tire_segments
            bm.faces.new([r1[i], r1[i_next], r2[i_next], r2[i]])
            
    # Assign tire material
    obj.data.materials.append(mats['M_Tire_Rubber'])
    tire_mat_idx = 0
    for f in bm.faces:
        f.material_index = tire_mat_idx
        
    # -------------------------------------------------------------
    # B. Forged Rim & Hub Geometry (10-spoke split concave design)
    # -------------------------------------------------------------
    obj.data.materials.append(mats['M_Wheel_Black'])
    wheel_mat_idx = 1
    
    rim_faces_start = len(bm.faces)
    
    # Outer barrel & lip
    outer_x = half_width * 0.92 if is_right_side else -half_width * 0.92
    inner_x = -half_width * 0.85 if is_right_side else half_width * 0.85
    drop_x = outer_x - (0.05 * out_dir) # Concave center drop
    
    rim_lip_radius = RIM_RADIUS * 1.01
    rim_drop_radius = RIM_RADIUS * 0.88
    hub_radius = 0.075
    hub_x = outer_x - (0.065 * out_dir) # Deep concave dish
    
    rim_rings = []
    barrel_profile = [
        (inner_x, RIM_RADIUS * 0.95),
        (outer_x * 0.2, RIM_RADIUS * 0.96),
        (outer_x, rim_lip_radius),
        (drop_x, rim_drop_radius),
    ]
    for x_prof, r_prof in barrel_profile:
        ring = []
        for i in range(tire_segments):
            angle = i * (2.0 * math.pi / tire_segments)
            y = r_prof * math.cos(angle)
            z = r_prof * math.sin(angle)
            ring.append(bm.verts.new((x_prof, y, z)))
        rim_rings.append(ring)
        
    for p_idx in range(len(rim_rings) - 1):
        r1 = rim_rings[p_idx]
        r2 = rim_rings[p_idx + 1]
        for i in range(tire_segments):
            i_next = (i + 1) % tire_segments
            f = bm.faces.new([r1[i], r1[i_next], r2[i_next], r2[i]])
            f.material_index = wheel_mat_idx

    # Center Hub Face & Cap
    hub_ring = []
    hub_center_v = bm.verts.new((hub_x - 0.01 * out_dir, 0, 0))
    for i in range(tire_segments):
        angle = i * (2.0 * math.pi / tire_segments)
        y = hub_radius * math.cos(angle)
        z = hub_radius * math.sin(angle)
        hub_ring.append(bm.verts.new((hub_x, y, z)))
        
    for i in range(tire_segments):
        i_next = (i + 1) % tire_segments
        f = bm.faces.new([hub_center_v, hub_ring[i], hub_ring[i_next]])
        f.material_index = wheel_mat_idx
        
    # 10 Split Spokes (5 spoke pairs) connecting drop ring to hub ring
    num_spoke_pairs = 5
    drop_ring = rim_rings[-1]
    
    for s in range(num_spoke_pairs):
        base_angle = s * (2.0 * math.pi / num_spoke_pairs)
        for offset in [-0.14, 0.14]: # Split pair
            angle = base_angle + offset
            cos_a = math.cos(angle)
            sin_a = math.sin(angle)
            
            # Spoke width
            w_rim = 0.022
            w_hub = 0.016
            perp_y = -sin_a
            perp_z = cos_a
            
            # Outer spoke anchor at rim drop
            p_rim1 = (drop_x, rim_drop_radius * cos_a + perp_y * w_rim, rim_drop_radius * sin_a + perp_z * w_rim)
            p_rim2 = (drop_x, rim_drop_radius * cos_a - perp_y * w_rim, rim_drop_radius * sin_a - perp_z * w_rim)
            p_rim_back1 = (drop_x - 0.025 * out_dir, rim_drop_radius * cos_a + perp_y * w_rim, rim_drop_radius * sin_a + perp_z * w_rim)
            p_rim_back2 = (drop_x - 0.025 * out_dir, rim_drop_radius * cos_a - perp_y * w_rim, rim_drop_radius * sin_a - perp_z * w_rim)
            
            # Inner spoke anchor at hub
            p_hub1 = (hub_x, hub_radius * cos_a + perp_y * w_hub, hub_radius * sin_a + perp_z * w_hub)
            p_hub2 = (hub_x, hub_radius * cos_a - perp_y * w_hub, hub_radius * sin_a - perp_z * w_hub)
            p_hub_back1 = (hub_x - 0.02 * out_dir, hub_radius * cos_a + perp_y * w_hub, hub_radius * sin_a + perp_z * w_hub)
            p_hub_back2 = (hub_x - 0.02 * out_dir, hub_radius * cos_a - perp_y * w_hub, hub_radius * sin_a - perp_z * w_hub)
            
            vr1 = bm.verts.new(p_rim1)
            vr2 = bm.verts.new(p_rim2)
            vrb1 = bm.verts.new(p_rim_back1)
            vrb2 = bm.verts.new(p_rim_back2)
            vh1 = bm.verts.new(p_hub1)
            vh2 = bm.verts.new(p_hub2)
            vhb1 = bm.verts.new(p_hub_back1)
            vhb2 = bm.verts.new(p_hub_back2)
            
            # Spoke front face
            f1 = bm.faces.new([vr1, vr2, vh2, vh1])
            # Spoke side faces
            f2 = bm.faces.new([vr1, vh1, vhb1, vrb1])
            f3 = bm.faces.new([vr2, vrb2, vhb2, vh2])
            for f in [f1, f2, f3]:
                f.material_index = wheel_mat_idx

    # -------------------------------------------------------------
    # C. Brake Rotor (Cross-drilled ventilated disc)
    # -------------------------------------------------------------
    obj.data.materials.append(mats['M_Metal'])
    metal_mat_idx = 2
    
    rotor_x = outer_x - (0.075 * out_dir)
    rotor_thick = 0.022 * out_dir
    rotor_r_out = 0.175
    rotor_r_in = 0.095
    rotor_segs = 24
    
    r_front_out, r_front_in = [], []
    r_back_out, r_back_in = [], []
    for i in range(rotor_segs):
        angle = i * (2.0 * math.pi / rotor_segs)
        y = math.cos(angle)
        z = math.sin(angle)
        r_front_out.append(bm.verts.new((rotor_x, rotor_r_out * y, rotor_r_out * z)))
        r_front_in.append(bm.verts.new((rotor_x, rotor_r_in * y, rotor_r_in * z)))
        r_back_out.append(bm.verts.new((rotor_x - rotor_thick, rotor_r_out * y, rotor_r_out * z)))
        r_back_in.append(bm.verts.new((rotor_x - rotor_thick, rotor_r_in * y, rotor_r_in * z)))
        
    for i in range(rotor_segs):
        i_next = (i + 1) % rotor_segs
        # Front disc face
        f_front = bm.faces.new([r_front_in[i], r_front_out[i], r_front_out[i_next], r_front_in[i_next]])
        # Outer rim of disc
        f_edge = bm.faces.new([r_front_out[i], r_back_out[i], r_back_out[i_next], r_front_out[i_next]])
        f_front.material_index = metal_mat_idx
        f_edge.material_index = metal_mat_idx

    # -------------------------------------------------------------
    # D. Brake Caliper (Performance 6-piston Red Caliper)
    # -------------------------------------------------------------
    obj.data.materials.append(mats['M_Brake_Caliper'])
    caliper_mat_idx = 3
    
    # Caliper placed on top-forward quadrant of disc (around angle 65 degrees)
    c_x1 = rotor_x + (0.015 * out_dir)
    c_x2 = rotor_x - rotor_thick - (0.02 * out_dir)
    caliper_angle_center = math.radians(70)
    caliper_arc = math.radians(40)
    caliper_r1 = rotor_r_in * 1.05
    caliper_r2 = rotor_r_out * 1.16
    
    c_verts_front = []
    c_verts_back = []
    caliper_steps = 5
    for step in range(caliper_steps):
        a = caliper_angle_center - caliper_arc * 0.5 + (step / (caliper_steps - 1)) * caliper_arc
        y1, z1 = caliper_r1 * math.cos(a), caliper_r1 * math.sin(a)
        y2, z2 = caliper_r2 * math.cos(a), caliper_r2 * math.sin(a)
        c_verts_front.append((bm.verts.new((c_x1, y1, z1)), bm.verts.new((c_x1, y2, z2))))
        c_verts_back.append((bm.verts.new((c_x2, y1, z1)), bm.verts.new((c_x2, y2, z2))))
        
    for s in range(caliper_steps - 1):
        vf_in1, vf_out1 = c_verts_front[s]
        vf_in2, vf_out2 = c_verts_front[s+1]
        vb_in1, vb_out1 = c_verts_back[s]
        vb_in2, vb_out2 = c_verts_back[s+1]
        
        f_top = bm.faces.new([vf_out1, vb_out1, vb_out2, vf_out2])
        f_side = bm.faces.new([vf_in1, vf_out1, vf_out2, vf_in2])
        f_inner = bm.faces.new([vb_in1, vb_in2, vb_out2, vb_out1])
        for f in [f_top, f_side, f_inner]:
            f.material_index = caliper_mat_idx

    # Finalize BMesh
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    # Position object at axle center
    obj.location = center_pos
    
    # Smooth normals
    add_smooth_and_normals(obj)
    
    return obj

# ==============================================================================
# 5. CAR BODY GEOMETRY (APX-01 Modern Japanese Sports Coupe)
# ==============================================================================

def build_car_body(mats):
    """
    Builds the main aerodynamic sports coupe body:
    - Sculpted long hood with power bulge
    - Low shark-nose front fascia
    - Muscular front fenders with air extractors
    - Sleek double-bubble sports roof
    - Fastback rear window deck
    - Aggressive flared rear haunches
    - Integrated ducktail lip spoiler
    - Sculpted rear bumper
    """
    mesh = bpy.data.meshes.new("APX01_Body_Mesh")
    obj = bpy.data.objects.new("APX01_Body", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Body_White'])
    
    bm = bmesh.new()
    
    # Longitudinal cross-sections (half-car, X >= 0, mirrored to negative X)
    # Each cross-section defines vertices from centerline (X=0) down to the bottom sill/diffuser:
    # Points along cross-section:
    # 0: Centerline Top (Hood / Roof / Deck)
    # 1: Centerline Bulge / Peak
    # 2: Top Edge / Shoulder (Hood crease / Roof rail / Deck crest)
    # 3: Beltline / Upper Door / Quarter panel top
    # 4: Muscular Crease / Wheel arch flare apex
    # 5: Mid Door / Wheel cutout top
    # 6: Lower Door / Rocker / Bumper side
    # 7: Bottom Sill / Splitter / Diffuser edge
    
    stations_data = [
        # Y, [ (X, Z) points from center top to bottom ]
        # 0: Front Nose / Splitter Top
        (2.26, [
            (0.00, 0.40), (0.15, 0.39), (0.35, 0.35), (0.55, 0.30),
            (0.68, 0.24), (0.75, 0.20), (0.78, 0.17), (0.72, 0.14)
        ]),
        # 1: Front Bumper Grille / Intake Front
        (2.14, [
            (0.00, 0.54), (0.20, 0.53), (0.45, 0.49), (0.68, 0.42),
            (0.80, 0.34), (0.84, 0.27), (0.85, 0.20), (0.80, 0.14)
        ]),
        # 2: Front Headlights / Hood Front Edge
        (1.92, [
            (0.00, 0.65), (0.22, 0.64), (0.50, 0.61), (0.76, 0.58),
            (0.86, 0.50), (0.88, 0.38), (0.88, 0.24), (0.84, 0.14)
        ]),
        # 3: Front Hood Forward / Fender Apex Forward
        (1.68, [
            (0.00, 0.70), (0.24, 0.69), (0.52, 0.67), (0.78, 0.70),
            (0.89, 0.65), (0.91, 0.48), (0.90, 0.28), (0.85, 0.14)
        ]),
        # 4: Front Wheel Arch Forward Boundary (Y=1.52)
        (1.52, [
            (0.00, 0.73), (0.25, 0.72), (0.54, 0.70), (0.79, 0.74),
            (0.91, 0.68), (0.92, 0.52), (0.88, 0.38), (0.85, 0.14)
        ]),
        # 5: Front Wheel Arch Apex (Y=1.30, axle center) - Arch cut out for wheel!
        (1.30, [
            (0.00, 0.76), (0.26, 0.75), (0.55, 0.73), (0.80, 0.76),
            (0.92, 0.72), (0.93, 0.60), (0.89, 0.49), (0.86, 0.40) # wheel arch clearance
        ]),
        # 6: Front Wheel Arch Rear Boundary (Y=1.08)
        (1.08, [
            (0.00, 0.78), (0.26, 0.77), (0.55, 0.75), (0.80, 0.77),
            (0.91, 0.71), (0.91, 0.54), (0.88, 0.38), (0.85, 0.14)
        ]),
        # 7: Hood Cowl / Side Fender Aero Extractor Vent (Y=0.82)
        (0.82, [
            (0.00, 0.81), (0.25, 0.80), (0.54, 0.78), (0.78, 0.79),
            (0.88, 0.72), (0.87, 0.52), (0.85, 0.32), (0.84, 0.14)
        ]),
        # 8: Windshield Base / Lower A-Pillar (Y=0.55)
        (0.55, [
            (0.00, 0.94), (0.24, 0.93), (0.50, 0.90), (0.72, 0.85),
            (0.86, 0.72), (0.86, 0.52), (0.84, 0.32), (0.84, 0.14)
        ]),
        # 9: Windshield Mid / A-Pillar / Door Forward (Y=0.18)
        (0.18, [
            (0.00, 1.18), (0.22, 1.17), (0.45, 1.12), (0.65, 0.90),
            (0.86, 0.73), (0.86, 0.52), (0.84, 0.32), (0.83, 0.14)
        ]),
        # 10: Roof Peak / Double Bubble / B-Pillar Waist (Y=-0.22)
        (-0.22, [
            (0.00, 1.27), (0.20, 1.28), (0.42, 1.25), (0.64, 0.92),
            (0.87, 0.74), (0.87, 0.52), (0.85, 0.32), (0.84, 0.14)
        ]),
        # 11: Fastback Slope / C-Pillar / Muscular Haunch Start (Y=-0.65)
        (-0.65, [
            (0.00, 1.22), (0.21, 1.21), (0.44, 1.16), (0.68, 0.93),
            (0.90, 0.77), (0.90, 0.54), (0.88, 0.32), (0.85, 0.14)
        ]),
        # 12: Rear Quarter Window / Muscular Haunch Flare (Y=-1.02)
        (-1.02, [
            (0.00, 1.08), (0.22, 1.07), (0.47, 1.02), (0.72, 0.92),
            (0.94, 0.81), (0.95, 0.58), (0.92, 0.38), (0.87, 0.14)
        ]),
        # 13: Rear Wheel Arch Apex (Y=-1.30, axle center) - Muscular Flare & Arch Cutout!
        (-1.30, [
            (0.00, 0.98), (0.24, 0.97), (0.50, 0.94), (0.76, 0.89),
            (0.96, 0.83), (0.97, 0.65), (0.93, 0.49), (0.89, 0.40) # wheel arch clearance
        ]),
        # 14: Rear Wheel Arch Rear Boundary (Y=-1.55)
        (-1.55, [
            (0.00, 0.94), (0.24, 0.94), (0.50, 0.92), (0.77, 0.88),
            (0.94, 0.81), (0.94, 0.60), (0.90, 0.38), (0.86, 0.15)
        ]),
        # 15: Rear Decklid / Ducktail Spoiler Base (Y=-1.80)
        (-1.80, [
            (0.00, 0.96), (0.22, 0.96), (0.48, 0.94), (0.74, 0.87),
            (0.90, 0.78), (0.90, 0.60), (0.86, 0.38), (0.82, 0.16)
        ]),
        # 16: Integrated Ducktail Spoiler Lip / Taillight Top (Y=-1.98)
        (-1.98, [
            (0.00, 1.00), (0.20, 0.99), (0.44, 0.97), (0.68, 0.89),
            (0.85, 0.78), (0.86, 0.58), (0.82, 0.38), (0.78, 0.18)
        ]),
        # 17: Rear Bumper Fascia / Taillight Bar (Y=-2.12)
        (-2.12, [
            (0.00, 0.82), (0.18, 0.81), (0.40, 0.79), (0.62, 0.76),
            (0.78, 0.68), (0.80, 0.52), (0.78, 0.35), (0.74, 0.20)
        ]),
        # 18: Rear Diffuser Trailing Edge (Y=-2.24)
        (-2.24, [
            (0.00, 0.52), (0.16, 0.51), (0.35, 0.48), (0.55, 0.44),
            (0.70, 0.40), (0.72, 0.34), (0.72, 0.28), (0.68, 0.22)
        ])
    ]
    
    rings = []
    for y_val, pts in stations_data:
        ring = []
        for x_val, z_val in pts:
            v = bm.verts.new((x_val, y_val, z_val))
            ring.append(v)
        rings.append(ring)
        
    num_pts_per_ring = len(stations_data[0][1])
    for s_idx in range(len(rings) - 1):
        r1 = rings[s_idx]
        r2 = rings[s_idx + 1]
        for p_idx in range(num_pts_per_ring - 1):
            # Quad face
            bm.faces.new([r1[p_idx], r1[p_idx + 1], r2[p_idx + 1], r2[p_idx]])
            
    # Front nose cap (close the front centerline)
    r_front = rings[0]
    nose_center = bm.verts.new((0.0, 2.27, 0.25))
    for p_idx in range(num_pts_per_ring - 1):
        bm.faces.new([nose_center, r_front[p_idx + 1], r_front[p_idx]])
        
    # Rear bumper cap (close the rear centerline)
    r_back = rings[-1]
    tail_center = bm.verts.new((0.0, -2.25, 0.32))
    for p_idx in range(num_pts_per_ring - 1):
        bm.faces.new([tail_center, r_back[p_idx], r_back[p_idx + 1]])

    # Underbody floor pan to seal the bottom
    floor_verts_right = []
    floor_verts_left = []
    for s_idx in range(len(rings)):
        # Bottom edge vertex of each ring
        v_bottom = rings[s_idx][-1]
        v_center = bm.verts.new((0.0, v_bottom.co.y, 0.15))
        bm.faces.new([v_center, v_bottom, rings[s_idx-1][-1], bm.verts.new((0.0, rings[s_idx-1][-1].co.y, 0.15))]) if s_idx > 0 else None

    # Mirror along X to make complete car body
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_and_apply(obj)
    
    # Subsurf / Bevel / Smooth Normals
    add_smooth_and_normals(obj)
    
    return obj

# ==============================================================================
# 6. GLASS & WINDOW SURFACES (APX01_Glass)
# ==============================================================================

def build_glass(mats):
    """
    Builds flush curved glass surfaces:
    - Raked front windshield
    - Frameless side door & quarter windows
    - Fastback rear window
    """
    mesh = bpy.data.meshes.new("APX01_Glass_Mesh")
    obj = bpy.data.objects.new("APX01_Glass", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Glass_Tinted'])
    
    bm = bmesh.new()
    
    # Half-windshield (X >= 0)
    # Station 8 (cowl: Y=0.56) to Station 10 (roof front: Y=0.16)
    ws_pts = [
        # Y, [(X, Z)]
        (0.56, [(0.00, 0.942), (0.24, 0.932), (0.48, 0.902), (0.69, 0.862)]),
        (0.38, [(0.00, 1.072), (0.22, 1.062), (0.44, 1.032), (0.64, 0.982)]),
        (0.18, [(0.00, 1.182), (0.21, 1.172), (0.42, 1.132), (0.62, 1.082)]),
    ]
    ws_rings = []
    for y_val, pts in ws_pts:
        ring = [bm.verts.new((x, y_val, z)) for x, z in pts]
        ws_rings.append(ring)
    for s in range(len(ws_rings) - 1):
        for i in range(len(ws_rings[0]) - 1):
            bm.faces.new([ws_rings[s][i], ws_rings[s][i+1], ws_rings[s+1][i+1], ws_rings[s+1][i]])

    # Side windows (frameless door + rear quarter glass)
    # Between beltline and roof rail
    side_pts = [
        # (X, Y, Z_belt, Z_roof)
        (0.66, 0.16, 0.88, 1.08),
        (0.67, -0.20, 0.89, 1.10),
        (0.70, -0.60, 0.90, 1.06),
        (0.73, -0.95, 0.91, 0.98),
    ]
    for s in range(len(side_pts) - 1):
        x1, y1, zb1, zr1 = side_pts[s]
        x2, y2, zb2, zr2 = side_pts[s+1]
        vb1 = bm.verts.new((x1, y1, zb1 + 0.005))
        vr1 = bm.verts.new((x1 - 0.03, y1, zr1 - 0.005))
        vb2 = bm.verts.new((x2, y2, zb2 + 0.005))
        vr2 = bm.verts.new((x2 - 0.03, y2, zr2 - 0.005))
        bm.faces.new([vb1, vr1, vr2, vb2])

    # Fastback Rear Window
    # From roof rear (Y=-0.35) to rear deck lid (Y=-1.40)
    rw_pts = [
        (-0.35, [(0.00, 1.262), (0.19, 1.252), (0.40, 1.212), (0.58, 1.122)]),
        (-0.70, [(0.00, 1.202), (0.19, 1.192), (0.40, 1.142), (0.59, 1.042)]),
        (-1.05, [(0.00, 1.062), (0.20, 1.052), (0.42, 1.002), (0.61, 0.942)]),
        (-1.40, [(0.00, 0.962), (0.21, 0.952), (0.43, 0.932), (0.63, 0.892)]),
    ]
    rw_rings = []
    for y_val, pts in rw_pts:
        ring = [bm.verts.new((x, y_val, z)) for x, z in pts]
        rw_rings.append(ring)
    for s in range(len(rw_rings) - 1):
        for i in range(len(rw_rings[0]) - 1):
            bm.faces.new([rw_rings[s][i], rw_rings[s][i+1], rw_rings[s+1][i+1], rw_rings[s+1][i]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_and_apply(obj)
    add_smooth_and_normals(obj)
    return obj

# ==============================================================================
# 7. AERODYNAMIC TRIM & EXHAUST (APX01_Trim)
# ==============================================================================

def build_trim(mats):
    """
    Builds aerodynamic performance trim:
    - Front aggressive chin splitter with winglets
    - Front lower intake grille mesh
    - Side ground-effect skirts with aero fins
    - Rear racing diffuser with 4 vertical strakes
    - Dual polished stainless steel exhaust cannons
    - Sleek aerodynamic side mirrors
    """
    mesh = bpy.data.meshes.new("APX01_Trim_Mesh")
    obj = bpy.data.objects.new("APX01_Trim", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Trim_Black']) # index 0
    obj.data.materials.append(mats['M_Metal'])      # index 1
    
    bm = bmesh.new()
    
    # -------------------------------------------------------------
    # A. Front Splitter (Carbon chin spoiler)
    # -------------------------------------------------------------
    splitter_pts = [
        # (X, Y, Z)
        (0.00, 2.30, 0.11), (0.25, 2.29, 0.11), (0.50, 2.26, 0.11),
        (0.72, 2.20, 0.11), (0.84, 2.10, 0.12), (0.87, 1.95, 0.14)
    ]
    sp_top, sp_bot = [], []
    for x, y, z in splitter_pts:
        sp_top.append(bm.verts.new((x, y, z + 0.015)))
        sp_bot.append(bm.verts.new((x, y, z)))
        
    for i in range(len(splitter_pts) - 1):
        # Top face
        f_top = bm.faces.new([sp_top[i], sp_top[i+1], bm.verts.new((sp_top[i+1].co.x * 0.7, sp_top[i+1].co.y - 0.15, sp_top[i+1].co.z)), bm.verts.new((sp_top[i].co.x * 0.7, sp_top[i].co.y - 0.15, sp_top[i].co.z))])
        # Front edge
        f_edge = bm.faces.new([sp_bot[i], sp_bot[i+1], sp_top[i+1], sp_top[i]])
        f_top.material_index = 0
        f_edge.material_index = 0
        
    # Splitter Side Winglet
    w_p1 = bm.verts.new((0.87, 1.95, 0.14))
    w_p2 = bm.verts.new((0.89, 2.05, 0.14))
    w_top1 = bm.verts.new((0.87, 1.95, 0.22))
    w_top2 = bm.verts.new((0.89, 2.05, 0.22))
    f_w = bm.faces.new([w_p1, w_p2, w_top2, w_top1])
    f_w.material_index = 0

    # -------------------------------------------------------------
    # B. Front Lower Intake Mesh
    # -------------------------------------------------------------
    grille_verts = [
        bm.verts.new((0.00, 2.14, 0.16)), bm.verts.new((0.45, 2.12, 0.16)),
        bm.verts.new((0.42, 2.10, 0.35)), bm.verts.new((0.00, 2.12, 0.35))
    ]
    f_grille = bm.faces.new(grille_verts)
    f_grille.material_index = 0

    # -------------------------------------------------------------
    # C. Aerodynamic Side Skirts (Between wheels Y=1.00 to -1.00)
    # -------------------------------------------------------------
    skirt_y = [1.00, 0.50, 0.00, -0.50, -1.00]
    sk_out, sk_in = [], []
    for y in skirt_y:
        # Subtle flare out towards the rear
        x_flare = 0.86 + 0.03 * (1.0 - y / 1.0) * 0.5
        sk_out.append(bm.verts.new((x_flare, y, 0.13)))
        sk_in.append(bm.verts.new((x_flare - 0.05, y, 0.13)))
        
    for i in range(len(skirt_y) - 1):
        f_sk = bm.faces.new([sk_out[i], sk_out[i+1], sk_in[i+1], sk_in[i]])
        f_sk.material_index = 0

    # -------------------------------------------------------------
    # D. Rear Diffuser with 4 Vertical Aero Fins
    # -------------------------------------------------------------
    diff_verts = [
        bm.verts.new((0.00, -2.10, 0.18)), bm.verts.new((0.65, -2.08, 0.18)),
        bm.verts.new((0.68, -2.25, 0.26)), bm.verts.new((0.00, -2.26, 0.26))
    ]
    f_diff = bm.faces.new(diff_verts)
    f_diff.material_index = 0
    
    # 2 vertical fins per side (X = 0.22, X = 0.44)
    for fin_x in [0.22, 0.44]:
        fin_v1 = bm.verts.new((fin_x, -2.08, 0.18))
        fin_v2 = bm.verts.new((fin_x, -2.26, 0.26))
        fin_v3 = bm.verts.new((fin_x, -2.26, 0.14)) # drops down
        fin_v4 = bm.verts.new((fin_x, -2.08, 0.12))
        f_fin = bm.faces.new([fin_v1, fin_v2, fin_v3, fin_v4])
        f_fin.material_index = 0

    # -------------------------------------------------------------
    # E. Dual Large Polished Stainless Exhaust Tips
    # -------------------------------------------------------------
    # Large dual exhaust tips integrated at X = ±0.50, Y = -2.20, Z = 0.26
    ex_x = 0.50
    ex_y_tip = -2.24
    ex_y_in = -2.12
    ex_z = 0.25
    ex_r = 0.052 # 104mm cannon
    ex_segs = 16
    
    ex_tip_ring, ex_in_ring = [], []
    for i in range(ex_segs):
        ang = i * (2.0 * math.pi / ex_segs)
        dx = ex_r * math.cos(ang)
        dz = ex_r * math.sin(ang)
        ex_tip_ring.append(bm.verts.new((ex_x + dx, ex_y_tip, ex_z + dz)))
        ex_in_ring.append(bm.verts.new((ex_x + dx, ex_y_in, ex_z + dz)))
        
    for i in range(ex_segs):
        i_next = (i + 1) % ex_segs
        f_ex = bm.faces.new([ex_tip_ring[i], ex_tip_ring[i_next], ex_in_ring[i_next], ex_in_ring[i]])
        f_ex.material_index = 1 # M_Metal

    # -------------------------------------------------------------
    # F. Aerodynamic Side Mirrors
    # -------------------------------------------------------------
    # Mounted on door shoulder at X = 0.86, Y = 0.55, Z = 0.88
    m_base = (0.85, 0.55, 0.88)
    m_tip = (1.02, 0.50, 0.92)
    # Stalk
    st1 = bm.verts.new(m_base)
    st2 = bm.verts.new((m_base[0] + 0.05, m_base[1] - 0.02, m_base[2] + 0.03))
    st3 = bm.verts.new((m_base[0] + 0.05, m_base[1] + 0.02, m_base[2] + 0.03))
    f_st = bm.faces.new([st1, st2, st3])
    f_st.material_index = 0
    
    # Mirror housing box
    hx, hy, hz = m_tip
    m_box = [
        bm.verts.new((hx - 0.06, hy - 0.04, hz - 0.03)),
        bm.verts.new((hx + 0.04, hy - 0.06, hz - 0.03)),
        bm.verts.new((hx + 0.05, hy + 0.06, hz - 0.02)),
        bm.verts.new((hx - 0.05, hy + 0.08, hz - 0.02)),
        bm.verts.new((hx - 0.06, hy - 0.04, hz + 0.03)),
        bm.verts.new((hx + 0.04, hy - 0.06, hz + 0.03)),
        bm.verts.new((hx + 0.05, hy + 0.06, hz + 0.04)),
        bm.verts.new((hx - 0.05, hy + 0.08, hz + 0.04)),
    ]
    # Housing faces
    faces_box = [
        [0, 1, 2, 3], [4, 7, 6, 5],
        [0, 4, 5, 1], [2, 6, 7, 3],
        [1, 5, 6, 2], [3, 7, 4, 0]
    ]
    for fb in faces_box:
        f_mb = bm.faces.new([m_box[idx] for idx in fb])
        f_mb.material_index = 0

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_and_apply(obj)
    add_smooth_and_normals(obj)
    return obj

# ==============================================================================
# 8. LIGHTING ELEMENTS (APX01_Lights_Front & APX01_Lights_Rear)
# ==============================================================================

def build_front_lights(mats):
    """
    Builds front headlights:
    - Angular dark housing bucket
    - Dual crystal LED projector lenses
    - Emissive DRL (Daytime Running Light) blade strip
    """
    mesh = bpy.data.meshes.new("APX01_Lights_Front_Mesh")
    obj = bpy.data.objects.new("APX01_Lights_Front", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Headlight'])  # index 0
    obj.data.materials.append(mats['M_Trim_Black']) # index 1
    
    bm = bmesh.new()
    
    # Right Headlight (mirrored to Left)
    # Front corner at Y=1.95, Z=0.56, X=0.60 to 0.85
    # LED DRL Blade (glowing strip along upper contour)
    drl_pts = [
        (0.58, 2.02, 0.56),
        (0.68, 1.96, 0.58),
        (0.80, 1.88, 0.60),
        (0.86, 1.76, 0.62)
    ]
    drl_top, drl_bot = [], []
    for x, y, z in drl_pts:
        drl_top.append(bm.verts.new((x, y, z + 0.018)))
        drl_bot.append(bm.verts.new((x, y, z)))
        
    for i in range(len(drl_pts) - 1):
        f = bm.faces.new([drl_bot[i], drl_bot[i+1], drl_top[i+1], drl_top[i]])
        f.material_index = 0 # M_Headlight
        
    # Dual Projector Lens Cylinders
    for p_x, p_y, p_z in [(0.66, 1.94, 0.55), (0.76, 1.86, 0.57)]:
        p_r = 0.035
        p_segs = 12
        lens_ring = []
        for i in range(p_segs):
            ang = i * (2.0 * math.pi / p_segs)
            lens_ring.append(bm.verts.new((p_x + p_r * math.cos(ang), p_y, p_z + p_r * math.sin(ang))))
        lens_center = bm.verts.new((p_x, p_y + 0.015, p_z))
        for i in range(p_segs):
            i_next = (i + 1) % p_segs
            f_lens = bm.faces.new([lens_center, lens_ring[i], lens_ring[i_next]])
            f_lens.material_index = 0

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_and_apply(obj)
    add_smooth_and_normals(obj)
    return obj

def build_rear_lights(mats):
    """
    Builds rear taillights:
    - Full-width slim dark light bar spanning the rear deck
    - Signature glowing crimson OLED brake/tail light elements
    """
    mesh = bpy.data.meshes.new("APX01_Lights_Rear_Mesh")
    obj = bpy.data.objects.new("APX01_Lights_Rear", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Taillight'])  # index 0
    obj.data.materials.append(mats['M_Trim_Black']) # index 1
    
    bm = bmesh.new()
    
    # Sleek full-width taillight bar just below ducktail spoiler (Y=-2.12 to -2.14, Z=0.78)
    tail_pts = [
        (0.00, -2.13, 0.79),
        (0.20, -2.13, 0.79),
        (0.42, -2.12, 0.78),
        (0.62, -2.10, 0.75),
        (0.76, -2.04, 0.70)
    ]
    t_top, t_bot = [], []
    for x, y, z in tail_pts:
        t_top.append(bm.verts.new((x, y, z + 0.035)))
        t_bot.append(bm.verts.new((x, y, z)))
        
    for i in range(len(tail_pts) - 1):
        f = bm.faces.new([t_bot[i], t_bot[i+1], t_top[i+1], t_top[i]])
        f.material_index = 0 # M_Taillight

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    mirror_and_apply(obj)
    add_smooth_and_normals(obj)
    return obj

# ==============================================================================
# 9. INTERIOR SILHOUETTE (APX01_Interior)
# ==============================================================================

def build_interior(mats):
    """
    Builds lightweight interior silhouette:
    - Floor tub and interior door cards
    - Twin sports bucket seats with distinct headrests and side bolsters
    - Dashboard cowl and center console
    - 3-spoke sports steering wheel
    """
    mesh = bpy.data.meshes.new("APX01_Interior_Mesh")
    obj = bpy.data.objects.new("APX01_Interior", mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mats['M_Interior_Dark'])
    
    bm = bmesh.new()
    
    # A. Floor tub
    floor_v = [
        bm.verts.new((-0.60, 0.60, 0.28)), bm.verts.new((0.60, 0.60, 0.28)),
        bm.verts.new((0.60, -0.90, 0.28)), bm.verts.new((-0.60, -0.90, 0.28))
    ]
    bm.faces.new(floor_v)
    
    # B. Dashboard & Center Console
    dash_v = [
        bm.verts.new((-0.58, 0.52, 0.75)), bm.verts.new((0.58, 0.52, 0.75)),
        bm.verts.new((0.58, 0.25, 0.70)), bm.verts.new((-0.58, 0.25, 0.70)),
        bm.verts.new((-0.58, 0.52, 0.45)), bm.verts.new((0.58, 0.52, 0.45)),
    ]
    bm.faces.new([dash_v[0], dash_v[1], dash_v[2], dash_v[3]]) # dash top
    bm.faces.new([dash_v[3], dash_v[2], dash_v[5], dash_v[4]]) # dash face
    
    # Center console tunnel
    con_v = [
        bm.verts.new((-0.10, 0.25, 0.50)), bm.verts.new((0.10, 0.25, 0.50)),
        bm.verts.new((0.10, -0.60, 0.40)), bm.verts.new((-0.10, -0.60, 0.40))
    ]
    bm.faces.new(con_v)

    # C. Sports Bucket Seats (Left and Right)
    for seat_x in [-0.34, 0.34]:
        # Seat Cushion
        sc_y1, sc_y2 = -0.05, -0.45
        sc_z1, sc_z2 = 0.32, 0.38
        sc_w = 0.21
        sc_verts = [
            bm.verts.new((seat_x - sc_w, sc_y1, sc_z2)), bm.verts.new((seat_x + sc_w, sc_y1, sc_z2)),
            bm.verts.new((seat_x + sc_w, sc_y2, sc_z1)), bm.verts.new((seat_x - sc_w, sc_y2, sc_z1))
        ]
        bm.faces.new(sc_verts)
        
        # Seat Backrest
        sb_y1, sb_y2 = -0.42, -0.60
        sb_z1, sb_z2 = 0.38, 0.88
        sb_verts = [
            bm.verts.new((seat_x - sc_w * 0.9, sb_y1, sb_z1)), bm.verts.new((seat_x + sc_w * 0.9, sb_y1, sb_z1)),
            bm.verts.new((seat_x + sc_w * 0.75, sb_y2, sb_z2)), bm.verts.new((seat_x - sc_w * 0.75, sb_y2, sb_z2))
        ]
        bm.faces.new(sb_verts)
        
        # Headrest
        hr_w = 0.10
        hr_y1, hr_y2 = -0.58, -0.62
        hr_z1, hr_z2 = 0.88, 1.00
        hr_verts = [
            bm.verts.new((seat_x - hr_w, hr_y1, hr_z1)), bm.verts.new((seat_x + hr_w, hr_y1, hr_z1)),
            bm.verts.new((seat_x + hr_w, hr_y2, hr_z2)), bm.verts.new((seat_x - hr_w, hr_y2, hr_z2))
        ]
        bm.faces.new(hr_verts)

    # D. 3-Spoke Sports Steering Wheel (Driver side, LHD: Left side X = -0.34)
    sw_x = -0.34
    sw_y = 0.16
    sw_z = 0.68
    sw_r = 0.15
    sw_segs = 16
    sw_ring = []
    for i in range(sw_segs):
        ang = i * (2.0 * math.pi / sw_segs)
        # Raked back by ~20 degrees
        dy = -sw_r * math.sin(ang) * 0.35
        dz = sw_r * math.sin(ang) * 0.94
        dx = sw_r * math.cos(ang)
        sw_ring.append(bm.verts.new((sw_x + dx, sw_y + dy, sw_z + dz)))
        
    sw_hub = bm.verts.new((sw_x, sw_y + 0.02, sw_z))
    for i in range(sw_segs):
        i_next = (i + 1) % sw_segs
        bm.faces.new([sw_hub, sw_ring[i], sw_ring[i_next]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    
    add_smooth_and_normals(obj)
    return obj

# ==============================================================================
# 10. SCENE HIERARCHY & STATS
# ==============================================================================

def organize_scene(vehicle_objects):
    """Places vehicle objects in APX01_Vehicle collection."""
    col = bpy.data.collections.new("APX01_Vehicle")
    bpy.context.scene.collection.children.link(col)
    
    # Move objects to APX01_Vehicle collection
    for obj in vehicle_objects:
        # Unlink from default collection
        for c in obj.users_collection:
            c.objects.unlink(obj)
        col.objects.link(obj)
    return col

def count_polys_and_tris(objects):
    """Calculates polygon and triangle counts."""
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
# 11. STUDIO & INSPECTION RENDERING
# ==============================================================================

def setup_studio():
    """Sets up studio lighting and camera in a separate collection."""
    studio_col = bpy.data.collections.new("APX01_Studio")
    bpy.context.scene.collection.children.link(studio_col)
    
    # Studio Camera
    cam_data = bpy.data.cameras.new("Studio_Camera")
    cam_data.lens = 55
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0
    cam_obj = bpy.data.objects.new("Studio_Camera", cam_data)
    studio_col.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    
    # Key Light (Warm soft directional light)
    key_light = bpy.data.lights.new("Studio_KeyLight", type='AREA')
    key_light.energy = 800.0
    key_light.size = 5.0
    key_light.color = (1.0, 0.98, 0.95)
    key_obj = bpy.data.objects.new("Studio_KeyLight", key_light)
    key_obj.location = (-4.0, 4.0, 4.5)
    key_obj.rotation_euler = Euler((math.radians(45), 0, math.radians(-45)), 'XYZ')
    studio_col.objects.link(key_obj)
    
    # Fill Light (Cool ambient soft light)
    fill_light = bpy.data.lights.new("Studio_FillLight", type='AREA')
    fill_light.energy = 400.0
    fill_light.size = 6.0
    fill_light.color = (0.85, 0.92, 1.0)
    fill_obj = bpy.data.objects.new("Studio_FillLight", fill_light)
    fill_obj.location = (4.5, -3.0, 3.5)
    fill_obj.rotation_euler = Euler((math.radians(35), 0, math.radians(125)), 'XYZ')
    studio_col.objects.link(fill_obj)
    
    # Rim / Hair Light (Crisp edge highlight)
    rim_light = bpy.data.lights.new("Studio_RimLight", type='AREA')
    rim_light.energy = 900.0
    rim_light.size = 4.0
    rim_light.color = (1.0, 1.0, 1.0)
    rim_obj = bpy.data.objects.new("Studio_RimLight", rim_light)
    rim_obj.location = (0.0, -5.5, 3.0)
    rim_obj.rotation_euler = Euler((math.radians(60), 0, math.radians(180)), 'XYZ')
    studio_col.objects.link(rim_obj)
    
    # Ground plane (Shadow catcher / subtle studio floor)
    mesh_floor = bpy.data.meshes.new("Studio_Floor_Mesh")
    bm_f = bmesh.new()
    bmesh.ops.create_grid(bm_f, x_segments=2, y_segments=2, size=15.0)
    bm_f.to_mesh(mesh_floor)
    bm_f.free()
    floor_obj = bpy.data.objects.new("Studio_Floor", mesh_floor)
    studio_col.objects.link(floor_obj)
    floor_obj.location = (0, 0, 0.0)
    
    # Floor material (dark neutral studio floor)
    floor_mat = bpy.data.materials.new("M_Studio_Floor")
    floor_mat.use_nodes = True
    nodes = floor_mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.08, 0.08, 0.09, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.4
    floor_obj.data.materials.append(floor_mat)
    
    return cam_obj, studio_col

def set_camera_view(cam_obj, view_name):
    """Positions the camera for standard automotive inspection angles."""
    # Target center of car: (0, 0, 0.65)
    if view_name == "front_three_quarter":
        # Classic 3/4 chase angle
        cam_obj.location = (-4.8, 4.8, 2.1)
        cam_obj.rotation_euler = Euler((math.radians(72), 0, math.radians(-45)), 'XYZ')
    elif view_name == "rear_three_quarter":
        # Rear 3/4 racing chase view
        cam_obj.location = (-4.5, -4.8, 1.9)
        cam_obj.rotation_euler = Euler((math.radians(74), 0, math.radians(-138)), 'XYZ')
    elif view_name == "side":
        # Pure side profile
        cam_obj.location = (-6.2, 0.0, 1.25)
        cam_obj.rotation_euler = Euler((math.radians(88), 0, math.radians(-90)), 'XYZ')
    elif view_name == "front":
        # Aggressive front fascia
        cam_obj.location = (0.0, 5.8, 1.1)
        cam_obj.rotation_euler = Euler((math.radians(86), 0, math.radians(180)), 'XYZ')
    elif view_name == "rear":
        # Muscular rear fascia & diffuser
        cam_obj.location = (0.0, -5.8, 1.1)
        cam_obj.rotation_euler = Euler((math.radians(86), 0, 0), 'XYZ')

def render_inspection_views(cam_obj, output_dir):
    """Renders inspection images using Workbench or EEVEE."""
    scene = bpy.context.scene
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    
    # Check render engine
    scene.render.engine = 'BLENDER_EEVEE'
    
    views = [
        ("front_three_quarter", "apx01_front_quarter.png"),
        ("rear_three_quarter", "apx01_rear_quarter.png"),
        ("side", "apx01_side.png"),
        ("front", "apx01_front.png"),
        ("rear", "apx01_rear.png"),
    ]
    
    rendered_files = []
    for view_name, filename in views:
        set_camera_view(cam_obj, view_name)
        out_path = os.path.join(output_dir, filename)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        if os.path.exists(out_path):
            rendered_files.append(out_path)
            print(f"Rendered: {filename}")
    return rendered_files

# ==============================================================================
# 12. GLTF / GLB EXPORT & VERIFICATION
# ==============================================================================

def export_vehicle_glb(vehicle_objects, glb_path):
    """
    Exports ONLY the vehicle objects to game-ready GLB.
    Excludes studio lights, floor, and cameras.
    """
    # Select only vehicle objects
    bpy.ops.object.select_all(action='DESELECT')
    for obj in vehicle_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = vehicle_objects[0]
    
    # Export glTF 2.0
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        use_selection=True,
        export_apply=False, # Preserve separate wheel origins and object transforms!
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_normals=True
    )
    print(f"GLB Exported to: {glb_path}")

def verify_glb(glb_path):
    """Re-imports the exported GLB in an isolated clean environment to verify integrity."""
    print("Verifying exported GLB file...")
    if not os.path.exists(glb_path):
        raise FileNotFoundError(f"GLB file not found: {glb_path}")
    size = os.path.getsize(glb_path)
    print(f"GLB File Size: {size / 1024:.1f} KB")
    
    # Clean check scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb_path)
    
    imported_objects = [o.name for o in bpy.data.objects]
    print(f"Imported objects ({len(imported_objects)}): {imported_objects}")
    
    required_wheels = ['FL_Wheel', 'FR_Wheel', 'RL_Wheel', 'RR_Wheel']
    for w in required_wheels:
        matched = [o for o in bpy.data.objects if w in o.name]
        if matched:
            obj = matched[0]
            print(f" Verified wheel: {obj.name} at location {obj.location[:]}")
        else:
            print(f" WARNING: Wheel {w} not found in reimported objects!")
            
    imported_materials = [m.name for m in bpy.data.materials]
    print(f"Imported materials ({len(imported_materials)}): {imported_materials}")
    return True

# ==============================================================================
# 13. MAIN EXECUTION PIPELINE
# ==============================================================================

def main():
    print("=" * 60)
    print("Starting APX-01 3D Sports Coupe Generation Pipeline")
    print("=" * 60)
    
    output_dir = r"c:\Users\Dell\Documents\coding\ProjectApex\assets\vehicles\APX01"
    os.makedirs(output_dir, exist_ok=True)
    blend_path = os.path.join(output_dir, "APX01.blend")
    glb_path = os.path.join(output_dir, "APX01.glb")
    
    # Step 1: Reset scene & create materials
    reset_scene()
    mats = create_all_materials()
    print("Materials created.")
    
    # Step 2: Build Vehicle Geometry
    body = build_car_body(mats)
    glass = build_glass(mats)
    trim = build_trim(mats)
    lights_f = build_front_lights(mats)
    lights_r = build_rear_lights(mats)
    interior = build_interior(mats)
    
    # Step 3: Build 4 Wheel Assemblies with exact axle pivot origins
    fl_wheel = build_wheel_assembly("FL_Wheel", (AXLE_X_LEFT, AXLE_Y_FRONT, AXLE_Z), is_right_side=False, mats=mats)
    fr_wheel = build_wheel_assembly("FR_Wheel", (AXLE_X_RIGHT, AXLE_Y_FRONT, AXLE_Z), is_right_side=True, mats=mats)
    rl_wheel = build_wheel_assembly("RL_Wheel", (AXLE_X_LEFT, AXLE_Y_REAR, AXLE_Z), is_right_side=False, mats=mats)
    rr_wheel = build_wheel_assembly("RR_Wheel", (AXLE_X_RIGHT, AXLE_Y_REAR, AXLE_Z), is_right_side=True, mats=mats)
    
    vehicle_objects = [body, glass, trim, lights_f, lights_r, interior, fl_wheel, fr_wheel, rl_wheel, rr_wheel]
    
    # Step 4: Organize Collections
    vehicle_col = organize_scene(vehicle_objects)
    print(f"Vehicle objects organized into collection: {vehicle_col.name}")
    
    # Step 5: Report Polygon and Triangle Stats
    total_polys, total_tris, stats = count_polys_and_tris(vehicle_objects)
    print("-" * 50)
    print("GEOMETRY AUDIT / STATS:")
    for obj_name, (polys, tris) in stats.items():
        print(f"  {obj_name:20}: {polys:5} polys | {tris:6} tris")
    print("-" * 50)
    print(f"TOTAL VEHICLE: {total_polys} polygons | {total_tris} triangles")
    print("-" * 50)
    
    # Step 6: Setup Studio & Render Inspection Images
    cam_obj, studio_col = setup_studio()
    print("Rendering inspection screenshots...")
    rendered_images = render_inspection_views(cam_obj, output_dir)
    print(f"Rendered {len(rendered_images)} inspection views.")
    
    # Step 7: Save Native .blend File
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Native Blender project saved: {blend_path}")
    
    # Step 8: Export Game-Ready GLB
    export_vehicle_glb(vehicle_objects, glb_path)
    
    # Step 9: Verify Re-import
    verify_glb(glb_path)
    
    print("=" * 60)
    print("APX-01 Generation Completed Successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
