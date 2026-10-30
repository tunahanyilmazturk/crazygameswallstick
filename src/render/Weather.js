import { GROUND_Y } from '../core/constants.js';
import { rand } from '../utils/math.js';

/*
 * Weather particles over the scene: rain, falling leaves, snow, desert dust and volcanic
 * ash with embers. They spawn across the visible part of the world, and a change of weather
 * fades the old type out before the new one fades in. `intensity` (0..1) also darkens the
 * sky for rain (Background reads it).
 */
const RATE = { rain: 260, leaves: 7, snow: 55, dust: 26, ash: 40 };
const CAP = 420;
const LEAF_COLORS = ['#b8562a', '#d0862e', '#9a3a26', '#c9a03a'];

export class Weather {
  constructor() {
    this.type = null;
    this.target = null;
    this.intensity = 0;
    this.parts = [];
    this.acc = 0;
  }

  set(type) {
    this.target = type;
  }

  /** Jump straight to a weather (on load or after a jump between waves). */
  snap(type) {
    this.type = type;
    this.target = type;
    this.intensity = type ? 1 : 0;
  }

  update(dt, left, w) {
    if (this.type !== this.target) {
      this.intensity = Math.max(0, this.intensity - dt * 0.5);
      if (this.intensity === 0) this.type = this.target;
    } else if (this.type) {
      this.intensity = Math.min(1, this.intensity + dt * 0.35);
    }

    if (this.type) {
      this.acc += RATE[this.type] * this.intensity * (w / 1280) * dt;
      while (this.acc >= 1 && this.parts.length < CAP) {
        this.acc -= 1;
        this.spawn(this.type, left, w);
      }
      if (this.parts.length >= CAP) this.acc = 0;
    }

    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.t += dt;
      if (p.kind === 'leaves' || p.kind === 'snow') p.x += Math.sin(p.t * p.wob + p.ph) * p.sway * dt;
      if (p.kind === 'ember') p.vy -= 6 * dt;
      const gone = p.kind === 'ember' ? p.y < 40 || p.t > p.life : p.y > GROUND_Y + 30 || p.t > p.life;
      if (gone || p.x < left - 200 || p.x > left + w + 200) {
        if (p.kind === 'rain' && p.y > GROUND_Y) this.splash(p.x);
        this.parts.splice(i, 1);
      }
    }
  }

  spawn(type, left, w) {
    const x = rand(left - 60, left + w + 160);
    switch (type) {
      case 'rain':
        this.parts.push({ kind: 'rain', x, y: rand(-40, 300), vx: -160, vy: rand(760, 900), t: 0, life: 2, len: rand(10, 16) });
        break;
      case 'leaves':
        this.parts.push({ kind: 'leaves', x, y: rand(-20, 260), vx: rand(-55, -25), vy: rand(30, 55), t: 0, life: 14, wob: rand(1.5, 3), ph: rand(0, 6), sway: rand(30, 60), rot: rand(0, 6), size: rand(2.5, 4), color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)] });
        break;
      case 'snow':
        this.parts.push({ kind: 'snow', x, y: rand(-20, 300), vx: rand(-22, -8), vy: rand(28, 60), t: 0, life: 20, wob: rand(1, 2.5), ph: rand(0, 6), sway: rand(10, 25), size: rand(1.2, 2.8) });
        break;
      case 'dust':
        this.parts.push({ kind: 'dust', x: left + w + rand(20, 160), y: rand(GROUND_Y - 150, GROUND_Y + 20), vx: rand(-260, -160), vy: rand(-8, 8), t: 0, life: 12, len: rand(30, 80), alpha: rand(0.08, 0.2) });
        break;
      case 'ash':
        if (Math.random() < 0.25) {
          this.parts.push({ kind: 'ember', x, y: GROUND_Y + rand(-10, 10), vx: rand(-15, 15), vy: rand(-60, -30), t: 0, life: rand(3, 6), size: rand(1, 2) });
        } else {
          this.parts.push({ kind: 'ash', x, y: rand(-20, 280), vx: rand(-25, -5), vy: rand(18, 40), t: 0, life: 20, size: rand(1, 2.4) });
        }
        break;
    }
  }

  /** Rain bursts into a few droplets where it hits the ground. */
  splash(x) {
    if (this.parts.length >= CAP || Math.random() < 0.6) return;
    this.parts.push({ kind: 'drop', x, y: GROUND_Y + 2, vx: rand(-40, 40), vy: rand(-80, -40), t: 0, life: 0.25 });
  }

  draw(ctx, night) {
    if (!this.parts.length) return;
    const a = this.intensity;
    // Rain: one batched path of slanted streaks
    ctx.strokeStyle = night > 0.5 ? `rgba(170,180,230,${0.45 * a})` : `rgba(200,215,235,${0.5 * a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const p of this.parts) {
      if (p.kind !== 'rain') continue;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.018, p.y - p.len);
    }
    ctx.stroke();
    ctx.fillStyle = `rgba(210,220,240,${0.6 * a})`;
    for (const p of this.parts) if (p.kind === 'drop') ctx.fillRect(p.x, p.y, 1.5, 1.5);

    // Snow and ash: batched dots
    ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
    ctx.beginPath();
    for (const p of this.parts) {
      if (p.kind !== 'snow') continue;
      ctx.moveTo(p.x + p.size, p.y);
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = `rgba(120,110,115,${0.7 * a})`;
    ctx.beginPath();
    for (const p of this.parts) {
      if (p.kind !== 'ash') continue;
      ctx.rect(p.x, p.y, p.size, p.size);
    }
    ctx.fill();

    // Dust: long faint streaks blowing in from the enemy side
    for (const p of this.parts) {
      if (p.kind !== 'dust') continue;
      ctx.strokeStyle = `rgba(230,190,130,${p.alpha * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.len, p.y + 2);
      ctx.stroke();
    }

    // Leaves: small tumbling ellipses
    for (const p of this.parts) {
      if (p.kind !== 'leaves') continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot + p.t * 2);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5 * Math.abs(Math.cos(p.t * 3 + p.ph)) + 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Embers glow as they rise
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (p.kind !== 'ember') continue;
      const k = 1 - p.t / p.life;
      ctx.fillStyle = `rgba(255,${120 + 80 * k},60,${0.8 * k * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
