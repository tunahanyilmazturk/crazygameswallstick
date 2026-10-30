import { GROUND_Y, WORLD_W, INK } from '../core/constants.js';
import { drawPosed, skeleton } from '../render/stick.js';
import { add, dirOf, dot, facing, line, off, poly } from '../render/anim.js';
import { cape, cuirass, helm, pauldron, plume } from './kit.js';
import { heater } from './weapons.js';
import { UNIT_BY_KIND } from './roster.js';

const GATE_X = UNIT_BY_KIND.knight.post.x;
const CHARGE_SPEED = 520;
const RETURN_SPEED = 640;
const END_X = WORLD_W - 30;

/**
 * Süvari: waits behind the gate, then charges through the whole enemy line, hitting
 * every enemy it passes once, and rides back. Hidden while waiting inside the castle.
 */
export class Knight {
  constructor() {
    this.x = GATE_X;
    this.state = 'idle';
    this.cd = 2;
    this.hit = new Set();
    this.phase = 0;
  }

  update(dt, game) {
    const st = game.stats.allies.knight;
    if (!st) return;
    switch (this.state) {
      case 'idle':
        this.cd -= dt * game.skills.rateMult; // Savaş Narası speeds up attacks
        if (this.cd <= 0 && game.enemies.some((e) => e.alive && e.x < WORLD_W - 60)) {
          this.state = 'charge';
          this.hit.clear();
          this.x = GATE_X;
          game.audio.play('charge');
          game.effects.dust(GATE_X + 20, GROUND_Y, 2);
        }
        break;
      case 'charge':
        this.x += CHARGE_SPEED * dt;
        this.phase += dt * 16;
        for (const e of game.enemies) {
          if (!e.alive || this.hit.has(e) || Math.abs(e.x - this.x) > e.w * 0.6 + 22) continue;
          this.hit.add(e);
          game.damageEnemy(e, st.damage, { x: e.x, y: e.centerY, kb: 200 });
          game.shake(1.5);
        }
        if (Math.random() < dt * 20) game.effects.dust(this.x - 20, GROUND_Y, 1);
        if (this.x >= END_X) this.state = 'return';
        break;
      case 'return':
        this.x -= RETURN_SPEED * dt;
        this.phase += dt * 18;
        if (this.x <= GATE_X) {
          this.state = 'idle';
          this.cd = st.cooldown;
        }
        break;
    }
  }

  draw(ctx) {
    if (this.state === 'idle') return;
    const f = this.state === 'charge' ? 1 : -1;
    facing(ctx, this.x, f, () => this.drawRight(ctx, this.state === 'charge'));
  }

  /** Horse and rider galloping to the right. */
  drawRight(ctx, charging) {
    const x = this.x;
    const ph = this.phase;
    const bob = Math.abs(Math.sin(ph)) * 3;
    const by = GROUND_Y - 34 - bob;
    ctx.save();
    // The body rocks over the stride
    ctx.translate(x, by);
    ctx.rotate(Math.sin(ph) * 0.05);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Far legs first, then tail, body, cloth, neck and head, near legs over the cloth
    for (const [rx, o, front] of [[13, 0.6, true], [-17, 2.2, false]]) horseLeg(ctx, rx, o, front, ph, HORSE_FAR);
    const swish = Math.sin(ph * 0.9);
    ctx.strokeStyle = HORSE;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-23, -4);
    ctx.quadraticCurveTo(-33, -9 + swish * 3, -40, 2 + swish * 3);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, -2);
    ctx.quadraticCurveTo(-34, -3 + swish * 4, -38, 8 + swish * 2);
    ctx.stroke();
    ctx.fillStyle = HORSE;
    ctx.beginPath();
    ctx.moveTo(-24, -3);
    ctx.quadraticCurveTo(-24, -11, -12, -10);
    ctx.lineTo(10, -9);
    ctx.quadraticCurveTo(21, -10, 25, -3);
    ctx.quadraticCurveTo(27, 6, 14, 9);
    ctx.quadraticCurveTo(0, 12, -14, 9);
    ctx.quadraticCurveTo(-26, 6, -24, -3);
    ctx.fill();
    // Neck and head reaching forward, ears pricked, nostril flared
    poly(ctx, [[12, -8], [24, -27], [31, -25], [25, -2]], HORSE);
    ctx.save();
    ctx.translate(30, -24);
    ctx.rotate(0.62 + Math.sin(ph) * 0.06);
    ctx.beginPath();
    ctx.ellipse(5, 0, 10, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    poly(ctx, [[-2, -3.5], [-4, -9], [1.5, -4]], HORSE);
    dot(ctx, [2, -1.5], 1, '#f3e2b3');
    dot(ctx, [13.5, 0.5], 0.9, '#0b090c');
    // Bridle
    line(ctx, [-1, -3.5], [8, 3.5], '#7a2e24', 1.2);
    ctx.restore();
    // Mane streaming back along the crest
    ctx.strokeStyle = HORSE;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      const mx = 25 - k * 11;
      const my = -27 + k * 17;
      ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(mx - 5, my - 2 + Math.sin(ph * 1.5 + i) * 2, mx - 9, my + 1 + Math.sin(ph * 1.5 + i + 1) * 2);
    }
    ctx.stroke();
    // Caparison: blue cloth with a gold scalloped hem that flutters back
    const flut = Math.sin(ph * 1.2) * 1.5;
    ctx.fillStyle = '#2459b8';
    ctx.beginPath();
    ctx.moveTo(-21, -9);
    ctx.lineTo(18, -10);
    ctx.quadraticCurveTo(24, -4, 22, 6);
    for (let i = 0; i <= 6; i++) {
      const hx = 22 - (i / 6) * 46 + flut * (i / 6);
      const hy = 10 + (i % 2 ? 3 : 0) + (i / 6) * 1;
      ctx.lineTo(hx, hy);
    }
    ctx.quadraticCurveTo(-27, 0, -21, -9);
    ctx.fill();
    ctx.strokeStyle = '#e2b33c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const hx = 22 - (i / 6) * 46 + flut * (i / 6);
      ctx[i ? 'lineTo' : 'moveTo'](hx, 9 + (i % 2 ? 3 : 0) + (i / 6) * 1);
    }
    ctx.stroke();
    poly(ctx, [[0, -6], [3, 0], [0, 6], [-3, 0]], '#e2b33c');
    for (const [rx, o, front] of [[9, 0, true], [-13, 1.6, false]]) horseLeg(ctx, rx, o, front, ph, HORSE);
    ctx.restore();

    // Rider seated in the saddle, couching the lance on the charge and raising it to ride home
    const s = 0.85;
    const legs = [[1.0, 0.15], [0.8, 0.05]];
    const seat = [x - 3, by - 9];
    const sk0 = skeleton({ x: 0, y: 0, s, legs });
    const fig = { x: seat[0], y: seat[1] - sk0.hip[1], s, legs, lean: charging ? 0.22 : 0.06 };
    const sk = skeleton(fig);
    const la = charging ? 0.04 + Math.sin(ph) * 0.02 : -1.25;
    const grip = charging ? off(sk.sh, 8, 9, s) : off(sk.sh, 10, 4, s);
    const reins = [x + 18, by - 8];
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: grip, bend: [-0.3, 1] },
      reachB: { to: reins, bend: [0, 1] },
      body: (b) => {
        cape(ctx, b, '#8e2a2a', Math.sin(ph) * 1.5, 1);
        heater(ctx, off(b.sh, -4, 9, s), s, { w: 5, h: 8, color: '#2459b8', emblem: '#e2b33c' });
        cuirass(ctx, b, '#b8c0c9');
        pauldron(ctx, b, '#b8c0c9');
      },
    });
    line(ctx, j.handB, reins, '#7a2e24', 1);
    // Lance with vamplate and a pennant snapping in the wind
    const d = dirOf(la);
    const n = [d[1], -d[0]];
    const tail = add(grip, d, -16);
    const tip = add(grip, d, 46);
    line(ctx, tail, tip, INK, 3.2);
    line(ctx, tail, tip, '#c9ced6', 1.8);
    poly(ctx, [add(add(grip, d, 2), n, 3.5), add(grip, d, 8), add(add(grip, d, 2), n, -3.5)], '#9aa3ad', INK, 0.8);
    const pb = add(tip, d, -6);
    const wave = Math.sin(ph * 2.2) * 2;
    poly(ctx, [pb, add(add(pb, d, -11), n, 2 + wave), add(add(pb, d, -14), n, 0.5 + wave * 1.3), add(add(pb, d, -11), n, -1 + wave), add(pb, n, -4)], '#2459b8', '#e2b33c', 0.8);
    dot(ctx, j.handF, 1.7, INK);
    plume(ctx, helm(ctx, j, 'great', '#b8c0c9', '#e2b33c'), '#c8312b', s, 1);
  }
}

const HORSE = '#1d1a20';
const HORSE_FAR = '#0f0d12';

/**
 * One galloping leg hanging from the body at rx: the upper leg swings with the stride and
 * the lower leg folds while it is carried forward (front knee back, hind hock forward).
 */
function horseLeg(ctx, rx, o, front, ph, color) {
  const p = ph + o;
  const a1 = Math.sin(p) * (front ? 0.6 : 0.5);
  const fold = Math.max(0, Math.sin(p + 1.2));
  const a2 = front ? a1 - fold * 1.3 : a1 + fold * 1.0;
  const root = [rx, 6];
  const knee = [root[0] + Math.sin(a1) * 12, root[1] + Math.cos(a1) * 12];
  const hoof = [knee[0] + Math.sin(a2) * 14, knee[1] + Math.cos(a2) * 14];
  line(ctx, root, knee, color, 4.2);
  line(ctx, knee, hoof, color, 3);
  dot(ctx, hoof, 2, color);
}
