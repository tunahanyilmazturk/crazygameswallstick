import { GROUND_Y, WALL_TOP, TOWER_TOP } from '../core/constants.js';
import { fmt, pct } from '../utils/format.js';
import { tr } from '../i18n/i18n.js';

/*
 * The army roster: one entry per unit type, and the only place a unit is defined.
 *
 *   identity  kind, id (save key, stays `ally…`), branch, name, icon, desc, info
 *   economy   baseCost, growth, max; level 0 = not hired, the first purchase hires it
 *   post      where it stands ({ x, y }); squads (`stat` returns `count`) stand at `post.xs`, one
 *             member per slot; `layer: 'back'` draws before the castle
 *   behavior  how it fights (units/behaviors.js); `shot` configures the generic ranged attack
 *   art       how it is drawn (units/art.js); `badge` is the rank insignia height above `post.y`
 *   stat(l)   numbers at level l; `dps(st)` the shop's damage estimate; describe/short/rows labels
 *
 * config/upgrades.js turns these entries into the Birlikler upgrades (ALLY_UPGRADES).
 */

/** Branches group the Birlikler tab; hiring every unit of a branch masters it. */
export const BRANCHES = [
  { id: 'ranged', name: tr('Okçular'), icon: '🏹', iconArt: 'archer', accent: '#6fae5a', hint: tr('Duvarlardan ve kulelerden tek hedefe ok yağdırırlar') },
  { id: 'arcane', name: tr('Büyücüler'), icon: '🔮', iconArt: 'wizard', accent: '#9a6ad8', hint: tr('Zırhı yok sayan büyüler: ateş, buz ve şimşek') },
  { id: 'siege', name: tr('Kuşatma'), icon: '💣', iconArt: 'cannon', accent: '#d07a3a', hint: tr('Kalabalıkları dağıtan ağır patlayıcılar') },
  { id: 'infantry', name: tr('Piyade'), icon: '🛡️', iconArt: 'shield-guard', accent: '#4f86c6', hint: tr('Sahada düşmanı karşılayan, tutan ve yaran birlikler') },
  { id: 'support', name: tr('Destek'), icon: '🚩', iconArt: 'banner', accent: '#d6b23c', hint: tr('Orduyu iyileştiren ve güçlendiren birlikler') },
];
export const BRANCH_MASTERY = 0.1; // +10% damage and healing when every unit of a branch is hired

/** Veterancy: every rank adds RANK_BONUS damage/healing and shows as stars on the unit. */
export const RANKS = [
  { level: 1, name: tr('Acemi'), stars: 0 },
  { level: 10, name: tr('Kıdemli'), stars: 1 },
  { level: 25, name: tr('Usta'), stars: 2 },
  { level: 50, name: tr('Seçkin'), stars: 3 },
  { level: 100, name: tr('Efsane'), stars: 4 },
];
export const RANK_BONUS = 0.06;

export function rankOf(level) {
  let rank = RANKS[0];
  for (const r of RANKS) if (level >= r.level) rank = r;
  return rank;
}

export function nextRank(level) {
  return RANKS.find((r) => r.level > level) ?? null;
}

const rateRow = (s) => [tr('Atış hızı'), tr('{0}/sn', s.rate.toFixed(2))];

export const UNITS = [
  // ---- Okçular -------------------------------------------------------------------
  {
    kind: 'archer', id: 'allyArcher', branch: 'ranged', name: tr('Okçu'), icon: '🏹', iconArt: 'archer',
    desc: tr('Kalenin arka surundan ok yağdıran okçu takımı'), info: tr('Her 10 seviyede takıma +1 okçu katılır (en fazla 8).'),
    baseCost: 60, growth: 1.16,
    post: { xs: [-16, -41, -66, -91, -116, -141, -166, -191], y: WALL_TOP }, behavior: 'shoot', art: 'archer', badge: 66,
    shot: { projectile: 'arrow', speed: 1250, gravity: 'g', minT: 0.3, maxT: 1.6, muzzle: [2, -38], sound: 'bow' },
    stat: (l) => ({ damage: 6 * Math.pow(1.14, l - 1) + 2 * (l - 1), rate: Math.min(2.2, 0.8 + 0.03 * l), count: Math.min(8, 1 + Math.floor(l / 10)) }),
    dps: (s) => s.damage * s.rate * s.count,
    describe: (s) => tr('{0} okçu · {1} hasar', s.count, fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Okçu'), s.count], [tr('Hasar'), fmt(s.damage)], rateRow(s)],
    milestone: 'count', milestoneUnit: tr('okçu'),
  },
  {
    kind: 'hunter', id: 'allyHunter', branch: 'ranged', name: tr('Avcı'), icon: '🎯', iconArt: 'hunter',
    desc: tr('Uçan düşmanları önce hedefler'), info: tr('Akbabaları ve kuzgunları öncelikli avlar; havadaki düşmanlara 2,5 kat hasar verir.'),
    baseCost: 3000, growth: 1.17,
    post: { x: 382, y: 470 }, behavior: 'shoot', art: 'hunter', badge: 66,
    shot: { projectile: 'hunterArrow', speed: 1250, gravity: 'g', minT: 0.3, maxT: 1.4, muzzle: [2, -38], target: 'air', sound: 'bow' },
    stat: (l) => ({ damage: 22 * Math.pow(1.15, l - 1), rate: 0.85, airMultiplier: 2.5 }),
    dps: (s) => s.damage * s.rate,
    describe: (s) => tr('{0} hasar · uçanlara x{1}', fmt(s.damage), s.airMultiplier),
    short: (s) => tr('{0} hasar', fmt(s.damage)),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], [tr('Uçan düşmanlara'), tr('x{0} hasar', s.airMultiplier)], rateRow(s)],
  },
  {
    kind: 'crossbow', id: 'allyCrossbow', branch: 'ranged', name: tr('Arbaletçi'), icon: '🎯', iconArt: 'target-wood',
    desc: tr('Zırh delen ağır oklar atar'), info: tr('Okları düşman zırhının %60\'ını yok sayar; kalkanlılara ve kuşatma makinelerine karşı birebir.'),
    baseCost: 8000, growth: 1.18,
    post: { x: 172, y: WALL_TOP }, behavior: 'shoot', art: 'crossbow', badge: 58,
    shot: { projectile: 'quarrel', speed: 1500, gravity: 300, minT: 0.15, maxT: 1, muzzle: [14, -36], target: 'armored', sound: 'ballista' },
    stat: (l) => ({ damage: 40 * Math.pow(1.15, l - 1), rate: 0.45, armorPierce: 0.6 }),
    dps: (s) => s.damage * s.rate,
    describe: (s) => tr('{0} hasar · %60 zırh delme', fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], [tr('Zırh delme'), pct(s.armorPierce)], rateRow(s)],
  },
  {
    kind: 'ballista', id: 'allyBallista', branch: 'ranged', name: tr('Balista Kulesi'), icon: '🗼', iconArt: 'ballista',
    desc: tr('Sıradaki herkesi delen dev oklar'), info: tr('Her 10 seviyede +1 delme.'),
    baseCost: 9000, growth: 1.18,
    post: { x: 345, y: 470 }, layer: 'back', behavior: 'shoot', art: 'ballista', badge: 60,
    shot: { projectile: 'bolt', speed: 1300, gravity: 150, minT: 0.15, maxT: 1.2, muzzle: 'turret', sound: 'ballista' },
    stat: (l) => ({ damage: 35 * Math.pow(1.15, l - 1), rate: 0.55, pierce: 3 + Math.floor(l / 10) }),
    dps: (s) => s.damage * s.rate * 2,
    describe: (s) => tr('{0} hasar · {1} delme', fmt(s.damage), s.pierce),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], rateRow(s), [tr('Delme'), tr('{0} düşman', s.pierce)]],
    milestone: 'pierce', milestoneUnit: 'delme',
  },

  // ---- Büyücüler -----------------------------------------------------------------
  {
    kind: 'mage', id: 'allyMage', branch: 'arcane', name: tr('Büyücü'), icon: '🔮', iconArt: 'wizard',
    desc: tr('Zırh delen alan hasarlı ateş topu'), info: tr('Büyü hasarı düşman zırhını yok sayar. En kalabalık gruba nişan alır.'),
    baseCost: 500, growth: 1.17,
    post: { x: 54, y: TOWER_TOP }, behavior: 'shoot', art: 'mage', badge: 92,
    shot: { projectile: 'fireball', speed: 560, gravity: 0, minT: 0.4, maxT: 2.5, yFrac: 0.3, muzzle: [26, -52], target: 'dense', magic: true, sound: 'magic', spark: '#ff9a3c' },
    stat: (l) => ({ damage: 16 * Math.pow(1.145, l - 1), rate: 0.4, radius: Math.min(110, 55 + 2 * l) }),
    dps: (s) => s.damage * s.rate * 2,
    describe: (s) => tr('{0} alan hasarı', fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], rateRow(s), [tr('Patlama alanı'), tr('{0} px', Math.round(s.radius))]],
  },
  {
    kind: 'frost', id: 'allyFrost', branch: 'arcane', name: tr('Buz Büyücüsü'), icon: '❄️', iconArt: 'frost-mage',
    desc: tr('Buz kristalleriyle düşmanları yavaşlatır'), info: tr('Yavaşlayan düşman hem daha yavaş yürür hem daha seyrek vurur. Patron yarı etkilenir.'),
    baseCost: 6000, growth: 1.17,
    post: { x: 18, y: TOWER_TOP }, behavior: 'shoot', art: 'frost', badge: 92,
    shot: { projectile: 'frostball', speed: 560, gravity: 0, minT: 0.4, maxT: 2.5, yFrac: 0.3, muzzle: [26, -52], target: 'dense', magic: true, sound: 'magic', spark: '#bfe8ff' },
    stat: (l) => ({ damage: 10 * Math.pow(1.14, l - 1), rate: 0.5, slow: Math.min(0.6, 0.3 + 0.01 * l), radius: 70 }),
    dps: (s) => s.damage * s.rate * 2,
    describe: (s) => tr('{0} hasar · {1} yavaşlatma', fmt(s.damage), pct(s.slow)),
    short: (s) => pct(s.slow),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], [tr('Yavaşlatma'), tr('{0} · 2.5 sn', pct(s.slow))], rateRow(s)],
  },
  {
    kind: 'storm', id: 'allyStorm', branch: 'arcane', name: tr('Fırtına Büyücüsü'), icon: '⚡', iconArt: 'lightning-rune',
    desc: tr('Düşmandan düşmana sekip zincirleme şimşek'), info: tr('Her sekmede hasar %15 azalır. Her 15 seviyede +1 sekme (en fazla 7 hedef).'),
    baseCost: 11000, growth: 1.18,
    post: { x: 92, y: TOWER_TOP }, behavior: 'chain', art: 'storm', badge: 92,
    stat: (l) => ({ damage: 22 * Math.pow(1.145, l - 1), rate: 0.35, chains: Math.min(7, 4 + Math.floor(l / 15)), reach: 150 }),
    dps: (s) => s.damage * s.rate * Math.min(3.2, s.chains * 0.7),
    describe: (s) => tr('{0} hasar · {1} hedef', fmt(s.damage), s.chains),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], [tr('Zincir'), tr('{0} hedef', s.chains)], rateRow(s)],
    milestone: 'chains', milestoneUnit: 'hedef',
  },

  // ---- Kuşatma -------------------------------------------------------------------
  {
    kind: 'cannon', id: 'allyCannon', branch: 'siege', name: tr('Topçu'), icon: '💣', iconArt: 'cannon',
    desc: tr('Arka surdan ağır gülle, geniş patlama'), info: tr('Gülleler düşmanları en çok geri savuran saldırıdır.'),
    baseCost: 3500, growth: 1.18,
    post: { x: -256, y: WALL_TOP }, behavior: 'shoot', art: 'cannon', badge: 70,
    shot: { projectile: 'cannonball', speed: 600, gravity: 'g', minT: 0.9, maxT: 1.9, yFrac: 0.2, muzzle: 'barrel', target: 'dense', sound: 'cannon', recoil: true },
    stat: (l) => ({ damage: 55 * Math.pow(1.15, l - 1), rate: 0.25, radius: 85 }),
    dps: (s) => s.damage * s.rate * 2,
    describe: (s) => tr('{0} patlama', fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Hasar'), fmt(s.damage)], rateRow(s), [tr('Patlama alanı'), tr('{0} px', s.radius)]],
  },
  {
    kind: 'bomber', id: 'allyBomber', branch: 'siege', name: tr('Bombacı'), icon: '💥', iconArt: 'bomb',
    desc: tr('Düşman kümelerine yanan bombalar atar'), info: tr('Patlama alanındaki düşmanlara hasar verir ve 3 saniye boyunca yakar.'),
    baseCost: 12000, growth: 1.19,
    post: { x: 284, y: GROUND_Y }, behavior: 'shoot', art: 'bomber', badge: 66,
    shot: { projectile: 'bomb', speed: 650, gravity: 'g', minT: 0.65, maxT: 1.8, muzzle: 'aim', target: 'dense', sound: 'throw', spark: '#ff9a3c' },
    stat: (l) => ({ damage: 30 * Math.pow(1.14, l - 1), rate: 0.27, radius: Math.min(110, 72 + 2 * l), burn: 4 * Math.pow(1.12, l - 1) }),
    dps: (s) => (s.damage + s.burn * 3) * s.rate * 2,
    describe: (s) => tr('{0} patlama · {1}/sn yanma', fmt(s.damage), fmt(s.burn)),
    short: (s) => tr('🔥 {0}/sn', fmt(s.burn)),
    rows: (s) => [[tr('Patlama hasarı'), fmt(s.damage)], [tr('Yanma'), tr('{0}/sn · 3 sn', fmt(s.burn))], [tr('Etki alanı'), tr('{0} px', Math.round(s.radius))], rateRow(s)],
  },

  // ---- Piyade --------------------------------------------------------------------
  {
    kind: 'soldier', id: 'allySoldier', branch: 'infantry', name: tr('Kalkanlı Asker'), icon: '🛡️', iconArt: 'shield-guard',
    desc: tr('Kale önünde düşmanın üstüne yürüyüp keser, saflarını tutar'), info: tr('Yakına gelen düşmana ilerleyip saldırır. Her 25 seviyede +1 asker (en fazla 4). Ölen asker 6 sn sonra yerinde döner.'),
    baseCost: 200, growth: 1.16,
    post: { xs: [474, 498, 522, 546], y: GROUND_Y }, behavior: 'infantry', badge: 72,
    stat: (l) => ({ hp: 110 * Math.pow(1.15, l - 1), damage: 6 * Math.pow(1.14, l - 1) + l, count: Math.min(4, 1 + Math.floor(l / 25)), rate: 1.1 }),
    dps: (s) => s.damage * s.rate * s.count,
    describe: (s) => tr('{0} asker · {1} can', s.count, fmt(s.hp)),
    short: (s) => tr('{0} can', fmt(s.hp)),
    rows: (s) => [[tr('Asker'), s.count], [tr('Can'), fmt(s.hp)], [tr('Hasar'), fmt(s.damage)], [tr('Zırh'), '%25']],
    milestone: 'count', milestoneUnit: tr('asker'),
  },
  {
    kind: 'guard', id: 'allyGuard', branch: 'infantry', name: tr('Kapı Muhafızı'), icon: '⚔️', iconArt: 'gate-guard',
    desc: tr('Kara düşmanlarının üstüne yürüyen ağır kılıçlılar'), info: tr('Önündeki düşmana koşup vurur ve geri savurur; uçanlara saldıramaz. Her 25 seviyede +1 muhafız (en fazla 3).'),
    baseCost: 2400, growth: 1.17,
    post: { xs: [572, 596, 620], y: GROUND_Y }, behavior: 'melee', art: 'guard', badge: 70,
    stat: (l) => ({ damage: 24 * Math.pow(1.15, l - 1), rate: 0.8, range: 260, knockback: 70, count: Math.min(3, 1 + Math.floor(l / 25)) }),
    dps: (s) => s.damage * s.rate * s.count,
    describe: (s) => tr('{0} muhafız · {1} hasar', s.count, fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Muhafız'), s.count], [tr('Kılıç hasarı'), fmt(s.damage)], [tr('Saldırı hızı'), tr('{0}/sn', s.rate.toFixed(2))], [tr('Geri savurma'), tr('Güçlü')]],
    milestone: 'count', milestoneUnit: tr('muhafız'),
  },
  {
    kind: 'spearman', id: 'allySpearman', branch: 'infantry', name: tr('Mızrakçı'), icon: '🗡️', iconArt: 'spear',
    desc: tr('Ön hattan yüksek hasarlı mızraklar fırlatır'), info: tr('Ağır mızrakları hedefe hızlıca ulaşıp düşmanları geri savurur. Her 25 seviyede +1 mızrakçı (en fazla 3).'),
    baseCost: 6500, growth: 1.18,
    post: { xs: [648, 674, 700], y: GROUND_Y }, behavior: 'shoot', art: 'spearman', badge: 66,
    shot: { projectile: 'javelin', speed: 1200, gravity: 150, minT: 0.15, maxT: 1.2, muzzle: 'facing', sound: 'throw', spark: '#d4d8df', face: true },
    stat: (l) => ({ damage: 28 * Math.pow(1.16, l - 1) + 6 * (l - 1), rate: 0.62, knockback: 85, count: Math.min(3, 1 + Math.floor(l / 25)) }),
    dps: (s) => s.damage * s.rate * s.count,
    describe: (s) => tr('{0} mızrakçı · {1} hasar', s.count, fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Mızrakçı'), s.count], [tr('Mızrak hasarı'), fmt(s.damage)], rateRow(s), [tr('Geri savurma'), tr('Güçlü')]],
    milestone: 'count', milestoneUnit: tr('mızrakçı'),
  },
  {
    kind: 'hounds', id: 'allyHounds', branch: 'infantry', name: tr('Savaş Köpekleri'), icon: '🐺',
    desc: tr('Kulübeden fırlayıp kara düşmanlarını ısıran sürü'), info: tr('Köpekler hedefe koşup ısırır, savaş bitince kulübeye döner; düşmanlar onlara saldıramaz. Sv 10 ve 25\'te +1 köpek.'),
    baseCost: 4500, growth: 1.17,
    post: { x: 338, y: GROUND_Y }, behavior: 'hounds', art: 'kennel', badge: 58,
    stat: (l) => ({ damage: 9 * Math.pow(1.15, l - 1), rate: 1.2, count: 2 + (l >= 10) + (l >= 25), speed: 260 }),
    dps: (s) => s.damage * s.rate * s.count * 0.75,
    describe: (s) => tr('{0} köpek · {1} ısırık', s.count, fmt(s.damage)),
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Köpek'), s.count], [tr('Isırık'), fmt(s.damage)], [tr('Isırık hızı'), tr('{0}/sn', s.rate.toFixed(2))]],
    milestone: 'count', milestoneUnit: tr('köpek'),
  },
  {
    kind: 'knight', id: 'allyKnight', branch: 'infantry', name: tr('Süvari'), icon: '🐎', iconArt: 'cavalry',
    desc: tr('Kapıdan çıkıp düşman saflarını baştan sona yarar'), info: tr('Her hücumda yolundaki her düşmana bir kez vurur ve onları geri savurur.'),
    baseCost: 15000, growth: 1.18,
    post: { x: 180, y: GROUND_Y }, behavior: 'cavalry', badge: 90,
    stat: (l) => ({ damage: 30 * Math.pow(1.15, l - 1), cooldown: Math.max(5, 12 - 0.15 * l) }),
    // A charge takes ~4 s of riding plus the cooldown and hits ~3 enemies
    dps: (s) => (s.damage * 3) / (s.cooldown + 4),
    describe: (s) => `${fmt(s.damage)} hasar · ${s.cooldown.toFixed(1)} sn`,
    short: (s) => fmt(s.damage),
    rows: (s) => [[tr('Hücum hasarı'), fmt(s.damage)], [tr('Hücum aralığı'), tr('{0} sn', s.cooldown.toFixed(1))]],
  },

  // ---- Destek --------------------------------------------------------------------
  {
    kind: 'healer', id: 'allyHealer', branch: 'support', name: tr('Şifacı'), icon: '✨', iconArt: 'healer',
    desc: tr('Kaleyi, suru ve askerleri iyileştirir'), info: tr('2 saniyede bir şifa dalgası yayar.'),
    baseCost: 1500, growth: 1.17,
    post: { x: 134, y: WALL_TOP }, behavior: 'heal', art: 'healer', badge: 74,
    stat: (l) => ({ heal: 4 * Math.pow(1.14, l - 1) }),
    describe: (s) => tr('{0}/sn şifa', fmt(s.heal)),
    short: (s) => tr('{0}/sn', fmt(s.heal)),
    rows: (s) => [[tr('Şifa'), tr('{0}/sn', fmt(s.heal))], [tr('Atım başına'), fmt(s.heal * 2)]],
  },
  {
    kind: 'banner', id: 'allyBanner', branch: 'support', name: tr('Sancaktar'), icon: '🚩', iconArt: 'banner',
    desc: tr('Birliklere moral veren sancak taşıyıcısı'),
    info: tr('Her seviyede tüm birliklerin hasar ve şifasını, kalkanlı askerlerin canını artırır. Bonuslar en fazla %30 hasar, %30 şifa ve %20 asker canıdır.'),
    baseCost: 16000, growth: 1.21, max: 10,
    post: { x: 96, y: WALL_TOP }, behavior: 'aura', art: 'banner', badge: 76,
    stat: (l) => ({ damageAura: Math.min(0.30, 0.03 * l), healAura: Math.min(0.30, 0.03 * l), hpAura: Math.min(0.20, 0.02 * l) }),
    describe: (s) => tr('+{0} hasar · +{1} şifa · +{2} asker canı', pct(s.damageAura), pct(s.healAura), pct(s.hpAura)),
    short: (s) => tr('+{0}% hasar', Math.round(s.damageAura * 100)),
    rows: (s) => [[tr('Birlik hasarı'), `+${pct(s.damageAura)}`], [tr('Şifa gücü'), `+${pct(s.healAura)}`], [tr('Kalkanlı asker canı'), `+${pct(s.hpAura)}`]],
  },
  {
    kind: 'drummer', id: 'allyDrummer', branch: 'support', name: tr('Davulcu'), icon: '🥁', iconArt: 'gears',
    desc: tr('Savaş davuluyla bütün ordunun saldırı hızını artırır'), info: tr('Her seviyede tüm birliklerin saldırı hızı artar (en fazla %25). Süvarinin hücum aralığını da kısaltır.'),
    baseCost: 20000, growth: 1.21, max: 10,
    post: { x: 228, y: GROUND_Y }, behavior: 'aura', art: 'drummer', badge: 68,
    stat: (l) => ({ rateAura: Math.min(0.25, 0.025 * l) }),
    describe: (s) => tr('+{0} saldırı hızı', pct(s.rateAura)),
    short: (s) => tr('+{0}% hız', Math.round(s.rateAura * 100)),
    rows: (s) => [[tr('Birlik saldırı hızı'), `+${pct(s.rateAura)}`]],
  },
];

export const UNIT_BY_KIND = Object.fromEntries(UNITS.map((u) => [u.kind, u]));
export const UNITS_BY_BRANCH = Object.fromEntries(BRANCHES.map((b) => [b.id, UNITS.filter((u) => u.branch === b.id)]));
