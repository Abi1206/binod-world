#!/usr/bin/env node
// Publish guard: fails (exit 1) if anything restricted would be published to the public site.
//   node guard-public.mjs                     scan the working tree under ../docs (what `git add .` would stage)
//   node guard-public.mjs --dir <path>        scan an arbitrary directory (tests)
//   node guard-public.mjs --git <rev>         scan the committed tree of <rev>, e.g. the `git subtree split` SHA
//                                             that is about to be pushed to the public repo
// Exit codes: 0 clean · 1 violations · 2 usage/error. Output lists paths and rule names, never file contents.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PATH_RULES = [
  { name: 'classified-path', re: /classified/i },
  { name: 'private-path', re: /(^|\/)(private|secret|secrets|internal|backup|backups)(\/|$)/i },
  { name: 'env-or-key-file', re: /(^|\/)(\.env[^/]*|.*\.(pem|key|p12|pfx|kdbx)|id_(rsa|ed25519)|.*\.db|.*\.sqlite3?)$/i },
  { name: 'network-app', re: /(^|\/)(network|node_modules)(\/|$)/ },
];
export const CONTENT_RULES = [
  { name: 'security-marking', re: /\b(TOP SECRET|CODEWORD:)/ },
  { name: 'hardcoded-credential-check', re: /\b(pass(word)?|pwd)\s*={2,3}\s*['"][^'"]{3,}['"]/i },
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'api-secret-assignment', re: /\b(api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/i },
];
const TEXT_EXT = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.md', '.txt', '.xml', '.svg', '.csv', '.ps1']);
const MAX = 1_000_000;

export function scanFiles(files /* [{path, read(): string|null}] */) {
  const violations = [];
  for (const f of files) {
    for (const r of PATH_RULES) if (r.re.test(f.path)) violations.push({ path: f.path, rule: r.name });
    // The vendored tools in .github/tools/ legitimately contain the guard's own patterns as text; path rules still apply to them.
    if (TEXT_EXT.has(extname(f.path).toLowerCase()) && !f.path.startsWith('.github/tools/')) {
      const text = f.read();
      if (text) for (const r of CONTENT_RULES) if (r.re.test(text)) violations.push({ path: f.path, rule: r.name });
    }
  }
  return violations;
}

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

export function scanDir(root) {
  return scanFiles(walk(root).map((p) => ({
    path: relative(root, p).split(sep).join('/'),
    read: () => (statSync(p).size <= MAX ? readFileSync(p, 'utf8') : null),
  })));
}

export function scanGit(rev, cwd) {
  const git = (...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const names = git('ls-tree', '-r', '--name-only', rev).split('\n').filter(Boolean);
  return scanFiles(names.map((path) => ({
    path,
    read: () => { try { const t = git('show', `${rev}:${path}`); return t.length <= MAX ? t : null; } catch { return null; } },
  })));
}

function main() {
  const args = process.argv.slice(2);
  const here = dirname(fileURLToPath(import.meta.url));
  let violations; let label;
  if (args[0] === '--git') {
    if (!args[1]) { console.error('usage: --git <rev>'); process.exit(2); }
    violations = scanGit(args[1], resolve(here, '..', '..')); label = `git tree ${args[1]}`;
  } else {
    const dir = args[0] === '--dir' ? resolve(args[1] ?? '') : resolve(here, '..', '..', 'docs');
    violations = scanDir(dir); label = dir;
  }
  if (!violations.length) { console.log(`guard-public: clean (${label})`); return; }
  console.error(`guard-public: ${violations.length} violation(s) in ${label}`);
  for (const v of violations) console.error(`  [${v.rule}] ${v.path}`);
  console.error('Refusing to publish. Move restricted material out of docs/ (see network/docs/CLASSIFIED_MIGRATION.md).');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
