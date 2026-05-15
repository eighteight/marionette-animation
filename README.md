# Marionette

Browser-based motion capture retargeting tool. Record body pose with your webcam via MediaPipe, review the recording, and apply it to a 3D character in real time.

![Marionette screenshot](https://github.com/eighteight/marionette-animation/raw/main/screenshot.png)

## Features

- **Record** — Capture full-body pose at up to 120fps using MediaPipe Pose in the browser. No installation required.
- **Analyze** — Review recordings as an animated stick figure with per-joint visibility heatmap and frame timing diagnostics.
- **Apply** — Retarget recorded motion onto a skinned 3D character (GLB) with real-time bone direction solving.
- **Playback controls** — Variable speed (0.05×–2×), frame interpolation, and exponential-decay smoothing that is framerate-independent.
- **Camera pan** — Up/down and left/right pan sliders to reframe the character without losing zoom level.

## How it works

MediaPipe outputs 33 body landmarks in normalized image space. Each frame, the retargeter:

1. Converts landmarks to Three.js world space (`mpToVec3`)
2. Builds a pelvis orientation matrix from hip and shoulder positions
3. Drives each limb bone by computing the direction vector between parent and child joints, then rotating the bone's actual rest axis (derived from the bind-pose bone→child world vector) to align with that direction
4. Drives spine bones by the *delta* between pelvis and torso orientation, so the spine responds to lean without fighting the pelvis rotation
5. Applies framerate-independent slerp smoothing using exponential decay: `slerpT = 1 - exp(-delta / halfLife)`

Playback uses `requestAnimationFrame` with fractional time accumulation and per-frame landmark interpolation, eliminating the `setInterval` drift that caused jerkiness.

## Running locally

Requires a local HTTP server (the GLB loads via fetch, so `file://` won't work).

```bash
# Python 3
python3 -m http.server 8081
```

Then open **http://localhost:8081** in Chrome or Firefox.

## Usage

### 1 — Record
1. Click **Start Camera** and allow webcam access
2. Click **Enable Pose Tracking** — the stick figure overlay confirms detection
3. Click **Start Recording**, perform your motion, click **Stop Recording**
4. Click **Save Recording** to download a `.json` file

### 2 — Analyze
Load a recording JSON to inspect per-joint visibility, frame timing, and scrub through the stick figure playback. Click **→ Send to Apply** when satisfied.

### 3 — Apply
Load a recording (or send from Analyze), then click **▶ Play Recording**. Use the sliders to tune:

| Slider | Effect |
|---|---|
| Speed | Playback rate (0.05× slow motion → 2× fast) |
| Smoothing | Exponential decay half-life for bone slerp |
| Arm / Leg / Spine scale | Blend factor for each body region |
| Pan up/down, left/right | Reframe camera without changing zoom |

## Project structure

```
index.html          — Main app (Record / Analyze / Apply tabs)
app.js              — Three.js scene, MediaPipe integration, retargeting core
recorder.html       — Standalone recorder (no 3D view)
analyzer.html       — Standalone recording analyzer
mesh2motion-model.glb  — Skinned character model
skeleton_example.json  — Example recording for testing
```

## Blender / rigging files

The repo also contains the original Luma AI scan and Blender rigging tools used to prepare the character:

- `textured_mesh_glb.glb` — Original scan
- `textured_mesh_original_rigged.blend` — Blender file with Rigify metarig
- `BLENDER_RIGGING_GUIDE.md` — Step-by-step rigging tutorial
- `RIGGING_OPTIONS.md` — Overview of rigging approaches
- `blender_auto_rig.py`, `setup_blender_rig.py`, `analyze_mesh.py` — Blender scripts
