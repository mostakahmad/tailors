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
  const menuItems = () => [...panel.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hidden && !el.disabled);
  const menuIsPopup = () => panel.classList.contains('is-open') && getComputedStyle(toggle).display !== 'none';
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', t(open ? 'nav.menuClose' : 'nav.menu'));
    if (open) menuItems()[0]?.focus();
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (!menuIsPopup()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      toggle.focus();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = menuItems();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
      return;
    }
    if (active === last || !panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
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
