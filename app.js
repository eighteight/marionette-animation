// v3 — camera fix, no auto-play
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SkeletonHelper } from 'three';

// ─────────────────────────────────────────────
// MediaPipe landmark indices
// ─────────────────────────────────────────────
const MP = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
};

const POSE_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],
];

// ─────────────────────────────────────────────
// Three.js state
// ─────────────────────────────────────────────
let scene, camera, renderer, controls;
let model = null;
let skeletonHelper = null;
let mixer = null;
let clock = new THREE.Clock();
let frameCount = 0, lastFpsTime = 0;

// ─────────────────────────────────────────────
// Skeleton state
// ─────────────────────────────────────────────
let bones = {};
let restQuats = {};
let restWorldQuats = {};
let smoothedQuats = {};

// ─────────────────────────────────────────────
// Retargeting params (tunable from UI)
// ─────────────────────────────────────────────
let smoothFactor = 0.20;
let armScale     = 1.0;
let legScale     = 1.0;
let spineScale   = 1.0;
let playbackSpeed = 1.0;
let camOffsetX   = 0.0;   // camera pan left/right
let camOffsetY   = 0.0;   // camera pan up/down

// ─────────────────────────────────────────────
// Step 1 — Record state
// ─────────────────────────────────────────────
let poseDetector   = null;
let poseRunning    = false;
let poseActive     = false;   // driving character live
let animPlaying    = false;
let recording      = false;
let recordFrames   = [];
let recordStart    = 0;
let recFpsCount    = 0, recFpsLast = 0;
let livePoseLastTime = 0;

// ─────────────────────────────────────────────
// Step 2 — Analyze state
// ─────────────────────────────────────────────
let analyzeData    = null;
let analyzeFrame   = 0;
let analyzePlaying = false;
let analyzeLoop    = true;
let analyzeInterval = null;

// ─────────────────────────────────────────────
// Step 3 — Apply state
// ─────────────────────────────────────────────
let applyData      = null;   // recording loaded for playback
let applyFrame     = 0;
let applyInterval  = null;
let applySource    = 'none'; // 'none' | 'live' | 'recording'

// ─────────────────────────────────────────────
// Loading UI
// ─────────────────────────────────────────────
function setProgress(pct, msg) {
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('loading-msg').textContent = msg;
}
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
function setDot(id, state) {
  ['dot-model','dot-model2'].forEach(d => {
    if (id === 'model') document.getElementById(d)?.classList && (document.getElementById(d).className = 'dot ' + state);
  });
  const map = { model: ['dot-model','dot-model2'], camera: ['dot-camera','dot-cam2'], pose: ['dot-pose','dot-pose2'] };
  (map[id] || []).forEach(d => { const el = document.getElementById(d); if (el) el.className = 'dot ' + state; });
  const lbl = document.getElementById('lbl-' + id);
  if (lbl) lbl.textContent = id + (state === 'green' ? ' ✓' : '');
}

// ─────────────────────────────────────────────
// Three.js scene
// ─────────────────────────────────────────────
function initScene() {
  const canvas = document.getElementById('three-canvas');
  const vp = document.getElementById('viewport');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(vp.clientWidth, vp.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  scene.fog = new THREE.Fog(0x0a0a0a, 12, 28);

  camera = new THREE.PerspectiveCamera(50, vp.clientWidth / vp.clientHeight, 0.01, 100);
  camera.position.set(0, 1.0, 6.5);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // Store initial camera state so pan sliders offset from this baseline
  camera.userData.basePosition = camera.position.clone();
  camera.userData.baseTarget   = controls.target.clone();

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 4, 3); key.castShadow = true;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
  fill.position.set(-3, 2, -2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0, 3, -4); scene.add(rim);
  scene.add(new THREE.GridHelper(10, 20, 0x1e1e1e, 0x161616));

  window.addEventListener('resize', () => {
    camera.aspect = vp.clientWidth / vp.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(vp.clientWidth, vp.clientHeight);
  });
}

// ─────────────────────────────────────────────
// Load model
// ─────────────────────────────────────────────
async function loadModel() {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load('mesh2motion-model.glb', (gltf) => {
      model = gltf.scene;

      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const scale = 1.8 / size.y;
      model.scale.setScalar(scale);
      const center = box.getCenter(new THREE.Vector3());
      model.position.set(-center.x * scale, -box.min.y * scale - 0.38, -center.z * scale);
      scene.add(model);

      // Collect bones
      model.traverse((node) => {
        if (node.isSkinnedMesh && node.skeleton) {
          node.skeleton.bones.forEach((bone) => {
            if (!bones[bone.name]) bones[bone.name] = bone;
          });
        }
      });

      // Snapshot bind pose
      model.updateWorldMatrix(true, true);
      Object.keys(bones).forEach((name) => {
        const bone = bones[name];
        restQuats[name] = bone.quaternion.clone();
        smoothedQuats[name] = bone.quaternion.clone();
        const wq = new THREE.Quaternion();
        bone.getWorldQuaternion(wq);
        restWorldQuats[name] = wq;
      });

      skeletonHelper = new SkeletonHelper(model);
      skeletonHelper.visible = false;
      scene.add(skeletonHelper);

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        // Store the clip so the Play button can start it on demand
        mixer._clip0 = gltf.animations[0];
        animPlaying = false;
        document.getElementById('btn-anim').classList.remove('active');
        document.getElementById('btn-anim').textContent = '⟳ Play Baked Animation';
      }

      resolve();
    }, (xhr) => {
      setProgress(20 + Math.round((xhr.loaded / xhr.total) * 60), `Loading model… ${Math.round(xhr.loaded/1024)}KB`);
    }, reject);
  });
}

// ─────────────────────────────────────────────
// Render loop
// ─────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (mixer && animPlaying) mixer.update(delta);

  // Drive recording playback in the render loop so pose updates are
  // always in sync with rendering — no setInterval drift or double-steps.
  if (applySource === 'recording' && applyData) {
    applyRecordingTick(delta);
  }

  controls.update();
  renderer.render(scene, camera);

  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime > 1000) {
    document.getElementById('lbl-fps').textContent =
      Math.round(frameCount * 1000 / (now - lastFpsTime)) + ' fps';
    frameCount = 0; lastFpsTime = now;
  }
}

// Advance the recording playhead by delta seconds and apply the correct frame.
// Uses fractional time accumulation so playback speed matches the original
// capture rate regardless of display framerate.
let applyTimeAccum = 0;

function applyRecordingTick(delta) {
  if (!applyData || !applyData.frames.length) return;

  applyTimeAccum += delta * playbackSpeed;

  // Wrap around at end of recording
  const duration = applyData.duration;
  if (applyTimeAccum > duration) applyTimeAccum -= duration;

  // Find the two frames that bracket the current time and lerp between them
  const frames = applyData.frames;
  let nextIdx = frames.findIndex(f => f.t >= applyTimeAccum);
  if (nextIdx <= 0) nextIdx = 1;
  if (nextIdx >= frames.length) nextIdx = frames.length - 1;

  const prev = frames[nextIdx - 1];
  const next = frames[nextIdx];
  const span = next.t - prev.t;
  const alpha = span > 0 ? (applyTimeAccum - prev.t) / span : 0;

  // Blend landmark positions between the two frames before retargeting
  const blended = {};
  const allKeys = Object.keys(prev.lm);
  allKeys.forEach(k => {
    const a = prev.lm[k], b = next.lm[k];
    if (!a || !b) { blended[k] = a || b; return; }
    blended[k] = {
      x: a.x + (b.x - a.x) * alpha,
      y: a.y + (b.y - a.y) * alpha,
      z: a.z + (b.z - a.z) * alpha,
      v: a.v + (b.v - a.v) * alpha,
    };
  });

  applyLandmarkFrame(blended, delta);

  applyFrame = nextIdx;
  document.getElementById('apply-frame-lbl').textContent =
    `${nextIdx} / ${frames.length - 1}`;
}

// ─────────────────────────────────────────────
// Retargeting core
// ─────────────────────────────────────────────

// Convert MediaPipe landmark (x,y,z in [0,1] image space) to Three.js world vector
function mpToVec3(l) {
  return new THREE.Vector3(-(l.x - 0.5) * 2, -(l.y - 0.5) * 2, -l.z * 2);
}

// Derive the actual world-space pointing direction of a bone from its bind pose.
// Uses the bone→first-child vector in world space, which is the true rest direction
// regardless of which local axis the rig uses (+X, -X, +Y, etc.).
function getBoneRestDir(boneName) {
  const bone = bones[boneName];
  if (!bone) return new THREE.Vector3(0, 1, 0);
  if (bone.children.length > 0) {
    const bonePos  = new THREE.Vector3();
    const childPos = new THREE.Vector3();
    bone.getWorldPosition(bonePos);
    bone.children[0].getWorldPosition(childPos);
    const dir = childPos.sub(bonePos);
    if (dir.lengthSq() > 1e-8) return dir.normalize();
  }
  // Fallback: use +Y rotated by bind-pose world quaternion
  return new THREE.Vector3(0, 1, 0).applyQuaternion(restWorldQuats[boneName]).normalize();
}

// Set a bone's local quaternion so its bind-pose pointing axis aligns with targetWorldDir.
// Derives the actual rest direction from the bone hierarchy instead of assuming +Y,
// so it works correctly for rigs where arms point along X, legs along -Y, etc.
// slerpT is the pre-computed per-frame blend factor (time-based, not fixed).
function setBoneDirection(boneName, targetWorldDir, slerpT, scale = 1.0) {
  const bone = bones[boneName];
  if (!bone) return;

  const bindWorldQuat  = restWorldQuats[boneName];
  // FIX 1: use the real bone→child direction instead of hardcoded (0,1,0)
  const currentWorldDir = getBoneRestDir(boneName);
  const scaledDir = new THREE.Vector3().lerpVectors(
    currentWorldDir, targetWorldDir.clone().normalize(), scale
  ).normalize();

  const worldDelta  = new THREE.Quaternion().setFromUnitVectors(currentWorldDir, scaledDir);
  const desiredWorld = worldDelta.multiply(bindWorldQuat.clone());

  let localQuat = desiredWorld;
  if (bone.parent) {
    const parentWQ = new THREE.Quaternion();
    bone.parent.getWorldQuaternion(parentWQ);
    localQuat = parentWQ.clone().invert().multiply(desiredWorld);
  }

  smoothedQuats[boneName].slerp(localQuat, slerpT);
  bone.quaternion.copy(smoothedQuats[boneName]);
}

// Apply a local rotation offset on top of bind pose (for clavicles etc.)
function setBoneLocalOffset(boneName, axis, angle, slerpT) {
  const bone = bones[boneName];
  if (!bone) return;
  const target = restQuats[boneName].clone().multiply(
    new THREE.Quaternion().setFromAxisAngle(axis, angle)
  );
  smoothedQuats[boneName].slerp(target, slerpT);
  bone.quaternion.copy(smoothedQuats[boneName]);
}

// Main entry: apply a landmark map (index → {x,y,z,v}) to the skeleton.
// delta is the elapsed time in seconds since the last render frame, used to
// compute a framerate-independent exponential-decay smooth factor.
function applyLandmarkFrame(lms, delta = 1 / 60) {
  // Exponential decay: smoothFactor is the half-life in seconds (UI range 0–1
  // maps to "no smoothing" → "very smooth"). Convert to a per-frame blend weight.
  // slerpT = 1 means snap instantly; slerpT near 0 means very slow follow.
  const halfLife = smoothFactor * 0.3; // max ~0.3s half-life at slider = 1.0
  const slerpT = halfLife < 0.001
    ? 1.0
    : 1.0 - Math.exp(-delta / halfLife);

  function get(idx) {
    const l = lms[idx] ?? lms[String(idx)];
    return l ? mpToVec3(l) : null;
  }

  const lS = get(11), rS = get(12);
  const lE = get(13), rE = get(14);
  const lW = get(15), rW = get(16);
  const lH = get(23), rH = get(24);
  const lK = get(25), rK = get(26);
  const lA = get(27), rA = get(28);
  const nose = get(0);

  if (!lH || !rH || !lS || !rS) return;

  const hipCenter      = new THREE.Vector3().addVectors(lH, rH).multiplyScalar(0.5);
  const shoulderCenter = new THREE.Vector3().addVectors(lS, rS).multiplyScalar(0.5);

  // ── Pelvis ──
  const pelvisUp      = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
  const pelvisRight   = new THREE.Vector3().subVectors(rH, lH).normalize();
  const pelvisForward = new THREE.Vector3().crossVectors(pelvisRight, pelvisUp).normalize();
  const pelvisMat     = new THREE.Matrix4().makeBasis(pelvisRight, pelvisUp, pelvisForward);
  const pelvisWorldQ  = new THREE.Quaternion().setFromRotationMatrix(pelvisMat);
  const pelvisBone    = bones['pelvis'];
  if (pelvisBone) {
    let localQ = pelvisWorldQ;
    if (pelvisBone.parent) {
      const pWQ = new THREE.Quaternion();
      pelvisBone.parent.getWorldQuaternion(pWQ);
      localQ = pWQ.clone().invert().multiply(pelvisWorldQ);
    }
    smoothedQuats['pelvis'].slerp(localQ, slerpT);
    pelvisBone.quaternion.copy(smoothedQuats['pelvis']);
  }

  // ── Spine ──
  // FIX 3: drive spine by the DELTA between pelvis and torso orientation,
  // not the absolute torso world quaternion. When the pelvis bone already
  // carries the body's base orientation, applying the same absolute world
  // quaternion to child spine bones cancels it out and snaps them to rest.
  // The delta captures only the lean/twist of the torso over the hips.
  const torsoUp      = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
  const torsoRight   = new THREE.Vector3()
    .addVectors(new THREE.Vector3().subVectors(rH, lH), new THREE.Vector3().subVectors(rS, lS))
    .normalize();
  const torsoForward = new THREE.Vector3().crossVectors(torsoRight, torsoUp).normalize();
  const torsoMat     = new THREE.Matrix4().makeBasis(torsoRight, torsoUp, torsoForward);
  const torsoWorldQ  = new THREE.Quaternion().setFromRotationMatrix(torsoMat);

  // Delta = how much the torso rotates relative to the pelvis
  const spineDeltaQ = pelvisWorldQ.clone().invert().multiply(torsoWorldQ);

  ['spine_01', 'spine_02', 'spine_03'].forEach((name) => {
    const bone = bones[name];
    if (!bone) return;
    // Apply a fraction of the delta on top of the bone's rest local quaternion
    const target = restQuats[name].clone().multiply(
      new THREE.Quaternion().slerp(spineDeltaQ, 0.33 * spineScale)
    );
    smoothedQuats[name].slerp(target, slerpT);
    bone.quaternion.copy(smoothedQuats[name]);
  });

  // ── Head ──
  if (nose) {
    const headDir = new THREE.Vector3().subVectors(nose, shoulderCenter).normalize();
    setBoneDirection('neck_01', headDir, slerpT);
    setBoneDirection('head', headDir, slerpT);
  }

  // ── Arms ──
  if (lE && lW) {
    setBoneDirection('upperarm_l', new THREE.Vector3().subVectors(lE, lS).normalize(), slerpT, armScale);
    setBoneDirection('lowerarm_l', new THREE.Vector3().subVectors(lW, lE).normalize(), slerpT, armScale);
    setBoneLocalOffset('clavicle_l', new THREE.Vector3(0,0,1), THREE.MathUtils.clamp(lS.y * 0.4, -0.4, 0.4), slerpT);
  }
  if (rE && rW) {
    setBoneDirection('upperarm_r', new THREE.Vector3().subVectors(rE, rS).normalize(), slerpT, armScale);
    setBoneDirection('lowerarm_r', new THREE.Vector3().subVectors(rW, rE).normalize(), slerpT, armScale);
    setBoneLocalOffset('clavicle_r', new THREE.Vector3(0,0,1), THREE.MathUtils.clamp(-rS.y * 0.4, -0.4, 0.4), slerpT);
  }

  // ── Legs ──
  if (lK && lA) {
    setBoneDirection('thigh_l', new THREE.Vector3().subVectors(lK, lH).normalize(), slerpT, legScale);
    setBoneDirection('calf_l',  new THREE.Vector3().subVectors(lA, lK).normalize(), slerpT, legScale);
  }
  if (rK && rA) {
    setBoneDirection('thigh_r', new THREE.Vector3().subVectors(rK, rH).normalize(), slerpT, legScale);
    setBoneDirection('calf_r',  new THREE.Vector3().subVectors(rA, rK).normalize(), slerpT, legScale);
  }
}

function resetPose() {
  Object.keys(bones).forEach((name) => {
    if (restQuats[name]) {
      bones[name].quaternion.copy(restQuats[name]);
      smoothedQuats[name].copy(restQuats[name]);
    }
  });
}

// ─────────────────────────────────────────────
// Step 1 — Camera & MediaPipe
// ─────────────────────────────────────────────

async function startCamera() {
  const video = document.getElementById('webcam');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' }, audio: false
    });
    video.srcObject = stream;
    await new Promise(r => video.onloadedmetadata = r);
    setDot('camera', 'green');
    document.getElementById('btn-camera').classList.add('active');
    document.getElementById('btn-camera').textContent = '■ Camera On';
    document.getElementById('btn-pose').disabled = false;
    return true;
  } catch(e) {
    setDot('camera', 'red');
    alert('Camera error: ' + e.message);
    return false;
  }
}

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function initPose() {
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js');
  poseDetector = new window.Pose({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${f}`
  });
  poseDetector.setOptions({
    modelComplexity: 1, smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
  });
  poseDetector.onResults(onPoseResults);
  await poseDetector.initialize();
}

async function runPoseLoop() {
  if (!poseRunning) return;
  const video = document.getElementById('webcam');
  if (video.readyState >= 2) await poseDetector.send({ image: video });
  requestAnimationFrame(runPoseLoop);
}

function onPoseResults(results) {
  drawPoseOverlay(results);

  // FPS counter
  recFpsCount++;
  const now = performance.now();
  if (now - recFpsLast > 1000) {
    document.getElementById('rec-fps').textContent =
      Math.round(recFpsCount * 1000 / (now - recFpsLast)) + ' fps';
    recFpsCount = 0; recFpsLast = now;
  }

  if (!results.poseLandmarks) {
    setDot('pose', 'yellow');
    document.getElementById('rec-conf').textContent = 'no detection';
    return;
  }

  setDot('pose', 'green');
  const lms = results.poseLandmarks;

  // Confidence
  const keyIdx = [11,12,23,24,13,14,25,26];
  const avgVis = keyIdx.reduce((s,i) => s + (lms[i]?.visibility || 0), 0) / keyIdx.length;
  document.getElementById('rec-conf').textContent = (avgVis * 100).toFixed(0) + '%';

  // Recording
  if (recording) {
    const lmMap = {};
    lms.forEach((l, i) => {
      lmMap[i] = { x: parseFloat(l.x.toFixed(4)), y: parseFloat(l.y.toFixed(4)),
                   z: parseFloat(l.z.toFixed(4)), v: parseFloat((l.visibility||0).toFixed(3)) };
    });
    recordFrames.push({ t: parseFloat(((now - recordStart) / 1000).toFixed(3)), lm: lmMap });
    const elapsed = (now - recordStart) / 1000;
    document.getElementById('rec-frames').textContent = recordFrames.length;
    document.getElementById('rec-duration').textContent = elapsed.toFixed(1) + 's';
  }

  // Live drive
  if (poseActive && bones['pelvis']) {
    const lmMap = {};
    lms.forEach((l, i) => { lmMap[i] = { x: l.x, y: l.y, z: l.z, v: l.visibility || 0 }; });
    const liveDelta = livePoseLastTime > 0 ? (now - livePoseLastTime) / 1000 : 1 / 30;
    livePoseLastTime = now;
    applyLandmarkFrame(lmMap, liveDelta);
  }
}

function drawPoseOverlay(results) {
  const canvas = document.getElementById('pose-canvas');
  if (!canvas) return;
  // Size canvas to match its display size
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width  = rect.width  || 272;
  canvas.height = rect.height || 204;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!results.poseLandmarks) return;

  const lms = results.poseLandmarks;
  const W = canvas.width, H = canvas.height;

  ctx.strokeStyle = 'rgba(74,138,74,0.85)';
  ctx.lineWidth = 1.5;
  POSE_CONNECTIONS.forEach(([a,b]) => {
    if (!lms[a] || !lms[b]) return;
    ctx.beginPath();
    ctx.moveTo(lms[a].x * W, lms[a].y * H);
    ctx.lineTo(lms[b].x * W, lms[b].y * H);
    ctx.stroke();
  });

  Object.values(MP).forEach(idx => {
    const l = lms[idx];
    if (!l) return;
    ctx.beginPath();
    ctx.arc(l.x * W, l.y * H, 3, 0, Math.PI * 2);
    ctx.fillStyle = l.visibility > 0.6 ? '#7dff7d' : '#555';
    ctx.fill();
  });
}

// ─────────────────────────────────────────────
// Step 2 — Analyzer
// ─────────────────────────────────────────────

const JOINT_LABELS = {
  11:'L.shoulder', 12:'R.shoulder', 13:'L.elbow', 14:'R.elbow',
  15:'L.wrist',    16:'R.wrist',    23:'L.hip',   24:'R.hip',
  25:'L.knee',     26:'R.knee',     27:'L.ankle', 28:'R.ankle',
};
const KEY_JOINTS = [11,12,13,14,15,16,23,24,25,26,27,28];

const STICK_CONNECTIONS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],
];

function loadAnalyzeFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      analyzeData = JSON.parse(e.target.result);
      onAnalyzeLoaded();
    } catch(err) { alert('Invalid JSON: ' + err.message); }
  };
  reader.readAsText(file);
}

function onAnalyzeLoaded() {
  const d = analyzeData;

  // Show hidden elements
  ['analyzer-container','timeline-wrap','playback-controls',
   'analyze-stats','analyze-issues','analyze-joints','btn-send-to-apply-wrap']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = ''; });

  // Stats
  document.getElementById('an-frames').textContent   = d.frameCount;
  document.getElementById('an-duration').textContent = d.duration.toFixed(2) + 's';
  document.getElementById('an-fps').textContent      = d.avgFps.toFixed(1);
  document.getElementById('an-date').textContent     = new Date(d.capturedAt).toLocaleString();

  // Joint analysis
  const tbody = document.getElementById('joint-tbody');
  tbody.innerHTML = '';
  const issues = [];

  KEY_JOINTS.forEach(idx => {
    const label = JOINT_LABELS[idx] || idx;
    const vis = d.frames.map(f => f.lm[idx]?.v ?? 0);
    const avg = vis.reduce((a,b) => a+b, 0) / vis.length;
    const min = Math.min(...vis);
    const okPct = (vis.filter(v => v > 0.5).length / vis.length * 100).toFixed(0);
    const bw = Math.round(avg * 60);
    const cls = avg < 0.5 ? 'low' : '';
    tbody.insertAdjacentHTML('beforeend',
      `<tr><td>${label}</td>
       <td><span class="bar ${cls}" style="width:${bw}px"></span> ${(avg*100).toFixed(0)}%</td>
       <td>${(min*100).toFixed(0)}%</td>
       <td>${okPct}%</td></tr>`);
    if (avg < 0.4) issues.push(`<div class="issue err">⚠ ${label}: low visibility (${(avg*100).toFixed(0)}%)</div>`);
    else if (avg < 0.65) issues.push(`<div class="issue warn">△ ${label}: moderate (${(avg*100).toFixed(0)}%)</div>`);
  });

  // Frame timing
  if (d.frames.length > 2) {
    const dts = d.frames.slice(1).map((f,i) => f.t - d.frames[i].t);
    const avgDt = dts.reduce((a,b)=>a+b,0)/dts.length;
    const maxDt = Math.max(...dts);
    if (maxDt > avgDt * 3)
      issues.push(`<div class="issue warn">△ Max frame gap ${(maxDt*1000).toFixed(0)}ms (avg ${(avgDt*1000).toFixed(0)}ms)</div>`);
    else
      issues.push(`<div class="issue ok">✓ Frame timing OK (avg ${(avgDt*1000).toFixed(0)}ms)</div>`);
  }

  if (!issues.find(s => s.includes('err') || s.includes('warn')))
    issues.push('<div class="issue ok">✓ Recording looks good</div>');

  document.getElementById('issues-list').innerHTML = issues.join('');

  // Draw first frame
  analyzeFrame = 0;
  drawStickFrame(analyzeFrame);
  drawTimeline();
  updateAnalyzeFrameLabel();

  // Tab badge
  document.querySelector('[data-step="2"]').classList.add('done');
}

function drawStickFrame(fi) {
  const canvas = document.getElementById('stick-canvas');
  if (!canvas || !analyzeData) return;
  const container = document.getElementById('analyzer-container');
  const W = container.clientWidth  || 272;
  const H = container.clientHeight || 204;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const frame = analyzeData.frames[fi];
  if (!frame) return;
  const lms = frame.lm;
  const PAD = 20;

  function px(l) {
    return { x: (1 - l.x) * (W - PAD*2) + PAD, y: l.y * (H - PAD*2) + PAD };
  }

  STICK_CONNECTIONS.forEach(([a,b]) => {
    const la = lms[a] ?? lms[String(a)];
    const lb = lms[b] ?? lms[String(b)];
    if (!la || !lb) return;
    const vis = Math.min(la.v, lb.v);
    ctx.strokeStyle = `rgba(74,138,74,${vis * 0.8 + 0.1})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pa = px(la), pb = px(lb);
    ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  });

  Object.keys(lms).forEach(i => {
    const l = lms[i];
    const p = px(l);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fillStyle = l.v > 0.7 ? '#7dff7d' : l.v > 0.4 ? '#8a8a2a' : '#444';
    ctx.fill();
  });

  ctx.fillStyle = '#2a2a2a';
  ctx.font = '9px Courier New';
  ctx.fillText(`t=${frame.t.toFixed(3)}s  frame ${fi}/${analyzeData.frames.length-1}`, 6, H - 6);
}

function drawTimeline() {
  const canvas = document.getElementById('timeline-canvas');
  if (!canvas || !analyzeData) return;
  const wrap = document.getElementById('timeline-wrap');
  canvas.width  = wrap.clientWidth  || 272;
  canvas.height = wrap.clientHeight || 40;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const rowH = H / KEY_JOINTS.length;
  analyzeData.frames.forEach((frame, fi) => {
    const x = (fi / analyzeData.frames.length) * W;
    const w = Math.max(1, W / analyzeData.frames.length);
    KEY_JOINTS.forEach((jIdx, row) => {
      const vis = frame.lm[jIdx]?.v ?? frame.lm[String(jIdx)]?.v ?? 0;
      const g = Math.round(vis * 180);
      ctx.fillStyle = `rgb(${Math.round(g*0.3)},${g},${Math.round(g*0.3)})`;
      ctx.fillRect(x, row * rowH, w, rowH - 0.5);
    });
  });

  // Playhead
  const px = (analyzeFrame / analyzeData.frames.length) * W;
  ctx.strokeStyle = '#cc3333'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, H); ctx.stroke();
}

function updateAnalyzeFrameLabel() {
  if (!analyzeData) return;
  const f = analyzeData.frames[analyzeFrame];
  document.getElementById('frame-label').textContent =
    `frame ${analyzeFrame} / ${analyzeData.frames.length - 1}  (t=${f?.t.toFixed(3)}s)`;
}

// ─────────────────────────────────────────────
// Step 3 — Apply
// ─────────────────────────────────────────────

function loadApplyFile(file, fromAnalyzer = false) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      applyData = JSON.parse(e.target.result);
      const name = fromAnalyzer ? '(from analyzer)' : file.name;
      document.getElementById('apply-rec-name').textContent   = name;
      document.getElementById('apply-rec-frames').textContent = applyData.frameCount;
      document.getElementById('apply-rec-dur').textContent    = applyData.duration.toFixed(2) + 's';
      document.getElementById('apply-rec-info').style.display = '';
      document.getElementById('btn-apply-recording').disabled = false;
      document.querySelector('[data-step="3"]').classList.add('done');
    } catch(err) { alert('Invalid JSON: ' + err.message); }
  };
  if (fromAnalyzer) {
    // analyzeData already parsed
    applyData = analyzeData;
    document.getElementById('apply-rec-name').textContent   = '(from analyzer)';
    document.getElementById('apply-rec-frames').textContent = applyData.frameCount;
    document.getElementById('apply-rec-dur').textContent    = applyData.duration.toFixed(2) + 's';
    document.getElementById('apply-rec-info').style.display = '';
    document.getElementById('btn-apply-recording').disabled = false;
    document.querySelector('[data-step="3"]').classList.add('done');
  } else {
    reader.readAsText(file);
  }
}

function setApplySource(source) {
  // Stop whatever is running
  if (applyInterval) { clearInterval(applyInterval); applyInterval = null; }
  if (poseActive)    { poseActive = false; }
  if (animPlaying)   {
    // Pause rather than stop so the action can be resumed cleanly
    if (mixer) mixer._actions?.forEach(a => { a.paused = true; });
    animPlaying = false;
  }

  applySource = source;
  document.getElementById('apply-source-lbl').textContent = source;
  document.getElementById('apply-badge').style.display = source !== 'none' ? '' : 'none';

  document.getElementById('btn-apply-live').classList.toggle('active', source === 'live');
  document.getElementById('btn-apply-recording').classList.toggle('active', source === 'recording');
  document.getElementById('btn-anim').classList.remove('active');

  if (source === 'live') {
    document.getElementById('apply-badge').textContent = '● LIVE';
    poseActive = true;
    if (!poseRunning) {
      poseRunning = true;
      runPoseLoop();
    }
  } else if (source === 'recording' && applyData) {
    document.getElementById('apply-badge').textContent = '▶ RECORDING';
    applyFrame = 0;
    applyTimeAccum = 0;  // reset playhead — render loop drives playback now
  } else if (source === 'none') {
    resetPose();
    document.getElementById('apply-frame-lbl').textContent = '—';
  }
}

// ─────────────────────────────────────────────
// Tab switching
// ─────────────────────────────────────────────
function switchTab(step) {
  document.querySelectorAll('.step-tab').forEach(t => t.classList.toggle('active', t.dataset.step == step));
  document.querySelectorAll('.step-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + step));
}

// ─────────────────────────────────────────────
// Wire all UI
// ─────────────────────────────────────────────
function wireUI() {

  // ── Tabs ──
  document.querySelectorAll('.step-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.step));
  });

  // ══ STEP 1 ══

  document.getElementById('btn-camera').addEventListener('click', startCamera);

  document.getElementById('btn-pose').addEventListener('click', async () => {
    const btn = document.getElementById('btn-pose');
    if (!poseDetector) {
      btn.textContent = '⏳ Loading MediaPipe…';
      btn.disabled = true;
      try { await initPose(); } catch(e) { btn.textContent = '✗ Failed'; return; }
      btn.disabled = false;
    }
    poseActive = !poseActive;
    poseRunning = poseActive;
    if (poseActive) {
      if (animPlaying) {
        if (mixer) mixer._actions?.forEach(a => { a.paused = true; });
        animPlaying = false;
        document.getElementById('btn-anim').classList.remove('active');
      }
      btn.classList.add('active');
      btn.textContent = '■ Stop Pose Tracking';
      setDot('pose', 'yellow');
      runPoseLoop();
      document.getElementById('btn-record').disabled = false;
    } else {
      btn.classList.remove('active');
      btn.textContent = '◉ Enable Pose Tracking';
      setDot('pose', 'red');
      resetPose();
      document.getElementById('btn-record').disabled = true;
      if (recording) {
        recording = false;
        document.getElementById('rec-dot').classList.remove('recording');
        document.getElementById('btn-record').classList.remove('rec-active');
        document.getElementById('btn-record').textContent = '⏺ Start Recording';
        document.getElementById('btn-save-rec').disabled = recordFrames.length === 0;
      }
    }
    // Also enable live button in step 3
    document.getElementById('btn-apply-live').disabled = !poseActive;
  });

  document.getElementById('btn-record').addEventListener('click', () => {
    if (!recording) {
      recordFrames = [];
      recordStart = performance.now();
      recording = true;
      document.getElementById('rec-dot').classList.add('recording');
      document.getElementById('btn-record').classList.add('rec-active');
      document.getElementById('btn-record').textContent = '⏹ Stop Recording';
      document.getElementById('btn-save-rec').disabled = true;
    } else {
      recording = false;
      document.getElementById('rec-dot').classList.remove('recording');
      document.getElementById('btn-record').classList.remove('rec-active');
      document.getElementById('btn-record').textContent = '⏺ Start Recording';
      document.getElementById('btn-save-rec').disabled = recordFrames.length === 0;
    }
  });

  document.getElementById('btn-save-rec').addEventListener('click', () => {
    if (!recordFrames.length) return;
    const dur = recordFrames[recordFrames.length-1].t;
    const blob = new Blob([JSON.stringify({
      version: 1,
      capturedAt: new Date().toISOString(),
      frameCount: recordFrames.length,
      duration: parseFloat(dur.toFixed(3)),
      avgFps: parseFloat((recordFrames.length / dur).toFixed(1)),
      landmarkNames: { 0:'nose',11:'left_shoulder',12:'right_shoulder',13:'left_elbow',
        14:'right_elbow',15:'left_wrist',16:'right_wrist',23:'left_hip',24:'right_hip',
        25:'left_knee',26:'right_knee',27:'left_ankle',28:'right_ankle' },
      frames: recordFrames
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `skeleton_${new Date().toISOString().slice(0,19).replace(/[:.]/g,'-')}.json`;
    a.click();
  });

  document.getElementById('btn-anim').addEventListener('click', () => {
    if (!mixer) return;
    const btn = document.getElementById('btn-anim');
    if (animPlaying) {
      mixer.stopAllAction();
      animPlaying = false;
      btn.classList.remove('active');
      btn.textContent = '⟳ Play Baked Animation';
    } else {
      if (poseActive) { poseActive = false; poseRunning = false; resetPose(); }
      setApplySource('none');
      mixer.clipAction(mixer._clip0).reset().play();
      animPlaying = true;
      btn.classList.add('active');
      btn.textContent = '⏸ Pause Baked Animation';
    }
  });

  document.getElementById('btn-reset-pose').addEventListener('click', resetPose);

  document.getElementById('btn-skeleton').addEventListener('click', () => {
    if (skeletonHelper) {
      skeletonHelper.visible = !skeletonHelper.visible;
      document.getElementById('btn-skeleton').classList.toggle('active', skeletonHelper.visible);
    }
  });

  document.getElementById('btn-wireframe').addEventListener('click', () => {
    const btn = document.getElementById('btn-wireframe');
    const on = btn.classList.toggle('active');
    model?.traverse(n => {
      if (n.isMesh && n.material) {
        (Array.isArray(n.material) ? n.material : [n.material]).forEach(m => m.wireframe = on);
      }
    });
  });

  document.getElementById('smooth-slider').addEventListener('input', e => {
    smoothFactor = parseFloat(e.target.value);
    document.getElementById('smooth-val').textContent = smoothFactor.toFixed(2);
    // Sync apply panel slider
    document.getElementById('apply-smooth-slider').value = smoothFactor;
    document.getElementById('apply-smooth-val').textContent = smoothFactor.toFixed(2);
  });

  document.getElementById('scale-slider').addEventListener('input', e => {
    const s = parseFloat(e.target.value);
    document.getElementById('scale-val').textContent = s.toFixed(1);
    if (model) model.scale.setScalar((1.8 / (new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y / model.scale.y)) * s);
  });

  // ══ STEP 2 ══

  document.getElementById('btn-load-analyze').addEventListener('click', () =>
    document.getElementById('analyze-file-input').click());

  document.getElementById('analyze-file-input').addEventListener('change', e => {
    if (e.target.files[0]) loadAnalyzeFile(e.target.files[0]);
  });

  document.getElementById('btn-analyze-play').addEventListener('click', () => {
    if (!analyzeData) return;
    const btn = document.getElementById('btn-analyze-play');
    if (analyzePlaying) {
      clearInterval(analyzeInterval); analyzePlaying = false;
      btn.textContent = '▶ Play'; btn.classList.remove('active');
    } else {
      analyzePlaying = true;
      btn.textContent = '⏸ Pause'; btn.classList.add('active');
      const fps = analyzeData.avgFps || 30;
      analyzeInterval = setInterval(() => {
        analyzeFrame++;
        if (analyzeFrame >= analyzeData.frames.length) {
          if (analyzeLoop) analyzeFrame = 0;
          else { clearInterval(analyzeInterval); analyzePlaying = false; return; }
        }
        drawStickFrame(analyzeFrame);
        drawTimeline();
        updateAnalyzeFrameLabel();
      }, 1000 / fps);
    }
  });

  document.getElementById('btn-analyze-loop').addEventListener('click', () => {
    analyzeLoop = !analyzeLoop;
    document.getElementById('btn-analyze-loop').classList.toggle('active', analyzeLoop);
  });

  document.getElementById('timeline-wrap').addEventListener('click', e => {
    if (!analyzeData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    analyzeFrame = Math.floor(((e.clientX - rect.left) / rect.width) * analyzeData.frames.length);
    analyzeFrame = Math.max(0, Math.min(analyzeFrame, analyzeData.frames.length - 1));
    drawStickFrame(analyzeFrame); drawTimeline(); updateAnalyzeFrameLabel();
  });

  document.getElementById('btn-send-to-apply').addEventListener('click', () => {
    if (!analyzeData) return;
    loadApplyFile(null, true);
    switchTab(3);
  });

  // ══ STEP 3 ══

  document.getElementById('btn-load-apply').addEventListener('click', () =>
    document.getElementById('apply-file-input').click());

  document.getElementById('apply-file-input').addEventListener('change', e => {
    if (e.target.files[0]) loadApplyFile(e.target.files[0]);
  });

  document.getElementById('btn-apply-live').addEventListener('click', () => {
    if (applySource === 'live') setApplySource('none');
    else setApplySource('live');
  });

  document.getElementById('btn-apply-recording').addEventListener('click', () => {
    if (applySource === 'recording') setApplySource('none');
    else setApplySource('recording');
  });

  document.getElementById('btn-apply-reset').addEventListener('click', () => {
    setApplySource('none'); resetPose();
  });

  document.getElementById('apply-smooth-slider').addEventListener('input', e => {
    smoothFactor = parseFloat(e.target.value);
    document.getElementById('apply-smooth-val').textContent = smoothFactor.toFixed(2);
    document.getElementById('smooth-slider').value = smoothFactor;
    document.getElementById('smooth-val').textContent = smoothFactor.toFixed(2);
  });

  document.getElementById('arm-scale-slider').addEventListener('input', e => {
    armScale = parseFloat(e.target.value);
    document.getElementById('arm-scale-val').textContent = armScale.toFixed(1);
  });

  document.getElementById('leg-scale-slider').addEventListener('input', e => {
    legScale = parseFloat(e.target.value);
    document.getElementById('leg-scale-val').textContent = legScale.toFixed(1);
  });

  document.getElementById('spine-scale-slider').addEventListener('input', e => {
    spineScale = parseFloat(e.target.value);
    document.getElementById('spine-scale-val').textContent = spineScale.toFixed(1);
  });

  document.getElementById('playback-speed-slider').addEventListener('input', e => {
    playbackSpeed = parseFloat(e.target.value);
    document.getElementById('playback-speed-val').textContent = playbackSpeed.toFixed(2) + '×';
  });

  document.getElementById('apply-scale-slider').addEventListener('input', e => {
    const s = parseFloat(e.target.value);
    document.getElementById('apply-scale-val').textContent = s.toFixed(1);
    if (model) model.scale.setScalar((1.8 / (new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y / model.scale.y)) * s);
  });

  // Camera pan — shared between step 1 and step 3 sliders
  function applyCamPan() {
    const base = camera.userData.basePosition;
    const tgt  = camera.userData.baseTarget;
    if (!base || !tgt) return;
    camera.position.set(base.x + camOffsetX, base.y + camOffsetY, base.z);
    controls.target.set(tgt.x  + camOffsetX, tgt.y  + camOffsetY, tgt.z);
    controls.update();
  }

  function syncCamSliders(x, y) {
    ['cam-x-val','apply-cam-x-val'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = x.toFixed(2); });
    ['cam-y-val','apply-cam-y-val'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = y.toFixed(2); });
    ['cam-x-slider','apply-cam-x-slider'].forEach(id => { const el = document.getElementById(id); if (el) el.value = x; });
    ['cam-y-slider','apply-cam-y-slider'].forEach(id => { const el = document.getElementById(id); if (el) el.value = y; });
  }

  ['cam-x-slider','apply-cam-x-slider'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', e => {
      camOffsetX = parseFloat(e.target.value);
      syncCamSliders(camOffsetX, camOffsetY);
      applyCamPan();
    });
  });

  ['cam-y-slider','apply-cam-y-slider'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', e => {
      camOffsetY = parseFloat(e.target.value);
      syncCamSliders(camOffsetX, camOffsetY);
      applyCamPan();
    });
  });
}

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
async function boot() {
  setProgress(10, 'Setting up scene…');
  initScene();
  setProgress(20, 'Loading model…');
  try {
    await loadModel();
  } catch(e) {
    document.getElementById('loading-msg').textContent = 'Failed to load model: ' + e.message;
    return;
  }
  setDot('model', 'green');
  setProgress(100, 'Ready');
  wireUI();
  animate();
  setTimeout(hideLoading, 400);
}

boot();
