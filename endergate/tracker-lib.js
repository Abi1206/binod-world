// RIID bounty tracker: the pure logic, ported from the server prototype (network/src/endergate/tracker-data.ts) so it runs in the browser.
// EVERYTHING here is fictional in-universe game data: positions are SIMULATED from a seed and the clock (never real GPS, phone or IP data).
// No DOM and no network: it is used by the tracker page and by the build script.
import { distanceKm } from './geo.js';

export const AGE_BRACKETS = [
  { slug: 'minor', label: 'Under 18', min: 0, max: 17 }, { slug: '18-29', label: '18-29', min: 18, max: 29 }, { slug: '30-44', label: '30-44', min: 30, max: 44 },
  { slug: '45-59', label: '45-59', min: 45, max: 59 }, { slug: '60+', label: '60 and over', min: 60, max: 120 },
];
export const bracketOf = (age) => AGE_BRACKETS.find((b) => age >= b.min && age <= b.max)?.slug ?? '60+';
export const STATUSES = ['active', 'located', 'closed'];

// ── deterministic simulation (identical maths to the server prototype) ──
export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mix = (a, b) => { let h = Math.imul(a ^ 0x9E3779B1, 0x85EBCA6B) ^ Math.imul(b + 0x7F4A7C15, 0xC2B2AE35); h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; return h >>> 0; };
export const clampLat = (x) => Math.max(-89.9, Math.min(89.9, x));
export const wrapLon = (x) => ((((x + 180) % 360) + 360) % 360) - 180;
export const SEGMENT_MS = 10 * 60_000;
/** The furthest a simulated target roams from home, in degrees of latitude (~110 km per degree): 1 km .. ~330 km depending on `mobility`. */
export const roamDegrees = (mobility) => 0.01 + mobility * 3;
export const seedOf = (ref) => { let h = 2166136261; for (const c of String(ref)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

function waypoint(t, k) {
  const rng = mulberry32(mix(t.seed, k));
  const r = roamDegrees(t.mobility) * Math.sqrt(rng()), th = rng() * Math.PI * 2;
  const lat = clampLat(t.home.lat + r * Math.sin(th));
  const lonScale = Math.max(Math.cos((t.home.lat * Math.PI) / 180), 0.2);
  return { lat, lon: wrapLon(t.home.lon + (r * Math.cos(th)) / lonScale) };
}
/** Where the target is at `nowMs`: a smooth, deterministic wander around home. Pure function of its inputs. (Field reports need a server and are not part of the static edition.) */
export function liveFor(t, nowMs) {
  const k = Math.floor(nowMs / SEGMENT_MS), f = (nowMs - k * SEGMENT_MS) / SEGMENT_MS, s = f * f * (3 - 2 * f);
  const a = waypoint(t, k), b = waypoint(t, k + 1);
  let dLon = b.lon - a.lon; if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360;
  return { lat: clampLat(a.lat + (b.lat - a.lat) * s), lon: wrapLon(a.lon + dLon * s), at: new Date(nowMs).toISOString(), source: 'simulated' };
}
/** The last hour of simulated positions, every 5 minutes (for the trail on the map). */
export const trailFor = (t, nowMs) => Array.from({ length: 13 }, (_, i) => { const p = liveFor(t, nowMs - (12 - i) * 5 * 60_000); return { lat: p.lat, lon: p.lon }; });

// ── the data the page works with ──
/** Raw records from the vault -> records with a numeric id, in a stable order. Invalid records are rejected, not guessed at. */
export function prepareTargets(data) {
  const rows = Array.isArray(data?.targets) ? data.targets : [];
  return rows.map((t, i) => {
    const ok = t && typeof t.ref === 'string' && typeof t.name === 'string' && Number.isFinite(t.age) && t.home && Number.isFinite(t.home.lat) && Number.isFinite(t.home.lon);
    if (!ok) throw new Error(`tracker record ${i + 1} is malformed`);
    return { id: i + 1, ref: t.ref, name: t.name, age: t.age, category: String(t.category ?? 'unknown'), status: STATUSES.includes(t.status) ? t.status : 'active', threat: Number(t.threat ?? 1), bounty: Number(t.bounty ?? 0),
      home: { lat: t.home.lat, lon: t.home.lon, label: String(t.home.label ?? '') }, mobility: Number(t.mobility ?? 0.5), seed: Number.isInteger(t.seed) ? t.seed : seedOf(t.ref), placeholder: !!t.placeholder, notes: String(t.notes ?? ''), owner: String(t.owner ?? 'RIID') };
  });
}
export function dto(t, now, detail = false) {
  const live = liveFor(t, now);
  return { id: t.id, ref: t.ref, name: t.name, age: t.age, bracket: bracketOf(t.age), category: t.category, status: t.status, threat: t.threat, bounty: t.bounty, owner: t.owner,
    placeholder: t.placeholder, home: t.home, live, away_km: Math.round(distanceKm(t.home.lat, t.home.lon, live.lat, live.lon) * 10) / 10,
    ...(detail ? { notes: t.notes, trail: trailFor(t, now) } : {}) };
}
export function summarize(targets) {
  const categories = {};
  for (const t of targets) categories[t.category] = (categories[t.category] ?? 0) + 1;
  return { total: targets.length, placeholders: targets.filter((t) => t.placeholder).length, categories,
    brackets: AGE_BRACKETS.map((b) => ({ slug: b.slug, label: b.label, n: targets.filter((t) => t.age >= b.min && t.age <= b.max).length })) };
}
/** Same filters and the same order as the server prototype: threat, then bounty, then id. */
export function filterTargets(targets, f = {}) {
  const q = String(f.q ?? '').trim().toLowerCase(), amin = f.age_min ?? 0, amax = f.age_max ?? 120;
  return targets.filter((t) => t.age >= amin && t.age <= amax && (!f.category || t.category === f.category) && (!f.status || t.status === f.status)
    && (!q || t.name.toLowerCase().includes(q) || t.ref.toLowerCase().includes(q) || t.home.label.toLowerCase().includes(q)))
    .sort((a, b) => b.threat - a.threat || b.bounty - a.bounty || a.id - b.id).slice(0, f.limit ?? 500);
}
