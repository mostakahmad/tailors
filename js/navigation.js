import { t } from './i18n.js';
import { emit, setLang, setTheme, state, subscribe, updateDerivedMeasurements } from './state.js';
import { $, $$ } from './utils.js';

export function initNavigation() {
  const toggle = $('#navToggle');
  const panel = $('#navPanel');
  const closeMenu = () => {
    panel.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', t('nav.menu'));
  };
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menu'));
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
  $('#themeToggle').addEventListener('click', () => setTheme(state.theme === 'dark' ? 'light' : 'dark'));
  $('#langToggle').addEventListener('click', () => setLang(state.lang === 'bn' ? 'en' : 'bn'));
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (!preset) return;
      state.profile.preset = preset;
      updateDerivedMeasurements();
      emit();
    });
  });
  const links = $$('.nav-link');
  const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      for (const link of links) {
        link.setAttribute('aria-current', link.getAttribute('href') === `#${visible.target.id}` ? 'true' : 'false');
      }
    }, { rootMargin: '-40% 0px -50% 0px', threshold: [0.15, 0.4] });
    sections.forEach((section) => observer.observe(section));
  }
  subscribe(() => {
    document.querySelectorAll('[data-preset]').forEach((btn) => {
      const on = btn.dataset.preset === state.profile.preset;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', String(on));
    });
  });
}
