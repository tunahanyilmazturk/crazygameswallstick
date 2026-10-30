/**
 * Tiny synthesized sound effects (no audio files). The AudioContext is created on
 * the first user gesture, as browsers require. Each sound is rate-limited so a
 * volley of 20 arrows does not produce 20 overlapping clicks.
 */
const MIN_GAP = { bow: 0.06, hit: 0.04, crit: 0.08, coin: 0.07, sword: 0.08, throw: 0.12, magic: 0.1, cannon: 0.15, ballista: 0.12, boom: 0.08, die: 0.06, wall: 0.12, frost: 0.1, oil: 0.3, charge: 1, catapult: 0.3, ram: 0.25, achieve: 0.6, loot: 0.3, streak: 0.4, zap: 0.15, bite: 0.12 };

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.muted = false;      // held off by an ad or the site's mute setting
    this.volume = 0.8;
    this.last = {};
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35 * this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** v: 0..1 master volume (Ayarlar). */
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = 0.35 * v;
  }

  play(name) {
    if (!this.enabled || this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] ?? -1) < (MIN_GAP[name] ?? 0.05)) return;
    this.last[name] = now;
    const fn = this[`sfx_${name}`];
    if (fn) fn.call(this, now);
  }

  tone(t, type, f0, f1, dur, vol) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  hiss(t, dur, vol, freq, q = 1, type = 'bandpass') {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  sfx_bow(t) { this.tone(t, 'triangle', 420, 140, 0.09, 0.25); this.hiss(t, 0.08, 0.15, 2500, 2); }
  sfx_hit(t) { this.hiss(t, 0.06, 0.25, 1200, 1.5); }
  sfx_crit(t) { this.hiss(t, 0.08, 0.3, 1800, 1); this.tone(t, 'square', 900, 500, 0.07, 0.08); }
  sfx_coin(t) { this.tone(t, 'sine', 1320, 1320, 0.07, 0.07); this.tone(t + 0.05, 'sine', 1760, 1760, 0.1, 0.06); }
  sfx_sword(t) { this.hiss(t, 0.1, 0.2, 3500, 3, 'highpass'); this.tone(t, 'square', 1600, 900, 0.05, 0.04); }
  sfx_throw(t) { this.hiss(t, 0.15, 0.12, 900, 1); }
  sfx_magic(t) { this.tone(t, 'sawtooth', 220, 880, 0.25, 0.08); this.hiss(t, 0.25, 0.08, 3000, 4); }
  sfx_cannon(t) { this.tone(t, 'sine', 120, 35, 0.4, 0.6); this.hiss(t, 0.35, 0.4, 400, 0.6, 'lowpass'); }
  sfx_ballista(t) { this.tone(t, 'triangle', 200, 60, 0.18, 0.35); this.hiss(t, 0.1, 0.2, 1500, 1); }
  sfx_boom(t) { this.tone(t, 'sine', 90, 30, 0.35, 0.5); this.hiss(t, 0.4, 0.35, 700, 0.5, 'lowpass'); }
  sfx_die(t) { this.tone(t, 'triangle', 260, 90, 0.15, 0.12); }
  sfx_wall(t) { this.tone(t, 'sine', 140, 60, 0.15, 0.3); this.hiss(t, 0.12, 0.2, 500, 1); }
  sfx_buy(t) { this.tone(t, 'square', 660, 660, 0.06, 0.06); this.tone(t + 0.06, 'square', 990, 990, 0.09, 0.06); }
  sfx_wave(t) { [392, 523, 659].forEach((f, i) => this.tone(t + i * 0.12, 'triangle', f, f, 0.3, 0.15)); }
  sfx_boss(t) { [110, 104, 98].forEach((f, i) => this.tone(t + i * 0.35, 'sawtooth', f, f * 0.98, 0.45, 0.18)); }
  sfx_lose(t) { [330, 262, 196].forEach((f, i) => this.tone(t + i * 0.2, 'triangle', f, f, 0.35, 0.18)); }
  sfx_rain(t) { this.hiss(t, 0.9, 0.18, 2200, 0.8); }
  sfx_frost(t) { this.tone(t, 'sine', 1800, 900, 0.18, 0.08); this.hiss(t, 0.25, 0.12, 5000, 3, 'highpass'); }
  sfx_oil(t) { this.hiss(t, 0.6, 0.25, 900, 0.7, 'lowpass'); this.tone(t, 'sine', 300, 80, 0.3, 0.12); }
  sfx_crumble(t) { this.tone(t, 'sine', 95, 32, 0.55, 0.45); this.hiss(t, 0.7, 0.32, 520, 0.6, 'lowpass'); this.hiss(t + 0.12, 0.45, 0.14, 1800, 1.5); }
  sfx_bell(t) { [523, 1047, 1571].forEach((f, i) => this.tone(t, 'sine', f, f * 0.995, 1.4 - i * 0.35, 0.14 - i * 0.04)); }
  sfx_catapult(t) { this.tone(t, 'triangle', 160, 50, 0.25, 0.3); this.hiss(t + 0.02, 0.3, 0.18, 600, 0.8); }
  sfx_ram(t) { this.tone(t, 'sine', 70, 28, 0.45, 0.7); this.hiss(t, 0.3, 0.3, 350, 0.6, 'lowpass'); this.tone(t, 'square', 220, 90, 0.08, 0.06); }
  sfx_achieve(t) { [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.09, 'triangle', f, f, 0.32, 0.14)); this.tone(t + 0.36, 'sine', 1568, 1568, 0.5, 0.06); }
  sfx_loot(t) { [1175, 1568, 2093].forEach((f, i) => this.tone(t + i * 0.06, 'sine', f, f, 0.22, 0.07)); this.hiss(t, 0.3, 0.06, 6000, 3, 'highpass'); }
  sfx_streak(t) { [440, 554, 659].forEach((f, i) => this.tone(t + i * 0.06, 'square', f, f * 1.01, 0.12, 0.05)); }
  sfx_zap(t) { this.hiss(t, 0.18, 0.25, 4200, 2, 'highpass'); this.tone(t, 'sawtooth', 1400, 300, 0.14, 0.07); }
  sfx_bite(t) { this.tone(t, 'square', 260, 140, 0.06, 0.05); this.hiss(t, 0.05, 0.12, 1400, 2); }
  sfx_charge(t) { [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.08, 'square', f, f, 0.12, 0.06)); this.hiss(t, 0.5, 0.15, 300, 0.5, 'lowpass'); }
}
