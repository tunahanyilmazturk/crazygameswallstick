import { INK } from '../core/constants.js';
import { VIP } from '../config/rewards.js';

const WINDOW = { x: 102, y: 350 };   // the keep's right-hand window
const HIT = 52;                      // generous, so a finger finds him too

/** The VIP envoy: leans out of a keep window, waves, and leaves if nobody answers. */
export class Vip {
  constructor() {
    this.left = 0;   // seconds he will still wait; 0 when he is not here
    this.t = 0;
  }

  get here() {
    return this.left > 0;
  }

  update(dt, game) {
    const s = game.state;
    this.t += dt;
    s.vipNext ??= s.playTime + VIP.firstAfter;
    if (this.here) {
      this.left = Math.max(0, this.left - dt);
      if (!this.here) s.vipNext = s.playTime + VIP.retry;
      return;
    }
    if (s.playTime >= s.vipNext && s.wave >= VIP.minWave) {
      this.left = VIP.stay;
      game.audio.play('loot');
      game.onVipArrive?.();
    }
  }

  /** He was answered; the next visit is a full interval away. */
  dismiss(game) {
    this.left = 0;
    game.state.vipNext = game.state.playTime + VIP.every;
  }

  hit(x, y) {
    return this.here && Math.hypot(x - WINDOW.x, y - WINDOW.y) < HIT;
  }

  draw(ctx) {
    if (!this.here) return;
    const { x, y } = WINDOW;
    const bob = Math.sin(this.t * 3) * 1.5;
    const wave = Math.sin(this.t * 9) * 0.5;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 4, x, y, 58);
    g.addColorStop(0, `rgba(255,214,110,${0.4 + pulse * 0.25})`);
    g.addColorStop(1, 'rgba(255,190,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 58, y - 58, 116, 116);
    // Robe and waving arm
    ctx.fillStyle = '#6a2fa8';
    ctx.fillRect(x - 7, y + 4 + bob, 14, 14);
    ctx.strokeStyle = '#6a2fa8';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 8 + bob);
    ctx.lineTo(x + 15 + wave * 6, y - 5 + bob);
    ctx.stroke();
    // Head with a gold crown
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x, y - 2 + bob, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 7 + bob);
    ctx.lineTo(x - 7, y - 14 + bob);
    ctx.lineTo(x - 3, y - 10 + bob);
    ctx.lineTo(x, y - 15 + bob);
    ctx.lineTo(x + 3, y - 10 + bob);
    ctx.lineTo(x + 7, y - 14 + bob);
    ctx.lineTo(x + 6, y - 7 + bob);
    ctx.closePath();
    ctx.fill();
    // A bouncing gem so the eye goes to him across the field
    const my = y - 46 + Math.sin(this.t * 4) * 5;
    ctx.fillStyle = 'rgba(16,12,24,0.88)';
    ctx.beginPath();
    ctx.arc(x, my, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7fe6ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#7fe6ff';
    ctx.beginPath();
    ctx.moveTo(x, my - 9);
    ctx.lineTo(x + 8, my - 1);
    ctx.lineTo(x, my + 9);
    ctx.lineTo(x - 8, my - 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
