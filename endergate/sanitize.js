// Turns a decrypted HTML record into safe DOM nodes. The record text is the owner's own, but it is still treated as untrusted markup:
// only an allow-list of plain document tags, a few attributes and in-page links survive. No script, style, image, frame, form, event handler or external link.
const TAGS = new Set(['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'label', 'a', 'small', 'sup', 'sub', 'blockquote', 'pre', 'code']);
const DROP = new Set(['script', 'style', 'iframe', 'frame', 'object', 'embed', 'img', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta', 'base', 'video', 'audio', 'source', 'template', 'noscript', 'title', 'head']);
const CLASS_OK = /^[A-Za-z0-9_ -]{1,120}$/;
const ID_OK = /^[A-Za-z0-9_-]{1,60}$/;

function copy(src, doc) {
  const out = doc.createDocumentFragment();
  for (const n of src.childNodes) {
    if (n.nodeType === 3) { out.append(doc.createTextNode(n.nodeValue)); continue; }        // text
    if (n.nodeType !== 1) continue;                                                           // comments and everything else vanish
    const tag = n.tagName.toLowerCase();
    if (DROP.has(tag)) continue;                                                              // dropped with its contents
    if (!TAGS.has(tag)) { out.append(copy(n, doc)); continue; }                               // unknown wrapper: keep the text, lose the tag
    const e = doc.createElement(tag);
    const cls = n.getAttribute('class'); if (cls && CLASS_OK.test(cls)) e.setAttribute('class', cls);
    const id = n.getAttribute('id'); if (id && ID_OK.test(id)) e.setAttribute('id', id);
    if (tag === 'a') { const h = n.getAttribute('href'); if (h && /^#[A-Za-z0-9_-]{1,60}$/.test(h)) e.setAttribute('href', h); }
    e.append(copy(n, doc));
    out.append(e);
  }
  return out;
}

/** html string -> DocumentFragment of safe nodes (never touches innerHTML of the live page). */
export function safeFragment(html, doc = document) {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');   // inert: scripts do not run, images do not load
  return copy(parsed.body, doc);
}
