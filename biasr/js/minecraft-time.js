// BIASR — Simulated Minecraft World Time (Government Temporal Synchronization Policy)
//
// The in-game Minecraft clock advances only during Active Temporal Flow (ATF,
// 20:00-03:00 IST) and is otherwise frozen -- it does not check whether the
// Minecraft server is actually running or whether any player is online.
// This is a gameplay-simulation layer only: it has no bearing on the ratified
// Unified Binod Calendar (see UBC Standard v1.0.1, Section II-A), which the
// CSCTS explicitly defines as independent of Minecraft's diurnal cycle.
//
// Official Minecraft time scale: 1 Minecraft day = 24000 ticks = 20 real
// minutes (1200s) => 20 ticks per real second; 1 in-game hour = 1000 ticks
// = 50 real seconds. Depends on CalendarEngine.computeBankedMs(), which sums
// all ATF-active real milliseconds since the Founding Epoch -- the same
// banked-time mechanism already used to drive the Live UBC Time clock.
(function (global) {
  'use strict';

  const TICKS_PER_DAY = 24000;
  const TICKS_PER_REAL_SECOND = 20;
  const TICKS_PER_HOUR = TICKS_PER_DAY / 24;
  const STORAGE_KEY = 'biasr_minecraft_time_v1';

  function pad2(n) { return String(n).padStart(2, '0'); }

  function phaseForTick(tick) {
    const hour = tick / TICKS_PER_HOUR;
    if (hour >= 5 && hour < 7) return 'Sunrise';
    if (hour >= 7 && hour < 17) return 'Day';
    if (hour >= 17 && hour < 19) return 'Sunset';
    return 'Night';
  }

  function computeMinecraftState(nowUtcMs) {
    const bankedMs = global.CalendarEngine.computeBankedMs(nowUtcMs);
    const totalTicks = Math.floor((bankedMs / 1000) * TICKS_PER_REAL_SECOND);

    const dayNumber = Math.floor(totalTicks / TICKS_PER_DAY) + 1;
    const tick = totalTicks % TICKS_PER_DAY;
    const hour = Math.floor(tick / TICKS_PER_HOUR);
    const minute = Math.floor(((tick % TICKS_PER_HOUR) / TICKS_PER_HOUR) * 60);
    const ticksUntilNextDay = TICKS_PER_DAY - tick;
    const secondsUntilNextDay = Math.ceil(ticksUntilNextDay / TICKS_PER_REAL_SECOND);

    // Diagnostic persistence only -- the state above is always fully
    // recomputed from the Founding Epoch, so a cleared/stale record never
    // desyncs the display; it just mirrors the last known tick for reference.
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        dayNumber, tick, lastSyncTimestamp: nowUtcMs
      }));
    } catch (_) { /* non-fatal */ }

    return {
      dayNumber,
      tick,
      time: `${pad2(hour)}:${pad2(minute)}`,
      phase: phaseForTick(tick),
      secondsUntilNextDay
    };
  }

  global.MinecraftTime = { TICKS_PER_DAY, TICKS_PER_REAL_SECOND, computeMinecraftState };
})(window);
