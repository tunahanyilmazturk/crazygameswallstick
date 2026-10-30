/*
 * Small animation toolkit shared by the hero and the army: progress through a phase of an
 * action, easing curves, keyframed values and 2D point helpers. Phases are written against
 * u = time since the action / length of its cycle, so faster units simply run them faster.
 */

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Progress of u through [a, b], clamped to 0..1. */
export const span = (u, a, b) => clamp01((u - a) / (b - a));
export const easeOut = (k) => 1 - (1 - k) ** 3;
export const easeIn = (k) => k * k * k;
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
/** 0 → 1 → 0 over k = 0..1. */
export const bump = (k) => Math.sin(Math.PI * clamp01(k));
export const mix = (a, b, k) => a + (b - a) * k;

/** Keyframed number: list = [[u, value], ...] in order, eased between neighbours. */
export function keys(u, list, ease = easeInOut) {
  if (u <= list[0][0]) return list[0][1];
  for (let i = 1; i < list.length; i++) {
    const [u1, v1] = list[i];
    if (u <= u1) {
      const [u0, v0] = list[i - 1];
      return mix(v0, v1, ease((u - u0) / (u1 - u0 || 1)));
    }
  }
  return list[list.length - 1][1];
}

/** Keyframed point: list = [[u, [x, y]], ...]. */
export const keys2 = (u, list, ease = easeInOut) => [
  keys(u, list.map(([k, p]) => [k, p[0]]), ease),
  keys(u, list.map(([k, p]) => [k, p[1]]), ease),
];

// 2D points as [x, y]
export const add = (p, q, k = 1) => [p[0] + q[0] * k, p[1] + q[1] * k];
export const mix2 = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
export const polar = (p, a, r) => [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
export const dirOf = (a) => [Math.cos(a), Math.sin(a)];
/** Unit vector from p toward q. */
export function toward(p, q) {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}
/** Point offset from o by (x, y) scaled by s. */
export const off = (o, x, y, s = 1) => [o[0] + x * s, o[1] + y * s];
/** Stable pseudo-random 0..1 from a number, for flicker that holds within a frame. */
export function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Runs `fn` mirrored about x when f < 0 so art can be written facing right. Joint positions
 * it returns are mapped back to screen space (callers place insignia over the head).
 */
export function facing(ctx, x, f, fn) {
  if (f >= 0) return fn();
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(-1, 1);
  ctx.translate(-x, 0);
  const j = fn();
  ctx.restore();
  return j && { ...j, head: [2 * x - j.head[0], j.head[1]] };
}

/** Filled polygon from points, with an optional outline. */
export function poly(ctx, pts, fill, stroke, lw = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** A straight line between two points. */
export function line(ctx, p, q, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(q[0], q[1]);
  ctx.stroke();
}

export function dot(ctx, p, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
  ctx.fill();
}
