// BIASR — shared chrome: theme toggle, mobile nav, footer year.
(function () {
  'use strict';

  const THEME_KEY = 'biasr_theme';
  const root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }

  const stored = localStorage.getItem(THEME_KEY);
  applyTheme(stored === 'light' ? 'light' : 'dark');

  document.addEventListener('DOMContentLoaded', () => {
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
      applyTheme(root.getAttribute('data-theme'));
      themeBtn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    }

    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (navToggle && navLinks) {
      navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    }

    const year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();
  });
})();
