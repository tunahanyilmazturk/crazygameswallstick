import { WORLD_W, WORLD_H, GROUND_Y, SCENERY_MIN_X, WORLD_MIN_X } from '../core/constants.js';
import { lerp, lerpColor, mulberry32 } from '../utils/math.js';
import { biomeForWave } from './biomes.js';
import { Weather } from './Weather.js';

const XMIN = SCENERY_MIN_X;
// The mountain west of the village was added later: ridges reach it without drawing on the seed
const XEXT = WORLD_MIN_X - 60;
const XMAX = WORLD_W + 40;
const FAR = 0.55; // scale of the distant village houses behind the working plots

// Palettes for the day cycle; t goes 0 (morning) → 1 (sunset) → 2 (night).
const PALETTES = [
  {
    skyTop: '#5d9fd8', skyBot: '#f3dcb2', sun: '#fff3c4', far: '#8fa7c2', snow: '#eef3f8', mid: '#5f7895', forest: '#4a627c',
    near: '#3b4d63', ground: '#2b2a2f', groundTop: '#3d4034', road: '#4b4339', fog: '#e9d6b6',
    house: '#7a7280', roof: '#5a3f45', camp: '#6a4a52', grass: '#46503a', flower: '#f2e6a0',
  },
  {
    skyTop: '#2f2b63', skyBot: '#f58a4c', sun: '#ffcf7a', far: '#a0577a', snow: '#f7c4aa', mid: '#6a3a5e', forest: '#552c4c',
    near: '#3b2340', ground: '#221a24', groundTop: '#35252b', road: '#3f2c2c', fog: '#f1915e',
    house: '#6a4256', roof: '#43233a', camp: '#5a2a3a', grass: '#3a2a30', flower: '#f7b27a',
  },
  // Night keeps a bright horizon so the ink-black figures still read against it
  {
    skyTop: '#0c0e24', skyBot: '#62508a', sun: '#e9e6ff', far: '#4a4378', snow: '#aeaadc', mid: '#373366', forest: '#2e2b58',
    near: '#2a2850', ground: '#17151f', groundTop: '#232034', road: '#28233a', fog: '#5a4a80',
    house: '#36325a', roof: '#25213f', camp: '#2e2446', grass: '#24223a', flower: '#8f8ac0',
  },
];

function mixPalette(t) {
  const i = Math.min(1, Math.floor(t));
  const k = t - i;
  const a = PALETTES[i];
  const b = PALETTES[Math.min(2, i + 1)];
  const out = {};
  for (const key in a) out[key] = lerpColor(a[key], b[key], k);
  return out;
}

/** Layered-sine skyline; `peaky` sharpens the crests into mountain peaks. */
function ridge(rng, base, amp, step, peaky) {
  const waves = [0, 1, 2].map((i) => ({ f: (0.0025 + rng() * 0.004) * (i + 1), p: rng() * 10, w: [0.55, 0.3, 0.15][i] }));
  const pts = [];
  for (let x = XMIN - 60; x <= XMAX + 60; x += step) {
    let n = 0;
    for (const w of waves) {
      const s = Math.sin(x * w.f + w.p);
      n += w.w * (peaky ? 1 - Math.abs(s) : 0.5 + 0.5 * s);
    }
    pts.push([x, base - amp * n + (rng() - 0.5) * amp * 0.06]);
  }
  // Continue the same waves west (no noise, so the seed sequence and the old layout are untouched)
  for (let x = XMIN - 60 - step; x >= XEXT - 60; x -= step) {
    let n = 0;
    for (const w of waves) {
      const s = Math.sin(x * w.f + w.p);
      n += w.w * (peaky ? 1 - Math.abs(s) : 0.5 + 0.5 * s);
    }
    pts.unshift([x, base - amp * n]);
  }
  return pts;
}

/** Blend the day-cycle palette toward a region's colours. */
function tintPalette(pal, biome, night) {
  if (!biome.strength) return pal;
  const k = biome.strength * (1 - night * 0.35);
  const out = { ...pal };
  for (const key in biome.tint) out[key] = lerpColor(pal[key], biome.tint[key], k);
  return out;
}

const TREE_KINDS = ['pine', 'round', 'snowy', 'dead', 'cactus'];
/** Which kind of tree grows at a spot (roll 0..1) in a region. */
function treeKind(biome, roll) {
  let acc = 0;
  const total = TREE_KINDS.reduce((sum, k) => sum + (biome.trees[k] ?? 0), 0);
  for (const k of TREE_KINDS) {
    acc += (biome.trees[k] ?? 0) / total;
    if (roll <= acc) return k;
  }
  return 'pine';
}

const LAKE = { x0: 520, x1: 1100, y: 526 };

function heightAt(pts, x) {
  const step = pts[1][0] - pts[0][0];
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor((x - pts[0][0]) / step)));
  const k = (x - pts[i][0]) / step;
  return lerp(pts[i][1], pts[i + 1][1], k);
}

export class Background {
  constructor() {
    const rng = mulberry32(1337);
    const span = XMAX - XMIN;
    const at = () => XMIN + rng() * span;

    this.far = ridge(rng, 430, 190, 24, true);
    this.mid = ridge(rng, 500, 80, 24, false);
    this.near = ridge(rng, 565, 30, 20, false);

    this.stars = Array.from({ length: 160 }, () => [at(), rng() * 400, rng() * 1.5 + 0.4, rng() * 6]);
    // Forest on the mid hills: [x, scale, kind roll, presence roll, leaf colour roll]
    this.trees = Array.from({ length: 90 }, () => [at(), 0.55 + rng() * 0.7, rng(), rng(), rng()]).sort((a, b) => a[1] - b[1]);
    // Bushes and boulders along the near edge of the field: [x, scale]
    this.bushes = Array.from({ length: 34 }, () => [at(), 0.6 + rng() * 0.8]);
    this.rocks = Array.from({ length: 14 }, () => [at(), 0.7 + rng() * 0.9, rng()]);
    // Lava cracks / sand ripples in the ground below the road
    this.cracks = Array.from({ length: 12 }, () => {
      const x = at();
      const y = GROUND_Y + 50 + rng() * 50;
      return Array.from({ length: 5 }, (_, i) => [x + i * (10 + rng() * 14), y + (rng() - 0.5) * 12]);
    });
    this.grass = Array.from({ length: 420 }, () => [at(), 3 + rng() * 8, rng() * 6]);
    this.stones = Array.from({ length: 70 }, () => [at(), GROUND_Y + 8 + rng() * 95, 2 + rng() * 5]);
    this.flowers = Array.from({ length: 80 }, () => [at(), GROUND_Y - 1 - rng() * 4, rng() < 0.5]);
    this.clouds = Array.from({ length: 14 }, () => ({ x: at(), y: 50 + rng() * 190, s: 0.5 + rng() * 1.1, v: 4 + rng() * 10, back: rng() < 0.45 }));
    this.birds = Array.from({ length: 6 }, () => ({ x: at(), y: 110 + rng() * 140, v: 30 + rng() * 25, p: rng() * 6 }));
    this.fireflies = Array.from({ length: 40 }, () => ({ x: at(), y: GROUND_Y - 10 - rng() * 70, p: rng() * 10, s: 0.5 + rng() }));
    // Battlefield debris: [x, angle, kind (0 spear, 1 shield, 2 sword)]
    this.debris = Array.from({ length: 11 }, () => [560 + rng() * 680, -1.2 - rng() * 0.8, Math.floor(rng() * 3)]);
    // The volcano rises on the highest far peak on the battle side
    this.peak = this.far.filter(([x]) => x > 480 && x < 1150).reduce((a, b) => (b[1] < a[1] ? b : a));
    this.plume = [];

    // Distant village on the meadow ridge behind the working plots (entities/Village.js):
    // houses and a church drawn small and hazed so the sites in front stay readable.
    this.houses = [];
    for (let x = -330; x > XMIN + 30;) {
      const w = 46 + rng() * 34;
      const fw = w * FAR;
      if (x - fw < -872 && x > -912) { x = -914; continue; } // leave room for the church
      const h = { x: x - fw, w, h: 34 + rng() * 26, roofH: 18 + rng() * 14, chimney: rng() < 0.7, lit: [rng() < 0.75, rng() < 0.5], hue: rng() };
      h.base = heightAt(this.near, h.x + fw / 2) + 3;
      this.houses.push(h);
      x -= fw + 6 + rng() * 26;
    }
    this.church = { x: -906, w: 54, h: 70 };
    this.church.base = heightAt(this.near, this.church.x + 27 * FAR) + 3;

    // Scenery added later draws from its own seed so the layout above stays where it was
    const rng2 = mulberry32(4242);
    const at2 = () => XMIN + rng2() * span;
    this.farthest = ridge(rng2, 395, 120, 30, true);
    for (const c of this.clouds) {
      // Puffs along a flat base: [dx, dy, r] in cloud units
      const n = 5 + Math.floor(rng2() * 4);
      c.puffs = Array.from({ length: n }, (_, i) => {
        const k = i / (n - 1) - 0.5;
        const r = 14 + (1 - Math.abs(k) * 1.6) * 16 + rng2() * 8;
        return [k * 110 + (rng2() - 0.5) * 10, -r * 0.55, r];
      });
    }
    this.mist = Array.from({ length: 7 }, () => ({ x: at2(), y: 470 + rng2() * 80, w: 160 + rng2() * 220, v: 3 + rng2() * 5 }));
    this.pebbles = Array.from({ length: 160 }, () => [at2(), GROUND_Y + 13 + rng2() * 26, 0.8 + rng2() * 1.8, rng2()]);
    this.edgeStones = Array.from({ length: 90 }, () => [at2(), 1.5 + rng2() * 2.5, rng2()]);
    this.shortGrass = Array.from({ length: 360 }, () => [at2(), 2 + rng2() * 4, rng2() * 6]);
    // Meadow patches and hedges on the near hill: [x, depth 0..1 below the crest, width]
    this.meadow = Array.from({ length: 70 }, () => [at2(), rng2(), 18 + rng2() * 50]);
    this.hedges = Array.from({ length: 55 }, () => [at2(), 0.6 + rng2() * 0.7]);
    // Sky and ground detail over the western extension
    const at3 = () => XEXT + rng2() * (XMIN - XEXT);
    for (let i = 0; i < 26; i++) this.stars.push([at3(), rng2() * 400, rng2() * 1.5 + 0.4, rng2() * 6]);
    for (let i = 0; i < 70; i++) this.grass.push([at3(), 3 + rng2() * 8, rng2() * 6]);
    for (let i = 0; i < 50; i++) this.shortGrass.push([at3(), 2 + rng2() * 4, rng2() * 6]);
    for (let i = 0; i < 26; i++) this.pebbles.push([at3(), GROUND_Y + 13 + rng2() * 26, 0.8 + rng2() * 1.8, rng2()]);
    for (let i = 0; i < 14; i++) this.edgeStones.push([at3(), 1.5 + rng2() * 2.5, rng2()]);
    for (let i = 0; i < 4; i++) this.clouds.push({ x: at3(), y: 50 + rng2() * 190, s: 0.5 + rng2() * 1.1, v: 4 + rng2() * 10, back: rng2() < 0.45, puffs: this.clouds[i].puffs });
    this.smoke = [];
    this.smokeT = 0;

    this.time = 0; // smoothed day-cycle position
    this.target = 0;
    this.t = 0;
    this.biome = biomeForWave(1);
    this.prevBiome = this.biome;
    this.biomeMix = 1; // 0 → 1 crossfade from prevBiome to biome
    this.weather = new Weather();
  }

  /** Day cycle and region for a wave. Returns the new region when the map changes. */
  setWave(wave) {
    const inCycle = (wave - 1) % 10; // 0..9, boss on 9
    this.target = inCycle === 9 ? 2 : (inCycle / 8) * 1.6;
    this.blood = inCycle === 9;
    const biome = biomeForWave(wave);
    this.weather.set(biome.weather(wave));
    if (biome === this.biome) return null;
    this.prevBiome = this.biome;
    this.biome = biome;
    this.biomeMix = 0;
    return biome;
  }

  /** Like setWave, but without any transition (loading a save). */
  snapWave(wave) {
    this.setWave(wave);
    this.time = this.target;
    this.prevBiome = this.biome;
    this.biomeMix = 1;
    this.weather.snap(this.biome.weather(wave));
  }

  /** The region whose shapes (trees, valley, ground) are on screen during a crossfade. */
  get shownBiome() {
    return this.biomeMix < 0.5 ? this.prevBiome : this.biome;
  }

  palette(night) {
    const pal = mixPalette(this.time);
    const cur = tintPalette(pal, this.biome, night);
    if (this.biomeMix >= 1) return cur;
    const prev = tintPalette(pal, this.prevBiome, night);
    const out = {};
    for (const key in cur) out[key] = lerpColor(prev[key], cur[key], this.biomeMix);
    return out;
  }

  update(dt, view = { left: 0, w: WORLD_W }) {
    this.t += dt;
    this.biomeMix = Math.min(1, this.biomeMix + dt / 3);
    this.weather.update(dt, view.left, view.w);
    if (this.shownBiome.special === 'volcano' && Math.random() < dt * 4) {
      this.plume.push({ x: this.peak[0] + (Math.random() - 0.5) * 10, y: this.peak[1] - 16, r: 6, life: 7 });
    }
    for (let i = this.plume.length - 1; i >= 0; i--) {
      const p = this.plume[i];
      p.life -= dt;
      p.y -= 16 * dt;
      p.x -= 9 * dt;
      p.r += 3.5 * dt;
      if (p.life <= 0) this.plume.splice(i, 1);
    }
    // Rewind instantly after a boss night; otherwise ease toward target.
    if (this.target < this.time - 1) this.time = this.target;
    this.time = lerp(this.time, this.target, Math.min(1, dt * 0.6));
    for (const c of this.clouds) {
      c.x -= c.v * dt * (c.back ? 0.5 : 1);
      if (c.x < XEXT - 200) c.x = XMAX + 200;
    }
    for (const m of this.mist) {
      m.x -= m.v * dt;
      if (m.x < XEXT - 300) m.x = XMAX + 300;
    }
    for (const b of this.birds) {
      b.x -= b.v * dt;
      b.p += dt * 8;
      if (b.x < XEXT - 30) { b.x = XMAX + 30 + Math.random() * 400; b.y = 100 + Math.random() * 150; }
    }
    for (const f of this.fireflies) f.p += dt;

    // Chimney and camp smoke
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.35;
      for (const h of this.houses) {
        // Distant chimneys puff thinly; they would smother the plots in front otherwise
        if (h.chimney && Math.random() < 0.12) this.smoke.push({ x: h.x + h.w * FAR * 0.72, y: h.base - (h.h + h.roofH * 0.6) * FAR, life: 3, r: 1.5, grow: 1.5 });
      }
      this.smoke.push({ x: 1172 + Math.random() * 6, y: 538, life: 5, r: 4, grow: 3 });
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.life -= dt;
      s.y -= 14 * dt;
      s.x += 6 * dt;
      s.r += s.grow * dt;
      if (s.life <= 0) this.smoke.splice(i, 1);
    }
  }

  draw(ctx, t, left = 0, viewW = WORLD_W) {
    const night = Math.max(0, this.time - 1);
    const pal = this.palette(night);
    const biome = this.shownBiome;
    const day = 1 - Math.min(1, this.time);
    const L = left - 20;
    const R = left + viewW + 20;
    const visible = (x, pad = 120) => x > L - pad && x < R + pad;

    // ---- sky: zenith → mid → horizon, then a wide glow on the horizon under the sun
    const sky = ctx.createLinearGradient(0, -20, 0, GROUND_Y);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(0.5, lerpColor(pal.skyTop, pal.skyBot, 0.45));
    sky.addColorStop(0.85, pal.skyBot);
    sky.addColorStop(1, lerpColor(pal.skyBot, pal.fog, 0.5));
    ctx.fillStyle = sky;
    ctx.fillRect(L, -20, R - L, WORLD_H + 40);

    // Sun sets along an arc and becomes the moon at night
    const sunT = Math.min(1, this.time / 1.6);
    const sx = lerp(900, 1050, sunT);
    const sy = lerp(150, 430, sunT) - night * 280;
    const sunset = Math.max(0, 1 - Math.abs(this.time - 1) * 1.6);
    this.drawHorizonGlow(ctx, pal, sx, night, sunset, L, R);

    if (night > 0.05) this.drawStars(ctx, t, night, visible);
    if (sunset > 0.05 && !this.low) {
      // God rays fanning out from the low sun
      ctx.save();
      ctx.globalAlpha = 0.09 * sunset;
      ctx.fillStyle = '#ffd9a0';
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + 0.25 + i * 0.29 + Math.sin(t * 0.2 + i) * 0.03;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - 0.05) * 1600, sy + Math.sin(a - 0.05) * 1600);
        ctx.lineTo(sx + Math.cos(a + 0.05) * 1600, sy + Math.sin(a + 0.05) * 1600);
        ctx.fill();
      }
      ctx.restore();
    }
    this.drawSunMoon(ctx, pal, sx, sy, night);

    if (biome.special === 'aurora' && night > 0.2) this.drawAurora(ctx, t, night, L, R);
    this.drawClouds(ctx, true, night, visible, pal, sunset, sx);
    // Rain clouds darken the sky
    if (this.weather.type === 'rain' && this.weather.intensity > 0) {
      ctx.fillStyle = `rgba(52,56,72,${0.4 * this.weather.intensity})`;
      ctx.fillRect(L, -20, R - L, GROUND_Y + 20);
    }

    // ---- far mountains: a pale range lost in the haze, then the snow-capped peaks, lit on the sun side
    this.fillRidge(ctx, this.farthest, lerpColor(pal.far, pal.skyBot, 0.55), L, R, lerpColor(pal.far, pal.fog, 0.7));
    this.fillRidge(ctx, this.far, pal.far, L, R, lerpColor(pal.far, pal.fog, 0.45));
    this.shadeFaces(ctx, this.far, lerpColor(pal.far, pal.skyTop, 0.35), L, R, 0.45);
    this.drawSnow(ctx, pal.snow, L, R);
    if (biome.special === 'mesa') this.drawMesas(ctx, pal, L, R);
    if (biome.special === 'volcano') this.drawVolcano(ctx, pal, t);
    // Ruined watchtower on a distant ridge
    const rx = 760;
    const ry = heightAt(this.far, rx);
    ctx.fillStyle = pal.mid;
    ctx.fillRect(rx - 7, ry - 34, 14, 36);
    ctx.fillRect(rx - 10, ry - 38, 4, 6);
    ctx.fillRect(rx + 2, ry - 42, 5, 10);

    const haze = ctx.createLinearGradient(0, 360, 0, 540);
    haze.addColorStop(0, 'rgba(0,0,0,0)');
    haze.addColorStop(1, pal.fog);
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = haze;
    ctx.fillRect(L, 360, R - L, 180);
    ctx.globalAlpha = 1;

    // ---- mid hills and forest, a lit rim along the crest
    this.fillRidge(ctx, this.mid, pal.mid, L, R, lerpColor(pal.mid, pal.fog, 0.3));
    this.rimLight(ctx, this.mid, lerpColor(pal.mid, pal.sun, 0.35), L, R, 0.35 + sunset * 0.3);
    this.drawTrees(ctx, pal, biome, night, visible);
    if (biome.valley) this.drawValley(ctx, pal, biome.valley, night, t, L, R, sx);

    this.drawCamp(ctx, pal, night, t);
    if (!this.low) this.drawMist(ctx, pal, night, visible);
    this.drawClouds(ctx, false, night, visible, pal, sunset, sx);

    // ---- near meadow
    this.fillRidge(ctx, this.near, pal.near, L, R, lerpColor(pal.near, pal.ground, 0.35));
    this.rimLight(ctx, this.near, lerpColor(pal.near, pal.grass, 0.6), L, R, 0.5);
    this.drawMeadow(ctx, pal, biome, visible);
    if (L < 0) this.drawVillage(ctx, pal, night, t, visible);

    // Birds
    ctx.strokeStyle = night > 0.5 ? '#9a8fbf' : '#2a2a35';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const b of this.birds) {
      if (!visible(b.x, 10)) continue;
      const w = Math.sin(b.p) * 4;
      ctx.moveTo(b.x - 7, b.y - w);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x + 7, b.y - w);
    }
    ctx.stroke();

    this.drawGround(ctx, pal, night, day, t, L, R, visible, biome);
    return { night, pal };
  }

  /** Wide warm glow along the horizon under the sun, strongest at sunset. */
  drawHorizonGlow(ctx, pal, sx, night, sunset, L, R) {
    const a = night > 0.5 ? 0.12 : 0.18 + sunset * 0.35;
    ctx.save();
    ctx.translate(sx, 470);
    ctx.scale(1, 0.32);
    const g = ctx.createRadialGradient(0, 0, 20, 0, 0, 900);
    const col = night > 0.5 ? (this.blood ? '255,70,50' : '150,140,230') : '255,214,150';
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(0.5, `rgba(${col},${a * 0.35})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(L - sx, -900, R - L, 1800);
    ctx.restore();
  }

  /** Twinkling stars, the brightest with a cross glint, and now and then a shooting star. */
  drawStars(ctx, t, night, visible) {
    ctx.fillStyle = '#fff';
    for (const [x, y, r, p] of this.stars) {
      if (!visible(x, 0)) continue;
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + p);
      ctx.globalAlpha = night * tw;
      ctx.fillRect(x, y, r, r);
      if (r > 1.75) {
        ctx.globalAlpha = night * tw * 0.5;
        ctx.fillRect(x - r * 1.5, y + r * 0.4, r * 4, 0.6);
        ctx.fillRect(x + r * 0.4, y - r * 1.5, 0.6, r * 4);
      }
    }
    ctx.globalAlpha = 1;
    const cycle = t % 9;
    if (night > 0.6 && cycle < 0.7) {
      const n = Math.floor(t / 9);
      const x0 = 100 + ((n * 397) % 1000);
      const y0 = 40 + ((n * 131) % 160);
      const k = cycle / 0.7;
      const hx = x0 - k * 260;
      const hy = y0 + k * 90;
      const g = ctx.createLinearGradient(hx, hy, hx + 60, hy - 21);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 60, hy - 21);
      ctx.stroke();
    }
  }

  /** The sun with a soft corona; at night a shaded moon (or the blood moon on boss nights). */
  drawSunMoon(ctx, pal, sx, sy, night) {
    const moon = night > 0.5;
    for (const [r, a] of [[200, moon ? 0.18 : 0.35], [70, moon ? 0.3 : 0.55]]) {
      const glow = ctx.createRadialGradient(sx, sy, 20, sx, sy, r);
      const col = moon ? (this.blood ? '255,80,60' : '220,220,255') : '255,240,200';
      glow.addColorStop(0, `rgba(${col},${a})`);
      glow.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    const disc = ctx.createRadialGradient(sx - 10, sy - 10, 4, sx, sy, 38);
    const face = moon && this.blood ? '#ff5a4a' : pal.sun;
    disc.addColorStop(0, lerpColor(face, '#ffffff', 0.5));
    disc.addColorStop(1, face);
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, 38, 0, Math.PI * 2);
    ctx.fill();
    if (moon) {
      ctx.fillStyle = this.blood ? 'rgba(120,20,20,0.3)' : 'rgba(120,120,170,0.25)';
      for (const [dx, dy, r] of [[-12, -8, 7], [10, 6, 9], [-4, 14, 5], [14, -14, 4]]) {
        ctx.beginPath();
        ctx.arc(sx + dx, sy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Terminator shadow on the dark limb
      const sh = ctx.createLinearGradient(sx - 38, 0, sx + 38, 0);
      sh.addColorStop(0, 'rgba(20,18,50,0.45)');
      sh.addColorStop(0.45, 'rgba(20,18,50,0)');
      ctx.fillStyle = sh;
      ctx.beginPath();
      ctx.arc(sx, sy, 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Billowing clouds: puffs on a flat base, shaded underneath, lit on the side facing the sun
   * and blushing at sunset. Back clouds are fainter and drift slower.
   */
  drawClouds(ctx, back, night, visible, pal, sunset, sunX) {
    const moon = night > 0.5;
    const body = moon ? lerpColor('#36305e', pal.skyTop, 0.35) : lerpColor('#ffffff', pal.skyBot, 0.2 + sunset * 0.25);
    const shade = moon ? lerpColor('#221e44', pal.skyTop, 0.3) : lerpColor(body, pal.skyTop, 0.35 + sunset * 0.2);
    const lit = moon ? '#5e5898' : lerpColor('#ffffff', pal.sun, 0.25 + sunset * 0.5);
    ctx.save();
    ctx.globalAlpha = (back ? 0.5 : 0.82) * (moon ? 0.7 : 1);
    for (const c of this.clouds) {
      if (c.back !== back || !visible(c.x, 150)) continue;
      const s = c.s * (back ? 0.8 : 1);
      const side = sunX > c.x ? 1 : -1;
      const puffs = (dx, dy, k) => {
        ctx.beginPath();
        for (const [px, py, r] of c.puffs) {
          ctx.moveTo(c.x + (px + dx) * s + r * k * s, c.y + (py + dy) * s);
          ctx.arc(c.x + (px + dx) * s, c.y + (py + dy) * s, r * k * s, 0, Math.PI * 2);
        }
      };
      // Everything below the base is cut flat
      ctx.save();
      ctx.beginPath();
      ctx.rect(c.x - 200 * s, c.y - 200 * s, 400 * s, 206 * s);
      ctx.clip();
      ctx.fillStyle = shade;
      puffs(0, 0, 1);
      ctx.fill();
      ctx.fillStyle = body;
      puffs(side * 3, -4, 0.88);
      ctx.fill();
      ctx.fillStyle = lit;
      puffs(side * 7, -8, 0.55);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  /** A ridge filled from its crest down, fading to `bottom` (the haze between layers). */
  fillRidge(ctx, pts, color, L, R, bottom = null) {
    if (bottom) {
      let top = GROUND_Y;
      for (const [x, y] of pts) if (x > L - 40 && x < R + 40 && y < top) top = y;
      const g = ctx.createLinearGradient(0, top, 0, GROUND_Y);
      g.addColorStop(0, color);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = color;
    }
    ctx.beginPath();
    let started = false;
    for (const [x, y] of pts) {
      if (x < L - 40 || x > R + 40) continue;
      if (!started) { ctx.moveTo(x, GROUND_Y + 5); started = true; }
      ctx.lineTo(x, y);
    }
    ctx.lineTo(R + 40, GROUND_Y + 5);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Shadow on the mountain faces turned away from the sun (the sun sits to the right, so the
   * slopes rising toward it are in shade): a band hanging under each rising segment.
   */
  shadeFaces(ctx, pts, color, L, R, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      if (x1 < L - 40 || x0 > R + 40 || y1 >= y0) continue;
      const depth = Math.min(90, (y0 - y1) * 6);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x1 + 6, y1 + depth);
      ctx.lineTo(x0 + 6, y0 + depth * 0.6);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  /** A thin line of light along a ridge's crest. */
  rimLight(ctx, pts, color, L, R, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (const [x, y] of pts) {
      if (x < L - 40 || x > R + 40) continue;
      if (!started) { ctx.moveTo(x, y + 1); started = true; }
      else ctx.lineTo(x, y + 1);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Darker grass patches across the near hill and small hedges along its crest. */
  drawMeadow(ctx, pal, biome, visible) {
    const bare = biome.cover === 'sand' || biome.cover === 'ash';
    ctx.fillStyle = lerpColor(pal.near, pal.ground, bare ? 0.15 : 0.22);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (const [x, d, w] of this.meadow) {
      if (!visible(x, w)) continue;
      const top = heightAt(this.near, x);
      const y = top + 6 + d * (GROUND_Y - top - 10);
      ctx.moveTo(x + w, y);
      ctx.ellipse(x, y, w, 2 + d * 2.5, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    if (bare) return;
    ctx.fillStyle = lerpColor(pal.near, pal.forest, 0.5);
    ctx.beginPath();
    for (const [x, k] of this.hedges) {
      if (!visible(x, 20) || (x > -340 && x < 120)) continue; // keep the castle's skyline clear
      const b = heightAt(this.near, x) + 2;
      for (const [dx, r] of [[-5, 4], [0, 5.5], [5, 4]]) {
        ctx.moveTo(x + dx * k + r * k, b - r * k * 0.6);
        ctx.arc(x + dx * k, b - r * k * 0.6, r * k, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  /** Soft banks of mist drifting through the valleys between the hills. */
  drawMist(ctx, pal, night, visible) {
    const col = lerpColor(pal.fog, '#ffffff', 0.3);
    for (const m of this.mist) {
      if (!visible(m.x, m.w)) continue;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.scale(1, 0.08);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, m.w);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.16 - night * 0.07;
      ctx.fillStyle = g;
      ctx.fillRect(-m.w, -m.w, m.w * 2, m.w * 2);
      ctx.restore();
    }
  }

  drawSnow(ctx, color, L, R) {
    // Clip to the mountains, then fill everything above a jagged snowline
    const line = 300;
    const pts = this.far.filter(([x]) => x > L - 60 && x < R + 60);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], GROUND_Y);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(pts[pts.length - 1][0], GROUND_Y);
    ctx.clip();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(L - 60, 0);
    for (let x = L - 60; x <= R + 60; x += 12) {
      ctx.lineTo(x, line + Math.sin(x * 0.05) * 6 + Math.sin(x * 0.17) * 4 + ((x * 13) % 7));
    }
    ctx.lineTo(R + 60, 0);
    ctx.fill();
    ctx.restore();
  }

  /** Enemy war camp on the far right hills, where the waves come from. */
  drawCamp(ctx, pal, night, t) {
    const tents = [[1090, 1], [1140, 1.3], [1205, 1.1], [1250, 0.9]];
    for (const [x, s] of tents) {
      const base = heightAt(this.mid, x) + 4;
      ctx.fillStyle = pal.camp;
      ctx.beginPath();
      ctx.moveTo(x - 20 * s, base);
      ctx.lineTo(x, base - 26 * s);
      ctx.lineTo(x + 20 * s, base);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.moveTo(x - 4 * s, base);
      ctx.lineTo(x, base - 14 * s);
      ctx.lineTo(x + 4 * s, base);
      ctx.fill();
      // Red pennant
      ctx.strokeStyle = pal.camp;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, base - 26 * s);
      ctx.lineTo(x, base - 40 * s);
      ctx.stroke();
      ctx.fillStyle = '#9e2a2a';
      const w = Math.sin(t * 3 + x) * 2;
      ctx.beginPath();
      ctx.moveTo(x, base - 40 * s);
      ctx.lineTo(x + 11 * s, base - 37 * s + w);
      ctx.lineTo(x, base - 34 * s);
      ctx.fill();
    }
    // Campfire glow
    const fx = 1172;
    const fy = heightAt(this.mid, fx) + 2;
    const flick = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 7.3);
    const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 50 * flick);
    g.addColorStop(0, `rgba(255,150,60,${0.25 + 0.45 * night})`);
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - 60, fy - 60, 120, 120);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(fx, fy - 3, 3, 5 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Distant village on the meadow ridge: small, hazed houses and a church behind the sites. */
  drawVillage(ctx, pal, night, t, visible) {
    const winLit = `rgba(255,196,100,${0.25 + 0.75 * night})`;
    const winDark = 'rgba(0,0,0,0.3)';
    const wall = lerpColor(pal.house, pal.mid, 0.35);
    const roof = lerpColor(pal.roof, pal.mid, 0.3);

    // Chimney smoke
    ctx.fillStyle = night > 0.5 ? 'rgba(120,110,150,0.22)' : 'rgba(210,210,215,0.26)';
    ctx.beginPath();
    for (const s of this.smoke) {
      if (!visible(s.x, 20)) continue;
      ctx.moveTo(s.x + s.r, s.y);
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    }
    ctx.fill();

    // Church: nave, bell tower and a lit rose window (drawn at base 0, then scaled)
    const c = this.church;
    if (visible(c.x)) {
      ctx.save();
      ctx.translate(c.x, c.base);
      ctx.scale(FAR, FAR);
      ctx.fillStyle = wall;
      ctx.fillRect(0, -c.h * 0.55, c.w, c.h * 0.55);
      ctx.fillRect(c.w * 0.62, -c.h, 16, c.h);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(-4, -c.h * 0.55);
      ctx.lineTo(c.w * 0.31, -c.h * 0.85);
      ctx.lineTo(c.w * 0.62, -c.h * 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c.w * 0.62 - 3, -c.h);
      ctx.lineTo(c.w * 0.62 + 8, -c.h - 26);
      ctx.lineTo(c.w * 0.62 + 19, -c.h);
      ctx.fill();
      ctx.fillStyle = winLit;
      ctx.beginPath();
      ctx.arc(c.w * 0.62 + 8, -c.h + 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Houses
    for (const h of this.houses) {
      if (!visible(h.x)) continue;
      ctx.save();
      ctx.translate(h.x, h.base);
      ctx.scale(FAR, FAR);
      const top = -h.h;
      ctx.fillStyle = h.hue < 0.5 ? wall : lerpColor(wall, pal.near, 0.3);
      ctx.fillRect(0, top, h.w, h.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, top + h.h * 0.45);
      ctx.lineTo(h.w, top + h.h * 0.45);
      ctx.stroke();
      ctx.fillStyle = roof;
      if (h.chimney) ctx.fillRect(h.w * 0.68, top - h.roofH * 0.9, 8, h.roofH * 0.7);
      ctx.beginPath();
      ctx.moveTo(-6, top + 1);
      ctx.lineTo(h.w * 0.5, top - h.roofH);
      ctx.lineTo(h.w + 6, top + 1);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(h.w * 0.15, -18, 10, 18);
      ctx.fillStyle = h.lit[0] && night > 0.2 ? winLit : winDark;
      ctx.fillRect(h.w * 0.55, top + h.h * 0.55, 9, 8);
      ctx.fillStyle = h.lit[1] && night > 0.2 ? winLit : winDark;
      ctx.fillRect(h.w * 0.3, top + h.h * 0.12, 8, 7);
      ctx.restore();
    }
  }

  drawGround(ctx, pal, night, day, t, L, R, visible, biome) {
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
    g.addColorStop(0, pal.groundTop);
    g.addColorStop(0.25, pal.ground);
    g.addColorStop(1, pal.ground);
    ctx.fillStyle = g;
    ctx.fillRect(L, GROUND_Y, R - L, WORLD_H - GROUND_Y + 20);

    // Grass sod along the top edge of the field, lighter where it catches the light
    const sod = ctx.createLinearGradient(0, GROUND_Y - 1, 0, GROUND_Y + 11);
    sod.addColorStop(0, lerpColor(pal.grass, '#ffffff', 0.12 * day));
    sod.addColorStop(1, pal.groundTop);
    ctx.fillStyle = sod;
    ctx.fillRect(L, GROUND_Y - 1, R - L, 12);
    // Soil strata deeper down
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const [dy, f] of [[58, 0.012], [82, 0.009], [104, 0.015]]) {
      ctx.moveTo(L, GROUND_Y + dy);
      for (let x = L; x <= R; x += 40) ctx.lineTo(x, GROUND_Y + dy + Math.sin(x * f + dy) * 4);
    }
    ctx.stroke();

    // Dirt road leading to the castle gate, its edges worn lighter and darker
    const roadTop = (x) => GROUND_Y + 12 + Math.sin(x * 0.013) * 3;
    const roadBot = (x) => GROUND_Y + 40 + Math.sin(x * 0.009 + 1) * 5;
    const road = ctx.createLinearGradient(0, GROUND_Y + 10, 0, GROUND_Y + 44);
    road.addColorStop(0, lerpColor(pal.road, '#ffffff', 0.08));
    road.addColorStop(1, lerpColor(pal.road, '#000000', 0.12));
    ctx.fillStyle = road;
    ctx.beginPath();
    ctx.moveTo(L, roadTop(L));
    for (let x = L; x <= R; x += 40) ctx.lineTo(x, roadTop(x));
    for (let x = R; x >= L; x -= 40) ctx.lineTo(x, roadBot(x));
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    for (let x = L; x <= R; x += 40) (x === L ? ctx.moveTo(x, roadTop(x)) : ctx.lineTo(x, roadTop(x)));
    ctx.stroke();
    // Wheel ruts
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const off of [20, 32]) {
      ctx.moveTo(L, GROUND_Y + off);
      for (let x = L; x <= R; x += 40) ctx.lineTo(x, GROUND_Y + off + Math.sin(x * 0.011) * 2);
    }
    ctx.stroke();
    // Gravel on the road, and stones bedded along its upper edge
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    for (const [x, y, r, k] of this.pebbles) {
      if (!visible(x, 5) || y > roadBot(x) - 2) continue;
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * (0.5 + k * 0.3), 0, 0, Math.PI * 2);
    }
    ctx.fill();
    const edge = lerpColor(pal.road, pal.mid, 0.45);
    ctx.fillStyle = edge;
    ctx.beginPath();
    for (const [x, r, k] of this.edgeStones) {
      if (!visible(x, 5)) continue;
      const y = roadTop(x) + 1;
      ctx.moveTo(x + r * 1.4, y);
      ctx.ellipse(x, y, r * 1.4, r * (0.6 + k * 0.3), 0, Math.PI, 0);
    }
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (const [x, y, r] of this.stones) {
      if (!visible(x, 10)) continue;
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Debris of earlier battles
    ctx.strokeStyle = 'rgba(20,18,26,0.75)';
    ctx.fillStyle = 'rgba(20,18,26,0.75)';
    ctx.lineWidth = 2;
    for (const [x, a, kind] of this.debris) {
      const len = kind === 0 ? 30 : 18;
      if (kind === 1) {
        ctx.beginPath();
        ctx.ellipse(x, GROUND_Y + 1, 9, 5, 0.3, Math.PI, 0);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y + 2);
        ctx.lineTo(x + Math.cos(a) * len, GROUND_Y + 2 + Math.sin(a) * len);
        if (kind === 2) {
          const hx = x + Math.cos(a) * (len - 5);
          const hy = GROUND_Y + 2 + Math.sin(a) * (len - 5);
          ctx.moveTo(hx - 5, hy + 2);
          ctx.lineTo(hx + 5, hy - 2);
        }
        ctx.stroke();
      }
    }

    this.drawCover(ctx, pal, biome, night, t, L, R, visible);
    this.drawRocks(ctx, pal, biome, visible);
    this.drawBushes(ctx, pal, biome, visible);

    // Grass blades along the horizon, batched into one path (sparse on snow, sand and ash)
    const grassEvery = { meadow: 1, leaves: 1, snow: 4, sand: 3, ash: 5 }[biome.cover];
    // Two shades: a dark under-layer of short tufts, then the taller blades catching the light
    ctx.strokeStyle = lerpColor(pal.grass, pal.ground, 0.45);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    this.shortGrass.forEach(([x, h, p], i) => {
      if (i % grassEvery || !visible(x, 10)) return;
      const sway = Math.sin(t * 1.5 + p + x * 0.01) * 1.2;
      ctx.moveTo(x - 1.5, GROUND_Y + 2);
      ctx.lineTo(x - 2.5 + sway, GROUND_Y - h);
      ctx.moveTo(x + 1.5, GROUND_Y + 2);
      ctx.lineTo(x + 3 + sway, GROUND_Y - h * 0.8);
    });
    ctx.stroke();
    ctx.strokeStyle = pal.grass;
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.grass.forEach(([x, h, p], i) => {
      if (i % grassEvery || !visible(x, 10)) return;
      const sway = Math.sin(t * 1.5 + p + x * 0.01) * 2;
      ctx.moveTo(x, GROUND_Y + 2);
      ctx.quadraticCurveTo(x + sway * 0.3, GROUND_Y - h * 0.5, x + sway, GROUND_Y - h);
    });
    ctx.stroke();
    ctx.strokeStyle = lerpColor(pal.grass, '#ffffff', 0.25 * day + 0.05);
    ctx.lineWidth = 1;
    ctx.beginPath();
    this.grass.forEach(([x, h, p], i) => {
      if ((i % grassEvery) || i % 3 || !visible(x, 10)) return;
      const sway = Math.sin(t * 1.5 + p + x * 0.01) * 2;
      ctx.moveTo(x + 0.6, GROUND_Y - h * 0.3);
      ctx.lineTo(x + sway + 0.4, GROUND_Y - h);
    });
    ctx.stroke();

    if (day > 0.1 && (biome.cover === 'meadow' || biome.cover === 'leaves')) {
      ctx.globalAlpha = day;
      const fallen = biome.cover === 'leaves';
      this.flowers.forEach(([x, y, warm], i) => {
        if (!visible(x, 5)) return;
        ctx.fillStyle = fallen ? biome.leaves[i % biome.leaves.length] : warm ? pal.flower : '#e6a6c8';
        ctx.fillRect(x, y, fallen ? 3.5 : 2.5, fallen ? 2 : 2.5);
      });
      ctx.globalAlpha = 1;
    }

    if (night > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.fireflies) {
        const x = f.x + Math.sin(f.p * 0.7) * 20;
        if (!visible(x, 10)) continue;
        const y = f.y + Math.sin(f.p * 1.3) * 10;
        const a = night * (0.4 + 0.6 * Math.max(0, Math.sin(f.p * 2 * f.s)));
        ctx.fillStyle = `rgba(210,255,150,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** Hill trees for the region shown: pines, round crowns, snowy pines, dead trees, cacti. */
  drawTrees(ctx, pal, biome, night, visible) {
    const groups = { pine: [], round: [], snowy: [], dead: [], cactus: [] };
    for (const tree of this.trees) {
      const [x, , kindRoll, here] = tree;
      if (here > biome.density || !visible(x, 30)) continue;
      groups[treeKind(biome, kindRoll)].push(tree);
    }
    const base = (x) => heightAt(this.mid, x) + 6;
    const pine = (x, k) => {
      const b = base(x);
      ctx.moveTo(x, b - 48 * k);
      ctx.lineTo(x - 14 * k, b - 14 * k);
      ctx.lineTo(x - 6 * k, b - 16 * k);
      ctx.lineTo(x - 17 * k, b);
      ctx.lineTo(x + 17 * k, b);
      ctx.lineTo(x + 6 * k, b - 16 * k);
      ctx.lineTo(x + 14 * k, b - 14 * k);
      ctx.closePath();
    };
    ctx.fillStyle = pal.forest;
    ctx.beginPath();
    for (const [x, k] of [...groups.pine, ...groups.snowy]) pine(x, k);
    ctx.fill();
    // The sun-side half of each pine is lighter
    ctx.fillStyle = lerpColor(pal.forest, pal.sun, 0.18 - night * 0.1);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const [x, k] of [...groups.pine, ...groups.snowy]) {
      const b = base(x);
      ctx.moveTo(x, b - 48 * k);
      ctx.lineTo(x + 14 * k, b - 14 * k);
      ctx.lineTo(x + 6 * k, b - 16 * k);
      ctx.lineTo(x + 17 * k, b);
      ctx.lineTo(x + 2 * k, b);
      ctx.closePath();
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    if (groups.snowy.length) {
      // Snow caps on the upper branches
      ctx.fillStyle = lerpColor('#ffffff', pal.far, 0.15 + night * 0.4);
      ctx.beginPath();
      for (const [x, k] of groups.snowy) {
        const b = base(x);
        ctx.moveTo(x, b - 48 * k);
        ctx.lineTo(x - 9 * k, b - 26 * k);
        ctx.lineTo(x, b - 30 * k);
        ctx.lineTo(x + 9 * k, b - 26 * k);
        ctx.closePath();
        ctx.moveTo(x - 14 * k, b - 14 * k);
        ctx.lineTo(x - 6 * k, b - 18 * k);
        ctx.lineTo(x - 9 * k, b - 13 * k);
        ctx.closePath();
      }
      ctx.fill();
    }
    // Round crowns: one colour, or a mix of autumn colours tinted to the hour
    const multi = biome.leaves.length > 1;
    const crowns = multi ? biome.leaves.map((c) => lerpColor(c, pal.mid, 0.25 + night * 0.45)) : [pal.forest];
    crowns.forEach((color, ci) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const [x, k, , , leafRoll] of groups.round) {
        if (multi && Math.floor(leafRoll * crowns.length) !== ci) continue;
        const b = base(x);
        ctx.moveTo(x + 15 * k, b - 22 * k);
        ctx.arc(x, b - 22 * k, 15 * k, 0, Math.PI * 2);
      }
      ctx.fill();
      // Lit crescent on the sun side of the crown
      ctx.fillStyle = lerpColor(color, pal.sun, 0.2 - night * 0.1);
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (const [x, k, , , leafRoll] of groups.round) {
        if (multi && Math.floor(leafRoll * crowns.length) !== ci) continue;
        const b = base(x);
        ctx.moveTo(x + 15 * k, b - 22 * k);
        ctx.arc(x + 4 * k, b - 25 * k, 10 * k, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = pal.forest;
    ctx.beginPath();
    for (const [x, k] of groups.round) ctx.rect(x - 2 * k, base(x) - 10 * k, 4 * k, 10 * k);
    ctx.fill();
    // Dead trees: bare trunks with crooked branches
    ctx.strokeStyle = pal.forest;
    ctx.lineCap = 'round';
    for (const [x, k, kr] of groups.dead) {
      const b = base(x);
      ctx.lineWidth = 3 * k;
      ctx.beginPath();
      ctx.moveTo(x, b);
      ctx.lineTo(x + 2 * k, b - 34 * k);
      ctx.stroke();
      ctx.lineWidth = 1.8 * k;
      ctx.beginPath();
      ctx.moveTo(x + 1 * k, b - 18 * k);
      ctx.lineTo(x - 10 * k, b - 30 * k);
      ctx.moveTo(x + 2 * k, b - 26 * k);
      ctx.lineTo(x + 12 * k, b - 38 * k);
      ctx.moveTo(x - 6 * k, b - 25 * k);
      ctx.lineTo(x - 8 * k + kr * 4, b - 36 * k);
      ctx.stroke();
    }
    // Cacti: a column with two raised arms
    for (const [x, k] of groups.cactus) {
      const b = base(x);
      ctx.lineWidth = 6 * k;
      ctx.beginPath();
      ctx.moveTo(x, b);
      ctx.lineTo(x, b - 34 * k);
      ctx.moveTo(x, b - 16 * k);
      ctx.lineTo(x - 9 * k, b - 16 * k);
      ctx.lineTo(x - 9 * k, b - 26 * k);
      ctx.moveTo(x, b - 22 * k);
      ctx.lineTo(x + 8 * k, b - 22 * k);
      ctx.lineTo(x + 8 * k, b - 31 * k);
      ctx.stroke();
    }
  }

  /** The lake glimpsed between the hills: water, ice or a lava pool. */
  drawValley(ctx, pal, kind, night, t, L, R, sunX = 1000) {
    const { x0, x1, y } = LAKE;
    if (x1 < L || x0 > R) return;
    // Long tapering shores so the lake sits in the valley rather than floating over it
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(x0, y + 18);
      ctx.bezierCurveTo(x0 + 70, y + 14, x0 + 110, y, x0 + 190, y);
      ctx.lineTo(x1 - 190, y);
      ctx.bezierCurveTo(x1 - 110, y, x1 - 70, y + 14, x1, y + 18);
      ctx.lineTo(x1, y + 34);
      ctx.lineTo(x0, y + 34);
      ctx.closePath();
    };
    if (kind === 'lava') {
      const g = ctx.createLinearGradient(0, y, 0, y + 20);
      g.addColorStop(0, '#ffb347');
      g.addColorStop(1, '#c2302a');
      ctx.fillStyle = g;
      shape();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      // Heat glow hugging the pool (a blurred copy of its own shape)
      ctx.shadowColor = `rgba(255,110,40,${0.55 + 0.2 * Math.sin(t * 2)})`;
      ctx.shadowBlur = 28;
      ctx.fillStyle = 'rgba(255,120,50,0.15)';
      shape();
      ctx.fill();
      ctx.shadowBlur = 0;
      // slow bubbles bursting on the surface
      ctx.fillStyle = 'rgba(255,230,140,0.7)';
      for (let i = 0; i < 6; i++) {
        const k = (t * 0.4 + i / 6) % 1;
        ctx.beginPath();
        ctx.arc(x0 + 80 + i * 60 + Math.sin(i * 7) * 20, y + 4, 3 * Math.sin(k * Math.PI), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    const ice = kind === 'ice';
    // Water mirrors the sky at the far shore and deepens toward the near one
    const top = ice ? lerpColor('#e4eef8', pal.mid, 0.15 + night * 0.4) : lerpColor(pal.skyBot, '#9cc4e0', 0.35 - night * 0.2);
    const deep = ice ? lerpColor('#a9c2dc', pal.mid, 0.3 + night * 0.4) : lerpColor('#3f6f96', pal.mid, 0.4 + night * 0.3);
    const water = ctx.createLinearGradient(0, y, 0, y + 22);
    water.addColorStop(0, top);
    water.addColorStop(1, deep);
    ctx.fillStyle = water;
    shape();
    ctx.fill();
    // a pale shoreline along the far bank
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x0 + 190, y + 0.5);
    ctx.lineTo(x1 - 190, y + 0.5);
    ctx.stroke();
    ctx.strokeStyle = ice ? 'rgba(255,255,255,0.55)' : `rgba(255,255,255,${0.25 + 0.15 * night})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ice) {
      // frozen surface: a few long cracks
      for (const cx of [x0 + 120, x0 + 260, x1 - 150]) {
        ctx.moveTo(cx, y + 2);
        ctx.lineTo(cx + 18, y + 6);
        ctx.lineTo(cx + 10, y + 10);
        ctx.lineTo(cx + 34, y + 13);
      }
    } else {
      // shimmering ripples drifting along the water
      for (let i = 0; i < 14; i++) {
        const x = x0 + 60 + ((i * 53 + t * 8) % (x1 - x0 - 120));
        const yy = y + 3 + (i % 4) * 3;
        ctx.moveTo(x, yy);
        ctx.lineTo(x + 10 + (i % 3) * 6, yy);
      }
    }
    ctx.stroke();
    // A glittering path on the water under the sun (or the moon)
    if (!ice && sunX > x0 + 60 && sunX < x1 - 60) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const col = night > 0.5 ? (this.blood ? '255,110,90' : '210,210,255') : '255,236,180';
      for (let i = 0; i < 9; i++) {
        const yy = y + 2 + i * 2.3;
        const w = (6 + i * 3) * (0.6 + 0.4 * Math.sin(t * 3 + i * 1.7));
        ctx.fillStyle = `rgba(${col},${0.45 - i * 0.035})`;
        ctx.fillRect(sunX - w / 2 + Math.sin(t * 2 + i) * 3, yy, w, 1.1);
      }
      ctx.restore();
    }
  }

  /** Flat-topped buttes on the desert horizon, striped by rock layers. */
  drawMesas(ctx, pal, L, R) {
    const color = lerpColor(pal.far, pal.mid, 0.25);
    for (const [x, w, h] of [[260, 150, 150], [640, 110, 120], [930, 190, 165], [1210, 120, 110], [-420, 160, 140], [-760, 120, 120]]) {
      if (x + w < L || x - w > R) continue;
      const top = 470 - h;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.7, 480);
      ctx.lineTo(x - w * 0.45, top + 8);
      ctx.lineTo(x - w * 0.4, top);
      ctx.lineTo(x + w * 0.38, top);
      ctx.lineTo(x + w * 0.45, top + 10);
      ctx.lineTo(x + w * 0.7, 480);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let k = 1; k <= 3; k++) {
        const y = top + k * 22;
        ctx.moveTo(x - w * 0.45 - k * 3, y);
        ctx.lineTo(x + w * 0.45 + k * 3, y);
      }
      ctx.stroke();
    }
  }

  /** A smoking volcano on the tallest far peak, its crater glowing and lava running down. */
  drawVolcano(ctx, pal, t) {
    const [px, py] = this.peak;
    ctx.fillStyle = lerpColor(pal.far, '#000000', 0.15);
    ctx.beginPath();
    ctx.moveTo(px - 170, py + 190);
    ctx.lineTo(px - 22, py - 18);
    ctx.lineTo(px + 22, py - 18);
    ctx.lineTo(px + 180, py + 190);
    ctx.closePath();
    ctx.fill();
    // plume of smoke drifting with the wind
    ctx.fillStyle = 'rgba(40,28,30,0.35)';
    ctx.beginPath();
    for (const p of this.plume) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
    const g = ctx.createRadialGradient(px, py - 18, 2, px, py - 18, 70);
    g.addColorStop(0, `rgba(255,170,80,${0.8 * pulse})`);
    g.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 70, py - 90, 140, 140);
    ctx.strokeStyle = `rgba(255,120,50,${0.65 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px - 8, py - 16);
    ctx.lineTo(px - 22, py + 20);
    ctx.lineTo(px - 18, py + 44);
    ctx.lineTo(px - 38, py + 80);
    ctx.moveTo(px + 10, py - 16);
    ctx.lineTo(px + 26, py + 30);
    ctx.lineTo(px + 44, py + 62);
    ctx.stroke();
    ctx.restore();
  }

  /** Northern lights rippling across the night sky (Karlı Geçit). */
  drawAurora(ctx, t, night, L, R) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bands = [['80,255,170', 90], ['90,200,255', 130], ['190,120,255', 165]];
    bands.forEach(([rgb, y0], i) => {
      for (const [w, a] of [[26, 0.07], [8, 0.16]]) {
        ctx.strokeStyle = `rgba(${rgb},${a * night})`;
        ctx.lineWidth = w;
        ctx.beginPath();
        for (let x = L; x <= R; x += 30) {
          const y = y0 + Math.sin(x * 0.004 + t * 0.25 + i * 1.7) * 26 + Math.sin(x * 0.011 - t * 0.4) * 8;
          if (x === L) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  /** Region ground cover: snow drifts, sand ripples or glowing lava cracks. */
  drawCover(ctx, pal, biome, night, t, L, R, visible) {
    if (biome.cover === 'snow') {
      ctx.fillStyle = lerpColor('#f4f8fc', pal.groundTop, 0.25 + night * 0.35);
      ctx.beginPath();
      ctx.moveTo(L, GROUND_Y + 8);
      for (let x = L; x <= R; x += 24) ctx.lineTo(x, GROUND_Y - 2 - Math.abs(Math.sin(x * 0.021)) * 4);
      ctx.lineTo(R, GROUND_Y + 8);
      for (let x = R; x >= L; x -= 24) ctx.lineTo(x, GROUND_Y + 7 + Math.sin(x * 0.033) * 2);
      ctx.fill();
    } else if (biome.cover === 'sand') {
      ctx.strokeStyle = 'rgba(255,230,180,0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let row = 0; row < 4; row++) {
        const y = GROUND_Y + 52 + row * 16;
        ctx.moveTo(L, y);
        for (let x = L; x <= R; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.03 + row) * 3);
      }
      ctx.stroke();
    } else if (biome.cover === 'ash') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      this.cracks.forEach((pts, i) => {
        if (!visible(pts[0][0], 80)) return;
        const pulse = 0.4 + 0.3 * Math.sin(t * 1.6 + i);
        ctx.strokeStyle = `rgba(255,110,40,${pulse})`;
        ctx.beginPath();
        pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  /** Boulders on the field's edge (snow-capped in the snow region). */
  drawRocks(ctx, pal, biome, visible) {
    const rock = lerpColor(pal.mid, pal.ground, 0.4);
    for (const [x, s, r] of this.rocks) {
      if (!visible(x, 20) || (x > 150 && x < 760)) continue; // keep the fighting ground clear
      const w = 13 * s;
      const h = 9 * s;
      ctx.fillStyle = rock;
      ctx.beginPath();
      ctx.moveTo(x - w, GROUND_Y + 3);
      ctx.lineTo(x - w * 0.7, GROUND_Y - h * 0.8);
      ctx.lineTo(x - w * 0.1 + r * 3, GROUND_Y - h);
      ctx.lineTo(x + w * 0.8, GROUND_Y - h * 0.5);
      ctx.lineTo(x + w, GROUND_Y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = biome.cover === 'snow' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.7, GROUND_Y - h * 0.8);
      ctx.lineTo(x - w * 0.1 + r * 3, GROUND_Y - h);
      ctx.lineTo(x + w * 0.5, GROUND_Y - h * 0.6);
      ctx.lineTo(x - w * 0.2, GROUND_Y - h * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Low shrubs along the horizon line: leafy, snowy, or dry twigs in the desert and ash. */
  drawBushes(ctx, pal, biome, visible) {
    const dry = biome.cover === 'sand' || biome.cover === 'ash';
    const color = lerpColor(pal.forest, pal.ground, 0.25);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [x, s] of this.bushes) {
      if (!visible(x, 20) || (x > 150 && x < 760)) continue;
      if (dry) {
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(x, GROUND_Y + 1);
          ctx.lineTo(x + i * 5 * s, GROUND_Y - (8 - Math.abs(i) * 2) * s);
        }
      } else {
        for (const [dx, dy, r] of [[-7, -5, 7], [0, -9, 8], [7, -5, 6]]) {
          ctx.moveTo(x + dx * s + r * s, GROUND_Y + dy * s);
          ctx.arc(x + dx * s, GROUND_Y + dy * s, r * s, 0, Math.PI * 2);
        }
      }
    }
    if (dry) ctx.stroke();
    else ctx.fill();
    if (biome.cover === 'snow') {
      ctx.fillStyle = 'rgba(245,248,252,0.9)';
      ctx.beginPath();
      for (const [x, s] of this.bushes) {
        if (!visible(x, 20) || (x > 150 && x < 760)) continue;
        ctx.moveTo(x + 9 * s, GROUND_Y - 9 * s);
        ctx.ellipse(x, GROUND_Y - 13 * s, 9 * s, 4 * s, 0, Math.PI, 0);
      }
      ctx.fill();
    }
  }

  /** Weather, then dark grass tufts along the bottom edge, drawn over everything for depth. */
  drawForeground(ctx, t, left = 0, viewW = WORLD_W) {
    // Low quality (Ayarlar → Görüntü) drops the weather particles and the vignette
    if (!this.low) this.weather.draw(ctx, Math.max(0, this.time - 1));
    ctx.fillStyle = '#0d0b12';
    ctx.beginPath();
    ctx.moveTo(left - 20, WORLD_H + 5);
    for (let x = left - 20; x <= left + viewW + 20; x += 9) {
      const h = 10 + ((x * 37) % 13) + Math.sin(t * 1.2 + x * 0.05) * 2;
      ctx.lineTo(x, WORLD_H - h);
      ctx.lineTo(x + 4.5, WORLD_H - 4);
    }
    ctx.lineTo(left + viewW + 20, WORLD_H + 5);
    ctx.fill();
    if (this.low) return;
    // Soft vignette pulls the eye to the middle of the field (deeper at night)
    const night = Math.max(0, this.time - 1);
    ctx.save();
    ctx.translate(left + viewW / 2, WORLD_H * 0.48);
    ctx.scale(1, (WORLD_H / viewW) * 1.25);
    const v = ctx.createRadialGradient(0, 0, viewW * 0.38, 0, 0, viewW * 0.72);
    v.addColorStop(0, 'rgba(8,6,16,0)');
    v.addColorStop(1, `rgba(8,6,16,${0.32 + night * 0.18})`);
    ctx.fillStyle = v;
    ctx.fillRect(-viewW, -viewW, viewW * 2, viewW * 2);
    ctx.restore();
  }

  /** Darkening overlay over the scenery so night actually feels dark. */
  drawNightTint(ctx, left = 0, viewW = WORLD_W) {
    const night = Math.max(0, this.time - 1);
    if (night <= 0) return;
    ctx.fillStyle = this.blood ? `rgba(60,0,10,${0.18 * night})` : `rgba(10,8,40,${0.22 * night})`;
    ctx.fillRect(left - 20, -20, viewW + 40, WORLD_H + 40);
  }
}

