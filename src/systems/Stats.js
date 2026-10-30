import { UPGRADE_BY_ID, VILLAGE_UPGRADES } from '../config/upgrades.js';
import { ACTIVE_SKILLS } from '../config/skills.js';
import { levelOf } from './Economy.js';
import { getEquippedHeroBonuses, getHeroEquipmentAppearance, getHeroSetBonuses } from './HeroItems.js';
import { achievementBonus } from '../config/achievements.js';
import { oathById } from '../config/oaths.js';
import { PET_UPGRADES } from '../config/pets.js';
import { VILLAGE_SITE_KEYS, VILLAGE_CHAINS } from '../config/village.js';
import { UNITS, UNITS_BY_BRANCH, BRANCHES, BRANCH_MASTERY, RANK_BONUS, rankOf } from '../units/roster.js';

export { VILLAGE_SITE_KEYS, VILLAGE_CHAINS };

/**
 * Rough damage-per-second figures for the shop summary. AoE and piercing
 * attacks assume ~2 targets hit; armor is ignored.
 */
export function estimateDps(stats) {
  const h = stats.hero;
  const burn = 1 + h.burn * 3; // a burning arrow deals its burn over 3 s on top of the hit
  const hero = h.damage * h.rate * h.multishot * (1 + h.critChance * (h.critMult - 1)) * burn * (1 + h.pierce * 0.5);
  const perAlly = {};
  for (const u of UNITS) {
    const st = stats.allies[u.kind];
    perAlly[u.kind] = st && u.dps ? u.dps(st) : 0;
  }
  const allies = Object.values(perAlly).reduce((s, v) => s + v, 0);
  return { hero, allies, perAlly, total: hero + allies };
}

/** Turns saved upgrade levels into the numbers the simulation uses. */
export function computeStats(state) {
  const val = (id) => UPGRADE_BY_ID[id].stat(levelOf(state, id));

  const oath = oathById(state.oath);
  // The chosen Yoldaş, or the first one owned when none has been chosen
  const owned = PET_UPGRADES.filter((u) => levelOf(state, u.id) > 0);
  const petDef = owned.find((u) => u.id === state.activePet) ?? owned[0];
  const pet = petDef ? { def: petDef, level: levelOf(state, petDef.id), ...petDef.stat(levelOf(state, petDef.id)) } : null;
  const petBonus = (key) => (pet?.def.bonus === key ? pet.passive : 0);
  // Permanent prestige multipliers
  const soul = {
    damage: val('soulPower'),
    gold: val('soulGold'),
    walls: val('soulWalls'),
    haste: val('soulHaste'),
    startGold: val('soulStart'),
    offline: val('soulTime'),
    harvest: val('soulHarvest') * val('tEcoSouls') * oath.souls,
    startWave: val('soulSkip'),
    crit: val('soulCrit'),
    village: val('soulVillage'),
    bossDmg: val('soulBoss'),
    drop: val('soulDrop') * (1 + petBonus('drop')),
    gems: val('soulGems'),
    memory: val('soulMemory'),
  };

  // Passive talent tree (bought with Elmas)
  const talent = {
    heroDmg: val('tArchDmg'),
    heroRate: val('tArchSpeed'),
    critMult: val('tArchCrit'),
    volley: val('tArchVolley'),
    castleHp: val('tDefHp'),
    allyDmg: val('tDefAllies'),
    will: val('tDefWill'),
    allyRate: val('tDefDrill'),
    loot: val('tEcoLoot'),
    village: val('tEcoVillage'),
    bossGems: val('tEcoGems'),
    souls: val('tEcoSouls'),
  };

  // Şan (achievements) and item sets
  const glory = achievementBonus(state);
  const sets = getHeroSetBonuses(state);

  // Active skills: null until unlocked
  const skills = {};
  for (const u of ACTIVE_SKILLS) skills[u.key] = u.stat(levelOf(state, u.id));

  // Army: a branch is mastered once every unit in it is hired
  const mastered = Object.fromEntries(BRANCHES.map((b) => [b.id, UNITS_BY_BRANCH[b.id].every((u) => levelOf(state, u.id) > 0)]));
  const allies = {};
  for (const u of UNITS) {
    const l = levelOf(state, u.id);
    if (!l) {
      allies[u.kind] = null;
      continue;
    }
    const rank = rankOf(l);
    // Veterancy and branch mastery both raise damage and healing
    const drill = (1 + rank.stars * RANK_BONUS) * (mastered[u.branch] ? 1 + BRANCH_MASTERY : 1);
    const st = { level: l, rank, ...u.stat(l) };
    if (st.damage) st.damage *= soul.damage * talent.allyDmg * glory.mult * drill;
    if (st.rate) st.rate *= soul.haste * talent.allyRate;
    if (st.cooldown) st.cooldown /= soul.haste * talent.allyRate;
    if (st.hp) st.hp *= soul.walls;
    if (st.heal) st.heal *= soul.walls * drill;
    allies[u.kind] = st;
  }

  // Support auras apply after every unit is built so all recruited roles benefit:
  // the standard raises damage, healing and soldier hit points, the drum attack speed.
  const banner = allies.banner;
  const drum = allies.drummer;
  for (const [kind, st] of Object.entries(allies)) {
    if (!st || kind === 'banner' || kind === 'drummer') continue;
    if (banner) {
      if (st.damage) st.damage *= 1 + banner.damageAura;
      if (st.heal) st.heal *= 1 + banner.healAura;
      if (kind === 'soldier' && st.hp) st.hp *= 1 + banner.hpAura;
    }
    if (drum) {
      if (st.rate) st.rate *= 1 + drum.rateAura;
      if (st.cooldown) st.cooldown /= 1 + drum.rateAura;
    }
  }
  const army = { mastered };

  // Village sites: per-worker gold/s (global bonuses and supply-chain effects applied)
  const market = val('villageMarket');
  const heroGear = getEquippedHeroBonuses(state);
  const villageMult = soul.gold * soul.village * market * talent.village * glory.mult * (1 + sets.village + heroGear.village + glory.perks.village);
  const village = { total: 0, market, mult: villageMult, chains: [] };
  for (const u of VILLAGE_UPGRADES) {
    if (!u.site) continue;
    const site = (village[u.site] ??= { level: 0, baseRate: 0, rate: 0, workers: 0 });
    const l = levelOf(state, u.id);
    if (u.role === 'building') {
      site.level = l;
      site.baseRate = u.stat(l).rate * villageMult;
    } else {
      site.workers = l;
    }
  }
  for (const chain of VILLAGE_CHAINS) {
    const bonus = Math.min(chain.cap, village[chain.source].level * chain.perLevel);
    village[chain.target].chainBonus = (village[chain.target].chainBonus ?? 0) + bonus;
    village.chains.push({ ...chain, bonus });
  }
  for (const key of VILLAGE_SITE_KEYS) {
    const site = village[key];
    site.chainBonus ??= 0;
    site.synergy = 1 + site.chainBonus;
    site.rate = site.baseRate * site.synergy;
    site.income = site.level ? site.rate * site.workers : 0;
    village.total += site.income;
  }
  const quarry = village.quarry;
  quarry.repair = quarry.level && quarry.workers
    ? quarry.workers * 0.25 * (1 + Math.min(0.5, Math.max(0, quarry.level - 1) * 0.05)) * soul.walls
    : 0;

  const oil = val('castleOil');
  const catapult = val('castleCatapult');
  // Dış Sur: its own hit points (walls bonuses apply), gate armour and the archers on top
  const outerWall = () => {
    const level = levelOf(state, 'castleOuterWall');
    if (!level) return null;
    const archers = val('castleOuterArchers');
    return {
      level,
      gateLevel: levelOf(state, 'castleOuterGate'),
      hp: val('castleOuterWall') * soul.walls * talent.castleHp * (1 + sets.castleHp + heroGear.castleHp),
      armor: val('castleOuterGate'),
      // The repair crew and stonemasons patch the outer wall at half their castle rate
      regen: (val('castleRegen') * soul.walls + quarry.repair) * 0.5,
      archers: archers && { ...archers, damage: archers.damage * soul.damage * talent.allyDmg * glory.mult * (1 + (allies.banner?.damageAura ?? 0)), rate: archers.rate * soul.haste * talent.allyRate * (1 + (allies.drummer?.rateAura ?? 0)) },
    };
  };
  return {
    village,
    skills,
    talent,
    glory,
    oath,
    pet,
    sets,
    hero: {
      damage: val('heroDamage') * soul.damage * talent.heroDmg * glory.mult * (1 + heroGear.damage + sets.damage + petBonus('damage')),
      rate: val('heroRate') * soul.haste * talent.heroRate * (1 + heroGear.rate + sets.rate + glory.perks.rate + petBonus('rate')),
      critChance: val('heroCrit') + val('castleBeacon') + soul.crit + heroGear.critChance + sets.critChance + glory.perks.crit + petBonus('crit'),
      critMult: val('heroCritDmg') + talent.critMult + sets.critMult + heroGear.critMult,
      multishot: val('heroMulti') + talent.volley + sets.multishot,
      autoFire: val('heroAuto'), // 0 = the hero only shoots where the player clicks
      rainArrows: val('heroRain'),
      rainCooldown: val('heroRainCd') / soul.haste,
      pierce: val('heroPierce') + sets.pierce,
      burn: val('heroBurn'),
      equipment: getHeroEquipmentAppearance(state),
    },
    castle: {
      maxHp: val('castleHp') * soul.walls * talent.castleHp * oath.castleHp * (1 + sets.castleHp + heroGear.castleHp + glory.perks.castleHp),
      regen: val('castleRegen') * soul.walls + quarry.repair,
      // Demir İrade and the Kale Muhafızı set stack multiplicatively with Demir Kaplama
      armor: 1 - (1 - val('castleArmor')) * (1 - talent.will) * (1 - sets.castleArmor) * (1 - petBonus('armor')),
      goldMult: val('castleGold') * soul.gold * talent.loot * glory.mult * oath.gold * (1 + heroGear.gold + sets.gold + glory.perks.gold + petBonus('gold')),
      thorns: val('castleThorns'),
      oil: oil && { damage: oil.damage * soul.damage * glory.mult, cooldown: oil.cooldown },
      interest: val('castleInterest'),
      catapult: catapult && { ...catapult, damage: catapult.damage * soul.damage * glory.mult },
      bell: val('castleBell'),
      stores: val('castleStores'),
      outer: outerWall(),
    },
    allies,
    army,
    soul,
  };
}
