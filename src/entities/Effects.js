import { GROUND_Y, INK } from '../core/constants.js';
import { rand } from '../utils/math.js';

/** Particles, floating numbers, stuck arrows and shockwave rings. */
export class Effects {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.stuck = [];
    this.rings = [];
    this.pools = [];
    this.coins = [];
    this.beams = [];
    this.bolts = [];
    this.coinsArrived = 0;
  }

  /** Jagged lightning through a chain of points (Fırtına Büyücüsü). */
  lightning(points) {
    if (this.bolts.length > 10) this.bolts.shift();
    // Pre-jag each segment so the bolt keeps its shape while it fades
    const path = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      for (let k = 1; k <= 4; k++) {
        const t = k / 5;
        path.push([x0 + (x1 - x0) * t + rand(-7, 7), y0 + (y1 - y0) * t + rand(-7, 7)]);
      }
      path.push([x1, y1]);
      this.sparks(x1, y1, 4, '#bfe3ff');
    }
    this.bolts.push({ path, life: 0.22, max: 0.22 });
  }

  /** Light pillar in a rarity colour where loot dropped. */
  beam(x, color, life = 1.2) {
    if (this.beams.length > 8) this.beams.shift();
    this.beams.push({ x, color, life, max: life });
    this.burst(x, GROUND_Y - 6, 10, { color, angleMin: -Math.PI * 0.85, angleMax: -Math.PI * 0.15, speedMin: 40, speedMax: 150, gravity: 120, glow: true, lifeMin: 0.5, lifeMax: 1, sizeMin: 1.2, sizeMax: 2.6 });
  }

  clear() {
    this.beams.length = 0;
    this.bolts.length = 0;
    this.particles.length = 0;
    this.texts.length = 0;
    this.stuck.length = 0;
    this.rings.length = 0;
    this.pools.length = 0;
    this.coins.length = 0;
  }

  /** Ink puddle left where an enemy fell. */
  pool(x, size) {
    if (this.pools.length > 40) this.pools.shift();
    this.pools.push({ x, r: 0, max: 10 + 8 * size, life: 3.5 });
  }

  dust(x, y, size) {
    this.burst(x, y - 2, Math.round(4 * size), { color: 'rgba(120,110,120,0.45)', angleMin: -Math.PI, angleMax: 0, speedMin: 20, speedMax: 70, lifeMin: 0.4, lifeMax: 0.8, gravity: -20, drag: 2, sizeMin: 3, sizeMax: 6 * size, shrink: false });
  }

  /** Coins pop out of a kill, then fly to the gold counter at (tx, ty). */
  coinBurst(x, y, n, tx, ty) {
    for (let i = 0; i < n && this.coins.length < 60; i++) {
      this.coins.push({ x, y, vx: rand(-120, 120), vy: rand(-320, -160), t: -i * 0.04, tx, ty });
    }
  }

  burst(x, y, n, opt = {}) {
    if (this.particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = rand(opt.angleMin ?? 0, opt.angleMax ?? Math.PI * 2);
      const sp = rand(opt.speedMin ?? 40, opt.speedMax ?? 220);
      const life = rand(opt.lifeMin ?? 0.3, opt.lifeMax ?? 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life, max: life,
        size: rand(opt.sizeMin ?? 1.5, opt.sizeMax ?? 3.5),
        color: opt.color ?? INK,
        g: opt.gravity ?? 600,
        drag: opt.drag ?? 0,
        glow: opt.glow ?? false,
        shrink: opt.shrink ?? true,
      });
    }
  }

  ink(x, y, n = 8) {
    this.burst(x, y, n, { color: INK, angleMin: -Math.PI, angleMax: 0, speedMin: 60, speedMax: 200, sizeMin: 1.5, sizeMax: 3 });
  }

  sparks(x, y, n = 6, color = '#ffd27a') {
    this.burst(x, y, n, { color, speedMin: 80, speedMax: 260, lifeMin: 0.15, lifeMax: 0.35, sizeMin: 1, sizeMax: 2.2, gravity: 200, glow: true });
  }

  explosion(x, y, radius, palette = ['#ffef9a', '#ff9a3c', '#ff4d2e']) {
    for (const c of palette) {
      this.burst(x, y, Math.round(radius / 6), { color: c, speedMin: radius * 0.8, speedMax: radius * 3, lifeMin: 0.25, lifeMax: 0.6, sizeMin: 2, sizeMax: 5, gravity: -80, drag: 3, glow: true });
    }
    this.burst(x, y, Math.round(radius / 5), { color: 'rgba(40,36,48,0.6)', speedMin: 20, speedMax: 90, lifeMin: 0.6, lifeMax: 1.3, sizeMin: 6, sizeMax: 14, gravity: -60, drag: 1.5, shrink: false });
    this.burst(x, Math.min(y, GROUND_Y - 2), 10, { color: INK, angleMin: -Math.PI, angleMax: 0, speedMin: 120, speedMax: 320, sizeMin: 2, sizeMax: 3.5 });
    this.rings.push({ x, y, r: radius * 0.2, max: radius, life: 0.35, maxLife: 0.35 });
  }

  text(x, y, str, color = '#fff', size = 18) {
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push({ x: x + rand(-8, 8), y, str, color, size, life: 0.9, max: 0.9 });
  }

  stick(x, angle) {
    if (this.stuck.length > 60) this.stuck.shift();
    this.stuck.push({ x, y: GROUND_Y + rand(0, 5), angle, life: 4 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > GROUND_Y + 4 && p.g > 0) { p.y = GROUND_Y + 4; p.vy *= -0.2; p.vx *= 0.5; }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 40 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      if ((this.stuck[i].life -= dt) <= 0) this.stuck.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 14);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      if ((this.bolts[i].life -= dt) <= 0) this.bolts.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      if ((this.beams[i].life -= dt) <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const p = this.pools[i];
      p.life -= dt;
      p.r += (p.max - p.r) * Math.min(1, dt * 5);
      if (p.life <= 0) this.pools.splice(i, 1);
    }
    // The gold counter moves in world space when the camera pans, so re-aim every frame
    const target = this.coinTarget?.();
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (target) [c.tx, c.ty] = target;
      c.t += dt;
      if (c.t < 0) continue;
      if (c.t < 0.4) {
        // pop out under gravity
        c.vy += 900 * dt;
        c.x += c.vx * dt;
        c.y = Math.min(GROUND_Y - 4, c.y + c.vy * dt);
      } else {
        // home in on the counter, accelerating
        const k = Math.min(1, (c.t - 0.4) * 2.2);
        c.x += (c.tx - c.x) * k * dt * 8;
        c.y += (c.ty - c.y) * k * dt * 8;
        if (Math.abs(c.x - c.tx) + Math.abs(c.y - c.ty) < 24 || c.t > 2) {
          this.coins.splice(i, 1);
          this.coinsArrived++;
        }
      }
    }
  }

  drawGround(ctx) {
    ctx.fillStyle = INK;
    for (const p of this.pools) {
      ctx.globalAlpha = Math.min(0.85, p.life / 1.5);
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND_Y + 2, p.r, p.r * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const s of this.stuck) {
      ctx.globalAlpha = Math.min(1, s.life);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx) {
    if (this.beams.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const b of this.beams) {
        const k = b.life / b.max;
        // Quick flare in, slow fade out
        const a = Math.min(1, (1 - k) * 8) * Math.min(1, k * 2.5);
        const w = 10 + 6 * (1 - k);
        const g = ctx.createLinearGradient(0, GROUND_Y - 280, 0, GROUND_Y);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, b.color);
        ctx.globalAlpha = a * 0.55;
        ctx.fillStyle = g;
        ctx.fillRect(b.x - w / 2, GROUND_Y - 280, w, 280);
        ctx.globalAlpha = a * 0.8;
        ctx.fillRect(b.x - w / 6, GROUND_Y - 220, w / 3, 220);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (this.bolts.length) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      for (const b of this.bolts) {
        const a = b.life / b.max;
        for (const [w, color] of [[6, `rgba(120,180,255,${0.35 * a})`], [2, `rgba(235,245,255,${a})`]]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.beginPath();
          b.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const r of this.rings) {
      ctx.globalAlpha = r.life / r.maxLife;
      ctx.strokeStyle = r.color ?? '#ffe2a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      const k = p.life / p.max;
      ctx.globalAlpha = p.shrink ? 1 : k;
      ctx.fillStyle = p.color;
      const sz = p.shrink ? p.size * (0.3 + 0.7 * k) : p.size * (1.6 - 0.6 * k);
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const c of this.coins) {
      if (c.t < 0) continue;
      const spin = Math.abs(Math.cos(c.t * 14));
      ctx.fillStyle = '#b8860b';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 5 * spin + 1, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 3.6 * spin + 0.6, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      const pop = 1 + Math.max(0, k - 0.8) * 2;
      ctx.font = `800 ${Math.round(t.size * pop)}px Nunito, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,8,16,0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
