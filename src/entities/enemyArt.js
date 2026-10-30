import { FLASH, INK } from '../core/constants.js';
import { lerpColor } from '../utils/math.js';
import { drawPosed, skeleton, walkArms, walkLegs } from '../render/stick.js';
import { add, dirOf, dot, easeIn, easeInOut, easeOut, facing, keys, keys2, line, mix, mix2, off, poly, span } from '../render/anim.js';
import { cape, cuirass, garment, helm, pauldron } from '../units/kit.js';
import { smear, spear, sword } from '../units/weapons.js';

/*
 * How the raiders look. Every foot soldier is drawn facing right inside facing() and posed
 * by where its hands go, like the army. `u` runs 0 → 1 through an attack swing (wind-up to
 * STRIKE_AT, the blow, then recovery; 1 when not attacking), `phase` through the walk.
 * `paint` recolours costume pieces for hits (white), frost (icy) and burning (ember), so the
 * status reads on the whole figure, not just its ink.
 */

export const SWING = 0.5;      // full attack animation (wind-up → strike → recover)
export const STRIKE_AT = 0.55; // fraction of the swing where the blow lands

/** Make a costume colour follow the figure's status tint. */
export function painter(e) {
  if (e.flash > 0) return () => (e.siege ? '#4d4456' : FLASH);
  if (e.alive && e.slowT > 0) return (c) => lerpColor(c, '#7fb6e6', 0.45);
  if (e.alive && e.burnT > 0) return (c) => lerpColor(c, '#ff6a2a', 0.3);
  return (c) => c;
}

/** Weapon pose over a swing: wind up to `raise`, cut to `hit`, hold, settle back to `rest`. */
function swingPose(u, rest, raise, hit) {
  const blend = (p, q, k) => ({ g: mix2(p.g, q.g, k), a: mix(p.a, q.a, k) });
  if (u < 0.45) return blend(rest, raise, easeOut(u / 0.45));
  if (u < STRIKE_AT) return blend(raise, hit, easeIn((u - 0.45) / (STRIKE_AT - 0.45)));
  if (u < 0.65) return hit;
  return blend(hit, rest, easeInOut((u - 0.65) / 0.35));
}
const smearing = (u) => (u > 0.45 && u < 0.66 ? 1 - Math.abs(u - 0.55) / 0.11 : 0);

/** Swing trail: an arc around the shoulder covering the outer reach of the weapon, just behind it. */
function trail(ctx, sh, grip, a, len, k) {
  const r = Math.hypot(grip[0] - sh[0], grip[1] - sh[1]);
  smear(ctx, sh, a - 1.3, a, r + len * 0.45, r + len, 0.32 * k);
}

/** Glowing slit eyes inside the head (right-facing space). */
function eyes(ctx, j, color = '#c8312b') {
  const s = j.s;
  ctx.fillStyle = color;
  ctx.fillRect(j.head[0] + 1.4 * s, j.head[1] - 1 * s, 2.6 * s, 1.5 * s);
}

/** Horns curling up off a helmet. */
function horns(ctx, j, color) {
  const r = j.headR;
  const [x, y] = j.head;
  ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * r * 0.55, y - r * 0.6);
    ctx.quadraticCurveTo(x + side * r * 1.9, y - r * 1.1, x + side * r * 1.25, y - r * 2.3);
    ctx.quadraticCurveTo(x + side * r * 1.25, y - r * 1.3, x + side * r * 0.1, y - r * 0.9);
    ctx.closePath();
    ctx.fill();
  }
}

/** Two-handed axe: long haft, crescent blade at the head. */
function greatAxe(ctx, grip, a, s, paint, len = 30) {
  const d = dirOf(a);
  const n = [-d[1], d[0]];
  const tail = add(grip, d, -8 * s);
  const head = add(grip, d, len * s);
  line(ctx, tail, head, INK, 3.4 * s);
  line(ctx, tail, head, paint('#5a3b22'), 2 * s);
  const b0 = add(head, d, -9 * s);
  // Blade on the cutting (n) side, bearded down the haft
  ctx.fillStyle = paint('#a9acb3');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(...add(head, n, 1.5 * s));
  ctx.quadraticCurveTo(...add(add(head, n, 9 * s), d, 3 * s), ...add(add(head, n, 11 * s), d, -2 * s));
  ctx.quadraticCurveTo(...add(add(b0, n, 9 * s), d, -2 * s), ...add(add(b0, n, 7 * s), d, -5 * s));
  ctx.quadraticCurveTo(...add(b0, n, 3 * s), ...add(b0, n, 1.5 * s));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  line(ctx, add(add(head, n, 10.5 * s), d, -1.5 * s), add(add(b0, n, 8 * s), d, -3.5 * s), 'rgba(255,255,255,0.45)', 0.8 * s);
  // Back spike
  poly(ctx, [add(head, n, -1.5 * s), add(add(head, n, -6 * s), d, -2.5 * s), add(add(head, d, -5 * s), n, -1.5 * s)], paint('#7d808a'), INK, 0.7 * s);
}

/** War hammer: banded haft, heavy block head with a spike behind. */
function warHammer(ctx, grip, a, s, paint) {
  const d = dirOf(a);
  const n = [-d[1], d[0]];
  const tail = add(grip, d, -8 * s);
  const head = add(grip, d, 26 * s);
  line(ctx, tail, head, INK, 3.2 * s);
  line(ctx, tail, head, paint('#4a3020'), 1.8 * s);
  for (const k of [4, 12]) line(ctx, add(add(grip, d, k * s), n, 1.6 * s), add(add(grip, d, k * s), n, -1.6 * s), paint('#e2b33c'), 1.2 * s);
  const c = add(head, d, 2 * s);
  const corner = (kd, kn) => add(add(c, d, kd * s), n, kn * s);
  poly(ctx, [corner(-5, 9), corner(5, 9), corner(5, -6), corner(-5, -6)], paint('#5d5866'), INK, 1 * s);
  line(ctx, corner(-5, 3), corner(5, 3), paint('#e2b33c'), 1.2 * s);
  poly(ctx, [corner(-2, -6), corner(0, -13), corner(2, -6)], paint('#5d5866'), INK, 0.8 * s);
  line(ctx, corner(-4, 8), corner(4, 8), 'rgba(255,255,255,0.3)', 1 * s);
}

/** Tall tower shield seen from the front, iron-rimmed with a painted skull. */
function towerShield(ctx, c, s, paint) {
  const w = 6.5 * s;
  const h = 17 * s;
  const [x, y] = c;
  poly(ctx, [[x - w, y - h], [x + w, y - h + 1.5 * s], [x + w, y + h - 1.5 * s], [x - w, y + h]], paint('#3b2c22'), INK, 1.2 * s);
  ctx.strokeStyle = paint('#6c6676');
  ctx.lineWidth = 1.6 * s;
  ctx.strokeRect(x - w + 1 * s, y - h + 1.5 * s, 2 * w - 2 * s, 2 * h - 3 * s);
  for (const yy of [-h * 0.45, h * 0.45]) line(ctx, [x - w + 1, y + yy], [x + w - 1, y + yy], paint('#6c6676'), 1.2 * s);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) dot(ctx, [x + dx * (w - 2.5 * s), y + dy * (h - 3 * s)], 0.9 * s, paint('#9aa3ad'));
  // Skull emblem
  dot(ctx, [x, y - 1.5 * s], 3.4 * s, paint('#d8d0c0'));
  poly(ctx, [[x - 2 * s, y + 1 * s], [x + 2 * s, y + 1 * s], [x + 1.4 * s, y + 3.8 * s], [x - 1.4 * s, y + 3.8 * s]], paint('#d8d0c0'));
  dot(ctx, [x - 1.3 * s, y - 2 * s], 0.9 * s, INK);
  dot(ctx, [x + 1.3 * s, y - 2 * s], 0.9 * s, INK);
}

/** The pose shared by every foot soldier: walking legs, a stagger lean when pushed. */
function baseFigure(e, color, extra = {}) {
  const walking = e.walking && e.alive;
  return {
    x: e.x, y: e.y, s: e.s, color, lw: extra.lw ?? 3.2,
    legs: walking ? walkLegs(e.phase, extra.stride ?? 0.55) : [[0.35, 0.2], [-0.3, -0.15]],
    lean: (extra.lean ?? 0.04) - Math.min(0.35, e.kb / 400),
  };
}
const walkBack = (e) => (e.walking ? walkArms(e.phase)[1] : [-0.2, 0.3]);

// ---- Foot soldiers ----------------------------------------------------------------------

/** Haydut: ragged bandit with a heavy cleaver, hacking overhead. */
function grunt(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color);
  const sk = skeleton(fig);
  const pose = e.walking ? { g: [8, 9 + Math.sin(e.phase) * 1.5], a: -0.7 } : swingPose(u, { g: [9, 6], a: -0.9 }, { g: [-2, -12], a: -2.6 }, { g: [15, 9], a: 0.7 });
  const grip = off(sk.sh, pose.g[0], pose.g[1], s);
  fig.lean += e.walking ? 0.06 : u > 0.45 && u < 0.75 ? 0.16 : u < 0.45 ? -u * 0.15 : 0;
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: grip, bend: [0, 1] },
    armB: walkBack(e),
    body: (b) => garment(ctx, b, { color: paint('#5a2a24'), length: 9, hem: 8, belt: paint('#8a6a3a'), sway: e.walking ? Math.sin(e.phase) * 1.5 : 0 }),
  });
  if (smearing(u) > 0) trail(ctx, sk.sh, grip, pose.a, 18 * s, smearing(u));
  sword(ctx, grip, pose.a, s, { len: 18, w: 2.4, guard: 2.5, handle: 4, steel: paint('#a9acb3'), hilt: paint('#5b3b24') });
  dot(ctx, j.handF, 1.8 * s, color);
  helm(ctx, j, 'bandana', paint('#3a2a2a'));
  if (!e.flash) eyes(ctx, j);
  return j;
}

/** Akıncı: lean raider sprinting low with a knife, stabbing in fast. */
function runner(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color, { lean: 0.35, stride: 0.75 });
  const sk = skeleton(fig);
  const pose = e.walking ? { g: [9, 11 + Math.sin(e.phase) * 2], a: 0.35 } : swingPose(u, { g: [10, 8], a: 0.1 }, { g: [-5, 3], a: -0.5 }, { g: [18, 3], a: 0 });
  const grip = off(sk.sh, pose.g[0], pose.g[1], s);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: grip, bend: [-0.2, 1] },
    armB: walkBack(e),
    body: (b) => garment(ctx, b, { color: paint('#4a3426'), length: 6, hem: 7, wHip: 5, belt: paint('#2a1e18') }),
  });
  sword(ctx, grip, pose.a, s, { len: 11, w: 1.3, guard: 2, handle: 3.5, steel: paint('#c9ced6'), hilt: paint('#3b2a1c') });
  dot(ctx, j.handF, 1.7 * s, color);
  // Headband with tails streaming behind
  const wob = Math.sin(e.phase * 2) * 3;
  const hb = [j.head[0] - 4 * s, j.head[1] - 2 * s];
  ctx.strokeStyle = paint('#c8312b');
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(j.head[0] + j.headR, j.head[1] - 2.5 * s);
  ctx.lineTo(hb[0], hb[1]);
  ctx.quadraticCurveTo(hb[0] - 10 * s, hb[1] - 4 * s + wob, hb[0] - 18 * s, hb[1] - wob);
  ctx.stroke();
  if (!e.flash) eyes(ctx, j);
  return j;
}

/**
 * Mızrakçı: carries a javelin cocked over the shoulder, draws back and sights with the other
 * arm, hurls it at the strike, then pulls the next one from the bundle on his back.
 */
function thrower(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color);
  const sk = skeleton(fig);
  const carry = off(sk.sh, -4, -7, s);
  const back = off(sk.sh, -15, -4, s);
  const throwEnd = off(sk.sh, 16, 7, s);
  const fetch = off(sk.sh, -7, -12, s);
  let hand = carry;
  let hb = null;
  let ja = -0.15;
  if (!e.walking) {
    hand = keys2(u, [[0, carry], [0.45, back], [STRIKE_AT, throwEnd], [0.7, off(sk.sh, 12, 10, s)], [0.85, fetch], [1, carry]]);
    ja = keys(u, [[0, -0.15], [0.45, -0.4], [STRIKE_AT, 0.1], [0.85, -1.9], [1, -0.15]]);
    hb = keys2(u, [[0, off(sk.sh, 4, 13, s)], [0.3, add(sk.sh, dirOf(-0.25), 17 * s)], [0.5, add(sk.sh, dirOf(-0.25), 17 * s)], [0.62, off(sk.sh, -8, 10, s)], [1, off(sk.sh, 4, 13, s)]]);
    fig.lean += keys(u, [[0, 0], [0.45, -0.14], [STRIKE_AT, 0.22], [0.75, 0.05], [1, 0]]);
  }
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hand, bend: [-0.4, 1] },
    ...(hb ? { reachB: { to: hb, bend: [0, 1] } } : { armB: walkBack(e) }),
    body: (b) => {
      for (const dx of [0, 2.2]) spear(ctx, off(b.sh, -6 + dx, 5, s), -1.85, s, { back: 16, front: 13, head: 4.5, wood: paint('#7a5530') });
      garment(ctx, b, { color: paint('#3d4a2a'), length: 9, hem: 8, belt: paint('#2a1e18') });
    },
  });
  // The javelin leaves the hand at the strike and a new one comes out of the bundle
  if (e.walking || u < STRIKE_AT || u > 0.82) spear(ctx, j.handF, ja, s, { back: 15, front: 18, wood: paint('#7a5530') });
  dot(ctx, j.handF, 1.8 * s, color);
  helm(ctx, j, 'cap', paint('#4a3426'));
  if (!e.flash) eyes(ctx, j);
  return j;
}

/** Kalkanlı: behind a tower shield, pulls it in and shoves it forward to bash. */
function shield(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color);
  const sk = skeleton(fig);
  const hold = off(sk.sh, 9, 8 + (e.walking ? Math.sin(e.phase) * 1 : 0), s);
  const hand = e.walking ? hold : keys2(u, [[0, hold], [0.45, off(sk.sh, 4, 8, s)], [STRIKE_AT, off(sk.sh, 17, 7, s)], [0.7, off(sk.sh, 15, 7, s)], [1, hold]]);
  if (!e.walking) fig.lean += keys(u, [[0, 0], [0.45, -0.1], [STRIKE_AT, 0.26], [0.7, 0.2], [1, 0]]);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hand, bend: [0, 1] },
    reachB: { to: off(sk.sh, -3, 14, s), bend: [-0.5, 0.5] },
    body: (b) => {
      // Spiked mace hanging at the back hand
      const m = off(b.sh, -3, 14, s);
      line(ctx, m, off(m, -2, 9, s), INK, 2.4 * s);
      dot(ctx, off(m, -2.3, 10.5, s), 2.6 * s, paint('#5d5866'));
      cuirass(ctx, b, paint('#6c6676'));
      garment(ctx, b, { color: paint('#3a2f3a'), length: 10, wTop: 3.5, top: 0.5, belt: paint('#2a1e18') });
    },
  });
  towerShield(ctx, off(j.handF, 3, 0, s), s, paint);
  const crest = helm(ctx, j, 'nasal', paint('#5d5866'));
  poly(ctx, [off(crest, -1, 1, s), off(crest, 0, -5, s), off(crest, 1, 1, s)], paint('#9aa3ad'));
  if (!e.flash) eyes(ctx, j);
  return j;
}

/** Dev: hulking brute in furs, a two-handed axe brought over the head and down. */
function brute(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color, { lw: 4.2, lean: 0.12 });
  const sk = skeleton(fig);
  const pose = e.walking ? { g: [4, 1], a: -2.3 } : swingPose(u, { g: [10, 7], a: -1.15 }, { g: [-3, -13], a: -2.8 }, { g: [14, 12], a: 0.95 });
  if (!e.walking) fig.lean += u > 0.45 && u < 0.8 ? 0.2 : -Math.min(u, 0.45) * 0.2;
  const grip = off(sk.sh, pose.g[0], pose.g[1], s);
  const d = dirOf(pose.a);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: add(grip, d, 3 * s), bend: [0.2, 1] },
    reachB: { to: add(grip, d, -5 * s), bend: [-0.3, 1] },
    body: (b) => {
      garment(ctx, b, { color: paint('#5b4630'), length: 8, wTop: 6, wHip: 7, hem: 9, top: 0.72, belt: paint('#2a1e18'), buckle: paint('#d8d0c0') });
      pauldron(ctx, b, paint('#7a6448'));
    },
  });
  if (smearing(u) > 0) trail(ctx, sk.sh, grip, pose.a, 30 * s, smearing(u));
  greatAxe(ctx, grip, pose.a, s, paint);
  dot(ctx, j.handF, 2.2 * s, color);
  dot(ctx, j.handB, 2.2 * s, color);
  helm(ctx, j, 'kettle', paint('#5d5866'));
  horns(ctx, j, paint('#d8d0c0'));
  if (!e.flash) eyes(ctx, j);
  return j;
}

/** Savaş Lordu: armoured warlord with a crowned helm, cape and a two-handed war hammer. */
function boss(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color, { lw: 4.5, lean: 0.06 });
  const sk = skeleton(fig);
  const pose = e.walking ? { g: [5, 2], a: -2.25 } : swingPose(u, { g: [10, 8], a: -1.2 }, { g: [-2, -14], a: -2.85 }, { g: [15, 13], a: 0.9 });
  if (!e.walking) fig.lean += u > 0.45 && u < 0.8 ? 0.18 : -Math.min(u, 0.45) * 0.18;
  const grip = off(sk.sh, pose.g[0], pose.g[1], s);
  const d = dirOf(pose.a);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: add(grip, d, 3 * s), bend: [0.2, 1] },
    reachB: { to: add(grip, d, -5 * s), bend: [-0.3, 1] },
    body: (b) => {
      cape(ctx, b, paint('#7a1720'), Math.sin(e.phase) * 2, e.walking ? 0.25 : 0);
      cuirass(ctx, b, paint('#3a3540'));
      garment(ctx, b, { color: paint('#7a1720'), length: 11, wTop: 3.5, hem: 9, top: 0.45, trim: paint('#e2b33c'), belt: paint('#1a161c'), buckle: paint('#e2b33c') });
      pauldron(ctx, b, paint('#3a3540'));
      // Spikes on the pauldron
      for (const k of [-1, 0, 1]) poly(ctx, [off(b.sh, k * 2 - 1, -2, s), off(b.sh, k * 2.5, -6, s), off(b.sh, k * 2 + 1, -2, s)], paint('#9aa3ad'));
    },
  });
  if (smearing(u) > 0) trail(ctx, sk.sh, grip, pose.a, 30 * s, smearing(u));
  warHammer(ctx, grip, pose.a, s, paint);
  dot(ctx, j.handF, 2.3 * s, color);
  dot(ctx, j.handB, 2.3 * s, color);
  helm(ctx, j, 'great', paint('#3a3540'), paint('#e2b33c'));
  // Crown on the helm
  const r = j.headR;
  const [x, y] = [j.head[0], j.head[1] - r - 0.5 * s];
  poly(ctx, [[x - r, y + 2 * s], [x - r, y - r * 0.6], [x - r * 0.5, y - r * 0.15], [x, y - r * 0.8], [x + r * 0.5, y - r * 0.15], [x + r, y - r * 0.6], [x + r, y + 2 * s]], paint('#e2b33c'), INK, 0.8 * s);
  dot(ctx, [x, y - r * 0.1], 0.9 * s, paint('#c8312b'));
  if (!e.flash) {
    ctx.globalCompositeOperation = 'lighter';
    dot(ctx, [j.head[0] + 2.6 * s, j.head[1] - 0.3 * s], 2.4 * s, 'rgba(255,60,40,0.35)');
    ctx.globalCompositeOperation = 'source-over';
    eyes(ctx, j, '#ff3b2f');
  }
  return j;
}

// ---- Flyers -----------------------------------------------------------------------------

/**
 * A wing in side view hinged at `root`: it sweeps from raised (lift 1) to beaten down
 * (lift -1); the primaries splay into fingers at the tip.
 */
function wing(ctx, root, lift, span, chord, fingers, fill) {
  const a = mix(-4.2, -1.75, (lift + 1) / 2); // down-back … up
  const d = dirOf(a);
  const n = [-d[1], d[0]];
  const tip = add(root, d, span);
  const wrist = add(add(root, d, span * 0.45), n, -chord * 0.25);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(root[0], root[1]);
  ctx.quadraticCurveTo(...add(add(root, d, span * 0.2), n, -chord * 0.5), ...wrist);
  ctx.lineTo(tip[0], tip[1]);
  for (let i = 1; i <= fingers; i++) {
    const k = i / (fingers + 1);
    const base = add(add(tip, d, -span * 0.38 * k), n, chord * 0.55 * k);
    ctx.lineTo(...add(base, d, span * 0.12));
    ctx.lineTo(...add(base, n, chord * 0.12));
  }
  ctx.quadraticCurveTo(...add(add(root, d, span * 0.35), n, chord * 1.1), root[0] + n[0] * chord * 0.4, root[1] + n[1] * chord * 0.4);
  ctx.closePath();
  ctx.fill();
}

/** Akbaba: bald red head on a snaking neck, ruff collar, broad fingered wings; talons out to dive. */
function vulture(ctx, e, color, paint) {
  const s = e.s;
  const y = e.centerY;
  const dive = e.atkAnim > 0 ? Math.sin((1 - e.atkAnim / SWING) * Math.PI) : 0;
  return facing(ctx, e.x, -1, () => {
    const x = e.x;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dive * 0.45);
    ctx.scale(s, s);
    const lift = Math.sin(e.phase * 1.6);
    wing(ctx, [-1, -3], -lift * 0.9, 30, 11, 5, paint('#141117'));
    // Tail fan and body
    poly(ctx, [[-9, 0], [-20, -3], [-21, 3], [-9, 5]], color);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 1, 11, 7, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // Talons tucked in flight, thrown forward on the dive
    const claw = [mix(-2, 9, dive), mix(8, 12, dive)];
    line(ctx, [2, 5], claw, color, 1.8);
    for (const k of [-0.5, 0.2, 0.9]) line(ctx, claw, add(claw, dirOf(k), 3), paint('#d79b3f'), 1);
    // White ruff, bare neck, red head and hooked beak
    ctx.fillStyle = paint('#d8d0c0');
    ctx.beginPath();
    ctx.ellipse(8, -3, 4.5, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = paint('#9c4a3e');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(9, -4);
    ctx.quadraticCurveTo(13, -9, 15 + dive * 3, -8 + dive * 4);
    ctx.stroke();
    dot(ctx, [16 + dive * 3, -8 + dive * 4], 3.6, paint('#9c4a3e'));
    poly(ctx, [[18.5 + dive * 3, -9 + dive * 4], [24 + dive * 3, -7 + dive * 4], [21 + dive * 3, -4.5 + dive * 4], [18.5 + dive * 3, -6 + dive * 4]], paint('#d79b3f'));
    dot(ctx, [17 + dive * 3, -9 + dive * 4], 1.1, e.flash ? '#ff473d' : '#ffd36a');
    wing(ctx, [1, -4], lift, 32, 12, 5, color);
    ctx.restore();
    return null;
  });
}

/** Kuzgun: small glossy black bird with sharp wings and a red eye, flapping fast. */
function raven(ctx, e, color, paint) {
  const s = e.s;
  const y = e.centerY;
  return facing(ctx, e.x, -1, () => {
    ctx.save();
    ctx.translate(e.x, y);
    ctx.scale(s, s);
    const lift = Math.sin(e.phase * 2.4);
    wing(ctx, [-2, -2], -lift * 0.9, 26, 8, 4, paint('#101016'));
    poly(ctx, [[-9, -1], [-21, -5], [-21, 6], [-9, 3]], color);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 1, 11, 5, 0.1, 0, Math.PI * 2);
    ctx.fill();
    line(ctx, [-6, -1.5], [6, -2.5], paint('#2a3048'), 1.2);
    dot(ctx, [11, -2], 5, color);
    poly(ctx, [[14, -4], [24, -1], [14, 1]], color);
    if (!e.flash) dot(ctx, [12, -3], 1.5, '#c8312b');
    wing(ctx, [0, -3], lift, 28, 9, 4, color);
    ctx.restore();
    return null;
  });
}

// ---- Siege ------------------------------------------------------------------------------

/** A crewman drawn facing left, posed in right-facing space (forward = toward the engine). */
function crew(ctx, e, x, color, paint, pose) {
  facing(ctx, x, -1, () => {
    const fig = { x, y: e.y, s: 0.82, color, legs: pose.legs, lean: pose.lean };
    const sk = skeleton(fig);
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: pose.handF(sk), bend: [0, 1] },
      reachB: { to: pose.handB(sk), bend: [0, 1] },
      body: (b) => garment(ctx, b, { color: paint(pose.coat), length: 8, belt: paint('#2a1e18') }),
    });
    helm(ctx, j, pose.hat ?? 'cap', paint(pose.hatColor ?? '#4a3426'));
    if (!e.flash) eyes(ctx, j);
  });
}

function wheels(ctx, e, color, hub, xs, r) {
  const spin = -e.phase * 1.6;
  for (const wx of xs) {
    const wy = e.y - r;
    dot(ctx, [wx, wy], r, color);
    ctx.strokeStyle = hub;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(wx, wy, r - 1.5, 0, Math.PI * 2);
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI) / 3;
      ctx.moveTo(wx - Math.cos(a) * (r - 2), wy - Math.sin(a) * (r - 2));
      ctx.lineTo(wx + Math.cos(a) * (r - 2), wy + Math.sin(a) * (r - 2));
    }
    ctx.stroke();
    dot(ctx, [wx, wy], 2.2, hub);
  }
}

/** Koçbaşı: hide-roofed ram shed pushed by two raiders; the log swings back then smashes in. */
function ram(ctx, e, u, color, paint) {
  const x = e.x;
  const y = e.y;
  const metal = paint('#6c6676');
  const walking = e.walking && e.alive;
  const thrust = e.walking ? 0 : keys(u, [[0, 0], [0.45, 16], [STRIKE_AT, -13], [0.65, -13], [1, 0]]);
  // Pushers lean into the back beam; they brace and heave on the blow
  for (const [cx, ph] of [[x + 50, 0], [x + 62, Math.PI]]) {
    crew(ctx, e, cx, color, paint, {
      coat: '#5a2a24',
      legs: walking ? walkLegs(e.phase * 1.6 + ph, 0.5) : [[0.45, 0.3], [-0.45, -0.3]],
      lean: walking ? 0.5 : 0.4 + (u > 0.45 && u < 0.7 ? 0.15 : 0),
      handF: (sk) => off(sk.sh, 13, 4),
      handB: (sk) => off(sk.sh, 12, 8),
      hat: 'bandana', hatColor: '#3a2a2a',
    });
  }
  // Log on chains under the roof, with an iron ram's head
  const logY = y - 34;
  line(ctx, [x + 30 + thrust, logY], [x - 46 + thrust, logY], color, 9);
  line(ctx, [x + 28 + thrust, logY - 2], [x - 44 + thrust, logY - 2], paint('#4a3423'), 3);
  for (const k of [-30, -6, 18]) line(ctx, [x + k + thrust, logY - 4.5], [x + k + thrust, logY + 4.5], paint('#6c6676'), 1.6);
  ctx.strokeStyle = metal;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const cx of [-14, 14]) {
    ctx.moveTo(x + cx, y - 52);
    ctx.lineTo(x + cx + thrust, logY);
  }
  ctx.stroke();
  const hx = x - 50 + thrust;
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.moveTo(hx + 9, logY - 7);
  ctx.lineTo(hx - 4, logY - 6);
  ctx.quadraticCurveTo(hx - 11, logY, hx - 4, logY + 6);
  ctx.lineTo(hx + 9, logY + 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = metal;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(hx + 3, logY - 6, 5, Math.PI * 0.9, Math.PI * 2.1);
  ctx.stroke();
  dot(ctx, [hx - 2, logY - 1.5], 1.3, e.flash ? INK : '#c8312b');
  // Hide-covered roof with stitched seams
  poly(ctx, [[x - 38, y - 22], [x - 22, y - 58], [x + 30, y - 58], [x + 40, y - 22]], color);
  ctx.strokeStyle = paint('#3a3040');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const t = (i + 0.5) / 4;
    ctx.moveTo(x - 30 + t * 8, y - 26 - t * 28);
    ctx.lineTo(x + 34 - t * 6, y - 26 - t * 28);
  }
  ctx.stroke();
  ctx.strokeStyle = paint('#6b5640');
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -24; k < 30; k += 7) {
    ctx.moveTo(x + k, y - 57);
    ctx.lineTo(x + k + 1.5, y - 53);
  }
  ctx.stroke();
  // Chassis planks and wheels
  ctx.fillStyle = color;
  ctx.fillRect(x - 40, y - 24, 82, 8);
  line(ctx, [x - 38, y - 20], [x + 40, y - 20], paint('#4a3423'), 1);
  wheels(ctx, e, color, metal, [x - 26, x + 28], 10);
}

/**
 * Mancınık: the arm is hauled down by the windlass, whips up to throw at the strike, and the
 * crewman winds it back down while a new stone is loaded.
 */
function catapult(ctx, e, u, color, paint) {
  const x = e.x;
  const y = e.y;
  const metal = paint('#6c6676');
  const walking = e.walking && e.alive;
  const winding = !e.walking && u > 0.6 && u < 0.98;
  const turn = winding ? span(u, 0.6, 0.98) * Math.PI * 6 : 0;
  const wind = [x + 30, y - 30];
  const crank = add(wind, dirOf(turn), 5);
  crew(ctx, e, x + 48, color, paint, {
    coat: '#3d4a2a',
    legs: walking ? walkLegs(e.phase * 1.5, 0.5) : [[0.25, 0.15], [-0.25, -0.15]],
    lean: walking ? 0.45 : winding ? 0.25 + Math.sin(turn) * 0.06 : 0.1,
    // Mirrored space: the windlass sits ahead of the crewman
    handF: (sk) => (walking ? off(sk.sh, 13, 8) : winding ? [2 * (x + 48) - crank[0], crank[1]] : off(sk.sh, 9, 6)),
    handB: (sk) => (walking ? off(sk.sh, 12, 12) : winding ? [2 * (x + 48) - wind[0], wind[1] + 3] : off(sk.sh, 3, 13)),
  });
  // Frame, A-frame upright and windlass
  ctx.fillStyle = color;
  ctx.fillRect(x - 36, y - 22, 74, 7);
  line(ctx, [x - 34, y - 19], [x + 36, y - 19], paint('#4a3423'), 1);
  const px = x + 4;
  const py = y - 52;
  ctx.lineCap = 'round';
  line(ctx, [x - 14, y - 20], [px, py], color, 4);
  line(ctx, [px, py], [x + 20, y - 20], color, 4);
  line(ctx, [x - 8, y - 32], [x + 15, y - 32], color, 2.5);
  dot(ctx, wind, 4.5, color);
  line(ctx, wind, crank, metal, 1.5);
  // Throwing arm: rests pointing back, whips forward and up on release
  const a = e.walking ? 0.3 : keys(u, [[0, 0.3], [0.45, 0.45], [STRIKE_AT, -2.1], [0.62, -2.0], [0.98, 0.3]]);
  const bx = px + Math.cos(a) * 46;
  const by = py + Math.sin(a) * 46;
  const cx = px - Math.cos(a) * 14;
  const cy = py - Math.sin(a) * 14;
  // Rope from the arm down to the windlass while it is held down
  if (a > 0) line(ctx, [px + Math.cos(a) * 30, py + Math.sin(a) * 30], wind, paint('#c9b58a'), 1);
  line(ctx, [cx, cy], [bx, by], color, 4.5);
  line(ctx, [cx, cy], [bx, by], paint('#4a3423'), 1.5);
  poly(ctx, [[cx - 7, cy - 4], [cx + 7, cy - 4], [cx + 7, cy + 10], [cx - 7, cy + 10]], color);
  for (const k of [0, 4]) line(ctx, [cx - 7, cy + k], [cx + 7, cy + k], metal, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(bx, by, 7, 0, Math.PI);
  ctx.fill();
  // The stone sits in the bucket until it is thrown, then a new one is loaded
  if (e.walking || u < STRIKE_AT || u > 0.95) {
    dot(ctx, [bx, by - 5], 6.5, paint('#4a4452'));
    dot(ctx, [bx - 2, by - 7], 1.6, 'rgba(255,255,255,0.18)');
  }
  dot(ctx, [px, py], 3, metal);
  wheels(ctx, e, color, metal, [x - 24, x + 24], 11);
}

// ---- New raiders -------------------------------------------------------------------------

/** Robed caster: staff planted, thrust forward at the strike with a glowing head. */
function caster(ctx, e, u, color, paint, look) {
  const s = e.s;
  const fig = baseFigure(e, color, { stride: 0.4, lean: 0.08, lw: look.lw });
  const sk = skeleton(fig);
  const rest = off(sk.sh, 9, 8 + (e.walking ? Math.sin(e.phase) * 1.5 : 0), s);
  const hand = e.walking ? rest : keys2(u, [[0, rest], [0.45, off(sk.sh, 2, -5, s)], [STRIKE_AT, off(sk.sh, 16, 0, s)], [0.75, off(sk.sh, 14, 3, s)], [1, rest]]);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hand, bend: [0, 1] },
    armB: walkBack(e),
    body: (b) => {
      if (look.cape) cape(ctx, b, paint(look.cape), Math.sin(e.phase) * 2, e.walking ? 0.2 : 0);
      garment(ctx, b, { color: paint(look.robe), length: 15, hem: 10, wHip: 6, belt: paint(look.belt ?? '#2a1e18'), trim: look.trim && paint(look.trim) });
    },
  });
  // Staff, with the orb swelling as the spell is cast
  const top = off(j.handF, 2, -19, s);
  line(ctx, off(j.handF, -1, 19, s), top, INK, 2.8 * s);
  line(ctx, off(j.handF, -1, 19, s), top, paint('#5a3b22'), 1.5 * s);
  const r = (3.4 + (e.walking ? 0 : Math.max(0, Math.sin(u * Math.PI)) * 2.6)) * s;
  dot(ctx, top, r + 2 * s, `${look.orb}55`);
  dot(ctx, top, r, paint(look.orb));
  dot(ctx, j.handF, 1.8 * s, color);
  if (look.hat === 'witch') {
    const [x, y] = j.head;
    const r0 = j.headR;
    poly(ctx, [[x - r0 * 1.7, y - r0 * 0.6], [x + r0 * 1.7, y - r0 * 0.6], [x - r0 * 0.5, y - r0 * 3.2]], paint(look.robe), INK, 0.8 * s);
  } else if (look.hat === 'nemes') {
    const [x, y] = j.head;
    const r0 = j.headR;
    poly(ctx, [[x - r0 * 1.8, y + r0 * 1.5], [x - r0 * 1.2, y - r0 * 1.2], [x + r0 * 1.2, y - r0 * 1.2], [x + r0 * 1.1, y + r0 * 0.5]], paint('#e2b33c'), INK, 0.8 * s);
    for (const k of [0.1, 0.8]) line(ctx, [x - r0 * 1.6, y + r0 * (k - 0.4)], [x + r0 * 1.1, y + r0 * (k - 0.6)], paint('#2459b8'), 1.2 * s);
  } else if (look.hat) {
    helm(ctx, j, look.hat, paint(look.hood ?? look.robe));
  }
  if (!e.flash) eyes(ctx, j, look.eyes);
  return j;
}

/** Suikastçı: hooded killer with twin daggers. */
function assassin(ctx, e, u, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color, { lean: 0.3, stride: 0.7 });
  const sk = skeleton(fig);
  const pose = e.walking ? { g: [9, 10], a: 0.5 } : swingPose(u, { g: [10, 8], a: 0.1 }, { g: [-3, -3], a: -0.9 }, { g: [18, 5], a: 0.2 });
  const gripF = off(sk.sh, pose.g[0], pose.g[1], s);
  const gripB = off(sk.sh, -6, 11, s);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: gripF, bend: [-0.2, 1] },
    reachB: { to: gripB, bend: [-0.3, 1] },
    body: (b) => {
      cape(ctx, b, paint('#2a2038'), Math.sin(e.phase) * 2, 0.3);
      garment(ctx, b, { color: paint('#3a2c4e'), length: 7, wHip: 5, belt: paint('#7a1720') });
    },
  });
  sword(ctx, gripF, pose.a, s, { len: 11, w: 1.2, guard: 2, handle: 3, steel: paint('#d8dde6'), hilt: paint('#7a1720') });
  sword(ctx, gripB, 1.9, s, { len: 9, w: 1.2, guard: 2, handle: 3, steel: paint('#d8dde6'), hilt: paint('#7a1720') });
  helm(ctx, j, 'bandana', paint('#2a2038'));
  if (!e.flash) eyes(ctx, j, '#c18bff');
  return j;
}

/** Lağımcı: small sapper hauling a smoking powder keg, the fuse burning down. */
function sapper(ctx, e, color, paint) {
  const s = e.s;
  const fig = baseFigure(e, color, { lean: 0.3, stride: 0.8 });
  const sk = skeleton(fig);
  const keg = off(sk.sh, 13, 10, s);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: off(keg, -3, -2, s), bend: [0, 1] },
    reachB: { to: off(keg, -5, 3, s), bend: [0, 1] },
    body: (b) => garment(ctx, b, { color: paint('#5a4a2a'), length: 7, wHip: 5, belt: paint('#2a1e18') }),
  });
  ctx.fillStyle = paint('#5a3b22');
  ctx.beginPath();
  ctx.ellipse(keg[0], keg[1], 7 * s, 9 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const k of [-4, 4]) line(ctx, off(keg, -6.5, k, s), off(keg, 6.5, k, s), paint('#2a2030'), 1.5 * s);
  const fuse = off(keg, 3, -11, s);
  line(ctx, off(keg, 1, -8, s), fuse, paint('#c9b48a'), 1.2 * s);
  dot(ctx, fuse, (1.8 + Math.sin(e.phase * 4) * 0.7) * s, '#ffb347');
  helm(ctx, j, 'cap', paint('#6a5230'));
  if (!e.flash) eyes(ctx, j);
  return j;
}

/** Kum Akrebi: low armoured body, curling tail; only a moving mound while it is underground. */
function scorpion(ctx, e, u, color, paint) {
  const { x, y } = e;
  if (e.burrowed) {
    ctx.fillStyle = 'rgba(120,88,52,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 24, 7 + Math.sin(e.phase * 3) * 1.5, 0, Math.PI, 0);
    ctx.fill();
    return;
  }
  const shell = paint('#6b3a22');
  const walk = e.walking ? e.phase : 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const lx = x - 8 + i * 9;
    const k = Math.sin(walk * 2 + i * 1.6) * 3;
    ctx.moveTo(lx, y - 11);
    ctx.lineTo(lx + 4, y - 16 - k * 0.3);
    ctx.lineTo(lx + 8 + k, y);
  }
  ctx.stroke();
  ctx.fillStyle = shell;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y - 13, 19, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (const k of [-8, 0, 8]) line(ctx, [x + k, y - 20], [x + k + 2, y - 6], paint('#4a2616'), 1.5);
  // Pincers ahead, the sting lashing over the back at the strike
  const snap = e.walking ? 0 : Math.sin(u * Math.PI);
  for (const dy of [-4, 2]) {
    line(ctx, [x - 16, y - 12], [x - 28, y - 12 + dy], shell, 3.5);
    poly(ctx, [[x - 28, y - 16 + dy], [x - 38 - snap * 4, y - 12 + dy], [x - 28, y - 8 + dy]], shell, INK, 1);
  }
  const lash = keys(u, [[0, 0], [0.45, -6], [STRIKE_AT, 26], [0.75, 8], [1, 0]]);
  const pts = [[x + 16, y - 15], [x + 30, y - 25], [x + 32 - lash * 0.4, y - 40], [x + 20 - lash, y - 48 + lash * 0.2]];
  ctx.strokeStyle = shell;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  const tip = pts[3];
  poly(ctx, [[tip[0] + 3, tip[1] - 3], [tip[0] - 9, tip[1] + 5], [tip[0] + 2, tip[1] + 4]], paint('#e8c860'), INK, 0.8);
  dot(ctx, [x - 17, y - 16], 1.5, e.flash ? INK : '#ffd36a');
}

/** Lav Golemi, Kristal Dev and their small shards: stacked boulders on stubby legs. */
function golem(ctx, e, u, color, paint) {
  const s = e.s;
  const look = e.def.rock;
  const rock = paint(look.body);
  const glow = look.glow;
  const bob = e.walking ? Math.abs(Math.sin(e.phase)) * 2 * s : 0;
  const { x } = e;
  const y = e.y - bob;
  const blob = (cx, cy, rx, ry, seed = 0) => {
    ctx.fillStyle = rock;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const k = 0.85 + (((i + seed) * 37) % 10) / 45;
      const px = cx + Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * ry * k;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  const step = e.walking ? Math.sin(e.phase) * 5 * s : 0;
  blob(x - 9 * s + step, e.y - 7 * s, 7 * s, 8 * s, 1);
  blob(x + 9 * s - step, e.y - 7 * s, 7 * s, 8 * s, 2);
  blob(x, y - 29 * s, 19 * s, 17 * s, 3);
  blob(x - 2 * s, y - 50 * s, 10 * s, 9 * s, 4);
  const swing = e.walking ? 0 : keys(u, [[0, 0], [0.45, -14], [STRIKE_AT, 18], [0.75, 10], [1, 0]]);
  blob(x - 23 * s - swing * s * 0.4, y - 26 * s + swing * s * 0.5, 9 * s, 10 * s, 5);
  blob(x + 22 * s, y - 28 * s, 8 * s, 10 * s, 6);
  // Molten or crystal seams glowing through the rock
  ctx.strokeStyle = glow;
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, y - 40 * s);
  ctx.lineTo(x - 2 * s, y - 30 * s);
  ctx.lineTo(x - 7 * s, y - 22 * s);
  ctx.moveTo(x + 8 * s, y - 36 * s);
  ctx.lineTo(x + 2 * s, y - 26 * s);
  ctx.lineTo(x + 7 * s, y - 15 * s);
  ctx.stroke();
  if (!e.flash) dot(ctx, [x - 7 * s, y - 51 * s], 1.9 * s, glow);
}

/** Hayalet: a drifting shroud, see-through, trailing away to nothing. */
function wraith(ctx, e, u, color, paint) {
  const { x, y, s } = e;
  const top = y - 52 * s;
  const lunge = e.walking ? 0 : Math.sin(u * Math.PI) * 8;
  ctx.save();
  ctx.globalAlpha = e.flash ? 1 : 0.78;
  ctx.fillStyle = paint('#3a3050');
  ctx.beginPath();
  ctx.moveTo(x - 13 * s - lunge, top + 14 * s);
  ctx.quadraticCurveTo(x - 12 * s - lunge, top - 3 * s, x - lunge, top - 3 * s);
  ctx.quadraticCurveTo(x + 13 * s, top, x + 14 * s, top + 22 * s);
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    const wx = x + 14 * s + 8 * s - k * 28 * s;
    ctx.lineTo(wx, y - 4 * s + Math.sin(e.phase + i) * 4);
    ctx.lineTo(wx - 7 * s, y - 16 * s);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Reaching claws and hollow eyes
  line(ctx, [x - 9 * s - lunge, top + 20 * s], [x - 24 * s - lunge * 1.6, top + 26 * s], paint('#3a3050'), 3 * s);
  if (!e.flash) {
    dot(ctx, [x - 7 * s - lunge, top + 8 * s], 1.8 * s, '#b48cff');
    dot(ctx, [x - 1 * s - lunge, top + 8 * s], 1.8 * s, '#b48cff');
  }
}

/** Heavy boss built on the Savaş Lordu's body: its costume and weapon come from `look`. */
function warlord(ctx, e, u, color, paint, look) {
  const s = e.s;
  const fig = baseFigure(e, look.skin ?? color, { lw: 4.5, lean: 0.06 });
  const sk = skeleton(fig);
  const pose = e.walking ? { g: [5, 2], a: -2.25 } : swingPose(u, { g: [10, 8], a: -1.2 }, { g: [-2, -14], a: -2.85 }, { g: [15, 13], a: 0.9 });
  if (!e.walking) fig.lean += u > 0.45 && u < 0.8 ? 0.18 : -Math.min(u, 0.45) * 0.18;
  const grip = off(sk.sh, pose.g[0], pose.g[1], s);
  const d = dirOf(pose.a);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: add(grip, d, 3 * s), bend: [0.2, 1] },
    reachB: { to: add(grip, d, -5 * s), bend: [-0.3, 1] },
    body: (b) => {
      if (look.cape) cape(ctx, b, paint(look.cape), Math.sin(e.phase) * 2, e.walking ? 0.25 : 0);
      if (look.plate) cuirass(ctx, b, paint(look.plate));
      garment(ctx, b, { color: paint(look.cloth), length: 11, wTop: 3.5, hem: 9, top: 0.45, trim: look.trim && paint(look.trim), belt: paint('#1a161c') });
      pauldron(ctx, b, paint(look.plate ?? look.cloth));
    },
  });
  if (smearing(u) > 0) trail(ctx, sk.sh, grip, pose.a, 30 * s, smearing(u));
  if (look.weapon === 'axe') greatAxe(ctx, grip, pose.a, s, paint, 36);
  else warHammer(ctx, grip, pose.a, s, paint);
  dot(ctx, j.handF, 2.3 * s, fig.color);
  dot(ctx, j.handB, 2.3 * s, fig.color);
  if (look.helm) helm(ctx, j, look.helm, paint(look.plate ?? look.cloth));
  if (look.horns) horns(ctx, j, paint(look.horns));
  if (!e.flash) eyes(ctx, j, look.eyes);
  return j;
}

/** Kül Ejderi: winged, long-necked, the jaw opening and glowing as it breathes fire. */
function dragon(ctx, e, u, color, paint) {
  const s = e.s;
  const hide = paint('#5a2420');
  const belly = paint('#c98a3a');
  const open = e.walking ? 0.1 : Math.max(0, Math.sin(u * Math.PI));
  return facing(ctx, e.x, -1, () => {
    ctx.save();
    ctx.translate(e.x, e.centerY);
    ctx.scale(s / 2, s / 2);
    const lift = Math.sin(e.phase * 0.8);
    wing(ctx, [-3, -8], -lift * 0.8, 62, 26, 4, paint('#3a1616'));
    // Tail sweeping behind
    ctx.strokeStyle = hide;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 2);
    ctx.quadraticCurveTo(-44, 10 + lift * 5, -66, -6 - lift * 6);
    ctx.stroke();
    poly(ctx, [[-66, -14 - lift * 6], [-84, -9 - lift * 6], [-68, 2 - lift * 6]], hide, INK, 1);
    // Body and belly plates
    ctx.fillStyle = hide;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 2, 26, 15, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(3, 9, 18, 7, -0.05, 0, Math.PI * 2);
    ctx.fill();
    // Legs tucked under
    for (const lx of [-10, 12]) {
      line(ctx, [lx, 13], [lx + 4, 23], hide, 5);
      for (const k of [0, 3.5, 7]) line(ctx, [lx + 4, 23], [lx + k + 1, 28], paint('#e8dcc0'), 1.4);
    }
    // Neck curving up to the head
    ctx.strokeStyle = hide;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(18, -4);
    ctx.quadraticCurveTo(34, -14, 40, -30);
    ctx.stroke();
    for (const [sx, sy] of [[-12, -13], [0, -14], [12, -12], [26, -14], [33, -23]]) poly(ctx, [[sx - 4, sy + 2], [sx, sy - 7], [sx + 4, sy + 2]], paint('#3a1616'));
    ctx.save();
    ctx.translate(42, -32);
    ctx.rotate(0.15 + open * 0.2);
    poly(ctx, [[-8, -6], [14, -7], [24, -2], [8, 1], [-8, 3]], hide, INK, 1);
    ctx.save();
    ctx.rotate(open * 0.5);
    poly(ctx, [[-6, 2], [10, 1], [21, 4], [6, 8], [-6, 7]], hide, INK, 1);
    ctx.restore();
    poly(ctx, [[-7, -6], [-18, -14], [-3, -7]], paint('#e8dcc0'));
    if (!e.flash) dot(ctx, [3, -3], 1.8, '#ffd34d');
    if (open > 0.2) dot(ctx, [20, 2], 5 * open, '#ffb347');
    ctx.restore();
    wing(ctx, [0, -9], lift, 66, 28, 4, hide);
    ctx.restore();
    return null;
  });
}

const CASTERS = {
  shaman: { robe: '#4a5a2a', orb: '#7fe08a', hat: 'bandana', hood: '#3a2a2a', trim: '#c9a03a' },
  witch: { robe: '#2f4f7a', orb: '#9fdcff', hat: 'witch', eyes: '#bfe8ff', belt: '#9fdcff' },
  toxic: { robe: '#46552a', orb: '#a8e04a', hat: 'cap', hood: '#2f3a1e', eyes: '#d6ff6a' },
  pharaoh: { robe: '#e8dcc0', orb: '#ffd34d', hat: 'nemes', cape: '#2459b8', trim: '#e2b33c', belt: '#e2b33c', eyes: '#ffd34d', lw: 4 },
  necro: { robe: '#2a2a22', orb: '#a8e04a', hat: 'witch', cape: '#1a1a14', trim: '#6a7a3a', eyes: '#a8e04a', lw: 4 },
};
const WARLORDS = {
  troll: { cloth: '#5b4630', skin: '#3f5a34', helm: null, horns: '#d8d0c0', weapon: 'hammer', eyes: '#ffd34d' },
  frostGiant: { cloth: '#2f4f7a', plate: '#8fb4d6', cape: '#1f3556', helm: 'kettle', horns: '#e6f4ff', weapon: 'axe', eyes: '#bfe8ff', trim: '#bfe8ff' },
  crystalKing: { cloth: '#4a3a7a', plate: '#a58be0', cape: '#2e2456', helm: 'great', horns: '#d6c4ff', weapon: 'axe', eyes: '#e6d8ff', trim: '#d6c4ff' },
  voidLord: { cloth: '#16121f', plate: '#2a2038', cape: '#0c0a12', helm: 'great', horns: '#7a5ab0', weapon: 'hammer', eyes: '#b48cff', trim: '#7a5ab0' },
  ironknight: { cloth: '#3a3f48', plate: '#7d8592', helm: 'great', weapon: 'hammer', eyes: '#ff473d' },
};

/** Fiery ring round an enraged boss, under its feet and behind the figure. */
export function drawEnrage(ctx, e) {
  const r = 34 * e.s;
  const a = 0.3 + Math.sin(e.phase * 3) * 0.1;
  const g = ctx.createRadialGradient(e.x, e.centerY, r * 0.3, e.x, e.centerY, r * 1.4);
  g.addColorStop(0, `rgba(255,80,40,${a})`);
  g.addColorStop(1, 'rgba(255,50,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(e.x - r * 1.5, e.centerY - r * 1.5, r * 3, r * 3);
}

/** Draws enemy `e` (status colour `color`); u is its swing progress. */
export function drawEnemy(ctx, e, u, color) {
  const paint = painter(e);
  if (CASTERS[e.type]) return facing(ctx, e.x, -1, () => caster(ctx, e, u, color, paint, CASTERS[e.type]));
  if (WARLORDS[e.type]) return facing(ctx, e.x, -1, () => warlord(ctx, e, u, color, paint, WARLORDS[e.type]));
  if (e.def.rock) return golem(ctx, e, u, color, paint);
  switch (e.type) {
    case 'grunt': return facing(ctx, e.x, -1, () => grunt(ctx, e, u, color, paint));
    case 'runner': return facing(ctx, e.x, -1, () => runner(ctx, e, u, color, paint));
    case 'thrower': return facing(ctx, e.x, -1, () => thrower(ctx, e, u, color, paint));
    case 'shield': return facing(ctx, e.x, -1, () => shield(ctx, e, u, color, paint));
    case 'brute': return facing(ctx, e.x, -1, () => brute(ctx, e, u, color, paint));
    case 'boss': return facing(ctx, e.x, -1, () => boss(ctx, e, u, color, paint));
    case 'vulture': return vulture(ctx, e, color, paint);
    case 'raven': return raven(ctx, e, color, paint);
    case 'ram': return ram(ctx, e, u, color, paint);
    case 'catapult': return catapult(ctx, e, u, color, paint);
    case 'assassin': return facing(ctx, e.x, -1, () => assassin(ctx, e, u, color, paint));
    case 'sapper': return facing(ctx, e.x, -1, () => sapper(ctx, e, color, paint));
    case 'scorpion': return scorpion(ctx, e, u, color, paint);
    case 'wraith': return wraith(ctx, e, u, color, paint);
    case 'dragon': return dragon(ctx, e, u, color, paint);
  }
  return null;
}
