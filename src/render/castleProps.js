import { GROUND_Y, WALL_TOP, TOWER_TOP, INK } from '../core/constants.js';
import { lerpColor } from '../utils/math.js';

/** Where each castle upgrade stands, for its fire point and the purchase sparkle. */
export const PROPS = {
  catapult: { x: 66, y: 232, arm: 62, tail: 22 },
  bell: { x: 153, y: 382 },
  beacon: { x: 134, y: 316 },
  stores: { x0: 16, x1: 116 },
};

const WOOD = '#6b4a2e';
const ROPE = '#c9b48a';
const BRONZE = '#c79a3e';

/** Rest (loaded) and released throwing-arm angles; 0 points right, the long end swings over. */
const ARM_REST = Math.PI * 0.86;
const ARM_THROWN = -Math.PI * 0.36;

/** Burç Mancınığı: a trebuchet on the keep. `throwK` runs 1 → 0 through a throw. */
export function drawCatapult(ctx, level, throwK, night) {
  const { x, y, arm, tail } = PROPS.catapult;
  const wood = lerpColor(WOOD, '#1c1820', 0.15 + night * 0.4);
  const dark = lerpColor(wood, '#000000', 0.3);
  // Whips over fast, then eases back down to be reloaded
  const swing = throwK > 0.6 ? (1 - throwK) / 0.4 : throwK / 0.6;
  const a = ARM_REST + (ARM_THROWN - ARM_REST) * swing * swing * (3 - 2 * swing);
  const tipX = x + Math.cos(a) * arm;
  const tipY = y + Math.sin(a) * arm;
  const tailX = x - Math.cos(a) * tail;
  const tailY = y - Math.sin(a) * tail;

  // Far A-frame leg
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 24, TOWER_TOP - 2);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 24, TOWER_TOP - 2);
  ctx.stroke();

  // Counterweight box hanging from the short end, level-dependent iron straps
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tailX, tailY + 7);
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.fillRect(tailX - 9, tailY + 7, 18, 14);
  ctx.fillStyle = level >= 10 ? '#8d929c' : 'rgba(0,0,0,0.35)';
  ctx.fillRect(tailX - 9, tailY + 11, 18, 2);
  ctx.fillRect(tailX - 9, tailY + 16, 18, 2);

  // Throwing arm with a sling and its stone
  ctx.strokeStyle = wood;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  if (throwK <= 0) {
    ctx.strokeStyle = ROPE;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX + 2, tipY + 13);
    ctx.stroke();
    ctx.fillStyle = '#4b4652';
    ctx.beginPath();
    ctx.arc(tipX + 2, tipY + 16, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Near A-frame leg, cross brace and axle
  ctx.strokeStyle = wood;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x - 30, TOWER_TOP);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 30, TOWER_TOP);
  ctx.moveTo(x - 18, y + 28);
  ctx.lineTo(x + 18, y + 28);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Where a stone leaves the sling. */
export function catapultMuzzle() {
  const { x, y, arm } = PROPS.catapult;
  return [x + Math.cos(ARM_THROWN) * arm, y + Math.sin(ARM_THROWN) * arm];
}

/** Savaş Çanı: a stone bell gable on the walkway. `ring` runs 1 → 0 after a strike. */
export function drawBell(ctx, stone, mortar, level, ring, t, gold) {
  const { x, y } = PROPS.bell;
  const pier = (px) => {
    ctx.fillStyle = stone;
    ctx.fillRect(px - 5, y - 16, 10, WALL_TOP - y + 16);
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(px - 5, y - 16, 3, WALL_TOP - y + 16);
    ctx.fillStyle = mortar;
    for (let py = y; py < WALL_TOP; py += 14) ctx.fillRect(px - 5, py, 10, 1);
  };
  // Headstock beam behind the piers
  ctx.fillStyle = '#3b2a1c';
  ctx.fillRect(x - 13, y - 8, 26, 5);
  pier(x - 15);
  pier(x + 15);

  // Peaked cap across both piers
  ctx.fillStyle = lerpColor(stone, '#ffffff', 0.12);
  ctx.beginPath();
  ctx.moveTo(x - 25, y - 15);
  ctx.lineTo(x, y - 37);
  ctx.lineTo(x + 25, y - 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath();
  ctx.moveTo(x - 25, y - 15);
  ctx.lineTo(x, y - 37);
  ctx.lineTo(x, y - 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = gold ? BRONZE : INK;
  ctx.beginPath();
  ctx.arc(x, y - 39, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // The bell rocks from its beam, and grows from Sv 10
  const s = level >= 10 ? 1.2 : 1;
  const rock = ring > 0 ? Math.sin(ring * 22) * ring * 0.55 : Math.sin(t * 0.8) * 0.02;
  ctx.save();
  ctx.translate(x, y - 4);
  ctx.rotate(rock);
  ctx.scale(s, s);
  ctx.fillStyle = BRONZE;
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.quadraticCurveTo(-7, 3, -7.5, 12);
  ctx.lineTo(-10, 18);
  ctx.lineTo(10, 18);
  ctx.lineTo(7.5, 12);
  ctx.quadraticCurveTo(7, 3, 3, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-10, 15, 20, 3);
  ctx.fillStyle = 'rgba(255,240,190,0.4)';
  ctx.fillRect(3, 4, 2, 9);
  ctx.fillStyle = '#2b2a33';
  ctx.beginPath();
  ctx.arc(0, 20, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sound rings while it tolls
  if (ring > 0) {
    ctx.strokeStyle = `rgba(255,226,150,${ring * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const k of [0.6, 1]) {
      const r = 18 + (1 - ring) * 60 * k;
      ctx.moveTo(x + r, y + 6);
      ctx.arc(x, y + 6, r, 0, Math.PI * 2);
    }
    ctx.stroke();
  }
}

/** Gözcü Ateşi: an iron cresset on a bracket off the keep; the fire grows with its level. */
export function drawBeacon(ctx, level, t, night, iron) {
  const { x, y } = PROPS.beacon;
  // Bracket
  ctx.strokeStyle = iron;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 2);
  ctx.lineTo(x, y);
  ctx.moveTo(x - 12, y + 18);
  ctx.lineTo(x - 1, y + 2);
  ctx.stroke();
  // Basket
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 11);
  ctx.lineTo(x - 5, y);
  ctx.lineTo(x + 5, y);
  ctx.lineTo(x + 9, y - 11);
  ctx.moveTo(x, y - 11);
  ctx.lineTo(x, y);
  ctx.moveTo(x - 7, y - 6);
  ctx.lineTo(x + 7, y - 6);
  ctx.stroke();

  const size = 1 + Math.min(level, 20) * 0.05;
  const flick = Math.sin(t * 12) * 1.5 + Math.sin(t * 7.7) * 1.2;
  const fy = y - 12;
  const g = ctx.createRadialGradient(x, fy - 8, 3, x, fy - 8, 60 * size);
  g.addColorStop(0, `rgba(255,190,90,${0.35 + night * 0.35})`);
  g.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - 64 * size, fy - 72 * size, 128 * size, 128 * size);
  flame(ctx, x, fy, 8 * size, 15 * size + flick, '#ff8f33');
  flame(ctx, x, fy, 5 * size, 10 * size + flick * 0.6, '#ffc35a');
  flame(ctx, x, fy, 2.5 * size, 5 * size, '#fff1b8');
}

export function flame(ctx, x, y, hw, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - hw, y);
  ctx.quadraticCurveTo(x - hw, y - h * 0.5, x, y - h);
  ctx.quadraticCurveTo(x + hw, y - h * 0.5, x + hw, y);
  ctx.quadraticCurveTo(x, y + hw * 0.5, x - hw, y);
  ctx.fill();
}

/** Erzak Ambarı: a lean-to at the keep's foot, filling up with barrels, sacks and crates. */
export function drawStores(ctx, level, night) {
  const { x0, x1 } = PROPS.stores;
  const wood = lerpColor(WOOD, '#1c1820', 0.15 + night * 0.4);
  const dark = lerpColor(wood, '#000000', 0.32);
  const top = GROUND_Y - 58;
  const g = GROUND_Y;

  // Shadowed back of the shed
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(x0, top + 5, x1 - x0, g - top - 5);

  // Goods, left to right as levels are bought
  const goods = [barrel, crate, sack, barrel, crate, sack, barrel];
  const shown = Math.min(goods.length, 1 + Math.floor(level / 3));
  for (let i = 0; i < shown; i++) goods[i](ctx, x0 + 12 + i * 13.5, g, wood, dark);
  if (level >= 15) {
    barrel(ctx, x0 + 18, g - 18, wood, dark);
    sack(ctx, x0 + 46, g - 15, wood, dark);
  }

  // Posts and sloped plank roof
  ctx.fillStyle = dark;
  ctx.fillRect(x0 - 2, top + 8, 4, g - top - 8);
  ctx.fillRect(x1 - 2, top + 16, 4, g - top - 16);
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(x0 - 8, top + 1);
  ctx.lineTo(x1 + 8, top + 13);
  ctx.lineTo(x1 + 8, top + 19);
  ctx.lineTo(x0 - 8, top + 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0 + 4; x < x1 + 8; x += 12) {
    const y = top + 1 + ((x - x0 + 8) / (x1 - x0 + 16)) * 12;
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 6);
  }
  ctx.stroke();
}

function barrel(ctx, x, g, wood, dark) {
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.ellipse(x, g - 10, 8, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(x - 8, g - 15, 16, 2);
  ctx.fillRect(x - 8, g - 6, 16, 2);
}

function crate(ctx, x, g, wood, dark) {
  ctx.fillStyle = wood;
  ctx.fillRect(x - 8, g - 16, 16, 16);
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x - 7, g - 15, 14, 14);
  ctx.beginPath();
  ctx.moveTo(x - 7, g - 15);
  ctx.lineTo(x + 7, g - 1);
  ctx.stroke();
}

function sack(ctx, x, g) {
  ctx.fillStyle = '#c7b48b';
  ctx.beginPath();
  ctx.moveTo(x - 8, g);
  ctx.quadraticCurveTo(x - 10, g - 12, x - 2, g - 15);
  ctx.lineTo(x + 2, g - 15);
  ctx.quadraticCurveTo(x + 10, g - 12, x + 8, g);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 3, g - 13, 6, 2);
}
