import { tr } from '../i18n/i18n.js';
/*
 * The village behind the castle — one definition per site.
 *
 * Everything about a site lives here: its name and icon (shop, tooltips), where its plot sits
 * on the village road (entities/Village.js draws and simulates it there) and its economy
 * (config/upgrades.js turns `building` and `workers` into the two upgrades).
 *
 * The list is in shop order (cheapest first). Plots are laid out on one road, nearest the
 * castle first: farm, mill (grinds the farm's wheat), smithy (forges the mine's ore), mine,
 * quarry; past the road's west end a mountain road climbs to the lumber camp in the forest.
 * `workX` is where the site's workers stand, spread over `spread` px; `work` is seconds per load.
 * `route` (optional) is the path from the work spot down to the village road, for sites off it.
 */

/** The cart by the castle where every worker drops their load. */
export const DEPOT_X = -322;
/** West end of the village road, where the mountain road to the lumber camp branches off. */
export const ROAD_X0 = -952;

/** The forest ledge on the mountain where the lumber camp stands (height above the road). */
export const CAMP_Y = 86;
/** Switchbacks of the mountain road, from the camp ledge down to the village road: [x, height]. */
export const MOUNTAIN_ROAD = [[-1100, 86], [-1050, 64], [-995, 44], [-1010, 22], [-952, 1]];

/** The mine shaft: where the hoist stands, and the gallery dug beneath the road. */
export const MINE = { shaftX: -792, floor: 90, top: 44, x0: -836, x1: -704, faceX: -811 };

export const VILLAGE_SITES = [
  {
    key: 'farm', name: tr('Tarla'), label: tr('TARLA'), icon: '🌾', iconArt: 'wheat', accent: '#d6aa43',
    plot: [-468, -364], workX: -402, spread: 52, work: 3,
    building: { id: 'villageFarm', name: tr('Tarla'), icon: '🌾', iconArt: 'wheat', desc: tr('Buğday tarlası kur; değirmen hasadın değerini artırır'), baseCost: 250, growth: 1.17, base: 1 },
    workers: { id: 'villageFarmers', name: tr('Çiftçi'), icon: '👨‍🌾', iconArt: 'farmer', desc: tr('Hasadı ambara taşıyan çiftçiler'), baseCost: 150, growth: 1.5, worker: tr('çiftçi') },
  },
  {
    // Up the mountain road: the camp sits on a forest ledge, not on the village road
    key: 'lumber', name: tr('Kereste Ocağı'), label: tr('KERESTE'), icon: '🪵', iconArt: 'forest', accent: '#6d9b65',
    plot: [-1225, -1095], workX: -1182, spread: 40, work: 3.5, mountain: true,
    building: { id: 'villageLumber', name: tr('Kereste Ocağı'), icon: '🪵', iconArt: 'forest', desc: tr('Ağaç kesip kereste satar; maden galerilerini tahkim eder'), baseCost: 2500, growth: 1.18, base: 8 },
    workers: { id: 'villageLumberjacks', name: tr('Oduncu'), icon: '🪓', iconArt: 'lumberjack', desc: tr('Kütükleri ambara taşıyan oduncular'), baseCost: 1500, growth: 1.55, worker: tr('oduncu') },
  },
  {
    // Miners split: diggers work the gallery under the road and send ore up the shaft,
    // haulers fill barrows at the shaft head and push them to the cart
    key: 'mine', name: tr('Altın Madeni'), label: tr('MADEN'), icon: '⛏️', iconArt: 'mine', accent: '#e7c56c',
    plot: [-822, -718], workX: -792, spread: 14, work: 4.5, shaft: true,
    building: { id: 'villageMine', name: tr('Altın Madeni'), icon: '⛏️', iconArt: 'mine', desc: tr('Yerin altına galeri kazıp altın çıkarır'), baseCost: 20000, growth: 1.19, base: 60 },
    workers: { id: 'villageMiners', name: tr('Madenci'), icon: '👷', iconArt: 'miner', desc: tr('Yarısı galeride kazar, yarısı kuyudan çıkan cevheri ambara taşır'), baseCost: 12000, growth: 1.6, worker: tr('madenci') },
  },
  {
    key: 'quarry', name: tr('Taş Ocağı'), label: tr('TAŞ OCAĞI'), icon: '🪨', iconArt: 'quarry', accent: '#b9c2d1',
    plot: [-940, -836], workX: -902, spread: 34, work: 4.2,
    building: { id: 'villageQuarry', name: tr('Taş Ocağı'), icon: '🪨', iconArt: 'quarry', desc: tr('Dağdan taş çıkar; taş ustaları kaleyi onarsın'), baseCost: 80000, growth: 1.19, base: 180 },
    workers: { id: 'villageStonecutters', name: tr('Taş Ustası'), icon: '🧱', iconArt: 'stonemason', desc: tr('Kesilen taşları ambar arabasına taşır'), baseCost: 45000, growth: 1.58, worker: tr('taş ustası') },
  },
  {
    key: 'mill', name: tr('Un Değirmeni'), label: tr('DEĞİRMEN'), icon: '🌬️', iconArt: 'windmill', accent: '#d8c9a7',
    plot: [-586, -482], workX: -548, spread: 22, work: 4,
    building: { id: 'villageMill', name: tr('Un Değirmeni'), icon: '🌬️', iconArt: 'windmill', desc: tr('Tarladan gelen buğdayı öğütür; tarla değirmen verimini artırır'), baseCost: 150000, growth: 1.2, base: 450 },
    workers: { id: 'villageMillers', name: tr('Değirmenci'), icon: '🧑‍🍳', iconArt: 'flour', desc: tr('Un çuvallarını ambara taşıyan değirmenciler'), baseCost: 90000, growth: 1.6, worker: tr('değirmenci') },
  },
  {
    // On the plot the lumber camp left behind when it moved up the mountain
    key: 'smithy', name: tr('Demirhane'), label: tr('DEMİRHANE'), icon: '🔨', iconArt: 'hammer', accent: '#e0703a',
    plot: [-700, -598], workX: -652, spread: 24, work: 4.4,
    building: { id: 'villageSmithy', name: tr('Demirhane'), icon: '🔨', iconArt: 'hammer', desc: tr('Madenden gelen cevheri döverek kılıç ve ok ucu yapar; maden demirhanenin verimini artırır'), baseCost: 450000, growth: 1.2, base: 1300 },
    workers: { id: 'villageSmiths', name: tr('Demirci'), icon: '⚒️', iconArt: 'sword-shield', desc: tr('Örste döğülen silahları ambara taşıyan demirciler'), baseCost: 260000, growth: 1.6, worker: tr('demirci') },
  },
];

export const SITE_BY_KEY = Object.fromEntries(VILLAGE_SITES.map((site) => [site.key, site]));
export const VILLAGE_SITE_KEYS = VILLAGE_SITES.map((site) => site.key);

// Crops feed the mill, flour improves the value of the next harvest, timber braces the
// mine's galleries, and the mine's ore feeds the smithy's forge.
export const VILLAGE_CHAINS = [
  { source: 'farm', target: 'mill', perLevel: 0.03, cap: 0.30, label: tr('Tarla → Değirmen') },
  { source: 'mill', target: 'farm', perLevel: 0.02, cap: 0.20, label: tr('Değirmen → Tarla') },
  { source: 'lumber', target: 'mine', perLevel: 0.025, cap: 0.25, label: tr('Kereste → Maden') },
  { source: 'mine', target: 'smithy', perLevel: 0.025, cap: 0.25, label: tr('Maden → Demirhane') },
];

/** Level thresholds where every site gains a visible upgrade (props, pennant, gold sign). */
export const VILLAGE_TIERS = [5, 10, 25];
export const villageTier = (level) => VILLAGE_TIERS.filter((t) => level >= t).length;

/**
 * Köy olayları: now and then a passing event multiplies what the village pays for a short
 * while. `seconds` is play time; when events come is set in VILLAGE_EVENT.
 */
export const VILLAGE_EVENTS = [
  { key: 'market', name: tr('Pazar Günü'), icon: '🛒', mult: 1.5, seconds: 60, desc: tr('Pazar yeri kalabalık: köy geliri x{0}', 1.5) },
  { key: 'caravan', name: tr('Tüccar Kervanı'), icon: '🐪', mult: 2, seconds: 30, desc: tr('Kervan geçiyor: köy geliri x{0}', 2) },
  { key: 'feast', name: tr('Hasat Şenliği'), icon: '🎉', mult: 1.25, seconds: 120, desc: tr('Köyde şenlik var: köy geliri x{0}', 1.25) },
];
/** Play time before the first event, and between events once one has ended. */
export const VILLAGE_EVENT = { firstAfter: 240, every: 420 };
