import { pct } from '../utils/format.js';
import { tr } from '../i18n/i18n.js';

/*
 * Skills are bought with Elmas (💠, state.gems) and stored in state.gemLevels, so they
 * survive Yeniden Doğuş. `stage` is the best wave ever reached (state.bestWave) needed to
 * unlock a skill or talent; `requires` is a talent that must have at least one level.
 */

/** Active skills on the skill bar. Level 0 = locked; the first purchase unlocks it. */
export const ACTIVE_SKILLS = [
  {
    id: 'skillWarcry', key: 'warcry', hotkey: 'X', currency: 'gems', skill: true,
    name: tr('Savaş Narası'), icon: '📯', desc: tr('Bir süre tüm hasar ve saldırı hızı artar'),
    info: tr('Kahraman, birlikler, kale yağı — oyuncu tarafındaki tüm hasarı etkiler.'),
    stage: 15, baseCost: 3, growth: 1.6, max: 5,
    auto: tr('5+ düşman ya da patron sahadayken'),
    stat: (l) => (l ? { dmg: 1.4 + 0.1 * l, rate: 1.15 + 0.05 * l, duration: 8 + l, cooldown: 50 - 3 * l } : null),
    describe: (s) => (s ? tr('+{0} hasar · {1} sn', pct(s.dmg - 1), s.duration) : tr('Kilitli')),
    short: (s) => (s ? `+${pct(s.dmg - 1)}` : tr('Kilitli')),
    rows: (s) => (s ? [[tr('Hasar'), `+${pct(s.dmg - 1)}`], [tr('Saldırı hızı'), `+${pct(s.rate - 1)}`], [tr('Süre'), tr('{0} sn', s.duration)], [tr('Bekleme'), tr('{0} sn', s.cooldown)]] : []),
  },
  {
    id: 'skillMeteor', key: 'meteor', hotkey: 'C', currency: 'gems', skill: true,
    name: tr('Meteor'), icon: '☄️', desc: tr('En kalabalık düşman grubuna dev bir meteor düşürür'),
    info: tr('Hasar, kahramanın ok hasarıyla ölçeklenir ve zırhı yok sayar.'),
    stage: 30, baseCost: 5, growth: 1.6, max: 5,
    auto: tr('3+ düşman bir aradayken ya da patron varken'),
    stat: (l) => (l ? { power: 12 + 4 * l, radius: 150 + 10 * l, cooldown: 45 - 3 * l } : null),
    describe: (s) => (s ? tr('ok hasarı ×{0}', s.power) : tr('Kilitli')),
    short: (s) => (s ? `×${s.power}` : tr('Kilitli')),
    rows: (s) => (s ? [[tr('Hasar'), tr('ok hasarı ×{0}', s.power)], [tr('Alan'), tr('{0} px', s.radius)], [tr('Bekleme'), tr('{0} sn', s.cooldown)]] : []),
  },
  {
    id: 'skillShield', key: 'shield', hotkey: 'V', currency: 'gems', skill: true,
    name: tr('İlahi Kalkan'), icon: '🔰', desc: tr('Kaleyi bir süre hasarsız yapar ve onarır'),
    stage: 35, baseCost: 6, growth: 1.6, max: 5,
    auto: tr('Kale canı %40\'ın altına düşünce'),
    stat: (l) => (l ? { duration: 4 + 0.8 * l, heal: 0.2 + 0.05 * l, cooldown: 70 - 4 * l } : null),
    describe: (s) => (s ? tr('{0} sn · {1} onarım', s.duration.toFixed(1), pct(s.heal)) : tr('Kilitli')),
    short: (s) => (s ? tr('{0} sn', s.duration.toFixed(1)) : tr('Kilitli')),
    rows: (s) => (s ? [[tr('Koruma'), tr('{0} sn', s.duration.toFixed(1))], [tr('Anında onarım'), pct(s.heal)], [tr('Bekleme'), tr('{0} sn', s.cooldown)]] : []),
  },
  {
    id: 'skillFreeze', key: 'freeze', hotkey: 'B', currency: 'gems', skill: true, special: true,
    name: tr('Zaman Dondurma'), icon: '🧊', desc: tr('Sahadaki tüm düşmanları dondurur'),
    info: tr('Donan düşman ne yürür ne vurur. Savaş Lordu yarı hızda yürümeye devam eder.'),
    stage: 45, baseCost: 8, growth: 1.7, max: 5,
    auto: tr('6+ düşman ya da patron sahadayken'),
    stat: (l) => (l ? { duration: 3 + 0.5 * l, cooldown: 65 - 4 * l } : null),
    describe: (s) => (s ? tr('{0} sn dondurma', s.duration.toFixed(1)) : tr('Kilitli')),
    short: (s) => (s ? tr('{0} sn', s.duration.toFixed(1)) : tr('Kilitli')),
    rows: (s) => (s ? [[tr('Süre'), tr('{0} sn', s.duration.toFixed(1))], [tr('Bekleme'), tr('{0} sn', s.cooldown)]] : []),
  },
  {
    id: 'skillMidas', key: 'midas', hotkey: 'N', currency: 'gems', skill: true, special: true,
    name: tr('Midas Dokunuşu'), icon: '🌟', desc: tr('Bir süre düşmanlardan kat kat altın düşer'),
    stage: 60, baseCost: 12, growth: 1.7, max: 5,
    auto: tr('6+ düşman ya da patron sahadayken'),
    stat: (l) => (l ? { mult: 2.5 + 0.5 * l, duration: 12 + 2 * l, cooldown: 90 - 5 * l } : null),
    describe: (s) => (s ? tr('×{0} altın · {1} sn', s.mult, s.duration) : tr('Kilitli')),
    short: (s) => (s ? `×${s.mult}` : tr('Kilitli')),
    rows: (s) => (s ? [[tr('Altın'), `×${s.mult}`], [tr('Süre'), tr('{0} sn', s.duration)], [tr('Bekleme'), tr('{0} sn', s.cooldown)]] : []),
  },
];

export const TALENT_TIERS = [10, 25, 50, 80]; // best wave needed for each tier

export const TALENT_BRANCHES = [
  { id: 'archery', name: tr('Okçuluk'), icon: '🏹' },
  { id: 'defense', name: tr('Savunma'), icon: '🛡️' },
  { id: 'economy', name: tr('Ticaret'), icon: '💰' },
];

const talent = (branch, tier, prev, t) => ({
  ...t, branch, tier, currency: 'gems', talent: true,
  stage: TALENT_TIERS[tier], requires: prev, short: t.short ?? t.describe,
});

/** Passive talent tree: 3 branches × 4 tiers; each node needs the one above it. */
export const TALENTS = [
  talent('archery', 0, null, { id: 'tArchDmg', name: tr('Okçu Ustalığı'), icon: '🎯', desc: tr('Kahraman hasarı'), baseCost: 2, growth: 1.6, max: 5, stat: (l) => 1 + 0.1 * l, describe: (v) => tr('+{0} hasar', pct(v - 1)) }),
  talent('archery', 1, 'tArchDmg', { id: 'tArchSpeed', name: tr('Hızlı El'), icon: '⚡', desc: tr('Kahraman saldırı hızı'), baseCost: 3, growth: 1.6, max: 5, stat: (l) => 1 + 0.05 * l, describe: (v) => tr('+{0} hız', pct(v - 1)) }),
  talent('archery', 2, 'tArchSpeed', { id: 'tArchCrit', name: tr('Ölüm Fısıltısı'), icon: '💀', desc: tr('Kritik hasar çarpanı'), baseCost: 5, growth: 1.7, max: 5, stat: (l) => 0.25 * l, describe: (v) => tr('+x{0} kritik', v.toFixed(2)) }),
  talent('archery', 3, 'tArchCrit', { id: 'tArchVolley', name: tr('Ok Fırtınası'), icon: '🌪️', desc: tr('Her atışta ekstra ok'), baseCost: 8, growth: 2, max: 2, stat: (l) => l, describe: (v) => tr('+{0} ok', v) }),

  talent('defense', 0, null, { id: 'tDefHp', name: tr('Sağlam Temel'), icon: '🧱', desc: tr('Kale maksimum canı'), baseCost: 2, growth: 1.6, max: 5, stat: (l) => 1 + 0.1 * l, describe: (v) => tr('+{0} can', pct(v - 1)) }),
  talent('defense', 1, 'tDefHp', { id: 'tDefAllies', name: tr('Takviye Birlikler'), icon: '⚔️', desc: tr('Tüm birliklerin hasarı'), baseCost: 3, growth: 1.6, max: 5, stat: (l) => 1 + 0.08 * l, describe: (v) => tr('+{0} hasar', pct(v - 1)) }),
  talent('defense', 2, 'tDefAllies', { id: 'tDefWill', name: tr('Demir İrade'), icon: '🗿', desc: tr('Kalenin aldığı hasar azalır'), baseCost: 5, growth: 1.7, max: 5, stat: (l) => 0.04 * l, describe: (v) => tr('-{0} hasar', pct(v)) }),
  talent('defense', 3, 'tDefWill', { id: 'tDefDrill', name: tr('Savaş Tatbikatı'), icon: '🥇', desc: tr('Tüm birliklerin saldırı hızı'), baseCost: 8, growth: 2, max: 3, stat: (l) => 1 + 0.1 * l, describe: (v) => tr('+{0} hız', pct(v - 1)) }),

  talent('economy', 0, null, { id: 'tEcoLoot', name: tr('Ganimet'), icon: '💰', desc: tr('Düşmanlardan düşen altın'), baseCost: 2, growth: 1.6, max: 5, stat: (l) => 1 + 0.08 * l, describe: (v) => tr('+{0} altın', pct(v - 1)) }),
  talent('economy', 1, 'tEcoLoot', { id: 'tEcoVillage', name: tr('Bereketli Topraklar'), icon: '🌾', desc: tr('Köy geliri'), baseCost: 3, growth: 1.6, max: 5, stat: (l) => 1 + 0.1 * l, describe: (v) => tr('+{0} köy geliri', pct(v - 1)) }),
  talent('economy', 2, 'tEcoVillage', { id: 'tEcoGems', name: tr('Hazine Avcısı'), icon: '💠', desc: tr('Patronlardan ekstra Elmas'), baseCost: 5, growth: 1.7, max: 3, stat: (l) => l, describe: (v) => tr('+{0} Elmas/patron', v) }),
  talent('economy', 3, 'tEcoGems', { id: 'tEcoSouls', name: tr('Kâhin'), icon: '🔮', desc: tr('Yeniden Doğuş\'ta daha fazla Ruh Taşı'), baseCost: 8, growth: 2, max: 3, stat: (l) => 1 + 0.1 * l, describe: (v) => tr('+{0} Ruh Taşı', pct(v - 1)) }),
];

// ---- Elmas sources ------------------------------------------------------------

/** Elmas for killing a boss on `wave`; +1 the first time that boss wave is beaten. */
export const bossGems = (wave, firstTime, bonus) => 1 + Math.floor(wave / 30) + bonus + (firstTime ? 1 : 0);

/** Stage milestones on the best wave ever reached: [wave, gems]. */
export const GEM_MILESTONES = [[25, 3], [50, 4], [75, 5], [100, 6], [150, 8], [200, 10]];

export const PRESTIGE_GEMS = 1;

export const GEM_SOURCES = tr('Patron öldür (dalga 30\'da bir +1 fazla) · bir patronu ilk kez yenince +1 · aşama ödülleri: dalga 25 (+3), 50 (+4), 75 (+5), 100 (+6), 150, 200 · her Yeniden Doğuş +1');
