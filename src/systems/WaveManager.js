import { ENEMY_TYPES, isBossWave, bossForWave, spawnsOn } from '../config/enemies.js';
import { Enemy } from '../entities/Enemy.js';

const BREAK_TIME = 2.5;

/** Regular enemies in a wave (the boss comes on top of these). */
export const waveSize = (wave) => Math.min(8 + Math.floor(wave * 1.3), 45);

function pickType(wave) {
  const pool = Object.entries(ENEMY_TYPES).filter(([, d]) => !d.boss && d.weight > 0 && spawnsOn(d, wave));
  const total = pool.reduce((s, [, d]) => s + d.weight, 0);
  let r = Math.random() * total;
  for (const [type, d] of pool) {
    if ((r -= d.weight) <= 0) return type;
  }
  return pool[0][0];
}

/** Builds the spawn queue for each wave and decides when a wave is over. */
export class WaveManager {
  constructor(game) {
    this.game = game;
    this.queue = [];
    this.spawnTimer = 0;
    this.interval = 1;
    this.breakTimer = 0;
    this.total = 0;
    this.active = false;
  }

  start(wave) {
    const boss = isBossWave(wave);
    const count = waveSize(wave);
    this.queue = [];
    while (this.queue.length < count) {
      // A pack fills one slot per member, so wave sizes stay as before
      const type = pickType(wave);
      const n = Math.min(ENEMY_TYPES[type].pack ?? 1, count - this.queue.length);
      for (let i = 0; i < n; i++) this.queue.push(type);
    }
    if (boss) this.queue.splice(Math.floor(count * 0.6), 0, bossForWave(wave));
    this.total = this.queue.length;
    this.interval = Math.max(0.35, 1.3 - wave * 0.02);
    this.spawnTimer = 0.5;
    this.active = true;
    this.game.onWaveStart(wave, boss);
  }

  /** Enemies left to defeat in this wave (queued + alive). */
  get remaining() {
    return this.queue.length + this.game.enemies.filter((e) => e.alive).length;
  }

  update(dt) {
    const game = this.game;
    if (!this.active) {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.start(game.state.wave);
      return;
    }
    if (this.queue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const type = this.queue.shift();
        // Pack members follow each other closely
        this.spawnTimer = ENEMY_TYPES[type].pack && this.queue[0] === type ? 0.18 : this.interval * (0.7 + Math.random() * 0.6);
        game.enemies.push(new Enemy(type, game.state.wave, game.stats.oath.enemyHp));
        game.onEnemySpawn?.(type);
      }
    } else if (!game.enemies.some((e) => e.alive)) {
      this.active = false;
      this.breakTimer = BREAK_TIME;
      game.onWaveCleared();
    }
  }

  /** Abort the current wave (castle fell) and pause before restarting. */
  abort(pause = 3) {
    this.queue = [];
    this.active = false;
    this.breakTimer = pause;
  }
}
