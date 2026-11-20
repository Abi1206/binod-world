// ENDERGATE static edition: a tiny in-browser replacement for the old server API. The pages keep calling api('/auth/login') and so on;
// everything is answered locally from the encrypted vault (see vault.js). No server, no database, no network request except one static file.
// Sessions live in sessionStorage (this tab only) and are bound to each other: a RIID session belongs to the ENDERGATE session that opened it.
import { el } from './dom.js';
import { unlock, loadRecords, layerAccess, findPortals, LAYERS, AVAILABLE_LAYERS, PORTALS, canReadTier, tierLabel, docLabel, isTier } from './vault.js';
export { el, highlight } from './dom.js';

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const EG_KEY = 'bwn_static_session';
const IDLE_MS = 30 * 60_000, ABSOLUTE_MS = 8 * 3600_000;
const store = {
  get(k) { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: the session lasts for this page only */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};
const clsKey = (system) => `bwn_static_cls_${system}`;

let vaultPromise;
const vault = () => (vaultPromise ??= fetch(new URL('data/vault.json', document.baseURI)).then((r) => { if (!r.ok) throw new ApiError(0, 'network', 'The access data could not be loaded.'); return r.json(); }));

function egSession() {
  const s = store.get(EG_KEY);
  if (!s) return null;
  const now = Date.now();
  if (now - s.created > ABSOLUTE_MS || now - s.last > IDLE_MS) { endAll(); return null; }
  s.last = now; store.set(EG_KEY, s);
  return s;
}
function endAll() { store.del(EG_KEY); for (const p of PORTALS) store.del(clsKey(p.system)); }

export const token = {
  get: () => (egSession() ? 'static' : null),
  set: () => {},
  clear: endAll,
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unauth = () => new ApiError(401, 'unauthenticated', 'authentication required');
const notFound = () => new ApiError(404, 'not_found', 'not found');

export async function api(path, { method = 'GET', body } = {}) {
  const [p, qs] = path.split('?');
  const q = new URLSearchParams(qs ?? '');

  if (p === '/auth/login' && method === 'POST') {
    const v = await vault();
    const prof = await unlock(v, 'endergate', String(body?.handle ?? ''), String(body?.password ?? ''));
    if (!prof) { await wait(500); throw new ApiError(401, 'invalid_credentials', 'invalid handle, password or code'); }
    const now = Date.now();
    store.set(EG_KEY, { handle: prof.u, level: prof.level, perms: prof.perms, created: now, last: now });
    return { token: 'static', account: { handle: prof.u, level: prof.level } };
  }

  const s = egSession();

  if (p === '/auth/logout') { endAll(); return { ok: true }; }
  if (p === '/auth/me') {
    if (!s) throw unauth();
    return { account: { handle: s.handle, role: 'member', clearance: s.level, mfa: false, mfa_enrollment_required: false }, identities: [{ alias: s.handle }] };
  }
  if (p === '/endergate/layers') {
    return { authenticated: !!s, layers: LAYERS.map((l) => (l.slug === 'gate' || (s && layerAccess(s, l.slug))
      ? { ord: l.ord, slug: l.slug, name: l.name, tagline: l.tagline, locked: false } : { ord: l.ord, locked: true, name: 'Unknown signal' })) };
  }
  if (p === '/endergate/search') {
    if (!s) throw unauth();
    return { results: findPortals(s, q.get('q') ?? '').map((x) => ({ slug: x.slug, name: x.name, description: x.description, layer: x.layer, href: x.href })) };
  }
  throw notFound();
}

// ── Classified systems (RIID, Government Top Secret): a second, separate login ─────────────────────────────────
const records = new Map(); // decrypted records live in memory only, never in storage

function portal(system) { return PORTALS.find((x) => x.system === system); }
/** The classified system exists AND this ENDERGATE session may enter its layer; otherwise an opaque "not found". */
function gateway(system) {
  const s = egSession(); const pt = portal(system);
  if (!s) throw unauth();
  if (!pt || !layerAccess(s, pt.layer)) throw notFound();
  return { s, pt };
}
function clsSession(system) {
  const { s } = gateway(system);
  const c = store.get(clsKey(system));
  const fail = () => { store.del(clsKey(system)); records.delete(system); document.dispatchEvent(new CustomEvent('cls:expired')); return new ApiError(401, 'cls_unauthenticated', 'classified authentication required'); };
  if (!c || c.endergate !== s.handle || Date.now() - c.last > IDLE_MS) throw fail();
  c.last = Date.now(); store.set(clsKey(system), c);
  return c;
}
async function readable(system, c) {
  if (!records.has(system)) records.set(system, await loadRecords(await vault(), system, c.keys));
  return records.get(system);
}
const meta = (r) => ({ ref: r.ref, title: r.title, tier: r.tier, classification: docLabel(r.tier), tags: r.tags });

export async function cls(system, path, { method = 'GET', body } = {}) {
  const [p, qs] = path.split('?');
  const q = new URLSearchParams(qs ?? '');
  const { s, pt } = gateway(system);

  if (p === '/info') return { system, name: pt.title, tagline: pt.tagline };

  if (p === '/login' && method === 'POST') {
    const prof = await unlock(await vault(), system, String(body?.username ?? ''), String(body?.password ?? ''));
    if (!prof || !isTier(prof.tier)) { await wait(500); throw new ApiError(401, 'invalid_credentials', 'invalid username or password'); }
    records.delete(system);
    const now = Date.now();
    store.set(clsKey(system), { endergate: s.handle, username: prof.u, tier: prof.tier, title: prof.title ?? '', keys: prof.keys, created: now, last: now });
    return { username: prof.u, role_title: prof.title ?? '', tier: prof.tier, clearance: tierLabel(prof.tier, pt.short) };
  }
  if (p === '/logout') { store.del(clsKey(system)); records.delete(system); return { ok: true }; }

  const c = clsSession(system);
  if (p === '/session') return { system, username: c.username, role_title: c.title, tier: c.tier, clearance: tierLabel(c.tier, pt.short) };
  const all = await readable(system, c);
  if (p === '/documents') return { documents: all.map(meta) };
  if (p === '/search') {
    const term = (q.get('q') ?? '').replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 40).toLowerCase();
    // titles, tags and reference numbers of records this session can decrypt; the body text is never searched
    const results = term.length < 2 ? [] : all.filter((r) => `${r.title}\n${r.ref}\n${r.tags.join(' ')}`.toLowerCase().includes(term)).map(meta);
    return { results };
  }
  const m = /^\/documents\/(.+)$/.exec(p);
  if (m) {
    const r = all.find((x) => x.ref === decodeURIComponent(m[1]) && canReadTier(c.tier, x.tier));
    if (!r) throw notFound();   // same answer for "does not exist" and "above your clearance"
    return { ...meta(r), content: r.content };
  }
  throw notFound();
}
export { AVAILABLE_LAYERS };
