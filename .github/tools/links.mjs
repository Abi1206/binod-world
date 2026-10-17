// Shared by check-site.mjs and the static build. Plain Node, no dependencies.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, extname, sep } from 'node:path';

export const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (n === '.git' || n === 'node_modules') continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
};

/** Local href/src targets that do not exist, as "page -> target" strings. */
export function brokenLinks(root) {
  const rel = (p) => relative(root, p).split(sep).join('/');
  const attr = /(?:href|src)\s*=\s*"([^"#?]+)(?:[#?][^"]*)?"/gi;
  const out = new Set();
  for (const f of walk(root).filter((f) => extname(f) === '.html' && !rel(f).startsWith('.github/'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(attr)) {
      const u = m[1];
      if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(u)) continue;
      const target = u.startsWith('/') ? join(root, u) : resolve(dirname(f), u);
      if (!existsSync(target)) out.add(`${rel(f)} -> ${u}`);
    }
  }
  return [...out].sort();
}

