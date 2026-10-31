import { h } from './dom.js';
import { showModal } from './Modal.js';
import { fmt, fmtTime } from '../utils/format.js';
import { saveState } from '../core/State.js';
import { platform } from '../platform/platform.js';
import { AUTO_WEAR, BOOST, FALL_RELIEF, SPEED, VIP } from '../config/rewards.js';
import { tr } from '../i18n/i18n.js';

const NO_AD = tr('Şu an reklam yok, biraz sonra yine dene.');
const AD_BLOCKED = tr('Reklam engelleyici açık görünüyor. Kapatıp tekrar dene.');

/**
 * The windows that offer Hızlandırma and the VIP Elçi. They pause the game, so a video
 * button never sits on an active battlefield, and every choice is the same size, so the
 * ad is never the only way forward or dressed up as one.
 */
export class Offers {
  constructor(root, game, toast) {
    this.root = root;
    this.game = game;
    this.toast = toast;
    this.open = false;
  }

  /** Hold the game still for `run`; ads mute and resume through the same switch. */
  window(title, intro, choices, onClose) {
    if (this.open) return;
    this.open = true;
    const { game } = this;
    const wasPaused = game.paused;
    game.paused = true;
    let close = null;
    const note = h('p.offer-note', { role: 'status' });
    const buttons = choices.map((c) => h('button.btn.offer-choice', {
      ...(c.disabled ? { disabled: true } : {}),
      onclick: () => c.run(close, note),
    }, c.label));
    close = showModal(this.root, {
      title,
      body: h('div.offer', h('p', intro), h('div.offer-choices', ...buttons), note),
      className: 'offer-modal',
      buttons: [],
      onClose: () => {
        this.open = false;
        game.paused = wasPaused;
        onClose?.();
      },
    });
  }

  /** Plays a rewarded ad; `pay` runs only when it finished, then the window closes. */
  watch(close, note, pay) {
    const { game } = this;
    platform.showAd('rewarded', {
      onStart: () => { game.audio.muted = true; },
      onEnd: (ok, code) => {
        game.audio.muted = platform.siteMuted;
        if (!ok) {
          note.textContent = code === 'adblock' ? AD_BLOCKED : NO_AD;
          return;
        }
        close();
        pay();
      },
    });
  }

  grantBoost() {
    const s = this.game.state;
    s.boostLeft = BOOST.seconds;
    saveState(s);
    this.game.audio.play('charge');
    this.toast({ icon: '⚡', title: tr('Hızlandırma başladı!'), sub: tr('30 dk: x{0} altın', BOOST.gold) });
  }

  openBoost() {
    const s = this.game.state;
    const left = s.boostLeft ?? 0;
    if (left > BOOST.renewBelow) {
      this.window(tr('⚡ Hızlandırma'), tr('Etkin: {0} kaldı. Bitmesine 5 dakika kala yenileyebilirsin.', fmtTime(left)), [
        { label: tr('Tamam'), run: (close) => close() },
      ]);
      return;
    }
    const choices = [];
    if (platform.adsOn) {
      choices.push({ label: tr('🎬 Reklam izle'), run: (close, note) => this.watch(close, note, () => this.grantBoost()) });
    }
    choices.push({
      label: tr('💠 {0} Elmas öde', BOOST.gems),
      disabled: s.gems < BOOST.gems,
      run: (close) => {
        s.gems -= BOOST.gems;
        close();
        this.grantBoost();
      },
    });
    choices.push({ label: tr('Vazgeç'), run: (close) => close() });
    this.window(tr('⚡ Hızlandırma'), tr('30 dakika boyunca düşmanlardan x{0} altın. Süre yalnızca oynarken işler.', BOOST.gold), choices);
  }

  grantGems(n) {
    const { game } = this;
    game.addGems(n);
    saveState(game.state);
    this.toast({ icon: '💠', title: tr('+{0} Elmas', n), sub: tr('VIP Elçi teşekkür etti') });
  }

  /** 3x speed, bought only with ads: each one adds time, up to the cap. */
  openFast() {
    const s = this.game.state;
    if (!platform.adsOn) return;
    const left = s.fastLeft ?? 0;
    const intro = tr('Reklam izledikçe {0} dakika 3x oyun hızı kazanırsın. Süre yalnızca oynarken işler. En fazla {1} dakika birikir.', SPEED.fastSeconds / 60, SPEED.maxSeconds / 60);
    this.window(tr('⏩ 3x Hız'), left > 0 ? tr('Şu an {0} 3x hız var. ', fmtTime(left)) + intro : intro, [
      {
        label: tr('🎬 Reklam izle: +{0} dk 3x', SPEED.fastSeconds / 60),
        disabled: left >= SPEED.maxSeconds,
        run: (close, note) => this.watch(close, note, () => this.grantFast()),
      },
      { label: tr('Vazgeç'), run: (close) => close() },
    ]);
  }

  grantFast() {
    const s = this.game.state;
    s.fastLeft = Math.min(SPEED.maxSeconds, (s.fastLeft ?? 0) + SPEED.fastSeconds);
    s.settings.speed = 3;
    saveState(s);
    this.game.audio.play('charge');
    this.toast({ icon: '⏩', title: tr('3x hız açıldı!'), sub: tr('+{0} dk 3x oyun hızı', SPEED.fastSeconds / 60) });
  }

  /** Otomatik Kuşanma, bought only with ads: timed, and it wears every better drop. */
  openAutoWear() {
    const s = this.game.state;
    if (!platform.adsOn) return;
    const left = s.autoWearLeft ?? 0;
    const intro = tr('Reklam izledikçe {0} dakika boyunca düşen her eşya, kuşanılandan güçlüyse otomatik kuşanılır. Süre yalnızca oynarken işler. En fazla {1} dakika birikir.', AUTO_WEAR.seconds / 60, AUTO_WEAR.maxSeconds / 60);
    this.window(tr('🛡️ Otomatik Kuşanma'), left > 0 ? tr('Şu an {0} kaldı. ', fmtTime(left)) + intro : intro, [
      {
        label: tr('🎬 Reklam izle: +{0} dk', AUTO_WEAR.seconds / 60),
        disabled: left >= AUTO_WEAR.maxSeconds,
        run: (close, note) => this.watch(close, note, () => this.grantAutoWear()),
      },
      { label: tr('Vazgeç'), run: (close) => close() },
    ]);
  }

  grantAutoWear() {
    const s = this.game.state;
    s.autoWearLeft = Math.min(AUTO_WEAR.maxSeconds, (s.autoWearLeft ?? 0) + AUTO_WEAR.seconds);
    saveState(s);
    this.game.audio.play('charge');
    this.toast({ icon: '🛡️', title: tr('Otomatik kuşanma açıldı!'), sub: tr('+{0} dk, düşen eşyalar kuşanılır', AUTO_WEAR.seconds / 60) });
  }

  /** Shown after a fall: an ad turns the setback into gold. Skipped when ads are off. */
  openFallRelief() {
    const { game } = this;
    const s = game.state;
    if (!platform.adsOn) return;
    const gold = Math.max(FALL_RELIEF.minGold, Math.round(s.goldPerSec * FALL_RELIEF.goldSeconds));
    this.window(tr('🛡️ Yenilgi Ganimeti'), tr('Kale düştü ama surlar yeniden kuruldu. Reklam izlersen {0} altın ganimet alırsın.', fmt(gold)), [
      {
        label: tr('🎬 Reklam izle: +{0} altın', fmt(gold)),
        run: (close, note) => this.watch(close, note, () => {
          game.addGold(gold);
          saveState(s);
          this.toast({ icon: '🛡️', title: tr('Ganimet toplandı!'), sub: tr('Yenilgiden {0} altın kurtardın', fmt(gold)) });
        }),
      },
      { label: tr('Geç'), run: (close) => close() },
    ]);
  }

  openVip() {
    const { game } = this;
    const s = game.state;
    const price = Math.max(VIP.minGold, Math.round(s.goldPerSec * VIP.goldSeconds));
    const choices = [];
    if (platform.adsOn) {
      choices.push({ label: tr('🎬 Reklam izle: +{0} 💠', VIP.adGems), run: (close, note) => this.watch(close, note, () => this.grantGems(VIP.adGems)) });
    }
    choices.push({
      label: tr('💰 {0} altın öde: +{1} 💠', fmt(price), VIP.goldGems),
      disabled: s.gold < price,
      run: (close) => {
        s.gold -= price;
        close();
        this.grantGems(VIP.goldGems);
      },
    });
    choices.push({ label: tr('Geri gönder'), run: (close) => close() });
    this.window(tr('👑 VIP Elçi'), tr('Krallıktan gelen elçi kale penceresinde. Ona yardım edersen sana Elmas bırakacak.'), choices, () => game.vip.dismiss(game));
  }
}
