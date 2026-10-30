import { WORLD_W, GROUND_Y, WALL_TOP } from '../core/constants.js';
import { densest } from './Targeting.js';
import { Projectile } from '../entities/Projectile.js';
import { SkillFx } from '../render/skillFx.js';
import { BOOST } from '../config/rewards.js';
import { tr } from '../i18n/i18n.js';

const KEYS = ['warcry', 'meteor', 'shield', 'freeze', 'midas'];

/**
 * Active skills (except Ok Yağmuru, which lives in Game for historical reasons).
 * Tracks cooldowns and running buffs; other systems ask it for multipliers.
 */
export class SkillSystem {
  constructor(game) {
    this.game = game;
    this.cd = Object.fromEntries(KEYS.map((k) => [k, 0]));
    this.active = { warcry: 0, shield: 0, freeze: 0, midas: 0 }; // seconds left
    this.fx = new SkillFx(game);
  }

  reset() {
    for (const k of KEYS) this.cd[k] = 0;
    for (const k in this.active) this.active[k] = 0;
    this.fx.clear();
  }

  st(key) {
    return this.game.stats.skills[key];
  }

  // ---- effects other systems query --------------------------------------------

  get damageMult() {
    return this.active.warcry > 0 ? this.st('warcry')?.dmg ?? 1 : 1;
  }

  get rateMult() {
    return this.active.warcry > 0 ? this.st('warcry')?.rate ?? 1 : 1;
  }

  get goldMult() {
    return (this.active.midas > 0 ? this.st('midas')?.mult ?? 1 : 1) * (this.boosted ? BOOST.gold : 1);
  }

  /** Hızlandırma is running. */
  get boosted() {
    return (this.game.state.boostLeft ?? 0) > 0;
  }

  get shielded() {
    return this.active.shield > 0;
  }

  isAuto(key) {
    return this.game.state.skillAuto[key] !== false; // auto-cast is on by default
  }

  ready(key) {
    return !!this.st(key) && this.cd[key] <= 0;
  }

  // ---- casting ------------------------------------------------------------------

  cast(key) {
    const g = this.game;
    const s = this.st(key);
    if (!s || this.cd[key] > 0) return false;
    switch (key) {
      case 'warcry':
        this.active.warcry = s.duration;
        g.showBanner(tr('Savaş Narası!'), tr('+%{0} hasar', Math.round((s.dmg - 1) * 100)), '#ffb347', 1.4);
        g.effects.burst(g.hero.x, g.hero.y - 40, 30, { color: '#ffb347', speedMin: 60, speedMax: 220, gravity: -40, glow: true, lifeMin: 0.4, lifeMax: 0.9 });
        this.fx.warcry();
        g.shake(3);
        g.audio.play('charge');
        break;
      case 'meteor': {
        const target = densest(g.enemies, s.radius * 0.6);
        if (!target) return false;
        const tx = target.walking ? Math.max(target.x - target.speed * 1.2, target.stopX ?? 0) : target.x;
        const sx = tx - 380;
        const sy = -120;
        const t = 1.2;
        this.fx.meteor(tx, s.radius * 0.6, t);
        g.addProjectile(new Projectile('meteor', sx, sy, (tx - sx) / t, (GROUND_Y - 10 - sy) / t, {
          damage: g.stats.hero.damage * s.power, radius: s.radius, magic: true, gravity: 0,
        }));
        g.audio.play('magic');
        break;
      }
      case 'shield':
        this.active.shield = s.duration;
        g.castle.heal(g.castle.maxHp * s.heal);
        g.effects.text(130, WALL_TOP - 70, tr('+{0}% onarım', Math.round(s.heal * 100)), '#9fe3ff', 18);
        this.fx.shield();
        g.showBanner(tr('İlahi Kalkan!'), '', '#9fe3ff', 1.2);
        g.audio.play('wave');
        break;
      case 'freeze':
        this.active.freeze = s.duration;
        g.showBanner(tr('Zaman Durdu!'), '', '#bfe8ff', 1.2);
        g.audio.play('frost');
        this.fx.freeze();
        break;
      case 'midas':
        this.active.midas = s.duration;
        g.showBanner(tr('Midas Dokunuşu!'), tr('×{0} altın', s.mult), '#ffd34d', 1.4);
        g.audio.play('coin');
        this.fx.midas();
        break;
    }
    this.cd[key] = s.cooldown;
    g.count('skillCasts');
    return true;
  }

  // ---- per-tick ---------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    for (const k of KEYS) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (const k in this.active) this.active[k] = Math.max(0, this.active[k] - dt);

    // Frozen enemies stay frozen while the effect lasts (new arrivals too)
    if (this.active.freeze > 0) {
      for (const e of g.enemies) if (e.alive) e.slow(1, Math.min(0.2, this.active.freeze));
    }
    this.fx.update(dt);

    // Auto-cast for idle play
    const alive = g.enemies.filter((e) => e.alive && e.x < WORLD_W - 40);
    const boss = alive.some((e) => e.boss);
    const want = {
      warcry: alive.length >= 5 || boss,
      meteor: boss || (alive.length >= 3 && densest(alive, 90) && alive.filter((e) => Math.abs(e.x - densest(alive, 90).x) < 90).length >= 3),
      shield: g.castle.hp / g.castle.maxHp < 0.4,
      freeze: alive.length >= 6 || boss,
      midas: alive.length >= 6 || boss,
    };
    for (const k of KEYS) {
      if (want[k] && this.isAuto(k) && this.ready(k)) this.cast(k);
    }
  }

  /** Remaining fraction of a running buff (for the skill bar ring), 0 if none. */
  activeFraction(key) {
    const s = this.st(key);
    if (!s || !this.active[key]) return 0;
    return this.active[key] / s.duration;
  }

  drawGround(ctx) {
    this.fx.drawGround(ctx);
  }

  drawOverlays(ctx, left, w) {
    this.fx.draw(ctx, left, w);
  }
}

export { KEYS as SKILL_KEYS };
