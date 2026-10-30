import { GROUND_Y } from '../core/constants.js';
import { flame } from './castleProps.js';

/** How broken a structure looks: 0 sound, 1 cracked, 2 breached, 3 burning. */
export function damageStage(ratio) {
  return ratio > 0.75 ? 0 : ratio > 0.5 ? 1 : ratio > 0.25 ? 2 : 3;
}

export function drawCracks(ctx, paths, count) {
  ctx.strokeStyle = 'rgba(8,6,10,0.75)';
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < count && i < paths.length; i++) {
    paths[i].forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  }
  ctx.stroke();
}

/** Blown-out hole: jagged dark interior, a lit lower lip and loose blocks around the rim. */
export function drawBreach(ctx, x, y, r, stone) {
  const outline = (scale) => {
    ctx.beginPath();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const rr = r * scale * (0.72 + ((i * 37 + Math.round(x)) % 10) / 20);
      if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.82);
      else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.82);
    }
    ctx.closePath();
  };
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  outline(1.28);
  ctx.fill();
  ctx.fillStyle = '#0d0b10';
  outline(1);
  ctx.fill();
  // Inner courses of the wall showing through
  ctx.save();
  outline(1);
  ctx.clip();
  ctx.fillStyle = 'rgba(120,110,105,0.2)';
  ctx.fillRect(x - r, y + r * 0.2, r * 0.8, r * 0.34);
  ctx.fillRect(x + r * 0.05, y - r * 0.28, r * 0.75, r * 0.34);
  ctx.restore();
  // Loose blocks hanging off the rim
  ctx.fillStyle = stone;
  for (let i = 0; i < 5; i++) {
    const a = i * 1.7 + x;
    ctx.fillRect(x + Math.cos(a) * r * 1.02 - 2.5, y + Math.sin(a) * r * 0.86 - 2, 5, 4);
  }
}

export function drawScorch(ctx, x, y, r, alpha) {
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, `rgba(10,8,10,${alpha})`);
  g.addColorStop(1, 'rgba(10,8,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A burning spot: glow on the stone and a three-layer flame. */
export function drawFire(ctx, x, y, s, t) {
  const flick = Math.sin(t * 13 + x) * 1.6 + Math.sin(t * 8.3 + x * 2) * 1.2;
  const g = ctx.createRadialGradient(x, y - 8, 2, x, y - 8, 44 * s);
  g.addColorStop(0, 'rgba(255,150,60,0.45)');
  g.addColorStop(1, 'rgba(255,110,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 46 * s, y - 54 * s, 92 * s, 92 * s);
  flame(ctx, x, y, 8 * s, 19 * s + flick, '#e8582a');
  flame(ctx, x, y, 5.5 * s, 13 * s + flick * 0.7, '#ffa43c');
  flame(ctx, x, y, 2.6 * s, 7 * s, '#fff1b8');
}

/** Heap of fallen blocks at the foot of a wall. pieces: [x, size, spin]. */
export function drawRubble(ctx, pieces, count, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < count && i < pieces.length; i++) {
    const [x, size, spin] = pieces[i];
    ctx.save();
    ctx.translate(x, GROUND_Y + 1 - size * 0.5);
    ctx.rotate(spin);
    ctx.fillRect(-size, -size * 0.65, size * 2, size * 1.3);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-size, -size * 0.65, size * 2, 1.5);
    ctx.fillStyle = color;
    ctx.restore();
  }
}

/** Clip to everything below a jagged broken skyline running from x0 to x1. */
export function clipBrokenTop(ctx, x0, x1, skyline) {
  ctx.beginPath();
  ctx.moveTo(x0, GROUND_Y + 10);
  skyline.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(x1, GROUND_Y + 10);
  ctx.closePath();
  ctx.clip();
}

/** Chunks and dust falling off a structure when it reaches a worse stage. */
export function crumble(effects, x, y, size, colors) {
  for (const color of colors) {
    effects.burst(x, y, Math.round(9 * size), {
      color, angleMin: -Math.PI * 0.9, angleMax: -Math.PI * 0.1,
      speedMin: 50, speedMax: 240 * Math.sqrt(size), sizeMin: 2.5, sizeMax: 5.5, lifeMin: 0.5, lifeMax: 1.1,
    });
  }
  effects.burst(x, y, Math.round(8 * size), {
    color: 'rgba(170,160,150,0.4)', angleMin: -Math.PI, angleMax: 0,
    speedMin: 10, speedMax: 60, lifeMin: 0.8, lifeMax: 1.5, gravity: -30, drag: 1.5, sizeMin: 8, sizeMax: 16, shrink: false,
  });
  effects.dust(x, GROUND_Y, 1.5 * size);
}
