import { FILTERS } from './config.js';
import { sourceText, t } from './i18n.js';
import {
  emit,
  resetMeasurement,
  selectMeasurement,
  setMeasurementValue,
  state,
  subscribe,
  takeSelectionOrigin,
} from './state.js';
import { $, applyDisplayedEdit, formatMeasurement, formatNumber, scrollToId } from './utils.js';

let shownEditorUnits = null;
let revealedAt = '';

const GROUPS = ['overall', 'upper', 'torso', 'arms', 'lower'];

function visibleMeasurements() {
  const query = state.query.trim().toLowerCase();
  return state.measurements.filter((item) => {
    if (state.filter !== 'all' && item.group !== state.filter) return false;
    if (!query) return true;
    const label = t(`measure.${item.key}`).toLowerCase();
    return label.includes(query) || item.key.toLowerCase().includes(query);
  });
}

function renderList() {
  const host = $('#measurementList');
  const empty = $('#dashEmpty');
  const noMatch = $('#dashNoMatch');
  if (!state.measurements.length) {
    host.replaceChildren();
    revealedAt = '';
    empty.hidden = false;
    noMatch.hidden = true;
    $('#dashTools').hidden = true;
    $('#editor').hidden = true;
    return;
  }
  const reveal = Boolean(state.generatedAt) && state.generatedAt !== revealedAt;
  let revealIndex = 0;
  empty.hidden = true;
  $('#dashTools').hidden = false;
  $('#editor').hidden = false;
  const rows = visibleMeasurements();
  noMatch.hidden = rows.length > 0;
  host.hidden = rows.length === 0;
  const focusedKey = document.activeElement?.classList?.contains('measure-row')
    ? document.activeElement.dataset.key
    : '';
  const frag = document.createDocumentFragment();
  for (const group of GROUPS) {
    const items = rows.filter((item) => item.group === group);
    if (!items.length) continue;
    const section = document.createElement('section');
    section.className = 'measure-group';
    const heading = document.createElement('h3');
    heading.textContent = t(`group.${group}`);
    section.append(heading);
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'measure-row';
      if (reveal) {
        btn.classList.add('is-reveal');
        btn.style.setProperty('--i', String(revealIndex));
        revealIndex += 1;
      }
      if (item.key === state.selectedKey) btn.classList.add('is-selected');
      if (item.manuallyEdited) btn.classList.add('is-edited');
      btn.dataset.key = item.key;
      btn.setAttribute('aria-pressed', String(item.key === state.selectedKey));
      const name = document.createElement('span');
      name.className = 'measure-name';
      name.textContent = t(`measure.${item.key}`);
      const meta = document.createElement('span');
      meta.className = 'measure-meta';
      if (item.manuallyEdited) {
        const pill = document.createElement('span');
        pill.className = 'pill pill-edit';
        pill.textContent = t('dash.edited');
        meta.append(pill);
      }
      const value = document.createElement('strong');
      value.textContent = formatMeasurement(item.valueCm, state.profile.units);
      btn.append(name, meta, value);
      btn.addEventListener('click', () => selectMeasurement(item.key, 'dashboard'));
      section.append(btn);
    }
    frag.append(section);
  }
  host.replaceChildren(frag);
  if (reveal) revealedAt = state.generatedAt;
  if (focusedKey) host.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`)?.focus();
}

function renderEditor() {
  const editor = $('#editor');
  if (!state.measurements.length) return;
  const item = state.measurements.find((entry) => entry.key === state.selectedKey) || state.measurements[0];
  $('#editorTitle').textContent = t(`measure.${item.key}`);
  $('#editorSource').textContent = sourceText(item.source);
  $('#editorHint').textContent = t(`hint.${item.key}`);
  $('#editUnit').textContent = state.profile.units === 'in' ? t('common.in') : t('common.cm');
  const input = $('#editValue');
  const heightLocked = item.key === 'height';
  input.disabled = heightLocked;
  $('#editApply').hidden = heightLocked;
  $('#editReset').hidden = heightLocked || !item.manuallyEdited;
  $('#editProfileBtn').hidden = !heightLocked;
  const unitsChanged = shownEditorUnits !== state.profile.units;
  if (unitsChanged || document.activeElement !== input) {
    input.value = formatNumber(item.valueCm, state.profile.units);
  }
  shownEditorUnits = state.profile.units;
  const compare = $('#editCompare');
  compare.hidden = !item.manuallyEdited;
  compare.textContent = item.manuallyEdited
    ? t('dash.illustrativeWas', { value: formatMeasurement(item.illustrativeCm, state.profile.units) })
    : '';
  $('#editError').hidden = true;
  const origin = takeSelectionOrigin();
  if (origin === 'avatar' || origin === 'diagram') {
    document.querySelector(`.measure-row[data-key="${CSS.escape(item.key)}"]`)?.scrollIntoView({ block: 'nearest' });
    if (window.innerWidth < 900) editor.scrollIntoView({ block: 'nearest' });
  }
}

function render() {
  document.querySelectorAll('[data-filter]').forEach((btn) => {
    const on = btn.dataset.filter === state.filter;
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  const search = $('#measurementSearch');
  if (document.activeElement !== search && search.value !== state.query) search.value = state.query;
  $('#unitCm').classList.toggle('is-selected', state.profile.units === 'cm');
  $('#unitIn').classList.toggle('is-selected', state.profile.units === 'in');
  $('#unitCm').setAttribute('aria-pressed', String(state.profile.units === 'cm'));
  $('#unitIn').setAttribute('aria-pressed', String(state.profile.units === 'in'));
  renderList();
  renderEditor();
}

function setUnits(units) {
  state.profile.units = units;
  const radio = document.querySelector(`input[name="units"][value="${units}"]`);
  if (radio) radio.checked = true;
  emit();
}

function applyEdit() {
  const item = state.measurements.find((entry) => entry.key === state.selectedKey);
  if (!item || item.key === 'height') return;
  const result = applyDisplayedEdit(item, $('#editValue').value, state.profile.units);
  const error = $('#editError');
  if (!result.ok) {
    error.hidden = false;
    error.textContent = result.code === 'range'
      ? t('editor.range', {
        min: formatNumber(result.min, state.profile.units),
        max: formatNumber(result.max, state.profile.units),
        unit: state.profile.units === 'in' ? t('common.in') : t('common.cm'),
      })
      : t('editor.invalid');
    return;
  }
  if (!result.changed) {
    error.hidden = true;
    $('#editValue').value = formatNumber(item.valueCm, state.profile.units);
    return;
  }
  setMeasurementValue(item.key, result.item.valueCm);
}

export function initDashboard() {
  $('#measurementSearch').addEventListener('input', (event) => {
    state.query = event.target.value;
    renderList();
  });
  document.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = FILTERS.includes(btn.dataset.filter) ? btn.dataset.filter : 'all';
      render();
    });
  });
  $('#measurementList').addEventListener('keydown', (event) => {
    const buttons = [...$('#measurementList').querySelectorAll('.measure-row')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    const next = event.key === 'ArrowDown' ? buttons[index + 1] : event.key === 'ArrowUp' ? buttons[index - 1] : null;
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  });
  $('#editApply').addEventListener('click', applyEdit);
  $('#editValue').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyEdit();
    }
  });
  $('#editReset').addEventListener('click', () => resetMeasurement(state.selectedKey));
  $('#editProfileBtn').addEventListener('click', () => {
    state.step = 1;
    emit();
    scrollToId('studio');
    $('#heightCm').focus();
  });
  $('#unitCm').addEventListener('click', () => setUnits('cm'));
  $('#unitIn').addEventListener('click', () => setUnits('in'));
  subscribe(render);
  render();
}
