// The Gate (static edition): the ENDERGATE login and the doors to the layers this edition provides.
import { api, el, ApiError } from './static-api.js';
import { boot, main, act, field, note, PAGES, serviceSearch } from './eg.js';

const input = (name, o = {}) => el('input', { name, ...o });

function portalHero(connected) {
  return el('section', { class: 'portal', 'aria-labelledby': 'h-gate' },
    el('div', { class: 'stage', 'aria-hidden': 'true' }, el('div', { class: 'beam' }),
      el('div', { class: 'ring' }, el('i', { class: 'r1' }), el('i', { class: 'r2' }), el('i', { class: 'r3' }), el('i', { class: 'core' }))),
    el('p', { class: 'eyebrow' }, 'Zone 01 · The Gate'),
    el('h1', { id: 'h-gate' }, 'ENDERGATE'),
    el('p', { class: 'tag' }, 'Every network begins at a door.'),
    el('p', { class: 'readout', 'aria-label': 'Gateway readout' }, connected ? 'signal: strong  ·  link: established  ·  mode: static edition' : 'signal: none  ·  link: none  ·  awaiting credentials'));
}

function connectForm() {
  const st = el('p', { class: 'note', role: 'status' });
  return el('form', { class: 'panel', 'aria-labelledby': 'h-connect', onsubmit: async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    st.textContent = 'Checking…'; st.classList.remove('err');
    try { await api('/auth/login', { method: 'POST', body: { handle: f.get('handle'), password: f.get('password') } }); location.reload(); }
    catch (err) { st.textContent = err instanceof ApiError ? err.message : 'Could not connect.'; st.classList.add('err'); e.target.elements.password.value = ''; }
  } },
  el('h2', { id: 'h-connect' }, 'Connect'),
  field('Handle', input('handle', { required: true, autocomplete: 'username', autocapitalize: 'off', spellcheck: 'false' })),
  field('Password', input('password', { type: 'password', required: true, autocomplete: 'current-password' })),
  el('button', {}, 'Open the gate'), st);
}

boot('gate', async ({ me, layers }) => {
  const root = main();
  root.append(portalHero(!!me));
  if (!me) {
    root.append(connectForm());
    root.append(el('section', { class: 'panel directory', 'aria-labelledby': 'h-dir' },
      el('p', { class: 'eyebrow' }, 'Zone 02 · Signal directory'), el('h2', { id: 'h-dir' }, 'Signal directory'),
      el('p', { class: 'dim' }, 'Signals lie beyond the gate. Nothing about them is published here; they open only to the credentials assigned to you.')));
  } else {
    root.append(note(`Connected as ${me.account.handle} · level ${me.account.clearance}.`));
    root.append(el('section', { class: 'doors', 'aria-label': 'Layers' }, ...layers.filter((l) => l.slug !== 'gate').map((l) => (l.locked
      ? el('div', { class: 'door locked' }, el('h2', {}, '▒▒▒▒▒▒'), el('p', {}, 'Unknown signal'))
      : el('a', { class: 'door', href: PAGES[l.slug] }, el('h2', {}, l.name), el('p', {}, l.tagline))))));
    if (layers.some((l) => l.slug !== 'gate' && !l.locked)) root.append(serviceSearch());   // no search box for someone with nothing beyond the gate
  }
  root.append(el('footer', { class: 'foot' }, 'Static edition · no server · nothing you type leaves this browser.'));
});
