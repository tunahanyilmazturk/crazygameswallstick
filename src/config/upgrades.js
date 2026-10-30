import { fmt, pct } from '../utils/format.js';
import { ACTIVE_SKILLS, TALENTS } from './skills.js';
import { VILLAGE_SITES } from './village.js';
import { UNITS } from '../units/roster.js';
import { PET_UPGRADES } from './pets.js';
import { tr } from '../i18n/i18n.js';

/**
 * Every upgrade shares one cost formula: cost(level) = baseCost * growth^level.
 * `stat(level)` is the gameplay value at that level, `describe(stat)` its full label,
 * `short(stat)` a compact label for the shop card (defaults to describe),
 * `rows(stat)` detailed tooltip rows and `info` an extra tooltip line.
 * Ally upgrades start at level 0 (= not hired); the first purchase hires the unit.
 */

export const HERO_UPGRADES = [
  {
    id: 'heroAuto', name: tr('Otomatik Atış'), icon: '🎯', iconArt: 'target', currency: 'gems', skill: true,
    desc: tr('Kahraman sen tıklamadan da ateş etsin'),
    info: tr('Açılmadan önce kahraman yalnızca tıkladığın yere ok atar (basılı tutunca seri atar). İlk seviye otomatik atışı yavaş açar; her seviye hızını artırır. Elmas ile alınır, Yeniden Doğuş\'ta kaybolmaz.'),
    stage: 10, baseCost: 3, growth: 1.45, max: 6,
    stat: (l) => (l ? 0.3 + 0.14 * (l - 1) : 0),
    describe: (v) => (v ? tr('Otomatik atış: atış hızının {0}\'i', pct(v)) : tr('Kapalı — tıklayarak ateş et')),
    short: (v) => (v ? tr('{0} hız', pct(v)) : tr('Kapalı')),
  },
  {
    id: 'heroDamage', name: tr('Keskin Oklar'), icon: '🏹', desc: tr('Kahramanın ok hasarı'),
    info: tr('Ok Yağmuru okları da bu hasarın 2 katını vurur.'),
    baseCost: 10, growth: 1.15,
    stat: (l) => 10 * Math.pow(1.13, l) + 4 * l,
    describe: (v) => tr('{0} hasar', fmt(v)),
    short: (v) => fmt(v),
  },
  {
    id: 'heroRate', name: tr('Seri Atış'), icon: '⚡', desc: tr('Saniyedeki atış sayısı'),
    info: tr('Ruh geliştirmesi Savaş Ritmi ile çarpılır.'),
    baseCost: 25, growth: 1.2, max: 50,
    stat: (l) => 1 + 0.08 * l,
    describe: (v) => tr('{0}/sn', v.toFixed(2)),
  },
  {
    id: 'heroCrit', name: tr('Ölümcül Nişan'), icon: '🎯', desc: tr('Kritik vuruş şansı'),
    info: tr('Kritik vuruşlar düşmanı daha çok geri savurur.'),
    baseCost: 60, growth: 1.24, max: 30,
    stat: (l) => 0.05 + 0.015 * l,
    describe: (v) => pct(v),
  },
  {
    id: 'heroCritDmg', name: tr('Zehirli Uç'), icon: '☠️', desc: tr('Kritik hasar çarpanı'),
    baseCost: 80, growth: 1.2,
    stat: (l) => 1.5 + 0.15 * l,
    describe: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'heroMulti', name: tr('Çoklu Ok'), icon: '🎐', desc: tr('Aynı anda atılan ok sayısı'),
    info: tr('Her ok ayrı ayrı kritik şansı taşır.'),
    baseCost: 400, growth: 7, max: 4,
    stat: (l) => 1 + l,
    describe: (v) => tr('{0} ok', v),
  },
  {
    id: 'heroRain', name: tr('Ok Yağmuru'), icon: '🌧️', desc: tr('Yetenek: gökten ok yağdırır'),
    info: tr('18 sn bekleme süresi (Fırtına Çağrısı ile kısalır). Boşluk tuşu ya da sol alttaki düğmeyle kullanılır.'),
    baseCost: 150, growth: 1.35, max: 30,
    stat: (l) => (l ? 10 + 3 * l : 0),
    describe: (v) => (v ? tr('{0} ok', v) : tr('Kilitli')),
  },
  {
    id: 'heroPierce', name: tr('Delici Oklar'), icon: '🔱', desc: tr('Oklar ilk düşmandan geçip arkadakini de vurur'),
    info: tr('Kalabalık dalgalarda ve dar saflarda çok etkili.'),
    baseCost: 2500, growth: 6, max: 3,
    stat: (l) => l,
    describe: (v) => (v ? tr('+{0} hedef', v) : tr('Yok')),
  },
  {
    id: 'heroBurn', name: tr('Ateşli Oklar'), icon: '🔥', desc: tr('Kahramanın okları düşmanı 3 sn yakar'),
    info: tr('Yanma hasarı zırhı yok sayar. Saniyelik yanma, ok hasarının bu oranı kadardır.'),
    baseCost: 900, growth: 1.3, max: 20,
    stat: (l) => (l ? 0.05 + 0.02 * l : 0),
    describe: (v) => (v ? tr('{0}/sn yanma', pct(v)) : tr('Yok')),
  },
  {
    id: 'heroRainCd', name: tr('Fırtına Çağrısı'), icon: '🌩️', desc: tr('Ok Yağmuru bekleme süresini kısaltır'),
    baseCost: 600, growth: 1.4, max: 20,
    stat: (l) => RAIN_COOLDOWN * Math.pow(0.94, l),
    describe: (v) => tr('{0} sn', v.toFixed(1)),
  },
];

export const CASTLE_UPGRADES = [
  {
    id: 'castleHp', name: tr('Taş Duvarlar'), icon: '🧱', desc: tr('Kalenin maksimum canı'),
    info: tr('Kale düşerse 2 dalga geri çekilirsin. Sv 10 Hisar, Sv 25 Büyük Kale, Sv 50 Altın Hisar: kale daha iyi taşla yeniden yapılır.'),
    baseCost: 15, growth: 1.17,
    stat: (l) => 100 * Math.pow(1.12, l) + 25 * l,
    describe: (v) => tr('{0} can', fmt(v)),
    short: (v) => fmt(v),
  },
  {
    id: 'castleRegen', name: tr('Onarım Ekibi'), icon: '🔨', desc: tr('Saniyede yenilenen can'),
    baseCost: 40, growth: 1.19,
    stat: (l) => (l ? 1.5 * Math.pow(1.13, l) + l : 0),
    describe: (v) => tr('{0}/sn', fmt(v)),
  },
  {
    id: 'castleArmor', name: tr('Demir Kaplama'), icon: '⛓️', desc: tr('Kalenin aldığı hasarı azaltır'),
    baseCost: 100, growth: 1.25, max: 40,
    stat: (l) => 1 - Math.pow(0.96, l),
    describe: (v) => pct(v),
  },
  {
    id: 'castleGold', name: tr('Hazine Odası'), icon: '💰', desc: tr('Düşmanlardan daha fazla altın'),
    info: tr('Dalga bitirme ödülünü de artırır.'),
    baseCost: 120, growth: 1.3,
    stat: (l) => 1 + 0.12 * l,
    describe: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'castleThorns', name: tr('Dikenli Surlar'), icon: '🌵', desc: tr('Duvara vuran düşman kendi canının bir kısmını kaybeder'),
    info: tr('Yalnızca yakın dövüş saldırılarında çalışır; zırhı yok sayar.'),
    baseCost: 800, growth: 1.4, max: 10,
    stat: (l) => 0.015 * l,
    describe: (v) => (v ? tr('vuruş başı {0} can', pct(v)) : tr('Yok')),
    short: (v) => (v ? pct(v) : tr('Yok')),
  },
  {
    id: 'castleOil', name: tr('Kaynar Yağ'), icon: '🫕', desc: tr('Duvar dibindeki düşmanlara kaynar yağ dökülür'),
    info: tr('Duvarın önündeki herkese alan hasarı verir ve zırhı yok sayar.'),
    baseCost: 1200, growth: 1.22,
    stat: (l) => (l ? { damage: 40 * Math.pow(1.16, l - 1), cooldown: Math.max(4, 9 - 0.2 * l) } : null),
    describe: (s) => (s ? tr('{0} hasar / {1} sn', fmt(s.damage), s.cooldown.toFixed(1)) : tr('Yok')),
    short: (s) => (s ? fmt(s.damage) : tr('Yok')),
    rows: (s) => (s ? [[tr('Hasar'), fmt(s.damage)], [tr('Bekleme'), tr('{0} sn', s.cooldown.toFixed(1))]] : [[tr('Hasar'), '—'], [tr('Bekleme'), '—']]),
  },
  {
    id: 'castleInterest', name: tr('Altın Kasası'), icon: '🏦', desc: tr('Kasadaki altına 10 sn\'de bir faiz işler'),
    info: tr('Tek seferde en fazla 30 saniyelik kazancın kadar faiz alınır.'),
    baseCost: 3000, growth: 1.5, max: 15,
    stat: (l) => 0.004 * l,
    describe: (v) => (v ? tr('{0} / 10 sn', pct(v)) : tr('Yok')),
    short: (v) => (v ? pct(v) : tr('Yok')),
  },
  {
    id: 'castleBeacon', name: tr('Gözcü Ateşi'), icon: '🔥', desc: tr('Kaledeki ateş kahramana hedefi gösterir: kritik şansı artar'),
    info: tr('Ateş seviyeyle büyür. Kahramanın kritik şansına doğrudan eklenir.'),
    baseCost: 350, growth: 1.28, max: 20,
    stat: (l) => 0.004 * l,
    describe: (v) => (v ? tr('+{0} kritik şansı', pct(v)) : tr('Yok')),
    short: (v) => (v ? `+${pct(v)}` : tr('Yok')),
  },
  {
    id: 'castleStores', name: tr('Erzak Ambarı'), icon: '🪵', iconArt: 'logs', desc: tr('Her dalga başında kale canının bir kısmını onarır'),
    info: tr('Ambar seviyeyle dolar. Dış Sur da aynı oranda onarılır.'),
    baseCost: 500, growth: 1.3, max: 20,
    stat: (l) => 0.02 * l,
    describe: (v) => (v ? tr('dalga başı %{0} can', Math.round(v * 100)) : tr('Yok')),
    short: (v) => (v ? `%${Math.round(v * 100)}` : tr('Yok')),
  },
  {
    id: 'castleBell', name: tr('Savaş Çanı'), icon: '🔔', iconArt: 'banner', desc: tr('Düşman duvara yaklaşınca çan çalar, yakındakiler yavaşlar'),
    info: tr('Patronlar yarı etkilenir. Sv 10\'dan itibaren çan büyür.'),
    baseCost: 2500, growth: 1.32, max: 15,
    stat: (l) => (l ? { slow: 0.18 + 0.02 * l, duration: 3, cooldown: Math.max(10, 18 - 0.5 * l) } : null),
    describe: (s) => (s ? tr('{0} yavaşlatma / {1} sn', pct(s.slow), s.cooldown.toFixed(1)) : tr('Yok')),
    short: (s) => (s ? pct(s.slow) : tr('Yok')),
    rows: (s) => (s ? [[tr('Yavaşlatma'), pct(s.slow)], [tr('Süre'), tr('{0} sn', s.duration)], [tr('Bekleme'), tr('{0} sn', s.cooldown.toFixed(1))]] : [[tr('Yavaşlatma'), '—'], [tr('Süre'), '—'], [tr('Bekleme'), '—']]),
  },
  {
    id: 'castleCatapult', name: tr('Burç Mancınığı'), icon: '🪨', desc: tr('Kalenin tepesinden en kalabalık kara düşmanlarına kaya fırlatır'),
    info: tr('Otomatik atar, kayanın düştüğü yerde alan hasarı verir. Uçanları hedef almaz. Sv 10\'da karşı ağırlık demir kuşak alır.'),
    baseCost: 4000, growth: 1.2,
    stat: (l) => (l ? { damage: 90 * Math.pow(1.15, l - 1), cooldown: Math.max(6, 11 - 0.15 * l), radius: 80 } : null),
    describe: (s) => (s ? tr('{0} hasar / {1} sn', fmt(s.damage), s.cooldown.toFixed(1)) : tr('Yok')),
    short: (s) => (s ? fmt(s.damage) : tr('Yok')),
    rows: (s) => (s ? [[tr('Hasar'), fmt(s.damage)], [tr('Bekleme'), tr('{0} sn', s.cooldown.toFixed(1))], [tr('Patlama alanı'), tr('{0} px', s.radius)]] : [[tr('Hasar'), '—'], [tr('Bekleme'), '—'], [tr('Patlama alanı'), '—']]),
  },
  // ---- Dış Sur: a gated wall in front of the castle (entities/OuterWall.js)
  {
    id: 'castleOuterWall', name: tr('Dış Sur'), icon: '🧱', iconArt: 'wall', role: 'building',
    desc: tr('Kalenin önüne kapılı bir sur çek; kara düşmanları önce onu yıkmak zorunda'),
    info: tr('Uçanlar üstünden geçer. Yıkılırsa sonraki dalgada yarı canla onarılır. Sv 10 taş sur, Sv 25 kuleli sur.'),
    baseCost: 600, growth: 1.18,
    stat: (l) => (l ? 120 * Math.pow(1.13, l - 1) + 40 * (l - 1) : 0),
    describe: (v) => (v ? tr('{0} can', fmt(v)) : tr('Yok')),
    short: (v) => (v ? fmt(v) : tr('Yok')),
  },
  {
    id: 'castleOuterGate', name: tr('Sur Kapısı'), icon: '🏰', iconArt: 'castle', requires: 'castleOuterWall',
    desc: tr('Surun kapısını güçlendir: sura gelen hasar azalır'),
    info: tr('Sv 10 demir kuşaklı kapı, Sv 25 demir parmaklık.'),
    baseCost: 900, growth: 1.24, max: 40,
    stat: (l) => 1 - Math.pow(0.96, l),
    describe: (v) => pct(v),
  },
  {
    id: 'castleOuterArchers', name: tr('Sur Okçuları'), icon: '🏹', iconArt: 'archer', requires: 'castleOuterWall', hire: true,
    desc: tr('Dış surun üstüne okçular yerleştir'),
    info: tr('Sur ayaktayken ateş ederler. Sv 10 ve 25\'te yeni okçu (en fazla 3).'),
    baseCost: 1500, growth: 1.17,
    stat: (l) => (l
      ? { damage: 5 * Math.pow(1.14, l - 1) + 2 * (l - 1), rate: Math.min(2, 0.7 + 0.025 * l), count: 1 + (l >= 10) + (l >= 25) }
      : null),
    describe: (s) => (s ? tr('{0} okçu · {1} hasar', s.count, fmt(s.damage)) : tr('Kilitli')),
    short: (s) => (s ? fmt(s.damage) : tr('Kilitli')),
    rows: (s) => (s ? [[tr('Okçu'), s.count], [tr('Hasar'), fmt(s.damage)], [tr('Atış hızı'), tr('{0}/sn', s.rate.toFixed(2))]] : []),
    milestone: 'count', milestoneUnit: tr('okçu'),
  },
];

/** Birlikler: every unit type is defined in units/roster.js. */
export const ALLY_UPGRADES = UNITS;

/*
 * Village economy behind the castle (sites are defined in config/village.js). Each site has a
 * building upgrade (gold per second that one worker produces) and a worker upgrade (how many
 * workers walk the route). Workers carry their load to the depot, so income arrives in trips.
 */
export const MAX_WORKERS = 8;

export const VILLAGE_UPGRADES = VILLAGE_SITES.flatMap(({ key: site, building: b, workers: w }) => [
  {
    id: b.id, site, role: 'building', name: b.name, icon: b.icon, iconArt: b.iconArt, desc: b.desc,
    info: tr('Seviye, her işçinin saniyede getirdiği altını artırır. İşçisiz bina üretim yapmaz.'),
    baseCost: b.baseCost, growth: b.growth,
    stat: (l) => ({ rate: l ? b.base * Math.pow(1.11, l - 1) : 0 }),
    describe: (s) => tr('{0}/sn işçi başı', fmt(s.rate)),
    short: (s) => tr('{0}/sn', fmt(s.rate)),
    rows: (s) => [[tr('İşçi başı'), tr('{0}/sn', fmt(s.rate))]],
  },
  {
    id: w.id, site, role: 'workers', requires: b.id, name: w.name, icon: w.icon, iconArt: w.iconArt, desc: w.desc,
    info: w.id === 'villageStonecutters'
      ? tr('Taş ustaları kalenin onarımına katkı verir. Her usta +0,25 can/sn sağlar; taş ocağı seviyesi bu katkıyı artırır. En fazla {0}.', MAX_WORKERS)
      : tr('Her {0} binada çalışır, yükünü kale önündeki ambara taşır. En fazla {1}.', w.worker, MAX_WORKERS),
    baseCost: w.baseCost, growth: w.growth, max: MAX_WORKERS,
    stat: (l) => ({ count: l }),
    describe: (s) => `${s.count} ${w.worker}`,
    short: (s) => tr('{0} kişi', s.count),
  },
]).concat([
  {
    id: 'villageMarket', role: 'global', name: tr('Pazar Yeri'), icon: '🏪', iconArt: 'market', desc: tr('Köyün tüm gelirini artırır'),
    info: tr('Tüccarlar köyün ürünlerini daha pahalıya satar. Bütün tesislere uygulanır.'),
    baseCost: 5000, growth: 1.35,
    stat: (l) => 1 + 0.08 * l,
    describe: (v) => tr('x{0} köy geliri', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
]);

/** Permanent upgrades bought with Ruh Taşı; they survive prestige resets. */
export const SOUL_UPGRADES = [
  {
    id: 'soulPower', currency: 'souls', name: tr('Kadim Güç'), icon: '⚔️', desc: tr('Kahraman ve tüm birliklerin hasarı'),
    baseCost: 1, growth: 1.34,
    stat: (l) => 1 + 0.15 * l,
    describe: (v) => tr('x{0} hasar', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulGold', currency: 'souls', name: tr('Altın Ruhu'), icon: '👑', desc: tr('Kazanılan tüm altın'),
    baseCost: 1, growth: 1.4,
    stat: (l) => 1 + 0.15 * l,
    describe: (v) => tr('x{0} altın', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulWalls', currency: 'souls', name: tr('Yıkılmaz Surlar'), icon: '🏯', desc: tr('Kale canı, yenilenme ve şifa'),
    info: tr('Asker canı ve Şifacı şifasını da artırır.'),
    baseCost: 2, growth: 1.36,
    stat: (l) => 1 + 0.2 * l,
    describe: (v) => tr('x{0} dayanıklılık', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulHaste', currency: 'souls', name: tr('Savaş Ritmi'), icon: '🥁', desc: tr('Tüm saldırı hızları'),
    baseCost: 3, growth: 1.4, max: 25,
    stat: (l) => 1 + 0.04 * l,
    describe: (v) => tr('x{0} hız', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulStart', currency: 'souls', name: tr('Başlangıç Altını'), icon: '🪙', desc: tr('Yeniden doğunca başlangıç altını'),
    baseCost: 2, growth: 1.6, max: 10,
    stat: (l) => (l ? 50 * Math.pow(5, l) : 20),
    describe: (v) => tr('💰 {0} ile başla', fmt(v)),
    short: (v) => `💰${fmt(v)}`,
  },
  {
    id: 'soulTime', currency: 'souls', name: tr('Zaman Bükücü'), icon: '⏳', desc: tr('Çevrimdışı kazanç oranı ve süresi'),
    baseCost: 3, growth: 1.5, max: 5,
    stat: (l) => ({ rate: 0.5 + 0.1 * l, hours: 8 + 2 * l }),
    describe: (s) => tr('{0} · {1} saat', pct(s.rate), s.hours),
    short: (s) => pct(s.rate),
    rows: (s) => [[tr('Kazanç oranı'), pct(s.rate)], [tr('En uzun süre'), tr('{0} saat', s.hours)]],
  },
  {
    id: 'soulHarvest', currency: 'souls', name: tr('Ruh Hasadı'), icon: '🌀', desc: tr('Yeniden Doğuş\'ta daha fazla Ruh Taşı'),
    baseCost: 3, growth: 1.45,
    stat: (l) => 1 + 0.1 * l,
    describe: (v) => tr('x{0} Ruh Taşı', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulSkip', currency: 'souls', name: tr('Hızlı Başlangıç'), icon: '🚀', desc: tr('Yeniden doğunca ileri bir dalgadan başla'),
    info: tr('Güçlenmeden çok ileri başlarsan kale düşer ve geri çekilirsin; Başlangıç Altını ile birlikte kullan.'),
    baseCost: 4, growth: 1.7, max: 10,
    stat: (l) => 1 + 2 * l,
    describe: (v) => tr('Dalga {0}\'den başla', v),
    short: (v) => tr('Dalga {0}', v),
  },
  {
    id: 'soulCrit', currency: 'souls', name: tr('Kutsal Oklar'), icon: '✴️', desc: tr('Kalıcı kritik vuruş şansı'),
    info: tr('Ölümcül Nişan\'a eklenir.'),
    baseCost: 3, growth: 1.5, max: 10,
    stat: (l) => 0.02 * l,
    describe: (v) => tr('+{0} kritik', pct(v)),
    short: (v) => `+${pct(v)}`,
  },
  {
    id: 'soulVillage', currency: 'souls', name: tr('Köy Bereketi'), icon: '🌻', desc: tr('Köy geliri kalıcı olarak artar'),
    baseCost: 3, growth: 1.5,
    stat: (l) => 1 + 0.1 * l,
    describe: (v) => tr('x{0} köy geliri', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulInventory', currency: 'souls', name: tr('Envanter Genişletme'), icon: '🎒', desc: tr('Envantere +5 eşya yuvası'),
    info: tr('Yeniden Doğuş\'ta da kalır. Envanter doluyken düşen eşyalar otomatik satılır.'),
    baseCost: 2, growth: 1.4, max: 12,
    stat: (l) => 30 + 5 * l,
    describe: (v) => tr('{0} eşya yuvası', v),
    short: (v) => `${v}`,
  },
  {
    id: 'soulBoss', currency: 'souls', name: tr('Lord Katili'), icon: '💀', desc: tr('Patronlara verilen hasar'),
    baseCost: 4, growth: 1.4, max: 20,
    stat: (l) => 1 + 0.1 * l,
    describe: (v) => tr('x{0} patron hasarı', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulDrop', currency: 'souls', name: tr('Ganimet Kokusu'), icon: '🏦', desc: tr('Düşmanlardan eşya düşme şansı'),
    info: tr('Patronlar ve sıradan düşmanlar için geçerlidir.'),
    baseCost: 3, growth: 1.45, max: 15,
    stat: (l) => 1 + 0.08 * l,
    describe: (v) => tr('x{0} eşya şansı', v.toFixed(2)),
    short: (v) => `x${v.toFixed(2)}`,
  },
  {
    id: 'soulGems', currency: 'souls', name: tr('Elmas Damarı'), icon: '💠', desc: tr('Her Yeniden Doğuş\'ta fazladan Elmas'),
    baseCost: 6, growth: 1.9, max: 5,
    stat: (l) => l,
    describe: (v) => tr('+{0} Elmas / doğuş', v),
    short: (v) => `+${v}`,
  },
  {
    id: 'soulMemory', currency: 'souls', name: tr('Kadim Hafıza'), icon: '🔮', desc: tr('Yeniden doğunca altın geliştirmelerinin bir kısmı korunur'),
    info: tr('Her geliştirmenin seviyesinin bu oranı yeni yolculuğa taşınır. Kuleler ve birlikler de dahildir.'),
    baseCost: 8, growth: 1.8, max: 10,
    stat: (l) => 0.02 * l,
    describe: (v) => (v ? tr('seviyelerin {0}\'i kalır', pct(v)) : tr('Yok')),
    short: (v) => (v ? pct(v) : tr('Yok')),
  },
];

export const PRESTIGE_MIN_WAVE = 20;

/** Ruh Taşı earned by a prestige that reached `maxWave` (mult: Ruh Hasadı bonus). */
export function soulsForWave(maxWave, mult = 1) {
  if (maxWave < PRESTIGE_MIN_WAVE) return 0;
  return Math.floor((Math.pow(maxWave - 14, 1.3) / 4) * mult);
}

/** First wave that would raise the prestige reward above what `maxWave` gives. */
export function nextSoulWave(maxWave, mult = 1) {
  const now = soulsForWave(maxWave, mult);
  let w = Math.max(maxWave + 1, PRESTIGE_MIN_WAVE);
  while (soulsForWave(w, mult) <= now) w++;
  return w;
}

/** Next level at which an ally's discrete stat (`u.milestone`) increases, or null. */
export function nextMilestone(u, level) {
  if (!u.milestone) return null;
  const now = u.stat(Math.max(1, level))[u.milestone];
  for (let l = Math.max(1, level) + 1; l <= level + 60; l++) {
    const v = u.stat(l)[u.milestone];
    if (v > now) return { level: l, value: v };
  }
  return null;
}

export const ALL_UPGRADES = [...HERO_UPGRADES, ...CASTLE_UPGRADES, ...ALLY_UPGRADES, ...VILLAGE_UPGRADES, ...SOUL_UPGRADES, ...ACTIVE_SKILLS, ...TALENTS, ...PET_UPGRADES];
export const UPGRADE_BY_ID = Object.fromEntries(ALL_UPGRADES.map((u) => [u.id, u]));

export const RAIN_COOLDOWN = 18;
