#!/usr/bin/env python3
"""
Convert GLB to FBX format for Mixamo upload.
Uses Blender to convert while preserving textures and materials.
"""

import sys
import subprocess
from pathlib import Path

BLENDER_SCRIPT = """
import bpy
import sys
import math

# Get arguments
argv = sys.argv
argv = argv[argv.index("--") + 1:]

input_file = argv[0]
output_file = argv[1]
rotate_y = float(argv[2]) if len(argv) > 2 else 0

print(f"\\n{'='*60}")
print("🔄 GLB TO FBX CONVERSION")
print(f"{'='*60}")
print(f"Input: {input_file}")
print(f"Output: {output_file}")
if rotate_y:
    print(f"Rotation: {rotate_y}° around Y-axis (vertical)")

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import GLB
print(f"\\n📂 Importing GLB...")
bpy.ops.import_scene.gltf(filepath=input_file)

# Get all objects
all_objects = list(bpy.context.scene.objects)
mesh_objects = [obj for obj in all_objects if obj.type == 'MESH']

print(f"✅ Imported {len(mesh_objects)} mesh object(s)")

if not mesh_objects:
    print("❌ No mesh found!")
    sys.exit(1)

# Get stats
total_verts = sum(len(obj.data.vertices) for obj in mesh_objects)
total_faces = sum(len(obj.data.polygons) for obj in mesh_objects)
print(f"   Vertices: {total_verts:,}")
print(f"   Faces: {total_faces:,}")

# Apply rotation if specified
if rotate_y:
    print(f"\\n🔄 Rotating {rotate_y}° around Y-axis...")
    
    # Select all objects (mesh and non-mesh)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in all_objects:
        obj.select_set(True)
    
    if all_objects:
        bpy.context.view_layer.objects.active = all_objects[0]
    
    # Apply rotation
    bpy.ops.transform.rotate(value=math.radians(rotate_y), orient_axis='Y')
    
    # Apply the transformation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    print(f"✅ Rotation applied")

# Select all objects for export
bpy.ops.object.select_all(action='SELECT')

# Export to FBX
print(f"\\n💾 Exporting to FBX...")
bpy.ops.export_scene.fbx(
    filepath=output_file,
    use_selection=True,
    object_types={'MESH', 'ARMATURE', 'EMPTY'},
    use_mesh_modifiers=True,
    mesh_smooth_type='FACE',
    use_tspace=True,
    use_custom_props=False,
    add_leaf_bones=False,
    primary_bone_axis='Y',
    secondary_bone_axis='X',
    bake_anim=False,
    path_mode='COPY',
    embed_textures=True,
    axis_forward='-Z',
    axis_up='Y'
)

print(f"✅ Export complete!")
print(f"{'='*60}\\n")
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
    if len(sys.argv) < 3:
        print("Usage: python convert_to_fbx.py <input.glb> <output.fbx> [rotation_y_degrees]")
        print("\nExamples:")
        print("  python convert_to_fbx.py textured_mesh_glb.glb output.fbx")
        print("  python convert_to_fbx.py textured_mesh_glb.glb output.fbx 90")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    rotation = sys.argv[3] if len(sys.argv) > 3 else "0"
    
    if not Path(input_file).exists():
        print(f"❌ Input file not found: {input_file}")
        sys.exit(1)
    
    blender_path = find_blender()
    if not blender_path:
        print("❌ Blender not found!")
        sys.exit(1)
    
    print(f"✅ Found Blender: {blender_path}")
    
    script_file = Path("_temp_fbx_convert.py")
    script_file.write_text(BLENDER_SCRIPT)
    
    try:
        cmd = [
            blender_path,
            "--background",
            "--python", str(script_file),
            "--",
            str(Path(input_file).absolute()),
            str(Path(output_file).absolute()),
            rotation
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.stdout:
            for line in result.stdout.split('\n'):
                if any(marker in line for marker in ['='*60, '🔄', '📂', '✅', '❌', '💾', 'Vertices', 'Faces', 'Rotation', 'Imported']):
                    print(line)
        
        if result.returncode != 0:
            print(f"\n❌ Conversion failed")
            if result.stderr:
                print(result.stderr)
            sys.exit(1)
        
        if Path(output_file).exists():
            size_mb = Path(output_file).stat().st_size / (1024 * 1024)
            print(f"\n✅ Conversion successful!")
            print(f"   Output: {output_file}")
            print(f"   Size: {size_mb:.2f} MB")
        else:
            print(f"\n❌ Output file was not created")
            sys.exit(1)
        
    finally:
        if script_file.exists():
            script_file.unlink()

if __name__ == "__main__":
    main()
