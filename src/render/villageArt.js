import { GROUND_Y, INK } from '../core/constants.js';
import { lerp, lerpColor } from '../utils/math.js';
import { drawPosed, skeleton, walkLegs, walkArms } from './stick.js';
import { add, bump, clamp01, dirOf, dot, easeIn, easeInOut, easeOut, facing, keys, keys2, line, mix, mix2, off, poly, span, toward } from './anim.js';
import { garment } from '../units/kit.js';
import { CAMP_Y, DEPOT_X, MINE, MOUNTAIN_ROAD, ROAD_X0, villageTier } from '../config/village.js';
import { tr } from '../i18n/i18n.js';

/*
 * Village art. Every site follows the same rules so the village reads as one place:
 *  - it stands on its own plot on the shared ground line, facing the road;
 *  - it is painted from one palette (villageColors), only small details use the site's accent;
 *  - a sign at the plot's front-right corner names it and shows its level, with a lantern
 *    that lights up at night;
 *  - at the VILLAGE_TIERS levels it gains props, then a pennant, then a gold-rimmed sign;
 *  - an unbuilt plot is staked out with a faint outline of what will stand there.
 */
const G = GROUND_Y;

/** One palette for every village building, tinted toward the scenery by the time of day. */
export function villageColors(pal, night) {
  const tint = (hex, k) => lerpColor(hex, pal.near, k + night * 0.3);
  return {
    pal,
    night,
    wood: tint('#6b4a2e', 0.3),
    darkWood: lerpColor('#3b2a1c', pal.near, 0.3),
    plaster: tint('#d8c6a3', 0.28),
    roof: tint('#8a3f2e', 0.22),
    barn: tint('#9a4630', 0.25),
    rock: tint('#6f737d', 0.3),
    stone: tint('#a7abb4', 0.28),
    soil: lerpColor('#785833', pal.ground, night * 0.42),
    road: lerpColor('#8a6f4c', pal.ground, 0.35 + night * 0.35),
    leaf: tint('#3d6b45', 0.22),
    window: night > 0.25 ? `rgba(255,196,100,${0.35 + 0.6 * night})` : 'rgba(0,0,0,0.38)',
  };
}

// ---- shared pieces -------------------------------------------------------------

/** The one road every worker walks, from the far plots to the depot cart. */
export function drawRoad(ctx, c) {
  const x0 = ROAD_X0;
  const x1 = DEPOT_X + 34;
  ctx.fillStyle = c.road;
  ctx.beginPath();
  ctx.moveTo(x0, G - 2);
  ctx.lineTo(x1, G - 2);
  ctx.lineTo(x1 + 16, G + 9);
  ctx.lineTo(x0 - 6, G + 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,28,20,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, G + 2);
  ctx.lineTo(x1, G + 2);
  ctx.moveTo(x0, G + 6);
  ctx.lineTo(x1 + 6, G + 6);
  ctx.stroke();
  ctx.fillStyle = 'rgba(232,214,186,0.24)';
  for (let x = x0 + 7; x < x1; x += 23) ctx.fillRect(x, G + 3 + (x * 7 % 4 + 4) % 4, 2, 1.2);
}

function drawLantern(ctx, c, x, y) {
  if (c.night > 0.1) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, 24);
    g.addColorStop(0, `rgba(255,190,90,${0.5 * c.night})`);
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 24, y - 24, 48, 48);
  }
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(x - 3, y - 4.5, 6, 1.5);
  ctx.fillRect(x - 2.5, y + 3, 5, 1.5);
  ctx.fillStyle = c.night > 0.1 ? `rgba(255,214,128,${0.6 + 0.4 * c.night})` : 'rgba(255,226,170,0.55)';
  ctx.fillRect(x - 2, y - 3, 4, 6);
}

function drawPennant(ctx, c, x, y, color, t) {
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 16);
  ctx.stroke();
  const wave = Math.sin(t * 3 + x) * 1.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x + 11, y - 13 + wave);
  ctx.lineTo(x, y - 10);
  ctx.closePath();
  ctx.fill();
}

/** Front-right sign: site name, level badge and a lantern on the post (up on the ledge for the camp). */
function drawSign(ctx, c, site, level) {
  const x1 = site.plot[1];
  const lift = site.mountain ? CAMP_Y : 0;
  ctx.font = '800 7px Nunito, sans-serif';
  const textW = ctx.measureText(site.label).width;
  const bx1 = x1 - 2;
  const bx0 = bx1 - textW - 22;
  const by = G - 27 - lift;
  const bh = 12;
  const px = bx1 - 3;
  const gold = villageTier(level) >= 3;

  ctx.fillStyle = c.darkWood;
  ctx.fillRect(px - 1.5, by - 9, 3, G - lift - by + 9);
  drawLantern(ctx, c, px, by - 12);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(bx0 + 1, by + 2, bx1 - bx0, bh);
  ctx.fillStyle = gold ? '#d6a838' : c.darkWood;
  ctx.fillRect(bx0 - 1, by - 1, bx1 - bx0 + 2, bh + 2);
  ctx.fillStyle = c.wood;
  ctx.fillRect(bx0, by, bx1 - bx0, bh);
  ctx.fillStyle = site.accent;
  ctx.fillRect(bx0, by, 2.5, bh);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = level ? '#f1e2c0' : 'rgba(241,226,192,0.55)';
  ctx.fillText(site.label, bx0 + 5, by + bh / 2 + 0.5);

  const cx = bx1 - 7.5;
  const cy = by + bh / 2;
  ctx.fillStyle = level ? site.accent : '#5d544c';
  ctx.beginPath();
  ctx.arc(cx, cy, 5.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = level ? '#2a1d12' : '#cbbfae';
  ctx.font = `900 ${level >= 100 ? 4.6 : 6}px Nunito, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(level ? String(level) : '–', cx, cy + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Packed earth under a working site. */
function drawPad(ctx, c, site) {
  const [x0, x1] = site.plot;
  ctx.fillStyle = lerpColor(c.soil, c.pal.groundTop, 0.55);
  ctx.beginPath();
  ctx.ellipse((x0 + x1) / 2, G - 1, (x1 - x0) / 2 + 4, 4, 0, Math.PI, 0);
  ctx.fill();
}

/** Staked-out plot with a faint outline of the building to come. */
function drawEmptyPlot(ctx, c, site, t) {
  const [x0, x1] = site.plot;
  ctx.save();
  ctx.globalAlpha = 0.14;
  SITE_ART[site.key](ctx, c, site, 1, t, null);
  ctx.restore();
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let x = x0; x <= x1 - 50; x += 17) {
    ctx.moveTo(x, G + 1);
    ctx.lineTo(x, G - 12);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,214,170,0.55)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x0, G - 9);
  ctx.lineTo(x1 - 50, G - 9);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Draws one site on its plot: the building (or an empty plot) and its sign. */
export function drawSite(ctx, c, site, level, t, village) {
  ctx.save();
  if (site.mountain) {
    // The camp's ledge and road are part of the mountain; an unbuilt camp is only a faint outline
    if (!level) ctx.globalAlpha = 0.18;
    SITE_ART[site.key](ctx, c, site, Math.max(1, level), t, village);
  } else if (level) {
    drawPad(ctx, c, site);
    SITE_ART[site.key](ctx, c, site, level, t, village);
  } else {
    drawEmptyPlot(ctx, c, site, t);
  }
  ctx.restore();
  drawSign(ctx, c, site, level);
}

// ---- farm -------------------------------------------------------------------

function drawField(ctx, c, fx0, fx1, lvl, t) {
  const backY = G - 37;
  const rows = Math.min(5, 3 + Math.floor((lvl - 1) / 3));
  const rowGap = Math.min(8, 34 / rows);
  const cropStep = Math.max(7, 8.8 - lvl * 0.16);
  const pal = c.pal;
  const ripe = lerpColor('#d4ad46', pal.near, 0.25 + c.night * 0.45);

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx0, G - 80, fx1 - fx0, 83);
  ctx.clip();
  const bed = ctx.createLinearGradient(0, backY, 0, G);
  bed.addColorStop(0, lerpColor(c.soil, '#aa8245', 0.18));
  bed.addColorStop(1, c.soil);
  ctx.fillStyle = bed;
  ctx.fillRect(fx0, backY + 2, fx1 - fx0, G - backY);

  // Irrigation runnel along the back of the field
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(fx0 + 2, backY + 4);
  ctx.lineTo(fx1 - 2, backY + 4);
  ctx.stroke();
  ctx.strokeStyle = lerpColor('#477b91', pal.near, c.night * 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = lerpColor('#a98550', pal.grass, 0.55 + c.night * 0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let row = 0; row < rows; row++) {
    const y = G - 6 - row * 5;
    ctx.moveTo(fx0 + 2, y);
    ctx.quadraticCurveTo((fx0 + fx1) / 2, y + 1, fx1 - 2, y - 1);
  }
  ctx.stroke();

  // Wheat gains height and a little density with each level
  for (let row = rows - 1; row >= 0; row--) {
    const depth = 1 - row / Math.max(1, rows - 1);
    const baseY = G - 5 - row * rowGap;
    const stemH = 8 + Math.min(8, lvl * 0.8) + depth * 4;
    const swayPhase = t * 1.5 + row * 0.9;
    const firstCropX = fx0 + 5 + (row % 2) * (cropStep / 2);
    const cropCount = Math.ceil((fx1 - 2 - firstCropX) / cropStep);
    const isRipe = (i) => (i + row * 2) % 4 !== 0;
    ctx.lineWidth = 1.35;
    for (const ripeCrop of [false, true]) {
      ctx.strokeStyle = ripeCrop ? lerpColor('#92733d', ripe, 0.32) : lerpColor('#63794d', pal.grass, c.night * 0.18);
      ctx.beginPath();
      for (let i = 0; i < cropCount; i++) {
        if (isRipe(i) !== ripeCrop) continue;
        const x = firstCropX + i * cropStep;
        const sway = Math.sin(swayPhase + x * 0.08) * 1.25;
        const h = stemH * (0.86 + 0.14 * Math.sin(x * 1.7 + row));
        ctx.moveTo(x, baseY);
        ctx.lineTo(x + sway, baseY - h);
        ctx.moveTo(x + sway * 0.42, baseY - h * 0.44);
        ctx.lineTo(x - 2, baseY - h * 0.56);
      }
      ctx.stroke();
      ctx.fillStyle = ripeCrop ? ripe : lerpColor('#718b55', pal.grass, c.night * 0.16);
      ctx.beginPath();
      for (let i = 0; i < cropCount; i++) {
        if (isRipe(i) !== ripeCrop) continue;
        const x = firstCropX + i * cropStep;
        const sway = Math.sin(swayPhase + x * 0.08) * 1.25;
        const h = stemH * (0.86 + 0.14 * Math.sin(x * 1.7 + row));
        ctx.ellipse(x + sway, baseY - h, ripeCrop ? 1.25 : 0.9, ripeCrop ? 2 : 1.4, -0.35, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  ctx.restore();

  // Scarecrow keeping watch at the back of the field
  const sx = (fx0 + fx1) / 2 - 6;
  const sy = backY + 2;
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx, sy - 28);
  ctx.moveTo(sx - 10, sy - 20);
  ctx.lineTo(sx + 10, sy - 20 + Math.sin(t * 2) * 1.5);
  ctx.stroke();
  ctx.fillStyle = c.wood;
  ctx.beginPath();
  ctx.arc(sx, sy - 31, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b08a3a';
  ctx.fillRect(sx - 6, sy - 35, 12, 2);
}

function drawFarm(ctx, c, site, level, t) {
  const [x0, x1] = site.plot;
  const tier = villageTier(level);
  drawField(ctx, c, x0 + 40, x1 - 2, level, t);

  // Barn
  const bx = x0 + 2;
  const bw = 34;
  const wallH = 28;
  const roofH = 15;
  ctx.fillStyle = c.barn;
  ctx.fillRect(bx, G - wallH, bw, wallH);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(bx, G - wallH, 6, wallH);
  ctx.fillStyle = c.darkWood;
  ctx.beginPath();
  ctx.moveTo(bx - 4, G - wallH + 1);
  ctx.lineTo(bx + bw / 2, G - wallH - roofH);
  ctx.lineTo(bx + bw + 4, G - wallH + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.window;
  ctx.fillRect(bx + bw / 2 - 3, G - wallH - 8, 6, 6);
  // Double door with a cross brace
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(bx + 10, G - 17, 14, 17);
  ctx.strokeStyle = c.plaster;
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 10.5, G - 16.5, 13, 16.5);
  ctx.beginPath();
  ctx.moveTo(bx + 10.5, G - 16.5);
  ctx.lineTo(bx + 23.5, G);
  ctx.moveTo(bx + 23.5, G - 16.5);
  ctx.lineTo(bx + 10.5, G);
  ctx.stroke();
  if (tier >= 2) drawPennant(ctx, c, bx + bw / 2, G - wallH - roofH, site.accent, t);

  // Hay bales pile up beside the barn door
  ctx.fillStyle = lerpColor('#d1a94a', c.pal.near, 0.25 + c.night * 0.35);
  const bales = [[bx + 4, G - 3.5], [bx + 30, G - 3.5], [bx + 4, G - 10]].slice(0, tier);
  for (const [hx, hy] of bales) {
    ctx.beginPath();
    ctx.ellipse(hx, hy, 4, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hens scratching about in front of the barn (they roost at night)
  if (c.night < 0.6) {
    const hens = [[bx + 12, 0], [bx + 21, 2.1], [bx + 40, 4.3]].slice(0, 1 + Math.min(2, tier));
    for (const [hx0, seed] of hens) drawHen(ctx, c, hx0 + Math.sin(t * 0.4 + seed) * 5, t + seed, Math.cos(t * 0.4 + seed) > 0 ? 1 : -1);
  }
}

/** A hen pecking at the ground now and then, tail up, comb and wattle red. */
function drawHen(ctx, c, x, t, f) {
  const peckT = (t * 0.9) % 1;
  const peck = peckT > 0.7 ? Math.sin(((peckT - 0.7) / 0.3) * Math.PI) : 0;
  const body = lerpColor('#efe6d4', c.pal.near, 0.2 + c.night * 0.4);
  const y = G - 4;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y, 3.6, 2.6, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - f * 2.5, y - 1);
  ctx.lineTo(x - f * 5, y - 4.5);
  ctx.lineTo(x - f * 3.5, y + 0.5);
  ctx.fill();
  // Head bobs down to peck
  const hx = x + f * (3 + peck * 1.5);
  const hy = y - 3.2 + peck * 4;
  ctx.beginPath();
  ctx.arc(hx, hy, 1.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c8312b';
  ctx.fillRect(hx - 0.6, hy - 2.2, 1.2, 1);
  ctx.fillStyle = '#e2a23c';
  ctx.beginPath();
  ctx.moveTo(hx + f * 1.3, hy - 0.4);
  ctx.lineTo(hx + f * 2.8, hy + 0.2);
  ctx.lineTo(hx + f * 1.3, hy + 0.6);
  ctx.fill();
  ctx.strokeStyle = '#c99a3c';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x - 0.8, y + 2);
  ctx.lineTo(x - 0.8, G);
  ctx.moveTo(x + 0.8, y + 2);
  ctx.lineTo(x + 0.8, G);
  ctx.stroke();
}

// ---- mill --------------------------------------------------------------------

function drawMill(ctx, c, site, level, t) {
  const [x0, x1] = site.plot;
  const tier = villageTier(level);
  const mx = x0 + 32;
  const top = G - 70;

  // Granary shed beside the tower
  const sx0 = x0 + 58;
  const sx1 = x1 - 8;
  ctx.fillStyle = c.plaster;
  ctx.fillRect(sx0, G - 22, sx1 - sx0, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(sx0, G - 22, 5, 22);
  ctx.fillStyle = c.roof;
  ctx.beginPath();
  ctx.moveTo(sx0 - 3, G - 21);
  ctx.lineTo(sx0 + 6, G - 32);
  ctx.lineTo(sx1 + 3, G - 32);
  ctx.lineTo(sx1 + 3, G - 21);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.window;
  ctx.fillRect(sx0 + 8, G - 16, 6, 6);

  // Tower and cap
  ctx.fillStyle = c.plaster;
  ctx.beginPath();
  ctx.moveTo(mx - 17, G);
  ctx.lineTo(mx - 11, top);
  ctx.lineTo(mx + 11, top);
  ctx.lineTo(mx + 17, G);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath();
  ctx.moveTo(mx - 17, G);
  ctx.lineTo(mx - 11, top);
  ctx.lineTo(mx - 4, top);
  ctx.lineTo(mx - 7, G);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.roof;
  ctx.beginPath();
  ctx.moveTo(mx - 14, top + 2);
  ctx.lineTo(mx, top - 15);
  ctx.lineTo(mx + 14, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.darkWood;
  ctx.beginPath();
  ctx.moveTo(mx - 5, G);
  ctx.lineTo(mx - 5, G - 10);
  ctx.arc(mx, G - 10, 5, Math.PI, 0);
  ctx.lineTo(mx + 5, G);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = c.window;
  ctx.fillRect(mx - 3, G - 46, 6, 7);
  if (tier >= 2) drawPennant(ctx, c, mx, top - 15, site.accent, t);

  // Lattice sails turn faster as the mill grows
  const hubX = mx;
  const hubY = top - 1;
  const rot = t * (0.5 + tier * 0.25);
  for (let i = 0; i < 4; i++) {
    const a = rot + (i * Math.PI) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = -sa * 7;
    const py = ca * 7;
    ctx.fillStyle = 'rgba(236,226,204,0.82)';
    ctx.beginPath();
    ctx.moveTo(hubX + ca * 9, hubY + sa * 9);
    ctx.lineTo(hubX + ca * 36, hubY + sa * 36);
    ctx.lineTo(hubX + ca * 36 + px, hubY + sa * 36 + py);
    ctx.lineTo(hubX + ca * 9 + px, hubY + sa * 9 + py);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = c.darkWood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hubX, hubY);
    ctx.lineTo(hubX + ca * 37, hubY + sa * 37);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const d of [18, 27]) {
      ctx.moveTo(hubX + ca * d, hubY + sa * d);
      ctx.lineTo(hubX + ca * d + px, hubY + sa * d + py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = c.darkWood;
  ctx.beginPath();
  ctx.arc(hubX, hubY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Flour sacks stack up by the shed
  const sacks = Math.min(7, 2 + Math.floor(level / 3));
  for (let i = 0; i < sacks; i++) {
    const row = i < 4 ? 0 : 1;
    const x = x0 + 52 + (i % 4) * 8 + row * 4;
    const y = G - 5 - row * 9;
    ctx.fillStyle = lerpColor('#e9e1cf', c.pal.near, 0.15 + c.night * 0.35);
    ctx.beginPath();
    ctx.ellipse(x, y, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(x - 3, y - 5.5, 6, 1.6);
  }
}

// ---- lumber camp --------------------------------------------------------------

/** Pine whose upper tiers lean further in the wind. */
function drawPine(ctx, c, x, base, k, t = 0) {
  const gust = Math.sin(t * 1.1 + x * 0.05) * 0.6 + Math.sin(t * 2.3 + x) * 0.25;
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(x - 2.2 * k, base - 12 * k, 4.4 * k, 12 * k);
  ctx.fillStyle = c.leaf;
  [[20, 10, 34], [16, 26, 50], [11, 42, 66]].forEach(([w, y0, y1], i) => {
    const lean = gust * (i + 1) * k;
    ctx.beginPath();
    ctx.moveTo(x - w * k + lean * 0.5, base - y0 * k);
    ctx.lineTo(x + lean * 1.4, base - y1 * k - 6 * k);
    ctx.lineTo(x + w * k + lean * 0.5, base - y0 * k);
    ctx.closePath();
    ctx.fill();
  });
  // shaded side
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath();
  ctx.moveTo(x + gust * 4.2 * k, base - 72 * k);
  ctx.lineTo(x - 20 * k, base - 10 * k);
  ctx.lineTo(x, base - 10 * k);
  ctx.closePath();
  ctx.fill();
}

// ---- mountain ----------------------------------------------------------------
//
// West of the road's end the land climbs into a wooded mountainside. A switchback road
// leads up its face to a ledge where the lumber camp works the forest.

/** Top edge of the mountain: [x, height above the road]. */
const MOUNTAIN = [[-944, -2], [-958, 10], [-975, 30], [-1000, 58], [-1040, 90], [-1090, 112], [-1150, 128], [-1210, 140], [-1340, 156]];
const LEDGE = { x0: -1260, x1: -1092 };
/** Pines on the mountainside: [x, height above the road where the trunk stands, scale]. */
const SLOPE_PINES = [
  [-1232, 142, 0.85], [-1175, 130, 0.8], [-1205, 134, 0.7], [-1145, 124, 0.66], [-1118, 117, 0.74], [-1080, 104, 0.6],
  [-1062, 95, 0.68], [-1020, 70, 0.58], [-985, 38, 0.52], [-1035, 16, 0.5], [-1075, 36, 0.56], [-1150, 26, 0.6],
  [-1205, 40, 0.66], [-1240, 30, 0.7], [-1122, 50, 0.48],
];

/** The road up the mountain: along the ledge, then the switchbacks down to the village road. */
const mountainPath = () => [[LEDGE.x0 + 30, G - CAMP_Y], ...MOUNTAIN_ROAD.map(([x, h]) => [x, G - h])];

function strokePath(ctx, pts, dy = 0) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy)));
  ctx.stroke();
}

/** The mountainside with its forest, the camp ledge and the switchback road. Always drawn. */
export function drawMountain(ctx, c, t) {
  const face = lerpColor(c.leaf, c.rock, 0.45);
  const g = ctx.createLinearGradient(0, G - 160, 0, G);
  g.addColorStop(0, lerpColor(face, '#ffffff', 0.05));
  g.addColorStop(1, lerpColor(face, '#000000', 0.22));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(MOUNTAIN[0][0], G + 2);
  for (const [x, h] of MOUNTAIN) ctx.lineTo(x, G - h);
  ctx.lineTo(MOUNTAIN[MOUNTAIN.length - 1][0], G + 2);
  ctx.closePath();
  ctx.fill();
  // Bare rock showing through the turf
  ctx.fillStyle = lerpColor(c.rock, face, 0.35);
  for (const [x, h, w] of [[-990, 30, 14], [-1060, 70, 18], [-1180, 108, 20], [-1135, 66, 12], [-1028, 44, 10]]) {
    poly(ctx, [[x - w, G - h + 6], [x - w * 0.4, G - h - 4], [x + w * 0.5, G - h - 2], [x + w, G - h + 7]], ctx.fillStyle);
  }
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = lerpColor(face, c.pal.sun ?? '#ffffff', 0.35);
  ctx.lineWidth = 1.5;
  strokePath(ctx, MOUNTAIN.map(([x, h]) => [x, G - h + 1]));
  ctx.restore();

  // Forest behind the ledge
  for (const [x, h, k] of SLOPE_PINES) if (h >= 90) drawPine(ctx, c, x, G - h, k, t);

  // The ledge: a flat terrace of packed earth with a grassy lip and a low cliff under it
  const ly = G - CAMP_Y;
  poly(ctx, [[LEDGE.x0, ly - 3], [LEDGE.x1, ly - 3], [LEDGE.x1 + 7, ly + 3], [LEDGE.x1 - 2, ly + 15], [LEDGE.x0, ly + 18]], lerpColor(c.rock, face, 0.55));
  poly(ctx, [[LEDGE.x0, ly - 3], [LEDGE.x1, ly - 3], [LEDGE.x1 + 5, ly + 2], [LEDGE.x0, ly + 3]], c.soil);
  line(ctx, [LEDGE.x0, ly - 3], [LEDGE.x1 + 1, ly - 3], lerpColor(c.leaf, '#ffffff', 0.12), 1.6);

  // Switchback road: a shadowed edge under a worn dirt track, ruts, and fence posts on the bends
  const path = mountainPath();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(20,14,10,0.35)';
  ctx.lineWidth = 9;
  strokePath(ctx, path, 3);
  ctx.strokeStyle = c.road;
  ctx.lineWidth = 8;
  strokePath(ctx, path);
  ctx.strokeStyle = 'rgba(40,28,20,0.3)';
  ctx.lineWidth = 0.8;
  strokePath(ctx, path, -1.5);
  strokePath(ctx, path, 1.5);
  ctx.fillStyle = c.darkWood;
  for (const [x, h] of [[-1050, 64], [-995, 44], [-1010, 22]]) {
    for (const k of [-6, 0, 6]) ctx.fillRect(x + k - 0.8, G - h + 2, 1.6, 6);
    line(ctx, [x - 7, G - h + 3], [x + 7, G - h + 3], c.darkWood, 1);
  }

  // Forest below the camp, in front of the road's upper bends
  for (const [x, h, k] of SLOPE_PINES) if (h < 90) drawPine(ctx, c, x, G - h, k, t);

  // Signpost where the mountain road leaves the village road
  const sx = ROAD_X0 - 4;
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(sx - 1, G - 20, 2, 20);
  poly(ctx, [[sx - 13, G - 20], [sx + 1, G - 20], [sx + 1, G - 13], [sx - 13, G - 13], [sx - 16, G - 16.5]], c.wood);
  ctx.fillStyle = '#f1e2c0';
  ctx.font = '800 4.4px Nunito, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tr('ORMAN'), sx - 7, G - 16.3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** A standing pine a lumberjack is felling: a notch in the trunk, shaking when the axe bites. */
function drawWorkTree(ctx, c, x, base, hit, t) {
  const shake = hit ? Math.sin(t * 70) * 1.6 : 0;
  ctx.save();
  ctx.translate(x, base);
  ctx.rotate(shake * 0.012);
  ctx.translate(-x, -base);
  drawPine(ctx, c, x + shake * 0.5, base, 0.62, t);
  ctx.restore();
  // Fresh notch on the side facing the camp (the axe comes from the east)
  ctx.fillStyle = lerpColor('#c9a26a', c.pal.near, 0.25 + c.night * 0.3);
  poly(ctx, [[x + 1.4, base - 8], [x - 0.6, base - 6], [x + 1.4, base - 4]], ctx.fillStyle);
  if (hit) {
    ctx.fillStyle = c.leaf;
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.3 + i * 0.25) % 1;
      ctx.fillRect(x - 8 + i * 5 + Math.sin(t * 5 + i) * 2, base - 34 + k * 30, 1.4, 1.4);
    }
  }
}

/** The lumber camp on the mountain ledge: cabin, sawhorse, log pile and the trees being felled. */
function drawLumber(ctx, c, site, level, t, village) {
  const tier = villageTier(level);
  const ly = G - CAMP_Y;

  // Log cabin at the back of the ledge, smoke from the chimney
  const cx0 = LEDGE.x0 + 2;
  const cw = 30;
  ctx.fillStyle = c.wood;
  ctx.fillRect(cx0, ly - 20, cw, 20);
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 4; k < 20; k += 4) {
    ctx.moveTo(cx0, ly - k);
    ctx.lineTo(cx0 + cw, ly - k);
  }
  ctx.stroke();
  for (let k = 2; k < 20; k += 4) {
    dot(ctx, [cx0 + cw, ly - k], 1.8, lerpColor('#c9a26a', c.pal.near, 0.3 + c.night * 0.3));
  }
  poly(ctx, [[cx0 - 4, ly - 19], [cx0 + cw / 2, ly - 32], [cx0 + cw + 4, ly - 19]], c.roof);
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(cx0 + 20, ly - 32, 4, 9);
  ctx.fillRect(cx0 + 5, ly - 12, 7, 12);
  ctx.fillStyle = c.window;
  ctx.fillRect(cx0 + 17, ly - 15, 6, 5);
  ctx.fillStyle = 'rgba(215,215,220,0.3)';
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.35 + i / 4) % 1;
    ctx.beginPath();
    ctx.arc(cx0 + 22 + k * 10 + Math.sin(t + i) * 2, ly - 34 - k * 26, 2 + k * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sawhorse with a log half cut, and the log pile growing with the level
  const sx = LEDGE.x1 - 34;
  line(ctx, [sx - 6, ly], [sx - 2, ly - 9], c.darkWood, 1.6);
  line(ctx, [sx + 6, ly], [sx + 2, ly - 9], c.darkWood, 1.6);
  ctx.fillStyle = c.wood;
  ctx.fillRect(sx - 12, ly - 12, 24, 4);
  line(ctx, [sx + 3, ly - 15], [sx + 9, ly - 6], cloth(c, '#c9ced6', 0.05), 1);
  const logs = Math.min(10, 3 + Math.floor(level / 2));
  const face = lerpColor('#c9a26a', c.pal.near, 0.3 + c.night * 0.3);
  let n = 0;
  for (let row = 0; row < 4 && n < logs; row++) {
    for (let i = 0; i < 4 - row && n < logs; i++, n++) {
      const lx = LEDGE.x1 - 22 + i * 6 + row * 3;
      const lyy = ly - 3 - row * 5;
      dot(ctx, [lx, lyy], 3, c.wood);
      dot(ctx, [lx, lyy], 2, face);
    }
  }
  if (tier >= 2) drawPennant(ctx, c, cx0 + cw / 2, ly - 32, site.accent, t);

  // One standing tree per lumberjack, where he swings
  for (const w of village?.workers.lumber ?? []) {
    const k = frac(w.phase);
    drawWorkTree(ctx, c, w.homeX - 17, ly, w.state === 'work' && k > 0.66 && k < 0.8, t);
  }
}

// ---- mine --------------------------------------------------------------------
//
// The mine is worked from a shaft at the foot of the outcrop. Below the road the ground is
// cut away to show the gallery: diggers at the rock face, timber props, lanterns, and the
// hoist bucket riding the shaft up to the windlass, where the ore is heaped for the haulers.

/** Where the hoist bucket hangs: k = 0 at the gallery floor, 1 just above the shaft collar. */
const bucketY = (k) => mix(G + MINE.floor - 9, G - 15, k);

/** Cutaway of the gallery dug under the road. */
function drawGallery(ctx, c, tier, t, village) {
  const { x0, x1, shaftX } = MINE;
  const top = G + MINE.top;
  const bot = G + MINE.floor + 3;
  // Rough-hewn cavity
  const outline = [[x0 + 4, top + 6], [x0 + 22, top + 1], [x0 + 50, top + 3], [x0 + 80, top], [x1 - 14, top + 2], [x1, top + 8],
    [x1 + 2, bot - 6], [x1 - 6, bot], [x0 + 60, bot + 2], [x0 + 8, bot], [x0, bot - 8]];
  poly(ctx, outline, 'rgba(10,8,12,0.55)', null);
  ctx.save();
  ctx.beginPath();
  outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#231b20');
  g.addColorStop(1, '#14101a');
  ctx.fillStyle = g;
  ctx.fillRect(x0 - 4, top - 4, x1 - x0 + 10, bot - top + 10);
  // Lantern light pooling on the walls
  ctx.globalCompositeOperation = 'lighter';
  for (const lx of [x0 + 40, x1 - 30]) {
    const flick = 0.85 + 0.15 * Math.sin(t * 9 + lx);
    const lg = ctx.createRadialGradient(lx, top + 12, 2, lx, top + 12, 40 * flick);
    lg.addColorStop(0, 'rgba(255,190,100,0.32)');
    lg.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(lx - 44, top - 30, 88, 90);
  }
  ctx.globalCompositeOperation = 'source-over';
  // The rock face the diggers work, veined with gold
  poly(ctx, [[x0 - 2, top], [x0 + 12, top + 4], [x0 + 9, top + 18], [x0 + 15, top + 30], [x0 + 10, bot], [x0 - 2, bot]], lerpColor('#5a5560', c.pal.near, 0.15));
  for (const [dx, dy] of [[6, 12], [10, 24], [4, 33], [12, 8]]) {
    const glint = 0.55 + 0.45 * Math.sin(t * 3 + dy);
    ctx.fillStyle = `rgba(240,200,90,${glint})`;
    ctx.fillRect(x0 + dx, top + dy, 3, 1.4);
  }
  // Rails along the floor and a parked ore cart at the far end
  line(ctx, [x0 + 30, bot - 2.5], [x1 - 4, bot - 2.5], 'rgba(150,150,160,0.6)', 0.8);
  for (let x = x0 + 32; x < x1 - 4; x += 6) ctx.fillRect(x, bot - 3, 1.6, 2);
  const cx = x1 - 16;
  poly(ctx, [[cx - 8, bot - 12], [cx + 8, bot - 12], [cx + 6, bot - 5], [cx - 6, bot - 5]], '#3b2a1c');
  for (let i = 0; i <= Math.min(3, tier); i++) dot(ctx, [cx - 5 + i * 3.5, bot - 12.5 - (i % 2)], 2.2, '#e7c56c');
  dot(ctx, [cx - 4, bot - 4], 1.8, INK);
  dot(ctx, [cx + 4, bot - 4], 1.8, INK);
  // Timber props holding up the roof, lanterns hung from the beams
  for (const px of [x0 + 40, x1 - 30]) {
    ctx.fillStyle = '#5a3b22';
    ctx.fillRect(px - 9, top + 1, 2.5, bot - top);
    ctx.fillRect(px + 7, top + 1, 2.5, bot - top);
    ctx.fillRect(px - 11, top, 22, 3);
    line(ctx, [px, top + 3], [px, top + 8], '#2a1d12', 0.7);
    ctx.fillStyle = `rgba(255,214,128,${0.75 + 0.2 * Math.sin(t * 9 + px)})`;
    ctx.fillRect(px - 1.5, top + 8, 3, 4);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();

  // The shaft from the collar down through the road to the gallery, a ladder down one side
  ctx.fillStyle = '#16111a';
  ctx.fillRect(shaftX - 6, G - 1, 12, top - G + 6);
  ctx.strokeStyle = '#6b4a2e';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(shaftX - 5, G);
  ctx.lineTo(shaftX - 5, bot - 2);
  ctx.moveTo(shaftX - 1.5, G);
  ctx.lineTo(shaftX - 1.5, bot - 2);
  for (let y = G + 4; y < bot - 2; y += 5) {
    ctx.moveTo(shaftX - 5, y);
    ctx.lineTo(shaftX - 1.5, y);
  }
  ctx.stroke();
  for (const y of [G + 14, G + 30]) {
    ctx.fillStyle = '#5a3b22';
    ctx.fillRect(shaftX - 7, y, 14, 2);
  }
  const k = village?.hoist.k ?? 0;
  const by = bucketY(k);
  line(ctx, [shaftX + 2, G - 24], [shaftX + 2, by], 'rgba(200,180,140,0.8)', 0.8);
  drawBucket(ctx, shaftX + 2, by, village?.hoist.up && village.hoist.busy);
}

/** The hoist bucket, heaped with ore on the way up. */
function drawBucket(ctx, x, y, laden) {
  poly(ctx, [[x - 4, y], [x + 4, y], [x + 3, y + 6], [x - 3, y + 6]], '#4a3a2c', INK, 0.6);
  line(ctx, [x - 4, y], [x, y - 3], 'rgba(160,160,170,0.8)', 0.6);
  line(ctx, [x + 4, y], [x, y - 3], 'rgba(160,160,170,0.8)', 0.6);
  if (laden) {
    dot(ctx, [x - 1.5, y - 0.5], 1.8, '#7d6a4a');
    dot(ctx, [x + 1.5, y - 1], 1.8, '#8a7a5a');
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x - 0.5, y - 2, 1.2, 1.2);
  }
}

/** Collar, windlass and the ore heap at the top of the shaft. */
function drawShaftHead(ctx, c, t, village) {
  const x = MINE.shaftX;
  const h = village?.hoist ?? { busy: false, up: false };
  // Ore heaped beside the shaft for the haulers
  const pile = village?.orePile ?? 2;
  if (pile > 0) {
    const w = 5 + pile * 1.6;
    ctx.fillStyle = cloth(c, '#7d6a4a');
    ctx.beginPath();
    ctx.ellipse(x + 11, G, w, 2 + pile * 1.3, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    for (let i = 0; i < pile; i++) ctx.fillRect(x + 8 + i * 1.8, G - 1.5 - (i % 2) * 2.5, 1.3, 1.3);
  }
  // Plank collar round the hole
  ctx.fillStyle = c.wood;
  ctx.fillRect(x - 10, G - 2, 4, 3);
  ctx.fillRect(x + 6, G - 2, 4, 3);
  // Windlass frame: two legs each side, a drum, and a crank that turns while the bucket rides
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(x + side * 12, G);
    ctx.lineTo(x + side * 8, G - 26);
    ctx.lineTo(x + side * 4, G);
  }
  ctx.stroke();
  ctx.fillStyle = c.wood;
  ctx.fillRect(x - 9, G - 28, 18, 5);
  ctx.strokeStyle = 'rgba(200,180,140,0.7)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let k = -6; k <= 6; k += 2.5) {
    ctx.moveTo(x + k, G - 28);
    ctx.lineTo(x + k + 1, G - 23);
  }
  ctx.stroke();
  const turn = h.busy ? t * (h.up ? 5 : -7) : 0;
  const crank = [x + 12 + Math.cos(turn) * 3.5, G - 25.5 + Math.sin(turn) * 3.5];
  line(ctx, [x + 9, G - 25.5], [x + 12, G - 25.5], c.darkWood, 1.4);
  line(ctx, [x + 12, G - 25.5], crank, '#8d96a3', 1.2);
  dot(ctx, crank, 1.2, c.darkWood);
  drawLantern(ctx, c, x - 9, G - 31);
}

function drawMine(ctx, c, site, level, t, village) {
  const [x0, x1] = site.plot;
  const tier = villageTier(level);

  // Rocky outcrop with lighter strata
  ctx.fillStyle = c.rock;
  ctx.beginPath();
  ctx.moveTo(x0 - 6, G);
  ctx.lineTo(x0 + 4, G - 32);
  ctx.lineTo(x0 + 20, G - 56);
  ctx.lineTo(x0 + 40, G - 64);
  ctx.lineTo(x0 + 58, G - 52);
  ctx.lineTo(x0 + 74, G - 60);
  ctx.lineTo(x0 + 92, G - 36);
  ctx.lineTo(x1 + 2, G);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (const [a, b, y] of [[8, 34, 40], [52, 86, 32], [14, 50, 22], [66, 96, 14]]) {
    ctx.moveTo(x0 + a, G - y);
    ctx.lineTo(x0 + b, G - y + 3);
  }
  ctx.stroke();

  // Gold veins glint in the rock; more of them as the mine deepens
  const flecks = [[16, 30], [70, 44], [30, 46], [84, 24], [58, 36], [10, 18], [76, 12]].slice(0, 3 + tier);
  for (const [fx, fy] of flecks) {
    const glint = 0.55 + 0.45 * Math.sin(t * 2.5 + fx);
    ctx.fillStyle = `rgba(240,200,90,${glint})`;
    ctx.fillRect(x0 + fx, G - fy, 2.5, 1.5);
  }

  drawGallery(ctx, c, tier, t, village);
  drawShaftHead(ctx, c, t, village);

  // Headframe on the crest from the first tier, its wheel turning
  if (tier >= 1) {
    const hx = x0 + 24;
    const hy = G - 54;
    ctx.strokeStyle = c.darkWood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy + 4);
    ctx.lineTo(hx, hy - 16);
    ctx.lineTo(hx + 8, hy + 4);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(hx, hy - 16, 5, 0, Math.PI * 2);
    const a = t * 2;
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(hx, hy - 16);
      ctx.lineTo(hx + Math.cos(a + i * 2.09) * 5, hy - 16 + Math.sin(a + i * 2.09) * 5);
    }
    ctx.stroke();
  }
  if (tier >= 2) drawPennant(ctx, c, x0 + 40, G - 64, site.accent, t);
}

// ---- quarry ------------------------------------------------------------------

function drawQuarry(ctx, c, site, level, t) {
  const [x0, x1] = site.plot;
  const tier = villageTier(level);

  // Stepped pale rock face with the worked pit cut into it
  ctx.fillStyle = c.stone;
  ctx.beginPath();
  ctx.moveTo(x0 - 4, G);
  ctx.lineTo(x0 + 10, G - 38);
  ctx.lineTo(x0 + 30, G - 64);
  ctx.lineTo(x0 + 54, G - 56);
  ctx.lineTo(x0 + 78, G - 78);
  ctx.lineTo(x1 - 12, G - 44);
  ctx.lineTo(x1 + 4, G);
  ctx.closePath();
  ctx.fill();
  const pitX = x0 + 22;
  ctx.fillStyle = lerpColor('#484952', c.pal.groundTop, c.night * 0.28);
  ctx.beginPath();
  ctx.moveTo(pitX, G - 34);
  ctx.lineTo(pitX + 14, G - 56);
  ctx.lineTo(pitX + 46, G - 60);
  ctx.lineTo(pitX + 66, G - 44);
  ctx.lineTo(pitX + 62, G - 4);
  ctx.lineTo(pitX + 8, G - 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(230,232,238,0.45)';
  ctx.lineWidth = 1.4;
  for (let bench = 0; bench < 3; bench++) {
    const y = G - 44 + bench * 12;
    ctx.beginPath();
    ctx.moveTo(pitX + 9 + bench * 4, y);
    ctx.lineTo(pitX + 60 - bench * 3, y - 1);
    ctx.stroke();
  }

  // Timber derrick hoisting blocks out of the pit: wind up, hang swaying, lower the empty hook
  const craneX = x0 + 14;
  const craneTop = G - 72;
  const cyc = (t * 0.22) % 1;
  const hookY = keys(cyc, [[0, G - 10], [0.4, G - 48], [0.6, G - 48], [1, G - 10]]);
  const laden = cyc < 0.6;
  const sway = Math.sin(t * 1.5) * (cyc > 0.35 && cyc < 0.65 ? 2.5 : 0.8);
  const reel = cyc < 0.4 ? -cyc * 30 : cyc > 0.6 ? (cyc - 0.6) * 30 : -12;
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(craneX - 12, G - 1);
  ctx.lineTo(craneX, craneTop);
  ctx.lineTo(craneX + 12, G - 1);
  ctx.moveTo(craneX, craneTop + 2);
  ctx.lineTo(craneX + 30, craneTop + 10);
  ctx.stroke();
  // Winch at the foot and the pulley at the boom end turn with the rope
  for (const [wx, wy, r] of [[craneX + 5, G - 12, 4], [craneX + 30, craneTop + 10, 2.6]]) {
    ctx.strokeStyle = c.darkWood;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(wx, wy, r, 0, Math.PI * 2);
    ctx.moveTo(wx + Math.cos(reel) * r, wy + Math.sin(reel) * r);
    ctx.lineTo(wx - Math.cos(reel) * r, wy - Math.sin(reel) * r);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(40,30,22,0.8)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(craneX + 5, G - 16);
  ctx.lineTo(craneX + 30, craneTop + 10);
  ctx.lineTo(craneX + 30 + sway, hookY);
  ctx.stroke();
  if (laden) {
    ctx.fillStyle = '#9aa0aa';
    ctx.fillRect(craneX + 24 + sway, hookY, 12, 8);
    ctx.strokeStyle = 'rgba(54,54,61,0.65)';
    ctx.strokeRect(craneX + 24.4 + sway, hookY + 0.4, 11.2, 7.2);
  } else {
    ctx.strokeStyle = c.darkWood;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(craneX + 30 + sway, hookY + 2, 2, 0, Math.PI);
    ctx.stroke();
  }
  if (tier >= 2) drawPennant(ctx, c, craneX, craneTop, site.accent, t);

  // Cut blocks stack up with the level
  const blocks = Math.min(8, 2 + Math.floor(level / 2));
  for (let i = 0; i < blocks; i++) {
    const row = Math.floor(i / 4);
    const col = i % 4;
    const bx = x0 + 30 + col * 11 + row * 5;
    const by = G - 2 - row * 8;
    ctx.fillStyle = i % 3 === 0 ? lerpColor('#c2c6ce', c.pal.near, c.night * 0.3) : lerpColor('#999da7', c.pal.near, c.night * 0.3);
    ctx.fillRect(bx, by - 7, 10, 7);
    ctx.strokeStyle = 'rgba(54,54,61,0.65)';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(bx + 0.4, by - 6.6, 9.2, 6.2);
  }
}

// ---- smithy ------------------------------------------------------------------

/**
 * Demirhane: a stone forge whose fire breathes with the bellows, a lean-to roof over the
 * anvils, a quench barrel and a rack that fills with finished weapons as the level rises.
 */
function drawSmithy(ctx, c, site, level, t) {
  const [x0] = site.plot;
  const tier = villageTier(level);
  const fire = 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3);
  const pump = (Math.sin(t * 2.6) + 1) / 2;

  // Forge light spilling over the ground, stronger at night
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(x0 + 9, G - 10, 2, x0 + 9, G - 10, 70 * fire);
  gl.addColorStop(0, `rgba(255,140,60,${0.16 + 0.34 * c.night})`);
  gl.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(x0 - 70, G - 80, 160, 90);
  ctx.restore();

  // Lean-to roof over the anvils
  poly(ctx, [[x0 + 14, G - 50], [x0 + 82, G - 37], [x0 + 82, G - 33], [x0 + 14, G - 45]], c.roof);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x0 + 14, G - 45, 68, 2);
  ctx.fillStyle = c.darkWood;
  for (const px of [x0 + 46, x0 + 78]) ctx.fillRect(px, G - 38 + (px - x0 - 46) * 0.06, 2.2, 38);

  // Stone chimney with smoke and sparks
  ctx.fillStyle = c.stone;
  ctx.fillRect(x0 + 5, G - 76, 11, 56);
  ctx.strokeStyle = 'rgba(40,40,48,0.3)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let y = G - 72; y < G - 22; y += 6) {
    ctx.moveTo(x0 + 5, y);
    ctx.lineTo(x0 + 16, y);
    const o = ((y - G) / 6) % 2 ? 4 : 8;
    ctx.moveTo(x0 + 5 + o, y);
    ctx.lineTo(x0 + 5 + o, y + 6);
  }
  ctx.stroke();
  ctx.fillStyle = c.rock;
  ctx.fillRect(x0 + 3, G - 79, 15, 4);
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.3 + i / 5) % 1;
    ctx.fillStyle = `rgba(${c.night > 0.5 ? '110,100,130' : '120,118,124'},${0.3 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x0 + 11 + k * 14 + Math.sin(t + i) * 2, G - 82 - k * 40, 2 + k * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i < 3; i++) {
    const k = (t * 0.9 + i / 3) % 1;
    ctx.globalAlpha = 1 - k;
    ctx.fillRect(x0 + 9 + Math.sin(t * 3 + i * 2) * 4, G - 80 - k * 24, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  // Hearth with the fire mouth breathing as the bellows pump
  ctx.fillStyle = c.stone;
  ctx.fillRect(x0, G - 22, 21, 22);
  ctx.fillStyle = '#1a1014';
  ctx.beginPath();
  ctx.moveTo(x0 + 4, G - 4);
  ctx.lineTo(x0 + 4, G - 12);
  ctx.arc(x0 + 10.5, G - 12, 6.5, Math.PI, 0);
  ctx.lineTo(x0 + 17, G - 4);
  ctx.closePath();
  ctx.fill();
  const heat = fire * (0.7 + pump * 0.3);
  const fg = ctx.createRadialGradient(x0 + 10.5, G - 7, 1, x0 + 10.5, G - 9, 9);
  fg.addColorStop(0, `rgba(255,240,170,${heat})`);
  fg.addColorStop(0.5, `rgba(255,140,50,${heat * 0.9})`);
  fg.addColorStop(1, 'rgba(200,60,30,0)');
  ctx.fillStyle = fg;
  ctx.fillRect(x0 + 3, G - 18, 15, 14);
  // Bellows on the hearth's flank
  const bh = 3 + pump * 4;
  poly(ctx, [[x0 + 21, G - 9], [x0 + 32, G - 9 - bh], [x0 + 32, G - 5 + bh * 0.2], [x0 + 21, G - 6]], cloth(c, '#6b4a2e'));
  line(ctx, [x0 + 32, G - 9 - bh], [x0 + 36, G - 12 - bh], c.darkWood, 1.2);

  // Quench barrel and the weapon rack
  const bx = x0 + 64;
  poly(ctx, [[bx - 6, G], [bx - 7, G - 12], [bx + 7, G - 12], [bx + 6, G]], c.wood);
  for (const y of [G - 3, G - 9]) line(ctx, [bx - 6.5, y], [bx + 6.5, y], c.darkWood, 1);
  ctx.fillStyle = 'rgba(120,160,190,0.7)';
  ctx.fillRect(bx - 6, G - 12, 12, 1.5);
  const rx = x0 + 86;
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(rx, G - 34, 2, 34);
  ctx.fillRect(rx + 16, G - 34, 2, 34);
  ctx.fillRect(rx, G - 30, 18, 2);
  const steel = cloth(c, '#c9ced6', 0.05);
  for (let i = 0; i < 2 + tier * 2; i++) {
    const wx = rx + 3 + (i % 4) * 4;
    const tall = i % 2 ? 20 : 24;
    line(ctx, [wx, G - 1], [wx, G - tall], steel, 1.4);
    line(ctx, [wx - 2, G - tall + 6], [wx + 2, G - tall + 6], cloth(c, '#b8925a'), 1.2);
  }
  if (tier >= 1) {
    // Grindstone turning beside the rack
    const gx = x0 + 52;
    dot(ctx, [gx, G - 9], 6, c.stone);
    line(ctx, [gx + Math.cos(t * 4) * 5, G - 9 + Math.sin(t * 4) * 5], [gx - Math.cos(t * 4) * 5, G - 9 - Math.sin(t * 4) * 5], 'rgba(60,60,70,0.5)', 0.8);
    line(ctx, [gx - 5, G], [gx, G - 9], c.darkWood, 1.4);
    line(ctx, [gx + 5, G], [gx, G - 9], c.darkWood, 1.4);
  }
  if (tier >= 2) drawPennant(ctx, c, x0 + 10, G - 79, site.accent, t);
}

/** An anvil with a glowing bar on its face, the tongs holding it. */
function drawAnvil(ctx, c, x, y, heat, hit) {
  const iron = cloth(c, '#3a3640', 0.05);
  poly(ctx, [[x - 4, y], [x + 4, y], [x + 2.5, y - 5], [x - 2.5, y - 5]], c.darkWood);
  poly(ctx, [[x - 2, y - 5], [x + 2, y - 5], [x + 3, y - 8], [x - 3, y - 8]], iron);
  poly(ctx, [[x - 6, y - 8], [x + 5, y - 8], [x + 10, y - 9.5], [x + 5, y - 11], [x - 6, y - 11]], iron);
  ctx.fillStyle = `rgba(255,${Math.round(150 + heat * 90)},${Math.round(60 + heat * 80)},1)`;
  ctx.fillRect(x - 4, y - 12.5, 8, 1.6);
  if (hit) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,200,110,0.9)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = -0.3 - i * 0.5;
      ctx.moveTo(x, y - 13);
      ctx.lineTo(x + Math.cos(a) * 7, y - 13 + Math.sin(a) * 7);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** A bundle of new blades carried on the shoulder. */
function drawBlades(ctx, c, x, y) {
  const steel = cloth(c, '#c9ced6', 0.05);
  for (let i = -1; i <= 1; i++) {
    line(ctx, [x - 12, y + i * 1.6 + 2], [x + 10, y + i * 1.6 - 2], steel, 1.3);
    line(ctx, [x + 6, y + i * 1.6 - 4], [x + 6, y + i * 1.6 + 1], cloth(c, '#b8925a'), 1.1);
  }
  line(ctx, [x - 2, y - 3], [x - 2, y + 4], cloth(c, '#5a3d24'), 1.4);
}

const SITE_ART = { farm: drawFarm, mill: drawMill, lumber: drawLumber, mine: drawMine, quarry: drawQuarry, smithy: drawSmithy };

// ---- depot and market ------------------------------------------------------------

/** Depot cart by the castle where workers drop their loads; it bumps on each delivery. */
export function drawDepot(ctx, c, cartBump) {
  const x = DEPOT_X;
  const bump = Math.sin(cartBump * 30) * cartBump * 4;
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(x - 22, G - 22 + bump, 44, 14);
  ctx.fillStyle = c.wood;
  ctx.fillRect(x - 22, G - 24 + bump, 44, 4);
  ctx.fillStyle = '#b89662';
  for (const dx of [-12, 2]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, G - 30 + bump, 7, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8b73c';
  ctx.beginPath();
  ctx.ellipse(x + 14, G - 25 + bump, 8, 5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = INK;
  for (const dx of [-14, 14]) {
    ctx.beginPath();
    ctx.arc(x + dx, G - 6, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 22, G - 16);
  ctx.lineTo(x - 34, G - 6);
  ctx.stroke();
}

/** Pazar Yeri: bunting over the depot and a striped stall on its castle side. */
export function drawMarket(ctx, c, t) {
  const x0 = DEPOT_X - 30;
  const x1 = DEPOT_X + 30;
  const y = G - 70;
  ctx.strokeStyle = c.darkWood;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, G);
  ctx.lineTo(x0, y);
  ctx.moveTo(x1, G);
  ctx.lineTo(x1, y);
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + 12, x1, y);
  ctx.stroke();
  const colors = ['#c8312b', '#e2b33c', '#2f6fd6', '#3f8f4a'];
  for (let i = 0; i < 7; i++) {
    const k = (i + 0.5) / 7;
    const fx = x0 + (x1 - x0) * k;
    const fy = y + Math.sin(k * Math.PI) * 10 + Math.sin(t * 2 + i);
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(fx - 4, fy);
    ctx.lineTo(fx + 4, fy);
    ctx.lineTo(fx, fy + 9);
    ctx.fill();
  }
  // Striped stall on the castle side of the cart, with the trader behind the counter
  const sx = x1 + 6;
  drawTrader(ctx, c, sx + 12, t);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#e9e1cf' : '#c8312b';
    ctx.fillRect(sx + i * 6, G - 50, 6, 8);
    // Scalloped valance under the awning
    ctx.beginPath();
    ctx.arc(sx + i * 6 + 3, G - 42, 3, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = c.darkWood;
  ctx.fillRect(sx, G - 22, 24, 4);
  ctx.fillRect(sx + 2, G - 42, 2, 42);
  ctx.fillRect(sx + 20, G - 42, 2, 42);
  ctx.fillStyle = '#e8b73c';
  ctx.beginPath();
  ctx.ellipse(sx + 12, G - 24, 7, 3, 0, Math.PI, 0);
  ctx.fill();
}

/**
 * Market trader behind the stall: counts coins from hand to hand, and every few seconds
 * waves a customer over.
 */
function drawTrader(ctx, c, x, t) {
  const s = 0.6;
  const cyc = (t * 0.25) % 1;
  const wave = cyc > 0.75 ? bump((cyc - 0.75) / 0.25) : 0;
  const count = Math.sin(t * 5);
  const fig = { x, y: G, s, legs: [[0.15, 0.08], [-0.15, -0.08]], lean: -0.02 + wave * -0.04 };
  const sk = skeleton(fig);
  facing(ctx, x, 1, () => {
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: wave ? add(off(sk.sh, 7, -13, s), [Math.sin(t * 14) * 2, 0]) : off(sk.sh, 9, 12 + count, s), bend: [0.3, 1] },
      reachB: { to: off(sk.sh, 7, 13 - count, s), bend: [-0.2, 1] },
      body: (b) => garment(ctx, b, { color: cloth(c, '#2f6fd6'), length: 8, belt: cloth(c, '#e2b33c'), trim: cloth(c, '#e2b33c') }),
    });
    // Tall felt hat
    ctx.fillStyle = cloth(c, '#7a2e24');
    ctx.fillRect(j.head[0] - j.headR * 0.9, j.head[1] - j.headR * 2.1, j.headR * 1.8, j.headR * 1.5);
    ctx.fillRect(j.head[0] - j.headR * 1.3, j.head[1] - j.headR * 0.75, j.headR * 2.6, j.headR * 0.35);
    if (!wave) {
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(j.handF[0] - 1, j.handF[1] - 2.5, 2, 1.4);
    }
    return j;
  });
}

// ---- workers -------------------------------------------------------------------
//
// Every worker is the same stick skeleton dressed for the job: a tunic (shirt colour, belt
// and maybe an apron), a hat, and the tool they work with. At the site they swing that tool,
// on the way to the cart they carry the load the way that load is really carried, and on the
// way back the tool rides on their shoulder. Clothes are tinted like the buildings at night.

const TAU = Math.PI * 2;
const cloth = (c, hex, k = 0.12) => lerpColor(hex, c.pal.near, k + c.night * 0.5);

/** Looks per site: tunic colours, the tool they swing and how they carry the load. */
const PROFESSIONS = {
  farm: { shirt: '#7d8f4a', belt: '#5a3d24', tool: 'scythe', work: 'sweep', carry: 'shoulder' },
  mill: { shirt: '#9b8a6c', belt: '#e9e1cf', apron: '#efe8d8', tool: null, work: 'lift', carry: 'shoulder' },
  lumber: { shirt: '#a8382f', belt: '#3b2a1c', stripes: '#5e1c18', tool: 'axe', work: 'fell', carry: 'shoulder' },
  // Miners by role: diggers in the gallery basket their ore to the shaft, haulers barrow it to the cart
  mine: { shirt: '#4f4a45', belt: '#8a6a3c', tool: 'pick', work: 'chop', carry: 'basket' },
  mineHaul: { shirt: '#5c544c', belt: '#8a6a3c', tool: 'shovel', work: 'shovel', carry: 'barrow' },
  quarry: { shirt: '#6c7582', belt: '#3b2a1c', apron: '#8a6a4a', tool: 'hammer', work: 'chop', carry: 'back' },
  smithy: { shirt: '#6a4f44', belt: '#2a1d14', apron: '#5a3a24', tool: 'smith', work: 'forge', carry: 'shoulder' },
};

/**
 * Work clothes: a tunic from the kit, with plaid bands for the woodsmen and an apron for the
 * millers and masons. Drawn from drawFigure's body hook, so the front arm stays on top.
 */
function dressWorker(ctx, c, j, prof, sway) {
  const s = j.s;
  garment(ctx, j, { color: cloth(c, prof.shirt), length: 7, wTop: 4, wHip: 5, hem: 6.5, belt: cloth(c, prof.belt), sway });
  const dx = j.hip[0] - j.neck[0];
  const dy = j.hip[1] - j.neck[1];
  if (prof.stripes) {
    ctx.strokeStyle = cloth(c, prof.stripes);
    ctx.lineWidth = 1.1 * s;
    ctx.beginPath();
    for (const k of [0.35, 0.6]) {
      const mx = j.neck[0] + dx * k;
      const my = j.neck[1] + dy * k;
      ctx.moveTo(mx - 4.5 * s, my);
      ctx.lineTo(mx + 4.5 * s, my);
    }
    ctx.stroke();
  }
  if (prof.apron) {
    const top = [j.neck[0] + dx * 0.35 + 1.5 * s, j.neck[1] + dy * 0.35];
    poly(ctx, [[top[0] - 2.5 * s, top[1]], [top[0] + 3.5 * s, top[1]], [j.hip[0] + 6 * s, j.hip[1] + 6 * s], [j.hip[0] - 1 * s, j.hip[1] + 7 * s]], cloth(c, prof.apron));
  }
}

/**
 * A tool held at (x, y): the handle runs along canvas angle `ang`, `back` px behind the hand
 * and `len` px in front of it, with the head at the far end. `side` (±1) turns blades.
 */
function drawTool(ctx, c, kind, x, y, ang, side = 1, len = 15, back = 4) {
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const nx = -uy * side;
  const ny = ux * side;
  const tx = x + ux * len;
  const ty = y + uy * len;
  ctx.lineCap = 'round';
  ctx.strokeStyle = cloth(c, '#6b4a2e');
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(x - ux * back, y - uy * back);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  const metal = cloth(c, '#c9ced6', 0.05);
  ctx.fillStyle = metal;
  ctx.strokeStyle = metal;
  switch (kind) {
    case 'scythe':
      // Long curved blade sweeping back from the end of the snath
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + nx * 8 + ux * 3, ty + ny * 8 + uy * 3, tx + nx * 13 - ux * 4, ty + ny * 13 - uy * 4);
      ctx.stroke();
      break;
    case 'axe':
      ctx.beginPath();
      ctx.moveTo(tx - ux * 1.5 + nx * 0.5, ty - uy * 1.5 + ny * 0.5);
      ctx.lineTo(tx + nx * 6.5 + ux * 3, ty + ny * 6.5 + uy * 3);
      ctx.lineTo(tx + nx * 6.5 - ux * 4.5, ty + ny * 6.5 - uy * 4.5);
      ctx.lineTo(tx - ux * 3 + nx * 0.5, ty - uy * 3 + ny * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'pick':
      // Curved double point across the handle
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx - nx * 7 - ux * 3, ty - ny * 7 - uy * 3);
      ctx.quadraticCurveTo(tx + ux * 2, ty + uy * 2, tx + nx * 7 - ux * 3, ty + ny * 7 - uy * 3);
      ctx.stroke();
      break;
    case 'hammer':
      // Mason's sledge: a heavy square head
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      ctx.fillRect(-2.5, -4.5, 5, 9);
      ctx.restore();
      break;
    case 'smith':
      // Smith's cross-peen hammer: a short head, flat face and wedge peen
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      ctx.fillRect(-1.6, -3.2, 3.2, 5);
      ctx.beginPath();
      ctx.moveTo(-1.6, 1.8);
      ctx.lineTo(0, 4.4);
      ctx.lineTo(1.6, 1.8);
      ctx.fill();
      ctx.restore();
      break;
    case 'shovel':
      // Spade blade at the end of the haft
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-1, -3);
      ctx.lineTo(6, -3.2);
      ctx.quadraticCurveTo(8.5, 0, 6, 3.2);
      ctx.lineTo(-1, 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
  }
}

/** Canvas angle from the elbow to the hand (the way a held tool points). */
function forearmAngle(j) {
  return Math.atan2(j.handF[1] - j.elbowF[1], j.handF[0] - j.elbowF[0]);
}

// Hats sit on the head at (hx, hy) with radius r; f is the facing direction
const HATS = {
  farm: (ctx, c, hx, hy, r) => {
    // Wide straw hat with a band
    ctx.fillStyle = cloth(c, '#d9b65a');
    ctx.beginPath();
    ctx.ellipse(hx, hy - r * 0.55, r * 2.1, r * 0.45, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy - r * 0.6, r * 0.95, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = cloth(c, '#8a3f2e');
    ctx.fillRect(hx - r * 0.95, hy - r * 0.9, r * 1.9, r * 0.3);
  },
  mill: (ctx, c, hx, hy, r, f) => {
    // Soft floppy cap leaning toward the back
    ctx.fillStyle = cloth(c, '#f2ece0', 0.05);
    ctx.beginPath();
    ctx.ellipse(hx - f * r * 0.35, hy - r * 0.9, r * 1.25, r * 0.75, -f * 0.25, 0, TAU);
    ctx.fill();
    ctx.fillRect(hx - r * 1.05, hy - r * 0.75, r * 2.1, r * 0.45);
  },
  lumber: (ctx, c, hx, hy, r, f) => {
    // Knit beanie with a pompom, and a beard
    ctx.fillStyle = cloth(c, '#2f5a3a');
    ctx.beginPath();
    ctx.arc(hx, hy - r * 0.25, r * 1.08, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = cloth(c, '#e9e1cf');
    ctx.fillRect(hx - r * 1.1, hy - r * 0.35, r * 2.2, r * 0.35);
    ctx.beginPath();
    ctx.arc(hx - f * r * 0.2, hy - r * 1.4, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = cloth(c, '#7a4a26');
    ctx.beginPath();
    ctx.moveTo(hx + f * r * 0.1, hy + r * 0.2);
    ctx.lineTo(hx + f * r * 1.05, hy + r * 0.15);
    ctx.lineTo(hx + f * r * 0.45, hy + r * 1.5);
    ctx.closePath();
    ctx.fill();
  },
  mine: (ctx, c, hx, hy, r, f) => {
    // Hard hat with a lamp that lights the way at night
    ctx.fillStyle = cloth(c, '#d6b23c');
    ctx.beginPath();
    ctx.arc(hx, hy - r * 0.3, r * 1.12, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(hx - r * 1.35, hy - r * 0.35, r * 2.7, r * 0.3);
    const lx = hx + f * r * 0.75;
    const ly = hy - r * 0.95;
    if (c.night > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = Math.min(1, c.night * 1.4);
      const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 3.2);
      glow.addColorStop(0, `rgba(255,230,150,${0.75 * a})`);
      glow.addColorStop(1, 'rgba(255,230,150,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(lx, ly, r * 3.2, 0, TAU);
      ctx.fill();
      const beam = ctx.createLinearGradient(lx, ly, lx + f * 46, ly);
      beam.addColorStop(0, `rgba(255,236,170,${0.32 * a})`);
      beam.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(lx, ly - 1);
      ctx.lineTo(lx + f * 46, ly - 9);
      ctx.lineTo(lx + f * 46, hy + r * 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = c.night > 0.3 ? '#fff6c8' : '#ffe08a';
    ctx.beginPath();
    ctx.arc(lx, ly, r * 0.38, 0, TAU);
    ctx.fill();
  },
  quarry: (ctx, c, hx, hy, r, f) => {
    // Flat cloth cap with a peak
    ctx.fillStyle = cloth(c, '#7d8693');
    ctx.beginPath();
    ctx.ellipse(hx - f * r * 0.1, hy - r * 0.55, r * 1.15, r * 0.65, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + f * r * 0.4, hy - r * 0.6);
    ctx.lineTo(hx + f * r * 1.7, hy - r * 0.45);
    ctx.lineTo(hx + f * r * 0.4, hy - r * 0.3);
    ctx.closePath();
    ctx.fill();
  },
  smithy: (ctx, c, hx, hy, r, f) => {
    // Leather skullcap with a sweat band, and a short soot-dark beard
    ctx.fillStyle = cloth(c, '#4a3020');
    ctx.beginPath();
    ctx.arc(hx, hy - r * 0.2, r * 1.08, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = cloth(c, '#9a3a26');
    ctx.fillRect(hx - r * 1.1, hy - r * 0.35, r * 2.2, r * 0.32);
    ctx.fillStyle = cloth(c, '#2a1d14');
    ctx.beginPath();
    ctx.moveTo(hx + f * r * 0.05, hy + r * 0.25);
    ctx.lineTo(hx + f * r * 1.05, hy + r * 0.2);
    ctx.lineTo(hx + f * r * 0.55, hy + r * 1.25);
    ctx.closePath();
    ctx.fill();
  },
};

// ---- loads ----------------------------------------------------------------------

/** Sheaf of wheat over the shoulder: stalks fanning back, ears at the top. */
function drawSheaf(ctx, c, x, y, f) {
  const stalk = cloth(c, '#b8963a');
  const ear = cloth(c, '#e3c35e');
  ctx.lineCap = 'round';
  for (let i = -2; i <= 2; i++) {
    const tx = x - f * (11 + i * 1.5);
    const ty = y - 12 + Math.abs(i) * 1.5;
    ctx.strokeStyle = stalk;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x + f * 6, y + 5 + i * 0.6);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = ear;
    ctx.beginPath();
    ctx.ellipse(tx - f * 1.5, ty - 1.5, 1.6, 3.2, -f * 0.8, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = cloth(c, '#8a3f2e');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x - f - 1.5, y - 2);
  ctx.lineTo(x - f + 1.5, y + 2);
  ctx.stroke();
}

/** Tied flour sack resting on the shoulder (or folded flat when empty). */
function drawSack(ctx, c, x, y, f, flat = false) {
  ctx.fillStyle = cloth(c, '#e9e1cf', 0.05);
  ctx.beginPath();
  if (flat) ctx.ellipse(x, y, 7, 3, 0, 0, TAU);
  else ctx.ellipse(x - f * 2, y - 3, 6.5, 7.5, f * 0.35, 0, TAU);
  ctx.fill();
  if (flat) return;
  // tied neck and a stamped mark
  ctx.beginPath();
  ctx.moveTo(x + f * 3, y - 9);
  ctx.lineTo(x + f * 6.5, y - 13);
  ctx.lineTo(x + f * 7.5, y - 9.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = cloth(c, '#b49a6a');
  ctx.beginPath();
  ctx.arc(x - f * 2.5, y - 2, 2, 0, TAU);
  ctx.fill();
}

/** Log over the shoulder with a ringed cut end. */
function drawLog(ctx, c, x, y, f) {
  ctx.save();
  ctx.translate(x, y - 3);
  ctx.rotate(f * 0.12);
  ctx.fillStyle = cloth(c, '#6b4a2e');
  ctx.fillRect(-15, -3.5, 30, 7);
  const end = f * 15;
  ctx.fillStyle = cloth(c, '#c99a62');
  ctx.beginPath();
  ctx.ellipse(end, 0, 2.2, 3.6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = cloth(c, '#8a6038');
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(end, 0, 1, 1.8, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Cut stone block strapped on the back; the strap runs to the hands. */
function drawStoneBlock(ctx, c, j) {
  const f = j.f;
  const bx = j.sh[0] - f * 7;
  const by = j.sh[1] + 2;
  ctx.fillStyle = cloth(c, '#b4bbc6');
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(f * 0.35);
  ctx.fillRect(-6, -6, 11, 12);
  ctx.strokeStyle = cloth(c, '#7d8693');
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-6, -1);
  ctx.lineTo(5, -1);
  ctx.moveTo(-1, -1);
  ctx.lineTo(-1, 6);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = cloth(c, '#5a3d24');
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(bx + f * 3, by - 6);
  ctx.lineTo(j.handF[0], j.handF[1]);
  ctx.stroke();
}

/** Wheelbarrow pushed ahead; full of glinting ore toward the cart, empty on the way back. */
function drawBarrow(ctx, c, j, full, roll, Y = G) {
  const f = j.f;
  const [hx, hy] = j.handF;
  const wx = hx + f * 20;
  const wy = Y - 4;
  // handles from the hands down to the wheel, and the resting leg
  ctx.strokeStyle = cloth(c, '#6b4a2e');
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(wx, wy - 2);
  ctx.moveTo(hx + f * 9, wy - 7);
  ctx.lineTo(hx + f * 7, wy + 2);
  ctx.stroke();
  // tub
  ctx.fillStyle = cloth(c, '#4d4a52');
  ctx.beginPath();
  ctx.moveTo(hx + f * 5, wy - 11);
  ctx.lineTo(wx + f * 5, wy - 12);
  ctx.lineTo(wx + f, wy - 3);
  ctx.lineTo(hx + f * 9, wy - 4);
  ctx.closePath();
  ctx.fill();
  if (full) {
    ctx.fillStyle = cloth(c, '#8a7a5a');
    for (const [dx, dy, r] of [[8, -12, 3], [12, -13.5, 3.4], [16, -12.5, 2.8]]) {
      ctx.beginPath();
      ctx.arc(hx + f * dx, wy + dy, r, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(hx + f * 11 - 1, wy - 15, 2, 2);
    ctx.fillRect(hx + f * 15 - 1, wy - 13, 1.6, 1.6);
    ctx.fillRect(hx + f * 7 - 1, wy - 13, 1.6, 1.6);
  }
  // spoked wheel turning with the distance walked
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(wx, wy, 4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = cloth(c, '#8a8f99');
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < 2; i++) {
    const a = roll + (i * Math.PI) / 2;
    ctx.moveTo(wx - Math.cos(a) * 3, wy - Math.sin(a) * 3);
    ctx.lineTo(wx + Math.cos(a) * 3, wy + Math.sin(a) * 3);
  }
  ctx.stroke();
}

// ---- poses --------------------------------------------------------------------
//
// Workers are drawn facing right inside facing() (toward the cart when carrying, toward the
// site when working or walking back) and posed by where their hands go. Work runs on the
// worker's phase: one TAU is one stroke of the tool.

const S = 0.72; // worker scale
const frac = (phase) => (((phase / TAU) % 1) + 1) % 1;
const blendPose = (p, q, k) => ({ g: mix2(p.g, q.g, k), a: mix(p.a, q.a, k) });
const DROP_TIME = 0.4; // matches the drop pause in entities/Village.js


/**
 * A tool stroke on one cycle: a slow lift to `raised`, a fast drive to `struck`, a moment
 * riding the impact, then back to `ready`. Poses give the grip (offset from the shoulder) and
 * the haft's canvas angle.
 */
function strokePose(sh, t, ready, raised, struck, lean = [0.12, -0.08, 0.32]) {
  let p;
  let l;
  if (t < 0.55) {
    p = blendPose(ready, raised, easeOut(t / 0.55));
    l = mix(lean[0], lean[1], t / 0.55);
  } else if (t < 0.66) {
    p = blendPose(raised, struck, easeIn((t - 0.55) / 0.11));
    l = mix(lean[1], lean[2], (t - 0.55) / 0.11);
  } else if (t < 0.8) {
    p = struck;
    l = lean[2];
  } else {
    p = blendPose(struck, ready, easeInOut((t - 0.8) / 0.2));
    l = mix(lean[2], lean[0], (t - 0.8) / 0.2);
  }
  return { grip: off(sh, p.g[0], p.g[1], S), a: p.a, lean: l, hit: t >= 0.66 && t < 0.8, crouch: t >= 0.6 && t < 0.85 ? 2 : 0 };
}

const STROKES = {
  // Overhead blow onto work at the feet: axe on a log, sledge on stone, pick at the rock face
  chop: [{ g: [8, 7], a: -0.55 }, { g: [-2, -10], a: -2.5 }, { g: [12, 12], a: 0.8 }],
  // Level swing into a standing trunk
  fell: [{ g: [8, 4], a: -0.4 }, { g: [-8, -2], a: -2.95 }, { g: [13, 3], a: 0.05 }],
  // One-handed hammer onto the anvil
  forge: [{ g: [10, 3], a: -0.5 }, { g: [3, -9], a: -2.0 }, { g: [14, 7], a: 0.55 }],
};

/** The piece being worked on in front of a chopper: a log on the block, or a raw stone. */
function drawWorkpiece(ctx, c, site, x, Y, hit, t) {
  const jolt = hit ? (1 - (t - 0.66) / 0.14) * 1.2 : 0;
  if (site === 'quarry') {
    poly(ctx, [[x - 7, Y], [x - 6, Y - 7 + jolt], [x + 1, Y - 10 + jolt], [x + 7, Y - 6 + jolt], [x + 7, Y]], c.stone);
    line(ctx, [x - 2, Y - 9 + jolt], [x + 1, Y - 4], 'rgba(40,40,48,0.4)', 0.7);
  }
}

/** Chips flying from the blow: wood, stone with sparks, or ore with a glint of gold. */
function drawChips(ctx, c, site, x, y, t) {
  const k = (t - 0.66) / 0.14;
  const color = { lumber: '#c99a62', quarry: '#c9ced6', mine: '#8a7a5a' }[site] ?? '#c9ced6';
  ctx.fillStyle = cloth(c, color);
  for (let i = 0; i < 5; i++) {
    const a = -0.4 - i * 0.55;
    const r = 3 + k * (8 + i * 2);
    if (site === 'mine' && i === 2) ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r + k * k * 6, 1.5, 1.5);
  }
  if ((site === 'quarry' || site === 'mine') && k < 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,220,140,${1 - k * 2})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + 0.4;
      ctx.moveTo(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5);
      ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/** Wicker basket of ore on a digger's back, the strap held at the chest. */
function drawOreBasket(ctx, c, j, hand) {
  const bx = j.sh[0] - 7;
  const by = j.sh[1] + 3;
  poly(ctx, [[bx - 5, by - 6], [bx + 5, by - 6], [bx + 4, by + 6], [bx - 4, by + 6]], cloth(c, '#8a6a3c'));
  ctx.strokeStyle = cloth(c, '#5a3d24');
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (const y of [by - 2, by + 2]) {
    ctx.moveTo(bx - 4.5, y);
    ctx.lineTo(bx + 4.5, y);
  }
  ctx.stroke();
  dot(ctx, [bx - 2, by - 6.5], 2, cloth(c, '#7d6a4a'));
  dot(ctx, [bx + 2, by - 7], 2, cloth(c, '#8a7a5a'));
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(bx, by - 8.5, 1.3, 1.3);
  line(ctx, [bx + 3, by - 6], hand, cloth(c, '#5a3d24'), 1.1);
}

/** A wheelbarrow parked behind a hauler while he fills it. */
function drawParkedBarrow(ctx, c, x, Y, full) {
  line(ctx, [x + 9, Y - 9], [x - 2, Y - 4], cloth(c, '#6b4a2e'), 1.5);
  poly(ctx, [[x - 9, Y - 10], [x + 4, Y - 11], [x + 2, Y - 4], [x - 7, Y - 3]], cloth(c, '#4d4a52'));
  if (full) {
    dot(ctx, [x - 4, Y - 11], 2.6, cloth(c, '#8a7a5a'));
    dot(ctx, [x, Y - 11.5], 2.4, cloth(c, '#7d6a4a'));
    ctx.fillStyle = '#ffd34d';
    ctx.fillRect(x - 2, Y - 13.5, 1.4, 1.4);
  }
  dot(ctx, [x - 9, Y - 4], 3.5, INK);
}

/** Working at the site (facing it). Returns the joints. */
function drawAtWork(ctx, c, w, site, prof) {
  const t = frac(w.phase);
  const Y = w.y;
  const base = { x: w.x, y: Y, s: S, legs: [[0.42, 0.18], [-0.34, -0.12]] };

  if (STROKES[prof.work]) {
    const [ready, raised, struck] = STROKES[prof.work];
    const sk = skeleton({ ...base, lean: 0.12 });
    const forge = prof.work === 'forge';
    const p = strokePose(sk.sh, t, ready, raised, struck, forge ? [0.1, 0, 0.2] : undefined);
    const d = dirOf(p.a);
    const pieceX = w.x + 17;
    if (forge) drawAnvil(ctx, c, pieceX, Y, 0.55 + 0.45 * Math.sin(w.phase * 0.25), p.hit);
    else drawWorkpiece(ctx, c, site, pieceX, Y, p.hit, t);
    // Two hands on a long haft; the smith holds the hot bar in tongs with the other hand
    const tongs = forge ? [pieceX - 6, Y - 12.5] : null;
    const j = drawPosed(ctx, {
      ...base,
      lean: p.lean,
      crouch: forge ? 0 : p.crouch,
      reachF: { to: add(p.grip, d, 1), bend: [0.2, 1] },
      reachB: forge ? { to: add(tongs, [-6, 3]), bend: [0, 1] } : { to: add(p.grip, d, -4), bend: [-0.3, 1] },
      body: (b) => dressWorker(ctx, c, b, prof, 0),
    });
    if (forge) {
      line(ctx, j.handB, tongs, cloth(c, '#3a3640'), 1);
      line(ctx, add(j.handB, [0, 1]), add(tongs, [0, 0.8]), cloth(c, '#3a3640'), 0.8);
      drawTool(ctx, c, 'smith', p.grip[0], p.grip[1], p.a, 1, 9, 3);
    } else {
      drawTool(ctx, c, prof.tool, p.grip[0], p.grip[1], p.a, 1, 14, 6);
    }
    dot(ctx, j.handF, 1.4, INK);
    if (p.hit && !forge) {
      const at = prof.work === 'fell' ? [pieceX - 2, Y - 7] : site === 'mine' ? [w.x + 14, Y - 14] : [pieceX - 2, Y - 12];
      drawChips(ctx, c, site, at[0], at[1], t);
    }
    return j;
  }

  if (prof.work === 'shovel') {
    // Drive the spade into the ore heap, lift a scoop, swing it back into the barrow
    drawParkedBarrow(ctx, c, w.x - 13, Y, t > 0.8 || t < 0.2);
    const blade = keys2(t, [[0, [w.x + 8, Y - 5]], [0.35, [w.x + 15, Y - 1.5]], [0.6, [w.x + 11, Y - 15]], [0.8, [w.x - 9, Y - 16]], [1, [w.x + 8, Y - 5]]]);
    const lean = keys(t, [[0, 0.2], [0.35, 0.42], [0.6, 0.12], [0.8, -0.06], [1, 0.2]]);
    const fig = { ...base, lean, crouch: keys(t, [[0, 1], [0.35, 4], [0.6, 0], [1, 1]]) };
    const sk = skeleton(fig);
    const up = toward(blade, off(sk.sh, 0, 6, S));
    const hf = add(blade, up, 9);
    const hb = add(blade, up, 16);
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: hf, bend: [0, 1] },
      reachB: { to: hb, bend: [-0.4, 1] },
      body: (b) => dressWorker(ctx, c, b, prof, 0),
    });
    drawTool(ctx, c, 'shovel', hf[0], hf[1], Math.atan2(-up[1], -up[0]), 1, 9, 8);
    if (t > 0.35 && t < 0.8) {
      dot(ctx, add(blade, [0, -2]), 1.8, cloth(c, '#8a7a5a'));
      ctx.fillStyle = '#ffd34d';
      ctx.fillRect(blade[0] - 0.5, blade[1] - 3.5, 1.2, 1.2);
    }
    dot(ctx, j.handF, 1.4, INK);
    return j;
  }

  if (prof.work === 'sweep') {
    // Scythe: the blade skims the stubble from behind to in front, then is carried back
    const k = t < 0.6 ? easeInOut(t / 0.6) : 1 - easeInOut((t - 0.6) / 0.4);
    const fig = { ...base, lean: 0.3 + (1 - k) * 0.08, crouch: 3, legs: [[0.45, 0.2], [-0.4, -0.15]] };
    const sk = skeleton(fig);
    const root = [w.x + mix(-12, 20, k), Y - 3 - bump(k) * 1.5];
    const hf = off(sk.sh, mix(3, 9, k), 10, S);
    const sd = toward(hf, root);
    const hb = add(hf, sd, -7);
    const j = drawPosed(ctx, {
      ...fig,
      reachF: { to: hf, bend: [0, 1] },
      reachB: { to: hb, bend: [-0.4, 1] },
      body: (b) => dressWorker(ctx, c, b, prof, -k * 1.5),
    });
    const len = Math.hypot(root[0] - hf[0], root[1] - hf[1]);
    drawTool(ctx, c, 'scythe', hf[0], hf[1], Math.atan2(sd[1], sd[0]), -1, len, 9);
    // Cut stalks tossed up as the blade passes
    if (t > 0.25 && t < 0.6) {
      ctx.fillStyle = cloth(c, '#e3c35e');
      for (let i = 0; i < 3; i++) ctx.fillRect(root[0] + 4 + i * 3, Y - 6 - ((t * 40 + i * 5) % 9), 1.4, 2.4);
    }
    dot(ctx, j.handF, 1.4, INK);
    return j;
  }

  // Lift: crouch to the sack on the floor, heave it to the chest, toss it onto the pile
  const sackFloor = [w.x + 9, Y - 6];
  const pile = [w.x + 16, Y - 18];
  const lean = keys(t, [[0, 0.1], [0.25, 0.5], [0.55, 0.05], [0.72, -0.05], [0.85, 0.2], [1, 0.1]]);
  const crouch = keys(t, [[0, 0], [0.25, 6], [0.55, 0], [1, 0]]);
  const fig = { ...base, lean, crouch, legs: [[0.32, 0.25], [-0.28, -0.05]] };
  const sk = skeleton(fig);
  const hands = keys2(t, [[0, off(sk.sh, 8, 8, S)], [0.25, sackFloor], [0.55, off(sk.sh, 7, 4, S)], [0.72, off(sk.sh, 4, -5, S)], [0.85, pile], [1, off(sk.sh, 8, 8, S)]]);
  const j = drawPosed(ctx, {
    ...fig,
    reachF: { to: add(hands, [1.5, 0]), bend: [0, 1] },
    reachB: { to: add(hands, [-1.5, 0.5]), bend: [-0.3, 1] },
    body: (b) => dressWorker(ctx, c, b, prof, 0),
  });
  if (t < 0.15) drawSack(ctx, c, sackFloor[0], sackFloor[1] + 2, 1);
  else if (t < 0.85) drawSack(ctx, c, hands[0] + 2, hands[1] + 3, 1);
  if (t > 0.85 && t < 0.98) {
    ctx.fillStyle = `rgba(245,240,226,${0.5 * (1 - (t - 0.85) / 0.13)})`;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(pile[0] - 4 + i * 2.5, pile[1] + 6 - (i % 2) * 2 - (t - 0.85) * 20, 1.6 + (i % 3), 0, TAU);
      ctx.fill();
    }
  }
  dot(ctx, j.handF, 1.4, INK);
  return j;
}

/**
 * On the route: carrying a load to where it is dropped (the cart, or the hoist bucket for
 * diggers), setting it down, or walking back with the tool. Leans into uphill stretches.
 */
function drawOnRoad(ctx, c, w, site, prof) {
  const loaded = w.state === 'carry';
  const dropping = w.state === 'drop';
  const dk = dropping ? clamp01(1 - w.timer / DROP_TIME) : 0;
  const walking = !dropping;
  const Y = w.y;
  const bob = walking ? Math.sin(w.phase * 2) * 0.8 : 0;
  const legs = walking ? walkLegs(w.phase, loaded ? 0.45 : 0.55) : [[0.35, 0.2], [-0.25, -0.1]];
  const swing = walkArms(w.phase);
  const onBack = prof.carry === 'back' || prof.carry === 'basket';
  let lean = loaded ? 0.14 : 0.06;
  if (onBack && (loaded || dropping)) lean = 0.36;
  if (prof.carry === 'barrow') lean = 0.2;
  if (walking) lean += Math.max(-0.12, Math.min(0.25, (w.climb ?? 0) * 0.35));
  if (dropping) lean = mix(lean, 0.42, bump(dk));
  const fig = { x: w.x, y: Y, s: S, legs, lean, crouch: dropping ? bump(dk) * 3 : 0 };
  const sk = skeleton(fig);
  const target = w.role === 'dig' ? [w.x + 11, Y - 8] : [w.x + 14, G - 24];

  // Where the hands and the load go: shoulder, back, barrow handles, or the tool on the way home
  let reachF = null;
  let reachB = null;
  let load = null;
  if (prof.carry === 'barrow') {
    const lift = dropping ? bump(dk) * 6 : 0;
    reachF = { to: off(sk.hip, 9, 3 - lift, S), bend: [0, 1] };
    reachB = { to: off(sk.hip, 7, 4 - lift, S), bend: [0, 1] };
  } else if (loaded || (dropping && dk < 0.65)) {
    const carryAt = onBack ? off(sk.sh, 5, 4, S) : off(sk.sh, 3, -5 + bob, S);
    load = dropping ? mix2(carryAt, target, easeInOut(dk / 0.65)) : carryAt;
    reachF = { to: load, bend: [0, 1] };
    if (dropping || onBack) reachB = { to: add(load, [-2, 1]), bend: [-0.3, 1] };
  } else if (!loaded && !dropping && prof.tool) {
    reachF = { to: off(sk.sh, 5, -1, S), bend: [0, 1] }; // tool over the shoulder
  } else if (!loaded && site === 'mill') {
    reachF = { to: off(sk.sh, 3, 2, S), bend: [0, 1] };
  }
  const j = drawPosed(ctx, {
    ...fig,
    armF: swing[0],
    armB: swing[1],
    ...(reachF ? { reachF } : {}),
    ...(reachB ? { reachB } : {}),
    body: (b) => {
      if (load && prof.carry === 'back') drawStoneBlock(ctx, c, { ...b, f: 1, handF: load });
      if (load && prof.carry === 'basket') drawOreBasket(ctx, c, b, load);
      dressWorker(ctx, c, b, prof, walking ? Math.sin(w.phase) * 1.2 : 0);
    },
  });

  if (prof.carry === 'barrow') {
    drawBarrow(ctx, c, j, loaded || (dropping && dk < 0.5), w.x / 4, Y);
  } else if (load && !onBack) {
    const [lx, ly] = load;
    if (site === 'farm') drawSheaf(ctx, c, lx, ly + 3, 1);
    else if (site === 'mill') drawSack(ctx, c, lx - 4, ly + 4, 1);
    else if (site === 'smithy') drawBlades(ctx, c, lx - 2, ly + 1);
    else drawLog(ctx, c, lx - 2, ly + 2, 1);
  } else if (!loaded && !dropping) {
    if (site === 'mill') drawSack(ctx, c, j.sh[0] - 2, j.sh[1] - 1, 1, true); // empty sack folded over the shoulder
    else if (prof.tool) drawTool(ctx, c, prof.tool, j.handF[0], j.handF[1], -Math.PI / 2 - 1.05, 1, prof.tool === 'smith' ? 9 : 13, 6);
  }
  if (reachF) dot(ctx, j.handF, 1.4, INK);
  return j;
}

/** A worker on the route or at the site, facing the way the route sends them. */
export function drawWorker(ctx, c, w) {
  const site = w.site.key;
  const prof = PROFESSIONS[w.role === 'haul' ? 'mineHaul' : site];
  facing(ctx, w.x, w.f ?? 1, () => {
    const j = w.state === 'work' ? drawAtWork(ctx, c, w, site, prof) : drawOnRoad(ctx, c, w, site, prof);
    HATS[site](ctx, c, j.head[0], j.head[1], j.headR, 1);
    return j;
  });
}
