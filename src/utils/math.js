export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Blend two colours given as '#rrggbb' or 'rgb(r,g,b)'. */
export function lerpColor(c1, c2, t) {
  const a = parseColor(c1);
  const b = parseColor(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

function parseColor(c) {
  return c.charCodeAt(0) === 35 ? hexToRgb(c) : c.match(/\d+/g).map(Number);
}

const rgbCache = new Map();
export function hexToRgb(hex) {
  let c = rgbCache.get(hex);
  if (c) return c;
  const h = hex.replace('#', '');
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  rgbCache.set(hex, c);
  return c;
}

/** Launch velocity for a ballistic shot from (sx,sy) to (tx,ty) under gravity g. */
export function ballistic(sx, sy, tx, ty, g, speed = 1300, minT = 0.3, maxT = 1.5) {
  const dx = tx - sx;
  const t = clamp(Math.abs(dx) / speed + 0.15, minT, maxT);
  return { vx: dx / t, vy: (ty - sy - 0.5 * g * t * t) / t, t };
}

/** Seeded PRNG so the scenery is the same every load. */
export function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
