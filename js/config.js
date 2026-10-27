/** Shared constants. Measurement numbers are illustrative demo baselines, not anthropometry. */

export const DISCLAIMER =
  'Concept Prototype — Measurements are illustrative and not suitable for tailoring.';

export const CUTTING_WARNING =
  'Do not use these values for garment cutting, sizing decisions, or medical purposes. Photographs are not tape measurements.';

export const MIN_HEIGHT_CM = 100;
export const MAX_HEIGHT_CM = 220;
export const REFERENCE_HEIGHT_CM = 170;
export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_EDGE = 8000;
export const MIN_IMAGE_EDGE = 64;
export const LOW_RES_EDGE = 480;

export const SAMPLE_SRC = {
  front: 'assets/front-outline.svg',
  side: 'assets/side-outline.svg',
};

export const MEDIAPIPE_MODULE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/+esm';
export const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
export const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const PRESETS = ['regular', 'slim', 'athletic', 'full'];

/** Girth offsets in centimetres at the 170 cm reference height. Lengths are not offset. */
export const PRESET_OFFSETS = {
  regular: {},
  slim: {
    shoulder: -2, chest: -8, waist: -10, hip: -7, neck: -2,
    bicep: -3, wrist: -1, thigh: -5, knee: -2, calf: -2, ankle: -1,
  },
  athletic: {
    shoulder: 3, chest: 10, waist: -3, hip: 3, neck: 2,
    bicep: 5, wrist: 1, thigh: 3, knee: 1, calf: 2,
  },
  full: {
    shoulder: 2, chest: 14, waist: 18, hip: 16, neck: 3,
    bicep: 7, wrist: 2, thigh: 9, knee: 4, calf: 4, ankle: 2,
  },
};

/** Illustrative baselines for a 170 cm demo figure. Not derived from a photograph. */
export const BASELINES = {
  height: 170,
  shoulder: 44,
  chest: 94,
  waist: 82,
  hip: 96,
  neck: 37,
  sleeve: 62,
  bicep: 30,
  wrist: 16.5,
  inseam: 78,
  thigh: 54,
  back: 42,
  torso: 66,
  upperArm: 34,
  leg: 100,
  knee: 38,
  calf: 36,
  ankle: 22,
};

export const MEASUREMENT_DEFS = [
  { key: 'height', group: 'overall', region: 'overall' },
  { key: 'shoulder', group: 'upper', region: 'shoulder' },
  { key: 'neck', group: 'upper', region: 'shoulder' },
  { key: 'chest', group: 'upper', region: 'chest' },
  { key: 'waist', group: 'torso', region: 'waist' },
  { key: 'hip', group: 'torso', region: 'hip' },
  { key: 'back', group: 'torso', region: 'torso' },
  { key: 'torso', group: 'torso', region: 'torso' },
  { key: 'sleeve', group: 'arms', region: 'arm' },
  { key: 'upperArm', group: 'arms', region: 'arm' },
  { key: 'bicep', group: 'arms', region: 'arm' },
  { key: 'wrist', group: 'arms', region: 'arm' },
  { key: 'inseam', group: 'lower', region: 'leg' },
  { key: 'leg', group: 'lower', region: 'leg' },
  { key: 'thigh', group: 'lower', region: 'leg' },
  { key: 'knee', group: 'lower', region: 'leg' },
  { key: 'calf', group: 'lower', region: 'leg' },
  { key: 'ankle', group: 'lower', region: 'leg' },
];

export const EDIT_RANGES = {
  shoulder: [28, 70],
  neck: [25, 55],
  chest: [60, 170],
  waist: [50, 170],
  hip: [60, 180],
  back: [30, 60],
  torso: [45, 90],
  sleeve: [45, 85],
  upperArm: [20, 50],
  bicep: [18, 55],
  wrist: [12, 28],
  inseam: [55, 100],
  leg: [70, 130],
  thigh: [35, 90],
  knee: [25, 60],
  calf: [22, 60],
  ankle: [15, 35],
};

/** Relative girth used only to shape the illustrative 3D mannequin. */
export const PRESET_SHAPES = {
  regular: { chest: 1, waist: 1, hip: 1, shoulder: 1, limb: 1 },
  slim: { chest: 0.86, waist: 0.78, hip: 0.9, shoulder: 0.94, limb: 0.9 },
  athletic: { chest: 1.16, waist: 0.9, hip: 1.05, shoulder: 1.14, limb: 1.1 },
  full: { chest: 1.2, waist: 1.26, hip: 1.22, shoulder: 1.06, limb: 1.12 },
};

export const KEY_TO_REGION = Object.fromEntries(MEASUREMENT_DEFS.map((d) => [d.key, d.region]));

export const REGION_PRIMARY_KEY = {
  overall: 'height',
  shoulder: 'shoulder',
  chest: 'chest',
  waist: 'waist',
  hip: 'hip',
  torso: 'torso',
  arm: 'sleeve',
  leg: 'inseam',
};

export const FILTERS = ['all', 'upper', 'torso', 'arms', 'lower'];

export const POSE_CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];

export const BODY_POINT_INDICES = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export const IMPORTANT_PARTS = [
  { id: 'shoulders', indices: [11, 12] },
  { id: 'elbows', indices: [13, 14] },
  { id: 'wrists', indices: [15, 16] },
  { id: 'hips', indices: [23, 24] },
  { id: 'knees', indices: [25, 26] },
  { id: 'ankles', indices: [27, 28] },
];

export const CALLOUT_KEYS = [
  { key: 'shoulder', region: 'shoulder' },
  { key: 'chest', region: 'chest' },
  { key: 'waist', region: 'waist' },
  { key: 'hip', region: 'hip' },
  { key: 'sleeve', region: 'arm' },
  { key: 'inseam', region: 'leg' },
];
