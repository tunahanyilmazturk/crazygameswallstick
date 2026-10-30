import { UPGRADE_BY_ID } from '../config/upgrades.js';
import { achievementBonus } from '../config/achievements.js';
import { tr } from '../i18n/i18n.js';

/*
 * Four currencies: gold (resets on prestige), Ruh Taşı (souls), Elmas (gems) and Öz.
 * Anything not bought with gold is stored apart so prestige can wipe `levels` only.
 */
const BAGS = { souls: 'soulLevels', gems: 'gemLevels', heroEssence: 'petLevels' };
const levelBag = (state, u) => state[BAGS[u.currency] ?? 'levels'];
const walletKey = (u) => u.currency ?? 'gold';
const wholeUnits = (u) => !!u.currency;

export function levelOf(state, id) {
  return levelBag(state, UPGRADE_BY_ID[id])[id] || 0;
}

/** How many gear pieces the hero inventory holds (base, Ruh expansions and the Çavuş perk). */
export function inventoryCapacity(state) {
  return UPGRADE_BY_ID.soulInventory.stat(levelOf(state, 'soulInventory')) + achievementBonus(state).perks.slots;
}

export function walletOf(state, id) {
  return state[walletKey(UPGRADE_BY_ID[id])];
}

export function maxLevel(u) {
  return u.max ?? Infinity;
}

/** Total cost of buying `n` levels starting at `level` (geometric series). */
export function bulkCost(u, level, n) {
  const g = u.growth;
  return (u.baseCost * Math.pow(g, level) * (Math.pow(g, n) - 1)) / (g - 1);
}

/** How many levels can be afforded with `money`, capped by the upgrade's max. */
export function affordableCount(u, level, money) {
  const g = u.growth;
  const first = u.baseCost * Math.pow(g, level);
  const n = Math.floor(Math.log((money * (g - 1)) / first + 1) / Math.log(g));
  return Math.max(0, Math.min(n, maxLevel(u) - level));
}

/** Why an upgrade can't be bought yet (stage not reached / prerequisite missing), or null. */
export function lockReason(state, u) {
  if (u.stage && (state.bestWave || 1) < u.stage) return tr('Dalga {0}', u.stage);
  if (u.requires && levelOf(state, u.requires) === 0) return tr('Önce {0}', UPGRADE_BY_ID[u.requires].name);
  return null;
}

/**
 * Resolves the buy amount setting (1, 10 or 'max') into a concrete count and cost.
 * Returns { n, cost, maxed, locked, lockReason }.
 */
export function quote(state, id) {
  const u = UPGRADE_BY_ID[id];
  const level = levelOf(state, id);
  const room = maxLevel(u) - level;
  if (room <= 0) return { n: 0, cost: Infinity, maxed: true };
  const reason = lockReason(state, u);
  if (reason) return { n: 0, cost: Infinity, maxed: false, locked: true, lockReason: reason };
  const amount = state.settings.buyAmount;
  const n = amount === 'max' ? Math.max(1, affordableCount(u, level, walletOf(state, id))) : Math.min(amount, room);
  return { n, cost: bulkCost(u, level, n), maxed: false };
}

export function purchase(state, id) {
  const u = UPGRADE_BY_ID[id];
  const q = quote(state, id);
  const key = walletKey(u);
  // Souls and gems are whole units; round so 1.25^n costs never leave fractions
  const cost = wholeUnits(u) ? Math.ceil(q.cost) : q.cost;
  if (q.maxed || q.locked || q.n <= 0 || state[key] < cost) return false;
  state[key] -= cost;
  levelBag(state, u)[id] = levelOf(state, id) + q.n;
  return true;
}

/** Display cost (whole units for souls and gems). */
export function displayCost(id, cost) {
  return wholeUnits(UPGRADE_BY_ID[id]) ? Math.ceil(cost) : cost;
}

export const currencyIcon = (u) => ({ souls: '💎', gems: '💠', heroEssence: '✦' })[u.currency] ?? '💰';
