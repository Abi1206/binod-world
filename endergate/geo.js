// Pure map maths (no DOM): equirectangular and orthographic (globe) projections, panning/zooming, hit testing. Used by the offline tracker map.
// A "view" is { mode: 'flat'|'globe', lat, lon, zoom, w, h }: the centre of the view, a zoom factor (1 = whole world), and the canvas size in CSS pixels.

export const MIN_ZOOM = 1, MAX_ZOOM = 64;
const RAD = Math.PI / 180;

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const wrapLon = (x) => ((((x + 180) % 360) + 360) % 360) - 180;

/** Pixels per degree in flat mode (zoom 1 fits 360 degrees across the canvas width). */
export const flatScale = (v) => (v.w / 360) * v.zoom;
/** Globe radius in pixels. */
export const globeRadius = (v) => (Math.min(v.w, v.h) / 2 - 6) * v.zoom;

/** Keeps the view valid: zoom in range, latitude such that the flat map never shows empty space above/below the poles, longitude wrapped. */
export function clampView(v) {
  const zoom = clamp(v.zoom, MIN_ZOOM, MAX_ZOOM);
  let lat = clamp(v.lat, -90, 90);
  if (v.mode === 'flat') {
    const halfLat = v.h / 2 / flatScale({ ...v, zoom });
    lat = halfLat >= 90 ? 0 : clamp(lat, -90 + halfLat, 90 - halfLat);
  }
  return { ...v, zoom, lat, lon: wrapLon(v.lon) };
}

/** Flat projection of a point; `k` shifts the copy by k*360 degrees so the map can repeat across the antimeridian. */
export function projectFlat(lat, lon, v, k = 0) {
  const s = flatScale(v);
  return { x: v.w / 2 + (lon + 360 * k - v.lon) * s, y: v.h / 2 - (lat - v.lat) * s, visible: true };
}
export function unprojectFlat(x, y, v) {
  const s = flatScale(v);
  return { lat: clamp(v.lat - (y - v.h / 2) / s, -90, 90), lon: wrapLon(v.lon + (x - v.w / 2) / s) };
}

/** Orthographic projection; `visible` is false for points on the far side of the globe. */
export function projectGlobe(lat, lon, v) {
  const R = globeRadius(v), phi = lat * RAD, lam = (lon - v.lon) * RAD, phi0 = v.lat * RAD;
  const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
  const x = R * Math.cos(phi) * Math.sin(lam);
  const y = R * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lam));
  return { x: v.w / 2 + x, y: v.h / 2 - y, visible: cosc >= 0 };
}
export function unprojectGlobe(px, py, v) {
  const R = globeRadius(v), x = (px - v.w / 2) / R, y = -(py - v.h / 2) / R, rho = Math.hypot(x, y);
  if (rho > 1) return null;
  const c = Math.asin(rho), phi0 = v.lat * RAD;
  if (rho === 0) return { lat: v.lat, lon: wrapLon(v.lon) };
  const lat = Math.asin(Math.cos(c) * Math.sin(phi0) + (y * Math.sin(c) * Math.cos(phi0)) / rho) / RAD;
  const lon = v.lon + Math.atan2(x * Math.sin(c), rho * Math.cos(phi0) * Math.cos(c) - y * Math.sin(phi0) * Math.sin(c)) / RAD;
  return { lat, lon: wrapLon(lon) };
}

/** Projects with the view's mode. Flat mode picks the copy of the world nearest the view centre. */
export function project(lat, lon, v) {
  if (v.mode === 'globe') return projectGlobe(lat, lon, v);
  const k = Math.round((v.lon - lon) / 360);
  return projectFlat(lat, lon, v, k);
}
export function unproject(x, y, v) { return v.mode === 'globe' ? unprojectGlobe(x, y, v) : unprojectFlat(x, y, v); }

/** Pans by a screen-space drag of (dx, dy) pixels. Dragging moves the map with the pointer. */
export function pan(v, dx, dy) {
  if (v.mode === 'flat') {
    const s = flatScale(v);
    return clampView({ ...v, lon: v.lon - dx / s, lat: v.lat + dy / s });
  }
  const perPx = (180 / Math.PI) / globeRadius(v); // degrees per pixel at the centre of the globe
  return clampView({ ...v, lon: v.lon - dx * perPx / Math.max(Math.cos(v.lat * RAD), 0.15), lat: v.lat + dy * perPx });
}

/** Zooms by `factor` keeping the geographic point under (px, py) fixed in flat mode; the globe zooms about its centre. */
export function zoomAt(v, factor, px = v.w / 2, py = v.h / 2) {
  const zoom = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  if (v.mode === 'globe' || zoom === v.zoom) return clampView({ ...v, zoom });
  const g = unprojectFlat(px, py, v);
  const s = flatScale({ ...v, zoom });
  // keep g under the pointer: centre = g - (pointer - middle)/scale
  return clampView({ ...v, zoom, lon: g.lon - (px - v.w / 2) / s, lat: g.lat + (py - v.h / 2) / s });
}

/** The nearest marker within `radius` px of (x, y), or null. `points` = [{ id, x, y }]. Ties go to the earlier point. */
export function nearest(points, x, y, radius = 12) {
  let best = null, bd = radius * radius;
  for (const p of points) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd || (best === null && d <= bd)) { best = p; bd = d; } }
  return best;
}

/** Great-circle distance in km (same formula as the server). */
export function distanceKm(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * RAD, dLon = (bLon - aLon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatCoord(lat, lon) {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
}
