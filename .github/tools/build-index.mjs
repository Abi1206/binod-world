// Builds the VANTA search index (vanta/data/index.json) from the PUBLIC data of the site. Plain Node (>= 20.11), no dependencies.
// Deterministic: the same public data always produces byte-identical output (no timestamps), so "is the committed index stale?"
// is a simple comparison.
//   node build-index.mjs --docs <siteRoot> --out <file> [--base <canonicalBaseUrl>]
//   node build-index.mjs --docs <siteRoot> --out <file> --check        exits 1 if <file> is missing or differs from a fresh build
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectPublic } from './public-corpus.mjs';

export const CANONICAL_BASE = 'https://abi1206.github.io/binod-world/';

/** @returns {{ text: string, count: number, sha256: string }} */
export function buildIndexText({ docsDir, publicBaseUrl = CANONICAL_BASE }) {
  const docs = collectPublic({ docsDir, publicBaseUrl })
    .sort((a, b) => (a.source + '\u0000' + a.source_id).localeCompare(b.source + '\u0000' + b.source_id))
    .map(({ source, kind, title, summary, body, tags, url, published_at }) => ({ source, kind, title, summary, body, tags, url, published_at }));
  const sha256 = createHash('sha256').update(JSON.stringify(docs)).digest('hex');
  return { text: JSON.stringify({ format: 1, corpus_sha256: sha256, count: docs.length, base: publicBaseUrl, docs }) + '\n', count: docs.length, sha256 };
}

function main(argv) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const docsDir = resolve(opt('--docs') ?? '.');
  const out = opt('--out');
  if (!out) { console.error('usage: node build-index.mjs --docs <siteRoot> --out <file> [--base <url>] [--check]'); process.exit(2); }
  const built = buildIndexText({ docsDir, publicBaseUrl: opt('--base') ?? CANONICAL_BASE });
  if (argv.includes('--check')) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : null;
    if (current === built.text) { console.log(`index is up to date (${built.count} records, ${built.sha256.slice(0, 8)})`); return; }
    console.error(`index is ${current === null ? 'MISSING' : 'STALE'}: ${out} does not match the current public data. Rebuild it (npm run build:static, or: node .github/tools/build-index.mjs --docs . --out ${out}).`);
    process.exit(1);
  }
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, built.text);
  console.log(`wrote ${out}: ${built.count} public records, ${(built.text.length / 1024).toFixed(0)} KB, corpus ${built.sha256.slice(0, 8)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
