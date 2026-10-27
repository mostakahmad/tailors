import {
  BODY_POINT_INDICES,
  IMPORTANT_PARTS,
  LOW_RES_EDGE,
  MEDIAPIPE_MODULE,
  MEDIAPIPE_WASM,
  POSE_CONNECTIONS,
  POSE_MODEL_URL,
} from './config.js';
import { state, emit } from './state.js';

const VISIBLE = 0.5;

export function isVisible(landmark) {
  if (!landmark) return false;
  const visibility = landmark.visibility ?? landmark.presence ?? 1;
  return visibility >= VISIBLE;
}

function isPerson(landmarks) {
  if (!landmarks) return false;
  const ids = [11, 12, 23, 24];
  const scores = ids
    .map((id) => landmarks[id])
    .filter(Boolean)
    .map((landmark) => landmark.visibility ?? landmark.presence ?? 0);
  if (scores.length < 2) return false;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return average >= 0.35;
}

function slim(list) {
  return list.map((landmark) => ({
    x: Number(landmark?.x) || 0,
    y: Number(landmark?.y) || 0,
    visibility: Number(landmark?.visibility ?? landmark?.presence ?? 0),
  }));
}

function missingParts(landmarks, view) {
  const missing = [];
  for (const part of IMPORTANT_PARTS) {
    const visibleCount = part.indices.filter((index) => isVisible(landmarks[index])).length;
    const needed = view === 'side' ? 1 : part.indices.length;
    if (visibleCount < needed) missing.push(part.id);
  }
  return missing;
}

function incompleteFraming(landmarks, view) {
  const points = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    .map((index) => landmarks[index])
    .filter(isVisible);
  if (points.length < 4) return true;
  const ys = points.map((point) => point.y);
  const span = Math.max(...ys) - Math.min(...ys);
  const nearEdge = points.some((point) => point.x < 0.02 || point.x > 0.98 || point.y < 0.02 || point.y > 0.98);
  const minSpan = view === 'side' ? 0.45 : 0.55;
  return nearEdge || span < minSpan;
}

/**
 * Turn raw pose-landmarker output into honest, view-aware feedback.
 * Does not estimate tape measurements.
 */
export function assessPose({ landmarksList, view, width, height }) {
  const warnings = [];
  if (width && height && (width < LOW_RES_EDGE || height < LOW_RES_EDGE)) {
    warnings.push({ code: 'low_resolution' });
  }
  const people = Array.isArray(landmarksList) ? landmarksList.filter(isPerson) : [];
  if (!people.length) {
    warnings.push({ code: 'no_pose' });
    return { status: 'none', warnings, peopleCount: 0, landmarks: null, missing: IMPORTANT_PARTS.map((part) => part.id) };
  }
  if (people.length > 1) warnings.push({ code: 'multiple_people' });
  const landmarks = slim(people[0]);
  const missing = missingParts(landmarks, view);
  if (missing.length) warnings.push({ code: 'missing_landmarks', parts: missing });
  if (incompleteFraming(landmarks, view)) warnings.push({ code: 'incomplete_framing' });
  return { status: 'detected', warnings, peopleCount: people.length, landmarks, missing };
}

export function drawLandmarks(canvas, landmarks) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;
  const point = (landmark) => [landmark.x * width, landmark.y * height];
  const visible = (landmark) => landmark && (landmark.visibility ?? 0) >= 0.3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [start, end] of POSE_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!visible(a) || !visible(b)) continue;
    const [x1, y1] = point(a);
    const [x2, y2] = point(b);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(4, width / 140);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#0b6b5c';
    ctx.lineWidth = Math.max(2, width / 220);
    ctx.stroke();
  }
  for (const index of BODY_POINT_INDICES) {
    const landmark = landmarks[index];
    if (!visible(landmark)) continue;
    const [x, y] = point(landmark);
    const radius = Math.max(4, width / 180);
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#0b6b5c';
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

let landmarker = null;
let pending = null;

function modelOptions(delegate) {
  return {
    baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
    runningMode: 'IMAGE',
    numPoses: 2,
  };
}

async function loadLandmarker() {
  state.pose.engine = 'loading';
  state.pose.engineCode = 'loading';
  emit();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    state.pose.engine = 'unavailable';
    state.pose.engineCode = 'offline';
    emit();
    throw new Error('offline');
  }
  try {
    const vision = await import(MEDIAPIPE_MODULE);
    const fileset = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
    try {
      landmarker = await vision.PoseLandmarker.createFromOptions(fileset, modelOptions('GPU'));
    } catch {
      landmarker = await vision.PoseLandmarker.createFromOptions(fileset, modelOptions('CPU'));
    }
    state.pose.engine = 'ready';
    state.pose.engineCode = 'ready';
    emit();
    return landmarker;
  } catch (error) {
    landmarker = null;
    state.pose.engine = 'unavailable';
    state.pose.engineCode = error?.message === 'offline' ? 'offline' : 'failed';
    emit();
    throw error;
  }
}

export function ensureLandmarker() {
  if (landmarker) return Promise.resolve(landmarker);
  if (!pending) {
    pending = loadLandmarker().finally(() => {
      if (!landmarker) pending = null;
    });
  }
  return pending;
}

export function closePose() {
  try { landmarker?.close?.(); } catch { /* already closed */ }
  landmarker = null;
  pending = null;
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = src;
  });
}

export async function detectView(view) {
  const capture = state.captures[view];
  if (capture.kind !== 'photo' || !capture.objectUrl) {
    state.pose[view] = null;
    return null;
  }
  const detector = await ensureLandmarker();
  const image = await loadHtmlImage(capture.objectUrl);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const result = detector.detect(canvas);
  const assessment = assessPose({
    landmarksList: result?.landmarks || [],
    view,
    width: image.naturalWidth,
    height: image.naturalHeight,
  });
  state.pose[view] = assessment;
  return assessment;
}
