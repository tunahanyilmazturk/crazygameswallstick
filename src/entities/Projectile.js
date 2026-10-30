import { GROUND_Y, WORLD_W, GRAVITY, INK } from '../core/constants.js';

const PIERCING = new Set(['arrow', 'hunterArrow', 'rain', 'bolt', 'javelin', 'quarrel']);
const EXPLOSIVE = new Set(['fireball', 'frostball', 'cannonball', 'bomb', 'meteor', 'stone']);

/**
 * One class for everything that flies. `kind` selects behaviour:
 * arrow / rain / bolt  – hit-test enemies along the path, may pierce
 * fireball / frostball / cannonball – explode on contact or on the ground (AoE)
 * spear / boulder      – enemy projectiles, damage their target on arrival
 */
export class Projectile {
  constructor(kind, x, y, vx, vy, opt = {}) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = opt.damage ?? 0;
    this.airMultiplier = opt.airMultiplier ?? 1;
    this.knockback = opt.knockback;
    this.crit = opt.crit ?? false;
    this.pierce = opt.pierce ?? 0;
    this.radius = opt.radius ?? 0;
    this.magic = opt.magic ?? false;
    this.burn = opt.burn ?? 0; // burn dps applied on hit (Ateşli Oklar)
    this.slow = opt.slow ?? 0; // slow fraction applied by frost explosions
    this.armorPierce = opt.armorPierce ?? 0; // share of enemy armour ignored (Arbaletçi)
    this.color = opt.color;
    this.size = opt.size ?? 1;
    this.g = opt.gravity ?? (kind === 'fireball' || kind === 'frostball' ? 0 : GRAVITY);
    this.target = opt.target ?? null;
    this.flight = opt.flight ?? 0;
    this.elapsed = 0;
    this.hit = PIERCING.has(kind) ? new Set() : null;
    this.dead = false;
  }

  update(dt, game) {
    this.elapsed += dt;
    this.vy += this.g * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.kind === 'hex') {
      // A magic orb from the raiders: it trails sparks and bursts on what it was aimed at
      game.effects.burst(this.x, this.y, 1, { color: this.color, speedMin: 2, speedMax: 18, lifeMin: 0.2, lifeMax: 0.45, gravity: 0, glow: true, sizeMin: 1.5, sizeMax: 3 });
      if (this.elapsed >= this.flight) {
        game.enemyHitsBlocker(this.target, this.damage, this.x, this.y, 1 + this.size * 0.5);
        game.effects.burst(this.x, this.y, 12, { color: this.color, speedMin: 40, speedMax: 170, gravity: 120, glow: true, lifeMin: 0.2, lifeMax: 0.5, sizeMin: 1.5, sizeMax: 3 });
        this.dead = true;
      }
      return;
    }
    if (this.kind === 'spear' || this.kind === 'boulder') {
      if (this.elapsed >= this.flight) {
        const boulder = this.kind === 'boulder';
        game.enemyHitsBlocker(this.target, this.damage, this.x, this.y, boulder ? 2.2 : 1);
        if (boulder) {
          game.effects.burst(this.x, this.y, 9, { color: '#4a4452', angleMin: -Math.PI * 0.95, angleMax: -Math.PI * 0.35, speedMin: 60, speedMax: 220, sizeMin: 2, sizeMax: 4.5 });
          game.effects.dust(this.x + 10, Math.min(this.y + 20, GROUND_Y), 1.6);
        }
        this.dead = true;
      }
      return;
    }

    if (this.kind === 'fireball' && Math.random() < 0.6) {
      game.effects.burst(this.x, this.y, 1, { color: Math.random() < 0.5 ? '#ffb347' : '#ff5e3a', speedMin: 5, speedMax: 30, lifeMin: 0.2, lifeMax: 0.4, gravity: -60, glow: true, sizeMin: 2, sizeMax: 4 });
    }
    if (this.kind === 'meteor') {
      game.effects.burst(this.x, this.y, 3, { color: Math.random() < 0.5 ? '#ffb347' : '#ff5e3a', speedMin: 10, speedMax: 60, lifeMin: 0.3, lifeMax: 0.7, gravity: -40, glow: true, sizeMin: 3, sizeMax: 7 });
      game.effects.burst(this.x, this.y, 1, { color: 'rgba(60,50,60,0.5)', speedMin: 5, speedMax: 20, lifeMin: 0.8, lifeMax: 1.4, gravity: -30, sizeMin: 8, sizeMax: 14, shrink: false });
      // A meteor only explodes when it reaches the ground, not on the first enemy
      if (this.y >= GROUND_Y - 12) {
        game.explode(this.x, GROUND_Y - 10, this.radius, this.damage, true, 'meteor');
        game.skills.fx.meteorImpact(this.x, this.radius);
        this.dead = true;
      }
      return;
    }
    if (this.kind === 'frostball' && Math.random() < 0.6) {
      game.effects.burst(this.x, this.y, 1, { color: Math.random() < 0.5 ? '#bfe8ff' : '#6fb8ff', speedMin: 5, speedMax: 25, lifeMin: 0.25, lifeMax: 0.5, gravity: 40, glow: true, sizeMin: 1.5, sizeMax: 3 });
    }
    if (this.kind === 'bomb' && Math.random() < 0.8) {
      game.effects.burst(this.x, this.y, 1, { color: Math.random() < 0.5 ? '#ff9a3c' : '#55505a', speedMin: 4, speedMax: 18, lifeMin: 0.2, lifeMax: 0.45, gravity: -20, glow: true, sizeMin: 1.5, sizeMax: 3.5 });
    }
    if (this.burn && Math.random() < 0.35) {
      game.effects.burst(this.x, this.y, 1, { color: '#ff9a3c', speedMin: 2, speedMax: 12, lifeMin: 0.15, lifeMax: 0.3, gravity: -40, glow: true, sizeMin: 1, sizeMax: 2 });
    }
    if (this.kind === 'cannonball' && Math.random() < 0.4) {
      game.effects.burst(this.x, this.y, 1, { color: 'rgba(60,55,70,0.5)', speedMin: 2, speedMax: 12, lifeMin: 0.4, lifeMax: 0.7, gravity: -30, sizeMin: 3, sizeMax: 6, shrink: false });
    }

    for (const e of game.enemies) {
      if (!e.alive || (this.hit && this.hit.has(e)) || !e.contains(this.x, this.y)) continue;
      if (EXPLOSIVE.has(this.kind)) {
        game.explode(this.x, this.y, this.radius, this.damage, this.magic, this.kind, this.slow, this.burn);
        this.dead = true;
        return;
      }
      this.hit.add(e);
      const damage = e.fly ? this.damage * this.airMultiplier : this.damage;
      game.damageEnemy(e, damage, { crit: this.crit, magic: this.magic, x: this.x, y: this.y, kb: this.knockback ?? (this.kind === 'bolt' || this.kind === 'javelin' || this.kind === 'quarrel' ? 80 : this.crit ? 55 : 25), burn: this.burn, armorPierce: this.armorPierce });
      if (this.pierce-- <= 0) {
        this.dead = true;
        return;
      }
    }

    if (this.y >= GROUND_Y) {
      if (EXPLOSIVE.has(this.kind)) game.explode(this.x, GROUND_Y - 4, this.radius, this.damage, this.magic, this.kind, this.slow, this.burn);
      else {
        game.effects.stick(this.x, Math.atan2(this.vy, this.vx));
        if (this.kind === 'rain' && Math.random() < 0.4) game.effects.dust(this.x, GROUND_Y, 0.6);
      }
      this.dead = true;
    } else if (this.x > WORLD_W + 120 || this.x < -120 || this.elapsed > 6) {
      this.dead = true;
    }
  }

  draw(ctx) {
    const a = Math.atan2(this.vy, this.vx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(a);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';
    switch (this.kind) {
      case 'arrow':
      case 'hunterArrow':
      case 'rain':
        if (this.kind === 'hunterArrow') {
          ctx.strokeStyle = '#b48645';
          ctx.fillStyle = '#d9b363';
        }
        if (this.kind === 'rain') {
          // Speed streak so the volley reads as a downpour
          ctx.strokeStyle = 'rgba(190,225,255,0.4)';
          ctx.lineWidth = 1.5;
          line(ctx, -66, 0, -20, 0);
          ctx.strokeStyle = INK;
        }
        ctx.lineWidth = 2;
        line(ctx, -18, 0, 0, 0);
        tri(ctx, 0, 0, -6, 3);
        ctx.lineWidth = 1.5;
        line(ctx, -18, 0, -23, -4);
        line(ctx, -18, 0, -23, 4);
        if (this.crit) {
          ctx.strokeStyle = 'rgba(255,190,80,0.8)';
          ctx.lineWidth = 1;
          line(ctx, -16, 0, -2, 0);
        }
        if (this.burn) {
          // flaming tip
          ctx.fillStyle = '#ffb347';
          ctx.beginPath();
          ctx.arc(-1, 0, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'bolt':
        ctx.lineWidth = 4;
        line(ctx, -34, 0, 0, 0);
        tri(ctx, 2, 0, -10, 5);
        ctx.lineWidth = 2;
        line(ctx, -34, 0, -40, -6);
        line(ctx, -34, 0, -40, 6);
        break;
      case 'hex': {
        const r = 6 * this.size;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'quarrel':
        // Short, heavy crossbow bolt with an iron head
        ctx.lineWidth = 3;
        line(ctx, -16, 0, 0, 0);
        ctx.fillStyle = '#9aa1ab';
        tri(ctx, 2, 0, -7, 3.5);
        ctx.strokeStyle = '#c8312b';
        ctx.lineWidth = 1.5;
        line(ctx, -16, 0, -20, -3);
        line(ctx, -16, 0, -20, 3);
        break;
      case 'javelin':
      case 'spear':
        ctx.lineWidth = 2.2;
        line(ctx, -30, 0, 0, 0);
        tri(ctx, 2, 0, -9, 3.5);
        if (this.kind === 'javelin') {
          ctx.strokeStyle = '#d6d0c4';
          ctx.lineWidth = 1;
          line(ctx, -24, 0, -2, 0);
        }
        break;
      case 'bomb':
        ctx.fillStyle = '#39343a';
        ctx.beginPath();
        ctx.arc(-2, 1, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b89a71';
        ctx.lineWidth = 2;
        line(ctx, -3, -6, 2, -12);
        ctx.fillStyle = '#ff9a3c';
        ctx.beginPath();
        ctx.arc(3, -13, 2 + Math.sin(this.elapsed * 20), 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'fireball':
      case 'frostball': {
        const frost = this.kind === 'frostball';
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16);
        g.addColorStop(0, frost ? '#f2fbff' : '#fff6c8');
        g.addColorStop(0.4, frost ? '#6fb8ff' : '#ff9a3c');
        g.addColorStop(1, frost ? 'rgba(40,110,255,0)' : 'rgba(255,60,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'cannonball':
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'stone':
      case 'boulder':
        // Tumbling rock: rotate with flight time rather than the velocity
        ctx.rotate(this.elapsed * 7);
        ctx.fillStyle = '#3d3844';
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-3, -8);
        ctx.lineTo(6, -6);
        ctx.lineTo(8, 2);
        ctx.lineTo(2, 8);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(-1, -3, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'meteor': {
        // Flaming tail behind a rocky core
        ctx.globalCompositeOperation = 'lighter';
        const tail = ctx.createLinearGradient(-90, 0, 10, 0);
        tail.addColorStop(0, 'rgba(255,90,30,0)');
        tail.addColorStop(1, 'rgba(255,180,80,0.9)');
        ctx.fillStyle = tail;
        ctx.beginPath();
        ctx.moveTo(-90, 0);
        ctx.lineTo(0, -22);
        ctx.lineTo(0, 22);
        ctx.fill();
        const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 34);
        g.addColorStop(0, '#fff6c8');
        g.addColorStop(0.4, '#ff9a3c');
        g.addColorStop(1, 'rgba(255,60,30,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#3a2a24';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function tri(ctx, tipX, tipY, back, half) {
  ctx.beginPath();
  ctx.moveTo(tipX + 2, tipY);
  ctx.lineTo(tipX + back, tipY - half);
  ctx.lineTo(tipX + back, tipY + half);
  ctx.closePath();
  ctx.fill();
}
