import { WORLD_W } from '../core/constants.js';
import { ballistic } from '../utils/math.js';

const onScreen = (e) => e.alive && !e.burrowed && e.x < WORLD_W - 10;

/** The enemy closest to the castle. */
export function frontmost(enemies) {
  let best = null;
  for (const e of enemies) if (onScreen(e) && (!best || e.x < best.x)) best = e;
  return best;
}

/** The flying enemy closest to the castle. */
export function frontmostFlying(enemies) {
  let best = null;
  for (const e of enemies) if (e.fly && onScreen(e) && (!best || e.x < best.x)) best = e;
  return best;
}

/** The closest-to-castle ground enemy. */
export function frontmostGround(enemies) {
  let best = null;
  for (const e of enemies) if (!e.fly && onScreen(e) && (!best || e.x < best.x)) best = e;
  return best;
}

/** The enemy with the most other enemies within `radius` (best AoE target). */
export function densest(enemies, radius) {
  let best = null;
  let bestScore = -1;
  for (const e of enemies) {
    if (!onScreen(e)) continue;
    let score = e.boss ? 3 : 0;
    for (const o of enemies) if (o.alive && Math.abs(o.x - e.x) < radius) score++;
    if (score > bestScore || (score === bestScore && e.x < best.x)) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

/** Ballistic shot that leads a walking target, never past the point where it stops. */
export function leadShot(sx, sy, e, g, speed, minT, maxT, yFrac = 0.55) {
  const ty = e.y - e.h * yFrac;
  let shot = ballistic(sx, sy, e.x, ty, g, speed, minT, maxT);
  if (e.walking) {
    const tx = Math.max(e.x - e.speed * shot.t, e.stopX ?? 0);
    shot = ballistic(sx, sy, tx, ty, g, speed, minT, maxT);
  }
  return shot;
}
