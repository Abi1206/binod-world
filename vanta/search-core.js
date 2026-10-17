// Client-side search over a prebuilt JSON list of PUBLIC records (static/vanta/data/index.json). No DOM, no network, no dependencies:
// the same file runs in the browser (GitHub Pages) and in Node (tests, build checks).
//
// Mirrors the server's FTS5 behaviour closely enough to share one UI:
//   · every query word must match (AND), the last bare word also matches as a prefix (search-as-you-type)
//   · "quoted phrases" must appear in order
//   · BM25 ranking in the form SQLite FTS5 uses, column weights title 10 · tags 5 · summary 3 · body 1, plus a bonus for an exact title match
//   · filters (source, kind, tag, date range), facets over the matching set, highlighted snippets, title suggestions
// Differences (documented, tested): ranking is BM25-style but not bit-identical to SQLite's, and no popular-query suggestions
// (the static site stores nothing about visitors).
// Snippet highlights use the control characters \u0001 / \u0002, never HTML; the UI turns them into <mark> via DOM APIs.

export const SOURCE_LABEL = { gov: 'Government Portal', biasr: 'BIASR', riid: 'RIID', registry: 'Registered Directory', directory: 'Public Directory' };

const FIELD_WEIGHT = { title: 10, tags: 5, summary: 3, body: 1 };
const FIELDS = Object.keys(FIELD_WEIGHT);
const K1 = 1.2;
const B = 0.75;
const SLUG = /^[a-z0-9_-]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const normalize = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const tokenize = (s) => normalize(s).match(/[\p{L}\p{N}]+/gu) ?? [];

// Porter (1980) stemmer, the same algorithm as the server's FTS5 `porter` tokenizer, so word-form matching agrees
// (elected / election / elect ...). Applied identically to documents and queries; results are cached.
const C = '[^aeiou][^aeiouy]*';
const V = '[aeiouy][aeiou]*';
const MGR0 = new RegExp(`^(${C})?${V}${C}`);
const MEQ1 = new RegExp(`^(${C})?${V}${C}(${V})?$`);
const MGR1 = new RegExp(`^(${C})?${V}${C}${V}${C}`);
const S_V = new RegExp(`^(${C})?[aeiouy]`);
const CVC = new RegExp(`^${C}[aeiouy][^aeiouwxy]$`);
const STEP2 = { ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance', izer: 'ize', bli: 'ble', alli: 'al', entli: 'ent', eli: 'e', ousli: 'ous', ization: 'ize', ation: 'ate', ator: 'ate', alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous', aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log' };
const STEP3 = { icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '' };
const stemCache = new Map();
export function stem(word) {
  if (word.length < 3) return word;
  const hit = stemCache.get(word);
  if (hit !== undefined) return hit;
  let w = word, m;
  const y = w[0] === 'y';
  if (y) w = 'Y' + w.slice(1);
  // step 1a
  if (/^(.+?)(ss|i)es$/.test(w)) w = w.replace(/^(.+?)(ss|i)es$/, '$1$2');
  else if (/^(.+?)([^s])s$/.test(w)) w = w.replace(/^(.+?)([^s])s$/, '$1$2');
  // step 1b
  if ((m = /^(.+?)eed$/.exec(w))) { if (MGR0.test(m[1])) w = w.slice(0, -1); }
  else if ((m = /^(.+?)(ed|ing)$/.exec(w)) && S_V.test(m[1])) {
    w = m[1];
    if (/(at|bl|iz)$/.test(w)) w += 'e';
    else if (/([^aeiouylsz])\1$/.test(w)) w = w.slice(0, -1);
    else if (CVC.test(w)) w += 'e';
  }
  // step 1c
  if ((m = /^(.+?)y$/.exec(w)) && S_V.test(m[1])) w = m[1] + 'i';
  // step 2
  if ((m = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/.exec(w)) && MGR0.test(m[1])) w = m[1] + STEP2[m[2]];
  // step 3
  if ((m = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/.exec(w)) && MGR0.test(m[1])) w = m[1] + STEP3[m[2]];
  // step 4
  if ((m = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/.exec(w))) { if (MGR1.test(m[1])) w = m[1]; }
  else if ((m = /^(.+?)(s|t)(ion)$/.exec(w)) && MGR1.test(m[1] + m[2])) w = m[1] + m[2];
  // step 5
  if ((m = /^(.+?)e$/.exec(w)) && (MGR1.test(m[1]) || (MEQ1.test(m[1]) && !CVC.test(m[1])))) w = m[1];
  if (/ll$/.test(w) && MGR1.test(w)) w = w.slice(0, -1);
  if (y) w = 'y' + w.slice(1);
  stemCache.set(word, w);
  return w;
}

/** Build the in-memory index from the JSON records. Cheap: thousands of records index in a few milliseconds. */
export function buildIndex(docs) {
  const entries = [];
  const df = new Map();
  const totalLen = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  docs.forEach((d, i) => {
    const e = { i, d, tf: {}, len: {}, plain: {}, titleNorm: tokenize(d.title).join(' '), terms: new Set() };
    for (const f of FIELDS) {
      const toks = tokenize(d[f] ?? '');
      const map = new Map();
      for (const t of toks) { const s = stem(t); map.set(s, (map.get(s) ?? 0) + 1); e.terms.add(s); }
      e.tf[f] = map; e.len[f] = toks.length; e.plain[f] = ` ${toks.join(' ')} `; totalLen[f] += toks.length;
    }
    e.D = FIELDS.reduce((a, f) => a + e.len[f], 0);          // total tokens across ALL columns (FTS5's bm25 pools them)
    for (const t of e.terms) df.set(t, (df.get(t) ?? 0) + 1);
    entries.push(e);
  });
  const N = Math.max(1, docs.length);
  const avg = Object.fromEntries(FIELDS.map((f) => [f, Math.max(1, totalLen[f] / N)]));
  const avgD = Math.max(1, entries.reduce((a, e) => a + e.D, 0) / N);
  return { docs, entries, df, avg, avgD, N, vocab: [...df.keys()].sort() };
}

/** Parses free text into required words and phrases. Everything typed is treated as literal text (no operators). */
export function parseQuery(raw) {
  const phrases = [];
  for (const m of String(raw).slice(0, 300).matchAll(/"([^"]{1,100})"/g)) {
    const words = tokenize(m[1]).slice(0, 8);
    if (words.length) phrases.push(words);
    if (phrases.length >= 3) break;
  }
  const rest = String(raw).slice(0, 300).replace(/"[^"]*"/g, ' ');
  const words = tokenize(rest).map((w) => w.slice(0, 40)).slice(0, 12);
  const terms = words.map((w, i) => ({ raw: w, stem: stem(w), prefix: i === words.length - 1 && !phrases.length }));
  return { terms, phrases };
}


function expandPrefix(index, raw, st) {
  const out = new Set([st]);
  // binary-search the sorted vocabulary for the first term >= raw, then walk while it still starts with raw
  let lo = 0, hi = index.vocab.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (index.vocab[mid] < raw) lo = mid + 1; else hi = mid; }
  for (let i = lo; i < index.vocab.length && index.vocab[i].startsWith(raw) && out.size < 200; i++) out.add(index.vocab[i]);
  return [...out];
}

function passes(e, f) {
  if (f.sources && !f.sources.includes(e.d.source)) return false;
  if (f.kinds && !f.kinds.includes(e.d.kind)) return false;
  if (f.tag && !(` ${e.d.tags} `).includes(` ${f.tag} `)) return false;
  if (f.from && !(e.d.published_at && e.d.published_at >= f.from)) return false;
  if (f.to && !(e.d.published_at && e.d.published_at <= f.to + 'T23:59:59')) return false;
  return true;
}

function snippetFor(e, q) {
  const wanted = new Set(q.terms.map((t) => t.stem));
  const prefix = q.terms.find((t) => t.prefix)?.raw;
  const phraseWords = new Set(q.phrases.flat().map(stem));
  const hit = (tok) => { const n = normalize(tok); const s = stem(n); return wanted.has(s) || phraseWords.has(s) || (prefix && n.startsWith(prefix)); };
  for (const field of ['body', 'summary', 'title']) {
    const text = String(e.d[field] ?? '');
    let first = -1;
    for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) if (hit(m[0])) { first = m.index; break; }
    if (first < 0) continue;
    let start = Math.max(0, first - 70);
    if (start > 0) { const sp = text.indexOf(' ', start); if (sp > -1 && sp < first) start = sp + 1; }
    const end = Math.min(text.length, start + 200);
    const win = text.slice(start, end);
    let out = '', last = 0;
    for (const m of win.matchAll(/[\p{L}\p{N}]+/gu)) {
      if (!hit(m[0])) continue;
      out += win.slice(last, m.index) + '\u0001' + m[0] + '\u0002'; last = m.index + m[0].length;
    }
    out += win.slice(last);
    return (start > 0 ? '…' : '') + out.replace(/[\u0001\u0002]{0}/g, '') + (end < text.length ? '…' : '');
  }
  return String(e.d.summary || e.d.title);
}

/**
 * @param index  from buildIndex()
 * @param p      { q, sources?, kinds?, tag?, from?, to?, page?, perPage? }
 * @returns      same shape as the server's /vanta/search
 */
export function search(index, p) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const q = parseQuery(p.q ?? '');
  const f = { sources: p.sources?.length ? p.sources : null, kinds: p.kinds?.length ? p.kinds : null, tag: p.tag || null, from: p.from || null, to: p.to || null };
  const badFilter = [...(f.sources ?? []), ...(f.kinds ?? [])].some((x) => !SLUG.test(x)) || (f.tag && !SLUG.test(f.tag)) || (f.from && !DATE.test(f.from)) || (f.to && !DATE.test(f.to));
  const perPage = Math.min(50, Math.max(1, Math.floor(p.perPage ?? 10)));
  const page = Math.min(100, Math.max(1, Math.floor(p.page ?? 1)));
  const hasText = q.terms.length > 0 || q.phrases.length > 0;

  let hits = [];
  if (!badFilter) {
    const expansions = q.terms.map((t) => (t.prefix ? expandPrefix(index, t.raw, t.stem) : [t.stem]));
    // Scoring follows SQLite FTS5's bm25(): per query word  idf * (W*(k1+1)) / (W + k1*(1-b+b*D/avgD)),
    // where W = sum over columns of weight*tf and D = tokens in the whole row.
    const nDocs = (pred) => { let n = 0; for (const e of index.entries) if (pred(e)) n++; return n; };
    const idfOf = (n) => Math.max(1e-6, Math.log((index.N - n + 0.5) / (n + 0.5)));
    const termIdf = q.terms.map((t, ti) => idfOf(nDocs((e) => expansions[ti].some((x) => e.terms.has(x)))));
    const countIn = (plain, needle) => { let c = 0, at = plain.indexOf(needle); while (at !== -1) { c++; at = plain.indexOf(needle, at + needle.length - 1); } return c; };
    const phraseTfw = q.phrases.map((words) => { const needle = ` ${words.join(' ')} `; return index.entries.map((e) => FIELDS.reduce((a, fl) => a + FIELD_WEIGHT[fl] * countIn(e.plain[fl], needle), 0)); });
    const phraseIdf = phraseTfw.map((arr) => idfOf(arr.filter((x) => x > 0).length));
    const sat = (W, e) => (W * (K1 + 1)) / (W + K1 * (1 - B + B * (e.D / index.avgD)));
    const exact = q.terms.length && !q.phrases.length ? q.terms.map((t) => t.raw).join(' ') : null;
    for (const e of index.entries) {
      if (!passes(e, f)) continue;
      if (!hasText) { hits.push({ e, score: 0 }); continue; }
      let score = 0, ok = true;
      for (let ti = 0; ti < q.terms.length && ok; ti++) {
        let W = 0;
        for (const field of FIELDS) for (const term of expansions[ti]) W += FIELD_WEIGHT[field] * (e.tf[field].get(term) ?? 0);
        if (W === 0) { ok = false; break; }
        score += termIdf[ti] * sat(W, e);
      }
      for (let pi = 0; pi < q.phrases.length && ok; pi++) {
        const W = phraseTfw[pi][e.i];
        if (W === 0) { ok = false; break; }
        score += phraseIdf[pi] * sat(W, e);
      }
      if (!ok) continue;
      if (exact && e.titleNorm === exact) score += 5;       // exact title match bonus (same constant as the server)
      hits.push({ e, score });
    }
    if (hasText) hits.sort((a, b) => b.score - a.score || a.e.i - b.e.i);
    else hits.sort((a, b) => (b.e.d.published_at ?? '').localeCompare(a.e.d.published_at ?? '') || a.e.i - b.e.i);   // browse mode: newest first
  }

  const facets = { source: {}, kind: {} };
  for (const { e } of hits) { facets.source[e.d.source] = (facets.source[e.d.source] ?? 0) + 1; facets.kind[e.d.kind] = (facets.kind[e.d.kind] ?? 0) + 1; }
  const slice = hits.slice((page - 1) * perPage, page * perPage);
  return {
    query: p.q ?? '', total: hits.length, page, per_page: perPage,
    results: slice.map(({ e }) => ({
      id: e.i, title: e.d.title, url: e.d.url, source: e.d.source, source_label: SOURCE_LABEL[e.d.source] ?? e.d.source, kind: e.d.kind,
      published_at: e.d.published_at, tags: String(e.d.tags).split(' ').filter(Boolean),
      snippet: hasText ? snippetFor(e, q) : String(e.d.summary || e.d.title), summary: e.d.summary,
    })),
    facets,
    took_ms: Math.round(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) * 10) / 10,
  };
}

export function suggest(index, raw) {
  const s = normalize(raw).trim().slice(0, 60);
  if (s.length < 2) return [];
  const starts = [], inside = [];
  for (const e of index.entries) {
    const t = normalize(e.d.title);
    if (t.startsWith(s)) starts.push(e.d.title); else if (t.includes(` ${s}`)) inside.push(e.d.title);
  }
  const uniq = (a) => [...new Set(a)].sort((x, y) => x.length - y.length);
  return [...uniq(starts), ...uniq(inside)].slice(0, 8);
}

export function sources(index) {
  const out = {};
  for (const { d } of index.entries) {
    const o = (out[d.source] ??= { label: SOURCE_LABEL[d.source] ?? d.source, total: 0, kinds: {} });
    o.total++; o.kinds[d.kind] = (o.kinds[d.kind] ?? 0) + 1;
  }
  return out;
}
