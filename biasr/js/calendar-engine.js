// BIASR — Unified Binod Calendar (UBC) Engine
// Implements UBC Standard v1.0.0 (calendar structure + Gregorian-to-UBC conversion)
// plus the Active Temporal Flow (ATF) gameplay-synchronization policy.
// Vanilla JS, no dependencies. Safe for GitHub Pages (static hosting only).

(function (global) {
  'use strict';

  // ── UBC Standard v1.0.0 constants ─────────────────────────────────────────

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  // India Standard Time has a fixed +5:30 offset and no DST, so it can be
  // modeled as a constant rather than relying on Intl/visitor timezone data.
  const IST_OFFSET_MS = 5.5 * HOUR;

  // Founding Epoch — UBC Year 1, Month 1 (Astrion), Day 1, Solden.
  // Chosen as 2026-01-01T00:00:00 IST, matching BIASR's founding year.
  // Note: this instant falls inside the prior night's ATF window (20:00-03:00),
  // so banking begins immediately; only the remaining overlap after the epoch
  // is ever counted (computeBankedMs always clips to [EPOCH, now]).
  const EPOCH_UTC_MS = Date.UTC(2026, 0, 1, 0, 0, 0) - IST_OFFSET_MS;

  // Official gameplay window (Active Temporal Flow): 20:00 IST -> 03:00 IST next day.
  const WINDOW_START_HOUR = 20;
  const WINDOW_LENGTH_MS = 7 * HOUR; // 20:00 -> 03:00 = 7 hours

  const MONTH_NAMES = [
    'Astrion', 'Solivar', 'Lunexis', 'Orbitum', 'Celestior', 'Netherion',
    'Endarion', 'Temporis', 'Aetherum', 'Cryonis', 'Voidmere', 'Finaurora'
  ];
  const WEEKDAY_NAMES = ['Solden', 'Lunar', 'Terrid', 'Aquyn', 'Ignara', 'Aetherin', 'Umbros'];

  const DAYS_PER_MONTH = 30;
  const MONTHS_PER_YEAR = 12;
  const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 360

  const STORAGE_KEY = 'biasr_ubc_state_v1';

  // ── Time helpers ───────────────────────────────────────────────────────────

  // Shifts a UTC epoch-ms timestamp so that plain Math on it reads like IST
  // wall-clock time, without touching the visitor's local timezone at all.
  function toISTShifted(utcMs) {
    return utcMs + IST_OFFSET_MS;
  }

  // The ATF window "belonging" to IST calendar day D runs from
  // [D*DAY + 20:00, D*DAY + 20:00 + 7h) in shifted-ms space.
  function windowForDay(dayIndex) {
    const start = dayIndex * DAY + WINDOW_START_HOUR * HOUR;
    return [start, start + WINDOW_LENGTH_MS];
  }

  function isActiveAt(shiftedMs) {
    const day = Math.floor(shiftedMs / DAY);
    // A window can span midnight, so check both the day it starts on
    // and the previous day's window (which may still be running).
    for (const d of [day - 1, day]) {
      const [start, end] = windowForDay(d);
      if (shiftedMs >= start && shiftedMs < end) return true;
    }
    return false;
  }

  // Sums all ATF-active milliseconds between the Founding Epoch and `nowUtcMs`.
  // Iterating one day at a time is simple, exact, and fast (a few thousand
  // iterations even decades out) — no closed-form shortcut is worth the
  // added complexity here.
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

  // Splits total banked (UBC civil) time into the UBC calendar structure:
  // 30-day months, 12-month years, 7-day weeks — per UBC Standard v1.0.0.
  function computeCalendar(bankedMs) {
    const bankedSeconds = Math.floor(bankedMs / SECOND);
    const totalDays = Math.floor(bankedSeconds / 86400);
    const secOfDay = bankedSeconds - totalDays * 86400;

    const hh = Math.floor(secOfDay / 3600);
    const mm = Math.floor((secOfDay % 3600) / 60);
    const ss = secOfDay % 60;

    const year = Math.floor(totalDays / DAYS_PER_YEAR) + 1;
    const dayOfYear = totalDays % DAYS_PER_YEAR;
    const monthIndex = Math.floor(dayOfYear / DAYS_PER_MONTH);
    const dayOfMonth = (dayOfYear % DAYS_PER_MONTH) + 1;
    const weekdayIndex = totalDays % 7;

    return {
      totalDays, year,
      month: monthIndex + 1, monthName: MONTH_NAMES[monthIndex],
      day: dayOfMonth,
      weekdayIndex, weekdayName: WEEKDAY_NAMES[weekdayIndex],
      hh, mm, ss
    };
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

  // ── Persistence (localStorage) ─────────────────────────────────────────────

  function loadStoredState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null; // localStorage unavailable (privacy mode, etc.) — engine still works
    }
  }

  function saveState(record) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (_) { /* non-fatal: engine recomputes from epoch regardless */ }
  }

  // ── Public engine ───────────────────────────────────────────────────────────

  const CalendarEngine = {
    MONTH_NAMES, WEEKDAY_NAMES,
    WINDOW_LABEL: '20:00 - 03:00 IST',
    EPOCH_LABEL: '01 Astrion, Year 1 UBC (2026-01-01 00:00:00 IST)',

    // Computes a full, self-contained state snapshot for "now". The banked
    // time is always recomputed analytically from the Founding Epoch rather
    // than accumulated tick-by-tick, so the result is exact even after the
    // tab was closed, throttled in the background, or the device slept —
    // there is nothing to drift.
    computeState() {
      const nowUtcMs = Date.now();
      const bankedMs = computeBankedMs(nowUtcMs);
      const active = isActiveAt(toISTShifted(nowUtcMs));
      const ubc = computeCalendar(bankedMs);
      const ist = formatISTClock(nowUtcMs);

      const elapsedRealSeconds = Math.max(0, (nowUtcMs - EPOCH_UTC_MS) / 1000);
      const bankedSeconds = bankedMs / 1000;
      const tsi = elapsedRealSeconds > 0 ? bankedSeconds / elapsedRealSeconds : 0;

      const prev = loadStoredState();
      let drift = 0;
      if (prev && prev.active && active) {
        const expected = prev.bankedSeconds + (nowUtcMs - prev.lastTickMs) / 1000;
        drift = +(bankedSeconds - expected).toFixed(3);
      }

      const lastCalibration = (prev && prev.active === active) ? prev.lastCalibration : nowUtcMs;

      const state = {
        nowUtcMs, active, ubc, ist,
        bankedSeconds, tsi, drift,
        elapsedRealDays: Math.floor(elapsedRealSeconds / 86400),
        lastCalibration
      };

      saveState({ bankedSeconds, lastTickMs: nowUtcMs, active, lastCalibration });
      return state;
    },

    // Starts the live dashboard: calls onTick(state) immediately, then every
    // second. Returns a stop() function.
    init(onTick) {
      onTick(this.computeState());
      const handle = global.setInterval(() => onTick(this.computeState()), 1000);
      return () => global.clearInterval(handle);
    }
  };

  global.CalendarEngine = CalendarEngine;
})(window);
