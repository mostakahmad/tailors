import { getProvider } from './measurementProvider.js';
import { mergeMeasurements } from './demoMeasurements.js';
import { detectView, ensureLandmarker } from './poseDetection.js';
import { bothViewsReady, emit, state } from './state.js';
import { t } from './i18n.js';
import { heightIsValid, scrollToId, toast, wait, withTimeout } from './utils.js';

const STAGES = ['prepare', 'ready', 'pose', 'measure', 'visual', 'report'];

function stage(name, status) {
  document.querySelector(`[data-stage="${name}"]`)?.setAttribute('data-state', status);
}

function detail(message) {
  const el = document.getElementById('processingDetail');
  if (el) el.textContent = message;
}

export async function runProcessing() {
  if (state.processing) return false;
  state.processing = true;
  state.processingError = false;
  STAGES.forEach((name) => stage(name, 'wait'));
  detail(t('process.working'));
  emit();
  try {
    stage('prepare', 'active');
    detail(t('process.prepare'));
    await wait(260);
    stage('prepare', 'done');

    stage('ready', 'active');
    detail(t('process.ready'));
    if (!bothViewsReady() || !heightIsValid(state.profile.heightCm)) {
      throw new Error('not-ready');
    }
    await wait(200);
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
        for (const view of photos) await detectView(view);
        const detected = photos.some((view) => state.pose[view]?.status === 'detected');
        stage('pose', 'done');
        detail(detected ? t('process.poseOk') : t('pose.no_pose'));
      } catch (error) {
        stage('pose', 'warn');
        const poseMessage = error?.message === 'timeout' ? t('process.poseTimeout') : t('process.poseFail');
        if (error?.message === 'timeout') state.pose.engineCode = 'timeout';
        detail(poseMessage);
        if (poseNote) poseNote.textContent = poseMessage;
      }
    }

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
    state.measurements = mergeMeasurements(state.measurements, result.measurements);
    await wait(220);
    stage('measure', 'done');

    stage('visual', 'active');
    detail(t('process.visual'));
    await wait(200);
    stage('visual', 'done');

    stage('report', 'active');
    detail(t('process.report'));
    state.generatedAt = new Date().toISOString();
    state.processing = false;
    state.processingError = false;
    await wait(140);
    stage('report', 'done');
    emit();
    toast(t('toast.ready'));
    scrollToId('visualization');
    return true;
  } catch (error) {
    console.error('Preview failed', error?.message || 'error');
    state.processing = false;
    state.processingError = true;
    detail(t('process.fail'));
    emit();
    return false;
  }
}
