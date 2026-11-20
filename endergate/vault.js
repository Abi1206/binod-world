// ENDERGATE static edition — the "vault": credentials and classified records protected with the browser's WebCrypto, no server.
//
// How it works (kept deliberately small):
//   * data/vault.json is public ciphertext. It holds NO usernames, NO passwords, NO titles and NO text in the clear.
//   * Every account (per system: endergate, riid, gov-top-secret) has an entry id = SHA-256(system + username) and a salt.
//     A key derived from the account's password (PBKDF2-SHA256) unlocks the entry's small encrypted "wrap". A wrong password simply fails to decrypt.
//   * The wrap of an ENDERGATE account holds its level (0-4) and layer permissions. The wrap of a RIID / Government account holds its tier
//     (1, 2, 3 or full) and the keys of exactly the tiers it may read.
//   * Records are encrypted per tier. A person who holds the Level 2 keys cannot decrypt the Level 3 records even if they download every file,
//     so "records above your clearance are absent" is enforced by cryptography, not only by the page.
// Works unchanged in browsers and in Node (tests, build script): it only uses globalThis.crypto.subtle.

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder(), dec = new TextDecoder();

export const SYSTEMS = ['riid', 'gov-top-secret'];
export const TIERS = ['1', '2', '3', 'full'];
const RANK = { '1': 1, '2': 2, '3': 3, full: 99 };
export const isTier = (x) => TIERS.includes(x);
/** Tiers are cumulative. Full Clearance reads everything, including "full only" records; nobody else reads "full only". */
export function canReadTier(person, doc) { if (person === 'full') return true; if (doc === 'full') return false; return RANK[person] >= RANK[doc]; }
export const readableTiers = (person) => TIERS.filter((t) => canReadTier(person, t));
export const tierLabel = (t, short = 'RIID') => (t === 'full' ? `FULL CLEARANCE — UNRESTRICTED ${short} ACCESS` : `LEVEL ${t} CLEARANCE`);
export const docLabel = (t) => (t === 'full' ? 'FULL CLEARANCE ONLY' : `LEVEL ${t}`);

export const b64 = (buf) => { const u = new Uint8Array(buf); let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export const idOf = async (system, username) => hex(await subtle.digest('SHA-256', enc.encode(`${system}\u0000${String(username).trim().toLowerCase()}`)));

export async function kekFrom(password, salt, iterations) {
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export const aesKey = (raw) => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function seal(key, obj) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return b64(out);
}
export async function open(key, s) {
  const u = unb64(s);
  return JSON.parse(dec.decode(await subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, key, u.slice(12))));
}

/** Try one login. Returns the decrypted wrap (profile) or null. Does the same amount of key-derivation work whether or not the user exists. */
export async function unlock(vault, system, username, password) {
  const id = await idOf(system, username);
  const entry = vault.accounts.find((a) => a.id === id);
  const kek = await kekFrom(String(password), entry ? unb64(entry.salt) : new Uint8Array(16), vault.iterations);
  if (!entry) return null;
  try { return await open(kek, entry.wrap); } catch { return null; }
}

/** Opaque key under which a system's record blobs are stored, so the public file does not even name the systems. */
export const docsKey = (system) => idOf('docs', system);

/** Decrypt the records the given keys allow. Tiers without a key are not just hidden: they cannot be decrypted. */
export async function loadRecords(vault, system, keys) {
  const out = [];
  const blobs = vault.docs?.[await docsKey(system)] ?? [];   // blobs[i] holds the records of TIERS[i]
  for (const [i, t] of TIERS.entries()) {
    if (!keys?.[t]) continue;
    const blob = blobs[i];
    if (!blob) continue;
    const { records } = await open(await aesKey(unb64(keys[t])), blob);
    for (const r of records) out.push({ ref: r.ref, title: r.title, tags: r.tags ?? [], content: r.content, format: r.format ?? 'text', tier: t });
  }
  return out.sort((a, b) => RANK[a.tier] - RANK[b.tier] || a.ref.localeCompare(b.ref));
}

// ── Layers (the ENDERGATE access rule: level AND layer permission) ──────────────────────────────────────────
export const LAYERS = [
  { slug: 'gate', name: 'The Gate', ord: 1, min: 0, tagline: 'Every network begins at a door.' },
  { slug: 'index', name: 'The Index', ord: 2, min: 1, tagline: 'What is listed here was meant to be found.' },
  { slug: 'exchange', name: 'The Exchange', ord: 3, min: 2, tagline: 'Say it quietly.' },
  { slug: 'markets', name: 'The Markets', ord: 4, min: 2, tagline: 'Everything has a price. Most things have a fee.' },
  { slug: 'end', name: 'The End', ord: 5, min: 3, tagline: 'Past the last node, the signal thins.' },
];
/** Layers that exist in the static edition. The others needed a server (private channels, escrow, accounts) and are shown as unknown signals. */
export const AVAILABLE_LAYERS = ['gate', 'end'];
export function layerAccess(profile, slug) {
  const l = LAYERS.find((x) => x.slug === slug);
  if (!l || !AVAILABLE_LAYERS.includes(slug)) return false;
  if (slug === 'gate') return true;
  return !!profile && profile.level >= l.min && Array.isArray(profile.perms) && profile.perms.includes(`layer.${slug}`);
}

/** Hidden portals: found only by typing the exact name, and only by someone who may enter the End layer. */
export const PORTALS = [
  { slug: 'riid-classified', system: 'riid', name: 'RIID Classified Access', title: 'RIID — Classified Access', description: 'Separately authenticated RIID portal', href: 'riid.html', layer: 'end', short: 'RIID', tagline: 'Research · Intelligence · Investigation · Defense' },
  { slug: 'gov-top-secret', system: 'gov-top-secret', name: 'Government Top Secret', title: 'Government Top Secret', description: 'Separately authenticated government portal', href: 'gov-top-secret.html', layer: 'end', short: 'GOVERNMENT', tagline: 'Binod World Government — restricted systems' },
];
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
export function findPortals(profile, query) {
  const q = norm(query);
  if (q.length < 2) return [];
  return PORTALS.filter((p) => layerAccess(profile, p.layer) && (q === norm(p.name) || q === p.slug));
}
