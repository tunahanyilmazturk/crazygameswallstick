import { GROUND_Y, INK } from '../core/constants.js';
import { drawPosed, skeleton, walkLegs } from '../render/stick.js';
import { bowCycle, drawArcher } from '../render/archer.js';
import {
  add, bump, clamp01, dirOf, dot, easeIn, easeInOut, easeOut, facing, hash, keys, keys2, line, mix, mix2, off,
  poly, span, toward,
} from '../render/anim.js';
import { beard, cape, cuirass, garment, helm, hood, pauldron, plume, tone, wizardHat } from './kit.js';
import { bolt, bomb, smear, spear, sword } from './weapons.js';

/*
 * How every unit looks. ART[key](ctx, u) draws unit `u` standing on (u.x, u.y) and returns
 * its joints. The unit's clocks drive the animation: `u.since` (time since its last attack,
 * which each unit's action cycle runs on), `u.cd` (cooldown; the wind-up before an attack
 * reads it), `u.alert` (0 relaxed .. 1 combat stance), `u.theta` (aim), `u.t` (idle sway).
 * Units are stick figures in costume, like the rest of the game, posed by where their
 * hands go (drawPosed) rather than by joint angles.
 */

/** Wind-up toward the next attack: 0 until the last `win` seconds of the cooldown, then up to 1. */
const windup = (u, win) => u.alert * clamp01(1 - u.cd / win);
const fist = (ctx, p, s) => dot(ctx, p, 1.8 * s, INK);
/** Aim angle seen from a unit drawn facing right inside facing(). */
const localAim = (u) => (u.facing < 0 ? Math.atan2(Math.sin(u.theta), -Math.cos(u.theta)) : u.theta);

function orb(ctx, x, y, r, color) {
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
  g.addColorStop(0, '#fffbe6');
  g.addColorStop(0.35, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// ---- Okçular ------------------------------------------------------------------------

/** Archers share the hero's cycle: release, fetch from the quiver, nock, draw, hold. */
function bowman(ctx, u, look) {
  const c = bowCycle(u.since, u.period, 1 - u.alert);
  const lean = -0.05 + Math.sin(u.t * 2.2) * 0.02 - c.release * 0.08;
  return drawArcher(ctx, u.x, u.y, u.theta + (1 - u.alert) * 0.3, c.pull, { s: 0.95, t: u.t, quiver: true, lean, ...c, ...look });
}

/** Standing wooden shield the crossbowman kneels behind on open ground. */
function pavise(ctx, x, y) {
  const pts = [[x + 21, y], [x + 19, y - 30], [x + 26, y - 37], [x + 33, y - 30], [x + 32, y]];
  poly(ctx, pts, '#5a3b22', INK, 1.2);
  ctx.strokeStyle = 'rgba(20,18,25,0.35)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const k of [24, 28]) {
    ctx.moveTo(x + k, y - 1);
    ctx.lineTo(x + k, y - 32);
  }
  ctx.stroke();
  poly(ctx, [[x + 23, y - 24], [x + 30, y - 24], [x + 30, y - 12], [x + 26.5, y - 8], [x + 23, y - 12]], '#c8312b', '#e2b33c', 1);
}

/** Box of bolts at the back of the hip. */
function boltCase(ctx, j, s) {
  const x = j.hip[0] - 8 * s;
  const y = j.hip[1] - 9 * s;
  for (const k of [0, 1.6, 3.2]) line(ctx, [x + k * s, y + 2 * s], [x + (k - 1.5) * s, y - 3 * s], '#cdb68a', 0.9 * s);
  poly(ctx, [[x - 1 * s, y], [x + 4.5 * s, y], [x + 4 * s, y + 10 * s], [x - 0.5 * s, y + 10 * s]], '#5b3b24', INK, 0.8 * s);
}

/**
 * Kneeling crossbowman: kick on the shot, nose the crossbow down into the stirrup, wind the
 * cranequin, fetch a bolt from the hip, lay it in the groove, raise and aim.
 */
function crossbow(ctx, u) {
  if (u.y >= GROUND_Y) pavise(ctx, u.x, u.y);
  const s = 0.95;
  const C = Math.min(2, Math.max(0.5, u.period * 0.85));
  const k = u.since / C;
  const kick = 1 - easeOut(span(u.since, 0, 0.25));
  const lower = k < 1 ? keys(k, [[0.08, 0], [0.22, 1], [0.7, 1], [0.86, 0]]) : 0;
  const crank = span(k, 0.26, 0.62);
  const pull = k < 0.26 ? 0 : easeInOut(crank);
  const aim = mix(0.45, Math.max(-0.6, Math.min(0.4, u.theta)), u.alert);
  const ang = mix(aim, 1.2, lower) - kick * 0.18;
  const d = dirOf(ang);
  const n = [d[1], -d[0]];
  const fig = { x: u.x, y: u.y, s, crouch: 9, legs: [[1.2, -0.3], [-0.2, -1.4]], lean: 0.12 - kick * 0.14 + lower * 0.12 + Math.sin(u.t * 2) * 0.015 };
  const sk = skeleton(fig);
  const butt = add(mix2(off(sk.sh, 1.5, 1.5, s), off(sk.sh, 7, 3, s), lower), d, -3 * s * kick);
  const at = (a, b = 0) => [butt[0] + (d[0] * a + n[0] * b) * s, butt[1] + (d[1] * a + n[1] * b) * s];
  const crankC = at(-1.5);
  const handle = add(crankC, dirOf(crank * Math.PI * 8), 3.2 * s);
  const trig = at(3.5, -1.8);
  const groove = at(11, 1);
  let handB = trig;
  if (k < 1) handB = keys2(k, [[0.22, trig], [0.27, handle], [0.6, handle], [0.67, off(sk.hip, -6, -4, s)], [0.74, groove], [0.82, trig]]);
  if (k > 0.27 && k < 0.6) handB = handle; // ride the crank exactly while it turns
  const handF = at(12, -1.8);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: handF, bend: [0, 1] },
    reachB: { to: handB, bend: [-0.3, 1] },
    body: (b) => {
      boltCase(ctx, b, s);
      garment(ctx, b, { color: '#5d6b3a', length: 5, hem: 7, belt: '#3a2a22', buckle: '#c9a24a' });
    },
  });
  // Stock, with the cranequin wheel showing while it is spanned
  line(ctx, at(-1), at(23), INK, 4.2 * s);
  line(ctx, at(-1), at(23), '#6a4a2c', 2.6 * s);
  if (lower > 0.3) {
    dot(ctx, crankC, 2.6 * s, '#5b5f68');
    line(ctx, crankC, handle, '#8d96a3', 1.3 * s);
  }
  // Steel prod bending back as the string is spanned
  const bend = 1.5 + 2.5 * pull;
  const t1 = at(20 - bend, 9.5);
  const t2 = at(20 - bend, -9.5);
  const ctrl = at(23.5);
  for (const [w, c] of [[3.4, INK], [1.8, '#8d96a3']]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w * s;
    ctx.beginPath();
    ctx.moveTo(t1[0], t1[1]);
    ctx.quadraticCurveTo(ctrl[0], ctrl[1], t2[0], t2[1]);
    ctx.stroke();
  }
  const nut = at(mix(20, 7.5, pull));
  ctx.strokeStyle = '#e8e0c8';
  ctx.lineWidth = 0.9 * s;
  ctx.beginPath();
  ctx.moveTo(t1[0], t1[1]);
  ctx.lineTo(nut[0], nut[1]);
  ctx.lineTo(t2[0], t2[1]);
  ctx.stroke();
  ctx.strokeStyle = '#8d96a3';
  ctx.lineWidth = 1.1 * s;
  ctx.beginPath();
  ctx.arc(...at(25), 2 * s, 0, Math.PI * 2);
  ctx.stroke();
  if (k > 0.74) bolt(ctx, at(7.5), d, 16 * s, s);
  else if (k > 0.67) bolt(ctx, add(handB, d, -4 * s), d, 15 * s, s);
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  helm(ctx, j, 'kettle', '#6c7582', '#9aa3ad');
  return j;
}

/**
 * Watchtower ballista and its loader: the arms snap forward on the shot, he winds the
 * windlass to draw the slider back, lifts a bolt from the rack into the groove, then
 * steadies the machine by its handles.
 */
function ballista(ctx, u) {
  const x = u.x;
  const top = u.y;
  // Tower legs and bracing
  ctx.strokeStyle = '#3b2a1c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 22, GROUND_Y);
  ctx.lineTo(x - 14, top);
  ctx.moveTo(x + 42, GROUND_Y);
  ctx.lineTo(x + 34, top);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let y = top + 20; y < GROUND_Y - 10; y += 44) {
    ctx.moveTo(x - 18, y);
    ctx.lineTo(x + 38, y + 40);
    ctx.moveTo(x + 38, y);
    ctx.lineTo(x - 18, y + 40);
  }
  ctx.stroke();
  ctx.fillStyle = '#4a3423';
  ctx.fillRect(x - 24, top - 4, 72, 10);
  ctx.fillRect(x - 24, top - 22, 4, 18);
  ctx.fillRect(x + 44, top - 22, 4, 18);
  ctx.fillRect(x - 24, top - 22, 72, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = x - 16; k < x + 48; k += 9) {
    ctx.moveTo(k, top - 4);
    ctx.lineTo(k, top + 6);
  }
  ctx.stroke();
  // Bolt rack
  for (const k of [0, 3, 6]) bolt(ctx, [x - 19 + k, top - 5], [0.08, -1], 18, 1, '#e2b33c');
  ctx.fillStyle = '#5a3b22';
  ctx.fillRect(x - 21, top - 9, 11, 4);

  const s = 0.9;
  const C = Math.min(1.6, Math.max(0.5, u.period * 0.85));
  const k = u.since / C;
  const pull = k < 0.12 ? 0 : easeInOut(span(k, 0.12, 0.62));
  const kick = 1 - easeOut(span(u.since, 0, 0.22));
  const turn = span(k, 0.12, 0.62) * Math.PI * 6;
  const th = u.theta;
  const piv = [x + 26, top - 30];
  const R = (lx, ly) => [piv[0] + Math.cos(th) * lx - Math.sin(th) * ly, piv[1] + Math.sin(th) * lx + Math.cos(th) * ly];
  const handle = R(-16 + Math.cos(turn) * 4.5, Math.sin(turn) * 4.5);
  const rackTop = [x - 16, top - 22];
  const steer = [R(-15, 2.5), R(-19, -1.5)];
  const cranking = k > 0.12 && k < 0.62;
  const handF = cranking ? handle : k < 1 ? keys2(k, [[0.08, steer[0]], [0.12, handle], [0.62, handle], [0.7, rackTop], [0.8, R(2, -1)], [0.88, steer[0]]]) : steer[0];
  const handB = cranking ? R(-10, 3) : steer[1];
  const j = drawPosed(ctx, {
    x: x - 4, y: top - 4, s, lean: 0.18 + (cranking ? Math.sin(turn) * 0.05 : 0),
    legs: [[0.35, 0.25], [-0.3, -0.2]],
    reachF: { to: handF, bend: [0, 1] },
    reachB: { to: handB, bend: [0, 1] },
    body: (b) => garment(ctx, b, { color: '#4f5d6e', length: 8, belt: '#3a2a22' }),
  });
  helm(ctx, j, 'cap', '#5b3b24');
  // Post and yoke
  ctx.fillStyle = '#3b2a1c';
  ctx.fillRect(x + 22, top - 30, 6, 26);

  ctx.save();
  ctx.translate(piv[0], piv[1]);
  ctx.rotate(th);
  // Rail
  poly(ctx, [[-20, -2.2], [26, -2.2], [26, 2.2], [-20, 2.2]], '#5a3b22', INK, 1);
  // Windlass
  ctx.fillStyle = '#4a3423';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-16, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#8a6a3a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = turn + (i * Math.PI) / 3;
    ctx.moveTo(-16 + Math.cos(a) * 4, Math.sin(a) * 4);
    ctx.lineTo(-16 - Math.cos(a) * 4, -Math.sin(a) * 4);
  }
  ctx.stroke();
  // Frame with twisted-rope springs
  poly(ctx, [[7, -9], [13, -9], [13, 9], [7, 9]], '#4a3423', INK, 1);
  for (const side of [-1, 1]) {
    dot(ctx, [10, side * 6], 2.5, '#8a6a3a');
    line(ctx, [8.5, side * 6 - 1.5], [11.5, side * 6 + 1.5], 'rgba(40,28,18,0.7)', 0.7);
  }
  // Arms swing back as the string is drawn and slam forward on the shot
  const slider = mix(9, -12, pull);
  const tips = [-1, 1].map((side) => [10 - (2 + 7 * pull) + kick * 3, side * (18 - 1.5 * pull)]);
  for (const [w, c] of [[3.4, INK], [2, '#7a5a3a']]) {
    for (const tp of tips) line(ctx, [10, Math.sign(tp[1]) * 7], tp, c, w);
  }
  ctx.strokeStyle = '#e8e0c8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tips[0][0], tips[0][1]);
  ctx.lineTo(slider, 0);
  ctx.lineTo(tips[1][0], tips[1][1]);
  ctx.stroke();
  poly(ctx, [[slider - 3, -2.8], [slider + 1, -2.8], [slider + 1, 2.8], [slider - 3, 2.8]], '#6c7582', INK, 0.8);
  if (k > 0.8) bolt(ctx, [slider, 0], [1, 0], 34, 1.2, '#e2b33c');
  ctx.restore();
  if (k > 0.7 && k <= 0.8) bolt(ctx, add(handF, dirOf(-0.3 + th * 0.5), -10), dirOf(-0.3 + th * 0.5), 32, 1.1, '#e2b33c');
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  return j;
}

// ---- Büyücüler ----------------------------------------------------------------------

/** Effects around a caster's focus: flame and embers, orbiting ice, or crackling arcs. */
function focusFx(ctx, kind, p, sd, t, pre, cast, s) {
  const pulse = Math.sin(t * 5) * 0.6;
  const r = (3.2 + pre * 2 + cast * 3 + pulse) * s;
  if (kind === 'fire') {
    orb(ctx, p[0], p[1], r, '#ff9a3c');
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.8 + i * 0.25) % 1;
      dot(ctx, [p[0] + Math.sin(i * 7 + t * 3) * 3 * s, p[1] - ph * 15 * s], (1.3 - ph) * s, `rgba(255,${150 + i * 20},60,${0.8 * (1 - ph)})`);
    }
    ctx.globalCompositeOperation = 'source-over';
  } else if (kind === 'frost') {
    orb(ctx, p[0], p[1], r * 0.9, '#7fd0ff');
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.09;
      const c = [p[0] + Math.cos(a) * 8 * s, p[1] + Math.sin(a) * 3.5 * s];
      const z = 1.6 * s;
      poly(ctx, [[c[0], c[1] - z * 1.6], [c[0] + z, c[1]], [c[0], c[1] + z * 1.6], [c[0] - z, c[1]]], 'rgba(223,246,255,0.95)', 'rgba(60,130,190,0.8)', 0.5 * s);
    }
  } else {
    orb(ctx, p[0], p[1], r, '#9fd6ff');
    const seed = Math.floor(t * 14);
    const arcs = (hash(seed) > 0.45 ? 1 : 0) + Math.round(pre * 2 + cast * 3);
    ctx.strokeStyle = 'rgba(225,244,255,0.9)';
    ctx.lineWidth = 1.1 * s;
    for (let i = 0; i < arcs; i++) {
      const a = hash(seed * 3 + i) * Math.PI * 2;
      const len = (7 + hash(seed * 5 + i) * 8) * s;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let k = 1; k <= 3; k++) {
        const jit = (hash(seed * 7 + i * 3 + k) - 0.5) * 5 * s;
        ctx.lineTo(p[0] + Math.cos(a) * len * (k / 3) - Math.sin(a) * jit, p[1] + Math.sin(a) * len * (k / 3) + Math.cos(a) * jit);
      }
      ctx.stroke();
    }
  }
  // Power drawn in from the air during the wind-up
  if (pre > 0.05) {
    const col = kind === 'fire' ? '255,190,110' : kind === 'frost' ? '200,240,255' : '200,230,255';
    for (let i = 0; i < 5; i++) {
      const ph = (t * 1.6 + i / 5) % 1;
      const a = i * 1.26 + t * 0.7;
      const rr = (20 * (1 - ph) + 2) * s;
      dot(ctx, [p[0] + Math.cos(a) * rr, p[1] + Math.sin(a) * rr], 1.1 * s, `rgba(${col},${pre * ph})`);
    }
  }
}

/**
 * A spell caster on the keep: idles with the staff upright, raises it back as the cooldown
 * runs out while power gathers, then thrusts it toward the target on the cast.
 * o: { robe, trim, sash, kind, hat, band, beard, hood, eye, mantle, two }
 */
function caster(ctx, u, o) {
  const s = 1;
  const pre = windup(u, 0.55);
  const cast = u.since < 0.6 ? 1 - easeInOut(span(u.since, 0.15, 0.6)) : 0;
  const aim = Math.max(-1.2, Math.min(0.8, u.theta));
  const bob = Math.sin(u.t * 1.6);
  const fig = {
    x: u.x, y: u.y, s,
    legs: [[0.22 + cast * 0.15, 0.12], [-0.22 - cast * 0.1, -0.12]],
    lean: -0.02 + bob * 0.01 - pre * 0.08 + cast * 0.14,
  };
  const sh = skeleton(fig).sh;
  let h = mix2(off(sh, 8, 9 + bob * 0.6), off(sh, -2, -10), pre);
  let a = mix(-1.5 + bob * 0.04, -2.05, pre);
  let hb = mix2(off(sh, 3, 15), off(sh, 12, -1), pre);
  h = mix2(h, add(off(sh, 0, -3), dirOf(aim), 15), cast);
  a = mix(a, aim - (o.two ? 1 : 0.8), cast);
  hb = mix2(hb, off(sh, -9, 5), cast);
  const sd = dirOf(a);
  if (o.two) hb = add(h, sd, -8 * s);
  const sway = Math.sin(u.t * 1.8) * 1.5 - cast * 3 + pre;
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: h, bend: [0.3, 1] },
    reachB: { to: hb, bend: [-0.2, 1] },
    body: (b) => {
      garment(ctx, b, { color: o.robe, length: (u.y - 1.5 - b.hip[1]) / s, wTop: 5, wHip: 6.5, hem: 10 + cast * 2, sway, trim: o.trim, belt: o.sash, top: 0.05 });
      if (o.mantle) {
        ctx.fillStyle = o.mantle;
        ctx.beginPath();
        ctx.ellipse(b.neck[0], b.neck[1] + 3.5 * s, 7.5 * s, 4 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });
  // Staff with a headpiece holding the focus
  const head = add(h, sd, 13 * s);
  const foot = add(h, sd, -17 * s);
  line(ctx, foot, head, INK, 3.4 * s);
  line(ctx, foot, head, '#4a3220', 2 * s);
  const n = [-sd[1], sd[0]];
  const focus = add(head, sd, 3.4 * s);
  if (o.kind === 'frost') {
    poly(ctx, [add(head, sd, 9 * s), add(focus, n, 2.4 * s), add(head, sd, -0.5 * s), add(focus, n, -2.4 * s)], 'rgba(214,242,255,0.95)', '#3f86c4', 0.7 * s);
  } else {
    ctx.strokeStyle = o.kind === 'fire' ? '#c9a24a' : '#9aa3ad';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    for (const side of [1, -1]) {
      ctx.moveTo(head[0], head[1]);
      ctx.quadraticCurveTo(...add(add(head, n, side * 4.5 * s), sd, 2 * s), ...add(add(focus, n, side * 1.5 * s), sd, 3 * s));
    }
    ctx.stroke();
  }
  focusFx(ctx, o.kind, focus, sd, u.t, pre, cast, s);
  // A ring flashes out from the focus as the spell leaves
  if (u.since < 0.2) {
    ctx.strokeStyle = o.kind === 'fire' ? `rgba(255,200,120,${1 - u.since / 0.2})` : `rgba(210,240,255,${1 - u.since / 0.2})`;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(focus[0], focus[1], (5 + u.since * 70) * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  if (o.beard) beard(ctx, j, o.beard, Math.sin(u.t * 1.8) * 0.8 - cast);
  if (o.hat) wizardHat(ctx, j, o.hat, o.band, Math.sin(u.t * 2) * 2 - cast * 2);
  if (o.hood) hood(ctx, j, o.hood, o.eye, true);
  return j;
}

// ---- Kuşatma ------------------------------------------------------------------------

/**
 * Field gun on the back wall and its gunner: the gun kicks back on its wheels, the gunner
 * flinches, rams the bore with a long rammer, lifts a ball from the pile to the muzzle, takes
 * up the linstock and touches it to the vent as the next shot comes due.
 */
function cannon(ctx, u) {
  const s = 1;
  const C = Math.min(3.4, Math.max(1, u.period * 0.9));
  const k = u.since / C;
  const pre = windup(u, 0.5);
  const kick = u.since < 0.6 ? keys(u.since, [[0, 0], [0.05, 1], [0.6, 0]]) : 0;
  const th = u.theta;
  const piv = [u.x + 30 - 8 * kick, u.y - 14];
  const bd = dirOf(th);
  const bn = [bd[1], -bd[0]];
  const B = (a, b) => [piv[0] + bd[0] * a + bn[0] * b, piv[1] + bd[1] * a + bn[1] * b];
  const muzzle = B(28, 0);
  const vent = B(-6, 6.5);
  const pile = [u.x - 12, u.y - 4];
  const stand = [u.x - 2, u.y - 17];

  // Shot pile
  for (const [dx, dy] of [[-3.5, 1], [3.5, 1], [0, -4.5]]) {
    if (dy < 0 && k > 0.55 && k < 0.66) continue; // the top ball is in the gunner's hands
    dot(ctx, [pile[0] + dx, pile[1] + dy], 3.3, '#2a262c');
    dot(ctx, [pile[0] + dx - 1, pile[1] + dy - 1], 1, 'rgba(255,255,255,0.3)');
  }

  const gx = u.x + 4;
  const flinch = k < 0.15 ? bump(span(k, 0, 0.15)) : 0;
  const crouch = bump(span(k, 0.5, 0.62)) * 8;
  const fig = { x: gx, y: u.y, s, crouch, lean: 0.12 - flinch * 0.25 + crouch * 0.025, legs: [[0.3, 0.2], [-0.3, -0.2]] };
  const sk = skeleton(fig);
  const rest = off(sk.sh, 6, 12, s);
  const hip = off(sk.hip, -4, -3, s);
  const ready = off(sk.sh, 8, 5, s);
  const touchAt = add(vent, toward(vent, sk.sh), 15 * s);
  const linHold = mix2(ready, touchAt, pre);

  // Rammer: in and out of the bore twice
  const ramOn = k > 0.12 && k < 0.5 ? Math.min(span(k, 0.12, 0.18), 1 - span(k, 0.44, 0.5)) : 0;
  const depth = (5 + 9 * (0.5 - 0.5 * Math.cos(span(k, 0.18, 0.44) * Math.PI * 4))) * s;
  const rodEnd = add(muzzle, bd, -depth);
  const rodDir = toward(rodEnd, off(sk.sh, 4, 6, s));
  const rodF = add(rodEnd, rodDir, 30 * s);
  const rodB = add(rodEnd, rodDir, 37 * s);

  let handF;
  let handB = mix2(hip, off(sk.head, 3, 2, s), flinch);
  if (k < 0.12) handF = keys2(k, [[0, touchAt], [0.06, ready], [0.12, stand]]);
  else if (k < 0.5) handF = mix2(stand, rodF, ramOn);
  else if (k < 0.66) handF = keys2(k, [[0.5, stand], [0.55, off(pile, 0, -4)], [0.6, off(sk.sh, 9, 2, s)], [0.66, off(sk.sh, 17, 9, s)]]);
  else if (k < 0.74) handF = keys2(k, [[0.66, off(sk.sh, 17, 9, s)], [0.7, stand], [0.74, linHold]]);
  else handF = linHold;
  if (ramOn > 0) handB = mix2(handB, rodB, ramOn);
  const linInHand = k < 0.12 || k > 0.7;

  if (ramOn > 0.05) {
    line(ctx, rodEnd, add(rodEnd, rodDir, 44 * s), INK, 2.6 * s);
    line(ctx, rodEnd, add(rodEnd, rodDir, 44 * s), '#7a5a3a', 1.4 * s);
  }
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: handF, bend: [0, 1] },
    reachB: { to: handB, bend: [-0.4, 1] },
    body: (b) => garment(ctx, b, { color: '#7a3a2a', length: 9, hem: 8, belt: '#2c2018', buckle: '#c9a24a' }),
  });
  helm(ctx, j, 'bandana', '#c8312b');

  // Carriage trail, wheel and barrel
  poly(ctx, [[piv[0] + 4, piv[1] + 3], [piv[0] - 28, u.y - 1], [piv[0] - 31, u.y - 5], [piv[0] - 3, piv[1] - 4]], '#5a3b22', INK, 1);
  const barrel = [B(-10, 6.2), B(22, 4.6), B(23, 5.8), B(28, 5.8), B(28, -5.8), B(23, -5.8), B(22, -4.6), B(-10, -6.2)];
  dot(ctx, B(-12.5, 0), 2.6, '#2c2a30');
  poly(ctx, barrel, '#2c2a30', INK, 1);
  line(ctx, B(-8, 4.2), B(21, 3.2), 'rgba(255,255,255,0.2)', 1.4);
  for (const r of [0, 10, 19]) line(ctx, B(r, 5.6 - r * 0.05), B(r, -5.6 + r * 0.05), '#4a4650', 1.6);
  const wheel = [piv[0], u.y - 8];
  ctx.strokeStyle = '#4a3423';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -kick * 1.2 + (i * Math.PI) / 3;
    ctx.moveTo(wheel[0] + Math.cos(a) * 7, wheel[1] + Math.sin(a) * 7);
    ctx.lineTo(wheel[0] - Math.cos(a) * 7, wheel[1] - Math.sin(a) * 7);
  }
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(wheel[0], wheel[1], 8, 0, Math.PI * 2);
  ctx.stroke();
  dot(ctx, wheel, 2, '#8a6a3a');
  dot(ctx, piv, 2.4, '#5a3b22');
  if (u.since < 0.1) {
    const f = 1 - u.since / 0.1;
    const n = [-bd[1], bd[0]];
    poly(ctx, [add(muzzle, n, 4), add(muzzle, bd, 16 * f), add(muzzle, n, -4)], `rgba(255,214,120,${f})`);
  }

  // Ball being carried to the muzzle, and the linstock with its glowing match
  if (k > 0.55 && k < 0.66) dot(ctx, add(j.handF, [0, -1], s), 3.3, '#2a262c');
  const linBase = linInHand ? j.handF : [stand[0] - 4, u.y];
  const linDir = linInHand ? toward(linBase, mix2(add(linBase, dirOf(-1.2), 1), vent, pre)) : dirOf(-1.25);
  const ember = add(linBase, linDir, (linInHand ? 15 : 19) * s);
  line(ctx, linBase, ember, INK, 2.2 * s);
  line(ctx, linBase, ember, '#7a5a3a', 1.1 * s);
  ctx.globalCompositeOperation = 'lighter';
  dot(ctx, ember, (2.6 + Math.sin(u.t * 13) * 0.5) * s, 'rgba(255,140,50,0.45)');
  dot(ctx, ember, 1.1 * s, '#ffe0a0');
  if (pre > 0.6 || u.since < 0.06) {
    for (let i = 0; i < 4; i++) dot(ctx, [vent[0] + (hash(u.t * 30 + i) - 0.5) * 6, vent[1] - hash(u.t * 31 + i) * 6], 0.9, '#ffcf6a');
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(200,200,210,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ember[0], ember[1]);
  for (let i = 1; i <= 4; i++) ctx.lineTo(ember[0] + Math.sin(u.t * 3 + i) * 2, ember[1] - i * 4);
  ctx.stroke();
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  return j;
}

/**
 * Grenadier: follows through on the throw, pulls the next bomb from his satchel, lights the
 * fuse from a smouldering match, holds it ready, then winds right back as the throw comes due.
 */
function bomber(ctx, u) {
  const s = 0.9;
  const C = Math.min(3, Math.max(0.8, u.period * 0.85));
  const k = u.since / C;
  const pre = windup(u, 0.45);
  const follow = k < 0.2 ? 1 - easeInOut(span(k, 0.05, 0.2)) : 0;
  const aim = Math.max(-1, Math.min(0.3, u.theta));
  const fig = {
    x: u.x, y: u.y, s,
    legs: follow > 0.3 ? [[0.55, 0.35], [-0.45, -0.3]] : [[0.25 + pre * 0.15, 0.15], [-0.25 - pre * 0.1, -0.15]],
    lean: follow * 0.22 - pre * 0.16 + Math.sin(u.t * 2) * 0.015,
  };
  const sk = skeleton(fig);
  const satchel = off(sk.hip, -9, -1, s);
  const ready = off(sk.sh, 8, 7 + Math.sin(u.t * 3) * 0.5, s);
  let hf = k < 1 ? keys2(k, [[0, off(sk.sh, 15, 9, s)], [0.15, off(sk.sh, 12, 12, s)], [0.3, satchel], [0.45, off(sk.sh, 9, 9, s)], [0.65, ready]]) : ready;
  hf = mix2(hf, off(sk.sh, -11, -9, s), pre);
  let hb = k > 0.4 && k < 0.65 ? mix2(off(sk.sh, 4, 14, s), off(sk.sh, 13, 7, s), bump(span(k, 0.4, 0.65))) : off(sk.sh, 4, 14, s);
  hb = mix2(hb, add(sk.sh, dirOf(aim), 17 * s), pre);
  hb = mix2(hb, off(sk.sh, -7, 11, s), follow);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hf, bend: [-0.5, 1] },
    reachB: { to: hb, bend: [0, 1] },
    body: (b) => {
      // Satchel on the back hip, bandolier of bombs across the chest
      ctx.fillStyle = '#805334';
      ctx.beginPath();
      ctx.ellipse(b.hip[0] - 9 * s, b.hip[1] - 3 * s, 6 * s, 8 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();
      dot(ctx, off(b.hip, -9, -9, s), 3 * s, '#2a262c');
      garment(ctx, b, { color: '#a0442c', length: 9, hem: 9, belt: '#3a2a22', trim: '#e2b33c' });
      line(ctx, off(b.sh, 4, 1, s), off(b.hip, -5, -3, s), '#5b3b24', 2 * s);
      for (const t of [0.35, 0.6]) dot(ctx, mix2(off(b.sh, 4, 1, s), off(b.hip, -5, -3, s), t), 1.5 * s, '#2a262c');
    },
  });
  helm(ctx, j, 'cap', '#5b3b24');
  // Smouldering match in the off hand while lighting
  if (k > 0.38 && k < 0.68) {
    const tip = add(j.handB, [0.6, -0.8], 6 * s);
    line(ctx, j.handB, tip, '#7a5a3a', 1.2 * s);
    dot(ctx, tip, 1.3 * s, '#ffb050');
  }
  if (k > 0.3) bomb(ctx, off(j.handF, 1, -3, s), 4.4 * s, s, u.t, k > 0.55);
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  return j;
}

// ---- Piyade -------------------------------------------------------------------------

const GUARD_POSES = {
  rest: { g: [8, 14], a: 1.45 },     // hands on the hilt, point to the ground
  carry: { g: [5, 2], a: -2.35 },    // over the shoulder while marching
  ready: { g: [10, 8], a: -1.0 },
  raise: { g: [-1, -13], a: -2.7 },  // wound up overhead
  cut: { g: [15, 10], a: 0.75 },     // end of the downward cut
};
const blendPose = (p, q, k) => ({ g: mix2(p.g, q.g, k), a: mix(p.a, q.a, k) });

/**
 * Kapı Muhafızı with a greatsword: carries it on the shoulder while marching, takes guard
 * near the enemy, lifts it overhead as the blow comes due, cuts down through the target
 * (leaving a smear) and recovers.
 */
function guard(ctx, u) {
  return facing(ctx, u.x, u.facing, () => {
    const s = 0.98;
    const pre = u.engaged && !u.walking ? clamp01(1 - u.cd / 0.35) : 0;
    const P = GUARD_POSES;
    const base = u.walking ? P.carry : blendPose(P.rest, P.ready, u.alert);
    let pose = blendPose(base, P.raise, pre);
    let lean = 0.04 + (u.walking ? 0.1 : 0) - pre * 0.1;
    if (u.since < 0.65) {
      pose = u.since < 0.09 ? blendPose(P.raise, P.cut, easeIn(span(u.since, 0, 0.09))) : blendPose(P.cut, base, easeInOut(span(u.since, 0.22, 0.65)));
      lean += (1 - span(u.since, 0.1, 0.5)) * 0.2;
    }
    const fig = {
      x: u.x, y: u.y, s, lean,
      legs: u.walking ? walkLegs(u.step ?? 0, 0.55) : u.alert > 0.5 ? [[0.38, 0.25], [-0.32, -0.2]] : [[0.2, 0.1], [-0.2, -0.1]],
    };
    const sk = skeleton(fig);
    const grip = off(sk.sh, pose.g[0], pose.g[1], s);
    const d = dirOf(pose.a);
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: add(grip, d, 1.5 * s), bend: [0.2, 1] },
      reachB: { to: add(grip, d, -4 * s), bend: [-0.2, 1] },
      body: (b) => {
        cape(ctx, b, '#8e2a2a', Math.sin(u.t * 2) * 1.5, u.walking ? 0.4 : 0);
        cuirass(ctx, b, '#9aa3ad');
        garment(ctx, b, { color: '#34475a', length: 10, wTop: 3.5, wHip: 6, hem: 8, trim: '#e2b33c', belt: '#3a2a22', buckle: '#e2b33c', top: 0.45, sway: u.walking ? Math.sin(u.step ?? 0) * 1.5 : 0 });
        pauldron(ctx, b, '#b8c0c9');
      },
    });
    if (u.since < 0.16) smear(ctx, grip, P.raise.a, pose.a, 8 * s, 36 * s, 0.4 * (1 - u.since / 0.16));
    sword(ctx, grip, pose.a, s, { len: 34, w: 1.9, guard: 5.5, handle: 7 });
    fist(ctx, j.handF, s);
    fist(ctx, j.handB, s);
    const crest = helm(ctx, j, 'great', '#b8c0c9', '#b48645');
    plume(ctx, crest, '#c8312b', s, u.walking ? 0.5 : 0);
    return j;
  });
}

/**
 * Mızrakçı: follows through on the throw, reaches over the shoulder for the next javelin
 * from the bundle on the back, brings it up to the carry with the other arm sighting the
 * target, draws back as the throw comes due.
 */
function spearman(ctx, u) {
  return facing(ctx, u.x, u.facing, () => {
    const s = 0.9;
    const C = Math.min(1.4, Math.max(0.6, u.period * 0.85));
    const k = u.since / C;
    const pre = windup(u, 0.35);
    const aim = Math.max(-0.9, Math.min(0.6, localAim(u)));
    const follow = k < 0.25 ? 1 - easeInOut(span(k, 0.08, 0.25)) : 0;
    const fig = {
      x: u.x, y: u.y, s,
      legs: follow > 0.3 ? [[0.55, 0.35], [-0.45, -0.3]] : [[0.3 + pre * 0.1, 0.2], [-0.3 - pre * 0.15, -0.2]],
      lean: follow * 0.2 - pre * 0.12 + Math.sin(u.t * 2) * 0.015,
    };
    const sk = skeleton(fig);
    const carry = off(sk.sh, -5, -6, s);
    const relaxed = off(sk.sh, 7, 13, s);
    const held = k < 1 ? keys2(k, [[0, off(sk.sh, 16, 7, s)], [0.18, off(sk.sh, 10, 10, s)], [0.34, off(sk.sh, -7, -12, s)], [0.55, carry]]) : mix2(relaxed, carry, u.alert);
    const hf = mix2(held, off(sk.sh, -15, -3, s), pre);
    const sight = add(sk.sh, dirOf(aim), 17 * s);
    let hb = mix2(off(sk.sh, 2, 15, s), sight, u.alert * span(k, 0.4, 0.6));
    hb = mix2(hb, off(sk.sh, -8, 10, s), follow);
    // Javelin angle: pulled from the bundle tip-up, levelled toward the target at the carry
    const carryA = aim - 0.15 - pre * 0.2;
    const ja = k < 1 ? keys(k, [[0.34, -1.9], [0.55, carryA]]) : mix(-1.45, carryA, u.alert);
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: hf, bend: [-0.4, 1] },
      reachB: { to: hb, bend: [0, 1] },
      body: (b) => {
        // Bundle of javelins slung across the back
        for (const dx of [0, 2.2]) spear(ctx, off(b.sh, -6 + dx, 4, s), -1.85, s, { back: 18, front: 14, head: 5 });
        line(ctx, off(b.sh, 3, 1, s), off(b.hip, -6, -2, s), '#5b3b24', 1.8 * s);
        garment(ctx, b, { color: '#31597a', length: 9, hem: 8, trim: '#d9e0e8', belt: '#3a2a22' });
      },
    });
    if (k > 0.34) spear(ctx, j.handF, ja, s, { back: 15, front: 19 });
    fist(ctx, j.handF, s);
    fist(ctx, j.handB, s);
    const crest = helm(ctx, j, 'nasal', '#4d718c', '#d9e0e8');
    dot(ctx, crest, 1.2 * s, '#d9e0e8');
    return j;
  });
}

// ---- Destek -------------------------------------------------------------------------

/** Kennel with its handler, who sounds a horn when the pack is sent out. */
function kennel(ctx, u) {
  const x = u.x - 18;
  const y = u.y;
  // Plank walls, shingled roof, arched door, bone sign and water bowl
  ctx.fillStyle = '#6a4528';
  ctx.fillRect(x - 14, y - 22, 28, 22);
  ctx.strokeStyle = 'rgba(30,20,12,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = x - 9; k < x + 14; k += 5) {
    ctx.moveTo(k, y - 21);
    ctx.lineTo(k, y);
  }
  ctx.stroke();
  poly(ctx, [[x - 19, y - 19], [x, y - 35], [x + 19, y - 19]], '#7a2e24', INK, 1);
  ctx.strokeStyle = 'rgba(30,10,8,0.5)';
  ctx.beginPath();
  for (const t of [0.35, 0.65]) {
    ctx.moveTo(x - 19 * (1 - t), y - 19 - 16 * t);
    ctx.lineTo(x + 19 * (1 - t), y - 19 - 16 * t);
  }
  ctx.stroke();
  ctx.fillStyle = '#120f14';
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x - 7, y - 10);
  ctx.arc(x, y - 10, 7, Math.PI, 0);
  ctx.lineTo(x + 7, y);
  ctx.fill();
  ctx.strokeStyle = '#e9e1cf';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 27);
  ctx.lineTo(x + 4, y - 27);
  ctx.stroke();
  for (const [dx, dy] of [[-4.5, -1], [-4.5, 1], [4.5, -1], [4.5, 1]]) dot(ctx, [x + dx, y - 27 + dy], 1.2, '#e9e1cf');
  poly(ctx, [[x + 15, y], [x + 16, y - 3], [x + 24, y - 3], [x + 25, y]], '#6c7582', INK, 0.8);

  const s = 0.85;
  const call = u.since < 1.2 ? bump(span(u.since, 0, 1.2)) : 0;
  const fig = { x: u.x + 6, y, s, legs: [[0.2, 0.1], [-0.2, -0.1]], lean: -0.04 - call * 0.1 + Math.sin(u.t * 1.7) * 0.015 };
  const sk = skeleton(fig);
  const hornAt = mix2(off(sk.sh, 7, 12, s), off(sk.head, 5, 3, s), call);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hornAt, bend: [0, 1] },
    reachB: { to: off(sk.hip, -5, -3, s), bend: [-1, 0.2] },
    body: (b) => garment(ctx, b, { color: '#6b4a2e', length: 8, belt: '#3a2a22', trim: '#a07850' }),
  });
  helm(ctx, j, 'kettle', '#5b4630');
  // Horn tilts up to the lips while calling
  const ha = mix(0.3, -0.5, call);
  const hd = dirOf(ha);
  const hn = [-hd[1], hd[0]];
  const bell = add(j.handF, hd, 8 * s);
  poly(ctx, [add(j.handF, hd, -2 * s), add(bell, hn, 2.8 * s), add(bell, hn, -2.8 * s)], '#d9c38a', INK, 0.8 * s);
  if (call > 0.2) {
    ctx.strokeStyle = `rgba(255,236,190,${call * 0.7})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const r = 5 + ((u.t * 30 + i * 7) % 21);
      ctx.beginPath();
      ctx.arc(bell[0], bell[1], r, ha - 0.5, ha + 0.5);
      ctx.stroke();
    }
  }
  fist(ctx, j.handF, s);
  return j;
}

/**
 * Şifacı: prays with folded hands, lifts her arms as the next blessing gathers, and throws
 * them wide when the healing wave goes out (a ring of light spreads from her feet).
 */
function healer(ctx, u) {
  const s = 1;
  const pre = clamp01(1 - u.cd / 0.5);
  const cast = u.since < 0.9 ? (u.since < 0.1 ? span(u.since, 0, 0.1) : 1 - easeInOut(span(u.since, 0.35, 0.9))) : 0;
  const lift = Math.max(pre * 0.6, cast);
  const bob = Math.sin(u.t * 1.5);
  const fig = { x: u.x, y: u.y, s, legs: [[0.15, 0.08], [-0.15, -0.08]], lean: -0.03 - lift * 0.08 + bob * 0.01 };
  const sk = skeleton(fig);
  const hf = mix2(off(sk.sh, 7, 6 + bob * 0.4, s), off(sk.sh, 13, -18, s), lift);
  const hb = mix2(off(sk.sh, 6, 7 + bob * 0.4, s), off(sk.sh, -8, -18, s), lift);
  if (u.since < 0.9) {
    const k = u.since / 0.9;
    ctx.strokeStyle = `rgba(150,255,190,${0.7 * (1 - k)})`;
    ctx.lineWidth = 2.5 * (1 - k) + 0.5;
    ctx.beginPath();
    ctx.ellipse(u.x, u.y - 2, 10 + k * 55, 3 + k * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    const g = ctx.createLinearGradient(0, u.y - 80, 0, u.y);
    g.addColorStop(0, 'rgba(180,255,210,0)');
    g.addColorStop(1, `rgba(180,255,210,${0.25 * (1 - k)})`);
    ctx.fillStyle = g;
    ctx.fillRect(u.x - 12, u.y - 80, 24, 80);
  }
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hf, bend: [0.2, 1] },
    reachB: { to: hb, bend: [-0.3, 1] },
    body: (b) => {
      garment(ctx, b, { color: '#ece6d6', length: (u.y - 1.5 - b.hip[1]) / s, wTop: 4.5, wHip: 6, hem: 9 + lift * 2, sway: Math.sin(u.t * 1.5) * 1.2, trim: '#d9b45a', belt: '#3f7fb0', top: 0.05 });
    },
  });
  hood(ctx, j, '#f4efe2', '#7a6a50');
  ctx.strokeStyle = `rgba(255,236,150,${0.6 + 0.3 * Math.sin(u.t * 3) + lift * 0.1})`;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.ellipse(j.head[0], j.head[1] - 11 - lift * 2, 7, 2.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Hands (raised over the hood on the blessing) and the light held between them
  line(ctx, j.elbowF, j.handF, INK, 3.2 * s);
  line(ctx, j.elbowB, j.handB, INK, 3.2 * s);
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  const mid = mix2(j.handF, j.handB, 0.5);
  orb(ctx, mid[0], mid[1] - 2 * (1 - lift), (2.5 + lift * 4 + Math.sin(u.t * 4) * 0.5) * s, '#7dffa8');
  return j;
}

/** Waving standard: a swallowtail flag rippling off the pole top, light catching each fold. */
function flag(ctx, px, top, t, s) {
  const N = 8;
  const W = 30 * s;
  const H = 22 * s;
  const wave = (i) => Math.sin(t * 4 - i * 0.8) * (i / N) * 3.2 * s;
  const xs = (i) => px + (i / N) * W - (i / N) * Math.abs(Math.sin(t * 2)) * 2 * s;
  for (let i = 0; i < N; i++) {
    const y0 = wave(i);
    const y1 = wave(i + 1);
    const last = i === N - 1;
    const shade = 0.88 + Math.cos(t * 4 - i * 0.8) * 0.14;
    const pts = [[xs(i), top + y0], [xs(i + 1), top + y1], ...(last ? [[xs(i + 1) - 6 * s, top + H / 2 + y1]] : []), [xs(i + 1), top + H + y1], [xs(i), top + H + y0]];
    poly(ctx, pts, tone('#9c3540', shade));
  }
  // Gold trim along the edges and a lion-gold diamond on the field
  ctx.strokeStyle = '#f0cf83';
  ctx.lineWidth = 1.3 * s;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) ctx[i ? 'lineTo' : 'moveTo'](xs(i), top + wave(i));
  ctx.lineTo(xs(N) - 6 * s, top + H / 2 + wave(N));
  for (let i = N; i >= 0; i--) ctx.lineTo(xs(i), top + H + wave(i));
  ctx.stroke();
  const c = [xs(3), top + H / 2 + wave(3)];
  poly(ctx, [[c[0], c[1] - 6 * s], [c[0] + 5 * s, c[1]], [c[0], c[1] + 6 * s], [c[0] - 5 * s, c[1]]], '#f0cf83', 'rgba(90,40,20,0.6)', 0.7 * s);
  dot(ctx, c, 1.6 * s, '#9c3540');
}

/** Sancaktar: plants the standard and lifts it with every rallying pulse. */
function banner(ctx, u) {
  const pulse = 0.08 + (Math.sin(u.t * 2.4) + 1) * 0.035;
  ctx.fillStyle = `rgba(255, 202, 105, ${pulse})`;
  ctx.beginPath();
  ctx.ellipse(u.x + 6, u.y - 2, 34, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#504956';
  ctx.fillRect(u.x - 7, u.y - 4, 38, 7);
  ctx.fillStyle = '#928a91';
  ctx.fillRect(u.x - 4, u.y - 5, 32, 2);

  const s = 0.88;
  const lift = bump(span(u.since, 0, 0.45)) * 3;
  const px = u.x + 5;
  const top = u.y - 70 - lift;
  line(ctx, [px, u.y - 4 - lift], [px, top], INK, 4.4);
  line(ctx, [px, u.y - 6 - lift], [px, top + 2], '#6b4a30', 2.4);
  poly(ctx, [[px - 2.2, top + 1], [px, top - 7], [px + 2.2, top + 1]], '#f0cf83', INK, 0.8);
  flag(ctx, px + 1.5, top + 3, u.t, 1);

  const fig = { x: u.x - 10, y: u.y, s, legs: [[0.25, 0.15], [-0.2, -0.1]], lean: 0.04 + Math.sin(u.t * 1.6) * 0.015 };
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: [px - 1, u.y - 38 - lift], bend: [0, 1] },
    reachB: { to: [px - 1, u.y - 27 - lift], bend: [0, 1] },
    body: (b) => {
      cape(ctx, b, '#6a2430', Math.sin(u.t * 2.4) * 2);
      garment(ctx, b, { color: '#7f303b', length: 10, trim: '#f0cf83', belt: '#3a2a22', buckle: '#f0cf83' });
    },
  });
  fist(ctx, j.handF, s);
  fist(ctx, j.handB, s);
  plume(ctx, helm(ctx, j, 'nasal', '#9aa3ad', '#f0cf83'), '#f0cf83', s);
  return j;
}

/** Davulcu: alternating sticks on a rope-tensioned drum, each beat rippling outward. */
function drummer(ctx, u) {
  const s = 0.92;
  if (u.since < 0.25) {
    const beat = 1 - u.since / 0.25;
    ctx.strokeStyle = `rgba(255,214,140,${0.35 * beat})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(u.x + 10, u.y - 26, 14 + (1 - beat) * 26, 8 + (1 - beat) * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const fig = { x: u.x, y: u.y, s, legs: [[0.25, 0.15], [-0.25, -0.15]], lean: -0.06 + bump(span(u.since, 0, 0.2)) * 0.03 };
  const sk = skeleton(fig);
  const D = off(sk.hip, 11, -8, s); // drum centre
  const skinY = D[1] - 7 * s;
  // The stick that just struck rebounds; the other rises and comes down on the next beat
  const struck = keys(u.since, [[0, 0], [0.1, 0.85], [0.5, 0.5]]);
  const coming = keys(u.since, [[0, 0.5], [0.32, 1], [0.47, 0.15], [0.5, 0]]);
  const heights = u.actions % 2 ? [struck, coming] : [coming, struck];
  const hands = heights.map((h, i) => {
    const hitX = D[0] + (i ? -2.5 : 2.5) * s;
    return { h, hand: [hitX - 7 * s, skinY - 5 * s - h * 13 * s], a: 0.6 - h * 1.1, hitX };
  });
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: hands[0].hand, bend: [0, 1] },
    reachB: { to: hands[1].hand, bend: [-0.3, 1] },
    body: (b) => {
      garment(ctx, b, { color: '#7f303b', length: 9, trim: '#e2b33c', belt: '#3a2a22' });
      line(ctx, off(b.sh, -2, 0, s), [D[0] - 4 * s, D[1] - 6 * s], '#5b3b24', 1.6 * s);
    },
  });
  // Drum: shell with rope tension, hoops and a skin seen from slightly above
  const w = 7.5 * s;
  const h = 14 * s;
  poly(ctx, [[D[0] - w, skinY], [D[0] + w, skinY], [D[0] + w, skinY + h], [D[0] - w, skinY + h]], '#8a2e2a', INK, 0.9 * s);
  ctx.strokeStyle = '#e9e1cf';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const x0 = D[0] - w + (i / 4) * 2 * w;
    ctx.moveTo(x0, skinY + 1.5 * s);
    ctx.lineTo(x0 + w / 2, skinY + h - 1.5 * s);
    ctx.lineTo(x0 + w, skinY + 1.5 * s);
  }
  ctx.stroke();
  for (const yy of [skinY + 1.2 * s, skinY + h - 1.2 * s]) line(ctx, [D[0] - w, yy], [D[0] + w, yy], '#e2b33c', 1.6 * s);
  const hit = u.since < 0.06 ? 1 - u.since / 0.06 : 0;
  ctx.fillStyle = '#efe6d2';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.ellipse(D[0], skinY, w, (2.6 - hit * 0.8) * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Sticks
  for (const [i, hd] of hands.entries()) {
    const p = i ? j.handB : j.handF;
    const tip = add(p, dirOf(hd.a), 9 * s);
    line(ctx, p, tip, '#3b2a1c', 1.6 * s);
    dot(ctx, tip, 1.6 * s, '#e9e1cf');
    fist(ctx, p, s);
  }
  helm(ctx, j, 'kettle', '#c8312b', '#e2b33c');
  return j;
}

export const ART = {
  archer: (ctx, u) => bowman(ctx, u, { hood: '#3f8f4a', accent: '#3f8f4a' }),
  hunter: (ctx, u) => bowman(ctx, u, { hood: '#76532f', accent: '#b48645', cape: true }),
  crossbow,
  ballista,
  mage: (ctx, u) => caster(ctx, u, { kind: 'fire', robe: '#4a2a78', trim: '#e2b33c', sash: '#e2b33c', hat: '#5a2d91', band: '#e2b33c', beard: '#e8e4dc' }),
  frost: (ctx, u) => caster(ctx, u, { kind: 'frost', robe: '#2f6fa8', trim: '#d8f0ff', sash: '#bfe8ff', hood: '#2f7fc4', eye: '#bfe8ff', mantle: '#eef7fc' }),
  storm: (ctx, u) => caster(ctx, u, { kind: 'storm', robe: '#2a3550', trim: '#9fd6ff', sash: '#1a2238', hood: '#2a3550', eye: '#9fd6ff', two: true }),
  cannon,
  bomber,
  guard,
  spearman,
  kennel,
  healer,
  banner,
  drummer,
};

/**
 * Dogs of the Savaş Köpekleri: galloping with legs reaching and gathering, lunging with the
 * jaw open to bite, or sitting by the kennel wagging when there is nothing to chase.
 */
export function drawDogs(ctx, dogs, t = 0) {
  for (const d of dogs ?? []) {
    facing(ctx, d.x, d.f || 1, () => drawDog(ctx, d, t));
  }
}

function drawDog(ctx, d, t) {
  const COAT = '#3a2c22';
  const FAR = '#251b15';
  const run = d.running;
  const sit = !run && !d.target;
  const bite = d.anim > 0 ? Math.sin((d.anim / 0.25) * Math.PI) : 0;
  const ph = d.phase;
  const bob = run ? Math.abs(Math.sin(ph)) * 2 : 0;
  const x = d.x + bite * 4;
  const by = GROUND_Y - 13 - bob;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const leg = (root, a1, a2, color, w = 2.2) => {
    const knee = [root[0] + Math.sin(a1) * 6, root[1] + Math.cos(a1) * 6];
    const paw = [knee[0] + Math.sin(a2) * 6, Math.min(GROUND_Y - 1, knee[1] + Math.cos(a2) * 6)];
    line(ctx, root, knee, color, w);
    line(ctx, knee, paw, color, w * 0.85);
  };
  if (sit) {
    // Haunches on the ground, chest up, tail sweeping the dirt
    const wag = Math.sin(t * 9 + d.home) * 0.5;
    ctx.strokeStyle = COAT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, GROUND_Y - 4);
    ctx.quadraticCurveTo(x - 13, GROUND_Y - 3, x - 16, GROUND_Y - 5 - wag * 4);
    ctx.stroke();
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.ellipse(x - 2, GROUND_Y - 9, 9, 6, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 6, GROUND_Y - 4, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    leg([x + 4, GROUND_Y - 12], 0.05, 0, FAR);
    leg([x + 6, GROUND_Y - 12], 0, 0, COAT);
    dogHead(ctx, [x + 6, GROUND_Y - 19], 0.15, 0, COAT, false);
    return;
  }
  // Legs: front pair reaching forward while the hind pair drives back, then gathering
  const s1 = run ? Math.sin(ph) : 0;
  const front = [x + 7, by + 2];
  const hind = [x - 8, by + 1];
  for (const [o, color] of [[0.35, FAR], [0, COAT]]) {
    const fa = run ? s1 * 0.8 + Math.sin(ph + o) * 0.1 : 0.05 - bite * 0.3;
    leg(front, fa, fa - (run ? Math.max(0, -Math.sin(ph + o + 0.6)) * 1.2 : 0), color);
    const ha = run ? -s1 * 0.8 + Math.sin(ph + o) * 0.1 : -0.1 + bite * 0.2;
    leg(hind, ha, ha + (run ? Math.max(0, Math.sin(ph + o + 0.6)) * 1.1 : 0.3), color);
  }
  // Body: deep chest, tucked belly; stretches and bunches with the stride
  const stretch = run ? s1 * 2 : 0;
  ctx.fillStyle = COAT;
  ctx.beginPath();
  ctx.moveTo(x - 11 - stretch * 0.5, by - 1);
  ctx.quadraticCurveTo(x - 4, by - 7, x + 9 + stretch * 0.5, by - 4);
  ctx.quadraticCurveTo(x + 13, by + 1, x + 8, by + 5);
  ctx.quadraticCurveTo(x, by + 3, x - 9, by + 3);
  ctx.quadraticCurveTo(x - 13, by + 2, x - 11 - stretch * 0.5, by - 1);
  ctx.fill();
  // Tail streams behind at a run, wags when standing
  const wag = run ? Math.sin(ph * 1.3) * 3 : Math.sin(t * 10) * 3;
  ctx.strokeStyle = COAT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 10, by - 1);
  ctx.quadraticCurveTo(x - 15, by - 4 + wag, x - 18, by - (run ? 2 : 8) + wag);
  ctx.stroke();
  // Collar
  ctx.fillStyle = '#c8312b';
  ctx.fillRect(x + 8, by - 7, 2.2, 4.5);
  dogHead(ctx, [x + 12, by - 7 - (run ? 0 : 2)], run ? 0.25 : -0.05 + bite * 0.3, bite, COAT, run);
}

/** Head facing right from the neck point: skull, snout, ear; jaw opens with `bite` (0..1). */
function dogHead(ctx, neck, tilt, bite, color, run) {
  ctx.save();
  ctx.translate(neck[0], neck[1]);
  ctx.rotate(tilt);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(1, -1, 4.2, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(3, -3.2);
  ctx.lineTo(10, -1.2);
  ctx.lineTo(10, 0.6);
  ctx.lineTo(3, 1);
  ctx.fill();
  // Lower jaw swings open to bite
  ctx.save();
  ctx.translate(3, 1);
  ctx.rotate(bite * 0.6);
  ctx.beginPath();
  ctx.moveTo(0, -0.5);
  ctx.lineTo(6.5, 0);
  ctx.lineTo(0, 2);
  ctx.fill();
  if (bite > 0.2) dot(ctx, [5, 0], 0.7, '#f4ece0');
  ctx.restore();
  // Ear laid back when running, pricked otherwise
  ctx.beginPath();
  if (run) {
    ctx.moveTo(-1, -3.5);
    ctx.lineTo(-6, -4.5);
    ctx.lineTo(-1.5, -1.5);
  } else {
    ctx.moveTo(-1.5, -3);
    ctx.lineTo(-0.5, -8.5);
    ctx.lineTo(1.8, -3.5);
  }
  ctx.fill();
  dot(ctx, [10, -0.5], 1, '#0b090c');
  dot(ctx, [3.5, -2.2], 0.7, '#f3e2b3');
  ctx.restore();
}

/** Rank insignia: one gold chevron per star above the unit. */
export function drawInsignia(ctx, x, y, stars) {
  if (!stars) return;
  ctx.strokeStyle = stars >= 4 ? '#ffe38a' : '#e2b33c';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < stars; i++) {
    const cy = y - i * 3.2;
    ctx.moveTo(x - 4, cy);
    ctx.lineTo(x, cy - 2.6);
    ctx.lineTo(x + 4, cy);
  }
  ctx.stroke();
  if (stars >= 4) {
    // Efsane: a small glow behind the chevrons
    ctx.fillStyle = 'rgba(255,220,120,0.25)';
    ctx.beginPath();
    ctx.arc(x, y - 5, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}
