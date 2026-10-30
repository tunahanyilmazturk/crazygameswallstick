import { SLOTS, GRAVITY } from '../core/constants.js';
import { ballistic, rand } from '../utils/math.js';
import { frontmost, leadShot } from '../systems/Targeting.js';
import { bowCycle, drawArcher } from '../render/archer.js';
import { Projectile } from './Projectile.js';

const HERO_BLUE = '#2f6fd6';
const MANUAL_PERIOD = 0.8; // clicked shots come at 1.25× the hero's attack rate

export class Hero {
  constructor() {
    this.x = SLOTS.hero.x;
    this.y = SLOTS.hero.y;
    this.cd = 0.5;
    this.manualCd = 0;
    this.theta = -0.15;
    this.t = 0;
    this.sinceShot = 9; // starts at full draw, ready
    this.calm = 1;
  }

  /** Where the hero is in the shooting cycle (see bowCycle). */
  pose() {
    return bowCycle(this.sinceShot, this.period, this.calm);
  }

  get shoulder() {
    return [this.x + 2, this.y - 40];
  }

  update(dt, game) {
    const st = game.stats.hero;
    this.equipment = st.equipment;
    this.t += dt;
    this.recoil = Math.max(0, (this.recoil ?? 0) - dt * 6);
    this.cd -= dt * game.skills.rateMult; // Savaş Narası speeds up attacks
    this.manualCd -= dt * game.skills.rateMult;
    this.sinceShot += dt * game.skills.rateMult;
    this.period = 1 / st.rate;
    // With the field clear the hero eases the string and lowers the bow a little
    const calm = game.enemies.length || game.aim ? 0 : 1;
    this.calm += (calm - this.calm) * Math.min(1, dt * 1.5);

    // Before Otomatik Atış the hero only turns to face the player's aim (see manualShot)
    if (!st.autoFire) {
      if (!game.aim) this.theta += (-0.15 - this.theta) * Math.min(1, dt * 4);
      return;
    }
    const target = frontmost(game.enemies);
    if (!target) {
      this.theta += (-0.15 - this.theta) * Math.min(1, dt * 4);
      this.cd = Math.max(this.cd, 0.1);
      return;
    }
    const [sx, sy] = this.shoulder;
    const shot = leadShot(sx, sy, target, GRAVITY, 1300, 0.3, 1.4);
    const want = Math.atan2(shot.vy, shot.vx);
    this.theta += (want - this.theta) * Math.min(1, dt * 12);

    if (this.cd <= 0) {
      // Automatic fire runs at a share of the full rate until Otomatik Atış is maxed
      this.cd = this.period / st.autoFire;
      for (let i = 0; i < st.multishot; i++) {
        const spread = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.045;
        this.fire(game, shot.vx, shot.vy, spread);
      }
      game.audio.play('bow');
    }
  }

  fire(game, vx, vy, spread = 0) {
    const st = game.stats.hero;
    const [sx, sy] = this.shoulder;
    const sp = Math.hypot(vx, vy);
    const a = Math.atan2(vy, vx) + spread;
    const crit = Math.random() < st.critChance;
    this.recoil = 1;
    this.sinceShot = 0;
    if (crit) game.effects.sparks(sx + Math.cos(a) * 18, sy + Math.sin(a) * 18, 4, '#ffb02e');
    const damage = st.damage * (crit ? st.critMult : 1);
    game.addProjectile(
      new Projectile('arrow', sx, sy, Math.cos(a) * sp, Math.sin(a) * sp, {
        damage,
        crit,
        pierce: st.pierce,
        burn: st.burn * damage, // burn damage per second, applied on hit
      }),
    );
  }

  /**
   * The player's own shot toward a battlefield point (a tap, or held down for steady fire).
   * Clicking fires a little faster than the hero's automatic rate. Returns whether it fired.
   */
  manualShot(game, px, py) {
    if (this.manualCd > 0) return false;
    this.manualCd = (this.period ?? 1) * MANUAL_PERIOD;
    const [sx, sy] = this.shoulder;
    const shot = ballistic(sx, sy, px, py, GRAVITY, 1400, 0.25, 1.3);
    this.theta = Math.atan2(shot.vy, shot.vx);
    // Çoklu Ok applies to clicked shots too, fanned around the aim point
    const n = game.stats.hero.multishot;
    for (let i = 0; i < n; i++) {
      const spread = i === 0 ? rand(-0.01, 0.01) : (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.045;
      this.fire(game, shot.vx, shot.vy, spread);
    }
    game.audio.play('bow');
    return true;
  }

  draw(ctx) {
    const { pull, release, reach, nocked } = this.pose();
    // Breathe while idle, rock back slightly on each release; the bow sinks when the field is clear
    const lean = -0.05 + Math.sin(this.t * 2.2) * 0.025 - (this.recoil ?? 0) * 0.12;
    const theta = this.theta + this.calm * 0.35;
    drawArcher(ctx, this.x, this.y, theta, pull, {
      s: 1.08, accent: HERO_BLUE, cape: true, hood: HERO_BLUE, t: this.t, lean,
      release, reach, nocked, equipment: this.equipment, hero: true,
    });
  }
}
