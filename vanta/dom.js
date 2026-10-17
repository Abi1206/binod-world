// DOM helpers shared by every page. Deliberately has NO network code (the static ENDERGATE console imports only this file).
/** Safe element builder: text is always set via textContent, never innerHTML. */
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}

/** Turns \u0001..\u0002 highlight markers from the server into <mark> elements without ever touching innerHTML. */
export function highlight(text) {
  const frag = document.createDocumentFragment();
  let open = false;
  for (const part of String(text).split(/([\u0001\u0002])/)) {
    if (part === '\u0001') open = true;
    else if (part === '\u0002') open = false;
    else if (part) frag.append(open ? el('mark', {}, part) : document.createTextNode(part));
  }
  return frag;
}
