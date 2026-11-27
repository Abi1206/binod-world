// Offline canvas world map for the RIID tracker (ported from the server prototype): flat (equirectangular) and globe (orthographic) views, drag/wheel/keyboard navigation.
// No tiles and no network requests: outlines come from ./world.js. Markers differ by SHAPE as well as colour (age bracket / status).
import { LAND } from './world.js';
import { clampView, project, unproject, pan, zoomAt, nearest, MIN_ZOOM, MAX_ZOOM, globeRadius, projectFlat, projectGlobe } from './geo.js';

export const SHAPE = { minor: 'triangle', '18-29': 'circle', '30-44': 'square', '45-59': 'diamond', '60+': 'plus' };
const STATUS_COLOR = { active: '#e879f9', located: '#4ade80', closed: '#9ca3af' };

export function createMap(canvas, { onSelect = () => {}, onView = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  let view = { mode: 'flat', lat: 20, lon: 10, zoom: 1, w: 800, h: 400 };
  let targets = [], live = new Map(), trails = new Map(), selected = null, drawn = [];
  const opt = { homes: true, trail: true, labels: false };
  let frame = 0;

  const css = (n, d) => getComputedStyle(canvas).getPropertyValue(n).trim() || d;

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(200, Math.round(r.width)), h = Math.max(160, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    view = clampView({ ...view, w, h });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    schedule();
  }

  const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); };
  const setView = (v) => { view = clampView(v); onView(describe()); schedule(); };

  function describe() { return { mode: view.mode, zoom: Math.round(view.zoom * 10) / 10, lat: Math.round(view.lat * 100) / 100, lon: Math.round(view.lon * 100) / 100 }; }

  function path(points, copy = 0) {
    let started = false;
    for (const [lon, lat] of points) {
      const p = view.mode === 'globe' ? projectGlobe(lat, lon, view) : projectFlat(lat, lon, view, copy);
      let { x, y } = p;
      if (view.mode === 'globe' && !p.visible) { // far side: pin to the limb so the fill still closes sensibly
        const cx = view.w / 2, cy = view.h / 2, d = Math.hypot(x - cx, y - cy) || 1, R = globeRadius(view);
        x = cx + ((x - cx) / d) * R; y = cy + ((y - cy) / d) * R;
      }
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
  }

  function graticule() {
    ctx.beginPath();
    for (let lat = -60; lat <= 60; lat += 30) line((t) => [lat, -180 + t * 360]);
    for (let lon = -180; lon < 180; lon += 30) line((t) => [-90 + t * 180, lon]);
    ctx.stroke();
  }
  function line(at) {
    let pen = false, prev = null;
    for (let i = 0; i <= 72; i++) {
      const [lat, lon] = at(i / 72), p = project(lat, lon, view);
      const jump = prev && view.mode === 'flat' && Math.abs(p.x - prev.x) > view.w / 2;
      if (!p.visible || jump) pen = false; else if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
      prev = p;
    }
  }

  function marker(shape, x, y, r) {
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
    else if (shape === 'square') ctx.rect(x - r, y - r, 2 * r, 2 * r);
    else if (shape === 'triangle') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r * 0.9); ctx.lineTo(x - r * 1.1, y + r * 0.9); ctx.closePath(); }
    else if (shape === 'diamond') { ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.3, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r * 1.3, y); ctx.closePath(); }
    else { const a = r * 0.45; ctx.moveTo(x - a, y - r); ctx.lineTo(x + a, y - r); ctx.lineTo(x + a, y - a); ctx.lineTo(x + r, y - a); ctx.lineTo(x + r, y + a); ctx.lineTo(x + a, y + a); ctx.lineTo(x + a, y + r); ctx.lineTo(x - a, y + r); ctx.lineTo(x - a, y + a); ctx.lineTo(x - r, y + a); ctx.lineTo(x - r, y - a); ctx.lineTo(x - a, y - a); ctx.closePath(); }
  }

  function draw() {
    const { w, h } = view, globe = view.mode === 'globe';
    ctx.clearRect(0, 0, w, h);
    const sea = css('--map-sea', '#0a0414'), land = css('--map-land', '#2a1634'), edge = css('--map-edge', '#7a4d8a'), grid = css('--map-grid', '#3a2347');
    ctx.save();
    if (globe) { ctx.beginPath(); ctx.arc(w / 2, h / 2, globeRadius(view), 0, Math.PI * 2); ctx.clip(); }
    ctx.fillStyle = sea; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = grid; ctx.lineWidth = 1; graticule();
    ctx.fillStyle = land; ctx.strokeStyle = edge; ctx.lineWidth = 1;
    for (const k of globe ? [0] : [-1, 0, 1]) for (const [, pts] of LAND) { ctx.beginPath(); path(pts, k); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    if (globe) { ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(w / 2, h / 2, globeRadius(view), 0, Math.PI * 2); ctx.stroke(); }

    drawn = [];
    const sel = targets.find((t) => t.id === selected);
    if (opt.homes) for (const t of targets) { const p = project(t.home.lat, t.home.lon, view); if (!p.visible) continue; ctx.strokeStyle = '#d8b4fe'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.stroke(); }
    if (sel) { // selected target: dashed line from home to live position, and the last hour of its trail
      const a = project(sel.home.lat, sel.home.lon, view), l = live.get(sel.id) ?? sel.live, b = project(l.lat, l.lon, view);
      if (a.visible && b.visible && opt.homes) { ctx.setLineDash([4, 4]); ctx.strokeStyle = '#d8b4fe'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
      const tr = opt.trail ? trails.get(sel.id) : null;
      if (tr?.length > 1) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); let pen = false; for (const q of tr) { const p = project(q.lat, q.lon, view); if (!p.visible) { pen = false; continue; } pen ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); pen = true; } ctx.stroke(); }
    }
    for (const t of targets) {
      const l = live.get(t.id) ?? t.live, p = project(l.lat, l.lon, view);
      if (!p.visible || p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20) continue;
      const isSel = t.id === selected, r = isSel ? 8 : 5;
      drawn.push({ id: t.id, x: p.x, y: p.y });
      ctx.fillStyle = STATUS_COLOR[t.status] ?? '#e879f9'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      marker(SHAPE[t.bracket] ?? 'circle', p.x, p.y, r); ctx.fill(); ctx.stroke();
      if (l.source === 'reported') { ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke(); }
      if (isSel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2); ctx.stroke(); }
      if (isSel || (opt.labels && view.zoom >= 3)) { ctx.fillStyle = '#fff'; ctx.font = '12px system-ui, sans-serif'; ctx.fillText(`${t.name}, ${t.age}`, p.x + r + 9, p.y + 4); }
    }
    ctx.fillStyle = '#c4b5d0'; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('FICTIONAL · SIMULATED · schematic offline map', 8, h - 8);
  }

  // --- interaction -----------------------------------------------------------------------------------------------------------------
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) drag.moved = true;
    if (drag.moved) { drag.x = e.clientX; drag.y = e.clientY; setView(pan(view, dx, dy)); }
  });
  const end = (e) => {
    if (!drag) return;
    if (!drag.moved && e.type === 'pointerup') {
      const r = canvas.getBoundingClientRect(), hit = nearest(drawn, e.clientX - r.left, e.clientY - r.top, 14);
      if (hit) onSelect(hit.id);
    }
    drag = null;
  };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); setView(zoomAt(view, e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top)); }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const step = 60, keys = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (keys[e.key]) { e.preventDefault(); setView(pan(view, ...keys[e.key])); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); setView(zoomAt(view, 1.5)); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setView(zoomAt(view, 1 / 1.5)); }
    else if (e.key === '0') { e.preventDefault(); reset(); }
  });
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; ro?.observe(canvas);
  addEventListener('resize', resize);

  function reset() { setView({ ...view, lat: 20, lon: 10, zoom: 1 }); }
  function focusOn(lat, lon, zoom = Math.max(view.zoom, 4)) { setView({ ...view, lat, lon, zoom }); }
  resize();

  return {
    setTargets(list) { targets = list; schedule(); },
    setLive(positions) { live = new Map(positions.map((p) => [p.id, p])); schedule(); },
    setTrail(id, trail) { trails.set(id, trail); schedule(); },
    select(id) { selected = id; schedule(); },
    setOptions(o) { Object.assign(opt, o); schedule(); },
    setMode(mode) { setView({ ...view, mode, zoom: 1 }); },
    zoomBy(f) { setView(zoomAt(view, f)); },
    panBy(dx, dy) { setView(pan(view, dx, dy)); },
    focusOn, reset,
    getView: () => ({ ...view }),
    /** Test/diagnostic hook: screen positions of the markers currently drawn. */
    markers: () => drawn.map((d) => ({ ...d })),
    unproject: (x, y) => unproject(x, y, view),
    limits: { MIN_ZOOM, MAX_ZOOM },
    destroy() { ro?.disconnect(); removeEventListener('resize', resize); cancelAnimationFrame(frame); },
  };
}
