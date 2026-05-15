"""
Blender Auto-Rigging Script
Run this script inside Blender to automatically rig a humanoid mesh.

Usage:
1. Open Blender
2. Import your GLB file
3. Select the mesh
4. Open Scripting workspace
5. Load this script
6. Modify the MESH_NAME variable if needed
7. Run script (Alt+P or click Run Script button)

Requirements:
- Blender 3.0+
- Rigify addon enabled
- Humanoid mesh selected
"""

import bpy
import mathutils

# ============================================================================
# CONFIGURATION
# ============================================================================

# Name of your imported mesh (change if different)
MESH_NAME = "textured_mesh_glb"  # Adjust this to match your mesh name

# Rigging options
AUTO_ALIGN_METARIG = True  # Try to auto-align metarig to mesh bounds
GENERATE_RIG = True  # Generate the final rig
AUTO_WEIGHT = True  # Automatically parent mesh with weights

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def enable_rigify():
    """Enable Rigify addon if not already enabled."""
    addon_name = "rigify"
    if addon_name not in bpy.context.preferences.addons:
        try:
            bpy.ops.preferences.addon_enable(module=addon_name)
            print(f"✅ Enabled {addon_name} addon")
        except:
            print(f"❌ Failed to enable {addon_name}. Enable it manually in Preferences.")
            return False
    return True


def get_mesh_bounds(obj):
    """Get the bounding box dimensions of a mesh."""
    if obj.type != 'MESH':
        return None
    
    # Get world space bounding box
    bbox_corners = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    
    min_x = min(v.x for v in bbox_corners)
    max_x = max(v.x for v in bbox_corners)
    min_y = min(v.y for v in bbox_corners)
    max_y = max(v.y for v in bbox_corners)
    min_z = min(v.z for v in bbox_corners)
    max_z = max(v.z for v in bbox_corners)
    
    return {
        'min': mathutils.Vector((min_x, min_y, min_z)),
        'max': mathutils.Vector((max_x, max_y, max_z)),
        'center': mathutils.Vector(((min_x + max_x) / 2, (min_y + max_y) / 2, (min_z + max_z) / 2)),
        'height': max_z - min_z,
        'width': max_x - min_x,
        'depth': max_y - min_y
    }


def add_metarig():
    """Add a basic human metarig."""
    # Deselect all
    bpy.ops.object.select_all(action='DESELECT')
    
    # Add metarig
    try:
        bpy.ops.object.armature_human_metarig_add()
        metarig = bpy.context.active_object
        print(f"✅ Added metarig: {metarig.name}")
        return metarig
    except AttributeError:
        print("❌ Rigify not properly enabled. Enable it in Preferences → Add-ons → Rigify")
        return None


def align_metarig_to_mesh(metarig, mesh):
    """Align metarig to mesh bounds (basic alignment)."""
    bounds = get_mesh_bounds(mesh)
    if not bounds:
        print("❌ Could not get mesh bounds")
        return False
    
    print(f"📏 Mesh bounds: Height={bounds['height']:.2f}, Width={bounds['width']:.2f}, Depth={bounds['depth']:.2f}")
    
    # Move metarig to mesh center
    metarig.location = bounds['center']
    
    # Scale metarig to roughly match mesh height
    # Assuming standard metarig height is about 2.0 units
    scale_factor = bounds['height'] / 2.0
    metarig.scale = (scale_factor, scale_factor, scale_factor)
    
    # Apply scale
    bpy.context.view_layer.objects.active = metarig
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    
    print(f"✅ Aligned metarig to mesh (scale factor: {scale_factor:.2f})")
    print("⚠️  Manual adjustment recommended for best results!")
    
    return True


def generate_rigify_rig(metarig):
    """Generate the final rig from metarig."""
    # Select metarig
    bpy.ops.object.select_all(action='DESELECT')
    metarig.select_set(True)
    bpy.context.view_layer.objects.active = metarig
    
    # Generate rig
    try:
        bpy.ops.pose.rigify_generate()
        print("✅ Generated Rigify rig")
        
        # The generated rig is now the active object
        rig = bpy.context.active_object
        return rig
    except Exception as e:
        print(f"❌ Failed to generate rig: {e}")
        return None


def parent_mesh_to_rig(mesh, rig):
    """Parent mesh to rig with automatic weights."""
    # Select mesh first, then rig
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    
    # Parent with automatic weights
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        print("✅ Parented mesh to rig with automatic weights")
        return True
    except Exception as e:
        print(f"❌ Failed to parent mesh: {e}")
        print("   Try manually: Select mesh, then rig, Ctrl+P → With Automatic Weights")
        return False


# ============================================================================
# MAIN SCRIPT
# ============================================================================

def main():
    print("\n" + "=" * 60)
    print("🦴 BLENDER AUTO-RIGGING SCRIPT")
    print("=" * 60)
    
    # Step 1: Enable Rigify
    print("\n📦 Step 1: Enabling Rigify addon...")
    if not enable_rigify():
        return
    
    # Step 2: Find the mesh
    print(f"\n🔍 Step 2: Looking for mesh '{MESH_NAME}'...")
    mesh = bpy.data.objects.get(MESH_NAME)
    
    if not mesh:
        print(f"❌ Mesh '{MESH_NAME}' not found!")
        print("   Available objects:")
        for obj in bpy.data.objects:
            print(f"     - {obj.name} (type: {obj.type})")
        print("\n   Please update MESH_NAME variable in the script.")
        return
    
    if mesh.type != 'MESH':
        print(f"❌ Object '{MESH_NAME}' is not a mesh (type: {mesh.type})")
        return
    
    print(f"✅ Found mesh: {mesh.name}")
    print(f"   Vertices: {len(mesh.data.vertices):,}")
    print(f"   Faces: {len(mesh.data.polygons):,}")
    
    # Step 3: Add metarig
    print("\n🦴 Step 3: Adding metarig...")
    metarig = add_metarig()
    if not metarig:
        return
    
    # Step 4: Align metarig
    if AUTO_ALIGN_METARIG:
        print("\n📐 Step 4: Aligning metarig to mesh...")
        align_metarig_to_mesh(metarig, mesh)
        print("\n⚠️  IMPORTANT: Check the alignment!")
        print("   1. Select the metarig")
        print("   2. Press Tab to enter Edit Mode")
        print("   3. Press Alt+Z for X-Ray mode")
        print("   4. Adjust bone positions to match your mesh")
        print("   5. When done, run this script again with GENERATE_RIG=True")
        
        if not GENERATE_RIG:
            print("\n⏸️  Paused for manual adjustment.")
            print("   Set GENERATE_RIG=True and run again when ready.")
            return
    
    # Step 5: Generate rig
    if GENERATE_RIG:
        print("\n⚙️  Step 5: Generating Rigify rig...")
        rig = generate_rigify_rig(metarig)
        if not rig:
            return
        
        # Step 6: Parent mesh to rig
        if AUTO_WEIGHT:
            print("\n🎨 Step 6: Parenting mesh with automatic weights...")
            parent_mesh_to_rig(mesh, rig)
    
    print("\n" + "=" * 60)
    print("✅ AUTO-RIGGING COMPLETE!")
    print("=" * 60)
    print("\n📋 Next steps:")
    print("   1. Select the rig and enter Pose Mode (Ctrl+Tab)")
    print("   2. Test the rig by moving bones")
    print("   3. Fix any weight painting issues in Weight Paint mode")
    print("   4. Add animations!")
    print("\n💡 Tips:")
    print("   - Use Ctrl+Tab to switch between Object/Pose mode on rig")
    print("   - Select mesh → Weight Paint mode to fix deformations")
    print("   - Press I in Pose Mode to insert keyframes for animation")
    print()


# Run the script
if __name__ == "__main__":
    main()
