import { h, setText, toggleClass } from './dom.js';
import { tip } from './Tooltip.js';
import { fmt } from '../utils/format.js';
import { ACTIVE_SKILLS } from '../config/skills.js';
import { iconNode } from './icons.js';
import { SKILL_COLORS } from '../render/skillFx.js';
import { tr } from '../i18n/i18n.js';

/** Restart a one-shot CSS animation on a skill button. */
function replay(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * Skill bar: Ok Yağmuru plus the Elmas skills. Each slot sweeps its cooldown like a clock,
 * counts the seconds down, drains a coloured ring while its buff runs, flashes when cast
 * and pops when ready again. A small toggle sets auto-cast.
 */
export class SkillBar {
  constructor(game, { onLocked }) {
    this.game = game;
    const s = game.state;

    const rain = {
      key: 'rain', icon: '🌧️', iconArt: 'arrow-rain', hotkey: 'Z', name: tr('Ok Yağmuru'),
      unlocked: () => game.stats.hero.rainArrows > 0,
      cd: () => game.rainCd,
      maxCd: () => game.stats.hero.rainCooldown,
      active: () => 0,
      cast: () => game.castRain(),
      auto: () => s.settings.autoSkill,
      toggleAuto: () => { s.settings.autoSkill = !s.settings.autoSkill; },
      tip: () => {
        const n = game.stats.hero.rainArrows;
        if (!n) return { icon: '🌧️', title: tr('Ok Yağmuru'), badge: tr('Kilitli'), desc: tr('Kahraman sekmesinden açılır.'), foot: tr('Kısayol: Z / Boşluk') };
        return {
          icon: '🌧️', title: tr('Ok Yağmuru'), badge: tr('Z / Boşluk'),
          desc: tr('Ön saftaki düşmanların üstüne gökten ok yağdırır.'),
          rows: [[tr('Ok sayısı'), n], [tr('Ok başına hasar'), fmt(game.stats.hero.damage * 2)], [tr('Bekleme'), tr('{0} sn', game.stats.hero.rainCooldown.toFixed(1))]],
          foot: game.rainCd > 0 ? tr('Hazır olmasına {0} sn', game.rainCd.toFixed(1)) : tr('Hazır! Tıkla'),
          footClass: game.rainCd > 0 ? 'bad' : 'good',
        };
      },
    };

    const skillSlot = (u) => ({
      key: u.key, icon: u.icon, iconArt: u.iconArt, hotkey: u.hotkey, name: u.name, special: u.special,
      unlocked: () => !!game.stats.skills[u.key],
      cd: () => game.skills.cd[u.key],
      maxCd: () => game.stats.skills[u.key]?.cooldown ?? 1,
      active: () => game.skills.activeFraction(u.key),
      duration: () => game.stats.skills[u.key]?.duration ?? 0,
      cast: () => game.skills.cast(u.key),
      auto: () => game.skills.isAuto(u.key),
      toggleAuto: () => { s.skillAuto[u.key] = !game.skills.isAuto(u.key); },
      tip: () => {
        const st = game.stats.skills[u.key];
        if (!st) {
          const reached = s.bestWave >= u.stage;
          return {
            icon: u.icon, title: u.name, badge: u.special ? tr('ÖZEL') : tr('Kilitli'),
            desc: u.desc,
            foot: reached ? tr('Yetenekler sekmesinde {0} 💠 ile aç', u.baseCost) : tr('Dalga {0}\'e ulaşınca açılabilir', u.stage),
            footClass: reached ? 'good' : 'bad',
          };
        }
        const cd = game.skills.cd[u.key];
        return {
          icon: u.icon, title: u.name, badge: u.hotkey,
          desc: u.desc,
          rows: [...u.rows(st), [tr('Otomatik'), game.skills.isAuto(u.key) ? tr('Açık — {0}', u.auto) : tr('Kapalı')]],
          foot: game.skills.active[u.key] > 0 ? tr('Etkin: {0} sn', game.skills.active[u.key].toFixed(1)) : cd > 0 ? tr('Hazır olmasına {0} sn', cd.toFixed(1)) : tr('Hazır! Tıkla'),
          footClass: cd > 0 && !(game.skills.active[u.key] > 0) ? 'bad' : 'good',
        };
      },
    });

    this.slots = [rain, ...ACTIVE_SKILLS.map(skillSlot)].map((def) => {
      const cdEl = h('div.skill-cd');
      const ring = h('div.skill-ring');
      const time = h('span.skill-time');
      const lock = h('span.skill-lock', '🔒');
      const btn = tip(
        h(`button.skill${def.special ? '.special' : ''}`, {
          'aria-label': tr('{0}, {1} kısayolu{2}', def.name, def.hotkey, def.unlocked() ? '' : tr(', kilitli')),
          onclick: () => (def.unlocked() ? def.cast() : onLocked?.()),
        }, ring, iconNode(def.icon, 'skill-icon', def.iconArt), cdEl, time, lock, h('span.skill-key', def.hotkey)),
        def.tip,
      );
      btn.style.setProperty('--c', SKILL_COLORS[def.key]);
      const auto = tip(h('button.skill-auto', {
        'aria-label': tr('Otomatik {0} {1}', def.name, def.auto() ? tr('açık') : tr('kapalı')),
        'aria-pressed': String(def.auto()),
        onclick: () => def.toggleAuto(),
      }, 'A'), () => tr('Otomatik kullanım: <b>{0}</b><br><span class="tt-info">Tıkla: aç/kapat</span>', def.auto() ? tr('Açık') : tr('Kapalı')));
      return { def, btn, cdEl, ring, time, auto, wasCd: 0, el: h('div.skill-slot', btn, auto) };
    });
    this.el = h('div.skill-bar', ...this.slots.map((x) => x.el));

    // Hotkeys: Space/Z = Ok Yağmuru, X C V B N = Elmas skills
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        rain.cast();
        return;
      }
      const slot = this.slots.find((x) => x.def.hotkey === e.key.toUpperCase());
      if (slot && slot.def.unlocked()) slot.def.cast();
    });
  }

  update() {
    for (const slot of this.slots) {
      const { def, btn, cdEl, ring, time, auto } = slot;
      const unlocked = def.unlocked();
      const cd = unlocked ? def.cd() : 0;
      const active = unlocked ? def.active() : 0;
      toggleClass(btn, 'locked', !unlocked);
      btn.setAttribute('aria-label', tr('{0}, {1} kısayolu{2}', def.name, def.hotkey, unlocked ? '' : tr(', kilitli')));
      toggleClass(btn, 'ready', unlocked && cd <= 0);
      toggleClass(btn, 'active', active > 0);
      cdEl.style.setProperty('--cd', unlocked ? Math.min(1, cd / def.maxCd()) : 0);
      ring.style.setProperty('--p', active);
      if (cd > slot.wasCd + 0.5) replay(btn, 'cast');
      else if (cd <= 0 && slot.wasCd > 0) replay(btn, 'pop');
      slot.wasCd = cd;
      const left = active > 0 ? active * (def.duration?.() ?? 0) : cd;
      setText(time, left > 0 ? (left < 10 ? left.toFixed(1) : Math.ceil(left)) : '');
      toggleClass(auto, 'on', def.auto());
      auto.setAttribute('aria-label', tr('Otomatik {0} {1}', def.name, def.auto() ? tr('açık') : tr('kapalı')));
      auto.setAttribute('aria-pressed', String(def.auto()));
      auto.style.display = unlocked ? '' : 'none';
    }
  }
}

export function gemTip(state) {
  return {
    icon: '💠', title: tr('Elmas'), badge: fmt(state.gems),
    desc: tr('Yetenekleri ve yetenek ağacını açan özel taş. Yeniden Doğuş\'ta sıfırlanmaz.'),
    rows: [[tr('Toplam kazanılan'), fmt(state.totalGems ?? 0)], [tr('En iyi dalga'), state.bestWave]],
    foot: tr('Patron öldür, aşamalara ulaş (dalga 25/50/75/100…), Yeniden Doğuş yap'),
  };
}

