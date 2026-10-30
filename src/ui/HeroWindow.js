import { h } from './dom.js';
import { showModal } from './Modal.js';
import { iconHtml } from './icons.js';
import { fmt } from '../utils/format.js';
import { saveState } from '../core/State.js';
import { bowCycle, drawArcher } from '../render/archer.js';
import { UPGRADE_BY_ID } from '../config/upgrades.js';
import { displayCost, inventoryCapacity, levelOf, purchase, quote } from '../systems/Economy.js';
import {
  codexProgress,
  describeHeroStat,
  describeSetBonus,
  fuseHeroItems,
  getEquippedHeroBonuses,
  getHeroItemRarity,
  getHeroItemSet,
  getHeroItemSlot,
  getHeroItemTemplate,
  getHeroSetProgress,
  heroFuseCost,
  heroItemEssence,
  heroItemModifier,
  heroItemReforgeCost,
  heroItemScore,
  heroItemSellValue,
  heroItemStatList,
  heroItemUpgradeCost,
  HERO_ITEM_MAX_LEVEL,
  HERO_ITEM_RARITIES,
  HERO_ITEM_SETS,
  HERO_ITEM_SLOTS,
  HERO_ITEM_TEMPLATES,
  HERO_STAT_LABELS,
  recordDiscovery,
  reforgeHeroItem,
} from '../systems/HeroItems.js';
import { tr } from '../i18n/i18n.js';

const SLOT_UPGRADE = 'soulInventory'; // Ruh upgrade that adds inventory slots
const FUSE_COUNT = 3;
const TABS = [
  ['bag', tr('Çanta')],
  ['forge', tr('Demirci')],
  ['sets', tr('Setler')],
  ['codex', tr('Koleksiyon')],
];
const SORTS = [
  ['new', tr('En yeni')],
  ['power', tr('En güçlü')],
  ['rarity', tr('Sınıf')],
  ['slot', tr('Yuva')],
];
const AUTO_SELL = [tr('Kapalı'), tr('Sıradan'), tr('İyi ve altı'), tr('Nadir ve altı')];
// Paperdoll order: four slots either side of the hero, the charm beneath
const LEFT_SLOTS = ['weapon', 'helmet', 'armor', 'gloves'];
const RIGHT_SLOTS = ['earrings', 'necklace', 'belt', 'boots'];
const RARITY_RANK = Object.fromEntries(HERO_ITEM_RARITIES.map((r, i) => [r.id, i]));
const SLOT_RANK = Object.fromEntries(HERO_ITEM_SLOTS.map((s, i) => [s.id, i]));
const SLOT_BY_ID = Object.fromEntries(HERO_ITEM_SLOTS.map((s) => [s.id, s]));

const itemIcon = (item, className) => iconHtml('🏹', className, getHeroItemTemplate(item)?.art ?? 'treasure');
const essenceLabel = (n) => tr('<span class="inv-essence">✦ {0} Öz</span>', fmt(n));

function activeSetTiers(state) {
  return new Set(getHeroSetProgress(state).flatMap((set) => set.tiers.filter((tier) => tier.active).map((tier) => `${set.id}:${tier.need}`)));
}

/**
 * The hero's gear window. Çanta wears and compares gear, Demirci turns spare gear into
 * something useful, Setler shows set progress and Koleksiyon everything ever found.
 */
export class HeroWindow {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.tab = 'bag';
    this.selectedItemId = null;
    this.sort = 'new';
    this.slotFilter = 'all';
    this.fuseRarity = 'common';
    this.bulkRank = 0;        // sell everything up to this rarity
    this.bulkConfirm = false;
    this.notice = '';
    this.content = null;
    this.closeModal = null;
    this.frame = 0;           // animation frame of the paperdoll hero while the window is open
  }

  open() {
    if (this.closeModal) return;
    this.selectedItemId = null;
    this.notice = '';
    this.content = h('div.hero-window');
    this.content.addEventListener('click', (event) => this.handleClick(event));
    this.content.addEventListener('change', (event) => this.handleChange(event));
    // Double-click an item in the grid to put it on
    this.content.addEventListener('dblclick', (event) => {
      const cell = event.target.closest('.inv-cell[data-item-id]');
      if (cell) this.equip(cell.dataset.itemId);
    });
    this.render();
    this.animate();
    this.closeModal = showModal(this.root, {
      title: tr('Envanter'),
      body: this.content,
      className: 'hero-modal',
      buttons: [{ label: tr('Kapat'), primary: true }],
      onClose: () => {
        cancelAnimationFrame(this.frame);
        this.closeModal = null;
        this.content = null;
        // Everything in the bag has now been seen
        for (const item of this.game.state.heroInventory) delete item.fresh;
      },
    });
  }

  refresh() {
    if (this.content?.isConnected) this.render();
  }

  // ---- paperdoll ----------------------------------------------------------------

  /** The paperdoll hero breathes and draws the bow in a slow loop while the window is open. */
  animate() {
    const t0 = performance.now();
    const tick = (now) => {
      if (!this.content) return; // closed
      this.animT = (now - t0) / 1000;
      this.drawPaperdoll();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  /** One frame of the paperdoll hero at the animation's current time. */
  drawPaperdoll() {
    const canvas = this.content?.querySelector('.inv-hero-canvas');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const t = this.animT ?? 0;
    const c = bowCycle(t % 2.8, 1.6, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawArcher(ctx, 180, 400, -0.15 + Math.sin(t * 0.7) * 0.04, c.pull, {
      ...c, s: 5.1, accent: '#2f6fd6', cape: true, hood: '#2f6fd6', t,
      lean: -0.05 + Math.sin(t * 2.2) * 0.02 - c.release * 0.08,
      equipment: this.game.stats.hero.equipment, hero: true,
    });
  }

  // ---- data helpers -------------------------------------------------------------

  get items() {
    return this.game.state.heroInventory.filter((item) => getHeroItemTemplate(item));
  }

  get wornIds() {
    return new Set(Object.values(this.game.state.heroEquipment ?? {}).filter(Boolean));
  }

  /** Gear score shown to the player: the auto-equip score as a whole number. */
  powerOf(item) {
    return Math.round(heroItemScore(item, this.game.stats.hero.critMult ?? 1.5) * 1000);
  }

  wornIn(slotId) {
    return this.items.find((item) => item.id === this.game.state.heroEquipment?.[slotId]) ?? null;
  }

  isUpgrade(item) {
    if (this.wornIds.has(item.id)) return false;
    const worn = this.wornIn(getHeroItemSlot(item)?.id);
    return this.powerOf(item) > (worn ? this.powerOf(worn) : -1);
  }

  /** Pieces free to sell or fuse: not worn, not locked. */
  get spareItems() {
    const worn = this.wornIds;
    return this.items.filter((item) => !worn.has(item.id) && !item.locked);
  }

  bulkItems() {
    return this.spareItems.filter((item) => RARITY_RANK[getHeroItemRarity(item).id] <= this.bulkRank);
  }

  /** The weakest spare pieces of the chosen rarity go first when fusing. */
  fuseItems() {
    return this.spareItems
      .filter((item) => getHeroItemRarity(item).id === this.fuseRarity)
      .sort((a, b) => this.powerOf(a) - this.powerOf(b))
      .slice(0, FUSE_COUNT);
  }

  /** Remove pieces for gold and Öz; returns [gold, essence]. */
  sellItems(items) {
    const state = this.game.state;
    const sold = new Set(items.map((item) => item.id));
    const gold = items.reduce((sum, item) => sum + heroItemSellValue(item), 0);
    const essence = items.reduce((sum, item) => sum + heroItemEssence(item), 0);
    state.heroInventory = state.heroInventory.filter((item) => !sold.has(item.id));
    state.gold += gold;
    state.heroEssence = (state.heroEssence ?? 0) + essence;
    this.game.count('itemsSold', items.length);
    if (sold.has(this.selectedItemId)) this.selectedItemId = null;
    return [gold, essence];
  }

  /** Wear the strongest owned pieces, optionally only those of one set. */
  equipBest(filter = () => true) {
    const equipment = this.game.state.heroEquipment;
    let changed = 0;
    for (const slot of HERO_ITEM_SLOTS) {
      const best = this.items
        .filter((item) => getHeroItemSlot(item)?.id === slot.id && filter(item))
        .reduce((winner, item) => (!winner || this.powerOf(item) > this.powerOf(winner) ? item : winner), null);
      if (!best || best.id === equipment[slot.id]) continue;
      const worn = this.wornIn(slot.id);
      // Plain "best gear" never swaps sideways; a set request always wears its piece
      if (filter.set || !worn || this.powerOf(best) > this.powerOf(worn)) {
        equipment[slot.id] = best.id;
        changed++;
      }
    }
    return changed;
  }

  // ---- actions --------------------------------------------------------------------

  /** Put an item on (double-click in the grid). */
  equip(itemId) {
    const state = this.game.state;
    const item = this.items.find((candidate) => candidate.id === itemId);
    const slot = getHeroItemSlot(item)?.id;
    if (!slot || state.heroEquipment[slot] === item.id) return;
    this.tiersBefore = activeSetTiers(state);
    state.heroEquipment[slot] = item.id;
    this.selectedItemId = item.id;
    this.commit('buy');
  }

  /** Stats, sound, set announcements, save and redraw after anything changed. */
  commit(sound) {
    this.game.refreshStats();
    if (sound) this.game.audio.play(sound);
    this.announceSetTiers();
    saveState(this.game.state);
    this.render();
  }

  /** Tell the player when an equip change switched on a new set tier. */
  announceSetTiers() {
    const before = this.tiersBefore ?? new Set();
    for (const set of getHeroSetProgress(this.game.state)) {
      for (const tier of set.tiers) {
        if (tier.active && !before.has(`${set.id}:${tier.need}`)) this.onSetTier?.(set, tier);
      }
    }
  }

  handleChange(event) {
    const select = event.target.closest('select[data-view]');
    if (!select || !this.content.contains(select)) return;
    const { view } = select.dataset;
    if (view === 'autoSell') {
      this.game.state.settings.autoSellRank = Number(select.value);
      saveState(this.game.state);
    } else if (view === 'bulkRank') {
      this.bulkRank = Number(select.value);
      this.bulkConfirm = false;
    } else {
      this[view] = select.value;
    }
    this.render();
  }

  handleClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || !this.content.contains(button)) return;
    const { action } = button.dataset;
    if (action !== 'bulk-sell') this.bulkConfirm = false;
    this.tiersBefore = activeSetTiers(this.game.state);
    this.actions[action]?.call(this, button.dataset);
  }

  actions = {
    tab({ tab }) {
      this.tab = tab;
      this.notice = '';
      this.render();
    },
    select({ itemId }) {
      this.selectedItemId = itemId;
      this.render();
    },
    /** A worn slot shows its piece; an empty one lists what could go there. */
    slot({ slot }) {
      const worn = this.wornIn(slot);
      this.tab = 'bag';
      if (worn) this.selectedItemId = worn.id;
      else this.slotFilter = slot;
      this.render();
    },
    filter({ slot }) {
      this.slotFilter = slot;
      this.render();
    },
    'equip-best'() {
      const changed = this.equipBest();
      this.notice = changed ? tr('{0} yuvaya daha güçlü eşya kuşanıldı.', changed) : tr('Her yuvada en güçlü eşya zaten kuşanılı.');
      if (changed) this.commit('buy');
      else this.render();
    },
    equip({ itemId }) {
      this.equip(itemId);
    },
    unequip({ slot }) {
      this.game.state.heroEquipment[slot] = null;
      this.commit('buy');
    },
    upgrade({ itemId }) {
      const state = this.game.state;
      const item = this.items.find((candidate) => candidate.id === itemId);
      if (!item || item.level >= HERO_ITEM_MAX_LEVEL) return;
      const cost = heroItemUpgradeCost(item);
      if (state.gold < cost) return;
      state.gold -= cost;
      item.level++;
      this.commit('buy');
    },
    reforge({ itemId }) {
      const state = this.game.state;
      const item = this.items.find((candidate) => candidate.id === itemId);
      const cost = heroItemReforgeCost(item);
      if (!cost || (state.heroEssence ?? 0) < cost) return;
      state.heroEssence -= cost;
      reforgeHeroItem(item);
      this.notice = tr('{0} yeniden dövüldü.', getHeroItemTemplate(item).name);
      this.commit('buy');
    },
    lock({ itemId }) {
      // Locked pieces are kept out of selling and fusing
      const item = this.items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      item.locked = !item.locked;
      this.notice = `${getHeroItemTemplate(item).name} ${item.locked ? tr('kilitlendi: satılmaz, birleştirilmez') : tr('kilidi açıldı')}.`;
      saveState(this.game.state);
      this.render();
    },
    sell({ itemId }) {
      const item = this.spareItems.find((candidate) => candidate.id === itemId);
      if (!item) return;
      const name = getHeroItemTemplate(item).name;
      const [gold, essence] = this.sellItems([item]);
      this.notice = tr('{0} satıldı: +{1} altın, +{2} Öz.', name, fmt(gold), essence);
      this.commit('coin');
    },
    'bulk-sell'() {
      const items = this.bulkItems();
      if (!items.length) return;
      if (!this.bulkConfirm) {
        this.bulkConfirm = true;
        this.render();
        return;
      }
      this.bulkConfirm = false;
      const [gold, essence] = this.sellItems(items);
      this.notice = tr('{0} eşya satıldı: +{1} altın, +{2} Öz.', items.length, fmt(gold), essence);
      this.commit('coin');
    },
    'fuse-rarity'({ rarity }) {
      this.fuseRarity = rarity;
      this.render();
    },
    fuse() {
      const state = this.game.state;
      const items = this.fuseItems();
      const cost = heroFuseCost(this.fuseRarity);
      if (cost == null || items.length < FUSE_COUNT || (state.heroEssence ?? 0) < cost) return;
      const made = fuseHeroItems(items);
      const used = new Set(items.map((item) => item.id));
      state.heroInventory = state.heroInventory.filter((item) => !used.has(item.id));
      state.heroEssence -= cost;
      made.fresh = true;
      state.heroInventory.push(made);
      recordDiscovery(state, made);
      this.game.count('fusions');
      if (used.has(this.selectedItemId)) this.selectedItemId = made.id;
      this.notice = tr('Yeni eşya: {0} {1}!', getHeroItemRarity(made).name, getHeroItemTemplate(made).name);
      this.commit('loot');
    },
    'set-equip'({ set }) {
      const filter = (item) => getHeroItemSet(item)?.id === set;
      filter.set = true;
      const changed = this.equipBest(filter);
      this.notice = changed ? tr('{0}: {1} parça kuşanıldı.', HERO_ITEM_SETS[set].name, changed) : tr('Bu setin elindeki parçaları zaten kuşanılı.');
      this.commit(changed ? 'buy' : null);
    },
    'loadout-use'({ index }) {
      const state = this.game.state;
      const saved = state.heroLoadouts?.[index];
      if (!saved) return;
      const owned = new Set(this.items.map((item) => item.id));
      for (const slot of HERO_ITEM_SLOTS) {
        if (owned.has(saved[slot.id])) state.heroEquipment[slot.id] = saved[slot.id];
      }
      this.notice = tr('Takım {0} kuşanıldı.', Number(index) + 1);
      this.commit('buy');
    },
    'loadout-save'({ index }) {
      const state = this.game.state;
      state.heroLoadouts ??= [null, null, null];
      state.heroLoadouts[index] = { ...state.heroEquipment };
      this.notice = tr('Takım {0} kaydedildi.', Number(index) + 1);
      saveState(state);
      this.render();
    },
    'expand-slots'() {
      if (!purchase(this.game.state, SLOT_UPGRADE)) return;
      this.notice = tr('Çanta genişledi: {0} yuva.', inventoryCapacity(this.game.state));
      this.commit('buy');
    },
  };

  // ---- rendering -------------------------------------------------------------------

  render() {
    if (!this.content) return;
    // The grid is rebuilt on every change; stay at the same scroll position
    const scroll = this.content.querySelector('.inv-grid-scroll')?.scrollTop ?? 0;
    const { state } = this.game;
    const gearPower = HERO_ITEM_SLOTS.reduce((sum, slot) => {
      const worn = this.wornIn(slot.id);
      return sum + (worn ? this.powerOf(worn) : 0);
    }, 0);
    const body = { bag: this.renderBag, forge: this.renderForge, sets: this.renderSets, codex: this.renderCodex }[this.tab];
    this.content.innerHTML = tr('\n      <div class="inv-top">\n        <nav class="inv-tabs" aria-label="Envanter bölümleri">{0}</nav>\n        <div class="inv-wallet">\n          <span title="Kuşanılan eşyaların toplam gücü"><small>Güç</small><b>{1}</b></span>\n          <span><small>Altın</small><b class="gold">{2}</b></span>\n          <span title="Eşya satınca kazanılır. Demirci işlerinde harcanır."><small>Öz</small><b class="essence">{3}</b></span>\n        </div>\n      </div>\n      <p class="inv-notice" role="status">{4}</p>\n      <div class="inv-page">{5}</div>', TABS.map(([id, label]) => `<button class="inv-tab${this.tab === id ? ' on' : ''}" data-action="tab" data-tab="${id}" aria-pressed="${this.tab === id}">${label}</button>`).join(''), fmt(gearPower), fmt(state.gold), fmt(state.heroEssence ?? 0), this.notice, body.call(this));
    const grid = this.content.querySelector('.inv-grid-scroll');
    if (grid) grid.scrollTop = scroll;
    // Draw right away so the hero shows before the animation's first frame
    this.drawPaperdoll();
  }

  renderBag() {
    return `<div class="inv-bag-layout">
      ${this.renderCharacter()}
      ${this.renderGrid()}
      ${this.renderDetail()}
    </div>`;
  }

  slotButton(slot) {
    const item = this.wornIn(slot.id);
    if (!item) {
      return `<button class="inv-slot" data-action="slot" data-slot="${slot.id}" title="${slot.name}: boş. Tıkla, uygun eşyaları göster." aria-label="${slot.name} yuvası boş">${iconHtml('🏹', 'inv-slot-icon', slot.art)}<small>${slot.name}</small></button>`;
    }
    const rarity = getHeroItemRarity(item);
    const name = getHeroItemTemplate(item).name;
    const selected = item.id === this.selectedItemId;
    return `<button class="inv-slot filled${selected ? ' selected' : ''}" style="--rarity:${rarity.color}" data-action="slot" data-slot="${slot.id}" title="${name}" aria-label="${slot.name}: ${name}, ${rarity.name}, seviye ${item.level}">${itemIcon(item, 'inv-slot-icon')}<i>+${item.level}</i><small>${slot.name}</small></button>`;
  }

  renderCharacter() {
    const { state } = this.game;
    const bonuses = getEquippedHeroBonuses(state);
    const totals = Object.keys(HERO_STAT_LABELS).filter((stat) => bonuses[stat] > 0);
    return tr('<section class="inv-panel inv-character" aria-label="Karakter">\n      <div class="inv-doll">\n        <div class="inv-doll-col">{0}</div>\n        <div class="inv-doll-hero">\n          <canvas class="inv-hero-canvas" width="360" height="405" role="img" aria-label="Kuşanılan eşyalarıyla kahraman"></canvas>\n          {1}\n        </div>\n        <div class="inv-doll-col">{2}</div>\n      </div>\n      <button class="inv-btn gold wide" data-action="equip-best">✦ En Güçlüleri Kuşan</button>\n      <div class="inv-loadouts" aria-label="Kayıtlı takımlar">\n        {3}\n      </div>\n      <h4>Donanım katkısı</h4>\n      {4}\n    </section>', LEFT_SLOTS.map((id) => this.slotButton(SLOT_BY_ID[id])).join(''), this.slotButton(SLOT_BY_ID.charm), RIGHT_SLOTS.map((id) => this.slotButton(SLOT_BY_ID[id])).join(''), [0, 1, 2].map((i) => {
          const saved = state.heroLoadouts?.[i];
          return tr('<div class="inv-loadout">\n            <button class="inv-btn" data-action="loadout-use" data-index="{0}" {1} title="{2}">Takım {3}</button>\n            <button class="inv-btn mini" data-action="loadout-save" data-index="{4}" title="Şu an kuşanılanları Takım {5} olarak kaydet" aria-label="Takım {6} kaydet">⤓</button>\n          </div>', i, saved ? '' : 'disabled', saved ? tr('Bu takımı kuşan') : tr('Henüz kaydedilmedi'), i + 1, i, i + 1, i + 1);
        }).join(''), totals.length
        ? `<ul class="inv-stat-list">${totals.map((stat) => `<li>${describeHeroStat(stat, bonuses[stat])}</li>`).join('')}</ul>`
        : tr('<p class="inv-muted">Henüz eşya kuşanmadın.</p>'));
  }

  renderGrid() {
    const { state } = this.game;
    const worn = this.wornIds;
    const items = this.items.slice().reverse();
    const sorters = {
      new: () => 0,
      power: (a, b) => this.powerOf(b) - this.powerOf(a),
      rarity: (a, b) => RARITY_RANK[getHeroItemRarity(b).id] - RARITY_RANK[getHeroItemRarity(a).id] || b.level - a.level,
      slot: (a, b) => SLOT_RANK[getHeroItemSlot(a).id] - SLOT_RANK[getHeroItemSlot(b).id] || this.powerOf(b) - this.powerOf(a),
    };
    const shown = items
      .filter((item) => this.slotFilter === 'all' || getHeroItemSlot(item)?.id === this.slotFilter)
      .sort(sorters[this.sort] ?? sorters.new);
    const capacity = inventoryCapacity(state);
    const upgrades = items.filter((item) => this.isUpgrade(item)).length;
    const expand = quote(state, SLOT_UPGRADE);
    const gain = expand.maxed ? 0 : UPGRADE_BY_ID[SLOT_UPGRADE].stat(levelOf(state, SLOT_UPGRADE) + expand.n) - capacity;
    const cost = displayCost(SLOT_UPGRADE, expand.cost);

    const cells = shown.map((item) => {
      const template = getHeroItemTemplate(item);
      const rarity = getHeroItemRarity(item);
      const set = getHeroItemSet(item);
      const up = this.isUpgrade(item);
      const on = worn.has(item.id);
      const selected = item.id === this.selectedItemId;
      return `<button class="inv-cell${selected ? ' selected' : ''}${on ? ' worn' : ''}" style="--rarity:${rarity.color}" data-action="select" data-item-id="${item.id}" aria-pressed="${selected}" aria-label="${template.name}, ${rarity.name}, seviye ${item.level}${set ? tr(', {0} seti', set.name) : ''}${on ? tr(', kuşanılı') : ''}${up ? tr(', kuşanılandan güçlü') : ''}${item.locked ? tr(', kilitli') : ''}" title="${template.name}">
        ${itemIcon(item, 'inv-cell-icon')}<i class="lv">+${item.level}</i>${on ? '<i class="tag on">K</i>' : up ? '<i class="tag up">▲</i>' : ''}${set ? '<i class="tag set">⬢</i>' : ''}${item.fresh ? tr('<i class="tag new">YENİ</i>') : ''}${item.locked ? '<i class="tag lock">🔒</i>' : ''}
      </button>`;
    });
    // In the unfiltered bag the empty cells show how much room is left
    const empty = this.slotFilter === 'all' ? Math.max(0, capacity - shown.length) : 0;

    return tr('<section class="inv-panel inv-items" aria-label="Çanta">\n      <div class="inv-filter" role="group" aria-label="Yuvaya göre süz">\n        <button class="inv-chip{0}" data-action="filter" data-slot="all">Tümü</button>\n        {1}\n      </div>\n      <div class="inv-row">\n        <label class="inv-field">Sırala <select data-view="sort">{2}</select></label>\n        {3}\n      </div>\n      <div class="inv-grid-scroll"><div class="inv-grid">{4}{5}{6}</div></div>\n      <div class="inv-capacity">\n        <div class="inv-bar"><span style="width:{7}%"></span></div>\n        <span>{8} / {9}{10}</span>\n        <button class="inv-btn" data-action="expand-slots" {11} title="Ruh Taşı ile çanta genişlet">{12}</button>\n      </div>\n      <p class="inv-legend"><b>▲</b> kuşanılandan güçlü · <b>K</b> kuşanılı · <b>⬢</b> set parçası · çift tıkla: kuşan</p>\n    </section>', this.slotFilter === 'all' ? ' on' : '', HERO_ITEM_SLOTS.map((slot) => `<button class="inv-chip icon${this.slotFilter === slot.id ? ' on' : ''}" data-action="filter" data-slot="${slot.id}" title="${slot.name}" aria-label="${slot.name}">${iconHtml('🏹', 'inv-chip-icon', slot.art)}</button>`).join(''), SORTS.map(([v, label]) => `<option value="${v}" ${this.sort === v ? 'selected' : ''}>${label}</option>`).join(''), upgrades ? tr('<span class="inv-up-hint">▲ {0} daha güçlü eşya</span>', upgrades) : '', cells.join(''), '<span class="inv-cell-empty"></span>'.repeat(empty), shown.length ? '' : tr('<p class="inv-muted inv-grid-note">Bu yuvada eşya yok.</p>'), Math.min(100, (items.length / capacity) * 100), items.length, capacity, items.length >= capacity ? tr(' · dolu') : '', !expand.maxed && state.souls >= cost ? '' : 'disabled', expand.maxed ? tr('En geniş') : tr('+{0} yuva · 💎 {1}', gain, fmt(cost)));
  }

  renderDetail() {
    const { state } = this.game;
    const selected = this.items.find((item) => item.id === this.selectedItemId);
    if (!selected) {
      return tr('<section class="inv-panel inv-detail empty" aria-label="Seçili eşya">\n        <h4>Eşya seç</h4>\n        <p class="inv-muted">Bir eşyaya tıkla; özelliklerini gör ve kuşandığınla karşılaştır.</p>\n        <ul class="inv-tips">\n          <li>Düşmanlar nadiren, patronlar sık sık eşya düşürür.</li>\n          <li>Satılan eşyalar altın ve Öz verir.</li>\n          <li>Sınıf yükseldikçe eşya fazladan özellik kazanır.</li>\n        </ul>\n      </section>');
    }
    const template = getHeroItemTemplate(selected);
    const slot = getHeroItemSlot(selected);
    const rarity = getHeroItemRarity(selected);
    const set = getHeroItemSet(selected);
    const worn = this.wornIn(slot.id);
    const isWorn = worn?.id === selected.id;
    const maxed = selected.level >= HERO_ITEM_MAX_LEVEL;
    const upgradeCost = heroItemUpgradeCost(selected);
    const reforgeCost = heroItemReforgeCost(selected);
    const setInfo = set && getHeroSetProgress(state).find((entry) => entry.id === set.id);

    return tr('<section class="inv-panel inv-detail" style="--rarity:{0}" aria-label="Seçili eşya">\n      <header class="inv-item-head">\n        {1}\n        <div><h3>{2}</h3><small>{3} · {4}</small><small>Güç {5}</small></div>\n      </header>\n      <div class="inv-levels" title="Seviye {6} / {7}" aria-label="Seviye {8} / {9}">{10}</div>\n      <ul class="inv-item-stats">{11}</ul>\n      {12}\n      {13}\n      <div class="inv-actions">\n        {14}\n        <button class="inv-btn wide" data-action="upgrade" data-item-id="{15}" {16}>{17}</button>\n        {18}\n        <button class="inv-btn" data-action="sell" data-item-id="{19}" {20}>{21}</button>\n        <button class="inv-btn" data-action="lock" data-item-id="{22}" aria-pressed="{23}">{24}</button>\n      </div>\n    </section>', rarity.color, itemIcon(selected, 'inv-item-art'), template.name, rarity.name, slot.name, this.powerOf(selected), selected.level, HERO_ITEM_MAX_LEVEL, selected.level, HERO_ITEM_MAX_LEVEL, Array.from({ length: HERO_ITEM_MAX_LEVEL }, (_, i) => `<i class="${i < selected.level ? 'on' : ''}"></i>`).join(''), heroItemStatList(selected).map(({ stat, value, main }) => `<li class="${main ? 'main' : ''}">${describeHeroStat(stat, value)}</li>`).join(''), isWorn ? '' : this.renderCompare(selected, worn, slot), setInfo ? tr('<p class="inv-set-line" style="--set:{0}">⬢ {1} · {2} / {3} kuşanılı</p>', set.color, set.name, setInfo.count, set.pieces.length) : '', isWorn
          ? tr('<button class="inv-btn wide" data-action="unequip" data-slot="{0}">Çıkar</button>', slot.id)
          : `<button class="inv-btn gold wide" data-action="equip" data-item-id="${selected.id}">${worn ? tr('Değiştir') : tr('Kuşan')}</button>`, selected.id, !maxed && state.gold >= upgradeCost ? '' : 'disabled', maxed ? tr('En yüksek seviye') : tr('Geliştir · {0} altın', fmt(upgradeCost)), reforgeCost ? tr('<button class="inv-btn wide" data-action="reforge" data-item-id="{0}" {1} title="Ek özellikleri yeniden belirler">Yeniden Döv · {2} Öz</button>', selected.id, (state.heroEssence ?? 0) >= reforgeCost ? '' : 'disabled', reforgeCost) : '', selected.id, isWorn || selected.locked ? 'disabled' : '', isWorn ? tr('Kuşanılı') : selected.locked ? tr('Kilitli') : tr('Sat · {0}', fmt(heroItemSellValue(selected))), selected.id, !!selected.locked, selected.locked ? tr('Kilidi Aç') : tr('Kilitle'));
  }

  /** Stat by stat against the piece worn in that slot. */
  renderCompare(item, worn, slot) {
    const mine = heroItemModifier(item);
    const theirs = worn ? heroItemModifier(worn) : {};
    const rows = Object.keys(HERO_STAT_LABELS)
      .map((stat) => [stat, mine[stat] - (theirs[stat] ?? 0)])
      .filter(([, diff]) => Math.abs(diff) > 1e-6)
      .sort((a, b) => b[1] - a[1]);
    const diff = this.powerOf(item) - (worn ? this.powerOf(worn) : 0);
    return tr('<div class="inv-compare">\n      <h4>{0}</h4>\n      <ul>{1}</ul>\n      <b class="{2}">{3}{4} güç</b>\n    </div>', worn ? tr('Kuşanılı: {0}', getHeroItemTemplate(worn).name) : tr('{0} yuvası boş', slot.name), rows.map(([stat, value]) => `<li class="${value > 0 ? 'better' : 'worse'}">${value > 0 ? '▲' : '▼'} ${describeHeroStat(stat, Math.abs(value)).replace(/^\+/, value > 0 ? '+' : '-')}</li>`).join(''), diff > 0 ? 'better' : diff < 0 ? 'worse' : '', diff > 0 ? '+' : '', diff);
  }

  renderForge() {
    const { state } = this.game;
    const essence = state.heroEssence ?? 0;
    const fuse = this.fuseItems();
    const cost = heroFuseCost(this.fuseRarity);
    const next = HERO_ITEM_RARITIES[RARITY_RANK[this.fuseRarity] + 1];
    const bulk = this.bulkItems();
    const bulkGold = bulk.reduce((sum, item) => sum + heroItemSellValue(item), 0);
    const bulkEssence = bulk.reduce((sum, item) => sum + heroItemEssence(item), 0);
    const autoRank = state.settings.autoSellRank ?? 0;
    const rarityChips = HERO_ITEM_RARITIES.slice(0, -1).map((rarity) => {
      const count = this.spareItems.filter((item) => getHeroItemRarity(item).id === rarity.id).length;
      return `<button class="inv-chip${this.fuseRarity === rarity.id ? ' on' : ''}" style="--rarity:${rarity.color}" data-action="fuse-rarity" data-rarity="${rarity.id}">${rarity.name} <small>${count}</small></button>`;
    }).join('');
    const fuseCells = Array.from({ length: FUSE_COUNT }, (_, i) => {
      const item = fuse[i];
      if (!item) return '<span class="inv-cell-empty big"></span>';
      return `<span class="inv-cell static" style="--rarity:${getHeroItemRarity(item).color}" title="${getHeroItemTemplate(item).name}">${itemIcon(item, 'inv-cell-icon')}<i class="lv">+${item.level}</i></span>`;
    }).join('<b class="inv-plus">+</b>');

    return tr('<div class="inv-forge">\n      <section class="inv-panel">\n        <h3>Birleştir</h3>\n        <p class="inv-muted">Aynı sınıftan {0} eşyayı bir üst sınıftan rastgele bir eşyaya dönüştür. En zayıf yedek parçalar kullanılır; kuşanılı ve kilitli olanlara dokunulmaz.</p>\n        <div class="inv-filter">{1}</div>\n        <div class="inv-fuse-row">{2}<b class="inv-plus">→</b><span class="inv-fuse-result" style="--rarity:{3}">{4}</span></div>\n        <button class="inv-btn gold wide" data-action="fuse" {5}>Birleştir · {6} Öz</button>\n        <p class="inv-muted">{7}</p>\n      </section>\n      <section class="inv-panel">\n        <h3>Toplu Satış</h3>\n        <p class="inv-muted">Yer açmak için seçtiğin sınıf ve altındaki yedek eşyaları tek seferde sat. Kuşanılı ve kilitli eşyalar korunur.</p>\n        <label class="inv-field">Satılacaklar <select data-view="bulkRank">{8}</select></label>\n        <p class="inv-sum"><b>{9}</b> eşya · <span class="gold">+{10} altın</span> · {11}</p>\n        <button class="inv-btn wide{12}" data-action="bulk-sell" {13}>{14}</button>\n        <h3>Otomatik Satış</h3>\n        <p class="inv-muted">Düşen eşyalar çantaya girmeden satılsın. Set parçaları ve ilk kez bulunan eşyalar her zaman çantaya gelir.</p>\n        <label class="inv-field">Otomatik sat <select data-view="autoSell">{15}</select></label>\n      </section>\n    </div>', FUSE_COUNT, rarityChips, fuseCells, next.color, next.name, fuse.length === FUSE_COUNT && essence >= cost ? '' : 'disabled', cost, fuse.length < FUSE_COUNT ? tr('{0} eşya daha gerekli.', FUSE_COUNT - fuse.length) : essence < cost ? tr('{0} Öz daha gerekli.', cost - essence) : tr('Hazır.'), HERO_ITEM_RARITIES.map((rarity, i) => `<option value="${i}" ${this.bulkRank === i ? 'selected' : ''}>${i ? tr('{0} ve altı', rarity.name) : rarity.name}</option>`).join(''), bulk.length, fmt(bulkGold), essenceLabel(bulkEssence), this.bulkConfirm ? ' danger' : '', bulk.length ? '' : 'disabled', this.bulkConfirm ? tr('Emin misin? {0} eşyayı sat', bulk.length) : tr('Toplu Sat'), AUTO_SELL.map((label, i) => `<option value="${i}" ${autoRank === i ? 'selected' : ''}>${label}</option>`).join(''));
  }

  renderSets() {
    const { state } = this.game;
    const owned = new Set(this.items.map((item) => item.templateId));
    return `<div class="inv-sets">${getHeroSetProgress(state).map((set) => tr('\n      <section class="inv-panel inv-set" style="--set:{0}">\n        <header><h3>⬢ {1}</h3><b>{2} / {3}</b></header>\n        <div class="inv-bar set"><span style="width:{4}%"></span></div>\n        <ul class="inv-set-tiers">{5}</ul>\n        <div class="inv-set-pieces">{6}</div>\n        <button class="inv-btn wide" data-action="set-equip" data-set="{7}" {8}>Eldeki Parçaları Kuşan</button>\n      </section>', set.color, set.name, set.count, set.pieces.length, (set.count / set.pieces.length) * 100, set.tiers.map((tier) => tr('<li class="{0}"><b>{1} parça</b> {2}</li>', tier.active ? 'on' : '', tier.need, describeSetBonus(tier.bonus))).join(''), set.pieces.map((id) => {
          const state2 = set.worn.has(id) ? 'worn' : owned.has(id) ? 'owned' : '';
          return `<span class="${state2}" title="${state2 === 'worn' ? tr('Kuşanılı') : state2 === 'owned' ? tr('Çantada') : tr('Henüz yok')}">${HERO_ITEM_TEMPLATES[id].name}</span>`;
        }).join(''), set.id, set.pieces.some((id) => owned.has(id)) ? '' : 'disabled')).join('')}</div>`;
  }

  renderCodex() {
    const { state } = this.game;
    const codex = codexProgress(state);
    const found = state.heroCodex ?? {};
    const groups = HERO_ITEM_SLOTS.map((slot) => {
      const entries = Object.entries(HERO_ITEM_TEMPLATES).filter(([, template]) => template.slot === slot.id);
      return `<section class="inv-codex-group">
        <h4>${slot.name}</h4>
        <div>${entries.map(([id, template]) => {
          const rank = found[id];
          if (rank == null) return '<span class="inv-codex-item unknown" title="Henüz bulunmadı">?</span>';
          const rarity = HERO_ITEM_RARITIES[rank];
          return `<span class="inv-codex-item" style="--rarity:${rarity.color}" title="${template.name} · en iyi: ${rarity.name}">${iconHtml('🏹', 'inv-cell-icon', template.art)}</span>`;
        }).join('')}</div>
      </section>`;
    }).join('');
    return tr('<div class="inv-codex">\n      <section class="inv-panel inv-codex-head">\n        <div><h3>Koleksiyon</h3><p class="inv-muted">Her yeni eşya türü kahramana kalıcı olarak +%{0} hasar verir. Eşyayı satsan da sayılır.</p></div>\n        <div class="inv-codex-score"><b>{1} / {2}</b><small>+%{3} hasar</small></div>\n        <div class="inv-bar"><span style="width:{4}%"></span></div>\n      </section>\n      <div class="inv-codex-grid">{5}</div>\n    </div>', (codex.perPiece * 100).toFixed(1), codex.found, codex.total, (codex.damage * 100).toFixed(1), (codex.found / codex.total) * 100, groups);
  }
}
