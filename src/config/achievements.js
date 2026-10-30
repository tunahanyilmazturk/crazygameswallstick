import { VILLAGE_SITES } from './village.js';
import { getHeroSetProgress, codexProgress, HERO_ITEM_TEMPLATES } from '../systems/HeroItems.js';
import { UNITS } from '../units/roster.js';
import { BOSS_TYPES } from './enemies.js';
import { PET_UPGRADES } from './pets.js';
import { tr } from '../i18n/i18n.js';

/*
 * Achievements are permanent (state.achievements, kept through Yeniden Doğuş). Each one
 * pays Elmas once and adds Şan points by its medal: points raise all damage and gold, and
 * passing a Şan rank (GLORY_RANKS) grants that rank's perk for good.
 * `value(state)` is the live progress compared against `goal`; tallies that the game
 * does not already keep live in state.counters (see Game.count). `secret` ones show
 * as ??? until they are earned.
 */
const GLORY_PER_POINT = 0.0004;

/** Medal of an achievement, set by its Elmas reward: 0 bronze, 1 silver, 2+ gold. */
export const MEDALS = [
  { id: 'bronze', name: tr('Bronz'), color: '#d0935a', points: 10 },
  { id: 'silver', name: tr('Gümüş'), color: '#c9d3e0', points: 25 },
  { id: 'gold', name: tr('Altın'), color: '#ffd34d', points: 50 },
];
export const medalOf = (a) => MEDALS[Math.min(2, a.gems)];

/** Şan ranks. `perk` keys: rate, crit, castleHp, village, gold (fractions), slots (bag). */
export const GLORY_RANKS = [
  { points: 0, name: tr('Acemi'), perk: {}, desc: tr('Başlangıç rütbesi') },
  { points: 60, name: tr('Er'), perk: { rate: 0.03 }, desc: tr('+%3 atış hızı') },
  { points: 180, name: tr('Onbaşı'), perk: { crit: 0.02 }, desc: tr('+%2 kritik şansı') },
  { points: 350, name: tr('Çavuş'), perk: { slots: 10 }, desc: tr('+10 çanta yuvası') },
  { points: 550, name: tr('Yüzbaşı'), perk: { castleHp: 0.1 }, desc: tr('+%10 kale canı') },
  { points: 800, name: tr('Binbaşı'), perk: { village: 0.15 }, desc: tr('+%15 köy geliri') },
  { points: 1100, name: tr('Albay'), perk: { rate: 0.05 }, desc: tr('+%5 atış hızı') },
  { points: 1400, name: tr('Mareşal'), perk: { gold: 0.15, crit: 0.03 }, desc: tr('+%15 altın, +%3 kritik şansı') },
];

const counter = (key) => (s) => s.counters?.[key] ?? 0;
const equippedCount = (s) => Object.values(s.heroEquipment ?? {}).filter(Boolean).length;
const bestItemLevel = (s) => (s.heroInventory ?? []).reduce((best, item) => Math.max(best, Number(item.level) || 0), 0);
const bestSetCount = (s) => Math.max(0, ...getHeroSetProgress(s).map((set) => set.count));
const hiredUnits = (s) => UNITS.filter((u) => (s.levels?.[u.id] ?? 0) > 0).length;
const builtSites = (s) => VILLAGE_SITES.filter((site) => (s.levels?.[site.building.id] ?? 0) > 0).length;
const level = (id) => (s) => s.levels?.[id] ?? 0;
const codexFound = (s) => codexProgress(s).found;

export const ACHIEVEMENT_GROUPS = [
  { id: 'war', name: tr('Savaş'), icon: '⚔️' },
  { id: 'progress', name: tr('İlerleme'), icon: '🏰' },
  { id: 'wealth', name: tr('Servet ve Ganimet'), icon: '💰' },
  { id: 'fort', name: tr('Kale ve Zanaat'), icon: '🛠️' },
  { id: 'secret', name: tr('Gizli'), icon: '❔' },
];

export const ACHIEVEMENTS = [
  { id: 'kills100', group: 'war', icon: '🏹', name: tr('İlk Kan'), desc: tr('100 düşman yen'), goal: 100, value: (s) => s.kills, gems: 0 },
  { id: 'kills1k', group: 'war', icon: '🏹', name: tr('Kılıç Ustası'), desc: tr('1.000 düşman yen'), goal: 1000, value: (s) => s.kills, gems: 1 },
  { id: 'kills10k', group: 'war', icon: '⚔️', name: tr('Ordu Kıran'), desc: tr('10.000 düşman yen'), goal: 10000, value: (s) => s.kills, gems: 1 },
  { id: 'kills100k', group: 'war', icon: '⚔️', name: tr('Efsanevi Okçu'), desc: tr('100.000 düşman yen'), goal: 100000, value: (s) => s.kills, gems: 2 },
  { id: 'boss1', group: 'war', icon: '💀', name: tr('Lord Avcısı'), desc: tr('Bir Savaş Lordu yen'), goal: 1, value: counter('bossKills'), gems: 1 },
  { id: 'boss25', group: 'war', icon: '👑', name: tr('Taç Toplayıcı'), desc: tr('25 Savaş Lordu yen'), goal: 25, value: counter('bossKills'), gems: 2 },
  { id: 'siege25', group: 'war', icon: '🔨', name: tr('Kuşatma Kırıcı'), desc: tr('25 Koçbaşı ya da Mancınık yok et'), goal: 25, value: counter('siegeKills'), gems: 1 },
  { id: 'flyer200', group: 'war', icon: '🎯', name: tr('Gökyüzü Muhafızı'), desc: tr('200 uçan düşman düşür'), goal: 200, value: counter('flyerKills'), gems: 1 },
  { id: 'crit5k', group: 'war', icon: '🎯', name: tr('Ölümcül Nişancı'), desc: tr('5.000 kritik vuruş yap'), goal: 5000, value: counter('crits'), gems: 1 },
  { id: 'streak50', group: 'war', icon: '🔥', name: tr('Durdurulamaz'), desc: tr('Arka arkaya 50 düşmanı seri halinde yen'), goal: 50, value: counter('bestStreak'), gems: 1 },
  { id: 'manual500', group: 'war', icon: '🏹', name: tr('Tetikçi'), desc: tr('Savaş alanına tıklayarak 500 ok at'), goal: 500, value: counter('manualShots'), gems: 1 },
  { id: 'army', group: 'war', icon: '🚩', name: tr('Tam Ordu'), desc: tr('Bütün birlik türlerini aynı anda kirala'), goal: UNITS.length, value: hiredUnits, gems: 2 },
  { id: 'skill100', group: 'war', icon: '✨', name: tr('Yetenekli Komutan'), desc: tr('100 kez yetenek kullan'), goal: 100, value: counter('skillCasts'), gems: 1 },

  { id: 'wave10', group: 'progress', icon: '🌊', name: tr('İlk Adımlar'), desc: tr('Dalga 10\'a ulaş'), goal: 10, value: (s) => s.bestWave, gems: 0 },
  { id: 'wave25', group: 'progress', icon: '🌊', name: tr('Sınır Boyu'), desc: tr('Dalga 25\'e ulaş'), goal: 25, value: (s) => s.bestWave, gems: 1 },
  { id: 'wave50', group: 'progress', icon: '🏰', name: tr('Kale Efsanesi'), desc: tr('Dalga 50\'ye ulaş'), goal: 50, value: (s) => s.bestWave, gems: 1 },
  { id: 'wave100', group: 'progress', icon: '🏰', name: tr('Yüz Dalga'), desc: tr('Dalga 100\'e ulaş'), goal: 100, value: (s) => s.bestWave, gems: 2 },
  { id: 'perfect50', group: 'progress', icon: '🛡️', name: tr('Kusursuz Savunma'), desc: tr('50 dalgayı kale hiç hasar almadan bitir'), goal: 50, value: counter('perfectWaves'), gems: 1 },
  { id: 'fall1', group: 'progress', icon: '🧱', name: tr('Acı Ders'), desc: tr('Kalen bir kez düşsün — her yenilgi bir derstir'), goal: 1, value: counter('castleFalls'), gems: 0 },
  { id: 'prestige1', group: 'progress', icon: '💎', name: tr('Küllerinden Doğan'), desc: tr('İlk Yeniden Doğuş\'unu yap'), goal: 1, value: (s) => s.prestiges, gems: 1 },
  { id: 'prestige10', group: 'progress', icon: '💎', name: tr('Sonsuz Döngü'), desc: tr('10 kez Yeniden Doğ'), goal: 10, value: (s) => s.prestiges, gems: 2 },

  { id: 'gold1m', group: 'wealth', icon: '💰', name: tr('Hazine Bekçisi'), desc: tr('Toplam 1 milyon altın kazan'), goal: 1e6, value: (s) => s.totalGold, gems: 0 },
  { id: 'gold1b', group: 'wealth', icon: '👑', name: tr('Altın Dağı'), desc: tr('Toplam 1 milyar altın kazan'), goal: 1e9, value: (s) => s.totalGold, gems: 1 },
  { id: 'village5', group: 'wealth', icon: '🏘️', name: tr('Köy Ağası'), desc: tr('Köydeki {0} tesisin hepsini kur', VILLAGE_SITES.length), goal: VILLAGE_SITES.length, value: builtSites, gems: 1 },
  { id: 'items50', group: 'wealth', icon: '🏦', name: tr('Ganimetçi'), desc: tr('50 eşya bul'), goal: 50, value: counter('itemsFound'), gems: 1 },
  { id: 'legendary1', group: 'wealth', icon: '🌟', name: tr('Efsane Peşinde'), desc: tr('Efsanevi bir eşya bul'), goal: 1, value: counter('legendaries'), gems: 2 },
  { id: 'fullgear', group: 'wealth', icon: '🛡️', name: tr('Tam Teçhizat'), desc: tr('Dokuz yuvanın hepsine eşya kuşan'), goal: 9, value: equippedCount, gems: 1 },
  { id: 'set4', group: 'wealth', icon: '🔮', name: tr('Takım Ruhu'), desc: tr('Bir setin 4 parçasını aynı anda kuşan'), goal: 4, value: bestSetCount, gems: 1 },
  { id: 'item12', group: 'wealth', icon: '🔨', name: tr('Usta Demirci'), desc: tr('Bir eşyayı +12\'ye kadar geliştir'), goal: 12, value: bestItemLevel, gems: 2 },
  { id: 'gold1t', group: 'wealth', icon: '👑', name: tr('Krallık Hazinesi'), desc: tr('Toplam 1 trilyon altın kazan'), goal: 1e12, value: (s) => s.totalGold, gems: 2 },
  { id: 'legendary10', group: 'wealth', icon: '🌟', name: tr('Efsane Avcısı'), desc: tr('10 Efsanevi eşya bul'), goal: 10, value: counter('legendaries'), gems: 2 },
  { id: 'set6', group: 'wealth', icon: '🔮', name: tr('Tam Set'), desc: tr('Bir setin 6 parçasını aynı anda kuşan'), goal: 6, value: bestSetCount, gems: 2 },
  { id: 'codex15', group: 'wealth', icon: '📖', name: tr('Meraklı'), desc: tr('15 farklı eşya türü bul'), goal: 15, value: codexFound, gems: 1 },
  { id: 'codexAll', group: 'wealth', icon: '📚', name: tr('Tam Koleksiyon'), desc: tr('Bütün eşya türlerini bul'), goal: Object.keys(HERO_ITEM_TEMPLATES).length, value: codexFound, gems: 2 },

  { id: 'kills1m', group: 'war', icon: '⚔️', name: tr('Savaş Tanrısı'), desc: tr('1 milyon düşman yen'), goal: 1e6, value: (s) => s.kills, gems: 2 },
  { id: 'boss100', group: 'war', icon: '👑', name: tr('Lordların Lordu'), desc: tr('100 Savaş Lordu yen'), goal: 100, value: counter('bossKills'), gems: 2 },
  { id: 'streak200', group: 'war', icon: '🔥', name: tr('Kan Fırtınası'), desc: tr('Arka arkaya 200 düşmanı seri halinde yen'), goal: 200, value: counter('bestStreak'), gems: 2 },
  { id: 'skill1k', group: 'war', icon: '✨', name: tr('Büyük Komutan'), desc: tr('1.000 kez yetenek kullan'), goal: 1000, value: counter('skillCasts'), gems: 2 },
  { id: 'midas500', group: 'war', icon: '🌟', name: tr('Altın Dokunuş'), desc: tr('Midas Dokunuşu sırasında 500 düşman yen'), goal: 500, value: counter('midasKills'), gems: 1 },
  { id: 'wave200', group: 'progress', icon: '🏰', name: tr('Sınırların Efendisi'), desc: tr('Dalga 200\'e ulaş'), goal: 200, value: (s) => s.bestWave, gems: 2 },

  { id: 'fort10', group: 'fort', icon: '🏰', name: tr('Hisar Sahibi'), desc: tr('Taş Duvarlar\'ı Sv 10\'a çıkar'), goal: 10, value: level('castleHp'), gems: 0 },
  { id: 'fort25', group: 'fort', icon: '🏰', name: tr('Büyük Kale'), desc: tr('Taş Duvarlar\'ı Sv 25\'e çıkar'), goal: 25, value: level('castleHp'), gems: 1 },
  { id: 'fort50', group: 'fort', icon: '👑', name: tr('Altın Hisar'), desc: tr('Taş Duvarlar\'ı Sv 50\'ye çıkar'), goal: 50, value: level('castleHp'), gems: 2 },
  { id: 'outer25', group: 'fort', icon: '🧱', name: tr('Çifte Sur'), desc: tr('Dış Sur\'u Sv 25\'e çıkar'), goal: 25, value: level('castleOuterWall'), gems: 1 },
  { id: 'stone200', group: 'fort', icon: '🪨', name: tr('Mancınıkçı'), desc: tr('Burç Mancınığı ile 200 kaya at'), goal: 200, value: counter('stonesThrown'), gems: 1 },
  { id: 'bell100', group: 'fort', icon: '🔔', name: tr('Çan Kulesi'), desc: tr('Savaş Çanı 100 kez çalsın'), goal: 100, value: counter('bellRings'), gems: 1 },
  { id: 'fuse10', group: 'fort', icon: '🔨', name: tr('Simyacı'), desc: tr('Demircide 10 kez birleştirme yap'), goal: 10, value: counter('fusions'), gems: 1 },

  { id: 'allBosses', group: 'war', icon: '💀', name: tr('Lord Koleksiyoncusu'), desc: tr('Her bölgenin patronunu en az bir kez yen'), goal: BOSS_TYPES.length, value: (s) => Object.keys(s.bossesSlain ?? {}).length, gems: 2 },
  { id: 'wave175', group: 'progress', icon: '🌌', name: tr('Boşluğa Bakan'), desc: tr('Son bölge olan Boşluk Sınırı\'na ulaş'), goal: 175, value: (s) => s.bestWave, gems: 2 },

  { id: 'prestige25', group: 'progress', icon: '💎', name: tr('Ölümsüz'), desc: tr('25 kez Yeniden Doğ'), goal: 25, value: (s) => s.prestiges, gems: 2 },
  { id: 'oath5', group: 'progress', icon: '🔥', name: tr('Sözünün Eri'), desc: tr('Yeminli 5 yolculuğu tamamla'), goal: 5, value: counter('oathRuns'), gems: 1 },

  { id: 'pet1', group: 'fort', icon: '🐺', name: tr('İlk Dost'), desc: tr('İlk yoldaşını sahiplen'), goal: 1, value: (s) => Object.keys(s.petLevels ?? {}).length, gems: 0 },
  { id: 'petAll', group: 'fort', icon: '🐲', name: tr('Hayvan Terbiyecisi'), desc: tr('Bütün yoldaşları sahiplen'), goal: PET_UPGRADES.length, value: (s) => Object.keys(s.petLevels ?? {}).length, gems: 2 },

  { id: 'bossPerfect', group: 'secret', icon: '🛡️', secret: true, name: tr('Dokunulmaz'), desc: tr('Bir patron dalgasını kale hiç hasar almadan bitir'), goal: 1, value: counter('perfectBosses'), gems: 1 },
  { id: 'fall10', group: 'secret', icon: '🧱', secret: true, name: tr('Düşe Kalka'), desc: tr('Kalen 10 kez düşsün'), goal: 10, value: counter('castleFalls'), gems: 0 },
  { id: 'hoard', group: 'secret', icon: '💰', secret: true, name: tr('Cimri'), desc: tr('Kasanda 1 milyon altın biriktir'), goal: 1e6, value: (s) => s.gold, gems: 1 },
  { id: 'sold100', group: 'secret', icon: '🪙', secret: true, name: tr('Hurdacı'), desc: tr('Elle 100 eşya sat'), goal: 100, value: counter('itemsSold'), gems: 1 },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function achievementCount(state) {
  return ACHIEVEMENTS.filter((a) => state.achievements?.[a.id]).length;
}

export function gloryPoints(state) {
  return ACHIEVEMENTS.reduce((sum, a) => sum + (state.achievements?.[a.id] ? medalOf(a).points : 0), 0);
}

/** The rank held at `points`, with the next one (null at the top). */
export function gloryRank(points) {
  const index = GLORY_RANKS.findLastIndex((rank) => points >= rank.points);
  return { index, rank: GLORY_RANKS[index], next: GLORY_RANKS[index + 1] ?? null };
}

/** Hero damage and gold share added per point, as a fraction. */
export const gloryPercent = (points) => points * GLORY_PER_POINT;

/** Permanent bonuses from unlocked achievements ("Şan"): the multiplier and every rank's perk. */
export function achievementBonus(state) {
  const points = gloryPoints(state);
  const { index } = gloryRank(points);
  const perks = { rate: 0, crit: 0, castleHp: 0, village: 0, gold: 0, slots: 0 };
  for (const rank of GLORY_RANKS.slice(0, index + 1)) {
    for (const [key, value] of Object.entries(rank.perk)) perks[key] += value;
  }
  return { count: achievementCount(state), points, perks, mult: 1 + gloryPercent(points) };
}
