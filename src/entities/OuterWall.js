import { GROUND_Y, GRAVITY, INK } from '../core/constants.js';
import { rand, lerpColor, mulberry32 } from '../utils/math.js';
import { frontmost, leadShot } from '../systems/Targeting.js';
import { bowCycle, drawArcher } from '../render/archer.js';
import { Projectile } from './Projectile.js';
import { damageStage, drawBreach, drawCracks, drawFire, drawRubble, drawScorch, clipBrokenTop, crumble } from '../render/battleDamage.js';
import { tr } from '../i18n/i18n.js';

/*
 * Dış Sur: a wall with a gate in front of the castle, right behind the shield infantry.
 * Ground enemies (siege engines too) must break it before they reach the castle; flyers
 * pass over. Sur Okçuları shoot from its top while it stands. It grows from a wooden
 * palisade into a stone wall and then a towered rampart (OUTER_TIERS). A broken wall is
 * rebuilt at half strength when the next wave starts.
 */
export const OUTER = { x0: 380, x1: 452, gate: 418 };
export const OUTER_TIERS = [10, 25]; // Dış Sur levels for stone, then towers
const TOPS = [528, 516, 506];       // walkway height per tier (wood, stone, towered)
const ARCHER_X = [392, 414, 436];
const REBUILD = 0.5;
const RISE = 0.9;                   // seconds a rebuilt wall takes to rise
const MORTAR = '#121016';
const TIER_STONE = ['#7f786f', '#7f786f', '#a0967f']; // palisade colours come from timber
// Cracks in stone tiers, drawn for the middle tier's walkway and shifted with `top`
const OUTER_CRACKS = [
  [[446, 528], [438, 544], [444, 556], [434, 578]],
  [[392, 530], [401, 548], [395, 562]],
  [[424, 522], [416, 536], [421, 546]],
  [[388, 566], [398, 582], [392, 596]],
];

const tierOf = (level) => OUTER_TIERS.filter((t) => level >= t).length;

class WallArcher {
  constructor(x) {
    this.x = x;
    this.cd = rand(0.3, 1.2);
    this.theta = -0.2;
    this.t = rand(0, 10);
    this.period = 1;
    this.since = 9; // time since the last shot (drives the bow cycle)
    this.alert = 0;
  }

  update(dt, game, st, y) {
    this.t += dt;
    this.cd -= dt * game.skills.rateMult;
    this.since += dt * game.skills.rateMult;
    this.period = 1 / st.rate;
    const target = frontmost(game.enemies);
    this.alert += ((target ? 1 : 0) - this.alert) * Math.min(1, dt * 3);
    if (!target) {
      this.cd = Math.max(this.cd, 0.2);
      return;
    }
    const sx = this.x + 2;
    const sy = y - 36;
    const shot = leadShot(sx, sy, target, GRAVITY, 1200, 0.25, 1.3);
    this.theta += (Math.atan2(shot.vy, shot.vx) - this.theta) * Math.min(1, dt * 10);
    if (this.cd > 0) return;
    this.cd = this.period;
    this.since = 0;
    game.addProjectile(new Projectile('arrow', sx, sy, shot.vx, shot.vy, { damage: st.damage }));
    game.audio.play('bow');
  }

  draw(ctx, y) {
    const c = bowCycle(this.since, this.period, 1 - this.alert);
    drawArcher(ctx, this.x, y, this.theta + (1 - this.alert) * 0.3, c.pull, {
      s: 0.85, hood: '#8a6a2e', accent: '#8a6a2e', t: this.t, quiver: true, lean: -0.05 - c.release * 0.08, ...c,
    });
  }
}

export class OuterWall {
  constructor() {
    this.level = 0;
    this.maxHp = 1;
    this.hp = 1;
    this.alive = false;
    this.armor = 0;
    this.gateLevel = 0;
    this.regen = 0;
    this.flash = 0;
    this.open = 0;       // gate opening 0..1 (the knight rides through)
    this.t = 0;
    this.archers = [];
    this.archerStats = null;
    this.jolt = 0;        // sideways shudder after a hit
    this.riseT = 0;       // rebuild animation
    this.lastHitY = 560;
    this.shownStage = 0;

    const rng = mulberry32(131);
    this.logs = [];
    for (let x = OUTER.x0, i = 0; x < OUTER.x1; x += 6, i++) {
      // Which stage knocks this log down to a stump (4 = only when the wall falls)
      const roll = rng();
      this.logs.push({ x, dark: i % 2 === 1, drop: (x * 7) % 5, lean: rng() * 3 - 1.5, lost: roll < 0.16 ? 2 : roll < 0.42 ? 3 : 4, stump: 16 + rng() * 26 });
    }
    this.stones = [];
    for (let y = 498, row = 0; y < GROUND_Y; y += 13, row++) {
      let x = OUTER.x0 - (row % 2 ? 7 : 0);
      while (x < OUTER.x1) {
        const w = 11 + rng() * 9;
        const bx = Math.max(x, OUTER.x0);
        const bw = Math.min(x + w, OUTER.x1) - bx;
        if (bw > 2) this.stones.push([bx, y, bw, 13, (rng() - 0.5) * 0.2]);
        x += w;
      }
    }
    const jag = (y0, y1) => {
      const line = [[OUTER.x0 - 16, y1 + 30]];
      for (let x = OUTER.x0 - 12; x <= OUTER.x1 + 12; x += 9) line.push([x, y0 + rng() * (y1 - y0)]);
      line.push([OUTER.x1 + 16, y1 + 30]);
      return line;
    };
    this.skyline = jag(500, 534);        // stage 3: top knocked in, wall still stands
    this.ruinLine = jag(GROUND_Y - 58, GROUND_Y - 18);
    this.rubble = Array.from({ length: 14 }, () => [OUTER.x0 - 12 + rng() * (OUTER.x1 - OUTER.x0 + 30), 3 + rng() * 5, (rng() - 0.5) * 1.5]);
  }

  get stage() {
    return damageStage(this.hp / this.maxHp);
  }

  get built() {
    return this.level > 0;
  }

  get tier() {
    return tierOf(this.level);
  }

  get top() {
    return TOPS[this.tier];
  }

  get halfW() {
    return 0;
  }

  get hitY() {
    return rand(this.top + 14, GROUND_Y - 12);
  }

  /** st: stats.castle.outer, or null when no wall has been built. */
  sync(st) {
    const wasBuilt = this.built;
    this.level = st ? st.level : 0;
    if (!st) {
      this.alive = false;
      this.archers = [];
      return;
    }
    const ratio = wasBuilt ? this.hp / this.maxHp : 1;
    this.maxHp = st.hp;
    this.hp = this.alive || !wasBuilt ? Math.max(1, ratio * st.hp) : this.hp;
    if (!wasBuilt) this.alive = true;
    this.armor = st.armor;
    this.gateLevel = st.gateLevel;
    this.regen = st.regen;
    this.archerStats = st.archers;
    const want = st.archers ? st.archers.count : 0;
    while (this.archers.length < want) this.archers.push(new WallArcher(ARCHER_X[this.archers.length]));
    this.archers.length = want;
  }

  takeDamage(amount, game, y) {
    if (!this.alive) return 0;
    const dealt = amount * (1 - this.armor);
    const before = this.stage;
    this.hp -= dealt;
    this.flash = 0.12;
    this.jolt = 1;
    if (y != null) this.lastHitY = y;
    if (this.hp <= 0) this.collapse(game);
    else if (this.stage > before) this.giveWay(game);
    return dealt;
  }

  heal(amount) {
    if (this.alive) this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  /** A section falls away as the wall reaches a worse stage. */
  giveWay(game) {
    crumble(game.effects, OUTER.x1 - 10, this.top + 20, 0.8 + this.stage * 0.4, this.chunkColors());
    game.shake(1.5 + this.stage);
    game.audio.play('crumble');
  }

  chunkColors() {
    return this.tier ? [TIER_STONE[this.tier], lerpColor(TIER_STONE[this.tier], MORTAR, 0.35)] : ['#6b4a2e', '#3b2a1c'];
  }

  collapse(game) {
    this.hp = 0;
    this.alive = false;
    for (const x of [OUTER.x0 + 8, OUTER.gate, OUTER.x1 - 6]) crumble(game.effects, x, this.top + 30, 2, this.chunkColors());
    game.effects.rings.push({ x: OUTER.gate, y: GROUND_Y - 10, r: 12, max: 90, life: 0.45, maxLife: 0.45 });
    game.effects.text(OUTER.gate, this.top - 30, tr('Dış sur yıkıldı!'), '#ff8a6a', 20);
    game.shake(8);
    game.audio.play('crumble');
  }

  /** At the start of a wave a broken wall is patched back up. */
  rebuild(game, full = false) {
    if (!this.built || (this.alive && !full)) return;
    const fresh = !this.alive;
    this.alive = true;
    this.hp = full ? this.maxHp : Math.max(this.hp, this.maxHp * REBUILD);
    if (fresh) {
      this.riseT = RISE;
      game.effects.dust(OUTER.gate, GROUND_Y, 3);
      game.effects.burst(OUTER.gate, this.top + 20, 14, { color: '#ffe9a8', speedMin: 30, speedMax: 110, gravity: -50, glow: true });
      game.effects.text(OUTER.gate, this.top - 30, tr('Dış sur onarıldı'), '#9fe3a8', 16);
    }
  }

  update(dt, game) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.jolt = Math.max(0, this.jolt - dt * 5);
    this.riseT = Math.max(0, this.riseT - dt);
    // The wall smokes while it is hurt, and its ruins keep smouldering
    if (this.built && (this.stage >= 2 || !this.alive) && Math.random() < dt * (this.alive ? this.stage * 2.5 : 3)) {
      game.effects.burst(rand(OUTER.x0, OUTER.x1), this.alive ? this.top + 16 : GROUND_Y - 22, 1, { color: 'rgba(50,46,58,0.5)', speedMin: 8, speedMax: 26, angleMin: -Math.PI * 0.7, angleMax: -Math.PI * 0.3, lifeMin: 1, lifeMax: 2, gravity: -40, drag: 0.5, sizeMin: 5, sizeMax: 10, shrink: false });
    }
    // The gate swings open while the knight rides through it
    const k = game.knight;
    const near = k && k.state !== 'idle' && Math.abs(k.x - OUTER.gate) < 90;
    this.open = Math.max(0, Math.min(1, this.open + (near ? dt * 6 : -dt * 3)));
    if (!this.alive) return;
    this.heal(this.regen * dt);
    if (this.archerStats) for (const a of this.archers) a.update(dt, game, this.archerStats, this.top);
  }

  // ---- drawing ------------------------------------------------------------------

  draw(ctx, pal, night) {
    if (!this.built) return;
    if (!this.alive) return this.drawRuins(ctx, pal, night);
    const top = this.top;
    const look = this.colors(pal, night);

    ctx.save();
    // Newly rebuilt walls rise out of the ground; a hit jolts them sideways
    const rise = this.riseT / RISE;
    if (rise > 0) {
      ctx.beginPath();
      ctx.rect(OUTER.x0 - 30, GROUND_Y - (1 - rise) * (GROUND_Y - top + 90), OUTER.x1 - OUTER.x0 + 60, 200 + GROUND_Y);
      ctx.clip();
    }
    if (this.jolt > 0) ctx.translate(Math.sin(this.t * 70) * this.jolt * 2.5, 0);
    if (this.tier === 0) this.drawPalisade(ctx, look);
    else this.drawStone(ctx, look, night);
    this.drawGate(ctx, OUTER.gate, night);
    this.drawWounds(ctx, look);
    ctx.restore();

    if (this.flash > 0) {
      const g = ctx.createRadialGradient(OUTER.x1, this.lastHitY, 2, OUTER.x1, this.lastHitY, 44);
      g.addColorStop(0, `rgba(255,120,80,${this.flash * 5})`);
      g.addColorStop(1, 'rgba(255,120,80,0)');
      ctx.fillStyle = g;
      ctx.fillRect(OUTER.x1 - 44, this.lastHitY - 44, 88, 88);
    }
    this.drawTorch(ctx, top, night);
    for (const a of this.archers) a.draw(ctx, top);
    if (this.hp < this.maxHp) this.drawBar(ctx, top);
  }

  colors(pal, night) {
    const base = TIER_STONE[this.tier];
    const stone = pal ? lerpColor(base, pal.near, 0.26 + night * 0.2) : base;
    return {
      stone,
      mortar: lerpColor(stone, MORTAR, 0.38),
      trim: lerpColor(stone, '#f1e6cf', 0.3),
      wood: lerpColor('#7a5534', '#1c1820', 0.15 + night * 0.4),
      dark: lerpColor('#3b2a1c', MORTAR, 0.2 + night * 0.3),
      roof: pal ? lerpColor('#34508f', pal.near, 0.3 + night * 0.3) : '#34508f',
    };
  }

  /** Sharpened logs on an earth bank; a battered palisade loses logs down to stumps. */
  drawPalisade(ctx, { wood, dark }) {
    const { x0, x1 } = OUTER;
    const top = this.top;
    const stage = this.stage;
    // Walkway on trestles behind the logs
    ctx.fillStyle = dark;
    ctx.fillRect(x0 - 3, top, x1 - x0 + 6, 4);
    for (let x = x0 + 6; x < x1; x += 22) ctx.fillRect(x, top, 3, GROUND_Y - top);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x0, top + 4, x1 - x0, GROUND_Y - top - 4);
    for (const log of this.logs) {
      const lost = log.lost <= stage;
      const h = lost ? GROUND_Y - log.stump : top - 7 + log.drop;
      const x = log.x + (lost ? 0 : log.lean * stage * 0.5);
      ctx.fillStyle = log.dark ? lerpColor(wood, '#000000', 0.16) : wood;
      ctx.fillRect(log.x, h, 6, GROUND_Y - h + 2);
      ctx.beginPath();
      if (lost) {
        // Splintered stump
        ctx.moveTo(log.x, h);
        ctx.lineTo(log.x + 2, h - 5);
        ctx.lineTo(log.x + 3.5, h - 1);
        ctx.lineTo(log.x + 6, h - 4);
        ctx.lineTo(log.x + 6, h);
      } else {
        ctx.moveTo(log.x, h);
        ctx.lineTo(x + 3, h - 8);
        ctx.lineTo(log.x + 6, h);
      }
      ctx.fill();
      // Round log: shaded left side, lit right side
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(log.x, h, 1.6, GROUND_Y - h);
      ctx.fillStyle = 'rgba(255,235,200,0.14)';
      ctx.fillRect(log.x + 4, h, 1.2, GROUND_Y - h);
    }
    // Lashed rails, only where logs still stand to carry them
    ctx.fillStyle = dark;
    const standing = (x) => this.logs.find((l) => l.x + 6 > x && l.x <= x)?.lost > stage;
    for (const y of [top + 16, GROUND_Y - 30]) {
      for (const log of this.logs) if (standing(log.x) || y > top + 40) ctx.fillRect(log.x, y, 6, 4);
      ctx.fillStyle = '#c9b48a';
      for (const log of this.logs) if (log.x % 18 === x0 % 18 && (standing(log.x) || y > top + 40)) ctx.fillRect(log.x + 2, y - 1, 2, 6);
      ctx.fillStyle = dark;
    }
    // Earth bank
    ctx.fillStyle = lerpColor(dark, '#6b5a3c', 0.45);
    ctx.beginPath();
    ctx.moveTo(x0 - 14, GROUND_Y + 2);
    ctx.quadraticCurveTo(x0, GROUND_Y - 13, x0 + 14, GROUND_Y - 10);
    ctx.lineTo(x1 - 14, GROUND_Y - 10);
    ctx.quadraticCurveTo(x1, GROUND_Y - 13, x1 + 14, GROUND_Y + 2);
    ctx.fill();
  }

  /** Dressed stone curtain; from the third tier two round turrets close its ends. */
  drawStone(ctx, { stone, mortar, trim, roof }, night) {
    const { x0, x1 } = OUTER;
    const top = this.top;
    const stage = this.stage;
    ctx.save();
    if (stage >= 3) clipBrokenTop(ctx, x0 - 16, x1 + 16, this.skyline);
    ctx.fillStyle = mortar;
    ctx.fillRect(x0, top, x1 - x0, GROUND_Y - top + 2);
    ctx.fillStyle = stone;
    ctx.beginPath();
    for (const [x, y, w, h] of this.stones) if (y + h > top) ctx.rect(x + 0.7, Math.max(y, top) + 0.7, w - 1.4, h - 1.4);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.beginPath();
    for (const [x, y, w, h, s] of this.stones) if (s < -0.04 && y + h > top) ctx.rect(x + 0.7, Math.max(y, top) + 0.7, w - 1.4, h - 1.4);
    ctx.fill();
    // Cornice, corbels and crenellations
    ctx.fillStyle = trim;
    ctx.fillRect(x0 - 4, top, x1 - x0 + 8, 6);
    for (let x = x0; x < x1 - 2; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, top + 6);
      ctx.lineTo(x + 6, top + 6);
      ctx.lineTo(x + 3, top + 12);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(x0, top + 6, x1 - x0, 1.5);
    const broken = stage >= 2 ? [1, 4] : [];
    ctx.fillStyle = stone;
    for (let i = 0, x = x0 - 4; x < x1; x += 12, i++) {
      if (broken.includes(i)) continue;
      ctx.fillRect(x, top - 8, 7, 9);
    }
    // Battered foot
    ctx.fillStyle = lerpColor(stone, MORTAR, 0.26);
    ctx.beginPath();
    ctx.moveTo(x0, GROUND_Y - 20);
    ctx.lineTo(x1, GROUND_Y - 20);
    ctx.lineTo(x1 + 8, GROUND_Y + 2);
    ctx.lineTo(x0 - 6, GROUND_Y + 2);
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(x0, GROUND_Y - 20, x1 - x0, 2);
    if (this.tier >= 2) for (const tx of [x0 - 8, x1 - 8]) this.drawTurret(ctx, tx, top, stone, mortar, roof, night, stage);
    // Cylinder light across the whole wall, from the right as on the castle
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.26)');
    g.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(255,225,180,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, top, x1 - x0, GROUND_Y - top);
    ctx.restore();
    if (this.tier >= 2 && stage < 3) this.drawPennant(ctx, x1 - 1, top);
  }

  drawTurret(ctx, x, top, stone, mortar, roof, night, stage) {
    const w = 18;
    const y0 = top - 26;
    ctx.fillStyle = stone;
    ctx.fillRect(x, y0, w, GROUND_Y - y0);
    ctx.strokeStyle = mortar;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = y0 + 12; y < GROUND_Y; y += 13) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + w / 2, y + 3, x + w, y);
    }
    ctx.stroke();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.65, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, w, GROUND_Y - y0);
    ctx.fillStyle = `rgba(255,190,90,${0.35 + 0.6 * night})`;
    ctx.fillRect(x + 7, y0 + 8, 4, 8);
    // A burnt-out turret has lost its roof down to the rafters
    if (stage >= 2) {
      ctx.strokeStyle = '#1c1820';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 2, y0);
      ctx.lineTo(x + w / 2, y0 - 16);
      ctx.moveTo(x + w + 2, y0);
      ctx.lineTo(x + w / 2 + 4, y0 - 9);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x - 3, y0);
    ctx.lineTo(x + w / 2, y0 - 24);
    ctx.lineTo(x + w + 3, y0);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.moveTo(x - 3, y0);
    ctx.lineTo(x + w / 2, y0 - 24);
    ctx.lineTo(x + w / 2, y0);
    ctx.fill();
  }

  drawPennant(ctx, x, top) {
    const wave = Math.sin(this.t * 3) * 2;
    const y = top - 50;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 16, y - 14 + wave);
    ctx.lineTo(x, y - 9);
    ctx.fill();
  }

  /** Cracks, breaches and fires for the current stage (the structure itself is already drawn). */
  drawWounds(ctx, { stone }) {
    const stage = this.stage;
    if (!stage) return;
    const top = this.top;
    const wood = this.tier === 0;
    if (!wood) {
      const dy = top - TOPS[1];
      drawCracks(ctx, OUTER_CRACKS.map((p) => p.map(([x, y]) => [x, y + dy])), stage + 1);
      if (stage >= 2) drawBreach(ctx, 396, top + 28, 8, stone);
      if (stage >= 3) drawBreach(ctx, 441, top + 22, 9, stone);
    }
    if (stage >= 2) drawScorch(ctx, 400, top + 40, 26, 0.45);
    if (stage >= 3) {
      drawFire(ctx, 394, wood ? GROUND_Y - 24 : top + 6, 0.8, this.t);
      drawFire(ctx, 440, wood ? GROUND_Y - 34 : top + 2, 0.65, this.t + 2);
    }
  }

  drawTorch(ctx, top, night) {
    const { x1 } = OUTER;
    const flick = Math.sin(this.t * 13) * 1.5;
    const g = ctx.createRadialGradient(x1 + 2, top + 16, 2, x1 + 2, top + 16, 34);
    g.addColorStop(0, `rgba(255,190,90,${0.25 + 0.3 * night})`);
    g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x1 - 34, top - 18, 70, 70);
    ctx.fillStyle = '#3b2a1c';
    ctx.fillRect(x1 + 1, top + 18, 2.5, 12);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.ellipse(x1 + 2, top + 14 - flick * 0.4, 3, 5 + flick * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Pointed gate: wooden, iron-banded from level 10, a full portcullis from 25. */
  drawGate(ctx, cx, night) {
    const r = 12;
    const spring = GROUND_Y - 28;
    const arch = () => {
      ctx.beginPath();
      ctx.moveTo(cx - r, GROUND_Y);
      ctx.lineTo(cx - r, spring);
      ctx.quadraticCurveTo(cx - r, spring - r * 0.85, cx, spring - r * 1.3);
      ctx.quadraticCurveTo(cx + r, spring - r * 0.85, cx + r, spring);
      ctx.lineTo(cx + r, GROUND_Y);
      ctx.closePath();
    };
    ctx.fillStyle = '#0d0b10';
    arch();
    ctx.fill();
    // Doors fold back as the gate opens
    const open = this.open;
    const doorW = r * (1 - open * 0.85);
    const roofY = spring - r * 1.3;
    ctx.fillStyle = lerpColor('#6a4426', '#1c1820', 0.2 + night * 0.35);
    ctx.save();
    arch();
    ctx.clip();
    ctx.fillRect(cx - r, roofY, doorW, GROUND_Y - roofY);
    ctx.fillRect(cx + r - doorW, roofY, doorW, GROUND_Y - roofY);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = cx - r + 5; x < cx - r + doorW; x += 5) ctx.fillRect(x, roofY, 1, GROUND_Y);
    for (let x = cx + r - doorW + 4; x < cx + r; x += 5) ctx.fillRect(x, roofY, 1, GROUND_Y);
    if (this.gateLevel >= 10) {
      ctx.fillStyle = '#26242c';
      for (const y of [spring + 2, spring + 18]) {
        ctx.fillRect(cx - r, y, doorW, 3);
        ctx.fillRect(cx + r - doorW, y, doorW, 3);
      }
    }
    // A hard-pressed gate is split down the middle
    if (this.stage >= 2 && open < 0.3) {
      ctx.fillStyle = '#0d0b10';
      ctx.beginPath();
      ctx.moveTo(cx - 3, spring - 8);
      ctx.lineTo(cx + 3, spring + 2);
      ctx.lineTo(cx - 2, spring + 10);
      ctx.lineTo(cx + 4, spring + (this.stage >= 3 ? 28 : 18));
      ctx.lineTo(cx - 5, spring + 8);
      ctx.closePath();
      ctx.fill();
    }
    if (this.gateLevel >= 25) {
      // Portcullis drawn up into the arch while the gate is open
      ctx.strokeStyle = '#1a1820';
      ctx.lineWidth = 1.5;
      const lift = open * 34;
      ctx.beginPath();
      for (let x = cx - r + 3; x < cx + r; x += 5) {
        ctx.moveTo(x, roofY);
        ctx.lineTo(x, GROUND_Y - lift);
      }
      for (let y = spring - 6; y < GROUND_Y - lift; y += 7) {
        ctx.moveTo(cx - r, y);
        ctx.lineTo(cx + r, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Moulded surround on stone walls, heavy timber on the palisade
    ctx.strokeStyle = this.tier ? lerpColor('#c9bca0', '#1c1820', 0.1 + night * 0.4) : '#3b2a1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - r - 1.5, GROUND_Y);
    ctx.lineTo(cx - r - 1.5, spring);
    ctx.quadraticCurveTo(cx - r - 1.5, spring - r * 0.9, cx, spring - r * 1.42);
    ctx.quadraticCurveTo(cx + r + 1.5, spring - r * 0.9, cx + r + 1.5, spring);
    ctx.lineTo(cx + r + 1.5, GROUND_Y);
    ctx.stroke();
  }

  drawBar(ctx, top) {
    const w = 46;
    const x = OUTER.gate - w / 2;
    const y = top - (this.tier >= 2 ? 70 : 20) - (this.archers.length ? 52 : 0);
    const r = this.hp / this.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = r > 0.5 ? '#5fa8ff' : r > 0.25 ? '#ffb347' : '#ff5a4a';
    ctx.fillRect(x, y, w * r, 4);
  }

  /** What is left standing: charred stumps and logs, or a jagged stump of masonry. */
  drawRuins(ctx, pal, night) {
    const { x0, x1 } = OUTER;
    const look = this.colors(pal, night);
    if (this.tier === 0) {
      const char = lerpColor(look.wood, '#121016', 0.6);
      ctx.fillStyle = char;
      for (const log of this.logs) {
        const h = GROUND_Y - log.stump;
        ctx.fillRect(log.x, h, 6, GROUND_Y - h + 2);
      }
      ctx.fillStyle = lerpColor(look.dark, '#6b5a3c', 0.45);
      ctx.beginPath();
      ctx.moveTo(x0 - 14, GROUND_Y + 2);
      ctx.quadraticCurveTo((x0 + x1) / 2, GROUND_Y - 12, x1 + 14, GROUND_Y + 2);
      ctx.fill();
      // Logs that fell across the road
      ctx.strokeStyle = char;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [x, a] of [[x0 + 10, 0.2], [x0 + 34, -0.14], [x1 - 6, 0.1]]) {
        ctx.moveTo(x - Math.cos(a) * 18, GROUND_Y - 4 - Math.sin(a) * 18);
        ctx.lineTo(x + Math.cos(a) * 18, GROUND_Y - 4 + Math.sin(a) * 18);
      }
      ctx.stroke();
    } else {
      ctx.save();
      clipBrokenTop(ctx, x0 - 16, x1 + 16, this.ruinLine);
      ctx.fillStyle = look.mortar;
      ctx.fillRect(x0, GROUND_Y - 60, x1 - x0, 62);
      ctx.fillStyle = lerpColor(look.stone, MORTAR, 0.2);
      ctx.beginPath();
      for (const [x, y, w, h] of this.stones) if (y + h > GROUND_Y - 60) ctx.rect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
      ctx.fill();
      ctx.restore();
    }
    drawRubble(ctx, this.rubble, this.rubble.length, this.tier ? lerpColor(look.stone, MORTAR, 0.3) : lerpColor(look.wood, '#121016', 0.45));
  }
}
