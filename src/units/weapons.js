import { INK } from '../core/constants.js';
import { add, dirOf, dot, line, poly } from '../render/anim.js';
import { tone } from './kit.js';

/*
 * Hand-held kit drawn in canvas space: blades, shafts, shields and bombs. Angles are canvas
 * angles (0 = right, +y down); `grip` is where the hand closes.
 */

/** Sword with crossguard, wrapped grip and pommel. o: { len, w, guard, handle, steel, hilt } */
export function sword(ctx, grip, a, s, o = {}) {
  const d = dirOf(a);
  const n = [-d[1], d[0]];
  const len = (o.len ?? 30) * s;
  const w = (o.w ?? 1.6) * s;
  const guard = (o.guard ?? 5) * s;
  const handle = (o.handle ?? 6) * s;
  const hilt = o.hilt ?? '#b8925a';
  const base = add(grip, d, 3 * s);
  const tip = add(grip, d, len);
  const neck = add(tip, d, -4 * s);
  poly(ctx, [add(base, n, w), add(neck, n, w * 0.85), tip, add(neck, n, -w * 0.85), add(base, n, -w)], o.steel ?? '#d5dce4', INK, 0.9 * s);
  line(ctx, add(base, d, 1 * s), add(neck, d, -2 * s), 'rgba(105,116,132,0.75)', 0.7 * s);
  const cg = add(grip, d, 2.5 * s);
  line(ctx, add(cg, n, guard), add(cg, n, -guard), INK, 2.6 * s);
  line(ctx, add(cg, n, guard), add(cg, n, -guard), hilt, 1.3 * s);
  line(ctx, add(grip, d, -handle), add(grip, d, 2 * s), '#3b2a1c', 2.3 * s);
  dot(ctx, add(grip, d, -handle - 1.3 * s), 1.8 * s, hilt);
}

/** Translucent arc left by a fast swing, between angles a0 and a1 around c. */
export function smear(ctx, c, a0, a1, r0, r1, alpha) {
  if (alpha <= 0.02) return;
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  ctx.fillStyle = `rgba(255,250,235,${alpha})`;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r1, lo, hi);
  ctx.arc(c[0], c[1], r0, hi, lo, true);
  ctx.closePath();
  ctx.fill();
}

/** Spear or javelin held at `grip`, `back` of its length behind the hand. */
export function spear(ctx, grip, a, s, o = {}) {
  const d = dirOf(a);
  const n = [-d[1], d[0]];
  const tail = add(grip, d, -(o.back ?? 16) * s);
  const tip = add(grip, d, (o.front ?? 18) * s);
  line(ctx, tail, tip, INK, 2.6 * s);
  line(ctx, tail, tip, o.wood ?? '#8a6236', 1.4 * s);
  line(ctx, add(grip, d, -2.5 * s), add(grip, d, 2.5 * s), '#3b2a1c', 2.6 * s);
  const hl = (o.head ?? 6) * s;
  poly(ctx, [add(tip, d, hl), add(add(tip, d, 1 * s), n, 1.9 * s), tip, add(add(tip, d, 1 * s), n, -1.9 * s)], '#d9e0e8', INK, 0.8 * s);
  return tip;
}

/** Crossbow bolt or arrow lying from `tail` along d for `len`. */
export function bolt(ctx, tail, d, len, s, fletch = '#c8312b') {
  const n = [-d[1], d[0]];
  const tip = add(tail, d, len);
  line(ctx, tail, tip, INK, 2 * s);
  line(ctx, tail, tip, '#cdb68a', 1 * s);
  poly(ctx, [add(tip, d, 3.5 * s), add(tip, n, 1.6 * s), add(tip, n, -1.6 * s)], '#c9ced8', INK, 0.6 * s);
  for (const k of [1, -1]) poly(ctx, [tail, add(add(tail, d, 2.5 * s), n, 1.7 * k * s), add(tail, d, 4.5 * s)], fletch);
}

/** Heater shield facing the viewer, centred on c. o: { w, h, color, rim, emblem } */
export function heater(ctx, c, s, o = {}) {
  const w = (o.w ?? 6) * s;
  const h = (o.h ?? 9) * s;
  const [x, y] = c;
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(x - w, y - h);
    ctx.lineTo(x + w, y - h);
    ctx.quadraticCurveTo(x + w, y + h * 0.35, x, y + h);
    ctx.quadraticCurveTo(x - w, y + h * 0.35, x - w, y - h);
    ctx.closePath();
  };
  outline();
  ctx.fillStyle = o.color ?? '#2f5fae';
  ctx.fill();
  // Shaded far half
  ctx.fillStyle = tone(o.color ?? '#2f5fae', 0.78);
  ctx.beginPath();
  ctx.moveTo(x - w, y - h);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x, y + h);
  ctx.quadraticCurveTo(x - w, y + h * 0.35, x - w, y - h);
  ctx.fill();
  if (o.emblem) {
    ctx.strokeStyle = o.emblem;
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.75, y - h * 0.35);
    ctx.lineTo(x, y + h * 0.15);
    ctx.lineTo(x + w * 0.75, y - h * 0.35);
    ctx.stroke();
  }
  outline();
  ctx.strokeStyle = o.rim ?? '#e2b33c';
  ctx.lineWidth = 1.3 * s;
  ctx.stroke();
  outline();
  ctx.strokeStyle = 'rgba(20,18,25,0.9)';
  ctx.lineWidth = 0.6 * s;
  ctx.stroke();
}

/** Black powder bomb; `lit` shows the burning fuse. */
export function bomb(ctx, c, r, s, t, lit) {
  dot(ctx, c, r, '#2a262c');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.arc(c[0], c[1], r, 0, Math.PI * 2);
  ctx.stroke();
  dot(ctx, [c[0] - r * 0.35, c[1] - r * 0.35], r * 0.3, 'rgba(255,255,255,0.35)');
  ctx.fillStyle = '#8d96a3';
  ctx.fillRect(c[0] + r * 0.3, c[1] - r * 1.15, 2.2 * s, 1.8 * s);
  const fx = c[0] + r * 0.4 + 1.1 * s;
  const fy = c[1] - r * 1.15;
  const end = [fx + 2.5 * s, fy - 3.5 * s];
  ctx.strokeStyle = '#c9b58a';
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.quadraticCurveTo(fx - 0.5 * s, fy - 2.5 * s, end[0], end[1]);
  ctx.stroke();
  if (lit) {
    const f = 1 + Math.sin(t * 40) * 0.35;
    ctx.globalCompositeOperation = 'lighter';
    dot(ctx, end, 3.2 * s * f, 'rgba(255,170,60,0.35)');
    dot(ctx, end, 1.4 * s, '#fff1b8');
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = '#ffcf6a';
    ctx.lineWidth = 0.7 * s;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = t * 9 + i * 1.7;
      ctx.moveTo(end[0], end[1]);
      ctx.lineTo(end[0] + Math.cos(a) * 3 * s * f, end[1] + Math.sin(a) * 3 * s * f);
    }
    ctx.stroke();
  }
}
