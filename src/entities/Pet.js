import { GROUND_Y, WALL_TOP, WORLD_W } from '../core/constants.js';
import { lerp } from '../utils/math.js';
import { drawPet } from '../render/petArt.js';
import { frontmost, frontmostFlying } from '../systems/Targeting.js';
import { Projectile } from './Projectile.js';

const HOME = { x: 194, y: WALL_TOP };
const PERCH = { x: 186, y: WALL_TOP - 84 };  // where flyers hover, over the hero's shoulder
const STRIKE_TIME = 0.75;                    // one leap out to the target and back
const ALARM_X = 900;                         // only fights what has come this close

/** The hero's companion: sits on the wall, acts on its cooldown, flies out to strike. */
export class Pet {
  constructor() {
    this.t = 0;
    this.cd = 2;
    this.strike = null;   // { target, tx, ty, t, hit } while leaping
  }

  update(dt, game) {
    this.t += dt;
    const pet = game.stats.pet;
    if (!pet) return;
    if (this.strike) this.updateStrike(dt, game, pet);
    else if ((this.cd -= dt) <= 0 && this.act(game, pet)) this.cd = pet.cooldown;
  }

  /** Returns false when there is nothing for it to do yet, so it stays ready. */
  act(game, pet) {
    const { def } = pet;
    const near = (e) => e && e.x < ALARM_X;
    const front = frontmost(game.enemies);
    switch (def.act) {
      case 'pounce':
      case 'dive': {
        const target = def.act === 'dive' ? frontmostFlying(game.enemies) ?? front : front;
        if (!near(target)) return false;
        this.strike = { target, tx: target.x, ty: target.centerY, t: 0, hit: false };
        game.audio.play('throw');
        return true;
      }
      case 'breath': {
        if (!near(front)) return false;
        const sx = HOME.x + 26;
        const sy = HOME.y - 30;
        const dx = front.x - sx;
        const dy = front.centerY - sy;
        const len = Math.hypot(dx, dy) || 1;
        const damage = game.stats.hero.damage * pet.power;
        game.addProjectile(new Projectile('fireball', sx, sy, (dx / len) * 520, (dy / len) * 520, { damage, radius: 46, magic: true, burn: damage * 0.1 }));
        game.audio.play('magic');
        return true;
      }
      case 'mend': {
        const { castle } = game;
        if (castle.hp >= castle.maxHp) return false;
        castle.heal(castle.maxHp * pet.power);
        game.effects.burst(HOME.x, HOME.y - 10, 16, { color: '#9fe39a', angleMin: -2, angleMax: -1.1, speedMin: 30, speedMax: 110, gravity: -30, glow: true, lifeMin: 0.5, lifeMax: 1, sizeMin: 1.5, sizeMax: 3 });
        return true;
      }
      case 'forage': {
        const gold = Math.round(Math.max(2, game.state.goldPerSec) * pet.power);
        game.addGold(gold);
        game.effects.text(HOME.x, HOME.y - 40, `+${gold}`, '#ffd34d', 15);
        game.effects.burst(HOME.x + 12, HOME.y, 8, { color: '#a07a4a', angleMin: -2.4, angleMax: -0.7, speedMin: 40, speedMax: 120, sizeMin: 1.2, sizeMax: 2.4 });
        game.audio.play('coin');
        return true;
      }
      case 'hoot': {
        if (!near(front)) return false;
        for (const e of game.enemies) if (e.alive && e.x < ALARM_X) e.slow(pet.power, 2.5);
        game.effects.rings.push({ x: PERCH.x, y: PERCH.y, r: 8, max: 150, life: 0.6, maxLife: 0.6, color: '#d8c6f6' });
        return true;
      }
    }
    return false;
  }

  updateStrike(dt, game, pet) {
    const st = this.strike;
    st.t += dt / STRIKE_TIME;
    if (!st.hit && st.t >= 0.5) {
      st.hit = true;
      if (st.target.alive) {
        game.damageEnemy(st.target, game.stats.hero.damage * pet.power, { x: st.tx, y: st.ty, kb: 45 });
        game.audio.play('bite');
      }
    }
    if (st.t >= 1) this.strike = null;
  }

  draw(ctx, game) {
    const pet = game.stats.pet;
    if (!pet) return;
    const { flies } = pet.def;
    const home = flies ? { x: PERCH.x, y: PERCH.y + Math.sin(this.t * 2.4) * 6 } : HOME;
    const key = pet.def.key;
    if (this.strike) {
      const { t, tx, ty } = this.strike;
      // Out on the first half, back on the second, in an arc over the battlefield
      const k = t < 0.5 ? t * 2 : (1 - t) * 2;
      const e = k * k * (3 - 2 * k);
      const x = lerp(home.x, Math.min(tx, WORLD_W), e);
      const ground = flies ? ty : Math.min(ty + 20, GROUND_Y);
      const y = lerp(home.y, ground, e) - Math.sin(k * Math.PI) * 70;
      drawPet(ctx, key, x, y, this.t, { f: t < 0.5 ? 1 : -1, s: 0.72, moving: true });
      return;
    }
    drawPet(ctx, key, home.x, home.y, this.t, { s: 0.72 });
  }
}
