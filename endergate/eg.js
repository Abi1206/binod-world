// ENDERGATE shared shell: per-layer chrome, boot sequence, guards. Every guard here is a UX nicety only;
// the server independently enforces access on every request.
import { api, el, token, ApiError } from './static-api.js';

export const PAGES = { gate: './', index: 'the-index.html', exchange: 'the-exchange.html', markets: 'the-markets.html', end: 'the-end.html' };
const GLYPH = { gate: '◎', index: '⌖', exchange: '⌁', markets: '⛁', end: '◉' };

export const $ = (s, r = document) => r.querySelector(s);
export const main = () => document.getElementById('main');
export const note = (text, cls = '') => el('p', { class: `note ${cls}`, role: 'status' }, text);
export const field = (label, input) => el('label', {}, label, input);
export const fmt = (iso) => (iso ? new Date(iso).toLocaleString() : '');

function chrome(layer, me, layers) {
  const open = layers.filter((l) => !l.locked), locked = layers.length - open.length;
  const nav = el('nav', { class: 'layers', 'aria-label': 'Network layers' },
    ...open.map((l) => el('a', { class: 'layer', href: PAGES[l.slug], 'aria-current': l.slug === layer ? 'page' : false }, `${GLYPH[l.slug]} ${l.name}`)),
    locked ? el('span', { class: 'layer locked', title: 'Layers you cannot reach' }, `▒ ${locked} unknown signal${locked > 1 ? 's' : ''}`) : null);
  const who = me
    ? el('span', { class: 'who' }, `${me.account.handle} · level ${me.account.clearance}`, ' ',
        el('button', { type: 'button', class: 'link', onclick: async () => { try { await api('/auth/logout', { method: 'POST' }); } catch { /* already invalid */ } token.clear(); location.href = './'; } }, 'disconnect'))
    : el('span', { class: 'who' }, 'not connected');
  const bar = (el('header', { class: 'bar' }, el('span', { class: 'prompt', 'aria-hidden': 'true' }, `endergate://${layer}`), nav, who));
  const skip = document.querySelector('.skip');
  skip ? skip.after(bar) : document.body.prepend(bar);
}

function panel(title, msg, link) {
  main().replaceChildren(el('section', { class: 'denied', role: 'alert' }, el('h1', {}, title), el('p', {}, msg), link ?? el('p', {}, el('a', { href: './' }, '← return to the Gate'))));
  main().focus();
}
const denied = (msg = 'Your access does not reach this layer.') => panel('▒▒ no route ▒▒', msg);

// A 401 mid-session (expired, idle, revoked, password changed) ends the session visibly instead of failing silently.
let expiredShown = false;
document.addEventListener('bwn:expired', () => {
  if (expiredShown) return; expiredShown = true;
  panel('Session ended', 'You were signed out (it expired, went idle, or was revoked). Reconnect at the Gate to continue.', el('p', {}, el('a', { href: './' }, 'Reconnect →')));
});

async function bootSequence(layer, info) {
  const seen = (() => { try { return sessionStorage.getItem(`eg_boot_${layer}`); } catch { return '1'; } })();
  if (seen || matchMedia('(prefers-reduced-motion: reduce)').matches || layer === 'gate') return;
  try { sessionStorage.setItem(`eg_boot_${layer}`, '1'); } catch { /* ignore */ }
  const lines = [`> routing through ${info.name.toLowerCase()}…`, '> handshake .......... ok', `> "${info.tagline}"`];
  const pre = el('pre', { class: 'boot', 'aria-hidden': 'true' });
  main().replaceChildren(pre);
  for (const l of lines) { pre.textContent += l + '\n'; await new Promise((r) => setTimeout(r, 260)); }
  await new Promise((r) => setTimeout(r, 200));
  pre.remove();
}

/** Boots a layer page. `render({ me, layers })` fills <main>. */
export async function boot(layer, render) {
  document.body.dataset.layer = layer;
  let me = null;
  if (token.get()) { try { me = await api('/auth/me'); } catch { /* expired */ } } // no token => no pointless 401
  let layers = [];
  try { layers = (await api('/endergate/layers')).layers; } catch (e) { main().replaceChildren(note(e.message, 'err')); return; }
  chrome(layer, me, layers);
  if (layer !== 'gate') {
    if (!me || me.account.mfa_enrollment_required) { location.replace('./'); return; }
    const info = layers.find((l) => l.slug === layer);
    if (!info) return denied();
    await bootSequence(layer, info);
    main().replaceChildren();
  }
  try { await render({ me, layers }); }
  catch (e) { if (e instanceof ApiError && e.status === 403) denied(); else if (!(e instanceof ApiError && e.status === 401)) main().replaceChildren(note(e.message, 'err')); }
}

/** Run an action, surfacing errors in a status element. */
export async function act(statusEl, fn) {
  statusEl.textContent = ''; statusEl.classList.remove('err');
  try { return await fn(); } catch (e) { statusEl.textContent = e.message; statusEl.classList.add('err'); return undefined; }
}

/** ENDERGATE search: finds services this account may enter. Hidden classified portals appear only on their exact name. The server decides what is returned. */
export function serviceSearch() {
  const out = el('ul', { class: 'plain', 'aria-live': 'polite' });
  const st = el('p', { class: 'note', role: 'status' });
  const q = el('input', { type: 'search', name: 'q', maxlength: 60, placeholder: 'search the network', 'aria-label': 'Search ENDERGATE services' });
  const form = el('form', { role: 'search', onsubmit: async (e) => {
    e.preventDefault(); out.replaceChildren(); st.textContent = '';
    const term = q.value.trim();
    if (term.length < 2) { st.textContent = 'Type at least two characters.'; return; }
    try {
      const { results } = await api(`/endergate/search?q=${encodeURIComponent(term)}`);
      if (!results.length) { st.textContent = 'No signal.'; return; }
      out.append(...results.map((r) => el('li', {}, /^[a-z0-9-]+\.html$/.test(r.href ?? '') ? el('a', { href: r.href }, r.name) : el('strong', {}, r.name), ' — ', r.description)));
    } catch (err) { st.textContent = err.message; }
  } }, q, ' ', el('button', {}, 'Search'));
  return el('section', { class: 'panel' }, el('h2', {}, 'Search ENDERGATE'), form, st, out);
}
