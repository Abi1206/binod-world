// VANTA search UI, shared by the server-backed page (web/vanta) and the static GitHub Pages page (static/vanta).
// The only thing that differs is WHERE results come from: the caller passes `search(params)` and `suggest(q)`.
//   search(URLSearchParams) -> Promise<{ total, page, per_page, took_ms, results[], facets }>   (rejects with Error{status?})
//   suggest(string)         -> Promise<string[]>
import { el, highlight } from './dom.js';

const SOURCE_NAMES = { gov: 'Government', biasr: 'BIASR', riid: 'RIID', registry: 'Directory', directory: 'Directory' };

export function mountVanta({ search, suggest, perPage = 10, errorText = (e) => `Search unavailable: ${e.message}` }) {
  const $ = (id) => document.getElementById(id);
  const state = { q: '', source: new Set(), kind: new Set(), page: 1 };

  // ── URL <-> state (shareable searches) ──────────────────────────────────────────────────────
  function readUrl() {
    const p = new URLSearchParams(location.search);
    state.q = p.get('q') ?? '';
    state.source = new Set((p.get('source') ?? '').split(',').filter(Boolean));
    state.kind = new Set((p.get('kind') ?? '').split(',').filter(Boolean));
    state.page = Math.max(1, Number(p.get('page')) || 1);
    $('q').value = state.q;
  }
  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.source.size) p.set('source', [...state.source].join(','));
    if (state.kind.size) p.set('kind', [...state.kind].join(','));
    if (state.page > 1) p.set('page', state.page);
    history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
  }

  // ── Search ──────────────────────────────────────────────────────────────────────────────────
  let seq = 0;
  async function run() {
    const hasQuery = state.q.trim() || state.source.size || state.kind.size;
    $('hero').classList.toggle('compact', !!hasQuery);
    writeUrl();
    if (!hasQuery) { $('results').replaceChildren(); $('meta').textContent = ''; $('filters').hidden = true; $('pager').hidden = true; return; }
    const mine = ++seq;
    const p = new URLSearchParams({ page: state.page, per_page: perPage });
    if (state.q.trim()) p.set('q', state.q.trim());
    if (state.source.size) p.set('source', [...state.source].join(','));
    if (state.kind.size) p.set('kind', [...state.kind].join(','));
    $('meta').textContent = 'Searching'; $('meta').classList.add('busy'); $('results').setAttribute('aria-busy', 'true');
    try {
      const d = await search(p);
      if (mine !== seq) return; // a newer search superseded this one
      render(d);
    } catch (e) {
      if (mine !== seq) return;
      $('results').replaceChildren();
      $('meta').classList.remove('busy'); $('results').removeAttribute('aria-busy');
      $('meta').textContent = errorText(e);
    }
  }

  function render(d) {
    $('meta').classList.remove('busy'); $('results').removeAttribute('aria-busy');
    $('meta').textContent = d.total ? `${d.total.toLocaleString()} result${d.total === 1 ? '' : 's'} · ${d.took_ms} ms` : '';
    const list = $('results');
    list.replaceChildren();
    if (!d.total) list.append(el('li', { class: 'empty' }, el('strong', {}, 'NO MATCH'), `No results for “${state.q}”. Try fewer or different words, or clear the filters.`));
    for (const r of d.results) {
      list.append(el('li', { class: 'result' },
        el('div', { class: 'src' }, el('span', { class: 'badge' }, r.source_label), el('span', {}, r.kind.replace('_', ' ')), r.published_at && el('span', {}, r.published_at)),
        el('h2', {}, el('a', { href: r.url, rel: 'noopener' }, r.title)),
        el('div', { class: 'url' }, r.url),
        el('p', {}, highlight(r.snippet)),
      ));
    }
    renderFilters(d.facets);
    renderPager(d);
  }

  function renderFilters(f) {
    const box = $('filters');
    const chips = [];
    for (const [k, n] of Object.entries(f.source)) chips.push(chip('source', k, SOURCE_NAMES[k] ?? k, n));
    for (const [k, n] of Object.entries(f.kind)) chips.push(chip('kind', k, k.replace('_', ' '), n));
    box.replaceChildren(...chips);
    box.hidden = chips.length === 0;
  }
  function chip(group, key, label, n) {
    const on = state[group].has(key);
    return el('button', { type: 'button', class: 'chip', 'aria-pressed': String(on), onclick: () => { on ? state[group].delete(key) : state[group].add(key); state.page = 1; run(); } },
      label, el('span', { class: 'n' }, n));
  }
  function renderPager(d) {
    const pages = Math.ceil(d.total / d.per_page);
    const nav = $('pager');
    nav.hidden = pages <= 1;
    nav.replaceChildren(
      el('button', { type: 'button', disabled: d.page <= 1, onclick: () => { state.page--; run(); scrollTo(0, 0); } }, '← Previous'),
      el('span', { class: 'meta' }, `Page ${d.page} of ${pages}`),
      el('button', { type: 'button', disabled: d.page >= pages, onclick: () => { state.page++; run(); scrollTo(0, 0); } }, 'Next →'),
    );
  }

  // ── Suggestions (debounced; keyboard accessible) ────────────────────────────────────────────
  let timer; let active = -1; let sugToken = 0;
  const sug = $('suggest'); const input = $('q');
  function closeSug() { sug.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
  /** Submitting or picking cancels any pending/in-flight suggestion lookup, so a late result can never re-open the list over the results. */
  function cancelSuggest() { clearTimeout(timer); sugToken++; }
  async function showSuggestions() {
    const q = input.value.trim();
    if (q.length < 2) return closeSug();
    const mine = ++sugToken;
    try {
      const suggestions = await suggest(q);
      if (mine !== sugToken || input.value.trim() !== q || !suggestions.length) return closeSug();
      sug.replaceChildren(...suggestions.map((s, i) => el('li', { role: 'option', id: `s${i}`, 'aria-selected': 'false', onmousedown: (e) => { e.preventDefault(); pick(s); } }, s)));
      sug.hidden = false; input.setAttribute('aria-expanded', 'true');
    } catch { closeSug(); }
  }
  function pick(s) { cancelSuggest(); input.value = s; closeSug(); state.q = s; state.page = 1; run(); }
  input.addEventListener('input', () => { cancelSuggest(); timer = setTimeout(showSuggestions, 150); });
  input.addEventListener('blur', () => setTimeout(closeSug, 100));
  input.addEventListener('keydown', (e) => {
    const items = [...sug.children];
    if (sug.hidden || !items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
      input.setAttribute('aria-activedescendant', items[active].id);
    } else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active].textContent); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSug(); } // keep the query: <input type=search> would otherwise clear itself
  });
  $('form').addEventListener('submit', (e) => { e.preventDefault(); cancelSuggest(); closeSug(); state.q = input.value; state.page = 1; run(); });

  readUrl();
  run();
  return { run };
}
