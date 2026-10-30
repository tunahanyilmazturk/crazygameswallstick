import { GRAVITY, WORLD_W, GROUND_Y, WALL_TOP } from '../core/constants.js';
import { rand } from '../utils/math.js';
import { frontmost, frontmostFlying, densest, leadShot } from '../systems/Targeting.js';
import { Projectile } from '../entities/Projectile.js';

/*
 * How each unit fights. A behavior is a function (unit, game, st, dt) called every tick with
 * the unit's live stats; the unit's `cd` (cooldown) and `period` are already advanced by Unit.
 * Ranged units share `shoot`, configured by the roster entry's `shot`.
 */

const onField = (e) => e.alive && e.x < WORLD_W - 10;

/** The enemy a ranged unit aims at, by the roster's `shot.target` rule. */
function pickTarget(enemies, rule, st) {
  switch (rule) {
    case 'air': return frontmostFlying(enemies) ?? frontmost(enemies);
    case 'dense': return densest(enemies, st.radius);
    case 'armored': {
      // Heaviest armour first, ties to the one closest to the castle
      let best = null;
      for (const e of enemies) {
        if (!onField(e) || (e.armor < 0.2 && !e.siege)) continue;
        if (!best || e.armor > best.armor || (e.armor === best.armor && e.x < best.x)) best = e;
      }
      return best ?? frontmost(enemies);
    }
    default: return frontmost(enemies);
  }
}

/** Where a unit's projectile leaves from. */
export function muzzleOf(u) {
  const m = u.def.shot?.muzzle;
  if (Array.isArray(m)) return [u.x + m[0], u.y + m[1]];
  if (m === 'facing') return [u.x + u.facing * 16, u.y - 30];
  if (m === 'barrel') return [u.x + 30 + Math.cos(u.theta) * 26, u.y - 14 + Math.sin(u.theta) * 26];
  return [u.x + 26 + Math.cos(u.theta) * 22, u.y - 30 + Math.sin(u.theta) * 22];
}

function shoot(u, game, st, dt) {
  const shot = u.def.shot;
  const target = pickTarget(game.enemies, shot.target, st);
  u.engaged = Boolean(target);
  if (!target) {
    u.cd = Math.max(u.cd, 0.2);
    return;
  }
  if (shot.face) u.facing = target.x >= u.x ? 1 : -1;
  const [sx, sy] = muzzleOf(u);
  const g = shot.gravity === 'g' ? GRAVITY : shot.gravity;
  const aim = leadShot(sx, sy, target, g, shot.speed, shot.minT, shot.maxT, shot.yFrac ?? 0.55);
  aimAt(u, Math.atan2(aim.vy, aim.vx), dt);
  if (u.cd > 0) return;
  u.cd = u.period;
  u.anim = 0.3;
  const n = shot.volley ? st[shot.volley] : 1;
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(aim.vy, aim.vx) + (i ? rand(-0.06, 0.06) : 0);
    const sp = Math.hypot(aim.vx, aim.vy) * (i ? rand(0.95, 1.04) : 1);
    game.addProjectile(new Projectile(shot.projectile, sx, sy, Math.cos(a) * sp, Math.sin(a) * sp, {
      damage: st.damage, gravity: g, magic: shot.magic, radius: st.radius, slow: st.slow, burn: st.burn,
      pierce: st.pierce, knockback: st.knockback, airMultiplier: st.airMultiplier, armorPierce: st.armorPierce,
    }));
  }
  if (shot.spark) game.effects.sparks(sx, sy, 6, shot.spark);
  if (shot.recoil) {
    game.effects.burst(sx, sy, 10, { color: 'rgba(70,64,80,0.55)', speedMin: 20, speedMax: 120, angleMin: u.theta - 0.5, angleMax: u.theta + 0.5, lifeMin: 0.5, lifeMax: 1, gravity: -40, drag: 2, sizeMin: 5, sizeMax: 10, shrink: false });
    game.effects.sparks(sx, sy, 10, '#ffcf6a');
    game.shake(4);
  }
  game.audio.play(shot.sound);
}

/** Turn smoothly toward an aim angle. */
function aimAt(u, angle, dt) {
  u.theta += (angle - u.theta) * Math.min(1, dt * 10);
}

function heal(u, game, st) {
  u.engaged = game.enemies.length > 0;
  if (u.cd > 0) return;
  u.cd = 2;
  u.anim = 0.6;
  const amount = st.heal * 2;
  const c = game.castle;
  if (c.hp < c.maxHp) {
    c.heal(amount);
    game.effects.text(150, WALL_TOP - 20, '+' + Math.round(amount), '#7dffa8', 16);
  }
  for (const s of game.soldiers) if (s.alive) s.heal(amount);
  game.outerWall.heal(amount);
  game.effects.burst(u.x, u.y - 50, 10, { color: '#9dffbf', speedMin: 20, speedMax: 70, gravity: -80, glow: true, lifeMin: 0.5, lifeMax: 1, sizeMin: 1.5, sizeMax: 3 });
}

const MARCH = 95;   // walking speed of advancing infantry (px/s)
const RETREAT = 70;

/** Closest ground enemy within `range` ahead of `home` (the one nearest to `x`). */
export function nearestGround(enemies, home, x, range) {
  let best = null;
  for (const e of enemies) {
    if (!onField(e) || e.fly || e.x < home - 20 || e.x > home + range) continue;
    if (!best || Math.abs(e.x - x) < Math.abs(best.x - x)) best = e;
  }
  return best;
}

/**
 * Kapı Muhafızı: marches onto the nearest ground enemy ahead of its post, cuts it down
 * with knockback, and walks back to its post when nothing is in reach.
 */
function melee(u, game, st, dt) {
  const target = nearestGround(game.enemies, u.home, u.x, st.range);
  u.engaged = false;
  if (!target) {
    const back = u.home - u.x;
    u.walking = Math.abs(back) > 1;
    if (u.walking) {
      u.facing = Math.sign(back);
      u.x += u.facing * Math.min(Math.abs(back), RETREAT * dt);
      u.step = (u.step ?? 0) + dt * 8;
    } else u.facing = 1;
    return;
  }
  const front = target.x - target.w * 0.5;
  const gap = front - u.x;
  u.facing = gap >= 0 ? 1 : -1;
  if (Math.abs(gap) > 22) {
    u.walking = true;
    u.x += u.facing * Math.min(Math.abs(gap) - 20, MARCH * dt);
    u.step = (u.step ?? 0) + dt * 10;
    return;
  }
  u.walking = false;
  u.engaged = true;
  if (u.cd > 0) return;
  u.cd = u.period;
  u.anim = 0.34;
  game.damageEnemy(target, st.damage, { x: target.x, y: target.centerY, kb: st.knockback });
  game.effects.sparks(target.x, target.centerY, 5, '#d6d0c4');
  game.audio.play('sword');
}

/** Banner and drum: their effect is a stat aura (systems/Stats.js); here they only keep time. */
function aura(u, game) {
  u.engaged = game.enemies.length > 0;
  if (u.cd <= 0) {
    u.cd = u.def.kind === 'drummer' ? 0.5 : 1;
    u.anim = 0.25;
  }
}

/** Fırtına Büyücüsü: a bolt hits the front enemy, then jumps to the nearest unhit one. */
function chain(u, game, st, dt) {
  const first = frontmost(game.enemies);
  u.engaged = Boolean(first);
  if (!first) {
    u.cd = Math.max(u.cd, 0.2);
    return;
  }
  // The bolt leaves from the staff's focus, where it points on the cast (units/art.js)
  const sx = u.x + 26;
  const sy = u.y - 55;
  aimAt(u, Math.atan2(first.centerY - sy, first.x - sx), dt);
  if (u.cd > 0) return;
  u.cd = u.period;
  u.anim = 0.3;
  const hit = new Set();
  const points = [[sx, sy]];
  let cur = first;
  let damage = st.damage;
  for (let i = 0; i < st.chains && cur; i++) {
    hit.add(cur);
    points.push([cur.x, cur.centerY]);
    game.damageEnemy(cur, damage, { magic: true, kind: 'storm', kb: 10 });
    damage *= 0.85;
    let next = null;
    let best = st.reach;
    for (const e of game.enemies) {
      if (!e.alive || hit.has(e)) continue;
      const d = Math.hypot(e.x - cur.x, e.centerY - cur.centerY);
      if (d < best) {
        best = d;
        next = e;
      }
    }
    cur = next;
  }
  game.effects.lightning(points);
  game.audio.play('zap');
}

/**
 * Savaş Köpekleri: each dog runs to a ground enemy (spread over the front of the line),
 * bites until it falls, and trots back to the kennel when the field is clear.
 */
function hounds(u, game, st, dt) {
  const dogs = (u.dogs ??= []);
  while (dogs.length < st.count) {
    dogs.push({ x: u.x + 14 + dogs.length * 9, home: u.x + 14 + dogs.length * 9, target: null, cd: rand(0, 0.5), phase: rand(0, 6), anim: 0, f: 1 });
  }
  dogs.length = st.count;
  const prey = game.enemies.filter((e) => e.alive && !e.fly && e.x < WORLD_W - 30).sort((a, b) => a.x - b.x);
  // The handler sounds the horn when the pack is first sent out
  if (prey.length && !u.engaged) u.anim = 1.2;
  u.engaged = prey.length > 0;
  dogs.forEach((d, i) => {
    d.anim = Math.max(0, d.anim - dt);
    if (d.target && !d.target.alive) d.target = null;
    if (!d.target && prey.length) d.target = prey[i % Math.min(prey.length, 3)];
    const goal = d.target ? d.target.x - d.target.w * 0.5 - 6 : d.home;
    const dx = goal - d.x;
    if (Math.abs(dx) > (d.target ? 6 : 1)) {
      d.f = Math.sign(dx);
      const step = Math.min(Math.abs(dx), st.speed * dt * (d.target ? 1 : 0.6));
      d.x += d.f * step;
      d.phase += dt * (d.target ? 20 : 12);
      d.running = true;
      return;
    }
    d.running = false;
    if (!d.target) {
      d.f = 1;
      return;
    }
    d.f = 1;
    d.cd -= dt * game.skills.rateMult;
    if (d.cd > 0) return;
    d.cd = 1 / st.rate;
    d.anim = 0.25;
    game.damageEnemy(d.target, st.damage, { x: d.target.x - d.target.w * 0.4, y: GROUND_Y - 22, kb: 12 });
    game.audio.play('bite');
  });
}

export const BEHAVIORS = { shoot, heal, melee, aura, chain, hounds };
