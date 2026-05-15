#!/usr/bin/env python3
"""
Set up a basic rig in Blender for the wire figure.
This creates a simplified armature that you can refine manually.
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
use_rigify = argv[2].lower() == 'true' if len(argv) > 2 else False

print(f"\\n{'='*60}")
print("🦴 BLENDER RIGGING SETUP")
print(f"{'='*60}")
print(f"Input: {input_file}")
print(f"Output: {output_file}")
print(f"Use Rigify: {use_rigify}")

# Enable Rigify addon if requested
if use_rigify:
    print(f"\\n📦 Enabling Rigify addon...")
    try:
        bpy.ops.preferences.addon_enable(module="rigify")
        print(f"✅ Rigify enabled")
    except:
        print(f"⚠️  Rigify already enabled or not available")

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# Import mesh
print(f"\\n📂 Importing mesh...")
if input_file.endswith('.fbx'):
    bpy.ops.import_scene.fbx(filepath=input_file)
elif input_file.endswith('.glb') or input_file.endswith('.gltf'):
    bpy.ops.import_scene.gltf(filepath=input_file)
else:
    print(f"❌ Unsupported file format")
    sys.exit(1)

mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
print(f"✅ Imported {len(mesh_objects)} mesh object(s)")

if not mesh_objects:
    print("❌ No mesh found!")
    sys.exit(1)

mesh = mesh_objects[0]
bpy.context.view_layer.objects.active = mesh

# Get mesh bounds for armature scaling
bbox = mesh.bound_box
min_z = min(v[2] for v in bbox)
max_z = max(v[2] for v in bbox)
height = max_z - min_z
center_x = sum(v[0] for v in bbox) / 8
center_y = sum(v[1] for v in bbox) / 8
center_z = (min_z + max_z) / 2

print(f"\\n📏 Mesh dimensions:")
print(f"   Height: {height:.2f}")
print(f"   Center: ({center_x:.2f}, {center_y:.2f}, {center_z:.2f})")

# Add armature
print(f"\\n🦴 Adding armature...")

if use_rigify:
    # Add Rigify metarig
    try:
        bpy.ops.object.armature_human_metarig_add()
        armature = bpy.context.active_object
        print(f"✅ Added Rigify metarig")
        
        # Scale and position to match mesh
        armature.location = (center_x, center_y, min_z)
        scale_factor = height / 2.0
        armature.scale = (scale_factor, scale_factor, scale_factor)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        
        print(f"✅ Scaled metarig to match mesh (factor: {scale_factor:.2f})")
        print(f"\\n⚠️  IMPORTANT: You need to manually:")
        print(f"   1. Select the armature")
        print(f"   2. Enter Edit Mode (Tab)")
        print(f"   3. Enable X-Ray mode (Alt+Z)")
        print(f"   4. Adjust bones to match your figure")
        print(f"   5. In Object Mode, select armature")
        print(f"   6. Generate rig (Armature Properties > Rigify > Generate)")
        
    except Exception as e:
        print(f"❌ Failed to add Rigify metarig: {e}")
        print(f"   Falling back to basic armature...")
        use_rigify = False

if not use_rigify:
    # Add basic armature
    bpy.ops.object.armature_add(location=(center_x, center_y, min_z))
    armature = bpy.context.active_object
    armature.name = "Armature"
    
    # Enter edit mode to add bones
    bpy.ops.object.mode_set(mode='EDIT')
    
    # Get the default bone
    edit_bones = armature.data.edit_bones
    root_bone = edit_bones[0]
    root_bone.name = "Root"
    
    # Position root bone
    root_bone.head = (center_x, center_y, min_z)
    root_bone.tail = (center_x, center_y, min_z + height * 0.1)
    
    # Add spine bones
    spine_base = edit_bones.new("Spine")
    spine_base.head = (center_x, center_y, min_z + height * 0.1)
    spine_base.tail = (center_x, center_y, min_z + height * 0.5)
    spine_base.parent = root_bone
    
    spine_mid = edit_bones.new("Spine.001")
    spine_mid.head = spine_base.tail
    spine_mid.tail = (center_x, center_y, min_z + height * 0.7)
    spine_mid.parent = spine_base
    
    chest = edit_bones.new("Chest")
    chest.head = spine_mid.tail
    chest.tail = (center_x, center_y, min_z + height * 0.85)
    chest.parent = spine_mid
    
    # Add head/neck
    neck = edit_bones.new("Neck")
    neck.head = chest.tail
    neck.tail = (center_x, center_y, min_z + height * 0.92)
    neck.parent = chest
    
    head = edit_bones.new("Head")
    head.head = neck.tail
    head.tail = (center_x, center_y, max_z)
    head.parent = neck
    
    print(f"✅ Added basic armature with spine and head")
    print(f"\\n⚠️  IMPORTANT: This is a minimal rig!")
    print(f"   You need to manually add:")
    print(f"   - Arms (shoulders, elbows, wrists, hands)")
    print(f"   - Legs (hips, knees, ankles, feet)")
    print(f"   - Any other bones needed for your figure")
    
    bpy.ops.object.mode_set(mode='OBJECT')

# Save file
print(f"\\n💾 Saving to {output_file}...")
bpy.ops.wm.save_as_mainfile(filepath=output_file)
print(f"✅ Saved!")

print(f"\\n{'='*60}")
print(f"✅ SETUP COMPLETE!")
print(f"{'='*60}")
print(f"\\nNext steps:")
print(f"1. Open the file in Blender: {output_file}")
print(f"2. Select the armature")
print(f"3. Enter Edit Mode (Tab)")
print(f"4. Enable X-Ray mode (Alt+Z) to see through mesh")
print(f"5. Adjust/add bones to match your wire figure")
if use_rigify:
    print(f"6. Generate the rig (Armature Properties > Rigify > Generate)")
    print(f"7. Parent mesh to rig (Select mesh, then rig, Ctrl+P > Automatic Weights)")
else:
    print(f"6. Parent mesh to rig (Select mesh, then rig, Ctrl+P > Automatic Weights)")
print(f"7. Weight paint to fix any issues")
print(f"\\n")
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
        print("Usage: python setup_blender_rig.py <input_file> [use_rigify]")
        print("\nExamples:")
        print("  python setup_blender_rig.py textured_mesh_original.fbx")
        print("  python setup_blender_rig.py textured_mesh_original.fbx true  # Use Rigify")
        print("  python setup_blender_rig.py mixamo_ready.glb true")
        sys.exit(1)
    
    input_file = sys.argv[1]
    use_rigify = sys.argv[2] if len(sys.argv) > 2 else "true"
    
    if not Path(input_file).exists():
        print(f"❌ Input file not found: {input_file}")
        sys.exit(1)
    
    # Generate output filename
    input_path = Path(input_file)
    output_file = input_path.stem + "_rigged.blend"
    
    blender_path = find_blender()
    if not blender_path:
        print("❌ Blender not found!")
        sys.exit(1)
    
    print(f"✅ Found Blender: {blender_path}")
    
    script_file = Path("_temp_setup_rig.py")
    script_file.write_text(BLENDER_SCRIPT)
    
    try:
        cmd = [
            blender_path,
            "--background",
            "--python", str(script_file),
            "--",
            str(Path(input_file).absolute()),
            str(Path(output_file).absolute()),
            use_rigify
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.stdout:
            for line in result.stdout.split('\n'):
                if any(marker in line for marker in ['='*60, '🦴', '📂', '✅', '❌', '⚠️', '💾', '📦', '📏', 'IMPORTANT', 'Next steps', 'Height', 'Center', 'Imported', 'Added', 'Saved', 'Open', 'Select', 'Enter', 'Enable', 'Adjust', 'Generate', 'Parent', 'Weight']):
                    print(line)
        
        if result.returncode != 0:
            print(f"\n❌ Setup failed")
            sys.exit(1)
        
        if Path(output_file).exists():
            size_mb = Path(output_file).stat().st_size / (1024 * 1024)
            print(f"\n✅ Blender file created: {output_file} ({size_mb:.2f} MB)")
            print(f"\nTo open: blender {output_file}")
        
    finally:
        if script_file.exists():
            script_file.unlink()

if __name__ == "__main__":
    main()
