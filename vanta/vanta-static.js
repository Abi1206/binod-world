// VANTA, static edition (GitHub Pages). No server, no accounts, no tracking: the whole index is one JSON file of PUBLIC records,
// downloaded once and searched in your browser. The UI module is shared with the server-backed version.
import { mountVanta } from './vanta-ui.js';
import { buildIndex, search, suggest } from './search-core.js';

const $ = (id) => document.getElementById(id);
const STR = ['source', 'kind', 'title', 'summary', 'body', 'tags', 'url'];

function validate(data) {
  if (!data || data.format !== 1 || !Array.isArray(data.docs)) throw new Error('unexpected index format');
  for (const d of data.docs) {
    for (const k of STR) if (typeof d[k] !== 'string') throw new Error('malformed index record');
    if (!/^https?:\/\//.test(d.url)) throw new Error('malformed index record (url)');
  }
  return data;
}

let index = null;
let loadError = null;
try {
  const res = await fetch('data/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`index not found (HTTP ${res.status})`);
  const data = validate(await res.json());
  index = buildIndex(data.docs);
  $('stat-index').textContent = `Index: ${data.count.toLocaleString()} records`;
  $('about-index').textContent = `Index of ${data.count.toLocaleString()} public records · build ${String(data.corpus_sha256).slice(0, 8)}.`;
} catch (e) {
  loadError = e;
  $('stat-index').textContent = 'Index unavailable';
  $('about-index').textContent = 'The public index could not be loaded.';
}

mountVanta({
  search: async (p) => {
    if (!index) throw loadError ?? new Error('index not loaded');
    const list = (k) => (p.get(k) ? p.get(k).split(',') : undefined);
    return search(index, { q: p.get('q') ?? '', sources: list('source'), kinds: list('kind'), page: Number(p.get('page')) || 1, perPage: Number(p.get('per_page')) || 10 });
  },
  suggest: async (q) => (index ? suggest(index, q) : []),
  errorText: (e) => `Search unavailable: ${e.message}`,
});
