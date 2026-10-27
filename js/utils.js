import { EDIT_RANGES, MIN_HEIGHT_CM, MAX_HEIGHT_CM } from './config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function round1(n) {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

export function cmToInches(cm) {
  return cm / 2.54;
}

export function inchesToCm(inches) {
  return inches * 2.54;
}

export function feetInchesToCm(feet, inches) {
  return round1((Number(feet) * 12 + Number(inches)) * 2.54);
}

/**
 * Centimetres to store from the height form.
 * An untouched feet/inches display keeps `draftCm` (the exact value it was copied from),
 * so 170 cm shown as 5 ft 7 in does not commit as 170.2.
 */
export function resolveHeightCm({ storedCm, mode, cmValue, feet, inches, feetUntouched = false, draftCm = null }) {
  if (mode === 'ft') {
    const draft = draftCm == null || draftCm === '' ? NaN : Number(draftCm);
    const base = feetUntouched && Number.isFinite(draft) ? draft : (feetUntouched ? storedCm : null);
    if (base != null) {
      const shown = cmToFeetParts(base);
      if (Number(feet) === shown.feet && Number(inches) === shown.inches) return base;
    }
    const feetNum = Number(feet);
    const inchNum = Number(inches);
    if (Number.isFinite(feetNum) && Number.isFinite(inchNum) && inchNum >= 0 && inchNum < 12) {
      return feetInchesToCm(feetNum, inchNum);
    }
    return null;
  }
  const cm = Number(cmValue);
  return Number.isFinite(cm) ? round1(cm) : null;
}

export function cmToFeetParts(cm) {
  const total = cm / 2.54;
  let feet = Math.floor(total / 12);
  let inches = Math.round(total - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function formatMeasurement(cm, units) {
  if (!Number.isFinite(cm)) return '—';
  if (units === 'in') return `${cmToInches(cm).toFixed(1)} in`;
  return `${cm.toFixed(1)} cm`;
}

export function formatNumber(cm, units) {
  if (!Number.isFinite(cm)) return '';
  if (units === 'in') return cmToInches(cm).toFixed(1);
  return cm.toFixed(1);
}

export function parseMeasurement(raw, units, key) {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n)) return { ok: false, code: 'invalid' };
  const cm = units === 'in' ? round1(inchesToCm(n)) : round1(n);
  const range = EDIT_RANGES[key];
  if (!range || cm < range[0] || cm > range[1]) {
    return { ok: false, code: 'range', min: range?.[0] ?? null, max: range?.[1] ?? null };
  }
  return { ok: true, cm };
}

/** True when the parsed centimetres still display as the stored value in this unit. */
export function measurementDisplayUnchanged(parsedCm, units, valueCm) {
  return formatNumber(parsedCm, units) === formatNumber(valueCm, units);
}

/** Saving the value currently on screen. An unchanged display does not edit the row. */
export function applyDisplayedEdit(item, raw, units) {
  const parsed = parseMeasurement(raw, units, item?.key);
  if (!parsed.ok) return { ok: false, code: parsed.code, min: parsed.min ?? null, max: parsed.max ?? null };
  if (!item || item.key === 'height' || measurementDisplayUnchanged(parsed.cm, units, item.valueCm)) {
    return { ok: true, changed: false, item };
  }
  return {
    ok: true,
    changed: true,
    item: {
      ...item,
      valueCm: parsed.cm,
      manuallyEdited: true,
      source: 'manual_entry',
    },
  };
}

export function heightIsValid(cm) {
  return Number.isFinite(cm) && cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM;
}

export function sanitizeName(value) {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, 48);
}

export function displayName(name) {
  const clean = sanitizeName(name).trim();
  return clean || '';
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

export function wait(ms) {
  if (prefersReducedMotion() || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

export function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function toast(message, type = 'info') {
  const region = document.getElementById('toasts');
  if (!region) return;
  const text = String(message || '').replace(/blob:[^\s]+/gi, '').slice(0, 280);
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  item.textContent = text;
  region.append(item);
  while (region.children.length > 3) region.firstElementChild.remove();
  setTimeout(() => item.remove(), 4600);
}

let lastUnexpected = 0;
export function initGlobalErrors() {
  window.addEventListener('error', (event) => {
    console.error('Tailars UI error', event?.message || 'error');
    reportUnexpected();
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    console.error('Tailars UI rejection', reason?.name || reason?.message || 'error');
    reportUnexpected();
  });
}

function reportUnexpected() {
  const now = Date.now();
  if (now - lastUnexpected < 3000) return;
  lastUnexpected = now;
  const region = document.getElementById('toasts');
  if (!region) return;
  const item = document.createElement('div');
  item.className = 'toast toast-error';
  item.setAttribute('role', 'alert');
  item.textContent = document.documentElement.lang === 'bn'
    ? 'কিছু একটা আটকে গেছে। বাকি ডেমো চালু আছে — আবার চেষ্টা করুন।'
    : 'Something interrupted this step. The rest of the demo is still available.';
  region.append(item);
  setTimeout(() => item.remove(), 4600);
}

export function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}
