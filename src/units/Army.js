import { GROUND_Y } from '../core/constants.js';
import { rand } from '../utils/math.js';
import { UNITS } from './roster.js';
import { BEHAVIORS } from './behaviors.js';
import { ART, drawDogs, drawInsignia } from './art.js';
import { Soldier } from './Soldier.js';
import { Knight } from './Knight.js';

/**
 * One unit standing at its post (everything except soldiers and the knight). A squad is
 * several Units of the same kind, one per `post.xs` slot.
 */
class Unit {
  constructor(def, slot = 0) {
    this.def = def;
    this.kind = def.kind;
    this.x = def.post.xs ? def.post.xs[slot] : def.post.x;
    this.home = this.x;
    this.y = def.post.y;
    this.cd = rand(0.3, 1);
    this.theta = -0.2;
    this.facing = 1;
    this.anim = 0;
    this.period = 2;
    this.t = rand(0, 10);
    this.since = 9;     // time since the last attack, which the art's action cycles run on
    this.actions = 0;   // attacks so far (the drummer alternates sticks on it)
    this.engaged = false; // the behavior has something to attack
    this.alert = 0;     // eased toward engaged: relaxed stance 0, combat stance 1
  }

  update(dt, game, st) {
    this.t += dt;
    this.anim = Math.max(0, this.anim - dt);
    this.cd -= dt * game.skills.rateMult; // Savaş Narası speeds up attacks
    this.period = st.rate ? 1 / st.rate : 2;
    const before = this.anim;
    BEHAVIORS[this.def.behavior](this, game, st, dt);
    if (this.anim > before) {
      this.since = 0;
      this.actions++;
    } else this.since += dt * game.skills.rateMult;
    this.alert += ((this.engaged ? 1 : 0) - this.alert) * Math.min(1, dt * 3);
  }

  draw(ctx, st) {
    const j = ART[this.def.art](ctx, this);
    if (j && st?.rank) drawInsignia(ctx, j.head[0], this.y - this.def.badge, st.rank.stars);
  }
}

/**
 * The army: every hired unit, the shield soldiers that hold the line and the knight.
 * Game asks it to sync with the stats after purchases, to update each tick and to draw
 * in three layers (behind the castle, on the walls, on the field).
 */
export class Army {
  constructor() {
    this.units = new Map();
    this.soldiers = [];
    this.knight = null;
  }

  /** Hire whatever the stats say is hired; returns the newly hired unit kinds. */
  sync(game) {
    const stats = game.stats.allies;
    const hired = [];
    for (const def of UNITS) {
      const st = stats[def.kind];
      if (!st) continue;
      if (def.behavior === 'infantry') {
        while (this.soldiers.length < st.count) {
          const s = new Soldier(this.soldiers.length);
          s.sync(st);
          s.hp = s.maxHp;
          this.soldiers.push(s);
        }
        for (const s of this.soldiers) s.sync(st);
      } else if (def.behavior === 'cavalry') {
        this.knight ??= new Knight();
      } else {
        // Squads grow a member per `count`; everyone else is a single unit
        const want = def.post.xs ? Math.min(st.count, def.post.xs.length) : 1;
        const squad = this.units.get(def.kind) ?? [];
        if (!squad.length) hired.push(def.kind);
        while (squad.length < want) {
          squad.push(new Unit(def, squad.length));
          if (squad.length > 1) game.effects.burst(squad.at(-1).x, squad.at(-1).y - 30, 14, { color: '#ffe9a8', speedMin: 30, speedMax: 110, gravity: -50, glow: true });
        }
        this.units.set(def.kind, squad);
      }
    }
    for (const kind of hired) {
      const [x, y] = this.positionsOf(kind)[0];
      game.effects.burst(x, y, 16, { color: '#ffe9a8', speedMin: 30, speedMax: 120, gravity: -50, glow: true });
    }
    return hired;
  }

  reset() {
    this.units.clear();
    this.soldiers = [];
    this.knight = null;
  }

  /** Every unit of every squad. */
  *all() {
    for (const squad of this.units.values()) yield* squad;
  }

  update(dt, game) {
    const stats = game.stats.allies;
    for (const u of this.all()) u.update(dt, game, stats[u.kind]);
    for (const so of this.soldiers) so.update(dt, game, stats.soldier);
    this.knight?.update(dt, game);
  }

  /** Where a unit kind stands, for celebration sparkles: [[x, y], ...]. */
  positionsOf(kind) {
    if (kind === 'soldier') return this.soldiers.map((s) => [s.x, s.y - 35]);
    if (kind === 'knight') return [[this.knight?.x ?? 200, GROUND_Y - 40]];
    return (this.units.get(kind) ?? []).map((u) => [u.x, u.y - 35]);
  }

  /** Units drawn before the castle (the ballista's watchtower stands behind the walls). */
  drawBack(ctx, stats) {
    for (const u of this.all()) if (u.def.layer === 'back') u.draw(ctx, stats[u.kind]);
  }

  /** Units on the walls, the tower and their posts on the field. */
  drawPosts(ctx, stats) {
    for (const u of this.all()) if (u.def.layer !== 'back') u.draw(ctx, stats[u.kind]);
  }

  /** The moving field units: soldiers, the knight and the dogs. */
  drawField(ctx, stats) {
    const rank = stats.soldier?.rank;
    for (const so of this.soldiers) {
      so.draw(ctx);
      if (so.alive && rank) drawInsignia(ctx, so.x, so.y - 84, rank.stars);
    }
    this.knight?.draw(ctx);
    const kennel = this.units.get('hounds')?.[0];
    drawDogs(ctx, kennel?.dogs, kennel?.t);
  }
}
