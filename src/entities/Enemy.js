import { ENEMY_TYPES, waveScaling } from '../config/enemies.js';
import { GROUND_Y, SPAWN_X, WORLD_W, WALL_FRONT, INK, FLASH, GRAVITY } from '../core/constants.js';
import { rand, ballistic } from '../utils/math.js';
import { Projectile } from './Projectile.js';
import { drawEnemy, drawEnrage, STRIKE_AT, SWING } from './enemyArt.js';

const ENRAGE_AT = 0.3;      // bosses turn furious below this share of their health
const SUMMON_CAP = 8;       // enemies on the field before a boss stops summoning
const BURROW_UNTIL = 760;   // burrowers surface at this x
const HEAL_EVERY = 4;
const HEAL_RADIUS = 190;

export class Enemy {
  /** hpMult: the run's Yemin handicap on enemy health. */
  constructor(type, wave, hpMult = 1) {
    const def = ENEMY_TYPES[type];
    const sc = waveScaling(wave);
    this.type = type;
    this.def = def;
    this.maxHp = def.hp * sc.hp * hpMult;
    this.hp = this.maxHp;
    this.damage = def.damage * sc.dmg;
    this.gold = def.gold * sc.gold;
    this.speed = def.speed * rand(0.92, 1.08);
    this.atkRate = def.atkRate;
    this.range = def.range ? def.range + rand(-30, 30) : 0;
    this.armor = def.armor;
    this.s = def.scale;
    this.boss = !!def.boss;
    this.fly = !!def.fly;
    this.siege = !!def.siege;
    this.w = def.w ?? 22 * this.s;
    this.h = def.h ?? 60 * this.s;
    this.altitude = (def.altitude ?? 155) + (def.pack ? rand(-35, 35) : 0);
    this.x = SPAWN_X + rand(0, 40);
    this.y = GROUND_Y;
    this.phase = rand(0, 6);
    this.atkTimer = rand(0.2, 0.8);
    this.atkAnim = 0;
    this.flash = 0;
    this.alive = true;
    this.dyingT = 0;
    this.walking = true;
    this.kb = 0;            // knockback velocity (px/s, positive = pushed right)
    this.pendingHit = false;
    this.step = 0;
    this.burnDps = 0;       // Ateşli Oklar
    this.burnT = 0;
    this.slowF = 0;         // Buz Büyücüsü: fraction of speed removed
    this.slowT = 0;
    this.wave = wave;
    this.burrowed = !!def.burrow;
    this.healT = HEAL_EVERY;
    this.summonT = def.summon?.every ?? 0;
    this.stompT = def.stomp ?? 0;
    this.enraged = false;
  }

  ignite(dps, duration = 3) {
    // Only stack with a burn that is still running; an expired burn must not set the rate
    this.burnDps = this.burnT > 0 ? Math.max(this.burnDps, dps) : dps;
    this.burnT = duration;
  }

  slow(fraction, duration = 2.5) {
    const f = this.boss ? fraction * 0.5 : fraction;
    this.slowF = Math.max(this.slowF, f);
    this.slowT = Math.max(this.slowT, duration);
  }

  /** Push the enemy back; heavier enemies barely move, the boss and siege engines never do. */
  knockback(force) {
    if (this.boss || this.siege) return;
    this.kb = Math.min(260, this.kb + force / (this.s * this.s));
  }

  get centerY() {
    return this.y - this.h * 0.55;
  }

  get removable() {
    return !this.alive && this.dyingT > 1.6;
  }

  contains(px, py) {
    if (this.burrowed) return false;
    return Math.abs(px - this.x) < this.w * 0.6 && py > this.y - this.h && py < this.y + 4;
  }

  update(dt, game) {
    this.flash = Math.max(0, this.flash - dt);
    if (this.kb > 0) {
      this.x += this.kb * dt;
      this.kb = Math.max(0, this.kb - this.kb * 7 * dt - 20 * dt);
    }
    if (!this.alive) {
      this.dyingT += dt;
      return;
    }

    // Status effects
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * dt;
      if (Math.random() < dt * 14) {
        game.effects.burst(this.x + rand(-6, 6) * this.s, this.y - this.h * rand(0.3, 0.9), 1, { color: Math.random() < 0.5 ? '#ff9a3c' : '#ffd36a', speedMin: 5, speedMax: 25, angleMin: -Math.PI * 0.8, angleMax: -Math.PI * 0.2, lifeMin: 0.3, lifeMax: 0.5, gravity: -90, glow: true, sizeMin: 1.5, sizeMax: 3 });
      }
      if (this.hp <= 0) return game.killEnemy(this, 10);
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      if (this.slowT <= 0) this.slowF = 0;
    }
    const pace = 1 - this.slowF; // slowed enemies walk and swing slower
    dt *= pace;
    this.updateAbilities(dt, game);
    if (!this.alive) return;

    this.atkAnim = Math.max(0, this.atkAnim - dt);
    if (this.fly) {
      this.phase += dt * 8;
      const dive = this.atkAnim > 0
        ? Math.sin((1 - this.atkAnim / SWING) * Math.PI) * 52
        : 0;
      this.y = GROUND_Y - this.altitude + Math.sin(this.phase) * 9 + dive * (this.altitude / 155);
    }

    // Flying raiders pass over the shield line and the Dış Sur; siege engines roll
    // through the shield line but must batter the Dış Sur before the castle.
    const b = this.fly
      ? { x: WALL_FRONT, halfW: 0, hitY: this.centerY, ref: game.castle }
      : this.siege ? game.siegeBlocker() : game.findBlocker(this);
    const reach = this.range > 0 ? this.range : b.halfW + this.w * 0.5 + 2;
    const stopX = Math.min(b.x + reach, WORLD_W - 40);
    this.stopX = stopX;

    if (this.x > stopX) {
      this.walking = true;
      this.pendingHit = false;
      this.x -= this.speed * dt * (this.kb > 0 ? 0.3 : 1);
      if (!this.fly) this.phase += dt * this.speed * 0.11 / this.s;
      // Heavy footsteps kick up dust (and shake the screen for the boss)
      const step = Math.floor(this.phase / Math.PI);
      if (step !== this.step) {
        this.step = step;
        if ((this.s >= 1.4 || this.siege) && this.x < WORLD_W) {
          game.effects.dust(this.x + (this.siege ? rand(-30, 30) : 0), this.y, this.s);
          if (this.boss) game.shake(2.5);
        }
      }
      return;
    }

    this.walking = false;
    if (this.pendingHit && this.atkAnim <= SWING * (1 - STRIKE_AT)) {
      this.pendingHit = false;
      this.strike(b, game);
    }
    this.atkTimer -= dt;
    if (this.atkTimer > 0) return;
    this.atkTimer = 1 / this.atkRate;
    this.atkAnim = SWING;
    this.pendingHit = true;
  }

  /** What sets the newer raiders apart: regeneration, healing, summoning, stomps and rage. */
  updateAbilities(dt, game) {
    const def = this.def;
    if (def.regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * def.regen * dt);
    if (this.burrowed && this.x < BURROW_UNTIL) {
      this.burrowed = false;
      game.effects.dust(this.x, this.y, 2.2);
      game.effects.burst(this.x, this.y - 6, 12, { color: '#a07a4a', angleMin: -Math.PI * 0.85, angleMax: -Math.PI * 0.15, speedMin: 50, speedMax: 180, sizeMin: 2, sizeMax: 4 });
    }
    if (def.heal && (this.healT -= dt) <= 0) {
      this.healT = HEAL_EVERY;
      for (const o of game.enemies) {
        if (!o.alive || o.hp >= o.maxHp || Math.abs(o.x - this.x) > HEAL_RADIUS) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * def.heal);
        game.effects.burst(o.x, o.centerY, 5, { color: '#7fe08a', angleMin: -1.9, angleMax: -1.2, speedMin: 20, speedMax: 70, gravity: -40, glow: true, lifeMin: 0.4, lifeMax: 0.8, sizeMin: 1.2, sizeMax: 2.4 });
      }
    }
    if (def.summon && this.x < WORLD_W && (this.summonT -= dt) <= 0) {
      this.summonT = def.summon.every;
      if (game.enemies.filter((e) => e.alive).length < SUMMON_CAP) game.spawnBeside(this, def.summon.type, def.summon.n);
    }
    if (def.stomp && this.x < WORLD_W && (this.stompT -= dt) <= 0) {
      this.stompT = def.stomp;
      game.bossStomp(this);
    }
    if (this.boss && !this.enraged && this.hp < this.maxHp * ENRAGE_AT) {
      this.enraged = true;
      this.speed *= 1.4;
      this.atkRate *= 1.4;
      this.damage *= 1.25;
      game.onBossEnrage(this);
    }
  }

  strike(b, game) {
    if (this.def.suicide) {
      game.enemyHitsBlocker(b.ref, this.damage, this.x - this.w * 0.6, this.centerY, 2.4, this);
      game.effects.explosion(this.x, this.centerY, 56);
      game.shake(4);
      game.audio.play('boom');
      this.hp = 0;
      game.killEnemy(this, 0);
    } else if (this.def.bolt) {
      const sx = this.x - 12 * this.s;
      const sy = this.y - this.h * 0.85;
      const shot = ballistic(sx, sy, b.x + rand(-6, 6), b.hitY, 260, 520, 0.7, 1.2);
      game.addProjectile(new Projectile('hex', sx, sy, shot.vx, shot.vy, { damage: this.damage, target: b.ref, flight: shot.t, gravity: 260, color: this.def.bolt, size: this.boss ? 2 : 1 }));
      game.audio.play('magic');
    } else if (this.type === 'catapult') {
      // High lob from the throwing arm; the boulder lands on the wall
      const sx = this.x + 6;
      const sy = this.y - 92;
      const shot = ballistic(sx, sy, b.x + rand(-10, 4), b.hitY, GRAVITY, 420, 1.3, 1.9);
      game.addProjectile(new Projectile('boulder', sx, sy, shot.vx, shot.vy, { damage: this.damage, target: b.ref, flight: shot.t }));
      game.audio.play('catapult');
    } else if (this.range > 0) {
      const sx = this.x - 8 * this.s;
      const sy = this.y - this.h * 0.8;
      const ty = b.hitY;
      const shot = ballistic(sx, sy, b.x + rand(-6, 6), ty, GRAVITY, 600, 0.5, 1.1);
      game.addProjectile(new Projectile('spear', sx, sy, shot.vx, shot.vy, { damage: this.damage, target: b.ref, flight: shot.t }));
      game.audio.play('throw');
    } else if (this.siege) {
      // The ram's iron head slams into the gate
      game.enemyHitsBlocker(b.ref, this.damage, this.x - this.w * 0.6, GROUND_Y - 34, 2.4, this);
      game.audio.play('ram');
    } else {
      game.enemyHitsBlocker(b.ref, this.damage, this.x - this.w * 0.6, this.centerY, this.s, this);
    }
  }

  draw(ctx) {
    ctx.save();
    if (!this.alive) {
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, this.dyingT - 0.9) / 0.7);
      const k = Math.min(1, this.dyingT * 3.2);
      ctx.translate(this.x, this.y);
      if (this.siege) {
        // Wrecked engines sag onto a broken wheel and sink into the dust
        ctx.translate(0, k * 8);
        ctx.rotate(k * 0.14);
      } else {
        // Topple backwards with a small bounce, then fade out
        const bounce = k >= 1 ? Math.max(0, Math.sin((this.dyingT - 0.31) * 14)) * 0.08 * Math.max(0, 1 - (this.dyingT - 0.31) * 3) : 0;
        ctx.rotate((k * k - bounce) * Math.PI * 0.5);
      }
      ctx.translate(-this.x, -this.y);
    } else if (this.flash > 0) {
      // Squash on impact so every hit reads, anchored at the feet
      const q = this.flash * (this.siege ? 0.3 : 1.2);
      ctx.translate(this.x, this.y);
      ctx.scale(1 + q, 1 - q);
      ctx.translate(-this.x, -this.y);
    }

    // Frozen enemies turn icy blue, burning ones glow ember red
    // Siege engines soak constant fire, so they only tint instead of flashing white
    if (this.enraged && this.alive) drawEnrage(ctx, this);
    const hitColor = this.siege ? '#4d4456' : FLASH;
    const color = this.flash > 0 ? hitColor : this.slowT > 0 && this.alive ? '#2c4f78' : this.burnT > 0 && this.alive ? '#4a1a10' : INK;
    const s = this.s;
    const u = 1 - this.atkAnim / SWING; // 0 → 1 through a swing (1 when idle)
    drawEnemy(ctx, this, u, color);
    ctx.restore();

    if (this.alive && this.hp < this.maxHp && !this.boss && !this.burrowed) {
      const bw = this.siege ? 54 : 26 * Math.max(1, s);
      const by = this.y - this.h - 18;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(this.x - bw / 2, by, bw, 4);
      ctx.fillStyle = '#e8453c';
      ctx.fillRect(this.x - bw / 2, by, (bw * this.hp) / this.maxHp, 4);
    }
  }
}
