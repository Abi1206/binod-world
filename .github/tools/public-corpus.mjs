// Read-only collector of the PUBLIC records of the Binod World sites. Plain JavaScript, only node: built-ins, so the SAME file runs
//   (a) inside the server's importer (src/vanta/importers.ts re-exports it),
//   (b) in the static build (scripts/build-static.mjs), and
//   (c) inside GitHub Actions in the public repo (vendored to .github/tools/), with no install step.
// Allow-list design: only the sources and paths named below are ever read. Anything whose path or URL contains "classified" is
// dropped, as are non-declassified RIID cases. Nothing here writes anywhere.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {{ source: 'gov'|'biasr'|'riid'|'directory', source_id: string, kind: string, title: string, summary: string,
 *             body: string, tags: string, url: string, published_at: string|null }} VDoc
 */

const PUB_PAGE = {
  law: 'laws.html', whitepaper: 'white-papers.html', constitution: 'constitution.html', article: 'constitution.html',
  amendment: 'constitution.html', announcement: 'notices.html', election: 'president.html', leader_update: 'president.html',
};
const PUBLIC_CASE_LEVELS = new Set(['DECLASSIFIED', 'PUBLIC']);
const DIRECTORY_KINDS = new Set(['organisation', 'institution', 'service', 'resource', 'community']);

export const isClassified = (s) => /classified/i.test(s);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const tagify = (...xs) => xs.flat().filter((x) => typeof x === 'string' && x).map((x) => String(x).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean).join(' ');
const str = (x) => (typeof x === 'string' ? x : '');

function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}
const arr = (x) => (Array.isArray(x) ? x.filter((i) => i && typeof i === 'object') : []);

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&nbsp;': ' ', '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&#39;': "'" };
export function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|nbsp|middot|mdash|ndash|#39);/g, (m) => ENT[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

function pageDoc(source, dirRel, file, docsDir, base) {
  const rel = dirRel ? `${dirRel}/${file}` : file;
  if (isClassified(rel)) return null;
  const html = readFileSync(join(docsDir, rel), 'utf8');
  const title = htmlToText(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? rel).replace(/\s+[—–-]\s+(Binod World Government|BIASR|RIID)[\s\S]*$/i, '').trim() || rel;
  const desc = htmlToText(/<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1] ?? '');
  const main = /<main\b[\s\S]*?<\/main>/i.exec(html)?.[0] ?? /<body\b[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  const body = clip(htmlToText(main), 20_000);
  return { source, source_id: `page:${rel}`, kind: 'page', title, summary: clip(desc || body, 240), body, tags: tagify('page', source), url: base + rel, published_at: null };
}

/**
 * @param {{ docsDir: string, publicBaseUrl: string }} cfg
 * @returns {VDoc[]}
 */
export function collectPublic(cfg) {
  const { docsDir: D, publicBaseUrl: base } = cfg;
  /** @type {VDoc[]} */
  const out = [];

  // ── Government Portal ───────────────────────────────────────────────────
  const pubs = readJson(join(D, 'data/publications.json'))?.publications;
  for (const p of arr(pubs)) {
    const id = str(p.id), type = str(p.type);
    if (!id || !type || !str(p.title)) continue;
    const content = str(p.content);
    const meta = [str(p.publishedBy) && `Published by ${p.publishedBy}`, str(p.office), str(p.country), p.day != null && `Day ${p.day}`, str(p.leader) && `Leader ${p.leader}`, p.termNumber != null && `Term ${p.termNumber}`].filter(Boolean).join(' · ');
    out.push({
      source: 'gov', source_id: id, kind: type, title: str(p.title), summary: clip(content || meta, 240), body: [content, meta].filter(Boolean).join('\n'),
      tags: tagify(type, p.tags ?? [], str(p.country), str(p.category)), url: base + (PUB_PAGE[type] ?? 'archives.html'), published_at: null,
    });
  }
  for (const e of arr(readJson(join(D, 'assets/press_release/manifest.json')))) {
    const ref = str(e.ref) || str(e.file);
    if (!ref || !str(e.title)) continue;
    out.push({ source: 'gov', source_id: `press:${ref}`, kind: 'press_release', title: str(e.title), summary: clip(str(e.summary) || `Press release ${ref}`, 240), body: [str(e.summary), str(e.author), ref].filter(Boolean).join('\n'), tags: tagify('press_release', ref), url: base + 'press-releases.html', published_at: str(e.date) || null });
  }
  const ws = readJson(join(D, 'data/world-state.json'));
  for (const n of arr(ws?.nations)) {
    if (!str(n.id) || !str(n.name)) continue;
    out.push({ source: 'gov', source_id: `nation:${n.id}`, kind: 'nation', title: str(n.name), summary: [str(n.role), str(n.governmentType)].filter(Boolean).join(' — '), body: [str(n.role), str(n.governmentType), `Capital ${str(n.capital)}`, str(n.badge), `Established ${str(n.established)}`].join('\n'), tags: tagify('nation', 'member-state', str(n.id)), url: base + 'countries.html', published_at: null });
  }
  if (ws?.president) {
    out.push({ source: 'gov', source_id: 'office:president', kind: 'office', title: 'Office of the World President', summary: clip(str(ws.president.bio), 240), body: [str(ws.president.displayName), str(ws.president.bio)].join('\n'), tags: tagify('president', 'office'), url: base + 'president.html', published_at: null });
  }

  // ── BIASR ──────────────────────────────────────────────────────────────
  for (const p of arr(readJson(join(D, 'biasr/assets/publications/manifest.json')))) {
    if (!str(p.id) || !str(p.title)) continue;
    const authors = Array.isArray(p.authors) ? p.authors.join(', ') : '';
    out.push({ source: 'biasr', source_id: str(p.id), kind: 'publication', title: str(p.title), summary: clip(str(p.abstract), 240), body: [str(p.abstract), authors, str(p.citation), str(p.identifier)].filter(Boolean).join('\n'), tags: tagify('publication', 'research', str(p.division), p.tags ?? []), url: base + 'biasr/publications.html', published_at: str(p.date) || null });
  }

  // ── RIID (public, declassified only) ───────────────────────────────────
  for (const c of arr(readJson(join(D, 'riid/assets/cases/manifest.json')))) {
    if (!PUBLIC_CASE_LEVELS.has(str(c.classification).toUpperCase()) || !str(c.id)) continue;
    out.push({ source: 'riid', source_id: str(c.id), kind: 'case', title: str(c.operation) || str(c.id), summary: clip(str(c.summary), 240), body: [str(c.summary), str(c.outcome), str(c.id)].filter(Boolean).join('\n'), tags: tagify('case', 'declassified', str(c.status)), url: base + 'riid/investigations.html', published_at: str(c.dateOpened) || null });
  }
  for (const e of arr(readJson(join(D, 'riid/assets/press_releases/manifest.json')))) {
    const ref = str(e.ref);
    if (!ref || !str(e.title)) continue;
    out.push({ source: 'riid', source_id: `press:${ref}`, kind: 'press_release', title: str(e.title), summary: clip(str(e.summary) || ref, 240), body: [str(e.summary), ref].filter(Boolean).join('\n'), tags: tagify('press_release', ref), url: base + 'riid/press-releases.html', published_at: str(e.date) || null });
  }

  // ── Public directory (organisations suggested via GitHub issues and approved by the owner) ───────────────────────
  // docs/data/registry.json: [{ "name", "kind", "description", "url" }]   Public by definition; https links only.
  for (const o of arr(readJson(join(D, 'data/registry.json')))) {
    const name = str(o.name).trim(), kind = str(o.kind), description = str(o.description).trim(), url = str(o.url);
    if (name.length < 3 || name.length > 80 || !DIRECTORY_KINDS.has(kind) || description.length < 10 || description.length > 600) continue;
    let u; try { u = new URL(url); } catch { continue; }
    if (u.protocol !== 'https:') continue;
    out.push({ source: 'directory', source_id: `dir:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`, kind, title: name, summary: clip(description, 240), body: description, tags: tagify('directory', kind), url: u.toString(), published_at: null });
  }

  // ── Public static pages (HTML) ─────────────────────────────────────────
  for (const [source, dir] of [['gov', ''], ['biasr', 'biasr'], ['riid', 'riid']]) {
    const abs = join(D, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs).filter((f) => f.endsWith('.html')).sort()) {
      const d = pageDoc(source, dir, f, D, base);
      if (d) out.push(d);
    }
  }

  // Defence in depth (the server DB also enforces this with a CHECK constraint).
  return out.filter((d) => !isClassified(d.url) && !isClassified(d.source_id));
}
