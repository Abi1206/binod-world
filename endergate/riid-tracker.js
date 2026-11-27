// The End: RIID bounty tracker (static edition). Everything shown is fictional in-universe data; positions are SIMULATED in the browser from a seed and the clock.
// Access: an ENDERGATE session that may enter The End, plus a RIID classified session whose clearance holds the tracker record (Level 3 or Full Clearance).
// The record is encrypted in the vault under the Level 3 key, so lower clearances cannot read it even from a downloaded copy of the files.
import { el, cls } from './static-api.js';
import { formatCoord } from './geo.js';
import { boot, main, note, fmt } from './eg.js';
import { createMap, SHAPE } from './tracker-map.js';
import { prepareTargets, summarize, filterTargets, dto, liveFor } from './tracker-lib.js';

const LIVE_MS = 10_000;
const BNC = (n) => `${Number(n).toLocaleString('en-US')} BNC`;
const SHAPE_GLYPH = { triangle: '▲', circle: '●', square: '■', diamond: '◆', plus: '✚' };
const denied = (text, link) => el('section', { class: 'denied', role: 'alert' }, el('h1', {}, '▒▒ no route ▒▒'), el('p', {}, text), el('p', {}, link ?? el('a', { href: 'the-end.html' }, '← The End')));

boot('end', async () => {
  const root = main();
  let data;
  try { await cls('riid', '/session'); }
  catch { root.replaceChildren(denied('The RIID classified session has not been opened. Open RIID Classified Access from The End and sign in first.', el('a', { href: 'riid.html' }, '→ RIID Classified Access'))); return; }
  try { data = await cls('riid', '/tracker'); }
  catch { root.replaceChildren(denied('Nothing is reachable here with your clearance.')); return; }

  const all = prepareTargets(data), summary = summarize(all);
  let targets = [], selected = null, detail = null, timer = 0, filterTimer = 0;
  const status = el('p', { class: 'dim', role: 'status', 'aria-live': 'polite' });
  const count = el('p', { class: 'trk-count', role: 'status', 'aria-live': 'polite' });
  const list = el('ul', { class: 'trk-list', 'aria-label': 'Targets' });
  const dossier = el('section', { class: 'trk-dossier', 'aria-labelledby': 'trk-dh' });
  const canvas = el('canvas', { id: 'trk-canvas', tabindex: '0', role: 'application', 'aria-label': 'Interactive world map of simulated target positions. Arrow keys pan, plus and minus zoom, zero resets. The target list is the accessible alternative.' });
  const view = el('span', { class: 'dim', role: 'status' });
  const map = createMap(canvas, { onSelect: (id) => choose(id, true), onView: (v) => { view.textContent = `${v.mode === 'globe' ? 'globe' : 'flat'} · zoom ${v.zoom}×`; } });

  // ---- filters ----
  const q = el('input', { id: 'f-q', type: 'search', maxlength: '60', autocomplete: 'off', placeholder: 'name, ref or city' });
  const amin = el('input', { id: 'f-amin', type: 'number', min: '0', max: '120', inputmode: 'numeric' });
  const amax = el('input', { id: 'f-amax', type: 'number', min: '0', max: '120', inputmode: 'numeric' });
  const cat = el('select', { id: 'f-cat' }, el('option', { value: '' }, 'any'), ...Object.keys(summary.categories).sort().map((c) => el('option', { value: c }, c)));
  const stat = el('select', { id: 'f-stat' }, el('option', { value: '' }, 'any'), ...['active', 'located', 'closed'].map((s) => el('option', { value: s }, s)));
  const AGE = { minor: [0, 17], '18-29': [18, 29], '30-44': [30, 44], '45-59': [45, 59], '60+': [60, 120] };
  const bracketBtns = summary.brackets.map((b) => el('button', { type: 'button', class: 'link', onclick: () => { [amin.value, amax.value] = AGE[b.slug]; refresh(); } }, `${b.label} (${b.n})`));
  const field = (id, label, input, c = '') => el('div', { class: c }, el('label', { for: id }, label), input);
  const filters = el('form', { class: 'trk-filters', role: 'search', 'aria-label': 'Filter targets', onsubmit: (e) => { e.preventDefault(); refresh(); } },
    field('f-q', 'Search', q, 'wide'), field('f-amin', 'Age from', amin), field('f-amax', 'Age to', amax), field('f-cat', 'Category', cat), field('f-stat', 'Status', stat),
    el('p', { class: 'wide dim' }, 'Age groups: ', ...bracketBtns.flatMap((b) => [b, ' · ']).slice(0, -1)));
  for (const i of [q, amin, amax]) i.addEventListener('input', () => { clearTimeout(filterTimer); filterTimer = setTimeout(refresh, 250); });
  for (const i of [cat, stat]) i.addEventListener('change', refresh);

  // ---- map toolbar ----
  const btn = (label, fn, extra = {}) => el('button', { type: 'button', onclick: fn, ...extra }, label);
  const flat = btn('Flat map', () => setMode('flat'), { 'aria-pressed': 'true' }), globe = btn('Globe', () => setMode('globe'), { 'aria-pressed': 'false' });
  const setMode = (m) => { map.setMode(m); flat.setAttribute('aria-pressed', String(m === 'flat')); globe.setAttribute('aria-pressed', String(m === 'globe')); };
  const toggle = (id, label, key, on) => { const c = el('input', { id, type: 'checkbox', checked: on }); c.addEventListener('change', () => map.setOptions({ [key]: c.checked })); return el('label', { for: id }, c, label); };
  const tools = el('div', { class: 'trk-tools', role: 'group', 'aria-label': 'Map controls' }, flat, globe,
    btn('+', () => map.zoomBy(1.5), { 'aria-label': 'Zoom in' }), btn('−', () => map.zoomBy(1 / 1.5), { 'aria-label': 'Zoom out' }), btn('Reset', () => map.reset(), { 'aria-label': 'Reset view' }),
    toggle('o-home', 'Home locations', 'homes', true), toggle('o-trail', 'Last-hour trail', 'trail', true), view);
  const legend = el('ul', { class: 'trk-legend', 'aria-label': 'Map legend' },
    ...summary.brackets.map((b) => el('li', {}, `${SHAPE_GLYPH[SHAPE[b.slug]]} ${b.label}`)),
    el('li', {}, '○ home'), el('li', {}, 'colour: active / located / closed'));

  // ---- list ----
  function paintList() {
    count.textContent = `${targets.length} of ${summary.total} targets shown`;
    list.replaceChildren(...targets.map((t) => el('li', {}, el('button', { type: 'button', 'data-id': String(t.id), 'aria-pressed': String(t.id === selected), onclick: () => choose(t.id, true) },
      el('strong', {}, `${t.name}, ${t.age}`), el('span', { class: 'sub' }, `${t.ref} · ${t.category} · ${t.status} · threat ${t.threat} · ${BNC(t.bounty)}`), el('span', { class: 'sub' }, `home: ${t.home.label || formatCoord(t.home.lat, t.home.lon)}`)))));
  }
  function refresh() {
    const f = { q: q.value, category: cat.value, status: stat.value, limit: 500 };
    if (amin.value !== '') f.age_min = Number(amin.value);
    if (amax.value !== '') f.age_max = Number(amax.value);
    if ((f.age_min ?? 0) > (f.age_max ?? 120)) { status.textContent = 'Age from must not exceed age to.'; status.classList.add('err'); return; }
    status.textContent = ''; status.classList.remove('err');
    const now = Date.now();
    targets = filterTargets(all, f).map((t) => dto(t, now));
    paintList(); map.setTargets(targets);
    map.setLive(targets.filter((t) => t.status !== 'closed').map((t) => ({ id: t.id, lat: t.live.lat, lon: t.live.lon, source: t.live.source })));
  }

  // ---- dossier ----
  function paintDossier() {
    const t = detail;
    if (!t) { dossier.replaceChildren(el('h2', { id: 'trk-dh' }, 'Dossier'), note('Select a target on the map or in the list.')); return; }
    const l = t.live, row = (k, v) => [el('dt', {}, k), el('dd', {}, v)];
    dossier.replaceChildren(el('h2', { id: 'trk-dh' }, `${t.name}, ${t.age}`),
      el('p', { class: 'dim' }, `${t.ref} · ${t.owner} list`, t.placeholder ? el('span', { class: 'tagpill' }, 'placeholder') : null, el('span', { class: 'tagpill' }, 'fictional')),
      el('dl', {}, ...row('Age group', t.bracket), ...row('Category', t.category), ...row('Status', t.status), ...row('Threat', `${t.threat} / 5`), ...row('Bounty', BNC(t.bounty)),
        ...row('Home', `${t.home.label ? t.home.label + ' · ' : ''}${formatCoord(t.home.lat, t.home.lon)}`), ...row('Live position', formatCoord(l.lat, l.lon)), ...row('Source', 'simulated'),
        ...row('Away from home', `${t.away_km.toLocaleString('en-US')} km`)),
      t.notes ? el('p', {}, t.notes) : null,
      el('p', {}, btn('Show on map', () => map.focusOn(l.lat, l.lon))));
  }
  function choose(id, focus) {
    const t = all.find((x) => x.id === id); if (!t) return;
    selected = id; map.select(id);
    for (const b of list.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.id === String(id)));
    detail = dto(t, Date.now(), true);
    map.setTrail(id, detail.trail); paintDossier();
    if (focus) map.focusOn(detail.live.lat, detail.live.lon, Math.max(map.getView().zoom, 3));
    status.textContent = `Selected ${detail.name}.`;
  }
  function tick() {
    if (document.hidden) return;
    const now = Date.now();
    map.setLive(all.filter((t) => t.status !== 'closed').map((t) => { const l = liveFor(t, now); return { id: t.id, lat: l.lat, lon: l.lon, source: l.source }; }));
    if (detail) { const t = all.find((x) => x.id === detail.id); if (t) { detail = dto(t, now, true); paintDossier(); } }
  }

  root.replaceChildren(
    el('h1', {}, 'RIID Bounty Tracker'),
    el('p', { class: 'trk-banner', role: 'note' }, el('strong', {}, 'FICTIONAL IN-UNIVERSE DATA. '), 'Every person here is a character of the Binod World game. Positions are simulated (they are not real locations, phones, or devices). ',
      summary.placeholders ? `${summary.placeholders} of ${summary.total} entries are placeholders awaiting real in-world records.` : ''),
    el('p', { class: 'dim' }, el('a', { href: 'riid.html' }, '← RIID Classified Access'), ' · ', el('a', { href: 'the-end.html' }, 'The End')),
    status,
    el('div', { class: 'trk-grid' },
      el('section', { class: 'trk-side', 'aria-label': 'Target list' }, el('h2', {}, 'Targets'), filters, count, list),
      el('section', { class: 'trk-mapwrap', 'aria-label': 'World map' }, tools, canvas, legend),
      dossier));
  paintDossier();
  map.setOptions({});
  refresh();
  timer = setInterval(tick, LIVE_MS);
  addEventListener('pagehide', () => { clearInterval(timer); map.destroy(); });
});
