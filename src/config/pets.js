import { pct } from '../utils/format.js';
import { tr } from '../i18n/i18n.js';

/*
 * Yoldaşlar: companions adopted and raised with Öz (state.heroEssence, levels in
 * state.petLevels, so they survive Yeniden Doğuş). One walks with the hero at a time
 * (state.activePet): it acts on its own every `cooldown` seconds and grants its passive.
 *
 *   act      what it does (entities/Pet.js): pounce | dive | breath | mend | forage | hoot
 *   power    share of the hero's damage per hit (pounce, dive, breath), heal share (mend),
 *            seconds of income (forage) or slow fraction (hoot)
 *   bonus    the passive's key in Stats: rate, crit, damage, armor, gold, drop
 *   flies    hovers beside the hero instead of sitting on the wall
 */
const pet = (p) => ({
  ...p,
  id: `pet${p.key[0].toUpperCase()}${p.key.slice(1)}`,
  currency: 'heroEssence', hire: true, max: 20,
  stat: (l) => (l
    ? { power: p.power(l), cooldown: Math.max(p.minCd, p.cd - 0.12 * l), passive: p.passive * l }
    : null),
  describe: (s) => (s ? `${p.act_label(s)} · ${p.bonusLabel(s.passive)}` : tr('Sahipsiz')),
  short: (s) => (s ? p.bonusLabel(s.passive) : tr('Sahipsiz')),
  rows: (s) => (s
    ? [[tr('Yeteneği'), p.act_label(s)], [tr('Bekleme'), tr('{0} sn', s.cooldown.toFixed(1))], [tr('Pasif'), p.bonusLabel(s.passive)]]
    : [[tr('Yeteneği'), '—'], [tr('Bekleme'), '—'], [tr('Pasif'), '—']]),
});

export const PET_UPGRADES = [
  pet({
    key: 'wolf', name: tr('Kurt Yavrusu'), icon: '🐺', role: 'attack', stage: 5, baseCost: 10, growth: 1.3,
    desc: tr('Düşmana atılıp ısırır, kahramanın atış hızını artırır'),
    act: 'pounce', cd: 5, minCd: 2.5, power: (l) => 1.5 + 0.3 * l,
    act_label: (s) => tr('Isırık: ok hasarının {0}\'i', pct(s.power)),
    bonus: 'rate', passive: 0.01, bonusLabel: (v) => tr('+{0} atış hızı', pct(v)),
  }),
  pet({
    key: 'fox', name: tr('Altın Tilki'), icon: '🦊', role: 'support', stage: 10, baseCost: 15, growth: 1.3,
    desc: tr('Toprağı eşeleyip altın bulur, tüm altını artırır'),
    act: 'forage', cd: 12, minCd: 7, power: (l) => 4 + l,
    act_label: (s) => tr('Define: {0} sn\'lik kazanç', s.power),
    bonus: 'gold', passive: 0.015, bonusLabel: (v) => tr('+{0} altın', pct(v)),
  }),
  pet({
    key: 'hawk', name: tr('Av Şahini'), icon: '🦅', role: 'attack', stage: 15, baseCost: 20, growth: 1.32, flies: true,
    desc: tr('Uçanlara öncelik verip dalış yapar, kritik şansını artırır'),
    act: 'dive', cd: 4, minCd: 2, power: (l) => 1.2 + 0.25 * l,
    act_label: (s) => tr('Dalış: ok hasarının {0}\'i', pct(s.power)),
    bonus: 'crit', passive: 0.004, bonusLabel: (v) => tr('+{0} kritik şansı', pct(v)),
  }),
  pet({
    key: 'turtle', name: tr('Kaya Kaplumbağası'), icon: '🐢', role: 'defense', stage: 20, baseCost: 25, growth: 1.33,
    desc: tr('Kaleyi düzenli onarır, kaleye gelen hasarı azaltır'),
    act: 'mend', cd: 10, minCd: 6, power: (l) => 0.02 + 0.003 * l,
    act_label: (s) => tr('Onarım: canın {0}\'i', pct(s.power)),
    bonus: 'armor', passive: 0.008, bonusLabel: (v) => tr('-{0} kale hasarı', pct(v)),
  }),
  pet({
    key: 'owl', name: tr('Gece Baykuşu'), icon: '🦉', role: 'support', stage: 30, baseCost: 30, growth: 1.34, flies: true,
    desc: tr('Ötüşüyle düşmanları yavaşlatır, eşya şansını artırır'),
    act: 'hoot', cd: 9, minCd: 5, power: (l) => 0.2 + 0.015 * l,
    act_label: (s) => tr('Ötüş: {0} yavaşlatma', pct(s.power)),
    bonus: 'drop', passive: 0.02, bonusLabel: (v) => tr('+{0} eşya şansı', pct(v)),
  }),
  pet({
    key: 'drake', name: tr('Ejder Yavrusu'), icon: '🐲', role: 'attack', stage: 40, baseCost: 60, growth: 1.36,
    desc: tr('Yakan alev topu tükürür, kahraman hasarını artırır'),
    act: 'breath', cd: 6, minCd: 3, power: (l) => 2.5 + 0.5 * l,
    act_label: (s) => tr('Alev: ok hasarının {0}\'i', pct(s.power)),
    bonus: 'damage', passive: 0.02, bonusLabel: (v) => tr('+{0} kahraman hasarı', pct(v)),
  }),
];

export const PET_BY_ID = Object.fromEntries(PET_UPGRADES.map((u) => [u.id, u]));
export const PET_ROLES = [
  { id: 'attack', name: tr('Saldırgan') },
  { id: 'defense', name: tr('Savunma') },
  { id: 'support', name: tr('Destek') },
];
