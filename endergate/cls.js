// Classified portal (RIID Classified Access / Government Top Secret) — a SECOND, separately authenticated door inside ENDERGATE.
// You arrive here already signed in to ENDERGATE (eg.js boot enforces that). The classified username/password are different; your ENDERGATE
// login and level give you nothing here. What you can see is decided by which keys your classified login unlocks (see vault.js).
import { el, field_ } from './cls-dom.js';
import { cls as clsApi } from './static-api.js';
import { boot, main } from './eg.js';

const SYSTEM = document.body.dataset.system;
const cls = (path, opts) => clsApi(SYSTEM, path, opts);

const FLAVOUR = {
  riid: { banner: 'RESTRICTED · AUTHORISED PERSONNEL ONLY', sub: 'Authentication required · ENDERGATE Gateway', docs: 'Case files and records' },
  'gov-top-secret': { banner: 'GOVERNMENT · AUTHORISED PERSONNEL ONLY', sub: 'Authentication required · ENDERGATE Gateway', docs: 'Government records' },
}[SYSTEM] ?? { banner: 'RESTRICTED', sub: 'Authentication required', docs: 'Records' };

function loginView(info, message) {
  const status = el('p', { class: 'cls-status', role: 'status' }, message ?? '');
  const form = el('form', { class: 'cls-login', autocomplete: 'off', onsubmit: async (e) => {
    e.preventDefault(); status.textContent = ''; status.classList.remove('err');
    const f = new FormData(form);
    try {
      await cls('/login', { method: 'POST', body: { username: f.get('username'), password: f.get('password') } });
      form.reset(); await dashboard(info);
    } catch (err) { status.textContent = err.message; status.classList.add('err'); form.elements.password.value = ''; }
  } },
    el('div', { class: 'cls-banner', role: 'note' }, FLAVOUR.banner),
    el('h1', {}, info.name),
    el('p', { class: 'cls-sub' }, FLAVOUR.sub),
    el('p', { class: 'cls-warn' }, 'Restricted system. Your ENDERGATE login does not grant access here: enter the separate credentials assigned for this system.'),
    field_('Username', el('input', { name: 'username', required: true, maxlength: 60, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' })),
    field_('Password', el('input', { name: 'password', type: 'password', required: true, maxlength: 200, autocomplete: 'off' })),
    el('button', {}, 'Authenticate'), status);
  main().replaceChildren(form);
  form.elements.username.focus();
}

function metaLine(d) { return el('span', { class: 'cls-meta' }, el('span', { class: 'cls-ref' }, d.ref), el('span', { class: 'cls-class' }, d.classification), ...d.tags.map((t) => el('span', { class: 'tagpill' }, t))); }

async function dashboard(info) {
  const me = await cls('/session');
  const { documents } = await cls('/documents');
  const viewer = el('article', { class: 'cls-viewer', 'aria-live': 'polite', tabindex: '-1' }, el('p', { class: 'cls-hint' }, 'Select a record to open it.'));
  const list = el('ul', { class: 'cls-list' });
  const st = el('p', { class: 'cls-status', role: 'status' });

  const open = async (ref) => {
    st.textContent = ''; st.classList.remove('err');
    try {
      const d = await cls(`/documents/${encodeURIComponent(ref)}`);
      viewer.replaceChildren(el('div', { class: 'cls-banner' }, `${d.classification} · ${d.ref}`), el('h2', {}, d.title),
        ...d.content.split(/\n{2,}/).map((p) => el('p', { class: 'cls-text' }, p)));
      viewer.focus();
    } catch (e) { st.textContent = e.message; st.classList.add('err'); }
  };
  const draw = (rows, empty) => {
    list.replaceChildren(...(rows.length
      ? rows.map((d) => el('li', {}, el('button', { type: 'button', class: 'cls-open', onclick: () => open(d.ref) }, el('strong', {}, d.title), metaLine(d))))
      : [el('li', { class: 'cls-hint' }, empty)]));
  };
  draw(documents, 'No records are available at your clearance.');

  const q = el('input', { type: 'search', name: 'q', maxlength: 40, placeholder: 'title, tag or reference number', 'aria-label': 'Search titles, tags and reference numbers' });
  const search = el('form', { class: 'cls-search', role: 'search', onsubmit: async (e) => {
    e.preventDefault(); st.textContent = '';
    const term = q.value.trim();
    if (term.length < 2) { draw(documents, 'No records are available at your clearance.'); return; }
    try { const r = await cls(`/search?q=${encodeURIComponent(term)}`); draw(r.results, 'No authorised record matches.'); }
    catch (err) { st.textContent = err.message; st.classList.add('err'); }
  } }, q, el('button', {}, 'Search'));

  main().replaceChildren(
    el('div', { class: 'cls-banner' }, FLAVOUR.banner),
    el('header', { class: 'cls-head' },
      el('div', {}, el('h1', {}, info.name), el('p', { class: 'cls-sub' }, `Operator ${me.username}${me.role_title ? ' · ' + me.role_title : ''}`)),
      el('div', { class: 'cls-clear', role: 'status' }, el('span', { class: 'cls-clear-label' }, 'Clearance'), el('strong', {}, me.clearance)),
      el('button', { type: 'button', class: 'link', onclick: async () => { try { await cls('/logout', { method: 'POST' }); } catch { /* already ended */ } location.reload(); } }, 'End classified session')),
    el('p', { class: 'cls-hint' }, 'Search covers the titles, tags and reference numbers of records you are cleared for. Document text is never searched.'),
    search, st,
    el('div', { class: 'cls-grid' }, el('section', {}, el('h2', {}, FLAVOUR.docs), list), viewer));
}

boot('end', async () => {
  let info;
  try { info = await cls('/info'); }
  catch { main().replaceChildren(el('section', { class: 'denied', role: 'alert' }, el('h1', {}, '▒▒ no route ▒▒'), el('p', {}, 'Your access does not reach this system.'), el('p', {}, el('a', { href: 'the-end.html' }, '← return to The End')))); return; }
  document.addEventListener('cls:expired', () => loginView(info, 'Classified session ended. Authenticate again.'));
  try { await cls('/session'); await dashboard(info); return; } catch { /* no classified session yet */ }
  loginView(info);
});
