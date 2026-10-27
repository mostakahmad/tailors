import { buildMeasurements, mergeMeasurements } from './demoMeasurements.js';

const listeners = new Set();
const THEME_KEY = 'tailars-theme';
const LANG_KEY = 'tailars-lang';

export function emptyCapture() {
  return {
    kind: 'empty',
    objectUrl: null,
    src: '',
    width: 0,
    height: 0,
    mime: '',
    name: '',
    warnings: [],
  };
}

export const state = {
  lang: 'en',
  theme: 'light',
  step: 1,
  profile: {
    name: '',
    heightCm: 170,
    heightInput: 'cm',
    preset: 'regular',
    units: 'cm',
  },
  captures: {
    front: emptyCapture(),
    side: emptyCapture(),
  },
  pose: {
    engine: 'idle',
    engineCode: 'idle',
    overlay: true,
    front: null,
    side: null,
  },
  measurements: [],
  selectedKey: 'chest',
  filter: 'all',
  query: '',
  generatedAt: null,
  processing: false,
  processingError: false,
  diagramView: 'front',
  diagramMode: 'diagram',
};

let beforeReset = () => {};

export function setBeforeReset(fn) {
  beforeReset = fn;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of [...listeners]) fn(state);
}

export function loadPreferences() {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    const lang = localStorage.getItem(LANG_KEY);
    if (theme === 'light' || theme === 'dark') state.theme = theme;
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches) state.theme = 'dark';
    if (lang === 'en' || lang === 'bn') state.lang = lang;
  } catch {
    /* Preferences are optional. Photographs are never stored. */
  }
  applyTheme();
}

export function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.style.colorScheme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = state.theme === 'dark' ? '#0e1614' : '#10242a';
}

export function setTheme(theme) {
  state.theme = theme === 'dark' ? 'dark' : 'light';
  applyTheme();
  try { localStorage.setItem(THEME_KEY, state.theme); } catch { /* ignore */ }
  emit();
}

export function setLang(lang) {
  state.lang = lang === 'bn' ? 'bn' : 'en';
  try { localStorage.setItem(LANG_KEY, state.lang); } catch { /* ignore */ }
  emit();
}

export function captureSource(capture) {
  if (!capture || capture.kind === 'empty') return '';
  return capture.kind === 'sample' ? capture.src : capture.objectUrl;
}

export function replaceCapture(view, next) {
  const prev = state.captures[view];
  if (prev?.objectUrl && prev.objectUrl !== next.objectUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(prev.objectUrl);
  }
  state.captures[view] = next;
  state.pose[view] = null;
}

export function bothViewsReady() {
  return state.captures.front.kind !== 'empty' && state.captures.side.kind !== 'empty';
}

export function updateDerivedMeasurements() {
  if (!state.generatedAt) return;
  const next = buildMeasurements(state.profile.heightCm, state.profile.preset);
  state.measurements = mergeMeasurements(state.measurements, next);
}

let selectionOrigin = 'dashboard';

export function selectMeasurement(key, origin = 'dashboard') {
  state.selectedKey = key;
  selectionOrigin = origin;
  emit();
}

export function takeSelectionOrigin() {
  const origin = selectionOrigin;
  selectionOrigin = 'dashboard';
  return origin;
}

export function setMeasurementValue(key, valueCm) {
  const item = state.measurements.find((entry) => entry.key === key);
  if (!item || key === 'height') return;
  item.valueCm = valueCm;
  item.manuallyEdited = true;
  item.source = 'manual_entry';
  emit();
}

export function resetMeasurement(key) {
  const item = state.measurements.find((entry) => entry.key === key);
  if (!item || key === 'height') return;
  item.valueCm = item.illustrativeCm;
  item.manuallyEdited = false;
  item.source = 'illustrative_demo';
  emit();
}

export function resetSession() {
  beforeReset();
  for (const view of ['front', 'side']) {
    const cap = state.captures[view];
    if (cap?.objectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(cap.objectUrl);
    state.captures[view] = emptyCapture();
    state.pose[view] = null;
  }
  state.profile = { name: '', heightCm: 170, heightInput: 'cm', preset: 'regular', units: 'cm' };
  state.measurements = [];
  state.generatedAt = null;
  state.selectedKey = 'chest';
  state.filter = 'all';
  state.query = '';
  state.step = 1;
  state.diagramView = 'front';
  state.diagramMode = 'diagram';
  state.processing = false;
  state.processingError = false;
  state.pose.engine = 'idle';
  state.pose.engineCode = 'idle';
  state.pose.overlay = true;
  emit();
}
