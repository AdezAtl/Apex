"""
APX-01 3D Sports Coupe Procedural Generator for Project Apex
Built for Blender 5.x / Babylon.js glTF Pipeline
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler
import os
import sys

def clear_scene():
    """Reset the scene completely."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure standard scene exists
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")
    scene = bpy.context.scene
    # Set units to metric
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = 'METERS'
    return scene

def create_pbr_material(name, base_color, metallic=0.0, roughness=0.5, emission=None, emission_strength=1.0, alpha=1.0):
    """Create a glTF-compatible Principled BSDF material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    
    node_out = nodes.new(type='ShaderNodeOutputMaterial')
    node_bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    
    # Base Color
    node_bsdf.inputs['Base Color'].default_value = base_color
    # Metallic
    node_bsdf.inputs['Metallic'].default_value = metallic
    # Roughness
    node_bsdf.inputs['Roughness'].default_value = roughness
    # Alpha
    if 'Alpha' in node_bsdf.inputs:
        node_bsdf.inputs['Alpha'].default_value = alpha
    
    # Emission (Blender 4.x/5.x Principled BSDF uses 'Emission Color' and 'Emission Strength')
    if emission:
        if 'Emission Color' in node_bsdf.inputs:
            node_bsdf.inputs['Emission Color'].default_value = emission
            node_bsdf.inputs['Emission Strength'].default_value = emission_strength
        elif 'Emission' in node_bsdf.inputs:
            node_bsdf.inputs['Emission'].default_value = emission
            
    if alpha < 1.0:
        mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else 'HASHED'
        if hasattr(mat, 'shadow_method'):
            mat.shadow_method = 'HASHED'
            
    links.new(node_bsdf.outputs['BSDF'], node_out.inputs['Surface'])
    return mat

def create_all_materials():
    """Create all required materials."""
    materials = {}
    # M_Body_White: Pearlescent metallic white automotive clearcoat
    materials['M_Body_White'] = create_pbr_material(
        'M_Body_White', 
        base_color=(0.92, 0.93, 0.96, 1.0), 
        metallic=0.85, 
        roughness=0.22
    )
    # M_Tire_Rubber: Deep matte charcoal/black rubber
    materials['M_Tire_Rubber'] = create_pbr_material(
        'M_Tire_Rubber', 
        base_color=(0.04, 0.04, 0.04, 1.0), 
        metallic=0.0, 
        roughness=0.78
    )
    # M_Wheel_Black: Forged satin black alloy
    materials['M_Wheel_Black'] = create_pbr_material(
        'M_Wheel_Black', 
        base_color=(0.03, 0.03, 0.03, 1.0), 
        metallic=0.92, 
        roughness=0.25
    )
    # M_Glass_Tinted: Dark aerodynamic sports glass
    materials['M_Glass_Tinted'] = create_pbr_material(
        'M_Glass_Tinted', 
        base_color=(0.03, 0.04, 0.06, 1.0), 
        metallic=0.1, 
        roughness=0.05,
        alpha=0.82
    )
    # M_Headlight: Crisp modern LED projector / DRL glow
    materials['M_Headlight'] = create_pbr_material(
        'M_Headlight', 
        base_color=(0.95, 0.98, 1.0, 1.0), 
        metallic=0.2, 
        roughness=0.1,
        emission=(0.85, 0.94, 1.0, 1.0),
        emission_strength=4.0
    )
    # M_Taillight: Vibrant crimson OLED taillight bar
    materials['M_Taillight'] = create_pbr_material(
        'M_Taillight', 
        base_color=(0.85, 0.02, 0.02, 1.0), 
        metallic=0.1, 
        roughness=0.15,
        emission=(0.98, 0.01, 0.01, 1.0),
        emission_strength=4.0
    )
    # M_Trim_Black: Satin aerodynamic carbon/matte composite trim
    materials['M_Trim_Black'] = create_pbr_material(
        'M_Trim_Black', 
        base_color=(0.025, 0.025, 0.025, 1.0), 
        metallic=0.15, 
        roughness=0.45
    )
    # M_Metal: Polished stainless steel exhaust & drilled brake disc
    materials['M_Metal'] = create_pbr_material(
        'M_Metal', 
        base_color=(0.78, 0.78, 0.80, 1.0), 
        metallic=0.95, 
        roughness=0.22
    )
    # M_Brake_Caliper: High-performance racing red caliper
    materials['M_Brake_Caliper'] = create_pbr_material(
        'M_Brake_Caliper', 
        base_color=(0.88, 0.04, 0.04, 1.0), 
        metallic=0.35, 
        roughness=0.25
    )
    # M_Interior_Dark: Charcoal sports interior
    materials['M_Interior_Dark'] = create_pbr_material(
        'M_Interior_Dark', 
        base_color=(0.035, 0.035, 0.038, 1.0), 
        metallic=0.0, 
        roughness=0.85
    )
    return materials

print("Materials module loaded.")
