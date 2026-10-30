import { HERO_ITEM_SLOTS, recordDiscovery } from '../systems/HeroItems.js';
import { LEGACY_ENEMY_TYPES } from '../config/enemies.js';
import { tr } from '../i18n/i18n.js';

const KEY = 'cop-kale-save-v1';
const BACKUP_KEY = `${KEY}-yedek`;

let cloud = null; // CrazyGames data module; null keeps the save in localStorage

/** Where saves live. Backups always stay in localStorage, as a local safety copy. */
export function setSaveStore(store) {
  cloud = store;
}
const saves = () => cloud ?? localStorage;

export function createDefaultState() {
  return {
    version: 3,
    gold: 20,
    wave: 1,
    maxWave: 1,
    levels: {},
    souls: 0,
    soulLevels: {},
    totalSouls: 0,
    prestiges: 0,
    // Elmas and everything bought with it survive Yeniden Doğuş
    gems: 0,
    totalGems: 0,
    gemLevels: {},
    skillAuto: {},
    bestWave: 1,       // best wave ever reached (unlocks skill stages)
    bestBossWave: 0,   // highest boss wave beaten (first-kill Elmas bonus)
    heroInventory: [],
    heroEquipment: Object.fromEntries(HERO_ITEM_SLOTS.map(({ id }) => [id, null])),
    boostLeft: 0,      // seconds of Hızlandırma left (config/rewards.js)
    fastLeft: 0,       // seconds of ad-bought 3x speed left (config/rewards.js SPEED)
    vipNext: null,     // playTime of the VIP Elçi's next visit
    coachStep: 0,      // first-minutes hints (ui/Coach.js)
    oath: 'none',      // Yemin sworn for this run (config/oaths.js)
    nextOath: 'none',  // Yemin the next Yeniden Doğuş will start
    prestigeLog: [],   // last runs, newest first: { wave, souls, time, oath }
    runStart: 0,       // playTime when this run began
    petLevels: {},     // Yoldaş levels, kept through Yeniden Doğuş
    activePet: null,   // id of the Yoldaş at the hero's side
    heroEssence: 0,    // Öz, left behind by sold gear
    heroCodex: {},     // templateId → best rarity rank ever found
    heroLoadouts: [null, null, null],
    kills: 0,
    // Lifetime tallies for achievements (survive Yeniden Doğuş): bossKills, siegeKills,
    // flyerKills, crits, manualShots, skillCasts, castleFalls, itemsFound, legendaries,
    // bestStreak, perfectWaves
    counters: {},
    achievements: {},  // id → time unlocked
    seenEnemies: [],   // types already introduced with a banner
    totalGold: 0,
    goldPerSec: 0,
    playTime: 0,
    tutorialSeen: false,
    lastSaved: Date.now(),
    settings: {
      sound: true, volume: 0.8, shake: true, damageNumbers: true, autoAdvance: true, autoSkill: true, speed: 1, buyAmount: 1,
      quality: 'high', uiScale: 1, numberStyle: 'short', autoSellRank: 0,
      shopView: {}, favorites: {},
    },
    seenVersion: null, // last version whose notes (Yenilikler) were opened
  };
}

/** The save as a portable text code (base64 of its JSON). */
export function exportSave(state) {
  const json = JSON.stringify({ ...state, lastSaved: Date.now() });
  return btoa(unescape(encodeURIComponent(json)));
}

/**
 * Checks a code from exportSave and stores it as the save. Returns an error message, or null
 * on success (the caller reloads so loadState fills in anything the code lacks).
 */
export function importSave(code) {
  let data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  } catch {
    return tr('Kod çözülemedi. Tamamını eksiksiz kopyaladığından emin ol.');
  }
  if (!data || typeof data !== 'object' || !Number.isFinite(data.wave) || typeof data.levels !== 'object') {
    return tr('Bu bir Surların Efendisi kaydı değil.');
  }
  try {
    saves().setItem(KEY, JSON.stringify(data));
  } catch {
    return tr('Tarayıcı kaydı yazmaya izin vermedi.');
  }
  return null;
}

export function loadState() {
  const def = createDefaultState();
  try {
    const raw = saves().getItem(KEY);
    if (!raw) return def;
    const data = JSON.parse(raw);
    const heroInventory = Array.isArray(data.heroInventory)
      ? data.heroInventory.filter((item) => item && typeof item.id === 'string' && typeof item.templateId === 'string')
      : [];
    const savedEquipment = data.heroEquipment && typeof data.heroEquipment === 'object' ? data.heroEquipment : {};
    const s = {
      ...def, ...data,
      version: 3,
      // Existing saves skip the new-player intro; fresh saves keep the default false.
      tutorialSeen: data.tutorialSeen ?? true,
      levels: { ...data.levels }, soulLevels: { ...data.soulLevels }, gemLevels: { ...data.gemLevels }, petLevels: { ...data.petLevels },
      skillAuto: { ...data.skillAuto }, settings: { ...def.settings, ...data.settings },
      counters: { ...data.counters }, achievements: { ...data.achievements },
      seenEnemies: Array.isArray(data.seenEnemies) ? data.seenEnemies : [...LEGACY_ENEMY_TYPES],
      heroInventory,
      heroEquipment: Object.fromEntries(
        Object.keys(def.heroEquipment).map((slot) => [
          slot,
          heroInventory.some((item) => item.id === savedEquipment[slot]) ? savedEquipment[slot] : null,
        ]),
      ),
    };
    s.bestWave = Math.max(s.bestWave, s.maxWave);
    // Saves from before the Koleksiyon count what they already carry
    s.heroCodex = { ...data.heroCodex };
    for (const item of heroInventory) recordDiscovery(s, item);
    // v3 made automatic fire an upgrade; saves past the first boss get its first level
    if ((data.version ?? 1) < 3 && s.bestWave >= 10 && !s.gemLevels.heroAuto) s.gemLevels.heroAuto = 1;
    backupSave(raw);
    return s;
  } catch (error) {
    // Never let a load failure lead to the save being overwritten by a fresh game
    console.error('Kayıt yüklenemedi', error);
    backupSave(saves().getItem(KEY), BACKUP_KEY + '-hata');
    return def;
  }
}

/** Keeps a copy of the save from the last good load. */
function backupSave(raw, key = BACKUP_KEY) {
  try {
    if (raw) localStorage.setItem(key, raw);
  } catch {
    /* storage unavailable or full — the main save is unaffected */
  }
}

/** Whether this browser holds a saved game (the main menu offers Devam Et). */
export function hasSave() {
  try {
    return saves().getItem(KEY) != null;
  } catch {
    return false;
  }
}

export function saveState(state) {
  state.lastSaved = Date.now();
  try {
    saves().setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable (private mode) — game still runs */
  }
}

export function clearSave() {
  try {
    saves().removeItem(KEY);
  } catch {
    /* ignore */
  }
}
