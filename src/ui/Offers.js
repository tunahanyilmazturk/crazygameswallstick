import { h } from './dom.js';
import { showModal } from './Modal.js';
import { fmt, fmtTime } from '../utils/format.js';
import { saveState } from '../core/State.js';
import { platform } from '../platform/platform.js';
import { BOOST, VIP } from '../config/rewards.js';
import { tr } from '../i18n/i18n.js';

const NO_AD = tr('Şu an reklam yok, biraz sonra yine dene.');

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
      onEnd: (ok) => {
        game.audio.muted = false;
        if (!ok) {
          note.textContent = NO_AD;
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
    this.toast({ icon: '⚡', title: tr('Hızlandırma başladı!'), sub: tr('30 dk: x{0} altın, +%{1} saldırı hızı, 3x hız', BOOST.gold, Math.round((BOOST.rate - 1) * 100)) });
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
    this.window(tr('⚡ Hızlandırma'), tr('30 dakika boyunca düşmanlardan x{0} altın, +%{1} saldırı hızı ve 3x oyun hızı. Süre yalnızca oynarken işler.', BOOST.gold, Math.round((BOOST.rate - 1) * 100)), choices);
  }

  grantGems(n) {
    const { game } = this;
    game.addGems(n);
    saveState(game.state);
    this.toast({ icon: '💠', title: tr('+{0} Elmas', n), sub: tr('VIP Elçi teşekkür etti') });
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
