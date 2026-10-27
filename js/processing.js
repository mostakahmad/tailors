import { getProvider } from './measurementProvider.js';
import { mergeMeasurements } from './demoMeasurements.js';
import { detectView, ensureLandmarker } from './poseDetection.js';
import { bothViewsReady, emit, state } from './state.js';
import { t } from './i18n.js';
import { heightIsValid, scrollToId, toast, wait, withTimeout } from './utils.js';

const STAGES = ['prepare', 'ready', 'pose', 'measure', 'visual', 'report'];
const SETTLED = new Set(['done', 'skip', 'warn']);
let processingOwner = null;

function stage(name, status) {
  document.querySelector(`[data-stage="${name}"]`)?.setAttribute('data-state', status);
  const items = document.querySelectorAll('[data-stage]');
  if (!items.length) return;
  let finished = 0;
  items.forEach((item) => {
    if (SETTLED.has(item.getAttribute('data-state'))) finished += 1;
  });
  document.getElementById('processingPanel')?.style.setProperty('--progress', String(finished / items.length));
}

function detail(message) {
  const el = document.getElementById('processingDetail');
  if (el) el.textContent = message;
}

function expired(token) {
  if (state.sessionToken === token) return false;
  if (processingOwner === token) {
    processingOwner = null;
    if (state.processing) {
      state.processing = false;
      emit();
    }
  }
  return true;
}

export async function runProcessing() {
  if (state.processing) return false;
  const token = state.sessionToken;
  processingOwner = token;
  state.processing = true;
  state.processingError = false;
  STAGES.forEach((name) => stage(name, 'wait'));
  detail(t('process.working'));
  emit();
  try {
    stage('prepare', 'active');
    detail(t('process.prepare'));
    await wait(260);
    if (expired(token)) return false;
    stage('prepare', 'done');

    stage('ready', 'active');
    detail(t('process.ready'));
    if (!bothViewsReady() || !heightIsValid(state.profile.heightCm)) {
      throw new Error('not-ready');
    }
    await wait(200);
    if (expired(token)) return false;
    stage('ready', 'done');

    stage('pose', 'active');
    detail(t('process.pose'));
    const photos = ['front', 'side'].filter((view) => state.captures[view].kind === 'photo');
    const poseNote = document.getElementById('poseStageNote');
    if (!photos.length) {
      stage('pose', 'skip');
      detail(t('process.poseSkip'));
      if (poseNote) poseNote.textContent = t('process.poseSkip');
      if (state.pose.engine !== 'ready') state.pose.engineCode = 'sample';
    } else {
      if (poseNote) poseNote.textContent = '';
      try {
        await withTimeout(ensureLandmarker(), 12000);
        if (expired(token)) return false;
        for (const view of photos) {
          await detectView(view);
          if (expired(token)) return false;
        }
        const detected = photos.some((view) => state.pose[view]?.status === 'detected');
        if (detected) {
          stage('pose', 'done');
          detail(t('process.poseOk'));
        } else {
          stage('pose', 'warn');
          detail(t('pose.no_pose'));
        }
      } catch (error) {
        if (expired(token)) return false;
        stage('pose', 'warn');
        const timedOut = error?.message === 'timeout';
        const poseMessage = timedOut ? t('process.poseTimeout') : t('process.poseFail');
        if (timedOut && state.pose.engine !== 'ready') state.pose.engineCode = 'timeout';
        detail(poseMessage);
        if (poseNote) poseNote.textContent = poseMessage;
      }
    }

    if (expired(token)) return false;
    stage('measure', 'active');
    detail(t('process.measure'));
    const result = await getProvider().analyze({
      heightCm: state.profile.heightCm,
      preset: state.profile.preset,
      captures: {
        front: state.captures.front.kind,
        side: state.captures.side.kind,
      },
    });
    if (expired(token)) return false;
    const nextMeasurements = mergeMeasurements(state.measurements, result.measurements);
    await wait(220);
    if (expired(token)) return false;
    stage('measure', 'done');

    stage('visual', 'active');
    detail(t('process.visual'));
    await wait(200);
    if (expired(token)) return false;
    stage('visual', 'done');

    stage('report', 'active');
    detail(t('process.report'));
    state.measurements = nextMeasurements;
    state.generatedAt = new Date().toISOString();
    state.processing = false;
    state.processingError = false;
    processingOwner = null;
    await wait(140);
    if (state.sessionToken !== token) return false;
    stage('report', 'done');
    emit();
    toast(t('toast.ready'));
    scrollToId('visualization');
    return true;
  } catch (error) {
    if (expired(token)) return false;
    console.error('Preview failed', error?.message || 'error');
    state.processing = false;
    state.processingError = true;
    processingOwner = null;
    detail(t('process.fail'));
    emit();
    return false;
  }
}
