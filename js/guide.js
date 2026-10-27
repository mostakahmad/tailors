import { loadSamplePair } from './studio.js';
import { $ } from './utils.js';

const GUIDE_KEY = 'tailars-guide';

function rememberGuide() {
  try { localStorage.setItem(GUIDE_KEY, 'seen'); } catch { /* Preferences are optional. */ }
}

function guideSeen() {
  try { return localStorage.getItem(GUIDE_KEY) === 'seen'; } catch { return false; }
}

export function initGuide() {
  const dialog = $('#guideDialog');
  if (!dialog || guideSeen()) return;
  let stored = false;
  const remember = () => {
    if (stored) return;
    stored = true;
    rememberGuide();
  };
  $('#guideSample').addEventListener('click', () => {
    remember();
    dialog.close();
    loadSamplePair();
  });
  $('#guideDismiss').addEventListener('click', () => {
    remember();
    dialog.close();
  });
  dialog.addEventListener('cancel', remember);
  dialog.showModal();
}
