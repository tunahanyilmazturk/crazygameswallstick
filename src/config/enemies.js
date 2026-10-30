import { biomeForWave } from '../render/biomes.js';
import { tr } from '../i18n/i18n.js';

/**
 * Base enemy stats at wave 1. `range` > 0 means the enemy throws spears from afar.
 * `armor` reduces physical damage (magic ignores it).
 * `siege` engines roll past the soldiers straight at the wall and shrug off knockback;
 * `pack` spawns that many at once (one wave slot each); `w`/`h` override the stick-figure
 * hit box; `intro` is the banner shown the first time the type appears.
 * `regions` limits a type to those map regions. Behaviours (entities/Enemy.js):
 *   suicide  blows up on the first thing it reaches     dodge    chance to evade physical hits
 *   heal     share of max HP restored to nearby allies  burrow   untouchable until near the wall
 *   split    [type, count] spawned on death             regen    share of max HP healed per second
 *   summon   { type, n, every } while on the field      stomp    seconds between shockwaves
 *   bolt     colour of a thrown magic orb (with range)
 * Every boss enrages below 30% HP.
 */
export const ENEMY_TYPES = {
  grunt: { name: tr('Haydut'), hp: 20, speed: 42, damage: 5, atkRate: 1, range: 0, gold: 3, scale: 1, armor: 0, minWave: 1, weight: 10 },
  vulture: { name: tr('Akbaba'), hp: 15, speed: 68, damage: 5, atkRate: 1.1, range: 0, gold: 5, scale: 0.82, armor: 0, minWave: 6, weight: 3, fly: true, intro: tr('Uçar, kalkanlıları aşıp surlara dalar — Avcı onlara 2,5 kat vurur') },
  runner: { name: tr('Akıncı'), hp: 12, speed: 92, damage: 3, atkRate: 1.4, range: 0, gold: 3, scale: 0.85, armor: 0, minWave: 3, weight: 5, intro: tr('Çok hızlı ama kırılgan') },
  thrower: { name: tr('Mızrakçı'), hp: 16, speed: 40, damage: 6, atkRate: 0.5, range: 260, gold: 5, scale: 1, armor: 0, minWave: 5, weight: 4, intro: tr('Uzaktan mızrak fırlatır') },
  shield: { name: tr('Kalkanlı'), hp: 30, speed: 32, damage: 6, atkRate: 0.8, range: 0, gold: 6, scale: 1.05, armor: 0.4, minWave: 7, weight: 4, intro: tr('Zırhlı — büyü ve yanma zırhı yok sayar') },
  brute: { name: tr('Dev'), hp: 90, speed: 26, damage: 16, atkRate: 0.6, range: 0, gold: 14, scale: 1.5, armor: 0.1, minWave: 9, weight: 2, intro: tr('Ağır ve dayanıklı') },
  raven: { name: tr('Kuzgun'), hp: 8, speed: 105, damage: 3, atkRate: 1.3, range: 0, gold: 2, scale: 0.62, armor: 0, minWave: 12, weight: 2, fly: true, pack: 3, altitude: 200, intro: tr('Üçlü sürüler halinde, yüksekten ve çok hızlı uçar') },
  ram: { name: tr('Koçbaşı'), hp: 160, speed: 28, damage: 30, atkRate: 0.35, range: 0, gold: 14, scale: 1.3, armor: 0.35, minWave: 16, weight: 1, siege: true, w: 86, h: 62, intro: tr('Kuşatma makinesi: askerleri ezip geçer, kapıyı döver · zırhlı, büyü etkili') },
  catapult: { name: tr('Mancınık'), hp: 120, speed: 24, damage: 26, atkRate: 0.22, range: 560, gold: 16, scale: 1.2, armor: 0.25, minWave: 25, weight: 0.8, siege: true, w: 80, h: 70, intro: tr('Kuşatma makinesi: çok uzaktan surlara kaya fırlatır — önce onu vur!') },
  sapper: { name: tr('Lağımcı'), hp: 14, speed: 78, damage: 26, atkRate: 1, range: 0, gold: 7, scale: 0.85, armor: 0, minWave: 14, weight: 2, suicide: true, intro: tr('Barut fıçısıyla koşar, değdiği yerde patlar — ulaşmadan vur!') },
  shaman: { name: tr('Şaman'), hp: 26, speed: 34, damage: 4, atkRate: 0.5, range: 320, gold: 9, scale: 1, armor: 0, minWave: 18, weight: 1.5, heal: 0.08, bolt: '#7fe08a', intro: tr('Arkada durup çevresindeki düşmanları iyileştirir — öncelikli hedef') },
  assassin: { name: tr('Suikastçı'), hp: 18, speed: 110, damage: 9, atkRate: 1.2, range: 0, gold: 8, scale: 0.92, armor: 0, minWave: 22, weight: 2, dodge: 0.3, intro: tr('Çok hızlı, okların üçte birinden sıyrılır — büyü her zaman isabet eder') },
  ironknight: { name: tr('Demir Şövalye'), hp: 60, speed: 30, damage: 14, atkRate: 0.7, range: 0, gold: 12, scale: 1.2, armor: 0.6, minWave: 32, weight: 1.6, intro: tr('Ağır zırh: okların çoğunu savuşturur, büyü ve yanma işe yarar') },
  witch: { name: tr('Buz Cadısı'), hp: 34, speed: 36, damage: 9, atkRate: 0.45, range: 340, gold: 11, scale: 1, armor: 0.1, minWave: 50, weight: 3, regions: ['snow'], regen: 0.02, bolt: '#9fdcff', intro: tr('Buz küreleri fırlatır, yaraları kendiliğinden kapanır') },
  scorpion: { name: tr('Kum Akrebi'), hp: 44, speed: 62, damage: 11, atkRate: 1, range: 0, gold: 11, scale: 1, armor: 0.45, minWave: 75, weight: 3, regions: ['desert'], burrow: true, w: 46, h: 30, intro: tr('Kumun altından gelir: yüzeye çıkana kadar vurulamaz') },
  golem: { name: tr('Lav Golemi'), hp: 120, speed: 24, damage: 20, atkRate: 0.5, range: 0, gold: 18, scale: 1.5, armor: 0.3, minWave: 100, weight: 3, regions: ['volcano'], split: ['cinder', 2], rock: { body: '#3a2a2a', glow: '#ff8a3a' }, intro: tr('Yıkılınca iki Kor parçasına ayrılır') },
  cinder: { name: tr('Kor'), hp: 20, speed: 70, damage: 6, atkRate: 1.2, range: 0, gold: 3, scale: 0.6, armor: 0, minWave: Infinity, weight: 0, rock: { body: '#4a2a22', glow: '#ffb347' } },
  toxic: { name: tr('Zehir Tükürücü'), hp: 38, speed: 38, damage: 11, atkRate: 0.55, range: 300, gold: 11, scale: 1, armor: 0.1, minWave: 125, weight: 3, regions: ['swamp'], bolt: '#a8e04a', intro: tr('Uzaktan zehir tükürür') },
  crystal: { name: tr('Kristal Dev'), hp: 110, speed: 26, damage: 22, atkRate: 0.5, range: 0, gold: 18, scale: 1.4, armor: 0.5, minWave: 150, weight: 3, regions: ['crystal'], split: ['shard', 3], rock: { body: '#5a4a8a', glow: '#d6c4ff' }, intro: tr('Zırhlıdır, kırılınca üç keskin parçaya bölünür') },
  shard: { name: tr('Kristal Parçası'), hp: 16, speed: 80, damage: 7, atkRate: 1.3, range: 0, gold: 3, scale: 0.5, armor: 0.2, minWave: Infinity, weight: 0, rock: { body: '#7a68b0', glow: '#e6d8ff' } },
  wraith: { name: tr('Hayalet'), hp: 40, speed: 56, damage: 12, atkRate: 0.9, range: 0, gold: 12, scale: 1, armor: 0.7, minWave: 175, weight: 3, regions: ['void'], fly: true, altitude: 110, dodge: 0.15, intro: tr('Uçar ve bedensizdir: oklar içinden geçer, büyü yakar') },

  boss: { name: tr('Savaş Lordu'), hp: 700, speed: 18, damage: 45, atkRate: 0.5, range: 0, gold: 200, scale: 2.4, armor: 0.2, boss: true },
  troll: { name: tr('Dağ Trolü'), hp: 800, speed: 20, damage: 45, atkRate: 0.5, range: 0, gold: 240, scale: 2.5, armor: 0.1, boss: true, regen: 0.012, intro: tr('Yaraları hızla kapanır: ateş ve sürekli hasar gerekir') },
  frostGiant: { name: tr('Buz Devi'), hp: 900, speed: 17, damage: 50, atkRate: 0.45, range: 0, gold: 280, scale: 2.7, armor: 0.25, boss: true, stomp: 9, intro: tr('Ayağını vurdukça askerlerin sarsılır') },
  pharaoh: { name: tr('Çöl Firavunu'), hp: 850, speed: 18, damage: 40, atkRate: 0.45, range: 300, gold: 320, scale: 2.2, armor: 0.2, boss: true, bolt: '#ffd34d', summon: { type: 'scorpion', n: 2, every: 10 }, intro: tr('Uzaktan büyü yapar, kumdan akrepler çağırır') },
  dragon: { name: tr('Kül Ejderi'), hp: 950, speed: 26, damage: 42, atkRate: 0.5, range: 400, gold: 380, scale: 2.4, armor: 0.3, boss: true, fly: true, altitude: 210, w: 110, h: 60, bolt: '#ff7a3c', intro: tr('Sur aşmaz, üstünden uçar ve ateş kusar') },
  necro: { name: tr('Ölü Çağıran'), hp: 950, speed: 17, damage: 42, atkRate: 0.45, range: 280, gold: 430, scale: 2.3, armor: 0.2, boss: true, bolt: '#a8e04a', summon: { type: 'grunt', n: 3, every: 8 }, intro: tr('Durmadan ölüleri kaldırır: önce onu yık') },
  crystalKing: { name: tr('Kristal Kral'), hp: 1150, speed: 16, damage: 52, atkRate: 0.45, range: 0, gold: 480, scale: 2.7, armor: 0.45, boss: true, stomp: 8, intro: tr('Çok zırhlı: büyü kullan') },
  voidLord: { name: tr('Boşluk Lordu'), hp: 1300, speed: 18, damage: 55, atkRate: 0.5, range: 0, gold: 560, scale: 2.8, armor: 0.3, boss: true, regen: 0.008, stomp: 10, summon: { type: 'wraith', n: 2, every: 11 }, intro: tr('Son düşman: iyileşir, sarsar ve hayaletler çağırır') },
};

/** Which boss holds each map region; the region picks the boss of its tenth waves. */
const REGION_BOSS = { vale: 'boss', autumn: 'troll', snow: 'frostGiant', desert: 'pharaoh', volcano: 'dragon', swamp: 'necro', crystal: 'crystalKing', void: 'voidLord' };
export const BOSS_TYPES = Object.values(REGION_BOSS);
export const bossForWave = (wave) => REGION_BOSS[biomeForWave(wave).id] ?? 'boss';

/** Types with a region can only be met there. */
export const spawnsOn = (def, wave) => wave >= def.minWave && (!def.regions || def.regions.includes(biomeForWave(wave).id));

/** Types that existed before the intro banners; older saves have already met them. */
export const LEGACY_ENEMY_TYPES = ['grunt', 'vulture', 'runner', 'thrower', 'shield', 'brute', 'boss'];

export function waveScaling(wave) {
  const w = wave - 1;
  return {
    hp: Math.pow(1.156, w) * (1 + 0.05 * w),
    dmg: Math.pow(1.115, w),
    gold: Math.pow(1.08, w),
  };
}

export const isBossWave = (wave) => wave % 10 === 0;
