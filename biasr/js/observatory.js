// BIASR — Observatory page: lunar phase calculation (local astronomical math, no API).
(function () {
  'use strict';

  const SYNODIC_MONTH_DAYS = 29.530588;
  const KNOWN_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14); // reference new moon

  function currentPhase() {
    const days = (Date.now() - KNOWN_NEW_MOON_UTC) / 86400000;
    let phase = (days % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
    if (phase < 0) phase += 1;
    return phase; // 0 = new moon, 0.5 = full moon
  }

  function phaseLabel(phase) {
    if (phase < 0.03 || phase > 0.97) return 'New Moon';
    if (phase < 0.22) return 'Waxing Crescent';
    if (phase < 0.28) return 'First Quarter';
    if (phase < 0.47) return 'Waxing Gibbous';
    if (phase < 0.53) return 'Full Moon';
    if (phase < 0.72) return 'Waning Gibbous';
    if (phase < 0.78) return 'Last Quarter';
    return 'Waning Crescent';
  }

  function render() {
    const phase = currentPhase();
    const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const shadow = document.getElementById('moon-shadow');
    if (shadow) shadow.style.transform = `translateX(${(100 * Math.sin(phase * Math.PI)).toFixed(1)}%)`;

    const label = document.getElementById('moon-label');
    if (label) label.textContent = phaseLabel(phase);

    const illum = document.getElementById('moon-illum');
    if (illum) illum.textContent = `${(illumination * 100).toFixed(0)}% illuminated`;
  }

  document.addEventListener('DOMContentLoaded', render);
})();
