import { PRESETS, SAMPLE_SRC } from './config.js';
import { poseWarningText, t } from './i18n.js';
import { readImageFile } from './imageValidation.js';
import { runProcessing } from './processing.js';
import { closePose, detectView, ensureLandmarker } from './poseDetection.js';
import {
  bothViewsReady,
  emptyCapture,
  emit,
  replaceCapture,
  resetSession,
  setBeforeReset,
  state,
  subscribe,
  updateDerivedMeasurements,
} from './state.js';
import {
  $,
  $$,
  cmToFeetParts,
  feetInchesToCm,
  heightIsValid,
  round1,
  sanitizeName,
  scrollToId,
  toast,
  withTimeout,
} from './utils.js';

const BULK = { slim: 0.78, regular: 1, athletic: 1.08, full: 1.22 };
let stream = null;
let shotBlob = null;
let shotUrl = null;
let activeView = 'front';
let devices = [];
let deviceIndex = 0;
let detecting = false;

export function stopActiveCamera() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  const video = $('#cameraVideo');
  if (video) video.srcObject = null;
  discardShot();
}

function discardShot() {
  shotBlob = null;
  if (shotUrl) {
    URL.revokeObjectURL(shotUrl);
    shotUrl = null;
  }
}

export function loadSamplePair() {
  stopActiveCamera();
  const dialog = $('#cameraDialog');
  if (dialog?.open) dialog.close();
  state.profile.heightCm = 170;
  state.profile.heightInput = 'cm';
  state.profile.preset = 'regular';
  state.profile.units = 'cm';
  replaceCapture('front', sampleCapture('front'));
  replaceCapture('side', sampleCapture('side'));
  state.pose.front = null;
  state.pose.side = null;
  if (state.pose.engine !== 'ready') state.pose.engineCode = 'sample';
  state.step = 3;
  updateDerivedMeasurements();
  emit();
  toast(t('toast.sample'));
  scrollToId('studio');
}

function sampleCapture(view) {
  return {
    kind: 'sample',
    objectUrl: null,
    src: SAMPLE_SRC[view],
    width: 0,
    height: 0,
    mime: 'image/svg+xml',
    name: '',
    warnings: [],
  };
}

function commitProfile(announce) {
  state.profile.name = sanitizeName($('#displayName').value);
  const mode = $('input[name="heightMode"]:checked')?.value === 'ft' ? 'ft' : 'cm';
  state.profile.heightInput = mode;
  let cm = null;
  if (mode === 'cm') {
    cm = round1(Number($('#heightCm').value));
  } else {
    const feet = Number($('#heightFeet').value);
    const inches = Number($('#heightInches').value);
    if (Number.isFinite(feet) && Number.isFinite(inches) && inches >= 0 && inches < 12) {
      cm = feetInchesToCm(feet, inches);
    }
  }
  const error = $('#heightError');
  if (!heightIsValid(cm)) {
    error.hidden = false;
    error.textContent = t('profile.heightInvalid');
    $('#heightCm').setAttribute('aria-invalid', 'true');
    if (announce) toast(t('profile.heightInvalid'), 'error');
    return false;
  }
  error.hidden = true;
  $('#heightCm').removeAttribute('aria-invalid');
  state.profile.heightCm = cm;
  const preset = $('input[name="preset"]:checked')?.value || 'regular';
  state.profile.preset = PRESETS.includes(preset) ? preset : 'regular';
  state.profile.units = $('input[name="units"]:checked')?.value === 'in' ? 'in' : 'cm';
  updateDerivedMeasurements();
  return true;
}

function goToStep(target) {
  if (target > state.step && state.step === 1 && !commitProfile(true)) return;
  if (target > 1 && !heightIsValid(state.profile.heightCm)) {
    if (!commitProfile(true)) return;
  }
  if (target > 2 && !bothViewsReady()) {
    toast(t('capture.needBoth'), 'error');
    const alert = $('#captureAlert');
    alert.hidden = false;
    alert.textContent = t('capture.needBoth');
    return;
  }
  if (target < 2) stopActiveCamera();
  state.step = target;
  emit();
  document.querySelector(`[data-step-panel="${target}"] h3`)?.focus();
}

async function applyPhotoFile(view, file) {
  const result = await readImageFile(file);
  if (!result.ok) {
    toast(t(`validation.${result.code}`), 'error');
    return;
  }
  replaceCapture(view, {
    kind: 'photo',
    objectUrl: result.objectUrl,
    src: result.objectUrl,
    width: result.width,
    height: result.height,
    mime: result.mime,
    name: sanitizeName(result.name).slice(0, 80),
    warnings: result.warnings,
  });
  const alert = $('#captureAlert');
  alert.hidden = true;
  emit();
  toast(t('toast.photoReady', { view: t(`capture.${view}`) }));
}

function clearView(view) {
  replaceCapture(view, emptyCapture());
  if (!bothViewsReady() && state.step > 2) state.step = 2;
  emit();
}

function useSample(view) {
  replaceCapture(view, sampleCapture(view));
  emit();
}

function render() {
  $$('[data-step-panel]').forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== state.step;
  });
  const heightOk = heightIsValid(state.profile.heightCm);
  $$('[data-step-jump]').forEach((btn) => {
    const step = Number(btn.dataset.stepJump);
    const reachable = step === 1 || (step === 2 && heightOk) || (step === 3 && heightOk && bothViewsReady());
    btn.disabled = !reachable;
    btn.setAttribute('aria-current', step === state.step ? 'step' : 'false');
    btn.dataset.state = step < state.step ? 'done' : step === state.step ? 'current' : 'todo';
  });
  syncProfileForm();
  for (const view of ['front', 'side']) renderTile(view);
  renderReview();
  const processingPanel = $('#processingPanel');
  processingPanel.hidden = !state.processing && !state.generatedAt && !state.processingError;
  $('#processingRetry').hidden = !state.processingError;
  $('#generateBtn').disabled = state.processing || detecting || !bothViewsReady() || !heightOk;
  $('#toReviewBtn').disabled = !bothViewsReady();
  const hasPhoto = ['front', 'side'].some((view) => state.captures[view].kind === 'photo');
  $('#detectBtn').disabled = detecting || state.processing || !hasPhoto || state.pose.engine === 'loading';
  if (!state.processing && !state.generatedAt && !state.processingError) {
    $$('[data-stage]').forEach((item) => item.setAttribute('data-state', 'wait'));
    $('#processingDetail').textContent = '';
  }
  const preview = $('#presetPreview');
  if (preview) preview.style.setProperty('--bulk', String(BULK[state.profile.preset] || 1));
}

function syncProfileForm() {
  const name = $('#displayName');
  if (document.activeElement !== name && name.value !== state.profile.name) name.value = state.profile.name;
  const cm = $('#heightCm');
  if (document.activeElement !== cm) cm.value = String(state.profile.heightCm);
  const parts = cmToFeetParts(state.profile.heightCm);
  const feet = $('#heightFeet');
  const inches = $('#heightInches');
  if (document.activeElement !== feet) feet.value = String(parts.feet);
  if (document.activeElement !== inches) inches.value = String(parts.inches);
  const mode = $(`input[name="heightMode"][value="${state.profile.heightInput === 'ft' ? 'ft' : 'cm'}"]`);
  if (mode) mode.checked = true;
  const preset = $(`input[name="preset"][value="${state.profile.preset}"]`);
  if (preset) preset.checked = true;
  const units = $(`input[name="units"][value="${state.profile.units}"]`);
  if (units) units.checked = true;
  updateHeightHint();
}

function updateHeightHint() {
  const mode = $('input[name="heightMode"]:checked')?.value === 'ft' ? 'ft' : 'cm';
  $('#cmFields').hidden = mode === 'ft';
  $('#ftFields').hidden = mode !== 'ft';
  const hint = $('#heightHint');
  if (mode === 'ft') {
    const feet = Number($('#heightFeet').value);
    const inches = Number($('#heightInches').value);
    hint.textContent = Number.isFinite(feet) && Number.isFinite(inches) && inches >= 0 && inches < 12
      ? `≈ ${feetInchesToCm(feet, inches).toFixed(1)} cm`
      : '';
  } else {
    const cm = Number($('#heightCm').value);
    if (heightIsValid(cm)) {
      const parts = cmToFeetParts(cm);
      hint.textContent = `≈ ${parts.feet} ft ${parts.inches} in`;
    } else hint.textContent = '';
  }
}

function renderTile(view) {
  const cap = state.captures[view];
  const img = $(`#${view}Preview`);
  const empty = $(`#${view}Empty`);
  const badge = $(`#${view}Badge`);
  if (cap.kind === 'empty') {
    img.hidden = true;
    img.removeAttribute('src');
    empty.hidden = false;
  } else {
    empty.hidden = true;
    img.hidden = false;
    const src = cap.kind === 'sample' ? cap.src : cap.objectUrl;
    if (img.getAttribute('src') !== src) img.src = src;
    img.alt = t(cap.kind === 'sample' ? 'alt.sample' : 'alt.photo', { view: t(`capture.${view}`) });
  }
  badge.dataset.kind = cap.kind;
  badge.textContent = t(cap.kind === 'sample' ? 'badge.sample' : cap.kind === 'photo' ? 'badge.photo' : 'badge.empty');
  $$(`[data-capture-action="remove"][data-view="${view}"]`).forEach((btn) => {
    btn.hidden = cap.kind === 'empty';
  });
}

function renderReview() {
  for (const view of ['front', 'side']) {
    const cap = state.captures[view];
    const img = $(`#review${view === 'front' ? 'Front' : 'Side'}`);
    const meta = $(`#review${view === 'front' ? 'Front' : 'Side'}Meta`);
    if (cap.kind === 'empty') {
      img.hidden = true;
      meta.textContent = t('badge.missing');
    } else {
      img.hidden = false;
      const src = cap.kind === 'sample' ? cap.src : cap.objectUrl;
      if (img.getAttribute('src') !== src) img.src = src;
      img.alt = t(cap.kind === 'sample' ? 'alt.sample' : 'alt.photo', { view: t(`capture.${view}`) });
      const bits = [t(cap.kind === 'sample' ? 'badge.sample' : 'badge.photo')];
      if (cap.width) bits.push(`${cap.width}×${cap.height}`);
      meta.textContent = bits.join(' · ');
    }
  }
  const name = sanitizeName(state.profile.name).trim() || t('common.demoProfile');
  $('#reviewProfile').textContent = `${name} · ${state.profile.heightCm.toFixed(1)} cm · ${t(`preset.${state.profile.preset}`)} · ${t(state.profile.units === 'in' ? 'common.in' : 'common.cm')}`;
  const list = $('#qualityList');
  list.replaceChildren();
  const engine = document.createElement('li');
  engine.textContent = t(`pose.${state.pose.engineCode || 'idle'}`);
  list.append(engine);
  for (const view of ['front', 'side']) {
    const cap = state.captures[view];
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = `${t(`capture.${view}`)}: `;
    const span = document.createElement('span');
    const bits = [t(cap.kind === 'sample' ? 'badge.sample' : cap.kind === 'photo' ? 'badge.photo' : 'badge.missing')];
    if (cap.kind === 'photo' && cap.width) bits.push(t('quality.dimensions', { width: cap.width, height: cap.height }));
    if (cap.warnings?.includes('low_resolution')) bits.push(t('quality.lowRes'));
    if (cap.kind === 'sample') bits.push(t('quality.sampleSkip'));
    const pose = state.pose[view];
    if (pose?.warnings?.length) pose.warnings.forEach((warning) => bits.push(poseWarningText(warning)));
    else if (cap.kind === 'photo') bits.push(t('pose.not_run'));
    span.textContent = bits.join(' · ');
    item.append(strong, span);
    list.append(item);
  }
}

function cameraErrorText(error) {
  const name = error?.name || '';
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return t('camera.needHttps');
  if (name === 'NotAllowedError' || name === 'SecurityError') return t('camera.denied');
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return t('camera.missing');
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return t('camera.busy');
  return t('camera.other');
}

function showCameraError(message) {
  const el = $('#cameraError');
  el.hidden = !message;
  el.textContent = message || '';
}

async function openStream(deviceId) {
  stopStreamOnly();
  const videoConstraints = deviceId
    ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 1600 } }
    : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1600 } };
  let next;
  try {
    next = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
  } catch (error) {
    if (error?.name === 'OverconstrainedError') {
      next = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    } else throw error;
  }
  stream = next;
  const video = $('#cameraVideo');
  video.srcObject = stream;
  await video.play();
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    devices = all.filter((item) => item.kind === 'videoinput');
  } catch {
    devices = [];
  }
  $('#cameraSwitch').hidden = devices.length < 2;
}

function stopStreamOnly() {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  const video = $('#cameraVideo');
  if (video) video.srcObject = null;
}

function showLive() {
  $('#cameraPrivacy').hidden = true;
  $('#cameraLive').hidden = false;
  $('#cameraVideo').hidden = false;
  $('#cameraStill').hidden = true;
  $('#cameraShoot').hidden = false;
  $('#cameraRetake').hidden = true;
  $('#cameraUse').hidden = true;
}

async function startCamera() {
  showCameraError('');
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showCameraError(t('camera.needHttps'));
    showLive();
    $('#cameraShoot').disabled = true;
    return;
  }
  try {
    const current = devices[deviceIndex];
    await openStream(current?.deviceId);
    showLive();
    $('#cameraShoot').disabled = false;
  } catch (error) {
    showLive();
    $('#cameraShoot').disabled = true;
    showCameraError(cameraErrorText(error));
  }
}

function openCamera(view) {
  activeView = view;
  discardShot();
  deviceIndex = 0;
  $('#cameraViewLabel').textContent = t(`capture.${view}`);
  $('#cameraPrivacy').hidden = false;
  $('#cameraLive').hidden = true;
  showCameraError('');
  $('#cameraDialog').showModal();
}

async function shoot() {
  const video = $('#cameraVideo');
  if (!video.videoWidth) {
    showCameraError(t('camera.busy'));
    return;
  }
  const canvas = $('#cameraCanvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) {
    showCameraError(t('camera.other'));
    return;
  }
  discardShot();
  shotBlob = blob;
  shotUrl = URL.createObjectURL(blob);
  const still = $('#cameraStill');
  still.src = shotUrl;
  still.hidden = false;
  video.hidden = true;
  stopStreamOnly();
  $('#cameraShoot').hidden = true;
  $('#cameraRetake').hidden = false;
  $('#cameraUse').hidden = false;
  $('#cameraSwitch').hidden = true;
}

async function useShot() {
  if (!shotBlob) return;
  const file = new File([shotBlob], `${activeView}-capture.jpg`, { type: 'image/jpeg' });
  discardShot();
  $('#cameraDialog').close();
  await applyPhotoFile(activeView, file);
}

async function detectNow() {
  const photos = ['front', 'side'].filter((view) => state.captures[view].kind === 'photo');
  if (!photos.length) {
    toast(t('pose.sample'));
    return;
  }
  detecting = true;
  emit();
  try {
    await withTimeout(ensureLandmarker(), 12000);
    for (const view of photos) await detectView(view);
    emit();
    toast(t('toast.landmarks'));
  } catch (error) {
    if (error?.message === 'timeout') state.pose.engineCode = 'timeout';
    emit();
    toast(t('process.poseFail'), 'error');
  } finally {
    detecting = false;
    emit();
  }
}

async function confirmReset() {
  const dirty = state.generatedAt || state.captures.front.kind !== 'empty' || state.captures.side.kind !== 'empty' || state.profile.name;
  if (!dirty) {
    toast(t('toast.resetEmpty'));
    return;
  }
  const dialog = $('#resetDialog');
  dialog.showModal();
  const choice = await new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
  });
  if (choice === 'confirm') {
    resetSession();
    toast(t('toast.cleared'));
    scrollToId('studio');
  }
}

export function initStudio() {
  setBeforeReset(() => {
    stopActiveCamera();
    const dialog = $('#cameraDialog');
    if (dialog?.open) dialog.close();
  });
  $('#displayName').addEventListener('input', () => {
    state.profile.name = sanitizeName($('#displayName').value);
    if (state.generatedAt) emit();
  });
  $$('input[name="heightMode"]').forEach((input) => input.addEventListener('change', () => {
    state.profile.heightInput = input.value === 'ft' ? 'ft' : 'cm';
    updateHeightHint();
  }));
  ['heightCm', 'heightFeet', 'heightInches'].forEach((id) => {
    $('#' + id).addEventListener('input', updateHeightHint);
  });
  $$('input[name="preset"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    state.profile.preset = input.value;
    updateDerivedMeasurements();
    emit();
  }));
  $$('input[name="units"]').forEach((input) => input.addEventListener('change', () => {
    if (!input.checked) return;
    state.profile.units = input.value === 'in' ? 'in' : 'cm';
    emit();
  }));
  $$('[data-step-jump]').forEach((btn) => btn.addEventListener('click', () => goToStep(Number(btn.dataset.stepJump))));
  $('#toCaptureBtn').addEventListener('click', () => goToStep(2));
  $('#backToProfileBtn').addEventListener('click', () => goToStep(1));
  $('#toReviewBtn').addEventListener('click', () => goToStep(3));
  $('#backToCaptureBtn').addEventListener('click', () => goToStep(2));
  $('#generateBtn').addEventListener('click', async () => {
    if (!commitProfile(true)) {
      state.step = 1;
      emit();
      return;
    }
    emit();
    await runProcessing();
  });
  $('#processingRetry').addEventListener('click', () => runProcessing());
  $('#detectBtn').addEventListener('click', () => detectNow());
  $('#sampleBothBtn').addEventListener('click', loadSamplePair);
  $$('.js-load-sample').forEach((btn) => btn.addEventListener('click', loadSamplePair));
  $('#studio').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-capture-action]');
    if (!btn) return;
    const view = btn.dataset.view;
    const action = btn.dataset.captureAction;
    if (action === 'camera') openCamera(view);
    if (action === 'remove') clearView(view);
    if (action === 'sample') useSample(view);
  });
  for (const view of ['front', 'side']) {
    const input = $(`#${view}Input`);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) void applyPhotoFile(view, file);
    });
    const tile = $(`#${view}Drop`);
    tile.addEventListener('dragover', (event) => {
      event.preventDefault();
      tile.classList.add('is-drag');
    });
    tile.addEventListener('dragleave', () => tile.classList.remove('is-drag'));
    tile.addEventListener('drop', (event) => {
      event.preventDefault();
      tile.classList.remove('is-drag');
      const file = event.dataTransfer?.files?.[0];
      if (file) void applyPhotoFile(view, file);
    });
  }
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
  $('#cameraAck').addEventListener('click', () => startCamera());
  $('#cameraShoot').addEventListener('click', () => shoot());
  $('#cameraRetake').addEventListener('click', () => {
    discardShot();
    void startCamera();
  });
  $('#cameraUse').addEventListener('click', () => useShot());
  $('#cameraSwitch').addEventListener('click', async () => {
    if (devices.length < 2) return;
    deviceIndex = (deviceIndex + 1) % devices.length;
    try {
      await openStream(devices[deviceIndex].deviceId);
      showCameraError('');
    } catch (error) {
      showCameraError(cameraErrorText(error));
    }
  });
  $('#cameraClose').addEventListener('click', () => $('#cameraDialog').close());
  $('#cameraDialog').addEventListener('close', () => {
    stopStreamOnly();
    discardShot();
  });
  $$('.js-reset').forEach((btn) => btn.addEventListener('click', () => confirmReset()));
  window.addEventListener('pagehide', () => {
    stopStreamOnly();
    discardShot();
    closePose();
    for (const view of ['front', 'side']) {
      const url = state.captures[view].objectUrl;
      if (url) URL.revokeObjectURL(url);
    }
  });
  subscribe(render);
  render();
}
