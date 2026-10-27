import { CUTTING_WARNING, DISCLAIMER } from './config.js';
import { buildFigureSvg } from './bodyDiagram.js';
import { t } from './i18n.js';
import { state, subscribe } from './state.js';
import { $, csvCell, displayName, downloadBlob, fileStamp, formatMeasurement, scrollToId } from './utils.js';

function poseSummary(source, view) {
  const capture = source.captures[view];
  if (!capture || capture.kind === 'empty') return { status: 'not_run', warnings: [] };
  if (capture.kind === 'sample') return { status: 'skipped_sample', warnings: [] };
  const pose = source.pose?.[view];
  if (!pose) return { status: 'not_run', warnings: [] };
  return {
    status: pose.status === 'detected' ? 'detected' : 'none',
    warnings: (pose.warnings || []).map((warning) => warning.code),
    peopleCount: pose.peopleCount || 0,
  };
}

function poseLabel(summary) {
  if (summary.status === 'detected') return t('pose.detected');
  if (summary.status === 'skipped_sample') return t('pose.skipped');
  if (summary.status === 'none') return t('pose.no_pose');
  return t('pose.not_run');
}

function sourceLabel(kind) {
  if (kind === 'sample') return t('badge.sample');
  if (kind === 'photo') return t('badge.photo');
  return t('badge.missing');
}

export function createReportSnapshot(source = state) {
  const units = source.profile.units === 'in' ? 'in' : 'cm';
  return {
    product: 'TAILARS',
    disclaimer: DISCLAIMER,
    notice: CUTTING_WARNING,
    provider: 'illustrative_demo',
    profileName: displayName(source.profile.name) || t('common.demoProfile'),
    heightCm: source.profile.heightCm,
    preset: source.profile.preset,
    units,
    generatedAt: source.generatedAt,
    frontKind: source.captures.front.kind,
    sideKind: source.captures.side.kind,
    poseFront: poseSummary(source, 'front'),
    poseSide: poseSummary(source, 'side'),
    measurements: source.measurements.map((item) => ({
      key: item.key,
      label: t(`measure.${item.key}`),
      group: item.group,
      valueCm: item.valueCm,
      illustrativeCm: item.illustrativeCm,
      displayValue: formatMeasurement(item.valueCm, units),
      displayUnit: units,
      source: item.source,
      manuallyEdited: Boolean(item.manuallyEdited),
    })),
  };
}

export function toCsv(snapshot) {
  const rows = [
    ['TAILARS'],
    [snapshot.disclaimer],
    [snapshot.notice],
    ['Provider', snapshot.provider],
    ['Photo analysis', 'Photographs are not used to calculate these values'],
    ['Landmark coordinates exported', 'No'],
    [],
    ['Profile name', snapshot.profileName],
    ['Entered height cm', snapshot.heightCm],
    ['Preset', snapshot.preset],
    ['Display unit', snapshot.units],
    ['Generated at', snapshot.generatedAt || ''],
    ['Front source', snapshot.frontKind],
    ['Side source', snapshot.sideKind],
    ['Front landmarks', snapshot.poseFront.status],
    ['Side landmarks', snapshot.poseSide.status],
    [],
    ['Key', 'Label', 'Group', 'Value cm', 'Display value', 'Display unit', 'Illustrative cm', 'Source', 'Manually edited'],
  ];
  for (const item of snapshot.measurements) {
    rows.push([
      item.key,
      item.label,
      item.group,
      item.valueCm,
      item.displayValue,
      item.displayUnit,
      item.illustrativeCm,
      item.source,
      item.manuallyEdited ? 'yes' : 'no',
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function toJson(snapshot) {
  return JSON.stringify({
    ...snapshot,
    privacy: 'Uploaded photographs and landmark coordinates are not included.',
  }, null, 2);
}

function render() {
  const ready = Boolean(state.generatedAt && state.measurements.length);
  $('#reportEmpty').hidden = ready;
  $('#reportSheet').hidden = !ready;
  $('#downloadCsv').disabled = !ready;
  $('#downloadJson').disabled = !ready;
  $('#printReport').disabled = !ready;
  if (!ready) return;
  const snapshot = createReportSnapshot();
  $('#reportName').textContent = snapshot.profileName;
  $('#reportWhen').textContent = new Date(snapshot.generatedAt).toLocaleString(state.lang === 'bn' ? 'bn-BD' : 'en-GB');
  $('#reportHeight').textContent = `${snapshot.heightCm.toFixed(1)} cm`;
  $('#reportPreset').textContent = t(`preset.${snapshot.preset}`);
  $('#reportUnits').textContent = snapshot.units === 'in' ? t('common.in') : t('common.cm');
  $('#reportFront').textContent = sourceLabel(snapshot.frontKind);
  $('#reportSide').textContent = sourceLabel(snapshot.sideKind);
  $('#reportPoseFront').textContent = poseLabel(snapshot.poseFront);
  $('#reportPoseSide').textContent = poseLabel(snapshot.poseSide);
  const body = $('#reportTable tbody');
  body.replaceChildren();
  for (const item of snapshot.measurements) {
    const row = document.createElement('tr');
    if (item.manuallyEdited) row.classList.add('is-edited');
    for (const text of [
      item.label,
      item.displayValue,
      formatMeasurement(item.illustrativeCm, snapshot.units),
      item.manuallyEdited ? t('dash.sourceManual') : t('dash.sourceDemo'),
    ]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    body.append(row);
  }
  const figure = $('#reportFigure');
  figure.replaceChildren(buildFigureSvg(state.diagramView === 'side' ? 'side' : 'front'));
}

export function initReport() {
  $('#downloadCsv').addEventListener('click', () => {
    if (!state.generatedAt) return;
    const csv = toCsv(createReportSnapshot());
    downloadBlob(`tailars-illustrative-measurements-${fileStamp()}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  });
  $('#downloadJson').addEventListener('click', () => {
    if (!state.generatedAt) return;
    const json = toJson(createReportSnapshot());
    downloadBlob(`tailars-illustrative-measurements-${fileStamp()}.json`, new Blob([json], { type: 'application/json' }));
  });
  $('#printReport').addEventListener('click', () => window.print());
  $('#editReportBtn').addEventListener('click', () => {
    scrollToId('dashboard');
    $('#measurementSearch').focus();
  });
  subscribe(render);
  render();
}
