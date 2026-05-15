#!/usr/bin/env python3
"""
Inspect FBX file structure to see if it's a single mesh or multiple objects.
"""

import sys
import subprocess
from pathlib import Path

BLENDER_SCRIPT = """
import bpy
import sys

# Get arguments
argv = sys.argv
argv = argv[argv.index("--") + 1:]
input_file = argv[0]

print(f"\\n{'='*60}")
print("🔍 FBX FILE INSPECTION")
print(f"{'='*60}")
print(f"File: {input_file}")

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import FBX
print(f"\\n📂 Importing FBX...")
bpy.ops.import_scene.fbx(filepath=input_file)

# Get all objects
all_objects = list(bpy.context.scene.objects)
mesh_objects = [obj for obj in all_objects if obj.type == 'MESH']

print(f"\\n📊 STRUCTURE:")
print(f"   Total objects: {len(all_objects)}")
print(f"   Mesh objects: {len(mesh_objects)}")

if len(mesh_objects) == 1:
    print(f"\\n✅ SINGLE MESH")
else:
    print(f"\\n⚠️  MULTIPLE MESHES ({len(mesh_objects)})")

print(f"\\n📋 MESH DETAILS:")
for i, obj in enumerate(mesh_objects):
    verts = len(obj.data.vertices)
    faces = len(obj.data.polygons)
    materials = len(obj.data.materials)
    print(f"\\n   Mesh {i+1}: {obj.name}")
    print(f"      Vertices: {verts:,}")
    print(f"      Faces: {faces:,}")
    print(f"      Materials: {materials}")

total_verts = sum(len(obj.data.vertices) for obj in mesh_objects)
total_faces = sum(len(obj.data.polygons) for obj in mesh_objects)

print(f"\\n📈 TOTALS:")
print(f"   Total vertices: {total_verts:,}")
print(f"   Total faces: {total_faces:,}")

print(f"\\n{'='*60}\\n")
"""

def find_blender():
    common_paths = [
        "/Applications/Blender.app/Contents/MacOS/Blender",
        "/usr/local/bin/blender",
        "/opt/homebrew/bin/blender",
    ]
    
    for path in common_paths:
        if Path(path).exists():
            return path
    
    try:
        result = subprocess.run(['which', 'blender'], capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except:
        pass
    
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python inspect_fbx.py <file.fbx>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    if not Path(input_file).exists():
        print(f"❌ File not found: {input_file}")
        sys.exit(1)
    
    blender_path = find_blender()
    if not blender_path:
        print("❌ Blender not found!")
        sys.exit(1)
    
    script_file = Path("_temp_inspect.py")
    script_file.write_text(BLENDER_SCRIPT)
    
    try:
        cmd = [
            blender_path,
            "--background",
            "--python", str(script_file),
            "--",
            str(Path(input_file).absolute())
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.stdout:
            for line in result.stdout.split('\n'):
                if any(marker in line for marker in ['='*60, '🔍', '📂', '📊', '✅', '⚠️', '📋', '📈', 'STRUCTURE', 'MESH', 'Total', 'Mesh ', 'Vertices', 'Faces', 'Materials', 'objects:']):
                    print(line)
        
        if result.returncode != 0:
            print(f"\n❌ Inspection failed")
            sys.exit(1)
        
    finally:
        if script_file.exists():
            script_file.unlink()

if __name__ == "__main__":
    main()
