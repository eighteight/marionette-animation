# 🦴 Rigging Options for Your Wire Figure

Wire figures from Luma AI scans present specific challenges:
- Non-standard topology
- Thin geometry
- Non-watertight mesh (holes)
- Unusual proportions

Here are the viable options, ranked by effort vs. control.

---

## Option 1: Manual Rigging in Blender with Rigify ⭐ RECOMMENDED

**Effort:** Medium (2-4 hours first time)
**Control:** High
**Quality:** Best
**Cost:** Free

A Blender file with your mesh and a pre-scaled Rigify metarig is already set up:

```bash
blender textured_mesh_original_rigged.blend
```

### Steps:

1. **Adjust the metarig:**
   - Select the armature
   - `Tab` → Edit Mode
   - `Alt+Z` → X-Ray mode (see through mesh)
   - Move bones to match your wire figure joints

2. **Generate the rig:**
   - `Tab` → Object Mode
   - Armature Properties panel → Rigify → **Generate Rig**

3. **Parent mesh to rig:**
   - Select mesh, then `Shift`+select rig
   - `Ctrl+P` → **With Automatic Weights**

4. **Test and refine:**
   - Select rig → `Ctrl+Tab` → Pose Mode
   - Move bones to test deformation
   - Fix issues in Weight Paint mode

See `BLENDER_RIGGING_GUIDE.md` for the full detailed walkthrough.

**Pros:** Full control, handles unusual geometry, free, professional result
**Cons:** Learning curve, time investment, manual bone placement required

---

## Option 2: Basic Manual Rig (No Rigify)

**Effort:** Low-Medium (1-2 hours)
**Control:** Medium
**Quality:** Good for simple animations
**Cost:** Free

```bash
python3 setup_blender_rig.py textured_mesh_original.fbx false
```

Creates a minimal spine/head rig. You manually add arms and legs.

**Pros:** Simpler than Rigify, faster setup, good for basic animations
**Cons:** No IK/FK switching, less sophisticated controls

---

## Option 3: Commercial Auto-Rigging Tools

**Effort:** Low
**Control:** Medium
**Quality:** Good
**Cost:** $$$

### AccuRIG (Reallusion)
- **Cost:** Free standalone tool
- **Website:** https://www.reallusion.com/character-creator/accurig/
- Better at handling unusual meshes than Mixamo
- Exports to FBX/OBJ

### Cascadeur
- **Cost:** Free (indie) / $25/month (pro)
- **Website:** https://cascadeur.com/
- AI-assisted rigging and animation
- Good for unusual characters

**Pros:** Faster than manual, professional results
**Cons:** May still struggle with wire figure geometry

---

## Option 4: Hire a Rigger

**Effort:** None (for you)
**Control:** Depends on communication
**Quality:** Professional
**Cost:** $$$

Platforms:
- **Fiverr** — $50-200 for basic rig
- **Upwork** — $200-500 for professional rig
- **ArtStation** — Find professional riggers

---

## Option 5: Procedural / Physics-Based Animation

**Effort:** Medium
**Control:** Different approach
**Quality:** Depends on use case
**Cost:** Free

Instead of rigging, use Blender's simulation tools:
- Soft body simulation
- Cloth simulation
- Wire/curve deformers
- Geometry nodes

Good for abstract or artistic animation where precise pose control isn't needed.

---

## Recommendation

For a wire figure, **Option 1 (Manual Rigify)** is the most reliable path. Auto-riggers fail on unusual geometry — manual rigging is the only method guaranteed to work.

The Blender file is ready:
```bash
blender textured_mesh_original_rigged.blend
```

---

## Files Available

- `textured_mesh_original_rigged.blend` — Ready-to-rig Blender file
- `textured_mesh_original.fbx` — Full quality FBX
- `textured_mesh_glb.glb` — Original scan
- `BLENDER_RIGGING_GUIDE.md` — Detailed rigging tutorial
- `setup_blender_rig.py` — Regenerate the Blender rig file if needed
