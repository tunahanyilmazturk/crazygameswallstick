import { GROUND_Y, INK, FLASH } from '../core/constants.js';
import { UNIT_BY_KIND } from './roster.js';
import { drawPosed, skeleton, walkLegs } from '../render/stick.js';
import { clamp01, dot, easeIn, easeInOut, mix, mix2, off, span } from '../render/anim.js';
import { garment, helm, pauldron, plume } from './kit.js';
import { heater, smear, sword } from './weapons.js';
import { nearestGround } from './behaviors.js';

// Sword hand (offset from the shoulder) and blade angle for each moment of the fight
const POSES = {
  rest: { g: [4, 15], a: 1.25 },
  march: { g: [1, 12], a: 0.5 },
  ready: { g: [-6, -4], a: -2.1 },   // cocked over the shoulder behind the shield
  raise: { g: [-8, -12], a: -2.6 },
  thrust: { g: [17, -1], a: 0.05 },  // straight over the shield rim
};
const blendPose = (p, q, k) => ({ g: mix2(p.g, q.g, k), a: mix(p.a, q.a, k) });

const RESPAWN = 6;
const ARMOR = 0.25;
const ADVANCE = 230;  // how far ahead of their post soldiers march to meet an enemy
const MARCH = 80;
const RETREAT = 55;

/**
 * Shield infantry in front of the walls. They march out to meet ground enemies near their
 * post and hold them there; enemies must cut through them first. Fallen soldiers return
 * to their post after RESPAWN seconds.
 */
export class Soldier {
  constructor(index) {
    this.home = UNIT_BY_KIND.soldier.post.xs[index];
    this.x = this.home;
    this.walking = false;
    this.step = 0;
    this.y = GROUND_Y;
    this.maxHp = 1;
    this.hp = 1;
    this.alive = true;
    this.respawn = 0;
    this.cd = 0.5;
    this.anim = 0;
    this.flash = 0;
    this.halfW = 8;
    this.t = Math.random() * 5;
    this.since = 9;       // time since the last cut (drives the sword animation)
    this.engaged = false; // an enemy is in reach
    this.alert = 0;
  }

  get hitY() {
    return GROUND_Y - 35;
  }

  sync(st) {
    const ratio = this.hp / this.maxHp;
    this.maxHp = st.hp;
    this.hp = Math.min(st.hp, ratio * st.hp);
  }

  update(dt, game, st) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.anim = Math.max(0, this.anim - dt);
    if (!this.alive) {
      this.respawn -= dt;
      if (this.respawn <= 0) {
        this.alive = true;
        this.x = this.home;
        this.hp = this.maxHp;
        game.effects.burst(this.x, this.y - 30, 12, { color: '#9dd4ff', speedMin: 30, speedMax: 90, gravity: -60, glow: true });
      }
      return;
    }

    let target = null;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const gap = e.x - this.x;
      if (gap > -10 && gap < 26 + e.w * 0.6 && (!target || e.x < target.x)) target = e;
    }
    this.cd -= dt * game.skills.rateMult; // Savaş Narası speeds up attacks
    this.since += dt * game.skills.rateMult;
    this.engaged = Boolean(target);
    this.alert += ((target || game.enemies.length ? 1 : 0) - this.alert) * Math.min(1, dt * 3);
    // Nobody in reach: march toward the nearest ground enemy ahead, or back to the post
    this.walking = false;
    if (!target) {
      const foe = nearestGround(game.enemies, this.home, this.x, ADVANCE);
      const goal = foe ? Math.max(this.home, foe.x - foe.w * 0.5 - 16) : this.home;
      const gap = goal - this.x;
      if (Math.abs(gap) > 1) {
        this.walking = true;
        this.x += Math.sign(gap) * Math.min(Math.abs(gap), (foe ? MARCH : RETREAT) * dt);
        this.step += dt * 9;
      }
    }
    if (target && this.cd <= 0) {
      this.cd = 1 / st.rate;
      this.anim = 0.3;
      this.since = 0;
      game.damageEnemy(target, st.damage, { x: this.x + 20, y: target.centerY, kb: 45 });
      game.audio.play('sword');
    }
  }

  takeDamage(amount, game) {
    if (!this.alive) return 0;
    const dealt = amount * (1 - ARMOR);
    this.hp -= dealt;
    this.flash = 0.1;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.respawn = RESPAWN;
      game.effects.ink(this.x, this.y - 30, 14);
      game.audio.play('die');
    }
    return dealt;
  }

  heal(amount) {
    if (this.alive) this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  draw(ctx) {
    if (!this.alive) {
      // Fallen shield marks the spot until respawn
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(this.x, GROUND_Y - 3, 11, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '700 12px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(this.respawn) + '', this.x, GROUND_Y - 14);
      return;
    }
    const s = 1;
    const color = this.flash > 0 ? FLASH : INK;
    const pre = this.engaged ? clamp01(1 - this.cd / 0.3) : 0;
    const block = this.flash / 0.1; // the shield jolts back when struck
    const P = POSES;
    const base = this.walking ? P.march : blendPose(P.rest, P.ready, this.alert);
    let pose = blendPose(base, P.raise, pre);
    let thrust = 0;
    if (this.since < 0.45) {
      thrust = 1 - span(this.since, 0.1, 0.4);
      pose = this.since < 0.07 ? blendPose(P.raise, P.thrust, easeIn(span(this.since, 0, 0.07))) : blendPose(P.thrust, base, easeInOut(span(this.since, 0.15, 0.45)));
    }
    const fig = {
      x: this.x, y: this.y, s, color,
      legs: this.walking ? walkLegs(this.step, 0.5) : this.alert > 0.5 ? [[0.45, 0.3], [-0.35, -0.2]] : [[0.25, 0.15], [-0.2, -0.1]],
      lean: 0.08 + (this.walking ? 0.06 : 0) - pre * 0.06 + thrust * 0.14 - block * 0.08 + Math.sin(this.t * 2) * 0.01,
    };
    const sk = skeleton(fig);
    const grip = off(sk.sh, pose.g[0] + (this.walking ? Math.sin(this.step) * 1.5 : 0), pose.g[1], s);
    const shieldHand = off(sk.sh, mix(mix(7, 9, this.alert), 8, this.walking ? 1 : 0) - block * 3 - thrust, mix(11, 5, this.alert) + thrust * 2, s);
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: shieldHand, bend: [0, 1] },
      reachB: { to: grip, bend: [-0.3, 1] },
      body: (b) => {
        garment(ctx, b, { color: '#2f5fae', length: 10, hem: 8, trim: '#e9e4d6', belt: '#3a2a22', buckle: '#e2b33c', sway: this.walking ? Math.sin(this.step) * 1.2 : 0 });
        pauldron(ctx, b, '#9aa3ad');
      },
    });
    // The sword passes behind the shield when low, over it when raised or thrusting
    const high = pose.g[1] < 2;
    if (!high) sword(ctx, grip, pose.a, s, { len: 21, w: 1.4, guard: 3.5, handle: 4 });
    heater(ctx, off(j.handF, 2.5, -1, s), s, { w: 6, h: 9.5, color: this.flash ? FLASH : '#2f5fae', emblem: '#e9e4d6' });
    dot(ctx, off(j.handF, 2.5, -2.5, s), 1.5 * s, '#e2b33c');
    if (this.since < 0.12) smear(ctx, sk.sh, P.raise.a + 0.3, pose.a, 10 * s, 25 * s, 0.35 * (1 - this.since / 0.12));
    if (high) sword(ctx, grip, pose.a, s, { len: 21, w: 1.4, guard: 3.5, handle: 4 });
    dot(ctx, j.handB, 1.8 * s, color);
    const crest = helm(ctx, j, 'nasal', '#9aa3ad', '#e2b33c');
    plume(ctx, crest, '#c8312b', s, this.walking ? 0.4 : 0);

    if (this.hp < this.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(this.x - 13, this.y - 78, 26, 4);
      ctx.fillStyle = '#5fd36b';
      ctx.fillRect(this.x - 13, this.y - 78, (26 * this.hp) / this.maxHp, 4);
    }
  }
}
