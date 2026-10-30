import { fmt } from '../utils/format.js';
import { lerp, rand } from '../utils/math.js';
import { tr } from '../i18n/i18n.js';

// Bar placement in world space: centred over the castle, above the tower flag
const CX = 125;
const Y = 150;
const W = 210;
const H = 17;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Castle health bar drawn in the world above the castle: smooth fill, a white damage
 * trail that drains after hits, a moving shimmer, shake on impact, red pulse when low
 * and a blue glow while İlahi Kalkan is up.
 */
export class CastleBar {
  constructor() {
    this.shown = 1;
    this.trail = 1;
    this.hitT = 0;
    this.healT = 0;
    this.lastHp = null;
    this.lastNow = performance.now();
  }

  draw(ctx, castle, time, shielded) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastNow) / 1000);
    this.lastNow = now;

    const ratio = Math.max(0, Math.min(1, castle.hp / castle.maxHp));
    if (this.lastHp != null) {
      if (castle.hp < this.lastHp - castle.maxHp * 0.002) this.hitT = 0.3;
      else if (castle.hp > this.lastHp + castle.maxHp * 0.05) this.healT = 0.6;
    }
    this.lastHp = castle.hp;
    this.hitT = Math.max(0, this.hitT - dt);
    this.healT = Math.max(0, this.healT - dt);
    this.shown = lerp(this.shown, ratio, Math.min(1, dt * 12));
    // The trail waits a moment, then drains down to the real value
    this.trail = this.trail < ratio ? ratio : lerp(this.trail, ratio, Math.min(1, dt * (this.hitT > 0 ? 0.5 : 2.5)));

    const shake = this.hitT > 0 ? rand(-2, 2) * (this.hitT / 0.3) : 0;
    const x = CX - W / 2 + shake;
    const y = Y + shake * 0.5;
    const low = ratio < 0.3;
    const pulse = 0.5 + 0.5 * Math.sin(time * 8);

    ctx.save();
    // Glow: blue shield, red danger, green heal
    if (shielded || low || this.healT > 0) {
      ctx.shadowColor = shielded ? 'rgba(140,220,255,0.95)' : low ? `rgba(255,60,40,${0.5 + 0.5 * pulse})` : 'rgba(120,255,150,0.8)';
      ctx.shadowBlur = shielded ? 18 : 14;
    }
    // Frame
    roundRect(ctx, x - 26, y - 5, W + 32, H + 10, 9);
    ctx.fillStyle = 'rgba(14,11,20,0.82)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = shielded ? '#9fe3ff' : low ? `rgba(255,110,90,${0.6 + 0.4 * pulse})` : 'rgba(226,179,60,0.55)';
    ctx.stroke();

    // Emblem
    ctx.font = '15px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(shielded ? '🔰' : '🏰', x - 12, y + H / 2 + 1);

    // Track
    roundRect(ctx, x, y, W, H, 6);
    ctx.fillStyle = '#2a0f12';
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Damage trail
    ctx.fillStyle = 'rgba(255,240,225,0.85)';
    ctx.fillRect(x, y, W * this.trail, H);
    // Fill colour shifts green → amber → red as health drops
    const fillW = W * this.shown;
    const g = ctx.createLinearGradient(0, y, 0, y + H);
    if (ratio > 0.5) { g.addColorStop(0, '#8af59a'); g.addColorStop(1, '#2f9a44'); }
    else if (ratio > 0.25) { g.addColorStop(0, '#ffd77a'); g.addColorStop(1, '#d48a1c'); }
    else { g.addColorStop(0, '#ff8a7a'); g.addColorStop(1, '#b8241c'); }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, fillW, H);
    // Shimmer sweeping across the filled part
    const sx = x + ((time * 90) % (W + 80)) - 40;
    const sh = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(x, y, fillW, H);
    // Top gloss
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, fillW, H * 0.35);
    // Quarter ticks
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const k of [0.25, 0.5, 0.75]) ctx.fillRect(x + W * k - 0.5, y + 3, 1, H - 6);
    if (shielded) {
      ctx.fillStyle = `rgba(160,225,255,${0.25 + 0.15 * pulse})`;
      ctx.fillRect(x, y, W, H);
    }
    ctx.restore();

    // Numbers
    ctx.font = '800 11px Nunito, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10,8,16,0.9)';
    const label = `${fmt(castle.hp)} / ${fmt(castle.maxHp)}`;
    ctx.strokeText(label, x + W / 2, y + H / 2 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x + W / 2, y + H / 2 + 1);
    if (castle.regen > 0) {
      ctx.font = '800 9px Nunito, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9fe3a8';
      ctx.strokeText(tr('+{0}/sn', fmt(castle.regen)), x + W - 4, y - 9);
      ctx.fillText(tr('+{0}/sn', fmt(castle.regen)), x + W - 4, y - 9);
    }
    ctx.restore();
  }
}
