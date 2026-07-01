// BIASR — Mini Unified Binod Calendar (UBC) widget, Calendar Research page.
// Renders the Binod World's own calendar structure (13 months x 28 days, 7-day
// week, intercalary Synchrony Day) rather than the Gregorian calendar, so
// visitors can browse UBC months/years directly.
//
// Holiday/event markers: fill in BIASR_HOLIDAYS below keyed by UBC ISO date
// (the same "UBCYYYY-MM-DD" format shown elsewhere on this site), e.g.
// "UBC0006-03-12": "Founding Day Observance"
(function () {
  'use strict';

  const BIASR_HOLIDAYS = {
    // "UBC0006-03-12": "Example Holiday Name"
  };

  function pad2(n) { return String(n).padStart(2, '0'); }
  function ubcIso(y, m, d) {
    return `UBC${String(y).padStart(4, '0')}-${pad2(m)}-${pad2(d)}`;
  }

  function initMiniCalendar(root) {
    const CE = window.CalendarEngine;
    let today = CE.computeUBCDate(Date.now());
    const view = { year: today.year, month: today.month };

    const todayLabel = root.querySelector('.mc-today-label');
    const monthLabel = root.querySelector('.mini-cal-month');
    const grid = root.querySelector('.mini-cal-grid');
    const weekdays = root.querySelector('.mini-cal-weekdays');
    const prevBtn = root.querySelector('.mc-prev');
    const nextBtn = root.querySelector('.mc-next');
    const toggleBtn = root.querySelector('.mc-toggle');

    weekdays.innerHTML = CE.WEEKDAYS.map(w => `<span>${w[1]}</span>`).join('');
    todayLabel.textContent = `${today.weekdayName}, ${today.day} ${today.monthName}`;

    function render() {
      const monthMeta = CE.MONTHS[view.month - 1];
      monthLabel.textContent = `${monthMeta[0]}, Year ${view.year} UBC`;

      const total = CE.daysInMonth(view.year, view.month);
      const regularDays = (total === 29) ? 28 : total;

      let cells = '';
      for (let d = 1; d <= regularDays; d++) {
        const isToday = view.year === today.year && view.month === today.month && d === today.day;
        const key = ubcIso(view.year, view.month, d);
        const holiday = BIASR_HOLIDAYS[key];
        const classes = ['mc-day'];
        if (isToday) classes.push('mc-today');
        if (holiday) classes.push('mc-has-event');
        const title = holiday ? ` title="${holiday}"` : '';
        cells += `<div class="${classes.join(' ')}"${title}>${d}</div>`;
      }
      grid.innerHTML = cells;

      let synchronyHtml = '';
      if (total === 29) {
        const isToday = view.year === today.year && view.month === today.month && today.day === 29;
        const key = ubcIso(view.year, view.month, 29);
        const holiday = BIASR_HOLIDAYS[key];
        const classes = ['mc-synchrony-day'];
        if (isToday) classes.push('mc-today');
        const title = holiday ? ` title="${holiday}"` : '';
        synchronyHtml = `<div class="${classes.join(' ')}"${title}>29 &middot; Synchrony Day (Synchara)</div>`;
      }
      let synchronyRow = root.querySelector('.mc-synchrony-row');
      if (synchronyRow) synchronyRow.remove();
      if (synchronyHtml) {
        synchronyRow = document.createElement('div');
        synchronyRow.className = 'mc-synchrony-row';
        synchronyRow.innerHTML = synchronyHtml;
        grid.insertAdjacentElement('afterend', synchronyRow);
      }
    }

    prevBtn.addEventListener('click', () => {
      view.month--;
      if (view.month < 1) { view.month = 13; view.year--; }
      render();
    });
    nextBtn.addEventListener('click', () => {
      view.month++;
      if (view.month > 13) { view.month = 1; view.year++; }
      render();
    });
    toggleBtn.addEventListener('click', () => root.classList.toggle('collapsed'));

    render();

    // Auto-sync: called on every live tick (see calendar.html) with the
    // current UBC date, so the "today" highlight and label move on their own
    // when the UBC day rolls over -- no page refresh required.
    root._mcUpdate = function (ubc) {
      if (today.year === ubc.year && today.month === ubc.month && today.day === ubc.day) return;
      today = ubc;
      todayLabel.textContent = `${today.weekdayName}, ${today.day} ${today.monthName}`;
      render();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.mini-cal-card').forEach(initMiniCalendar);
  });
})();
