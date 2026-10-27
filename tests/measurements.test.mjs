import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMeasurements, mergeMeasurements } from '../js/demoMeasurements.js';
import { validateFileMeta } from '../js/imageValidation.js';
import { assessPose, captureStillCurrent } from '../js/poseDetection.js';
import { createReportSnapshot, toCsv, toJson } from '../js/report.js';
import { replaceCapture, resetSession, sessionIsCurrent, state } from '../js/state.js';
import { applyDisplayedEdit, cmToFeetParts, feetInchesToCm, formatMeasurement, formatNumber, resolveHeightCm, round1 } from '../js/utils.js';
import { CUTTING_WARNING, DISCLAIMER, calloutValueKey, selectionHighlights } from '../js/config.js';

test('regular 170 cm demo matches the published baselines', () => {
  const rows = Object.fromEntries(buildMeasurements(170, 'regular').map((item) => [item.key, item.valueCm]));
  assert.equal(rows.height, 170);
  assert.equal(rows.chest, 94);
  assert.equal(rows.waist, 82);
  assert.equal(rows.hip, 96);
  assert.equal(rows.shoulder, 44);
  assert.equal(rows.neck, 37);
  assert.equal(rows.sleeve, 62);
  assert.equal(rows.bicep, 30);
  assert.equal(rows.wrist, 16.5);
  assert.equal(rows.inseam, 78);
  assert.equal(rows.thigh, 54);
  assert.equal(rows.back, 42);
  assert.equal(rows.torso, 66);
  assert.equal(rows.upperArm, 34);
  assert.equal(rows.leg, 100);
  assert.equal(rows.knee, 38);
  assert.equal(rows.calf, 36);
  assert.equal(rows.ankle, 22);
  assert.equal(buildMeasurements(170, 'regular').length, 18);
});

test('presets and height are deterministic', () => {
  const athletic = buildMeasurements(170, 'athletic').find((item) => item.key === 'chest');
  const slim = buildMeasurements(170, 'slim').find((item) => item.key === 'waist');
  const taller = buildMeasurements(180, 'regular').find((item) => item.key === 'chest');
  assert.equal(athletic.valueCm, 104);
  assert.equal(slim.valueCm, 72);
  assert.equal(taller.valueCm, 99.5);
  assert.deepEqual(buildMeasurements(180, 'athletic'), buildMeasurements(180, 'athletic'));
});

test('manual edits survive a preset change and height does not', () => {
  const first = buildMeasurements(170, 'regular');
  first.find((item) => item.key === 'chest').valueCm = 99;
  first.find((item) => item.key === 'chest').manuallyEdited = true;
  first.find((item) => item.key === 'chest').source = 'manual_entry';
  const merged = mergeMeasurements(first, buildMeasurements(180, 'regular'));
  const chest = merged.find((item) => item.key === 'chest');
  assert.equal(chest.valueCm, 99);
  assert.equal(chest.illustrativeCm, 99.5);
  assert.equal(chest.source, 'manual_entry');
  assert.equal(merged.find((item) => item.key === 'height').valueCm, 180);
});

test('highlight follows the selected key and keeps that key’s value', () => {
  assert.equal(selectionHighlights('neck', 'shoulder'), false);
  assert.equal(selectionHighlights('neck', 'neck'), true);
  assert.equal(selectionHighlights('bicep', 'sleeve'), false);
  assert.equal(selectionHighlights('wrist', 'sleeve'), false);
  assert.equal(selectionHighlights('torso', 'chest'), true);
  assert.equal(selectionHighlights('torso', 'waist'), true);
  assert.equal(selectionHighlights('torso', 'hip'), true);
  assert.equal(selectionHighlights('back', 'hip'), true);
  assert.equal(selectionHighlights('torso', 'back'), false);
  assert.equal(selectionHighlights('back', 'back'), true);
  assert.equal(calloutValueKey('neck', 'shoulder'), 'neck');
  assert.equal(calloutValueKey('bicep', 'sleeve'), 'bicep');
  assert.equal(calloutValueKey('wrist', 'sleeve'), 'wrist');
  assert.equal(calloutValueKey('back', 'chest'), 'back');
  assert.equal(calloutValueKey('torso', 'waist'), 'torso');
  assert.equal(calloutValueKey('torso', 'sleeve'), 'sleeve');
  assert.equal(calloutValueKey('shoulder', 'shoulder'), 'shoulder');
  assert.equal(calloutValueKey('chest', 'waist'), 'waist');
});

test('saving the displayed inch value does not change centimetres or mark the row edited', () => {
  const item = { key: 'neck', valueCm: 37, illustrativeCm: 37, manuallyEdited: false, source: 'illustrative_demo' };
  const shown = formatNumber(item.valueCm, 'in');
  assert.equal(shown, '14.6');
  const saved = applyDisplayedEdit(item, shown, 'in');
  assert.equal(saved.ok, true);
  assert.equal(saved.changed, false);
  assert.equal(saved.item.valueCm, 37);
  assert.equal(saved.item.manuallyEdited, false);
  assert.equal(saved.item.source, 'illustrative_demo');
  const edited = applyDisplayedEdit(item, '14.7', 'in');
  assert.equal(edited.changed, true);
  assert.equal(edited.item.manuallyEdited, true);
  assert.equal(edited.item.source, 'manual_entry');
  assert.notEqual(edited.item.valueCm, 37);
});

test('unedited feet display keeps the stored centimetres', () => {
  const kept = resolveHeightCm({
    storedCm: 170,
    mode: 'ft',
    cmValue: '170',
    feet: 5,
    inches: 7,
    feetUntouched: true,
    draftCm: 170,
  });
  assert.equal(kept, 170);
  assert.equal(formatMeasurement(kept, 'cm'), '170.0 cm');
  assert.equal(feetInchesToCm(5, 7), 170.2);
  assert.notEqual(kept, 170.2);
  assert.equal(resolveHeightCm({
    storedCm: 170,
    mode: 'ft',
    cmValue: '171',
    feet: 5,
    inches: 8,
    feetUntouched: false,
    draftCm: null,
  }), feetInchesToCm(5, 8));
  assert.equal(resolveHeightCm({
    storedCm: 170,
    mode: 'ft',
    cmValue: '170',
    feet: 5,
    inches: 14,
    feetUntouched: false,
    draftCm: null,
  }), null);
  assert.equal(resolveHeightCm({
    storedCm: 170,
    mode: 'cm',
    cmValue: '171.26',
    feet: 5,
    inches: 7,
    feetUntouched: true,
    draftCm: 170,
  }), 171.3);
});

test('session token drops a replaced photo and a reset report', () => {
  const token = state.sessionToken;
  state.pose.front = { status: 'detected' };
  replaceCapture('front', {
    kind: 'sample',
    objectUrl: null,
    src: 'assets/sample-front.svg',
    width: 0,
    height: 0,
    mime: 'image/svg+xml',
    name: '',
    warnings: [],
  });
  assert.equal(sessionIsCurrent(token), false);
  assert.equal(state.pose.front, null);
  assert.equal(captureStillCurrent(
    { kind: 'photo', objectUrl: 'blob:new' },
    token,
    'blob:old',
    state.sessionToken,
  ), false);
  assert.equal(captureStillCurrent(
    { kind: 'photo', objectUrl: 'blob:same' },
    state.sessionToken,
    'blob:same',
    state.sessionToken,
  ), true);
  state.generatedAt = 'stale';
  state.measurements = [{ key: 'chest' }];
  const mid = state.sessionToken;
  resetSession();
  assert.notEqual(state.sessionToken, mid);
  assert.equal(state.generatedAt, null);
  assert.deepEqual(state.measurements, []);
  assert.equal(state.captures.front.kind, 'empty');
});

test('unit conversion uses 2.54 cm per inch', () => {
  assert.equal(formatMeasurement(2.54, 'in'), '1.0 in');
  assert.equal(formatMeasurement(94, 'cm'), '94.0 cm');
  assert.equal(feetInchesToCm(5, 7), 170.2);
  assert.deepEqual(cmToFeetParts(170), { feet: 5, inches: 7 });
  assert.equal(round1(1.26), 1.3);
});

test('file validation rejects unsupported and oversized images', () => {
  assert.equal(validateFileMeta({ size: 10, type: 'image/jpeg', name: 'a.jpg' }).ok, true);
  assert.equal(validateFileMeta({ size: 10, type: 'image/svg+xml', name: 'a.svg' }).code, 'format');
  assert.equal(validateFileMeta({ size: 0, type: 'image/png', name: 'a.png' }).code, 'empty');
  assert.equal(validateFileMeta({ size: 13 * 1024 * 1024, type: 'image/png', name: 'a.png' }).code, 'too_large');
  assert.equal(validateFileMeta({ size: 100, type: 'text/plain', name: 'notes.txt' }).code, 'format');
});

function posedBody() {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const set = (index, x, y, visibility = 0.9) => { landmarks[index] = { x, y, visibility }; };
  set(11, 0.35, 0.22); set(12, 0.65, 0.22);
  set(13, 0.28, 0.36); set(14, 0.72, 0.36);
  set(15, 0.24, 0.5); set(16, 0.76, 0.5);
  set(23, 0.4, 0.52); set(24, 0.6, 0.52);
  set(25, 0.42, 0.72); set(26, 0.58, 0.72);
  set(27, 0.4, 0.92); set(28, 0.6, 0.92);
  return landmarks;
}

test('pose assessment distinguishes a clear front view from side, crowd, and empty frames', () => {
  const clear = assessPose({ landmarksList: [posedBody()], view: 'front', width: 1000, height: 1400 });
  assert.equal(clear.status, 'detected');
  assert.equal(clear.warnings.length, 0);
  const side = posedBody();
  for (const index of [12, 14, 16, 24, 26, 28]) side[index] = { x: 0.5, y: 0.5, visibility: 0.05 };
  const sideResult = assessPose({ landmarksList: [side], view: 'side', width: 1000, height: 1400 });
  assert.equal(sideResult.missing.length, 0);
  const crowd = assessPose({ landmarksList: [posedBody(), posedBody()], view: 'front', width: 1000, height: 1400 });
  assert.ok(crowd.warnings.some((warning) => warning.code === 'multiple_people'));
  const none = assessPose({ landmarksList: [], view: 'front', width: 300, height: 300 });
  assert.equal(none.status, 'none');
  assert.ok(none.warnings.some((warning) => warning.code === 'no_pose'));
  assert.ok(none.warnings.some((warning) => warning.code === 'low_resolution'));
});

test('exports include the disclaimer and omit landmark coordinates', () => {
  const measurements = buildMeasurements(170, 'regular');
  measurements.find((item) => item.key === 'chest').valueCm = 97;
  measurements.find((item) => item.key === 'chest').manuallyEdited = true;
  measurements.find((item) => item.key === 'chest').source = 'manual_entry';
  const snapshot = createReportSnapshot({
    profile: { name: 'Avery', heightCm: 170, preset: 'regular', units: 'cm' },
    captures: { front: { kind: 'sample' }, side: { kind: 'photo' } },
    pose: {
      front: null,
      side: {
        status: 'detected',
        warnings: [{ code: 'low_resolution' }, { code: 'incomplete_framing' }],
        peopleCount: 1,
        landmarks: [{ x: 0.2, y: 0.2 }],
      },
    },
    measurements,
    generatedAt: '2026-10-27T00:00:00.000Z',
  });
  const csv = toCsv(snapshot);
  const json = JSON.parse(toJson(snapshot));
  assert.equal(snapshot.notice, CUTTING_WARNING);
  assert.equal(snapshot.notice, 'Do not use these values for garment cutting, sizing decisions, or medical purposes. Photographs are not tape measurements.');
  assert.deepEqual(snapshot.poseSide.warnings, ['low_resolution', 'incomplete_framing']);
  assert.match(csv, new RegExp(DISCLAIMER));
  assert.ok(csv.includes(CUTTING_WARNING));
  assert.match(csv, /manual_entry/);
  assert.equal(json.disclaimer, DISCLAIMER);
  assert.equal(json.notice, CUTTING_WARNING);
  assert.deepEqual(json.poseSide.warnings, ['low_resolution', 'incomplete_framing']);
  assert.equal(json.measurements.find((item) => item.key === 'chest').valueCm, 97);
  assert.equal(json.poseSide.status, 'detected');
  assert.equal(JSON.stringify(json).includes('"x"'), false);
});
