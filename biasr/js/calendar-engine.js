// BIASR — Unified Binod Calendar (UBC) Engine
// Implements UBC Standard v2.0.0: the civil calendar is synchronized directly to
// the Minecraft world and advances ONLY during the official Active Temporal Flow
// (ATF) window (20:00-03:00 IST). One complete Minecraft day (20 real-world
// minutes of ATF-active time) equals one UBC civil day. Outside the window, the
// entire calendar -- date AND displayed time -- freezes exactly where it stopped,
// and resumes automatically at 20:00 IST with no manual reset.
//
// This supersedes UBC v1.0.1's continuous, TSI-based Earth-time model: the UBC
// date is no longer a function of continuous elapsed Earth time. It is a function
// of accumulated ATF-active Minecraft days since the Founding Epoch.
// Vanilla JS, no dependencies. Safe for GitHub Pages (static hosting only).

(function (global) {
  'use strict';

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  // ── UBC Standard v2.0.0 constants ──────────────────────────────────────────

  // India Standard Time: fixed +5:30 offset, no DST -- modeled as a constant.
  const IST_OFFSET_MS = 5.5 * HOUR;

  // Founding Epoch (FE): Day 1, Month 1 (Ardhan), Year 1 = 23 April 2021, 20:00:00 IST
  // (14:30:00 UTC). This is also the moment the first Active Temporal Flow window opens.
  const EPOCH_UTC_MS = Date.UTC(2021, 3, 23, 14, 30, 0);

  // Official ATF gameplay window: 20:00 IST -> 03:00 IST next day (7 hours).
  const WINDOW_START_HOUR = 20;
  const WINDOW_LENGTH_MS = 7 * HOUR;

  // One Minecraft day = 20 real-world minutes = one UBC civil day.
  const CIVIL_DAY_REAL_MS = 20 * MINUTE;

  const MONTHS = [
    ['Ardhan', 'ARD'], ['Ferith', 'FER'], ['Selvyn', 'SEL'], ['Kython', 'KYT'],
    ['Dravon', 'DRA'], ['Moriel', 'MOR'], ['Uthren', 'UTH'], ['Phiron', 'PHI'],
    ['Naldyn', 'NAL'], ['Veskar', 'VES'], ['Orrith', 'ORR'], ['Caelun', 'CAE'], ['Zephris', 'ZEP']
  ];
  const WEEKDAYS = [
    ['Solday', 'Sol'], ['Ironday', 'Iro'], ['Craftday', 'Cra'], ['Stonday', 'Sto'],
    ['Woodsday', 'Woo'], ['Restday', 'Res'], ['Voidday', 'Voi']
  ];

  const STORAGE_KEY = 'biasr_ubc_atf_state_v3';

  // ── Leap Correction Scheme (unchanged from v1.0.1) ─────────────────────────
  //
  // Formal Leap Test: IsLeap(y) = true if y%400=0; false if y%100=0;
  // else true if Phi(y) >= 1, where Phi(y) = frac((y-1) * 1.2563).
  // In practice this makes every year common (364 days) except multiples of 400.
  function isLeapYear(y) {
    if (y % 400 === 0) return true;
    if (y % 100 === 0) return false;
    const phi = ((y - 1) * 1.2563) % 1;
    return phi >= 1;
  }

  function daysInYear(y) { return isLeapYear(y) ? 365 : 364; }
  function daysInMonth(y, m) { return (m === 7 && isLeapYear(y)) ? 29 : 28; }

  // ── Active Temporal Flow (ATF): gates the entire calendar ──────────────────

  function toISTShifted(utcMs) { return utcMs + IST_OFFSET_MS; }

  function windowForDay(dayIndex) {
    const start = dayIndex * DAY + WINDOW_START_HOUR * HOUR;
    return [start, start + WINDOW_LENGTH_MS];
  }

  function isActiveAt(shiftedMs) {
    const day = Math.floor(shiftedMs / DAY);
    for (const d of [day - 1, day]) {
      const [start, end] = windowForDay(d);
      if (shiftedMs >= start && shiftedMs < end) return true;
    }
    return false;
  }

  // Sums all ATF-active milliseconds between the Founding Epoch and `nowUtcMs`.
  // This is the sole driver of the UBC calendar: date, month, year, and the
  // displayed in-day clock are all pure functions of this accumulated value.
  function computeBankedMs(nowUtcMs) {
    const epochShifted = toISTShifted(EPOCH_UTC_MS);
    const nowShifted = toISTShifted(nowUtcMs);
    if (nowShifted <= epochShifted) return 0;

    const firstDay = Math.floor(epochShifted / DAY) - 1;
    const lastDay = Math.floor(nowShifted / DAY) + 1;

    let banked = 0;
    for (let d = firstDay; d <= lastDay; d++) {
      const [wStart, wEnd] = windowForDay(d);
      const overlapStart = Math.max(wStart, epochShifted);
      const overlapEnd = Math.min(wEnd, nowShifted);
      if (overlapEnd > overlapStart) banked += (overlapEnd - overlapStart);
    }
    return banked;
  }

  // ── UBC Date + in-day clock, derived from accumulated ATF-active time ─────
  //
  // Every 20 real-world minutes of ATF-active time advances the UBC date by
  // exactly one civil day (one Minecraft day). Every 50 real-world seconds of
  // that same active time advances the displayed UBC time by one in-game hour
  // (1200s / 24h = 50s/h) -- so the in-day clock completes a full 24-hour cycle
  // once per civil day, freezing in place whenever ATF is inactive.
  function ubcFromBankedMs(bankedMs) {
    const totalDaysFloat = bankedMs / CIVIL_DAY_REAL_MS;
    const N = Math.floor(totalDaysFloat) + 1; // BJDN, 1-indexed
    const fractionOfDay = totalDaysFloat - Math.floor(totalDaysFloat);

    let y = 1, r = N - 1;
    while (r >= daysInYear(y)) { r -= daysInYear(y); y++; }
    let m = 1;
    while (r >= daysInMonth(y, m)) { r -= daysInMonth(y, m); m++; }
    const d = r + 1;

    const leap = isLeapYear(y);
    const isSynchronyDay = (m === 7 && leap && d === 29);
    const weekdayIndex = isSynchronyDay ? null : (d - 1) % 7;

    const hoursFloat = fractionOfDay * 24;
    const hh = Math.floor(hoursFloat);
    const mmFloat = (hoursFloat - hh) * 60;
    const mm = Math.floor(mmFloat);
    const ss = Math.floor((mmFloat - mm) * 60);

    return {
      N, year: y, month: m,
      monthName: MONTHS[m - 1][0], monthAbbr: MONTHS[m - 1][1],
      day: d, isLeap: leap, isSynchronyDay,
      weekdayName: isSynchronyDay ? 'Synchrony Day (Synchara)' : WEEKDAYS[weekdayIndex][0],
      fullDate: `${String(d).padStart(2, '0')}-${MONTHS[m - 1][1]}-${y}`,
      isoDate: `UBC${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      clock: { hh, mm, ss },
      fractionOfDay,
      secondsUntilNextDay: Math.ceil((1 - fractionOfDay) * (CIVIL_DAY_REAL_MS / 1000))
    };
  }

  function computeUBCDate(nowUtcMs) {
    return ubcFromBankedMs(computeBankedMs(nowUtcMs));
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function formatISTClock(nowUtcMs) {
    const shifted = toISTShifted(nowUtcMs);
    const d = new Date(shifted);
    return {
      date: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
      time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`
    };
  }

  // ── Persistence (localStorage) — diagnostics only ─────────────────────────
  //
  // The UBC state above is always fully recomputed from the Founding Epoch, so
  // it never depends on this stored record for correctness; the record is kept
  // only to detect banking irregularities (see `drift` in computeState()).

  function loadStoredState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function saveState(record) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); }
    catch (_) { /* non-fatal: engine recomputes from epoch regardless */ }
  }

  // ── Public engine ───────────────────────────────────────────────────────────

  const CalendarEngine = {
    MONTHS, WEEKDAYS,
    CIVIL_DAY_REAL_MS,
    WINDOW_LABEL: '20:00 - 03:00 IST',
    EPOCH_LABEL: '01-ARD-1 (UBC0001-01-01) — 23 April 2021, 20:00:00 IST (14:30:00 UTC)',
    isLeapYear, daysInMonth, daysInYear, computeUBCDate, computeBankedMs,

    computeState() {
      const nowUtcMs = Date.now();
      const bankedMs = computeBankedMs(nowUtcMs);
      const ubc = ubcFromBankedMs(bankedMs);
      const ist = formatISTClock(nowUtcMs);
      const active = isActiveAt(toISTShifted(nowUtcMs));
      const bankedSeconds = bankedMs / 1000;

      const prev = loadStoredState();
      let drift = 0;
      if (prev && prev.active && active) {
        const expected = prev.bankedSeconds + (nowUtcMs - prev.lastTickMs) / 1000;
        drift = +(bankedSeconds - expected).toFixed(3);
      }
      const lastCalibration = (prev && prev.active === active) ? prev.lastCalibration : nowUtcMs;

      saveState({ bankedSeconds, lastTickMs: nowUtcMs, active, lastCalibration });

      return { nowUtcMs, ubc, ist, active, clock: ubc.clock, drift, lastCalibration };
    },

    init(onTick) {
      onTick(this.computeState());
      const handle = global.setInterval(() => onTick(this.computeState()), 1000);
      return () => global.clearInterval(handle);
    }
  };

  global.CalendarEngine = CalendarEngine;
})(window);
