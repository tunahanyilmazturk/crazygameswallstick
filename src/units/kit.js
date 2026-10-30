import { INK } from '../core/constants.js';

/*
 * Shared costume pieces for the army's stick figures: garments that hang off the torso,
 * capes, helmets, hoods and beards. Everything is drawn facing right (callers mirror with
 * facing()) and takes the joints drawFigure returns (or hands to its `body` hook).
 */

// Accepts '#rrggbb' or 'rgb(r,g,b)' (status tints hand costume colours over as rgb())
const rgbOf = (c) => {
  if (c.charCodeAt(0) !== 35) return c.match(/\d+/g).slice(0, 3).map(Number);
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** A colour darkened (k < 1) or lightened toward white (k > 1). */
export function tone(hex, k) {
  const c = rgbOf(hex).map((v) => Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)));
  return `rgb(${c.join(',')})`;
}
export const glass = (hex, a) => `rgba(${rgbOf(hex).join(',')},${a})`;

const OUTLINE = 'rgba(20,18,25,0.92)';

/** Unit vectors of the torso: d runs neck → hip, p points forward (the way it faces). */
export function torso(j) {
  const dx = j.hip[0] - j.neck[0];
  const dy = j.hip[1] - j.neck[1];
  const l = Math.hypot(dx, dy) || 1;
  return { d: [dx / l, dy / l], p: [dy / l, -dx / l] };
}

const at = (o, d, kd, p, kp) => [o[0] + d[0] * kd + p[0] * kp, o[1] + d[1] * kd + p[1] * kp];

function shape(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/**
 * Tunic, robe or tabard hanging from the shoulders. o: { color, length (below the hip),
 * wTop, wHip, hem (half width at the hem), sway (hem drift), trim, belt, top (0..1 down the torso) }
 */
export function garment(ctx, j, o) {
  const s = j.s ?? 1;
  const { d, p } = torso(j);
  const top = [j.neck[0] + (j.hip[0] - j.neck[0]) * (o.top ?? 0.1), j.neck[1] + (j.hip[1] - j.neck[1]) * (o.top ?? 0.1)];
  const wT = (o.wTop ?? 5) * s;
  const wH = (o.wHip ?? 6) * s;
  const hemW = (o.hem ?? 8) * s;
  const len = (o.length ?? 9) * s;
  const sway = (o.sway ?? 0) * s;
  const hemC = at(j.hip, d, len, p, sway * 0.5);
  const hemF = [hemC[0] + hemW + sway, hemC[1] - 1 * s];
  const hemB = [hemC[0] - hemW + sway * 1.2, hemC[1] + 0.5 * s];
  const front = [at(top, d, 0, p, wT), at(j.hip, d, 0, p, wH), hemF];
  const back = [hemB, at(j.hip, d, 0, p, -wH), at(top, d, 0, p, -wT)];
  shape(ctx, [...front, hemC, ...back]);
  ctx.fillStyle = o.color;
  ctx.fill();
  // The far half in shade gives the cloth some roundness
  shape(ctx, [top, j.hip, hemC, ...back]);
  ctx.fillStyle = tone(o.color, 0.78);
  ctx.fill();
  shape(ctx, [...front, hemC, ...back]);
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9 * s;
  ctx.stroke();
  if (o.trim) {
    ctx.strokeStyle = o.trim;
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(hemB[0], hemB[1] - 1 * s);
    ctx.lineTo(hemC[0], hemC[1] - 1 * s);
    ctx.lineTo(hemF[0], hemF[1] - 1 * s);
    ctx.stroke();
  }
  if (o.belt) {
    const b = at(j.hip, d, -2 * s, p, 0);
    ctx.strokeStyle = o.belt;
    ctx.lineWidth = 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(...at(b, d, 0, p, -wH - 0.3 * s));
    ctx.lineTo(...at(b, d, 0, p, wH + 0.3 * s));
    ctx.stroke();
    if (o.buckle) {
      ctx.fillStyle = o.buckle;
      ctx.fillRect(b[0] + p[0] * wH * 0.6 - 1.2 * s, b[1] - 1.4 * s, 2.4 * s, 2.8 * s);
    }
  }
}

/** Breastplate over the chest, with a highlight down the front. */
export function cuirass(ctx, j, color) {
  const s = j.s ?? 1;
  const { d, p } = torso(j);
  const top = [j.neck[0] + (j.hip[0] - j.neck[0]) * 0.12, j.neck[1] + (j.hip[1] - j.neck[1]) * 0.12];
  const pts = [at(top, d, 0, p, -5 * s), at(top, d, 0, p, 6 * s), at(j.hip, d, -4 * s, p, 6.5 * s), at(j.hip, d, -1 * s, p, 0), at(j.hip, d, -4 * s, p, -5 * s)];
  shape(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9 * s;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1 * s;
  ctx.beginPath();
  ctx.moveTo(...at(top, d, 2 * s, p, 3.5 * s));
  ctx.lineTo(...at(j.hip, d, -5 * s, p, 4 * s));
  ctx.stroke();
}

/** Rounded plate over the shoulder. */
export function pauldron(ctx, j, color) {
  const s = j.s ?? 1;
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.ellipse(j.sh[0] + 0.5 * s, j.sh[1] + 0.5 * s, 4.6 * s, 3.4 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

/** Cape hanging from the shoulders, streaming back; flow 0..1 lifts it (running, wind). */
export function cape(ctx, j, color, sway = 0, flow = 0) {
  const s = j.s ?? 1;
  const n = j.neck;
  const tipX = n[0] - (10 + flow * 14) * s + sway * s;
  const tipY = j.hip[1] + (8 - flow * 12) * s;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(n[0] + 2 * s, n[1] + 1 * s);
  ctx.quadraticCurveTo(n[0] - (8 + flow * 6) * s + sway * 0.5 * s, (n[1] + tipY) / 2, tipX, tipY);
  ctx.lineTo(tipX + (6 - flow * 2) * s, tipY - (1 + flow * 3) * s);
  ctx.quadraticCurveTo(n[0] - 2 * s, (n[1] + tipY) / 2, n[0] - 1 * s, n[1] + 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = tone(color, 0.7);
  ctx.beginPath();
  ctx.moveTo(n[0] - 1 * s, n[1] + 3 * s);
  ctx.quadraticCurveTo(n[0] - (4 + flow * 4) * s, (n[1] + tipY) / 2, tipX + (4 - flow) * s, tipY - (1 + flow * 2) * s);
  ctx.lineTo(tipX + (6 - flow * 2) * s, tipY - (1 + flow * 3) * s);
  ctx.quadraticCurveTo(n[0] - 2 * s, (n[1] + tipY) / 2, n[0] - 1 * s, n[1] + 4 * s);
  ctx.closePath();
  ctx.fill();
}

/** A tuft of feathers or horsehair sweeping back off the top of a helmet. */
export function plume(ctx, base, color, s = 1, flow = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(base[0] + 1 * s, base[1]);
  ctx.quadraticCurveTo(base[0] - (4 + flow * 4) * s, base[1] - (8 - flow * 3) * s, base[0] - (13 + flow * 6) * s, base[1] + (2 - flow * 4) * s);
  ctx.quadraticCurveTo(base[0] - (6 + flow * 2) * s, base[1] - 1 * s, base[0] - 2 * s, base[1] + 2 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(base[0], base[1] - 0.5 * s);
  ctx.quadraticCurveTo(base[0] - 4 * s, base[1] - (6.5 - flow * 2) * s, base[0] - (9 + flow * 4) * s, base[1] - (1 + flow * 3) * s);
  ctx.quadraticCurveTo(base[0] - 4 * s, base[1] - 3 * s, base[0], base[1] - 0.5 * s);
  ctx.fill();
}

/**
 * Head gear. kind: 'kettle' (brimmed war hat), 'nasal' (pointed with a nose guard),
 * 'great' (closed bucket helm with an eye slit), 'cap' (leather cap), 'bandana'.
 * Returns the crest point for a plume.
 */
export function helm(ctx, j, kind, color, trim = null) {
  const s = j.s ?? 1;
  const r = j.headR;
  const [hx, hy] = j.head;
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  if (kind === 'kettle') {
    ctx.arc(hx, hy - 0.5 * s, r + 1 * s, Math.PI, 0);
    ctx.lineTo(hx + r + 3.5 * s, hy + 0.5 * s);
    ctx.lineTo(hx - r - 3.5 * s, hy + 0.5 * s);
    ctx.closePath();
  } else if (kind === 'nasal') {
    ctx.moveTo(hx - r - 0.8 * s, hy + 1 * s);
    ctx.quadraticCurveTo(hx - r, hy - r * 1.3, hx + 0.5 * s, hy - r - 3.5 * s);
    ctx.quadraticCurveTo(hx + r, hy - r * 1.2, hx + r + 0.8 * s, hy + 1 * s);
    ctx.closePath();
  } else if (kind === 'great') {
    ctx.moveTo(hx - r - 0.8 * s, hy + r + 1 * s);
    ctx.lineTo(hx - r - 1 * s, hy - r + 0.5 * s);
    ctx.quadraticCurveTo(hx, hy - r - 2.5 * s, hx + r + 1 * s, hy - r + 0.5 * s);
    ctx.lineTo(hx + r + 1.3 * s, hy + r + 1 * s);
    ctx.closePath();
  } else if (kind === 'cap') {
    ctx.arc(hx, hy - 0.3 * s, r + 0.8 * s, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(hx + r + 2.5 * s, hy - 1.5 * s);
    ctx.closePath();
  } else if (kind === 'bandana') {
    ctx.arc(hx, hy, r + 0.6 * s, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  if (kind === 'nasal') {
    ctx.fillStyle = color;
    ctx.fillRect(hx + r * 0.45, hy - 1 * s, 1.4 * s, 4.5 * s);
  }
  if (kind === 'great') {
    // Eye slit and breathing holes
    ctx.fillStyle = INK;
    ctx.fillRect(hx - r * 0.2, hy - 1.6 * s, r + 1.3 * s, 1.5 * s);
    ctx.fillStyle = 'rgba(20,18,25,0.6)';
    for (const k of [0, 1]) ctx.fillRect(hx + r * 0.45, hy + (1.6 + k * 1.8) * s, 1 * s, 1 * s);
  }
  if (kind === 'bandana') {
    // Knot tails flap behind the head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.8, hy - r * 0.4);
    ctx.lineTo(hx - r - 5 * s, hy - r * 0.1);
    ctx.lineTo(hx - r - 4 * s, hy + r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  if (trim) {
    ctx.strokeStyle = trim;
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    if (kind === 'great') {
      ctx.moveTo(hx + r * 0.6, hy - r - 0.5 * s);
      ctx.lineTo(hx + r * 0.6, hy + r);
    } else {
      ctx.moveTo(hx - r - 0.5 * s, hy - 0.5 * s);
      ctx.lineTo(hx + r + 0.5 * s, hy - 0.5 * s);
    }
    ctx.stroke();
  }
  return kind === 'nasal' ? [hx + 0.5 * s, hy - r - 3 * s] : [hx, hy - r - 1 * s];
}

/** Hood over the head with a shadowed face opening; `eye` lights a glint (or a glow) inside. */
export function hood(ctx, j, color, eye = '#f3e2b3', glow = false) {
  const s = j.s ?? 1;
  const r = j.headR;
  const [hx, hy] = j.head;
  // A cowl: rounded over the head, falling to the shoulders behind
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(hx + r * 0.95, hy + r * 0.85);
  ctx.quadraticCurveTo(hx + r * 1.45, hy - r * 0.2, hx + r * 0.7, hy - r * 1.05);
  ctx.quadraticCurveTo(hx - r * 0.2, hy - r * 1.75, hx - r * 1.1, hy - r * 0.8);
  ctx.quadraticCurveTo(hx - r * 1.7, hy + r * 0.4, hx - r * 1.6, hy + r * 1.7);
  ctx.quadraticCurveTo(hx - r * 0.4, hy + r * 1.9, hx + r * 0.95, hy + r * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.8 * s;
  ctx.stroke();
  ctx.fillStyle = 'rgba(16,13,20,0.9)';
  ctx.beginPath();
  ctx.ellipse(hx + r * 0.35, hy + r * 0.2, r * 0.45, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  if (glow) {
    ctx.fillStyle = glass(eye, 0.35);
    ctx.beginPath();
    ctx.arc(hx + r * 0.5, hy + r * 0.05, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(hx + r * 0.5, hy + r * 0.05, Math.max(0.7, r * 0.15), 0, Math.PI * 2);
  ctx.fill();
}

/** Pointed wizard hat with a brim; the tip flops back with `sway`. */
export function wizardHat(ctx, j, color, band, sway = 0) {
  const s = j.s ?? 1;
  const r = j.headR;
  const [hx, hy] = j.head;
  const base = hy - r * 0.45;
  ctx.fillStyle = color;
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.95, base);
  ctx.quadraticCurveTo(hx - r * 0.2, base - 14 * s, hx - (6 - sway) * s, base - (22 - Math.abs(sway) * 0.3) * s);
  ctx.quadraticCurveTo(hx + r * 0.3, base - 10 * s, hx + r * 0.95, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Brim
  ctx.beginPath();
  ctx.ellipse(hx, base + 0.5 * s, r + 5 * s, 2.1 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = tone(color, 0.85);
  ctx.fill();
  ctx.stroke();
  if (band) {
    ctx.fillStyle = band;
    ctx.fillRect(hx - r * 0.85, base - 3 * s, r * 1.7, 2 * s);
  }
}

/** Long beard hanging from the chin. */
export function beard(ctx, j, color, sway = 0) {
  const s = j.s ?? 1;
  const r = j.headR;
  const [hx, hy] = j.head;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.1, hy + r * 0.2);
  ctx.quadraticCurveTo(hx + r * 1.3, hy + r * 0.4, hx + r * 1.0, hy + r * 0.9);
  ctx.quadraticCurveTo(hx + r * 0.6 + sway * s, hy + r * 2.4, hx + r * 0.1 + sway * s, hy + r * 2.9);
  ctx.quadraticCurveTo(hx - r * 0.1, hy + r * 1.6, hx - r * 0.1, hy + r * 0.2);
  ctx.fill();
}
