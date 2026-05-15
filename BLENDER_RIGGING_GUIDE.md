# Complete Blender Rigging Workflow for Scanned Meshes

This guide walks you through rigging your Luma AI scanned figure in Blender for animation.

## Prerequisites

- **Blender 3.0+** (Download from [blender.org](https://www.blender.org))
- Your `textured_mesh_glb.glb` file
- 2-4 hours for first-time rigging (gets faster with practice)

---

## Phase 1: Import and Assessment (15 minutes)

### Step 1: Import the GLB

1. Open Blender (start with General template)
2. Delete default objects (Select all with `A`, delete with `X`)
3. **File → Import → glTF 2.0 (.glb/.gltf)**
4. Select your `textured_mesh_glb.glb`
5. Import settings:
   - ✅ Remember to import with textures
   - ✅ Shade smooth

### Step 2: Initial Assessment

1. Select the mesh (click on it)
2. Press `Tab` to enter Edit Mode
3. Check statistics in top-right corner (enable via overlays if hidden)
   - Note: Vertices, Faces, Triangles count
4. Press `Tab` to return to Object Mode

**Decision Point:**
- **< 50k vertices**: Proceed to Phase 2 (light retopology)
- **> 50k vertices**: Proceed to Phase 3 (full retopology)

---

## Phase 2: Light Cleanup (30 minutes)

*For meshes that are already reasonably low-poly*

### Step 1: Clean the Mesh

1. Select mesh, enter Edit Mode (`Tab`)
2. Select all (`A`)
3. **Mesh → Clean Up → Merge by Distance** (threshold: 0.0001)
4. **Mesh → Normals → Recalculate Outside**
5. Check for non-manifold geometry:
   - Deselect all (`Alt+A`)
   - **Select → Select All by Trait → Non-Manifold**
   - Fix any issues (usually delete or fill)

### Step 2: Add Edge Loops at Joints

Critical for good deformation:

1. Press `Ctrl+R` to add edge loops
2. Add loops around:
   - Shoulders (2-3 loops)
   - Elbows (3-4 loops)
   - Wrists (2-3 loops)
   - Hips (2-3 loops)
   - Knees (3-4 loops)
   - Ankles (2-3 loops)
   - Neck (2-3 loops)

3. Return to Object Mode (`Tab`)

---

## Phase 3: Full Retopology (2-3 hours)

*For high-poly scanned meshes*

### Method A: Manual Retopology (Most Control)

1. **Duplicate your mesh** (`Shift+D`, then `Esc` to keep in place)
2. Rename original to "Reference" (right-click → Rename)
3. Hide the reference mesh (click eye icon in outliner)
4. Add a new mesh: **Add → Mesh → Plane**
5. Enter Edit Mode on the plane
6. Enable **Snap to Face** (magnet icon in top bar)
7. Start retopologizing:
   - Use `E` to extrude edges
   - Use `Ctrl+R` to add edge loops
   - Follow the muscle flow and joint areas
   - Keep quads (4-sided faces) wherever possible
   - Target: 10k-30k vertices for full body

**Key Areas to Focus:**
- Face: Follow facial muscles
- Hands: Ensure fingers can bend
- Joints: Circular edge loops
- Torso: Follow muscle groups

### Method B: Quad Remesher Addon (Faster, Paid)

1. Install Quad Remesher addon (paid, ~$60)
2. Select mesh
3. **Quad Remesher → Remesh**
4. Adjust target polygon count
5. Manually fix problem areas

### Method C: Blender's Remesh Modifier (Quick & Free)

1. Select mesh
2. Add Modifier → **Remesh**
3. Mode: **Voxel**
4. Voxel Size: Start with 0.01, adjust for detail
5. Apply modifier
6. Clean up with **Decimate** modifier if still too dense
7. **Important**: Manually add edge loops at joints afterward

---

## Phase 4: Rigging with Rigify (45 minutes)

Rigify is Blender's powerful auto-rigging system.

### Step 1: Enable Rigify

1. **Edit → Preferences → Add-ons**
2. Search for "Rigify"
3. Enable the checkbox
4. Close preferences

### Step 2: Add Metarig

1. Ensure mesh is in Object Mode
2. **Add → Armature → Basic → Basic Human (Metarig)**
3. The metarig appears (small skeleton)

### Step 3: Align Metarig to Your Mesh

1. Select the armature
2. Press `Tab` to enter Edit Mode
3. Switch to X-Ray mode (`Alt+Z`) to see through mesh
4. Select bones and move them (`G` key) to match your mesh:
   - **Front view** (`Numpad 1`): Align height and width
   - **Side view** (`Numpad 3`): Align depth
   - **Important bones to align:**
     - Spine bones to torso
     - Leg bones to legs (hip, knee, ankle, toes)
     - Arm bones to arms (shoulder, elbow, wrist)
     - Head bone to head
     - Fingers to fingers (if your mesh has detailed hands)

**Tips:**
- Use `G` then `X`/`Y`/`Z` to constrain movement to one axis
- Use `S` to scale bones if needed
- Take your time - good alignment = good rig

### Step 4: Generate the Rig

1. Return to Object Mode (`Tab`)
2. Select the metarig
3. In Properties panel (right side) → **Armature Properties** (skeleton icon)
4. Find **Rigify** section
5. Click **Generate Rig**
6. Wait for generation (10-30 seconds)
7. A new armature appears with full control rig!

---

## Phase 5: Skinning (Weight Painting) (1-2 hours)

### Step 1: Automatic Weights

1. Select your mesh (click on it)
2. Hold `Shift` and select the generated rig (not metarig)
3. Press `Ctrl+P` → **With Automatic Weights**
4. Blender calculates initial weights

**If you get errors:**
- Mesh might have issues (non-manifold geometry)
- Try: Select mesh → Edit Mode → **Mesh → Clean Up → Merge by Distance**
- Try again

### Step 2: Test the Rig

1. Select the rig
2. Enter **Pose Mode** (Ctrl+Tab or dropdown at top-left)
3. Select bones and move them (`G`), rotate (`R`)
4. Test major joints:
   - Bend arms at elbows
   - Bend legs at knees
   - Rotate shoulders
   - Bend spine

**Look for problems:**
- Mesh tearing apart
- Weird deformations
- Parts not moving

### Step 3: Weight Painting (Fix Problems)

1. Select the mesh
2. Enter **Weight Paint Mode** (dropdown at top-left)
3. Select the rig, enter Pose Mode
4. Select a bone that's causing problems
5. Return to mesh in Weight Paint mode
6. You'll see colored overlay:
   - **Red** = fully influenced by bone
   - **Blue** = not influenced
   - **Green/Yellow** = partial influence

**Painting:**
- Use `F` to change brush size
- Left-click and drag to paint
- Adjust weight in top-left (0.0 to 1.0)
- Use **Subtract** mode to remove influence
- Use **Blur** to smooth transitions

**Common fixes:**
- Elbows: Paint elbow area red for forearm bone
- Knees: Paint knee area red for shin bone
- Shoulders: Smooth transition between chest and arm
- Hips: Smooth transition between torso and legs

### Step 4: Mirror Weights (Save Time!)

If your mesh is symmetrical:
1. Select mesh in Weight Paint mode
2. **Weights → Mirror** (in top menu)
3. Choose X-axis
4. Paint one side, mirror to other

---

## Phase 6: Final Touches (30 minutes)

### Step 1: Add Constraints (Optional)

Prevent unrealistic poses:
1. Select rig, Pose Mode
2. Select a bone (e.g., elbow)
3. **Bone Constraints** panel (chain icon on right)
4. Add **Limit Rotation** constraint
5. Set realistic limits (e.g., elbow: 0° to 150°)

### Step 2: Create Shape Keys (Optional)

For facial expressions or corrective shapes:
1. Select mesh, Object Mode
2. **Object Data Properties** (green triangle icon)
3. **Shape Keys** section
4. Add basis shape key
5. Add new shape keys for expressions
6. Edit in Edit Mode, adjust vertices

### Step 3: Test Animation

1. Select rig, Pose Mode
2. Move to frame 1 (bottom timeline)
3. Pose the character
4. Press `I` → **Location & Rotation** (insert keyframe)
5. Move to frame 30
6. Create different pose
7. Press `I` again
8. Press spacebar to play animation!

---

## Phase 7: Export (10 minutes)

### For Game Engines (Unity, Unreal, Godot)

1. Select both mesh and rig
2. **File → Export → FBX (.fbx)**
3. Settings:
   - ✅ Selected Objects
   - ✅ Armature
   - ✅ Mesh
   - ✅ Apply Transform
   - Bake Animation: ✅ (if you have animations)
4. Export

### For Web (Three.js, Babylon.js)

1. Select both mesh and rig
2. **File → Export → glTF 2.0 (.glb/.gltf)**
3. Settings:
   - Format: **GLB** (binary, smaller)
   - ✅ Remember to export selected objects
   - ✅ Include animations
   - ✅ Compression (if available)
4. Export

### For Blender Archive

1. **File → Save As**
2. Save as `.blend` file
3. Keep your working file!

---

## Troubleshooting

### Mesh Explodes When Moving Bones
- **Cause**: Bad automatic weights
- **Fix**: Weight paint the problem areas

### Bones Don't Move Mesh
- **Cause**: Mesh not parented to armature
- **Fix**: Select mesh, then rig, `Ctrl+P` → With Automatic Weights

### Mesh Deforms Weirdly at Joints
- **Cause**: Not enough edge loops or bad weights
- **Fix**: Add edge loops in Edit Mode, then re-weight paint

### Rigify Generate Fails
- **Cause**: Metarig bones in wrong positions
- **Fix**: Check that no bones have zero length, all bones are properly aligned

### Export Doesn't Include Rig
- **Cause**: Didn't select armature before export
- **Fix**: Select both mesh and armature (Shift+click)

---

## Keyboard Shortcuts Reference

| Action | Shortcut |
|--------|----------|
| Edit Mode | `Tab` |
| Pose Mode | `Ctrl+Tab` (on armature) |
| Move | `G` |
| Rotate | `R` |
| Scale | `S` |
| Select All | `A` |
| Deselect All | `Alt+A` |
| X-Ray Mode | `Alt+Z` |
| Insert Keyframe | `I` |
| Parent | `Ctrl+P` |
| Add Edge Loop | `Ctrl+R` |
| Extrude | `E` |

---

## Next Steps

1. **Practice posing** your character in Pose Mode
2. **Create walk cycle** animation (search "Blender walk cycle tutorial")
3. **Export to your target platform** (game engine, web, etc.)
4. **Learn advanced rigging**: IK/FK switching, custom bone shapes, drivers

---

## Additional Resources

- **Blender Manual**: https://docs.blender.org/manual/en/latest/
- **Rigify Documentation**: https://docs.blender.org/manual/en/latest/addons/rigging/rigify/
- **YouTube**: Search "Blender character rigging tutorial"
- **Blender Artists Forum**: https://blenderartists.org/

---

Good luck with your rigging! Remember: rigging is a skill that improves with practice. Your first rig might take 4+ hours, but you'll get faster.
