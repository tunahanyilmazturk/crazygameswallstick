import { INK } from '../core/constants.js';
import { drawFigure, reachArm, skeleton } from './stick.js';

// '#rrggbb' helpers: darken a colour, or make a translucent copy of it
const rgbOf = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (hex, k) => `rgb(${rgbOf(hex).map((v) => Math.round(v * k)).join(',')})`;
const alpha = (hex, a) => `rgba(${rgbOf(hex).join(',')},${a})`;

// Rare and better gear lights the hero with a faint aura in its colour
const AURA_RANK = { rare: 2, epic: 3, legendary: 4 };
function auraColor(gear) {
  let best = null;
  for (const piece of Object.values(gear)) {
    if (piece && (AURA_RANK[piece.rarityId] ?? 0) > (AURA_RANK[best?.rarityId] ?? 0)) best = piece;
  }
  return best?.color ?? null;
}

/**
 * Where an archer is in its shooting cycle, from the time since its last release: the string
 * snaps back, the hand fetches an arrow from the quiver (skipped at very fast rates), nocks
 * it and draws to the jaw, then holds. Faster attack rates compress the whole cycle; `calm`
 * (0..1, nothing to shoot at) eases the string.
 */
export function bowCycle(since, period, calm = 0) {
  const cycle = Math.min(0.9, Math.max(0.16, (period ?? 1) * 0.7));
  const u = since / cycle;
  const release = Math.max(0, 1 - u / 0.25);
  const quick = cycle < 0.35;
  const reach = quick || u < 0.1 || u > 0.5 ? 0 : Math.sin(((u - 0.1) / 0.4) * Math.PI);
  const drawFrom = quick ? 0.25 : 0.5;
  const k = Math.min(1, Math.max(0, (u - drawFrom) / (1 - drawFrom)));
  const pull = (1 - (1 - k) ** 3) * (1 - calm * 0.65); // fast off the rest, slowing into the anchor
  return { pull, release, reach, nocked: u > (quick ? 0.15 : 0.3) };
}

/**
 * A stick archer aiming at canvas angle `theta` with the string drawn back by `pull` (0..1).
 * opt: { s, accent, cape, hood, t, equipment }
 */
export function drawArcher(ctx, x, y, theta, pull, opt = {}) {
  const s = opt.s ?? 1;
  const t = opt.t ?? 0;
  const legs = [[0.38, 0.25], [-0.3, -0.2]];

  const gear = opt.equipment ?? {};

  // Rare-or-better gear glows behind the hero
  const aura = opt.hero ? auraColor(gear) : null;
  if (aura) {
    const g = ctx.createRadialGradient(x, y - 30 * s, 4 * s, x, y - 30 * s, 40 * s);
    g.addColorStop(0, alpha(aura, 0.3));
    g.addColorStop(1, alpha(aura, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - 30 * s, 40 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cape flows behind before the body is drawn
  if (opt.cape) {
    const sway = Math.sin(t * 2.4) * 4 - (opt.release ?? 0) * 3;
    ctx.fillStyle = opt.accent;
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y - 46 * s);
    ctx.quadraticCurveTo(x - 16 * s + sway, y - 30 * s, x - 20 * s + sway * 1.5, y - 8 * s);
    ctx.quadraticCurveTo(x - 13 * s + sway, y - 13 * s, x - 6 * s + sway, y - 12 * s);
    ctx.lineTo(x - 2 * s, y - 40 * s);
    ctx.closePath();
    ctx.fill();
    // Darker fold along the inner edge gives the cloth some volume
    ctx.fillStyle = mix(opt.accent, 0.62);
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y - 40 * s);
    ctx.quadraticCurveTo(x - 9 * s + sway, y - 26 * s, x - 6 * s + sway, y - 12 * s);
    ctx.quadraticCurveTo(x - 6 * s + sway * 0.5, y - 26 * s, x - 2 * s, y - 40 * s);
    ctx.closePath();
    ctx.fill();
  }

  // Pose: the bow hand pushes out toward the aim a little above the shoulder line so the
  // arrow lies at chin height; the string hand travels nock → anchor → follow-through → quiver
  const release = opt.release ?? 0;
  const reach = opt.reach ?? 0;
  const nocked = opt.nocked ?? pull > 0.15;
  const quiver = opt.quiver ?? opt.hero;
  const fig = { x, y, s, f: 1, legs, lean: (opt.lean ?? -0.05) - pull * 0.035 };
  const sk = skeleton(fig);
  const dir = [Math.cos(theta), Math.sin(theta)];
  const up = [Math.sin(theta), -Math.cos(theta)]; // perpendicular to the aim, on the head's side
  const grip = [sk.sh[0] + dir[0] * 16.5 * s + up[0] * 4.5 * s, sk.sh[1] + dir[1] * 16.5 * s + up[1] * 4.5 * s];
  // The bow tips forward as the string snaps back on release
  const phi = theta + release * 0.35;
  const bdir = [Math.cos(phi), Math.sin(phi)];
  const bup = [Math.sin(phi), -Math.cos(phi)];
  const REST = 4 * s; // brace height: the slack string sits this far behind the grip
  const FULL = 18 * s; // full draw brings the nock to the jaw
  const depth = (FULL - REST) * pull;
  const nock = [grip[0] - bdir[0] * REST - dir[0] * depth, grip[1] - bdir[1] * REST - dir[1] * depth];
  // Released string hand flies back past the jaw, then fetches the next arrow over the shoulder
  const follow = [grip[0] - dir[0] * (FULL + 5 * s) + up[0] * 2 * s, grip[1] - dir[1] * (FULL + 5 * s) + up[1] * 2 * s];
  const quiverTop = [sk.sh[0] - 11.5 * s, sk.sh[1] - 13 * s];
  const lerp2 = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  const hand = lerp2(lerp2(nock, follow, release), quiverTop, quiver ? reach : 0);
  // Drawing elbow juts back along the arrow; reaching for the quiver it swings up and forward
  const bend = lerp2([-dir[0] + up[0] * 0.4, -dir[1] + up[1] * 0.4], [dir[0] + up[0], dir[1] + up[1]], reach);
  const armF = reachArm(sk.sh, hand, s, bend[0], bend[1]);
  const armB = reachArm(sk.sh, grip, s, -up[0], -up[1]);

  const j = drawFigure(ctx, { ...fig, armF, armB });

  // Quiver slung across the back: the mouth sits behind the shoulder so the
  // shafts poke out past the hood, the strap crosses the chest
  if (quiver) {
    const tx = j.sh[0] - 7 * s;
    const ty = j.sh[1] - 2 * s;
    const dx = 0.38; // runs down and forward toward the hip
    const dy = 0.92;
    ctx.save();
    ctx.strokeStyle = '#3a2a22';
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(j.sh[0] + 2.5 * s, j.sh[1] + 1 * s);
    ctx.lineTo(j.hip[0] + 2 * s, j.hip[1] - 3 * s);
    ctx.stroke();
    ctx.restore();
    const px = -dy; // perpendicular to the quiver's length
    const py = dx;
    const L = 17 * s;
    const W = 2.4 * s;
    ctx.save();
    ctx.lineWidth = 1 * s;
    ctx.strokeStyle = 'rgba(30,26,34,0.9)';
    for (const k of [-1, 0, 1]) {
      const bx = tx + px * k * 1.3 * s;
      const by = ty + py * k * 1.3 * s;
      ctx.strokeStyle = '#d8cfb6';
      ctx.lineWidth = 0.9 * s;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - dx * 12 * s, by - dy * 12 * s);
      ctx.stroke();
      ctx.fillStyle = opt.accent ?? '#c8312b';
      ctx.beginPath();
      ctx.arc(bx - dx * 12 * s, by - dy * 12 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5b3b24';
    ctx.strokeStyle = 'rgba(20,18,25,0.95)';
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.moveTo(tx + px * W, ty + py * W);
    ctx.lineTo(tx + dx * L + px * W, ty + dy * L + py * W);
    ctx.lineTo(tx + dx * L - px * W, ty + dy * L - py * W);
    ctx.lineTo(tx - px * W, ty - py * W);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Chest piece is painted over the torso line so armor remains visible at game scale.
  if (gear.armor) {
    const armor = gear.armor;
    const top = j.sh[1] + 2 * s;
    const bottom = j.hip[1] - 2 * s;
    ctx.save();
    ctx.fillStyle = armor.color;
    ctx.strokeStyle = 'rgba(20,18,25,0.95)';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(j.sh[0] - 7 * s, top);
    ctx.lineTo(j.sh[0] + 7 * s, top);
    ctx.lineTo(j.hip[0] + 5.5 * s, bottom);
    ctx.lineTo(j.hip[0] - 5.5 * s, bottom);
    ctx.closePath();
    ctx.fill();
    // Back half in shadow so the plate reads as rounded, not a flat badge
    ctx.fillStyle = mix(armor.color, 0.72);
    ctx.beginPath();
    ctx.moveTo(j.sh[0] - 7 * s, top);
    ctx.lineTo(j.sh[0], top);
    ctx.lineTo(j.hip[0], bottom);
    ctx.lineTo(j.hip[0] - 5.5 * s, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(j.sh[0] - 7 * s, top);
    ctx.lineTo(j.sh[0] + 7 * s, top);
    ctx.lineTo(j.hip[0] + 5.5 * s, bottom);
    ctx.lineTo(j.hip[0] - 5.5 * s, bottom);
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,229,166,0.82)';
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.moveTo(j.sh[0], top + 1.5 * s);
    ctx.lineTo(j.hip[0], bottom - 1.5 * s);
    ctx.stroke();
    if (armor.templateId === 'chainmail') {
      ctx.fillStyle = 'rgba(235,239,247,0.75)';
      for (let row = 0; row < 3; row++) {
        for (let col = -1; col <= 1; col++) {
          ctx.beginPath();
          ctx.arc(j.hip[0] + col * 3 * s, top + (5 + row * 4) * s, 0.65 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Armor gets shoulder plates so it reads even at game scale
  if (gear.armor) {
    ctx.save();
    ctx.fillStyle = gear.armor.color;
    ctx.strokeStyle = 'rgba(20,18,25,0.95)';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.ellipse(j.sh[0], j.sh[1] + 1 * s, 4.6 * s, 3.4 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (gear.belt) {
    const belt = gear.belt;
    const beltY = j.hip[1] - 5 * s;
    ctx.save();
    ctx.fillStyle = '#38241c';
    ctx.strokeStyle = 'rgba(20,18,25,0.95)';
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.moveTo(j.hip[0] - 7 * s, beltY - 2 * s);
    ctx.lineTo(j.hip[0] + 7 * s, beltY - 2 * s);
    ctx.lineTo(j.hip[0] + 6 * s, beltY + 2 * s);
    ctx.lineTo(j.hip[0] - 6 * s, beltY + 2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = belt.color;
    ctx.fillRect(j.hip[0] - 2 * s, beltY - 2 * s, 4 * s, 4 * s);
    ctx.strokeStyle = 'rgba(255,239,196,0.95)';
    ctx.strokeRect(j.hip[0] - 2 * s, beltY - 2 * s, 4 * s, 4 * s);
    ctx.restore();
  }

  // Recurve bow: each limb sweeps out from the grip, bends back toward the archer as the
  // string is drawn, and flicks forward at the tip where the string is tied
  const P = (o, a, ka, b, kb) => [o[0] + a[0] * ka + b[0] * kb, o[1] + a[1] * ka + b[1] * kb];
  const span = (17 - 2.5 * pull) * s;
  const back = (REST / s + 4 * pull) * s;
  const limbs = [1, -1].map((k) => ({
    c1: P(grip, bup, k * span * 0.45, bdir, 1.6 * s),
    c2: P(grip, bup, k * span * 0.92, bdir, 1.2 * s - back * 0.35),
    tip: P(grip, bup, k * span, bdir, -back),
    flick: P(grip, bup, k * (span + 1.4 * s), bdir, -back + 2.2 * s),
  }));
  const limbPath = () => {
    ctx.beginPath();
    for (const l of limbs) {
      ctx.moveTo(grip[0], grip[1]);
      ctx.bezierCurveTo(l.c1[0], l.c1[1], l.c2[0], l.c2[1], l.tip[0], l.tip[1]);
      ctx.lineTo(l.flick[0], l.flick[1]);
    }
  };
  const wood = gear.weapon?.color ?? '#9a6b3a';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4.4 * s;
  limbPath();
  ctx.stroke();
  ctx.strokeStyle = wood;
  ctx.lineWidth = 2.4 * s;
  limbPath();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,238,200,0.4)';
  ctx.lineWidth = 0.7 * s;
  limbPath();
  ctx.stroke();
  // Leather-wrapped grip
  ctx.strokeStyle = '#3a2a22';
  ctx.lineWidth = 3.6 * s;
  ctx.beginPath();
  ctx.moveTo(grip[0] + bup[0] * 3 * s, grip[1] + bup[1] * 3 * s);
  ctx.lineTo(grip[0] - bup[0] * 3 * s, grip[1] - bup[1] * 3 * s);
  ctx.stroke();
  if (gear.weapon) {
    ctx.fillStyle = gear.weapon.color;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8 * s;
    for (const l of limbs) {
      ctx.beginPath();
      ctx.arc(l.tip[0], l.tip[1], 1.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // String: held at the nock while drawing, quivering on its own just after release
  const hum = release > 0 ? Math.sin(t * 95) * release * 2.4 * s : 0;
  const held = release < 0.02 && reach < 0.02;
  const strPt = held ? hand : [nock[0] - bdir[0] * hum, nock[1] - bdir[1] * hum];
  ctx.lineWidth = Math.max(1, 0.9 * s);
  ctx.strokeStyle = 'rgba(236,228,206,0.95)';
  ctx.beginPath();
  ctx.moveTo(limbs[0].tip[0], limbs[0].tip[1]);
  ctx.lineTo(strPt[0], strPt[1]);
  ctx.lineTo(limbs[1].tip[0], limbs[1].tip[1]);
  ctx.stroke();

  // Arrow rides in the string hand: nocked while drawing, carried back from the quiver
  if (nocked) {
    // Fresh out of the quiver the arrow still hangs point-down along it, half hidden inside
    const qx = dir[0] + (0.38 - dir[0]) * reach;
    const qy = dir[1] + (0.92 - dir[1]) * reach;
    const ql = Math.hypot(qx, qy) || 1;
    const adir = [qx / ql, qy / ql];
    const aup = [adir[1], -adir[0]];
    const L = 25 * s * (1 - reach * 0.55);
    const A = (o, ka, kb) => [o[0] + adir[0] * ka + aup[0] * kb, o[1] + adir[1] * ka + aup[1] * kb];
    const head = A(hand, L, 0);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(hand[0], hand[1]);
    ctx.lineTo(head[0], head[1]);
    ctx.stroke();
    ctx.strokeStyle = '#d8c39a';
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();
    ctx.fillStyle = opt.accent ?? '#c8312b';
    for (const k of [1, -1]) {
      ctx.beginPath();
      ctx.moveTo(...A(hand, 1 * s, 0));
      ctx.lineTo(...A(hand, 0, k * 2.2 * s));
      ctx.lineTo(...A(hand, 5.5 * s, k * 0.6 * s));
      ctx.lineTo(...A(hand, 5.5 * s, 0));
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#c9ced8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(...A(head, 4 * s, 0));
    ctx.lineTo(...A(head, -1 * s, 2 * s));
    ctx.lineTo(...A(head, 0, 0));
    ctx.lineTo(...A(head, -1 * s, -2 * s));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // The hero's arrowhead glints while held at full draw
    if (opt.hero && pull > 0.96) {
      const gx = head[0] + dir[0] * 2 * s;
      const gy = head[1] + dir[1] * 2 * s;
      const r = (5 + Math.sin(t * 9) * 1.5) * s;
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(255,240,190,0.85)');
      g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Arms over bow and string: the draw arm on top, the bow hand's fist closed round the grip
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2 * s;
  ctx.beginPath();
  ctx.moveTo(j.sh[0], j.sh[1]);
  ctx.lineTo(j.elbowF[0], j.elbowF[1]);
  ctx.lineTo(j.handF[0], j.handF[1]);
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const [hx, hy] of [j.handF, j.handB]) {
    ctx.beginPath();
    ctx.arc(hx, hy, 1.9 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hood
  if (opt.hood) {
    ctx.fillStyle = opt.hood;
    ctx.beginPath();
    ctx.arc(j.head[0], j.head[1], j.headR + 1.2 * s, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(j.head[0] - j.headR * 1.9, j.head[1] + j.headR * 0.3);
    ctx.closePath();
    ctx.fill();
    // Dark opening where the face sits under the hood
    ctx.fillStyle = 'rgba(20,16,24,0.88)';
    ctx.beginPath();
    ctx.ellipse(j.head[0] + j.headR * 0.35, j.head[1] + j.headR * 0.2, j.headR * 0.42, j.headR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // A glint of the eye inside the hood
    ctx.fillStyle = '#f3e2b3';
    ctx.beginPath();
    ctx.arc(j.head[0] + j.headR * 0.5, j.head[1] + j.headR * 0.08, Math.max(0.7, j.headR * 0.14), 0, Math.PI * 2);
    ctx.fill();
  }

  if (gear.helmet) {
    const helmet = gear.helmet;
    const r = j.headR;
    const hx = j.head[0];
    const hy = j.head[1];
    ctx.save();
    ctx.fillStyle = helmet.color;
    ctx.strokeStyle = 'rgba(20,18,25,0.98)';
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    ctx.moveTo(hx - r * 1.22, hy - r * 0.12);
    ctx.quadraticCurveTo(hx - r * 0.9, hy - r * 1.68, hx, hy - r * 1.65);
    ctx.quadraticCurveTo(hx + r * 0.92, hy - r * 1.6, hx + r * 1.22, hy - r * 0.12);
    ctx.lineTo(hx + r * 1.05, hy + r * 0.22);
    ctx.lineTo(hx - r * 1.05, hy + r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,184,0.9)';
    ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.92, hy + r * 0.1);
    ctx.lineTo(hx + r * 0.92, hy + r * 0.1);
    ctx.stroke();
    if (helmet.templateId === 'kingshelm' || helmet.templateId === 'hawkhelm') {
      ctx.fillStyle = helmet.color;
      ctx.beginPath();
      ctx.moveTo(hx, hy - r * 1.55);
      ctx.lineTo(hx - r * 0.25, hy - r * 2.35);
      ctx.lineTo(hx + r * 0.38, hy - r * 1.62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (gear.earrings) {
    const earring = gear.earrings;
    const ex = j.head[0] + j.headR * 0.78;
    const ey = j.head[1] + j.headR * 0.42;
    ctx.save();
    ctx.strokeStyle = earring.color;
    ctx.lineWidth = 1.4 * s;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.4 * s, 0, Math.PI * 2);
    ctx.moveTo(ex, ey + 1.4 * s);
    ctx.lineTo(ex, ey + 4.2 * s);
    ctx.stroke();
    ctx.fillStyle = earring.color;
    ctx.beginPath();
    ctx.moveTo(ex, ey + 3 * s);
    ctx.lineTo(ex + 1.5 * s, ey + 4.7 * s);
    ctx.lineTo(ex, ey + 6.4 * s);
    ctx.lineTo(ex - 1.5 * s, ey + 4.7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (gear.charm) {
    const charm = gear.charm;
    const cx = (j.sh[0] + j.hip[0]) * 0.5;
    const cy = j.neck[1] + (j.hip[1] - j.neck[1]) * 0.38;
    ctx.save();
    ctx.strokeStyle = 'rgba(238,220,173,0.85)';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(j.neck[0] - 2 * s, j.neck[1] + 2 * s);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.fillStyle = charm.color;
    ctx.strokeStyle = 'rgba(25,20,28,0.9)';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 2.7 * s);
    ctx.lineTo(cx + 2.4 * s, cy);
    ctx.lineTo(cx, cy + 2.7 * s);
    ctx.lineTo(cx - 2.4 * s, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (gear.necklace) {
    const necklace = gear.necklace;
    const centerX = j.neck[0];
    const topY = j.neck[1] + 2 * s;
    const gemY = topY + 7 * s;
    ctx.save();
    ctx.strokeStyle = necklace.color;
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    ctx.moveTo(centerX - 4.2 * s, topY);
    ctx.lineTo(centerX, gemY);
    ctx.lineTo(centerX + 4.2 * s, topY);
    ctx.stroke();
    ctx.fillStyle = necklace.color;
    ctx.strokeStyle = 'rgba(25,20,28,0.9)';
    ctx.lineWidth = 0.7 * s;
    ctx.beginPath();
    ctx.moveTo(centerX, gemY - 2 * s);
    ctx.lineTo(centerX + 2 * s, gemY);
    ctx.lineTo(centerX, gemY + 2.5 * s);
    ctx.lineTo(centerX - 2 * s, gemY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (gear.gloves) {
    ctx.save();
    ctx.fillStyle = gear.gloves.color;
    ctx.strokeStyle = 'rgba(20,18,25,0.95)';
    ctx.lineWidth = 0.9 * s;
    for (const [gx, gy] of [j.handF, j.handB]) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  if (gear.boots) {
    ctx.save();
    ctx.fillStyle = gear.boots.color;
    ctx.strokeStyle = 'rgba(20,18,25,0.95)';
    ctx.lineWidth = 0.8 * s;
    for (const leg of legs) {
      const footX = j.hip[0] + Math.sin(leg[0]) * 12 * s + Math.sin(leg[1]) * 12 * s;
      const footY = j.hip[1] + Math.cos(leg[0]) * 12 * s + Math.cos(leg[1]) * 12 * s;
      ctx.beginPath();
      ctx.ellipse(footX + 1.2 * s, footY - 0.8 * s, 3.4 * s, 2.3 * s, -0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,235,184,0.72)';
      ctx.fillRect(footX - 1.2 * s, footY - 2.1 * s, 2.8 * s, 0.8 * s);
      ctx.fillStyle = gear.boots.color;
    }
    ctx.restore();
  }
  return j;
}
