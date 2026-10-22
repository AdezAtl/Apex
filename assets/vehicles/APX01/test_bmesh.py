"""
Test script to verify procedural car body construction using BMesh in Blender 5.2.
"""
import bpy
import bmesh
import math
from mathutils import Vector

def test_mesh():
    mesh = bpy.data.meshes.new("TestBody")
    bm = bmesh.new()
    
    # Simple test box
    bmesh.ops.create_cube(bm, size=1.0)
    bm.to_mesh(mesh)
    bm.free()
    
    obj = bpy.data.objects.new("TestBodyObj", mesh)
    bpy.context.collection.objects.link(obj)
    print("Mesh created successfully:", obj.name)

test_mesh()
