import { h, setText, toggleClass } from './dom.js';
import { tip } from './Tooltip.js';
import { SkillBar, gemTip } from './SkillBar.js';
import { fmt, pct } from '../utils/format.js';
import { isBossWave } from '../config/enemies.js';
import { SPEED } from '../config/rewards.js';
import { platform } from '../platform/platform.js';
import { saveState } from '../core/State.js';
import { iconNode } from './icons.js';
import { tr } from '../i18n/i18n.js';

const SPEED_STEPS = [1, 1.5, 2, 3];

/*
 * Overlay on top of the canvas:
 *   top-left    resources (gold, Ruh Taşı, Elmas)
 *   top-centre  wave panel
 *   top-right   speed / advance mode / sound / settings
 *   bottom-centre skill bar (sits on the ground strip, just above the menu)
 * The castle health bar is drawn in the world above the castle (render/castleBar.js).
 */
export class HUD {
  constructor(root, game, { onSettings, onOpenSkills, onOpenHero, onBoost, onFast }) {
    this.onBoost = onBoost;
    this.onFast = onFast;
    this.game = game;

    root.append(
      this.buildResources(),
      this.buildWave(),
      this.buildControls(onSettings, onOpenHero),
    );

    this.skillBar = new SkillBar(game, { onLocked: onOpenSkills });

    // Camera: hold the edge arrows to slide between the village and the battlefield
    this.panLeft = this.panButton(-1, '‹', tr('Basılı tut: köye doğru kaydır<br><span class="tt-info">Kısayol: ← tuşu · ekranı sürükle · fare tekerleği</span>'));
    this.panRight = this.panButton(1, '›', tr('Basılı tut: savaşa doğru kaydır<br><span class="tt-info">Kısayol: → tuşu · ekranı sürükle · fare tekerleği</span>'));
    this.returnBtn = tip(h('button.return-btn', { onclick: () => game.panTo(0) }, iconNode('⚔️', 'return-art'), tr('Savaşa Dön')), tr('Kamerayı savaş alanına geri getir'));

    root.append(this.skillBar.el, this.panLeft, this.panRight, this.returnBtn);
  }

  // ---- top-left: resources ----------------------------------------------------

  buildResources() {
    const g = this.game;
    const s = g.state;
    this.goldText = h('span.res-value');
    this.gpsText = h('span.res-rate');
    const gold = tip(h('div.res-gold', iconNode('💰', 'res-icon'), h('div.res-col', h('span.res-label', tr('Altın')), this.goldText, this.gpsText)), () => {
      const off = g.stats.soul.offline;
      return {
        icon: '💰', title: tr('Altın'), badge: fmt(s.gold),
        rows: [
          [tr('Kazanç'), tr('+{0}/sn', fmt(s.goldPerSec)), 'up'],
          [tr('Köy (pasif)'), tr('+{0}/sn', fmt(g.stats.village.total))],
          [tr('Altın çarpanı'), `x${g.stats.castle.goldMult.toFixed(2)}`],
          [tr('Toplam kazanılan'), fmt(s.totalGold)],
          [tr('Çevrimdışı'), tr('{0} · en fazla {1} saat', pct(off.rate), off.hours)],
        ],
      };
    });
    this.soulText = h('span');
    this.gemText = h('span');
    this.soulChip = tip(h('div.res-chip.soul', iconNode('💎', 'resource-art'), h('span.res-chip-name', tr('Ruh')), this.soulText), () => ({
      icon: '💎', title: tr('Ruh Taşı'), badge: fmt(s.souls),
      desc: tr('Yeniden Doğuş ile kazanılır; kalıcı Ruh geliştirmelerinde harcanır.'),
      rows: [[tr('Toplam kazanılan'), fmt(s.totalSouls)], [tr('Yeniden doğuş'), s.prestiges]],
    }));
    this.gemChip = tip(h('div.res-chip.gem', iconNode('💠', 'resource-art'), h('span.res-chip-name', tr('Elmas')), this.gemText), () => gemTip(s));
    return h('div.hud-res.hud-panel', gold, h('div.res-row', this.soulChip, this.gemChip));
  }

  // ---- top-centre: wave ---------------------------------------------------------

  buildWave() {
    const g = this.game;
    const s = g.state;
    this.waveText = h('span.wave-num');
    this.waveFill = h('div.wave-fill');
    this.waveCount = h('span.wave-count');
    this.bestChip = h('span.wave-chip');
    this.bossChip = h('span.wave-chip.boss');
    this.boostChip = h('span.wave-chip.boost.hidden');
    this.prevBtn = tip(h('button.wave-nav', { 'aria-label': tr('Önceki dalgaya dön'), onclick: () => g.jumpToWave(s.wave - 1) }, '‹'), tr('Önceki dalgaya dön — daha kolay, altın kasmak için'));
    this.nextBtn = tip(h('button.wave-nav', { 'aria-label': tr('Sonraki dalgaya geç'), onclick: () => g.jumpToWave(s.wave + 1) }, '›'), tr('Sonraki dalgaya geç (en yüksek dalgana kadar)'));
    this.wavePanel = tip(h('div.hud-wave.hud-panel',
      h('div.wave-head', this.prevBtn, h('div.wave-title', h('span.wave-label', tr('DALGA')), this.waveText), this.nextBtn),
      h('div.wave-track', this.waveFill, this.waveCount),
      h('div.wave-chips', this.bestChip, this.bossChip, this.boostChip),
    ), () => {
      const w = g.waves;
      const nextBoss = isBossWave(s.wave) ? s.wave : Math.ceil(s.wave / 10) * 10;
      return {
        icon: '🌊', title: tr('Dalga {0}', s.wave), badge: isBossWave(s.wave) ? tr('PATRON') : '',
        rows: [
          [tr('Bölge'), g.bg.biome.name, 'gold'],
          [tr('Kalan düşman'), w.active ? `${w.remaining} / ${w.total}` : tr('Mola')],
          [tr('Bu oyunda en yüksek'), s.maxWave],
          [tr('Tüm zamanların en iyisi'), s.bestWave],
          [tr('Sonraki patron'), nextBoss === s.wave ? tr('Bu dalga!') : tr('Dalga {0}', nextBoss), 'bad'],
          [tr('Mod'), s.settings.autoAdvance ? tr('İlerle') : tr('Tekrar')],
        ],
      };
    });
    return this.wavePanel;
  }

  // ---- top-right: controls --------------------------------------------------------

  /** A locked 3x opens the ad window; a locked 2x explains itself and does nothing. */
  pickSpeed(v) {
    const g = this.game;
    if (v > g.speedLimit) {
      if (v === SPEED.fast) this.onFast?.();
      return;
    }
    g.state.settings.speed = v;
  }

  speedTip(v) {
    const g = this.game;
    if (v <= g.speedLimit) return v % 1 === 0 ? tr('Oyun hızı {0}x (kısayol: {1})', v, v) : tr('Oyun hızı {0}x', v);
    const step = SPEED.steps.find((st) => st.speed === v);
    if (step) return tr('{0}x hız, dalga {1} olunca açılır', v, step.wave);
    return platform.adsOn
      ? tr('3x hız için reklam izle: {0} dk', SPEED.fastSeconds / 60)
      : tr('3x hız reklamla açılır');
  }

  buildControls(onSettings, onOpenHero) {
    const g = this.game;
    const s = g.state;
    this.speedBtns = SPEED_STEPS.map((v) => tip(h('button.seg', {
      'aria-label': tr('Oyun hızını {0}x yap', v),
      'aria-pressed': String(s.settings.speed === v),
      onclick: () => this.pickSpeed(v),
    }, `${v}x`), () => this.speedTip(v)));
    this.advIcon = h('span');
    this.advLabel = h('span.ctl-label');
    this.advBtn = tip(h('button.ctl', { 'aria-pressed': String(s.settings.autoAdvance), onclick: () => { s.settings.autoAdvance = !s.settings.autoAdvance; } }, this.advIcon, this.advLabel), () => ({
      title: s.settings.autoAdvance ? tr('⏩ İlerle modu') : tr('🔁 Tekrar modu'),
      desc: s.settings.autoAdvance
        ? tr('Dalga bitince bir sonrakine geçer.')
        : tr('Aynı dalgayı tekrar tekrar oynar — güçlenene kadar altın kasmak için ideal.'),
      foot: tr('Tıkla: modu değiştir'),
    }));
    this.soundBtn = tip(h('button.ctl.icon-only', { 'aria-label': s.settings.sound ? tr('Sesi kapat') : tr('Sesi aç'), onclick: () => {
      s.settings.sound = !s.settings.sound;
      g.audio.enabled = s.settings.sound;
      g.audio.unlock();
      saveState(s);
    } }), () => tr('Ses: <b>{0}</b>', s.settings.sound ? tr('Açık') : tr('Kapalı')));
    this.boostText = h('span.ctl-label');
    this.boostBtn = tip(h('button.ctl.boost-open', { 'aria-label': tr('Hızlandırma'), onclick: this.onBoost }, h('span', '⚡'), this.boostText), () => ({
      title: tr('Hızlandırma'), desc: tr('30 dakika x2 altın. Seçeneklerini görmek için tıkla.'),
    }));
    this.heroCount = h('span.hud-hero-count');
    this.heroBtn = tip(h('button.ctl.hero-open', { 'aria-label': tr('Kahraman penceresini aç'), onclick: onOpenHero }, iconNode('🏹', 'control-art', 'bow'), h('span.ctl-label', tr('Kahraman')), this.heroCount), tr('Kahraman penceresi, envanter ve kuşanılan eşyalar'));
    const settingsBtn = tip(h('button.ctl.icon-only', { 'aria-label': tr('Ayarlar'), onclick: onSettings }, iconNode('⚙️', 'control-art')), tr('Ayarlar, istatistikler ve kayıt'));
    return h('div.hud-ctrl.hud-panel',
      h('div.segmented.speed', ...this.speedBtns),
      this.advBtn,
      this.soundBtn,
      this.boostBtn,
      this.heroBtn,
      settingsBtn,
    );
  }

  panButton(dir, label, hint) {
    const btn = h(`button.pan.${dir < 0 ? 'pan-left' : 'pan-right'}`, {
      'aria-label': dir < 0 ? tr('Kamerayı köye kaydır') : tr('Kamerayı savaş alanına kaydır'),
    }, label);
    const stop = () => this.game.setPan(0);
    btn.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault();
      this.game.setPan(dir);
    });
    btn.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') stop();
    });
    btn.addEventListener('blur', stop);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.game.setPan(dir);
      try {
        btn.setPointerCapture(e.pointerId); // keep panning even if the finger slides off the arrow
      } catch {
        /* pointer already released */
      }
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('lostpointercapture', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    return tip(btn, hint);
  }

  // ---- per frame -------------------------------------------------------------------

  update() {
    const g = this.game;
    const s = g.state;
    const cam = g.cam;
    toggleClass(this.panLeft, 'hidden', cam.offset >= cam.max - 0.5);
    toggleClass(this.panRight, 'hidden', cam.offset <= 0.5);
    toggleClass(this.returnBtn, 'hidden', cam.offset < 250);

    // Resources
    setText(this.goldText, fmt(s.gold));
    if (g.effects.coinsArrived !== this.coinsSeen) {
      // Pulse the counter when flying coins land
      this.coinsSeen = g.effects.coinsArrived;
      this.goldText.classList.remove('bump');
      void this.goldText.offsetWidth;
      this.goldText.classList.add('bump');
    }
    setText(this.gpsText, tr('+{0}/sn', fmt(s.goldPerSec)));
    setText(this.soulText, fmt(s.souls));
    setText(this.gemText, fmt(s.gems));
    toggleClass(this.soulChip, 'dim', s.souls <= 0 && s.prestiges === 0);
    toggleClass(this.gemChip, 'dim', s.gems <= 0);
    const itemCount = s.heroInventory?.length ?? 0;
    setText(this.heroCount, itemCount > 99 ? '99+' : String(itemCount));
    toggleClass(this.heroCount, 'hidden', itemCount === 0);

    // Wave
    const w = g.waves;
    const boss = isBossWave(s.wave);
    setText(this.waveText, String(s.wave));
    const total = w.total || 1;
    const left = w.active ? w.remaining : 0;
    this.waveFill.style.width = `${(100 * (total - left)) / total}%`;
    setText(this.waveCount, w.active ? `${total - left} / ${total}` : tr('Hazırlan…'));
    setText(this.bestChip, `🏆 ${s.maxWave}`);
    const toBoss = Math.ceil(s.wave / 10) * 10 - s.wave;
    setText(this.bossChip, boss ? tr('💀 PATRON') : tr('💀 {0} dalga', toBoss));
    toggleClass(this.wavePanel, 'boss', boss);
    toggleClass(this.bossChip, 'now', boss);
    this.prevBtn.disabled = s.wave <= 1;
    this.nextBtn.disabled = s.wave >= s.maxWave;

    this.skillBar.update();

    // Controls
    this.speedBtns.forEach((b, i) => {
      const selected = g.gameSpeed === SPEED_STEPS[i];
      toggleClass(b, 'locked', SPEED_STEPS[i] > g.speedLimit);
      toggleClass(b, 'on', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    const boost = s.boostLeft ?? 0;
    setText(this.boostText, boost > 0 ? tr('x2 altın aktif') : tr('Hızlandır'));
    // The timer surfaces beside the wave for 8 seconds each minute, not all the time
    const flash = boost > 0 && boost % 60 < 8;
    toggleClass(this.boostChip, 'hidden', !flash);
    if (flash) setText(this.boostChip, tr('⚡ x2 altın · {0}:{1}', Math.floor(boost / 60), String(Math.floor(boost % 60)).padStart(2, '0')));
    toggleClass(this.boostBtn, 'on', boost > 0);
    setText(this.soundBtn, s.settings.sound ? '🔊' : '🔇');
    this.soundBtn.setAttribute('aria-label', s.settings.sound ? tr('Sesi kapat') : tr('Sesi aç'));
    setText(this.advIcon, s.settings.autoAdvance ? '⏩' : '🔁');
    setText(this.advLabel, s.settings.autoAdvance ? tr('İlerle') : tr('Tekrar'));
    toggleClass(this.advBtn, 'on', s.settings.autoAdvance);
    this.advBtn.setAttribute('aria-pressed', String(s.settings.autoAdvance));
  }
}
