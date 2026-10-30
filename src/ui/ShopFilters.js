import { h, setText, toggleClass } from './dom.js';
import { tip } from './Tooltip.js';
import { BRANCHES } from '../units/roster.js';
import { VILLAGE_SITES } from '../config/village.js';
import { ACHIEVEMENT_GROUPS } from '../config/achievements.js';
import { PET_ROLES } from '../config/pets.js';
import { language, tr } from '../i18n/i18n.js';

const CARD_STATUS = [
  ['all', tr('Tümü'), tr('Bu sekmedeki her şey')],
  ['owned', tr('Satın alınan'), tr('En az bir seviye aldıkların')],
  ['afford', tr('Alınabilir'), tr('Şu an paranın yettikleri')],
  ['unowned', tr('Alınmamış'), tr('Henüz hiç seviye almadıkların')],
  ['locked', tr('Kilitli'), tr('Aşama ya da ön koşul bekleyenler')],
  ['maxed', tr('Tamamlanan'), tr('En yüksek seviyeye ulaşanlar')],
  ['fav', tr('★ Favoriler'), tr('Kartın üstündeki yıldızla işaretlediklerin')],
];
const FEAT_STATUS = [
  ['all', tr('Tümü'), tr('Bütün başarımlar')],
  ['progress', tr('Devam eden'), tr('Henüz tamamlanmayanlar')],
  ['done', tr('Tamamlanan'), tr('Ödülünü aldıkların')],
];
const SORTS = [
  ['default', tr('Varsayılan')],
  ['cheap', tr('En ucuz')],
  ['level', tr('En yüksek seviye')],
  ['name', 'A-Z'],
];
const FEAT_SORTS = [
  ['default', tr('Varsayılan')],
  ['near', tr('Bitmeye yakın')],
  ['name', 'A-Z'],
];

const byIds = (id, label, ...ids) => ({ id, label, match: (u) => ids.includes(u.id) });

/** Second row of chips per tab: narrows the list by what a card is about. */
const CATEGORIES = {
  hero: [
    byIds('attack', tr('Saldırı'), 'heroDamage', 'heroCrit', 'heroCritDmg', 'heroMulti', 'heroPierce', 'heroBurn'),
    byIds('speed', tr('Hız'), 'heroRate', 'heroAuto'),
    byIds('skill', tr('Ok Yağmuru'), 'heroRain', 'heroRainCd'),
  ],
  castle: [
    byIds('defense', tr('Savunma'), 'castleHp', 'castleRegen', 'castleArmor', 'castleStores', 'castleBell'),
    byIds('attack', tr('Saldırı'), 'castleThorns', 'castleOil', 'castleCatapult', 'castleBeacon'),
    byIds('economy', tr('Hazine'), 'castleGold', 'castleInterest'),
    byIds('outer', tr('Dış Sur'), 'castleOuterWall', 'castleOuterGate', 'castleOuterArchers'),
  ],
  souls: [
    byIds('combat', tr('Savaş'), 'soulPower', 'soulHaste', 'soulCrit', 'soulBoss', 'soulWalls'),
    byIds('economy', tr('Ekonomi'), 'soulGold', 'soulVillage', 'soulDrop', 'soulGems'),
    byIds('journey', tr('Yolculuk'), 'soulStart', 'soulSkip', 'soulTime', 'soulHarvest', 'soulMemory', 'soulInventory'),
  ],
  pets: PET_ROLES.map((r) => ({ id: r.id, label: r.name, match: (u) => u.role === r.id })),
  allies: BRANCHES.map((b) => ({ id: b.id, label: b.name, match: (u) => u.branch === b.id })),
  village: VILLAGE_SITES.map((site) => ({ id: site.key, label: site.name, match: (u) => u.site === site.key })),
  skills: [
    { id: 'active', label: tr('Aktif'), match: (u) => !u.talent },
    { id: 'tree', label: tr('Yetenek Ağacı'), match: (u) => !!u.talent },
  ],
  feats: ACHIEVEMENT_GROUPS.map((g) => ({ id: g.id, label: g.name, match: (a) => a.group === g.id })),
  stats: [
    { id: 'power', label: tr('Savaş Gücü') },
    { id: 'enemy', label: tr('Düşman') },
    { id: 'village', label: tr('Köy') },
    { id: 'session', label: tr('Bu Oturum') },
    { id: 'progress', label: tr('İlerleme') },
  ],
};

/**
 * The row of filters above the cards: status chips with live counts, category chips, search
 * and sort. Each tab remembers its own choices; ShopPanel decides what they hide.
 */
export class ShopFilters {
  constructor(game, onChange) {
    this.game = game;
    this.onChange = onChange;
    this.tab = 'hero';
    this.search = '';
    this.statusChips = [];
    this.statusRow = h('div.filter-row', { role: 'group', 'aria-label': tr('Duruma göre süz') });
    this.catRow = h('div.filter-row.cats', { role: 'group', 'aria-label': tr('Türe göre süz') });
    this.searchInput = h('input.filter-search', {
      type: 'search',
      placeholder: tr('Ara…'),
      'aria-label': tr('Bu sekmede ara'),
      oninput: () => {
        this.search = this.searchInput.value.trim().toLocaleLowerCase(language());
        this.onChange();
      },
      // Letters typed here must not reach the game's keyboard shortcuts
      onkeydown: (e) => {
        e.stopPropagation();
        if (e.key === 'Escape') this.clearSearch();
      },
    });
    this.sortSelect = h('select.filter-sort', {
      'aria-label': tr('Sıralama'),
      onchange: () => this.set('sort', this.sortSelect.value),
    });
    this.resetBtn = tip(h('button.filter-reset', { 'aria-label': tr('Filtreleri temizle'), onclick: () => this.reset() }, '✕'), tr('Filtreleri temizle'));
    this.el = h('div.shop-filters', this.statusRow, this.catRow, h('div.filter-end', this.resetBtn, this.searchInput, this.sortSelect));
  }

  get views() {
    return (this.game.state.settings.shopView ??= {});
  }

  /** This tab's choices, filled with defaults. */
  get view() {
    return { status: 'all', cat: 'all', sort: 'default', ...this.views[this.tab] };
  }

  set(key, value) {
    this.views[this.tab] = { ...this.view, [key]: value };
    this.paint();
    this.onChange();
  }

  clearSearch() {
    this.search = '';
    this.searchInput.value = '';
    this.onChange();
  }

  reset() {
    this.views[this.tab] = {};
    this.search = '';
    this.searchInput.value = '';
    this.setTab(this.tab);
    this.onChange();
  }

  setTab(tab) {
    this.tab = tab;
    this.search = '';
    this.searchInput.value = '';
    const statuses = tab === 'stats' ? [] : tab === 'feats' ? FEAT_STATUS : CARD_STATUS;
    this.statusChips = statuses.map(([id, label, hint]) => {
      const count = h('small');
      const el = tip(h('button.filter-chip', { onclick: () => this.set('status', id) }, label, count), hint);
      return { id, el, count };
    });
    this.statusRow.replaceChildren(...this.statusChips.map((c) => c.el));
    this.cats = CATEGORIES[tab] ?? [];
    this.catChips = this.cats.length
      ? [{ id: 'all', label: tr('Hepsi') }, ...this.cats].map(({ id, label }) => ({ id, el: h('button.filter-chip.cat', { onclick: () => this.set('cat', id) }, label) }))
      : [];
    this.catRow.replaceChildren(...this.catChips.map((c) => c.el));
    const sorts = tab === 'stats' ? [] : tab === 'feats' ? FEAT_SORTS : SORTS;
    this.sortSelect.replaceChildren(...sorts.map(([id, label]) => h('option', { value: id }, label)));
    this.sortSelect.style.display = sorts.length ? '' : 'none';
    this.searchInput.style.display = tab === 'stats' ? 'none' : '';
    this.paint();
  }

  paint() {
    const { status, cat, sort } = this.view;
    for (const c of this.statusChips) {
      toggleClass(c.el, 'on', c.id === status);
      c.el.setAttribute('aria-pressed', String(c.id === status));
    }
    for (const c of this.catChips) {
      toggleClass(c.el, 'on', c.id === cat);
      c.el.setAttribute('aria-pressed', String(c.id === cat));
    }
    this.sortSelect.value = sort;
  }

  /** counts: status id → number of items it would show. */
  setCounts(counts) {
    for (const c of this.statusChips) setText(c.count, c.id === 'all' ? '' : String(counts[c.id] ?? 0));
    const { status, cat, sort } = this.view;
    toggleClass(this.resetBtn, 'hidden', status === 'all' && cat === 'all' && sort === 'default' && !this.search);
  }

  /** Whether an upgrade or achievement passes the category and search boxes. */
  matchesCommon(item, name, extra = '') {
    const { cat } = this.view;
    if (cat !== 'all' && !this.cats.find((c) => c.id === cat)?.match?.(item)) return false;
    if (!this.search) return true;
    return `${name} ${extra}`.toLocaleLowerCase(language()).includes(this.search);
  }
}
