// RIID — Research, Intelligence, Investigation & Defense — main.js

// Active nav link
(function () {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.r-nav-inner a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (href === path) a.classList.add('active');
  });
})();

// Animate stat counters on scroll into view
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('[data-count]').forEach(el => {
      const target = parseInt(el.dataset.count, 10);
      if (isNaN(target)) return;
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 40));
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current.toLocaleString() + (el.dataset.suffix || '');
        if (current >= target) clearInterval(timer);
      }, 28);
    });
    statObserver.unobserve(entry.target);
  });
}, { threshold: 0.3 });

document.querySelectorAll('.r-stats-inner').forEach(el => statObserver.observe(el));

// Hero tagline typing effect
(function () {
  const el = document.querySelector('[data-typing]');
  if (!el) return;
  const text = el.dataset.typing;
  el.textContent = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  cursor.textContent = '█';
  let i = 0;
  function type() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      el.appendChild(cursor);
      i++;
      setTimeout(type, 28);
    }
  }
  type();
})();

// Live clock (real-world time, styled as an ops-clock readout)
(function () {
  const els = document.querySelectorAll('[data-live-clock]');
  if (!els.length) return;
  function tick() {
    const now = new Date();
    const str = now.toLocaleTimeString('en-GB', { hour12: false }) + ' UTC' +
      (-now.getTimezoneOffset() >= 0 ? '+' : '') + (-now.getTimezoneOffset() / 60);
    els.forEach(el => el.textContent = str);
  }
  tick();
  setInterval(tick, 1000);
})();

// Radar sweep decorative element injection
document.querySelectorAll('[data-radar]').forEach(el => {
  const sweep = document.createElement('div');
  sweep.className = 'radar-sweep';
  sweep.style.inset = '0';
  el.style.position = el.style.position || 'relative';
  el.appendChild(sweep);
});
