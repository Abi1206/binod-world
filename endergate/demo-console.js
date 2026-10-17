// DEMO console. Local to this browser. NOT encrypted, NOT private, NOT sent anywhere.
// This module contains no network code at all (and the page's Content-Security-Policy forbids network requests):
// it only reads and writes this browser's localStorage and draws the log with DOM text nodes.
import { el } from './dom.js';

const KEY = 'bwn_demo_log_v1';
const MAX_ENTRIES = 200;
const MAX_LEN = 500;
const $ = (id) => document.getElementById(id);

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((e) => e && typeof e.t === 'string' && typeof e.text === 'string').slice(-MAX_ENTRIES).map((e) => ({ t: e.t.slice(0, 40), text: e.text.slice(0, MAX_LEN) }));
  } catch { return []; }
}
function save(entries) {
  try { localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); return true; } catch { return false; }
}

let entries = load();
let persisted = true;

function draw() {
  const log = $('log');
  if (!entries.length) { log.replaceChildren(el('li', { class: 'dim' }, 'Nothing logged yet.')); return; }
  log.replaceChildren(...entries.map((e) => el('li', { class: 'msg' }, el('span', { class: 'dim' }, `${e.t} · demo · `), el('span', { class: 'body' }, e.text))));
  log.scrollTop = log.scrollHeight;
}

$('demo-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const input = $('demo-text');
  const text = input.value.trim().slice(0, MAX_LEN);
  if (!text) { $('demo-status').textContent = 'Type something first.'; return; }
  entries.push({ t: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC', text });
  entries = entries.slice(-MAX_ENTRIES);
  persisted = save(entries);
  input.value = '';
  $('demo-status').textContent = persisted ? 'Logged locally in this browser only. Nothing was sent.' : 'Logged for this page view only: this browser would not let the page save it. Nothing was sent.';
  draw();
});

$('demo-clear').addEventListener('click', () => {
  entries = [];
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable: nothing to remove */ }
  $('demo-status').textContent = 'Local log cleared.';
  draw();
});

draw();
