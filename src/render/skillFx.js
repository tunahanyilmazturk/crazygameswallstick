import { WORLD_H, WORLD_W, GROUND_Y, WALL_TOP } from '../core/constants.js';
import { mulberry32, rand } from '../utils/math.js';

export const SKILL_COLORS = {
  rain: '#8fc8ff', warcry: '#ffb347', meteor: '#ff7a3c', shield: '#9fe3ff', freeze: '#bfe8ff', midas: '#ffd34d',
};

const DOME = { x: 130, rx: 280, ry: 340 };
const DOME_RISE = 0.55;
const HEX = 26;
const SIGIL_TIME = 0.8;
const TAU = Math.PI * 2;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function hexPoints() {
  const cells = [];
  const w = HEX * 1.73;
  for (let row = 0, y = GROUND_Y; y > GROUND_Y - DOME.ry - HEX; y -= HEX * 1.5, row++) {
    for (let x = DOME.x - DOME.rx - w + (row % 2 ? w / 2 : 0); x < DOME.x + DOME.rx + w; x += w) cells.push([x, y]);
  }
  return cells;
}

function frostShards() {
  const rng = mulberry32(19);
  return Array.from({ length: 46 }, () => ({ k: rng(), w: 10 + rng() * 22, h: 26 + rng() * 74, lean: rng() * 18 - 9, edge: rng() < 0.62 ? 0 : 1 }));
}

/**
 * Everything the skills draw: cast sigils, ground markers, the shield dome, the frozen field,
 * Midas's coins and meteor craters. Purely visual: SkillSystem decides what happens, this
 * only shows it, so the headless simulation can run it without a canvas.
 */
export class SkillFx {
  constructor(game) {
    this.game = game;
    this.hexes = hexPoints();
    this.shards = frostShards();
    this.clear();
  }

  clear() {
    this.sigils = [];
    this.markers = [];     // meteor and rain ground markers
    this.craters = [];
    this.ripples = [];     // shield impacts
    this.coins = [];
    this.warcryT = 9;      // time since the last war cry
    this.shieldT = 0;
    this.freezeT = 0;
    this.midasT = 0;
    this.was = { shield: false, freeze: false };
  }

  get low() {
    return this.game.state.settings.quality === 'low';
  }

  /** Every cast starts with a rune circle turning at the hero's feet. */
  sigil(key) {
    const { hero } = this.game;
    this.sigils.push({ x: hero.x, y: hero.y + 2, color: SKILL_COLORS[key], t: 0 });
  }

  // ---- cast hooks --------------------------------------------------------------

  rain(x) {
    this.sigil('rain');
    this.markers.push({ kind: 'rain', x0: x - 40, x1: x + 300, t: 0, life: 1.5 });
  }

  warcry() {
    this.sigil('warcry');
    this.warcryT = 0;
  }

  meteor(x, radius, flight) {
    this.sigil('meteor');
    this.markers.push({ kind: 'meteor', x, r: radius, t: 0, life: flight });
  }

  meteorImpact(x, radius) {
    const g = this.game;
    this.craters.push({ x, r: radius * 0.55, life: 7, max: 7 });
    if (this.craters.length > 3) this.craters.shift();
    for (const k of [0.45, 0.75, 1]) g.effects.rings.push({ x, y: GROUND_Y - 6, r: 14, max: radius * k * 1.25, life: 0.3 + k * 0.35, maxLife: 0.3 + k * 0.35, color: '#ffb36a' });
    g.effects.burst(x, GROUND_Y - 6, 26, { color: '#3a2a24', angleMin: -Math.PI * 0.92, angleMax: -Math.PI * 0.08, speedMin: 160, speedMax: 620, sizeMin: 2.5, sizeMax: 7, lifeMin: 0.6, lifeMax: 1.3 });
    g.effects.burst(x, GROUND_Y - 6, 28, { color: '#ff9a3c', angleMin: -Math.PI * 0.9, angleMax: -Math.PI * 0.1, speedMin: 90, speedMax: 460, sizeMin: 1.2, sizeMax: 3, lifeMin: 0.5, lifeMax: 1.2, glow: true });
    if (!g.reducedMotion) g.flashT = Math.max(g.flashT, 0.1);
  }

  shield() {
    const g = this.game;
    this.sigil('shield');
    this.shieldT = 0;
    g.effects.beam(DOME.x, SKILL_COLORS.shield, 1.3);
    for (let i = 0; i < 26; i++) {
      g.effects.burst(rand(0, 250), rand(WALL_TOP, GROUND_Y), 1, { color: i % 3 ? '#9fe39a' : '#dff7ff', angleMin: -1.9, angleMax: -1.2, speedMin: 30, speedMax: 110, gravity: -30, glow: true, lifeMin: 0.7, lifeMax: 1.4, sizeMin: 1.5, sizeMax: 3 });
    }
  }

  /** A blow stopped by the dome ripples across it. */
  shieldHit(y) {
    this.ripples.push({ y: Math.min(y, GROUND_Y - 30), t: 0 });
    if (this.ripples.length > 6) this.ripples.shift();
  }

  freeze() {
    const g = this.game;
    this.sigil('freeze');
    this.freezeT = 0;
    for (let i = 0; i < 60; i++) {
      g.effects.burst(rand(g.view.left, WORLD_W), rand(0, GROUND_Y), 1, { color: '#e6f6ff', speedMin: 2, speedMax: 12, gravity: 0, lifeMin: 1.5, lifeMax: 3, sizeMin: 1.2, sizeMax: 2.6, glow: true });
    }
  }

  midas() {
    this.sigil('midas');
    this.midasT = 0;
  }

  /** Under Midas a falling enemy bursts into gold. */
  goldKill(e) {
    this.game.effects.burst(e.x, e.centerY, 12, { color: '#ffd34d', speedMin: 40, speedMax: 200, gravity: 320, glow: true, lifeMin: 0.35, lifeMax: 0.8, sizeMin: 1.5, sizeMax: 3 });
  }

  // ---- per tick ------------------------------------------------------------------

  update(dt) {
    const g = this.game;
    const { active } = g.skills;
    this.warcryT += dt;
    this.shieldT += dt;
    this.freezeT += dt;
    this.midasT += dt;
    const live = (list) => list.filter((o) => (o.t += dt) < (o.life ?? SIGIL_TIME));
    this.sigils = live(this.sigils);
    this.markers = live(this.markers);
    this.ripples = this.ripples.filter((r) => (r.t += dt) < 0.6);
    for (const c of this.craters) {
      c.life -= dt;
      if (c.life > 2 && Math.random() < dt * 5) {
        g.effects.burst(c.x + rand(-c.r, c.r) * 0.7, GROUND_Y - 4, 1, { color: 'rgba(50,46,58,0.45)', angleMin: -1.9, angleMax: -1.2, speedMin: 8, speedMax: 28, gravity: -30, lifeMin: 0.9, lifeMax: 1.7, sizeMin: 4, sizeMax: 9, shrink: false });
      }
    }
    this.craters = this.craters.filter((c) => c.life > 0);

    // War cry: embers lift off the whole garrison while it lasts
    if (active.warcry > 0 && Math.random() < dt * 34) {
      g.effects.burst(rand(-200, 250), WALL_TOP - rand(0, 70), 1, { color: Math.random() < 0.5 ? '#ffb347' : '#ff7a3c', angleMin: -1.9, angleMax: -1.2, speedMin: 20, speedMax: 80, gravity: -50, glow: true, lifeMin: 0.5, lifeMax: 1.1, sizeMin: 1.2, sizeMax: 2.6 });
    }

    // The dome breaks into shards when it runs out, ice shatters when time resumes
    if (this.was.shield && active.shield <= 0) {
      for (let i = 0; i < 44; i++) {
        const a = Math.PI + (i / 44) * Math.PI;
        g.effects.burst(DOME.x + Math.cos(a) * DOME.rx, GROUND_Y + Math.sin(a) * DOME.ry, 1, { color: '#cfefff', speedMin: 30, speedMax: 150, gravity: 340, glow: true, lifeMin: 0.5, lifeMax: 1.1, sizeMin: 1.4, sizeMax: 3 });
      }
    }
    if (this.was.freeze && active.freeze <= 0) {
      for (const e of g.enemies) {
        if (!e.alive) continue;
        g.effects.burst(e.x, e.centerY, 9, { color: '#d6f1ff', speedMin: 50, speedMax: 220, gravity: 520, lifeMin: 0.3, lifeMax: 0.7, sizeMin: 1.5, sizeMax: 3.5 });
      }
      g.audio.play('frost');
    }
    this.was.shield = active.shield > 0;
    this.was.freeze = active.freeze > 0;

    // Midas: coins patter down over the field and glints run over the enemies
    if (active.midas > 0) {
      if (Math.random() < dt * 14 && this.coins.length < 60) {
        this.coins.push({ x: rand(g.view.left + 40, WORLD_W - 40), y: -20, vy: rand(180, 340), spin: rand(0, 6) });
      }
      for (const e of g.enemies) {
        if (e.alive && Math.random() < dt * 1.5) g.effects.sparks(e.x + rand(-8, 8), e.y - rand(8, e.h), 2, '#ffe28a');
      }
    }
    for (const c of this.coins) {
      c.vy += 260 * dt;
      c.y += c.vy * dt;
      c.spin += dt * 12;
      if (c.y >= GROUND_Y) g.effects.sparks(c.x, GROUND_Y - 2, 2, '#ffd34d');
    }
    this.coins = this.coins.filter((c) => c.y < GROUND_Y);
  }

  // ---- drawing --------------------------------------------------------------------

  /** Under the enemies: craters, target markers, rune circles. */
  drawGround(ctx) {
    for (const c of this.craters) this.drawCrater(ctx, c);
    for (const m of this.markers) (m.kind === 'meteor' ? this.drawMeteorMark : this.drawRainMark).call(this, ctx, m);
    for (const s of this.sigils) drawSigil(ctx, s);
  }

  /** Over everything else in the world. */
  draw(ctx, left, w) {
    const { active } = this.game.skills;
    if (active.midas > 0) this.drawMidas(ctx, left, w, active.midas);
    this.drawCoins(ctx);
    if (active.warcry > 0 || this.warcryT < 1) this.drawWarcry(ctx, left, w, active.warcry);
    if (active.shield > 0) this.drawDome(ctx, active.shield);
    if (active.freeze > 0) this.drawFreeze(ctx, left, w, active.freeze);
  }

  drawCrater(ctx, { x, r, life, max }) {
    const a = Math.min(1, life / 1.5);
    const heat = clamp01(1 - (max - life) / 3.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,11,14,0.78)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 4, r, r * 0.16, 0, 0, TAU);
    ctx.fill();
    if (heat > 0) {
      const g = ctx.createRadialGradient(x, GROUND_Y + 4, 2, x, GROUND_Y + 4, r * 0.8);
      g.addColorStop(0, `rgba(255,190,90,${0.85 * heat})`);
      g.addColorStop(1, 'rgba(255,70,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y + 4, r * 0.8, r * 0.13, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMeteorMark(ctx, { x, r, t, life }) {
    const k = t / life;
    const pulse = 0.65 + 0.35 * Math.sin(t * 16);
    const y = GROUND_Y + 2;
    ctx.save();
    // The shadow gathers as the rock comes down
    ctx.fillStyle = `rgba(10,6,8,${0.2 + 0.45 * k})`;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.25 + 0.55 * k), r * (0.05 + 0.1 * k), 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,110,60,${0.85 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.2, 0, 0, TAU);
    ctx.stroke();
    // A second ring closes in on the moment of impact
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,214,150,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1 - k * 0.9), r * 0.2 * (1 - k * 0.9), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawRainMark(ctx, { x0, x1, t, life }) {
    const a = Math.min(1, t * 4) * Math.min(1, (life - t) * 2);
    const cx = (x0 + x1) / 2;
    const rx = (x1 - x0) / 2;
    ctx.save();
    ctx.globalAlpha = a;
    // Storm front overhead
    const cloud = ctx.createLinearGradient(0, 0, 0, 130);
    cloud.addColorStop(0, 'rgba(26,30,48,0.6)');
    cloud.addColorStop(1, 'rgba(26,30,48,0)');
    ctx.fillStyle = cloud;
    ctx.fillRect(x0 - 70, 0, x1 - x0 + 140, 130);
    ctx.fillStyle = 'rgba(143,200,255,0.16)';
    ctx.strokeStyle = 'rgba(143,200,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, GROUND_Y + 3, rx, 14, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawWarcry(ctx, left, w, remaining) {
    const { hero, time } = this.game;
    const t = this.warcryT;
    const x = hero.x;
    const y = hero.y - 34;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (t < 1) {
      // Rays and rolling shock waves out of the shout
      const a = 1 - t;
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * TAU + 0.2;
        const r0 = 34 + t * 150;
        const r1 = r0 + 40 + 60 * ((i * 7) % 3) * (1 - t);
        ctx.strokeStyle = `rgba(255,170,70,${0.55 * a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0);
        ctx.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1);
        ctx.stroke();
      }
      for (const lag of [0, 0.18, 0.36]) {
        const k = clamp01((t - lag) / 0.64);
        if (k <= 0 || k >= 1) continue;
        ctx.strokeStyle = `rgba(255,190,100,${0.75 * (1 - k)})`;
        ctx.lineWidth = 7 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(x, y, 20 + k * 420, 0, TAU);
        ctx.stroke();
      }
    }
    if (remaining > 0) {
      const a = Math.min(1, remaining) * (0.32 + 0.1 * Math.sin(time * 7));
      const g = ctx.createRadialGradient(x, y + 16, 6, x, y + 16, 92);
      g.addColorStop(0, `rgba(255,150,60,${a})`);
      g.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 92, y - 76, 184, 184);
    }
    ctx.restore();
    if (remaining > 0) edgeGlow(ctx, left, w, '255,120,40', 0.2 * Math.min(1, remaining));
  }

  drawDome(ctx, remaining) {
    const { time } = this.game;
    const rise = clamp01(this.shieldT / DOME_RISE);
    const grow = 1 - (1 - rise) ** 3;
    // Flickers in its last moments so the player sees it failing
    const failing = remaining < 1.2 ? 0.55 + 0.45 * Math.sin(time * 34) : 1;
    const { x, rx, ry } = DOME;
    const shape = () => {
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y, rx * grow, ry * grow, 0, Math.PI, 0);
      ctx.closePath();
    };
    ctx.save();
    ctx.globalAlpha = failing * (0.75 + 0.1 * Math.sin(time * 5));
    const g = ctx.createRadialGradient(x, GROUND_Y, rx * 0.3 * grow, x, GROUND_Y, ry * grow);
    g.addColorStop(0, 'rgba(160,220,255,0)');
    g.addColorStop(0.8, 'rgba(160,220,255,0.16)');
    g.addColorStop(1, 'rgba(210,244,255,0.5)');
    ctx.fillStyle = g;
    shape();
    ctx.fill();

    ctx.save();
    shape();
    ctx.clip();
    if (!this.low) {
      // Hex lattice with a band of light climbing through it
      ctx.strokeStyle = 'rgba(190,235,255,0.2)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const [hx, hy] of this.hexes) hexPath(ctx, hx, hy, HEX);
      ctx.stroke();
      const band = GROUND_Y - ((time * 110) % (ry + 120));
      const sweep = ctx.createLinearGradient(0, band - 60, 0, band + 60);
      sweep.addColorStop(0, 'rgba(210,244,255,0)');
      sweep.addColorStop(0.5, 'rgba(210,244,255,0.26)');
      sweep.addColorStop(1, 'rgba(210,244,255,0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(x - rx, band - 60, rx * 2, 120);
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(226,247,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y, rx * grow, ry * grow, 0, Math.PI, 0);
    ctx.stroke();

    // Struck points spread a ripple over the surface
    for (const { y, t } of this.ripples) {
      const k = t / 0.6;
      const edgeX = x + rx * Math.sqrt(Math.max(0, 1 - ((GROUND_Y - y) / ry) ** 2));
      ctx.strokeStyle = `rgba(235,250,255,${1 - k})`;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(edgeX, y, 8 + k * 26, 16 + k * 70, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFreeze(ctx, left, w, remaining) {
    const g = this.game;
    const fade = Math.min(1, remaining * 2, this.freezeT * 3);
    const grow = 1 - (1 - clamp01(this.freezeT * 2.4)) ** 3;
    ctx.save();
    ctx.fillStyle = `rgba(150,200,255,${0.17 * fade})`;
    ctx.fillRect(left - 20, 0, w + 40, WORLD_H);

    for (const e of g.enemies) if (e.alive) drawIce(ctx, e, grow * fade);

    // Frost closing in from the top and bottom of the view
    ctx.globalAlpha = fade * 0.85;
    for (const s of this.shards) {
      const x = left + s.k * w;
      const h = s.h * grow;
      const y0 = s.edge ? WORLD_H + 2 : -2;
      const y1 = s.edge ? WORLD_H - h : h;
      const f = ctx.createLinearGradient(0, y0, 0, y1);
      f.addColorStop(0, 'rgba(226,246,255,0.8)');
      f.addColorStop(1, 'rgba(170,220,255,0)');
      ctx.fillStyle = f;
      ctx.beginPath();
      ctx.moveTo(x - s.w, y0);
      ctx.lineTo(x + s.lean, y1);
      ctx.lineTo(x + s.w, y0);
      ctx.fill();
    }

    // A clock in the sky runs backward while time stands still
    const cx = g.viewCenterX ?? left + w / 2;
    const cy = 224;
    const r = 86 * grow;
    ctx.globalAlpha = fade * 0.5;
    ctx.strokeStyle = '#e6f6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.moveTo(cx + r * 0.84, cy);
    ctx.arc(cx, cy, r * 0.84, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      ctx.moveTo(cx + Math.cos(a) * r * 0.84, cy + Math.sin(a) * r * 0.84);
      ctx.lineTo(cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
    }
    ctx.stroke();
    const hand = -this.freezeT * 2.6 - Math.PI / 2;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hand) * r * 0.66, cy + Math.sin(hand) * r * 0.66);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hand / 12) * r * 0.42, cy + Math.sin(hand / 12) * r * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  drawMidas(ctx, left, w, remaining) {
    const { time } = this.game;
    const a = Math.min(1, remaining) * Math.min(1, this.midasT * 2);
    const cx = left + w / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Slow golden god rays from above the field
    for (let i = 0; i < 6; i++) {
      const x = cx + Math.sin(time * 0.35 + i * 1.9) * w * 0.45;
      const spread = 70 + 30 * Math.sin(time * 0.8 + i);
      const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      g.addColorStop(0, `rgba(255,210,90,${0.17 * a})`);
      g.addColorStop(1, 'rgba(255,190,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 26, 0);
      ctx.lineTo(x + 26, 0);
      ctx.lineTo(x + spread, GROUND_Y);
      ctx.lineTo(x - spread, GROUND_Y);
      ctx.fill();
    }
    ctx.restore();
    edgeGlow(ctx, left, w, '255,200,70', 0.18 * a);
  }

  drawCoins(ctx) {
    for (const c of this.coins) {
      const spin = Math.abs(Math.cos(c.spin));
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 5.5 * spin + 1, 5.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 4 * spin + 0.6, 4, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function drawSigil(ctx, { x, y, color, t }) {
  const k = t / SIGIL_TIME;
  const grow = 1 - (1 - clamp01(k * 3)) ** 3;
  const r = 62 * grow;
  const spin = t * 3.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.3);
  ctx.globalAlpha = Math.min(1, (1 - k) * 2.5);
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.moveTo(r * 0.72, 0);
  ctx.arc(0, 0, r * 0.72, 0, TAU);
  ctx.stroke();
  // Rune marks turning between the rings, a six-point star inside them
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = spin + (i / 12) * TAU;
    ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
    ctx.lineTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94);
  }
  for (const off of [0, Math.PI / 3]) {
    for (let i = 0; i <= 3; i++) {
      const a = -spin * 0.6 + off + (i / 3) * TAU;
      if (i) ctx.lineTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
      else ctx.moveTo(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Crystal shell around a frozen enemy; bosses only frost over, as they keep walking. */
function drawIce(ctx, e, k) {
  const hw = e.w * 0.72 + 3;
  const h = (e.boss ? e.h * 0.4 : e.h + 7) * k;
  const base = e.y + 3;
  ctx.fillStyle = 'rgba(190,232,255,0.42)';
  ctx.strokeStyle = 'rgba(235,250,255,0.85)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(e.x - hw, base);
  ctx.lineTo(e.x - hw * 1.05, base - h * 0.62);
  ctx.lineTo(e.x - hw * 0.38, base - h * 0.82);
  ctx.lineTo(e.x - hw * 0.1, base - h);
  ctx.lineTo(e.x + hw * 0.52, base - h * 0.78);
  ctx.lineTo(e.x + hw * 1.04, base - h * 0.5);
  ctx.lineTo(e.x + hw, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(e.x - hw * 0.5, base - h * 0.15);
  ctx.lineTo(e.x - hw * 0.1, base - h * 0.92);
  ctx.moveTo(e.x + hw * 0.4, base - h * 0.2);
  ctx.lineTo(e.x + hw * 0.52, base - h * 0.72);
  ctx.stroke();
}

function hexPath(ctx, x, y, r) {
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 6 + (i / 6) * TAU;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
}

/** Soft tint on the edges of the view, leaving the action in the middle clear. */
function edgeGlow(ctx, left, w, rgb, alpha) {
  const cx = left + w / 2;
  const g = ctx.createRadialGradient(cx, WORLD_H * 0.45, WORLD_H * 0.45, cx, WORLD_H * 0.45, w * 0.62);
  g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(1, `rgba(${rgb},${alpha})`);
  ctx.fillStyle = g;
  ctx.fillRect(left - 20, 0, w + 40, WORLD_H);
}
