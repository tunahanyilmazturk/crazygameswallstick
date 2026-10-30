import { h, setText, toggleClass } from './dom.js';
import { saveState } from '../core/State.js';
import { levelOf } from '../systems/Economy.js';
import { tr } from '../i18n/i18n.js';

/*
 * First-minutes coaching: one short line at a time at the top of the field, instead of a
 * wall of text before play. Each step ends when the player has done the thing; the ✕ skips
 * the rest, and the full guide stays one click away.
 */
const STEPS = [
  { text: tr('Düşmanlara tıkla, basılı tutarsan seri atış yapar.'), done: (s) => (s.counters.manualShots ?? 0) >= 3 },
  { text: tr('Altının yetti: Keskin Oklar\'ı al, oklar daha sert vursun.'), tab: 'hero', card: 'heroDamage', ready: (s) => s.gold >= 10, done: (s) => levelOf(s, 'heroDamage') > 0 },
  { text: tr('Birlikler sekmesinden Okçu kirala: sen tıklamazken de savaşır.'), tab: 'allies', card: 'allyArcher', done: (s) => levelOf(s, 'allyArcher') > 0 },
  { text: tr('Kale sekmesinden Taş Duvarlar\'ı güçlendir, kalen dayansın.'), tab: 'castle', card: 'castleHp', done: (s) => levelOf(s, 'castleHp') > 0 },
  { text: tr('Harika! Dalga 10\'da ilk patron gelir. Kale düşerse yalnızca 2 dalga geri çekilirsin.'), timed: 9 },
];

export class Coach {
  constructor(root, game, shop) {
    this.game = game;
    this.shop = shop;
    this.timer = 0;
    this.text = h('span');
    this.el = h('div.coach.hidden', { role: 'status' }, this.text, h('button.coach-skip', {
      'aria-label': tr('İpuçlarını kapat'),
      onclick: () => this.finish(),
    }, '✕'));
    root.append(this.el);
    // Anyone past the first waves already knows all this
    if (game.state.maxWave > 3) game.state.coachStep = STEPS.length;
  }

  finish() {
    const s = this.game.state;
    s.coachStep = STEPS.length;
    this.shop.highlight(null);
    toggleClass(this.el, 'hidden', true);
    saveState(s);
  }

  update(dt) {
    const s = this.game.state;
    const step = STEPS[s.coachStep ?? 0];
    if (!step) return;
    if (step.timed ? (this.timer += dt) >= step.timed : step.done(s)) {
      s.coachStep = (s.coachStep ?? 0) + 1;
      this.shop.highlight(null);
      return;
    }
    const show = !this.game.paused && (!step.ready || step.ready(s));
    toggleClass(this.el, 'hidden', !show);
    if (!show) return;
    setText(this.text, step.text);
    this.shop.highlight(step.card ? step : null);
  }
}
