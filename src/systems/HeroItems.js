import { tr } from '../i18n/i18n.js';
const RARITIES = [
  { id: 'common', name: tr('Sıradan'), color: '#c9c1b4', multiplier: 1, cost: 1 },
  { id: 'uncommon', name: tr('İyi'), color: '#77d58a', multiplier: 1.4, cost: 1.18 },
  { id: 'rare', name: tr('Nadir'), color: '#72b7ff', multiplier: 1.9, cost: 1.4 },
  { id: 'epic', name: tr('Destansı'), color: '#c18bff', multiplier: 2.6, cost: 1.75 },
  { id: 'legendary', name: tr('Efsanevi'), color: '#ffbd59', multiplier: 3.5, cost: 2.2 },
];

export const HERO_ITEM_SLOTS = [
  { id: 'weapon', name: tr('Silah'), art: 'bow' },
  { id: 'helmet', name: tr('Miğfer'), art: 'knight-helm' },
  { id: 'earrings', name: tr('Küpe'), art: 'earrings' },
  { id: 'necklace', name: tr('Kolye'), art: 'necklace' },
  { id: 'armor', name: tr('Zırh'), art: 'shield-guard' },
  { id: 'gloves', name: tr('Eldiven'), art: 'gloves' },
  { id: 'belt', name: tr('Kemer'), art: 'belt' },
  { id: 'boots', name: tr('Ayakkabı'), art: 'boots' },
  { id: 'charm', name: tr('Tılsım'), art: 'soul-crystal' },
];

export const HERO_ITEM_TEMPLATES = {
  trailbow: { slot: 'weapon', name: tr('Yolcu Yayı'), art: 'bow', stat: 'damage', base: 0.06 },
  hunterbow: { slot: 'weapon', name: tr('Avcı Yayı'), art: 'fire-arrow', stat: 'damage', base: 0.09 },
  keepbow: { slot: 'weapon', name: tr('Kale Muhafızı Yayı'), art: 'target', stat: 'damage', base: 0.12 },
  scouthelm: { slot: 'helmet', name: tr('Gözcü Miğferi'), art: 'knight-helm', stat: 'critChance', base: 0.02 },
  hawkhelm: { slot: 'helmet', name: tr('Şahin Miğferi'), art: 'target', stat: 'critChance', base: 0.035 },
  kingshelm: { slot: 'helmet', name: tr('Kral Muhafızının Miğferi'), art: 'medal', stat: 'critChance', base: 0.05 },
  leather: { slot: 'armor', name: tr('Deri Zırh'), art: 'shield-guard', stat: 'rate', base: 0.035 },
  chainmail: { slot: 'armor', name: tr('Hafif Zincir Zırh'), art: 'sword-shield', stat: 'rate', base: 0.055 },
  outrider: { slot: 'armor', name: tr('Akıncı Pelerini'), art: 'banner', stat: 'rate', base: 0.075 },
  coppercharm: { slot: 'charm', name: tr('Bakır Tılsım'), art: 'soul-crystal', stat: 'gold', base: 0.05 },
  seal: { slot: 'charm', name: tr('Ganimet Mührü'), art: 'treasure', stat: 'gold', base: 0.08 },
  victorymedal: { slot: 'charm', name: tr('Zafer Nişanı'), art: 'medal', stat: 'gold', base: 0.11 },
  leathergloves: { slot: 'gloves', name: tr('Avcı Eldivenleri'), art: 'gloves', stat: 'damage', base: 0.035 },
  ironbracers: { slot: 'gloves', name: tr('Demir Bileklikler'), art: 'gloves', stat: 'critChance', base: 0.025 },
  falconbracers: { slot: 'gloves', name: tr('Şahin Pençeleri'), art: 'gloves', stat: 'rate', base: 0.04 },
  guardbelt: { slot: 'belt', name: tr('Muhafız Kemeri'), art: 'belt', stat: 'damage', base: 0.045 },
  hunterbelt: { slot: 'belt', name: tr('Avcı Kemeri'), art: 'belt', stat: 'rate', base: 0.035 },
  royalbelt: { slot: 'belt', name: tr('Kraliyet Kemeri'), art: 'belt', stat: 'gold', base: 0.065 },
  silverearrings: { slot: 'earrings', name: tr('Gümüş Küpeler'), art: 'earrings', stat: 'critChance', base: 0.025 },
  moonearrings: { slot: 'earrings', name: tr('Aytaşı Küpeler'), art: 'earrings', stat: 'gold', base: 0.055 },
  rangerhoops: { slot: 'earrings', name: tr('Akıncı Halkaları'), art: 'earrings', stat: 'damage', base: 0.035 },
  moonnecklace: { slot: 'necklace', name: tr('Ay Işığı Kolyesi'), art: 'necklace', stat: 'critChance', base: 0.035 },
  ambernecklace: { slot: 'necklace', name: tr('Kehribar Kolye'), art: 'necklace', stat: 'gold', base: 0.07 },
  wardnecklace: { slot: 'necklace', name: tr('Koruyucu Gerdanlık'), art: 'necklace', stat: 'damage', base: 0.05 },
  travelerboots: { slot: 'boots', name: tr('Yolcu Çizmeleri'), art: 'boots', stat: 'rate', base: 0.03 },
  ironboots: { slot: 'boots', name: tr('Demir Uçlu Çizmeler'), art: 'boots', stat: 'damage', base: 0.04 },
  windboots: { slot: 'boots', name: tr('Rüzgâr Adımları'), art: 'boots', stat: 'critChance', base: 0.02 },
  stormbow: { slot: 'weapon', name: tr('Fırtına Yayı'), art: 'lightning-rune', stat: 'damage', base: 0.1 },
  stormhelm: { slot: 'helmet', name: tr('Şimşek Tacı'), art: 'lightning-rune', stat: 'critChance', base: 0.04 },
  stormnecklace: { slot: 'necklace', name: tr('Yıldırım Gerdanı'), art: 'necklace', stat: 'rate', base: 0.05 },
  stormgloves: { slot: 'gloves', name: tr('Kıvılcım Eldivenleri'), art: 'gloves', stat: 'rate', base: 0.045 },
  stormboots: { slot: 'boots', name: tr('Bulut Adımları'), art: 'boots', stat: 'rate', base: 0.04 },
  stormcharm: { slot: 'charm', name: tr('Fırtına Mührü'), art: 'lightning-rune', stat: 'damage', base: 0.05 },
};

/** Extra stats a piece can roll on top of its main stat: [lowest, highest] at Sv 1. */
const AFFIXES = {
  damage: [0.02, 0.05],
  rate: [0.015, 0.04],
  critChance: [0.01, 0.025],
  critMult: [0.05, 0.15],
  gold: [0.03, 0.08],
  castleHp: [0.03, 0.08],
  village: [0.03, 0.08],
};
const AFFIX_COUNT = { common: 0, uncommon: 0, rare: 1, epic: 2, legendary: 3 };
const EMPTY_STATS = { damage: 0, rate: 0, critChance: 0, critMult: 0, gold: 0, castleHp: 0, village: 0 };

/**
 * Item sets: wearing `need` pieces of one set (any rarity, each in its own slot) turns on
 * that tier's bonus. Bonus keys: damage, rate, critChance, critMult, gold, multishot,
 * pierce, castleHp, castleArmor, village. Templates not listed belong to no set.
 */
export const HERO_ITEM_SETS = {
  hunter: {
    name: tr('Avcının Yolu'), color: '#8fd16a',
    pieces: ['hunterbow', 'scouthelm', 'silverearrings', 'leathergloves', 'hunterbelt', 'travelerboots'],
    tiers: [{ need: 2, bonus: { rate: 0.08 } }, { need: 4, bonus: { critChance: 0.05 } }, { need: 6, bonus: { multishot: 1 } }],
  },
  guard: {
    name: tr('Kale Muhafızı'), color: '#72b7ff',
    pieces: ['keepbow', 'kingshelm', 'wardnecklace', 'chainmail', 'guardbelt', 'ironboots'],
    tiers: [{ need: 2, bonus: { damage: 0.1 } }, { need: 4, bonus: { castleHp: 0.2 } }, { need: 6, bonus: { castleArmor: 0.1 } }],
  },
  raider: {
    name: tr('Akıncı Ruhu'), color: '#ff9a5a',
    pieces: ['trailbow', 'hawkhelm', 'rangerhoops', 'outrider', 'falconbracers', 'windboots'],
    tiers: [{ need: 2, bonus: { critChance: 0.04 } }, { need: 4, bonus: { critMult: 0.5 } }, { need: 6, bonus: { pierce: 1 } }],
  },
  royal: {
    name: tr('Kraliyet Hazinesi'), color: '#ffd34d',
    pieces: ['moonearrings', 'ambernecklace', 'ironbracers', 'royalbelt', 'victorymedal'],
    tiers: [{ need: 2, bonus: { gold: 0.1 } }, { need: 4, bonus: { village: 0.2 } }, { need: 5, bonus: { gold: 0.2 } }],
  },
  storm: {
    name: tr('Fırtına Çağıran'), color: '#8ad8ff',
    pieces: ['stormbow', 'stormhelm', 'stormnecklace', 'stormgloves', 'stormboots', 'stormcharm'],
    tiers: [{ need: 2, bonus: { rate: 0.1 } }, { need: 4, bonus: { damage: 0.15 } }, { need: 6, bonus: { multishot: 1, critMult: 0.5 } }],
  },
};

const SET_OF_TEMPLATE = Object.fromEntries(
  Object.entries(HERO_ITEM_SETS).flatMap(([setId, set]) => set.pieces.map((templateId) => [templateId, setId])),
);
const EMPTY_SET_BONUS = { damage: 0, rate: 0, critChance: 0, critMult: 0, gold: 0, multishot: 0, pierce: 0, castleHp: 0, castleArmor: 0, village: 0 };

const rarityOf = (id) => RARITIES.find((rarity) => rarity.id === id) ?? RARITIES[0];
const slotOf = (id) => HERO_ITEM_SLOTS.find((slot) => slot.id === id);
const randomId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function weightedPick(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries.at(-1)[0];
}

/** Chance that one kill drops gear. Regular enemies rarely drop; bosses drop most of the time. */
export const DROP_CHANCE = { grunt: 0.02, shield: 0.03, brute: 0.05, ram: 0.06, catapult: 0.06, raven: 0.01, boss: 0.6, default: 0.02 };

export function rollHeroItem(wave, boss = false, enemyType = 'grunt', chanceMult = 1) {
  const dropChance = (boss ? DROP_CHANCE.boss : DROP_CHANCE[enemyType] ?? DROP_CHANCE.default) * chanceMult;
  if (Math.random() > dropChance) return null;

  const rarity = boss
    ? weightedPick([['uncommon', 15], ['rare', 52], ['epic', 28], ['legendary', 5]])
    : weightedPick([['common', 58], ['uncommon', 28], ['rare', 11], ['epic', 2.7], ['legendary', 0.3]]);
  const templates = Object.keys(HERO_ITEM_TEMPLATES);
  const templateId = templates[Math.floor(Math.random() * templates.length)];
  const wavePower = 1 + Math.min(0.75, Math.floor(Math.max(0, wave - 1) / 20) * 0.15);
  return makeItem(templateId, rarity, wavePower);
}

function makeItem(templateId, rarity, power) {
  const item = { id: randomId(), templateId, rarity, level: 1, power };
  item.affixes = rollAffixes(item);
  return item;
}

/** Random extra stats for an item, never repeating its main stat. */
function rollAffixes(item) {
  const pool = Object.keys(AFFIXES).filter((stat) => stat !== getHeroItemTemplate(item).stat);
  const count = AFFIX_COUNT[rarityOf(item.rarity).id];
  return Array.from({ length: count }, () => {
    const stat = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const [low, high] = AFFIXES[stat];
    return { stat, value: low + Math.random() * (high - low) };
  });
}

export function getHeroItemTemplate(item) {
  return item ? HERO_ITEM_TEMPLATES[item.templateId] ?? null : null;
}

export function getHeroItemRarity(item) {
  return rarityOf(item?.rarity);
}

export function getHeroItemSlot(item) {
  return slotOf(getHeroItemTemplate(item)?.slot);
}

export function heroItemModifier(item) {
  const template = getHeroItemTemplate(item);
  if (!template) return null;
  const level = Math.max(1, Math.min(12, Number(item.level) || 1));
  const power = Math.max(0.5, Math.min(3, Number(item.power) || 1));
  const scale = power * (1 + (level - 1) * 0.08);
  const stats = { ...EMPTY_STATS };
  stats[template.stat] = template.base * rarityOf(item.rarity).multiplier * scale;
  for (const { stat, value } of item.affixes ?? []) stats[stat] += value * scale;
  return stats;
}

/** Expected-value score used to compare items in the automatic loadout. */
export function heroItemScore(item, critMult = 1.5) {
  const modifier = heroItemModifier(item);
  if (!modifier) return 0;
  const critValue = Math.max(0, critMult - 1);
  return modifier.damage + modifier.rate + modifier.critChance * critValue + modifier.gold * 0.2
    + modifier.critMult * 0.3 + modifier.castleHp * 0.1 + modifier.village * 0.1;
}

/** Converts an unwanted piece into a small, rarity- and level-scaled gold reward. */
export function heroItemSellValue(item) {
  if (!getHeroItemTemplate(item)) return 0;
  const level = Math.max(1, Math.min(HERO_ITEM_MAX_LEVEL, Number(item.level) || 1));
  const power = Math.max(0.5, Math.min(3, Number(item.power) || 1));
  return Math.floor(25 * rarityOf(item.rarity).multiplier * power * (1 + (level - 1) * 0.28));
}

export function getEquippedHeroBonuses(state) {
  const bonuses = { ...EMPTY_STATS };
  const inventory = Array.isArray(state.heroInventory) ? state.heroInventory : [];
  const equippedIds = state.heroEquipment ?? {};
  for (const slot of HERO_ITEM_SLOTS) {
    const item = inventory.find((candidate) => candidate.id === equippedIds[slot.id]);
    const modifier = heroItemModifier(item);
    if (!modifier) continue;
    for (const key of Object.keys(bonuses)) bonuses[key] += modifier[key];
  }
  bonuses.damage += codexProgress(state).damage;
  return bonuses;
}

// ---- Öz, Demirci and Koleksiyon ---------------------------------------------------

/** Öz (crafting dust) a piece leaves behind when it is sold, by hand or automatically. */
export function heroItemEssence(item) {
  const rank = RARITIES.indexOf(rarityOf(item?.rarity));
  return 2 ** rank + Math.floor((Math.max(1, Number(item?.level) || 1) - 1) / 2);
}

const REFORGE_COST = { rare: 6, epic: 14, legendary: 30 };

/** Öz to reroll a piece's extra stats; null when it has none. */
export function heroItemReforgeCost(item) {
  return item?.affixes?.length ? REFORGE_COST[rarityOf(item.rarity).id] : null;
}

export function reforgeHeroItem(item) {
  item.affixes = rollAffixes(item);
}

/** Öz to fuse three pieces of a rarity into one of the next; null at the top. */
export function heroFuseCost(rarityId) {
  const rank = RARITIES.findIndex((rarity) => rarity.id === rarityId);
  return rank < RARITIES.length - 1 ? 3 * 2 ** rank : null;
}

/** The piece three others fuse into: next rarity, the strongest wave power among them. */
export function fuseHeroItems(items) {
  const rank = RARITIES.findIndex((rarity) => rarity.id === items[0].rarity);
  const templates = Object.keys(HERO_ITEM_TEMPLATES);
  const templateId = templates[Math.floor(Math.random() * templates.length)];
  return makeItem(templateId, RARITIES[rank + 1].id, Math.max(...items.map((item) => Number(item.power) || 1)));
}

/** Remember the best rarity of every piece ever found. */
export function recordDiscovery(state, item) {
  const rank = RARITIES.indexOf(rarityOf(item.rarity));
  state.heroCodex ??= {};
  state.heroCodex[item.templateId] = Math.max(state.heroCodex[item.templateId] ?? -1, rank);
}

const CODEX_DAMAGE = 0.005; // permanent hero damage per piece discovered

export function codexProgress(state) {
  const found = Object.keys(state.heroCodex ?? {}).filter((id) => HERO_ITEM_TEMPLATES[id]).length;
  return { found, total: Object.keys(HERO_ITEM_TEMPLATES).length, damage: found * CODEX_DAMAGE, perPiece: CODEX_DAMAGE };
}

/**
 * Otomatik Kuşanma: wears a freshly dropped piece when it beats what its slot holds now.
 * Returns true when it was put on. Does nothing unless the timer is running.
 */
export function autoWearItem(state, item, critMult = 1.5) {
  if (!((state.autoWearLeft ?? 0) > 0)) return false;
  const slot = getHeroItemSlot(item)?.id;
  if (!slot) return false;
  const worn = state.heroInventory.find((candidate) => candidate.id === state.heroEquipment?.[slot]);
  if (worn && heroItemScore(worn, critMult) >= heroItemScore(item, critMult)) return false;
  state.heroEquipment ??= {};
  state.heroEquipment[slot] = item.id;
  return true;
}

/** Otomatik Satış: rank is how many rarities are sold on sight. Set pieces and new finds stay. */
export function shouldAutoSell(state, item) {
  const rank = RARITIES.indexOf(rarityOf(item.rarity));
  return rank < (state.settings.autoSellRank ?? 0) && !getHeroItemSet(item) && state.heroCodex?.[item.templateId] != null;
}

const signedPct = (value) => `+${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
export const HERO_STAT_LABELS = {
  damage: tr('kahraman hasarı'), rate: tr('atış hızı'), critChance: tr('kritik şansı'), critMult: tr('kritik hasarı'),
  gold: tr('düşman altını'), castleHp: tr('kale canı'), village: tr('köy geliri'),
};

/** One stat as the player reads it, such as "+5.2% atış hızı". */
export function describeHeroStat(stat, value) {
  return `${stat === 'critMult' ? `+x${value.toFixed(2)}` : signedPct(value)} ${HERO_STAT_LABELS[stat]}`;
}

/** The stats a piece gives, largest contribution of the main stat first. */
export function heroItemStatList(item) {
  const main = getHeroItemTemplate(item)?.stat;
  const modifier = heroItemModifier(item) ?? {};
  return Object.keys(EMPTY_STATS).filter((stat) => modifier[stat] > 0)
    .sort((a, b) => (b === main) - (a === main))
    .map((stat) => ({ stat, value: modifier[stat], main: stat === main }));
}

/** The set an item belongs to, as { id, ...set }, or null. */
export function getHeroItemSet(item) {
  const setId = SET_OF_TEMPLATE[item?.templateId];
  return setId ? { id: setId, ...HERO_ITEM_SETS[setId] } : null;
}

/** Equipped template ids (one per slot). */
function equippedTemplates(state) {
  const inventory = Array.isArray(state.heroInventory) ? state.heroInventory : [];
  const equippedIds = state.heroEquipment ?? {};
  return HERO_ITEM_SLOTS
    .map((slot) => inventory.find((candidate) => candidate.id === equippedIds[slot.id])?.templateId)
    .filter(Boolean);
}

/** Every set with its worn piece count and which tiers are on, in set order. */
export function getHeroSetProgress(state) {
  const worn = new Set(equippedTemplates(state));
  return Object.entries(HERO_ITEM_SETS).map(([id, set]) => {
    const count = set.pieces.filter((templateId) => worn.has(templateId)).length;
    return { id, ...set, count, worn, tiers: set.tiers.map((tier) => ({ ...tier, active: count >= tier.need })) };
  });
}

/** Sum of all active set bonuses. */
export function getHeroSetBonuses(state) {
  const total = { ...EMPTY_SET_BONUS };
  for (const set of getHeroSetProgress(state)) {
    for (const tier of set.tiers) {
      if (!tier.active) continue;
      for (const [key, value] of Object.entries(tier.bonus)) total[key] += value;
    }
  }
  return total;
}

const pctLabel = (value) => `${Math.round(value * 100)}%`;
const SET_BONUS_LABELS = {
  damage: (v) => tr('+{0} kahraman hasarı', pctLabel(v)),
  rate: (v) => tr('+{0} atış hızı', pctLabel(v)),
  critChance: (v) => tr('+{0} kritik şansı', pctLabel(v)),
  critMult: (v) => tr('+x{0} kritik hasarı', v),
  gold: (v) => tr('+{0} düşman altını', pctLabel(v)),
  multishot: (v) => tr('+{0} ok her atışta', v),
  pierce: (v) => tr('+{0} delme', v),
  castleHp: (v) => tr('+{0} kale canı', pctLabel(v)),
  castleArmor: (v) => tr('-{0} kaleye gelen hasar', pctLabel(v)),
  village: (v) => tr('+{0} köy geliri', pctLabel(v)),
};

export function describeSetBonus(bonus) {
  return Object.entries(bonus).map(([key, value]) => SET_BONUS_LABELS[key](value)).join(' · ');
}

/** Lightweight appearance data for the canvas renderer and character preview. */
export function getHeroEquipmentAppearance(state) {
  const inventory = Array.isArray(state.heroInventory) ? state.heroInventory : [];
  const equippedIds = state.heroEquipment ?? {};
  return Object.fromEntries(HERO_ITEM_SLOTS.map((slot) => {
    const item = inventory.find((candidate) => candidate.id === equippedIds[slot.id]);
    if (!item || !getHeroItemTemplate(item)) return [slot.id, null];
    const rarity = rarityOf(item.rarity);
    return [slot.id, { templateId: item.templateId, level: item.level, rarityId: rarity.id, color: rarity.color }];
  }));
}

export function heroItemUpgradeCost(item) {
  const level = Math.max(1, Math.min(12, Number(item?.level) || 1));
  return Math.floor(80 * Math.pow(1.62, level - 1) * rarityOf(item?.rarity).cost);
}

export { RARITIES as HERO_ITEM_RARITIES };
export const HERO_ITEM_MAX_LEVEL = 12;
