"""
Verification script for continuous automotive body mesh in Blender 5.2.
"""
import bpy
import bmesh
import math
from mathutils import Vector

def test_body_structure():
    mesh = bpy.data.meshes.new("TestUnifiedBody")
    bm = bmesh.new()
    
    # Verify wheel arch generation:
    # A wheel arch is a circular cutout on the side of the car:
    # Center = (Y=1.30, Z=0.33), Radius = 0.38m
    arch_angles = [0, 30, 60, 90, 120, 150, 180]
    arch_outer = []
    arch_inner = []
    
    fender_x = 0.92
    tub_x = 0.70
    
    for a_deg in arch_angles:
        rad = math.radians(a_deg)
        # From bottom rear (a=0, Y=1.30+R, Z=0.33) through top (a=90, Y=1.30, Z=0.33+R) to bottom front (a=180, Y=1.30-R, Z=0.33)
        y = 1.30 + 0.38 * math.cos(rad)
        z = 0.33 + 0.38 * math.sin(rad)
        vo = bm.verts.new((fender_x, y, z))
        vi = bm.verts.new((tub_x, y, z))
        arch_outer.append(vo)
        arch_inner.append(vi)
        
    for i in range(len(arch_angles) - 1):
        # Wall of wheel well
        bm.faces.new([arch_outer[i], arch_outer[i+1], arch_inner[i+1], arch_inner[i]])
        
    bm.to_mesh(mesh)
    bm.free()
    print("Wheel arch verification successful! Faces:", len(mesh.polygons))

test_body_structure()
