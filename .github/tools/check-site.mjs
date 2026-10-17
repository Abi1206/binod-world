// Validation of the PUBLIC site tree. Runs locally and in GitHub Actions. Plain Node (>= 20.11), no dependencies, no secrets,
// no network. Prints only paths and rule names, never file contents.
//   node check-site.mjs [--root <dir>] [--skip-index]
// Checks: (1) publish guard: no classified paths, security markings, hard-coded credentials, keys, env/db files;
//         (2) every .json file parses;  (3) no NEW broken local links (allow-list: .github/known-broken-links.txt);
//         (4) the committed search index equals a fresh build from the public data (unless --skip-index);
//         (5) size limits (GitHub Pages: site <= 1 GB, repository files < 100 MB).
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanDir } from './guard-public.mjs';
import { walk, brokenLinks } from './links.mjs';
import { buildIndexText } from './build-index.mjs';

export function runChecks(root, { skipIndex = false } = {}) {
  const problems = [], notes = [];
  const rel = (p) => relative(root, p).split(sep).join('/');
  const files = walk(root);

  for (const v of scanDir(root)) problems.push(`guard [${v.rule}] ${v.path}`);                                    // 1. publish guard

  for (const f of files.filter((f) => extname(f) === '.json')) {                                                  // 2. JSON validity
    try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { problems.push(`invalid JSON: ${rel(f)} (${e.message})`); }
  }

  const knownFile = join(root, '.github/known-broken-links.txt');                                                 // 3. links
  const known = new Set(existsSync(knownFile) ? readFileSync(knownFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : []);
  let allowed = 0;
  for (const b of brokenLinks(root)) { if (known.has(b)) allowed++; else problems.push(`NEW broken link: ${b}`); }
  if (allowed) notes.push(`${allowed} pre-existing broken link(s) allow-listed`);

  if (skipIndex) notes.push('index freshness skipped');                                                           // 4. index freshness
  else if (!existsSync(join(root, 'vanta'))) notes.push('no vanta/ directory: index check skipped');
  else {
    const fresh = buildIndexText({ docsDir: root });
    const indexFile = join(root, 'vanta/data/index.json');
    const current = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : null;
    if (current === null) problems.push('vanta/data/index.json is missing');
    else if (current !== fresh.text) problems.push('vanta/data/index.json is STALE (does not match the current public data); rebuild it');
    else notes.push(`index up to date (${fresh.count} records)`);
  }

  let total = 0;                                                                                                  // 5. size limits
  for (const f of files) { const s = statSync(f).size; total += s; if (s >= 100 * 1024 * 1024) problems.push(`file too large for GitHub (>= 100 MB): ${rel(f)}`); }
  if (total > 900 * 1024 * 1024) problems.push(`site is ${(total / 1048576).toFixed(0)} MB; GitHub Pages limit is 1 GB`);
  else notes.push(`site size ${(total / 1048576).toFixed(1)} MB (limit 1024 MB)`);

  return { problems, notes, fileCount: files.length };
}

function main(argv) {
  const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const root = resolve(opt('--root') ?? '.');
  const { problems, notes, fileCount } = runChecks(root, { skipIndex: argv.includes('--skip-index') });
  console.log(`checked ${fileCount} files under ${root}`);
  for (const n of notes) console.log(`  note: ${n}`);
  if (problems.length) { console.error(`\n${problems.length} problem(s):`); for (const p of problems) console.error(`  ${p}`); process.exit(1); }
  console.log('site check OK');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
