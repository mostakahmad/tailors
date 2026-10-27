import { CALLOUT_KEYS, calloutValueKey, selectionHighlights } from './config.js';
import { t } from './i18n.js';
import { captureSource, selectMeasurement, state, subscribe } from './state.js';
import { $, formatMeasurement } from './utils.js';
import { drawLandmarks } from './poseDetection.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const FRONT_GUIDES = [
  { key: 'shoulder', y: 132, x1: 92, x2: 228 },
  { key: 'chest', y: 188, x1: 108, x2: 212 },
  { key: 'waist', y: 248, x1: 116, x2: 204 },
  { key: 'hip', y: 308, x1: 104, x2: 216 },
];

const SIDE_GUIDES = [
  { key: 'chest', y: 188, x1: 118, x2: 196 },
  { key: 'waist', y: 248, x1: 126, x2: 188 },
  { key: 'hip', y: 308, x1: 112, x2: 198 },
];

function svgEl(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export function buildFigureSvg(view) {
  const svg = svgEl('svg', { viewBox: '0 0 320 560', class: 'figure-svg', role: 'img' });
  const title = svgEl('title', {});
  title.textContent = view === 'front' ? 'Front illustration' : 'Side illustration';
  svg.append(title);
  const body = svgEl('g', { class: 'figure-body' });
  if (view === 'front') {
    body.append(svgEl('ellipse', { cx: '160', cy: '52', rx: '26', ry: '32' }));
    body.append(svgEl('rect', { x: '148', y: '78', width: '24', height: '28', rx: '10' }));
    body.append(svgEl('rect', { x: '112', y: '102', width: '96', height: '196', rx: '46' }));
    body.append(svgEl('rect', { x: '78', y: '112', width: '34', height: '148', rx: '17', transform: 'rotate(10 95 112)' }));
    body.append(svgEl('rect', { x: '208', y: '112', width: '34', height: '148', rx: '17', transform: 'rotate(-10 225 112)' }));
    body.append(svgEl('rect', { x: '118', y: '268', width: '36', height: '220', rx: '18' }));
    body.append(svgEl('rect', { x: '166', y: '268', width: '36', height: '220', rx: '18' }));
  } else {
    body.append(svgEl('ellipse', { cx: '150', cy: '52', rx: '24', ry: '32' }));
    body.append(svgEl('rect', { x: '140', y: '78', width: '22', height: '26', rx: '8' }));
    body.append(svgEl('ellipse', { cx: '156', cy: '210', rx: '46', ry: '108' }));
    body.append(svgEl('rect', { x: '132', y: '280', width: '34', height: '210', rx: '16' }));
    body.append(svgEl('rect', { x: '108', y: '130', width: '28', height: '120', rx: '14', transform: 'rotate(18 122 130)' }));
  }
  svg.append(body);
  const guides = view === 'front' ? FRONT_GUIDES : SIDE_GUIDES;
  if (view === 'front') {
    const arm = svgEl('path', { d: 'M108 140 C78 180 70 230 64 268', class: 'guide', 'data-key': 'sleeve' });
    const leg = svgEl('path', { d: 'M150 320 C146 400 140 470 136 520', class: 'guide', 'data-key': 'inseam' });
    svg.append(arm, leg);
  } else {
    svg.append(svgEl('path', { d: 'M146 150 V300', class: 'guide', 'data-key': 'back' }));
    svg.append(svgEl('path', { d: 'M150 320 C154 410 156 470 150 520', class: 'guide', 'data-key': 'inseam' }));
    svg.append(svgEl('path', { d: 'M168 132 H214', class: 'guide', 'data-key': 'shoulder' }));
  }
  for (const guide of guides) {
    svg.append(svgEl('path', {
      d: `M${guide.x1} ${guide.y} H${guide.x2}`,
      class: 'guide',
      'data-key': guide.key,
    }));
    svg.append(svgEl('path', { d: `M${guide.x1} ${guide.y - 7} V${guide.y + 7}`, class: 'guide-tick', 'data-key': guide.key }));
    svg.append(svgEl('path', { d: `M${guide.x2} ${guide.y - 7} V${guide.y + 7}`, class: 'guide-tick', 'data-key': guide.key }));
  }
  return svg;
}

function valueFor(key) {
  const item = state.measurements.find((entry) => entry.key === key);
  return item ? formatMeasurement(item.valueCm, state.profile.units) : '—';
}

function regionActive(key) {
  return selectionHighlights(state.selectedKey, key);
}

function renderDiagram() {
  const host = $('#bodyDiagram');
  host.replaceChildren(buildFigureSvg(state.diagramView));
  host.querySelectorAll('[data-key]').forEach((node) => {
    const active = regionActive(node.dataset.key);
    node.classList.toggle('is-selected', active);
    if (node.classList.contains('guide') || node.tagName === 'path') {
      node.style.pointerEvents = 'stroke';
    }
  });
  host.onclick = (event) => {
    const node = event.target.closest('[data-key]');
    if (!node) return;
    selectMeasurement(node.dataset.key, 'diagram');
  };
  const callouts = $('#diagramCallouts');
  callouts.replaceChildren();
  for (const item of CALLOUT_KEYS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'callout';
    btn.dataset.key = item.key;
    const displayKey = calloutValueKey(state.selectedKey, item.key);
    btn.setAttribute('aria-pressed', String(regionActive(item.key)));
    if (regionActive(item.key)) btn.classList.add('is-selected');
    const name = document.createElement('span');
    name.textContent = displayKey === item.key ? t(`region.${item.region}`) : t(`measure.${displayKey}`);
    const value = document.createElement('strong');
    value.textContent = valueFor(displayKey);
    btn.append(name, value);
    btn.addEventListener('click', () => selectMeasurement(item.key, 'diagram'));
    btn.addEventListener('pointerenter', (event) => showTip(event, item.key));
    btn.addEventListener('pointerleave', hideTip);
    btn.addEventListener('focus', (event) => showTip(event, item.key));
    btn.addEventListener('blur', hideTip);
    callouts.append(btn);
  }
}

function showTip(event, key) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches && event.type === 'pointerenter') return;
  const tip = $('#diagramTooltip');
  const item = state.measurements.find((entry) => entry.key === key);
  tip.hidden = false;
  tip.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = t(`measure.${key}`);
  const value = document.createElement('span');
  value.textContent = item ? formatMeasurement(item.valueCm, state.profile.units) : '—';
  const note = document.createElement('small');
  note.textContent = t('badge.sim');
  tip.append(title, value, note);
  const rect = event.currentTarget.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - 220, rect.left)}px`;
  tip.style.top = `${rect.bottom + 8}px`;
}

function hideTip() {
  $('#diagramTooltip').hidden = true;
}

function photoAvailable() {
  const cap = state.captures[state.diagramView];
  return cap.kind === 'photo';
}

function renderMode() {
  const photo = state.diagramMode === 'photo';
  $('#bodyDiagram').hidden = photo && photoAvailable();
  $('#photoStage').hidden = !(photo && photoAvailable());
  $('#modeDiagramBtn').classList.toggle('is-selected', !photo);
  $('#modePhotoBtn').classList.toggle('is-selected', photo);
  $('#modeDiagramBtn').setAttribute('aria-pressed', String(!photo));
  $('#modePhotoBtn').setAttribute('aria-pressed', String(photo));
  $('#viewFrontBtn').classList.toggle('is-selected', state.diagramView === 'front');
  $('#viewSideBtn').classList.toggle('is-selected', state.diagramView === 'side');
  $('#viewFrontBtn').setAttribute('aria-pressed', String(state.diagramView === 'front'));
  $('#viewSideBtn').setAttribute('aria-pressed', String(state.diagramView === 'side'));
  const hasAnyPhoto = state.captures.front.kind === 'photo' || state.captures.side.kind === 'photo';
  $('#modePhotoBtn').disabled = !hasAnyPhoto;
  const note = $('#diagramNote');
  const cap = state.captures[state.diagramView];
  if (photo && cap.kind === 'sample') note.textContent = t('viz.samplePhotoNote');
  else if (photo && cap.kind === 'photo') note.textContent = t('viz.photoNote');
  else note.textContent = state.generatedAt ? t('viz.diagramNote') : t('viz.awaiting');
  renderPhoto();
}

function renderPhoto() {
  const stage = $('#photoStage');
  const img = $('#photoImage');
  const cap = state.captures[state.diagramView];
  if (state.diagramMode !== 'photo' || cap.kind !== 'photo') {
    stage.hidden = true;
    return;
  }
  stage.hidden = false;
  const src = captureSource(cap);
  if (img.getAttribute('src') !== src) img.src = src;
  img.alt = t('alt.photo', { view: t(`capture.${state.diagramView}`) });
  if (img.complete && img.naturalWidth) layoutOverlay();
  else img.onload = () => layoutOverlay();
}

function layoutOverlay() {
  const img = $('#photoImage');
  const canvas = $('#poseCanvas');
  if (!img.naturalWidth || !img.clientWidth) return;
  const scale = Math.min(img.clientWidth / img.naturalWidth, img.clientHeight / img.naturalHeight);
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;
  const x = (img.clientWidth - width) / 2;
  const y = (img.clientHeight - height) / 2;
  canvas.style.left = `${x}px`;
  canvas.style.top = `${y}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const pose = state.pose[state.diagramView];
  const show = state.pose.overlay && pose?.landmarks;
  canvas.hidden = !show;
  if (show) drawLandmarks(canvas, pose.landmarks);
  else canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  renderPoseSummary();
  $('#overlayToggle').disabled = !pose?.landmarks;
  $('#overlayToggle').checked = state.pose.overlay;
}

function renderPoseSummary() {
  const summary = $('#poseSummary');
  const cap = state.captures[state.diagramView];
  if (cap.kind === 'sample') {
    summary.textContent = t('pose.skipped');
    return;
  }
  if (state.diagramMode !== 'photo' || cap.kind !== 'photo') {
    summary.textContent = '';
    return;
  }
  const pose = state.pose[state.diagramView];
  if (!pose) summary.textContent = t('pose.not_run');
  else if (pose.status === 'detected') summary.textContent = t('pose.detected');
  else summary.textContent = t('viz.noLandmarks');
}

function render() {
  renderDiagram();
  renderMode();
  renderPoseSummary();
  const awaiting = $('#vizAwaiting');
  if (awaiting) awaiting.hidden = Boolean(state.generatedAt);
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    const on = btn.dataset.preset === state.profile.preset;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', String(on));
  });
}

let overlayObserver;

export function initDiagram() {
  $('#viewFrontBtn').addEventListener('click', () => { state.diagramView = 'front'; render(); });
  $('#viewSideBtn').addEventListener('click', () => { state.diagramView = 'side'; render(); });
  $('#modeDiagramBtn').addEventListener('click', () => { state.diagramMode = 'diagram'; render(); });
  $('#modePhotoBtn').addEventListener('click', () => {
    state.diagramMode = 'photo';
    if (state.captures[state.diagramView].kind !== 'photo') {
      const other = state.diagramView === 'front' ? 'side' : 'front';
      if (state.captures[other].kind === 'photo') state.diagramView = other;
    }
    render();
  });
  $('#overlayToggle').addEventListener('change', (event) => {
    state.pose.overlay = event.target.checked;
    layoutOverlay();
  });
  overlayObserver = new ResizeObserver(() => layoutOverlay());
  overlayObserver.observe($('#photoStage'));
  subscribe(render);
  render();
}
