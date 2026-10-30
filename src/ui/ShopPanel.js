import { h, setText, toggleClass } from './dom.js';
import { tip } from './Tooltip.js';
import { fmt, pct, fmtTime } from '../utils/format.js';
import { computeStats, estimateDps, VILLAGE_CHAINS } from '../systems/Stats.js';
import { waveSize } from '../systems/WaveManager.js';
import { ENEMY_TYPES, waveScaling, isBossWave, bossForWave } from '../config/enemies.js';
import {
  HERO_UPGRADES, CASTLE_UPGRADES, ALLY_UPGRADES, VILLAGE_UPGRADES, SOUL_UPGRADES, UPGRADE_BY_ID,
  PRESTIGE_MIN_WAVE, MAX_WORKERS, soulsForWave, nextSoulWave, nextMilestone,
} from '../config/upgrades.js';
import { VILLAGE_SITES } from '../config/village.js';
import { quote, purchase, levelOf, walletOf, displayCost, maxLevel, currencyIcon, inventoryCapacity } from '../systems/Economy.js';
import { ACTIVE_SKILLS, TALENTS, TALENT_BRANCHES, TALENT_TIERS, GEM_SOURCES } from '../config/skills.js';
import { saveState } from '../core/State.js';
import { FORTRESS_TIERS } from '../core/constants.js';
import { iconNode } from './icons.js';
import { ShopFilters } from './ShopFilters.js';
import { OATHS, oathById } from '../config/oaths.js';
import { PET_UPGRADES } from '../config/pets.js';
import { drawPet } from '../render/petArt.js';
import { ACHIEVEMENTS, ACHIEVEMENT_GROUPS, GLORY_RANKS, achievementCount, gloryPercent, gloryPoints, gloryRank, medalOf } from '../config/achievements.js';
import { UNITS, UNIT_BY_KIND, UNITS_BY_BRANCH, BRANCHES, BRANCH_MASTERY, RANK_BONUS, rankOf, nextRank } from '../units/roster.js';
import { language, tr } from '../i18n/i18n.js';

const TABS = [
  { id: 'hero', icon: '🏹', art: 'bow', label: tr('Kahraman'), key: 'Q', list: HERO_UPGRADES, hint: tr('Okçu kahramanın hasarı, hızı ve yetenekleri') },
  { id: 'castle', icon: '🏰', art: 'castle', label: tr('Kale'), key: 'W', list: CASTLE_UPGRADES, hint: tr('Duvarların canı, onarımı, zırhı ve hazine') },
  { id: 'allies', icon: '⚔️', art: 'sword-shield', label: tr('Birlikler'), key: 'E', list: ALLY_UPGRADES, hint: tr('Destek birliklerini kirala ve güçlendir') },
  { id: 'village', icon: '🏘️', art: 'village', label: tr('Köy'), key: 'R', list: VILLAGE_UPGRADES, hint: tr('Üretim zincirlerini kur; taş ustaları kalenin onarımına destek olsun') },
  { id: 'souls', icon: '💎', art: 'soul-crystal', label: tr('Ruh'), key: 'T', list: SOUL_UPGRADES, hint: tr('Yeniden Doğuş ve kalıcı Ruh geliştirmeleri') },
  { id: 'pets', icon: '🐾', label: tr('Yoldaşlar'), key: 'O', list: PET_UPGRADES, hint: tr('Öz ile yoldaş sahiplen ve büyüt: savaşır, pasif bonus verir, Yeniden Doğuş\'ta kalır') },
  { id: 'skills', icon: '✨', art: 'spellbook', label: tr('Yetenekler'), key: 'Y', list: [...ACTIVE_SKILLS, ...TALENTS], hint: tr('Elmas ile aktif yetenekler ve kalıcı yetenek ağacı') },
  { id: 'stats', icon: '📊', art: 'gears', label: tr('İstatistik'), key: 'U', list: [], hint: tr('Hasar dökümü, düşman bilgisi ve ilerleme') },
  { id: 'feats', icon: '🏆', art: 'medal', label: tr('Başarımlar'), key: 'I', list: [], hint: tr('Hedefler: her biri Elmas ve kalıcı Şan (hasar ve altın) verir') },
];
// Tabs without upgrade cards: the buy tools are hidden there
const INFO_TABS = new Set(['stats', 'feats']);
const SOULS_TAB = TABS.findIndex((t) => t.id === 'souls');

/** Allies and village buildings start "not owned" at level 0; everything else is owned. */
const isOwned = (u, level) => level > 0 || !(u.kind || u.role === 'building' || u.skill || u.hire);
const firstBuyVerb = (u) => (u.role === 'building' ? tr('kur') : u.skill ? tr('aç') : u.currency === 'heroEssence' ? tr('sahiplen') : tr('kirala'));
const AMOUNTS = [1, 10, 'max'];
const AMOUNT_HINT = { 1: tr('Her tıklamada 1 seviye al'), 10: tr('Her tıklamada 10 seviye al'), max: tr('Paranın yettiği kadar seviye al') };
// Tabs that mark their best-value upgrade, and what "value" means there (gain per gold)
const BEST_METRIC = { hero: 'dps', allies: 'dps', village: 'village' };
const BEST_EVERY = 1000; // ms between re-evaluations (each one simulates every card's purchase)

/** Bottom panel: tabbed upgrade shop, prestige and statistics. Built once, patched in refresh(). */
export class ShopPanel {
  constructor(root, game, { onPrestige, onOpenInventory, onHelp }) {
    this.root = root;
    this.game = game;
    this.tab = 'hero';
    this.cards = [];
    const s = game.state;

    this.tabBtns = TABS.map((t) => {
      const count = h('span.tab-count');
      const btn = h('button.tab', { 'aria-label': t.label, 'aria-pressed': String(t.id === this.tab), onclick: () => this.setTab(t.id) }, iconNode(t.icon, 'tab-icon', t.art), h('span.tab-label', t.label), count);
      btn._count = count;
      return tip(btn, () => ({ icon: t.icon, iconArt: t.art, title: t.label, badge: t.key, desc: t.hint, foot: this.affordCount?.[t.id] ? tr('{0} geliştirme alınabilir', this.affordCount[t.id]) : '', footClass: 'good' }));
    });
    this.inventoryCount = h('span.tab-count');
    this.inventoryBtn = tip(h('button.tab.inventory-tab', {
      'aria-label': tr('Envanteri aç'),
      'aria-haspopup': 'dialog',
      onclick: onOpenInventory,
    }, iconNode('🎒', 'tab-icon', 'treasure'), h('span.tab-label', tr('Envanter')), this.inventoryCount), () => ({
      icon: '🎒', iconArt: 'treasure', title: tr('Envanter'), badge: tr('{0} / {1} eşya', s.heroInventory?.length ?? 0, inventoryCapacity(s)),
      desc: tr('Kahramanını ve kuşanma yuvalarını görüntüle; eşyalarını buradan yönet.'),
    }));

    this.amountBtns = AMOUNTS.map((a) =>
      tip(h('button.seg', {
        'aria-label': a === 'max' ? tr('Alabileceğim kadar seviye al') : tr('Her tıklamada {0} seviye al', a),
        'aria-pressed': String(s.settings.buyAmount === a),
        onclick: () => { s.settings.buyAmount = a; this.refresh(); },
      }, a === 'max' ? 'MAX' : `x${a}`), AMOUNT_HINT[a]),
    );
    this.buyAllBtn = tip(h('button.tool.buy-all', { onclick: () => this.buyAll() }, iconNode('⚡', 'tool-art'), tr('Tümünü Al')), () => ({
      title: tr('Tümünü Al'), badge: 'A',
      desc: tr('Paranın yettiği sürece görünen kartlardan en ucuzunu tekrar tekrar alır. Filtre seçiliyse yalnızca listelenenlere harcar.'),
    }));
    this.helpBtn = tip(h('button.tool', { 'aria-label': tr('Nasıl oynanır'), onclick: onHelp }, '❔'), tr('Nasıl Oynanır'));
    this.collapseBtn = tip(h('button.tool.collapse', {
      'aria-label': s.settings.panelCollapsed ? tr('Geliştirme menüsünü aç') : tr('Geliştirme menüsünü küçült'),
      'aria-expanded': String(!s.settings.panelCollapsed),
      'aria-controls': 'upgrade-panel-body',
      onclick: () => this.toggleCollapse(),
    }), () => (s.settings.panelCollapsed ? tr('Menüyü aç (H)') : tr('Menüyü küçült — savaş alanı büyür (H)')));

    this.grids = {};
    for (const t of TABS) {
      if (!t.list.length) continue;
      if (t.id === 'skills') {
        this.grids.skills = this.buildSkillsView();
        continue;
      }
      if (t.id === 'village') {
        this.grids.village = this.buildVillageView();
        continue;
      }
      if (t.id === 'allies') {
        this.grids.allies = this.buildArmyView();
        continue;
      }
      if (t.id === 'pets') {
        this.grids.pets = this.buildPetsView();
        continue;
      }
      const grid = h('div.grid');
      for (const u of t.list) grid.append(this.buildCard(u, t.id));
      this.grids[t.id] = grid;
    }

    this.pills = h('div.pills');
    this.filters = new ShopFilters(game, () => {
      saveState(s);
      this.applyFilters();
    });
    this.emptyNote = h('div.filter-empty', tr('Bu filtreye uyan bir şey yok.'));
    this.buildPrestige(onPrestige);
    this.buildStats();
    this.unseenFeats = 0;
    this.featsView = this.buildAchievements();

    this.panelHead = h('div.panel-head',
      h('div.tabs', ...this.tabBtns, this.inventoryBtn),
      h('div.tools', h('div.segmented', ...this.amountBtns), this.buyAllBtn, this.helpBtn, this.collapseBtn),
    );
    this.panelBody = h('div.panel-body', { id: 'upgrade-panel-body' }, this.filters.el, this.pills, this.prestigeBox, this.statsView, this.featsView, ...Object.values(this.grids), this.emptyNote);
    root.append(this.panelHead, this.panelBody);

    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const k = e.key.toUpperCase();
      const t = TABS.find((x) => x.key === k);
      if (t) this.setTab(t.id);
      else if (k === 'A') this.buyAll();
      else if (k === 'H') this.toggleCollapse();
    });

    this.session = { gold: s.totalGold, kills: s.kills, time: s.playTime };
    this.applyCollapse();
    this.setTab('hero', false);
  }

  /** Points the player at one card (Coach); null clears it. */
  highlight(step) {
    for (const [i, t] of TABS.entries()) toggleClass(this.tabBtns[i], 'coach-glow', t.id === step?.tab && this.tab !== t.id);
    for (const c of this.cards) toggleClass(c.card, 'coach-glow', c.u.id === step?.card);
  }

  // ---- filters ---------------------------------------------------------------

  /** Show what the filter row asks for on the current tab; called on every refresh. */
  applyFilters() {
    if (this.tab === 'feats') this.filterFeats();
    else if (this.tab === 'stats') this.filterStats();
    else this.filterCards();
  }

  filterCards() {
    const f = this.filters;
    const { status, sort } = f.view;
    const cards = this.cards.filter((c) => c.tabId === this.tab);
    const counts = {};
    const matches = (c, id) => id === 'all' || c.state?.[id];
    let shown = 0;
    for (const c of cards) {
      const common = f.matchesCommon(c.u, c.u.name, c.u.desc);
      if (common) for (const id of Object.keys(c.state ?? {})) if (c.state[id]) counts[id] = (counts[id] ?? 0) + 1;
      c.visible = common && matches(c, status);
      if (c.visible) shown++;
      // The talent tree keeps its shape: filtered-out nodes fade instead of leaving gaps
      const inTree = !!c.u.talent;
      toggleClass(c.card, 'filtered', !c.visible && !inTree);
      toggleClass(c.card, 'faded', !c.visible && inTree);
      c.card.style.order = this.sortRank(c, sort);
    }
    f.setCounts(counts);
    // Boxes around the cards go when nothing inside them is left
    for (const head of [...(this.siteHeads ?? []), ...(this.branchHeads ?? [])]) {
      if (head.group) toggleClass(head.group, 'filtered', !cards.some((c) => c.visible && head.group.contains(c.card)) && this.tabOwns(head.group));
    }
    toggleClass(this.marketGroup, 'filtered', this.tab === 'village' && !cards.some((c) => c.visible && this.marketGroup.contains(c.card)));
    const { cat } = f.view;
    toggleClass(this.skillSections.active, 'filtered', cat === 'tree');
    toggleClass(this.skillSections.tree, 'filtered', cat === 'active');
    toggleClass(this.emptyNote, 'on', !shown);
  }

  tabOwns(group) {
    return this.grids[this.tab]?.contains(group);
  }

  sortRank(c, sort) {
    const s = this.game.state;
    if (sort === 'cheap') {
      if (c.state.maxed || c.state.locked) return 1e9;
      return Math.min(1e8, Math.round(Math.log10(1 + displayCost(c.u.id, quote(s, c.u.id).cost)) * 1000));
    }
    if (sort === 'level') return -levelOf(s, c.u.id);
    if (sort === 'name') return this.nameRank[c.u.id] ?? 0;
    return 0;
  }

  get nameRank() {
    if (!this.nameRankCache) {
      const names = this.cards.map((c) => c.u).sort((a, b) => a.name.localeCompare(b.name, language()));
      this.nameRankCache = Object.fromEntries(names.map((u, i) => [u.id, i]));
    }
    return this.nameRankCache;
  }

  filterFeats() {
    const f = this.filters;
    const s = this.game.state;
    const { status, sort } = f.view;
    const counts = {};
    let shown = 0;
    for (const c of this.featCards) {
      const done = !!s.achievements?.[c.a.id];
      // Unearned secrets cannot be found by searching for them
      const hiddenSecret = c.a.secret && !done;
      const common = f.matchesCommon(c.a, hiddenSecret ? '???' : c.a.name, hiddenSecret ? '' : c.a.desc);
      if (common) counts[done ? 'done' : 'progress'] = (counts[done ? 'done' : 'progress'] ?? 0) + 1;
      const visible = common && (status === 'all' || (status === 'done') === done);
      toggleClass(c.card, 'filtered', !visible);
      if (visible) shown++;
      const near = done ? 2000 : -Math.round((Math.min(c.a.value(s), c.a.goal) / c.a.goal) * 1000);
      c.card.style.order = sort === 'near' ? near : sort === 'name' ? this.featNameRank(c.a) : 0;
    }
    for (const section of this.featSections) {
      toggleClass(section, 'filtered', !section.querySelector('.feat:not(.filtered)'));
    }
    f.setCounts(counts);
    toggleClass(this.emptyNote, 'on', !shown);
  }

  featNameRank(a) {
    this.featNames ??= ACHIEVEMENTS.map((x) => x.name).sort((x, y) => x.localeCompare(y, language()));
    return this.featNames.indexOf(a.name);
  }

  filterStats() {
    const { cat } = this.filters.view;
    for (const card of this.statCards) toggleClass(card, 'filtered', cat !== 'all' && card.dataset.section !== cat);
    this.filters.setCounts({});
    toggleClass(this.emptyNote, 'on', false);
  }

  toggleFavorite(u, entry) {
    const s = this.game.state;
    const favs = (s.settings.favorites ??= {});
    if (favs[u.id]) delete favs[u.id];
    else favs[u.id] = true;
    toggleClass(entry.fav, 'on', !!favs[u.id]);
    saveState(s);
    this.refresh();
  }

  // ---- cards ---------------------------------------------------------------

  buildCard(u, tabId) {
    const els = {
      lvl: h('span.lvl-badge'),
      now: h('span.now'),
      next: h('span.next'),
      cost: h('span.cost'),
      n: h('span.n'),
      prog: h('span.prog'),
      ms: h('span.ms'),
      rank: h('span.rank-stars'),
      barFill: h('span'),
    };
    const entry = { u, tabId, ...els };
    els.fav = tip(h('button.fav', {
      'aria-label': tr('{0}: favorilere ekle', u.name),
      onclick: (e) => { e.stopPropagation(); this.toggleFavorite(u, entry); },
    }, '★'), tr('Favori: üstteki filtreden hızlıca bulursun'));
    entry.fav = els.fav;
    toggleClass(els.fav, 'on', !!this.game.state.settings.favorites?.[u.id]);
    const capped = Number.isFinite(maxLevel(u));
    const btn = h('button.buy', { onclick: (e) => { e.stopPropagation(); this.buy(u.id, card); } }, els.prog, els.cost, els.n);
    const cls = (tabId === 'souls' ? '.soul' : '') + (u.currency === 'gems' ? '.gem' : '') + (u.special ? '.special' : '');
    const card = h(`div.card${cls}`,
      h('span.best-badge', tr('★ Önerilen')),
      els.fav,
      capped ? h('span.lvl-bar', els.barFill) : null,
      h('div.icon', iconNode(u.icon, 'icon-art', u.iconArt), els.lvl),
      h('div.info',
        h('div.name', h('span.name-text', u.name), UNIT_BY_KIND[u.kind] ? els.rank : null, els.ms),
        (els.stat = h('div.stat', els.now, h('span.arrow', '→'), els.next)),
      ),
      btn,
    );
    Object.assign(entry, { card, btn, stat: els.stat });
    tip(card, () => this.cardTip(entry));
    this.cards.push(entry);
    return card;
  }

  cardTip({ u, tabId }) {
    const s = this.game.state;
    const level = levelOf(s, u.id);
    const q = quote(s, u.id);
    const cost = displayCost(u.id, q.cost);
    const wallet = walletOf(s, u.id);
    const cur = currencyIcon(u);
    const hired = isOwned(u, level);
    const max = maxLevel(u);
    const rows = [];

    if (q.locked) {
      const stageLock = u.stage && s.bestWave < u.stage;
      return {
        icon: u.icon, iconArt: u.iconArt, title: u.name, badge: u.special ? tr('ÖZEL') : tr('Kilitli'),
        desc: u.desc + (u.info ? `<div class="tt-info">${u.info}</div>` : ''),
        rows: u.currency === 'gems' ? [[tr('Açma bedeli'), `💠 ${u.baseCost}`]] : [],
        foot: stageLock ? tr('Aşama kilidi: en iyi dalgan {0}, gereken {1}', s.bestWave, u.stage) : tr('Önce {0} gerekli', UPGRADE_BY_ID[u.requires].name),
        footClass: 'bad',
      };
    }

    const nowStat = u.stat(level);
    const nextStat = q.maxed ? null : u.stat(level + q.n);
    if (u.site) rows.push(...this.villageRows(u, level, q));
    if (u.rows) {
      if (u.site && u.role === 'building') {
        const before = this.game.stats.village[u.site].rate;
        let after = before;
        if (nextStat) {
          const projectedState = { ...s, levels: { ...s.levels, [u.id]: level + q.n } };
          after = computeStats(projectedState).village[u.site].rate;
        }
        rows.push([tr('İşçi başı'), nextStat ? tr('{0}/sn <span class="tt-arrow">→</span> <b>{1}/sn</b>', fmt(before), fmt(after)) : tr('{0}/sn', fmt(before))]);
      } else {
        const a = hired ? u.rows(nowStat) : null;
        const b = nextStat ? u.rows(nextStat) : null;
        (b ?? a).forEach((r, i) => {
          const before = a ? a[i][1] : '—';
          rows.push([r[0], b ? `${before} <span class="tt-arrow">→</span> <b>${b[i][1]}</b>` : before]);
        });
      }
    } else {
      rows.push([tr('Şimdi'), u.describe(nowStat)]);
      if (nextStat) rows.push([tr('Sonraki (+{0})', q.n), u.describe(nextStat), 'up']);
    }

    let foot = '';
    let footClass = '';
    if (q.maxed) {
      foot = tr('En yüksek seviyeye ulaşıldı');
      footClass = 'good';
    } else {
      rows.push(['---'], [tr('Maliyet'), `${cur} ${fmt(cost)}`]);
      if (wallet >= cost) {
        foot = hired ? tr('Tıkla ve satın al') : tr('Tıkla ve {0}', firstBuyVerb(u));
        footClass = 'good';
      } else {
        rows.push([tr('Eksik'), `${cur} ${fmt(cost - wallet)}`, 'bad']);
        const gps = s.goldPerSec;
        if (!u.currency && gps > 0) rows.push([tr('Tahmini süre'), fmtTime((cost - wallet) / gps)]);
        foot = { souls: tr('Ruh Taşı Yeniden Doğuş ile kazanılır'), gems: tr('Elmas: patron öldür, aşamalara ulaş'), heroEssence: tr('Öz: eşya satarak kazanılır') }[u.currency] ?? tr('Yeterli altın yok');
        footClass = 'bad';
      }
    }
    if (this.best?.c.u === u) {
      const what = BEST_METRIC[tabId] === 'village' ? tr('köy geliri') : tr('hasar');
      rows.push([tr('Önerilen'), tr('Altın başına en çok {0}: +{1}/sn', what, fmt(this.best.gain)), 'gold']);
    }
    const ms = nextMilestone(u, level);
    if (u.auto) rows.push([tr('Otomatik'), u.auto]);
    if (ms) rows.push([tr('Hedef'), tr('Sv {0}: {1} {2}', ms.level, ms.value, u.milestoneUnit ?? ''), 'gold']);
    if (UNIT_BY_KIND[u.kind] && hired) {
      const rank = rankOf(level);
      const next = nextRank(level);
      rows.push([tr('Rütbe'), `${rank.name}${rank.stars ? tr(' · +{0}% hasar', Math.round(rank.stars * RANK_BONUS * 100)) : ''}`, 'gold']);
      if (next) rows.push([tr('Sonraki rütbe'), tr('Sv {0}: {1}', next.level, next.name)]);
    }

    return {
      icon: u.icon,
      iconArt: u.iconArt,
      title: u.name,
      badge: hired ? tr('Sv {0}{1}', level, Number.isFinite(max) ? ` / ${max}` : '') : u.site ? tr('Kurulmadı') : u.skill ? (u.special ? tr('ÖZEL · Kilitli') : tr('Kilitli')) : tr('Kiralanmadı'),
      desc: u.desc + (u.info ? `<div class="tt-info">${u.info}</div>` : ''),
      rows,
      foot,
      footClass,
    };
  }

  /** Income rows for a village card: the site's total gold/s now and after the purchase. */
  villageRows(u, level, q) {
    const site = this.game.stats.village[u.site];
    const currentVillage = this.game.stats.village;
    const now = site.income;
    let projectedVillage = currentVillage;
    if (!q.maxed) {
      const projectedState = {
        ...this.game.state,
        levels: { ...this.game.state.levels, [u.id]: level + q.n },
      };
      projectedVillage = computeStats(projectedState).village;
    }
    const next = projectedVillage[u.site].income;
    const nextTotal = projectedVillage.total;
    const rows = [[tr('Tesis geliri'), q.maxed || next === now ? tr('{0}/sn', fmt(now)) : tr('{0}/sn <span class="tt-arrow">→</span> <b>{1}/sn</b>', fmt(now), fmt(next))]];
    rows.push([tr('Köy toplamı'), q.maxed || nextTotal === currentVillage.total
      ? tr('{0}/sn', fmt(currentVillage.total))
      : tr('{0}/sn <span class="tt-arrow">→</span> <b>{1}/sn</b>', fmt(currentVillage.total), fmt(nextTotal))]);
    if (site.chainBonus > 0) rows.push([tr('Üretim bağı'), tr('+{0}% işçi başı gelir', Number((site.chainBonus * 100).toFixed(1))), 'good']);
    if (u.site === 'quarry') {
      const repairNow = currentVillage.quarry.repair;
      const repairNext = projectedVillage.quarry.repair;
      rows.push([tr('Taş onarımı'), q.maxed || repairNext === repairNow
        ? tr('+{0} can/sn', repairNow.toFixed(2))
        : tr('+{0} <span class="tt-arrow">→</span> <b>+{1} can/sn</b>', repairNow.toFixed(2), repairNext.toFixed(2)), 'good']);
    }
    if (u.role === 'building' && site.workers === 0) rows.push([tr('Uyarı'), tr('İşçi yok, üretim durur'), 'bad']);
    return rows;
  }

  buy(id, card) {
    const g = this.game;
    if (!purchase(g.state, id)) return false;
    g.audio.unlock();
    g.audio.play('buy');
    g.refreshStats();
    g.celebrateUpgrade(id);
    card.classList.remove('pop');
    void card.offsetWidth; // restart animation
    card.classList.add('pop');
    this.refresh();
    return true;
  }

  /** Repeatedly buy the cheapest affordable single level in the current tab. */
  buyAll() {
    const t = TABS.find((x) => x.id === this.tab);
    if (!t.list.length) return;
    const listed = this.cards.filter((c) => c.tabId === this.tab && c.visible !== false).map((c) => c.u);
    const g = this.game;
    const s = g.state;
    const prev = s.settings.buyAmount;
    s.settings.buyAmount = 1;
    const bought = new Set();
    for (let guard = 0; guard < 500; guard++) {
      let best = null;
      for (const u of listed) {
        const q = quote(s, u.id);
        const cost = displayCost(u.id, q.cost);
        if (!q.maxed && walletOf(s, u.id) >= cost && (!best || cost < best.cost)) best = { id: u.id, cost };
      }
      if (!best || !purchase(s, best.id)) break;
      bought.add(best.id);
    }
    s.settings.buyAmount = prev;
    if (!bought.size) return;
    g.audio.unlock();
    g.audio.play('buy');
    g.refreshStats();
    for (const id of bought) {
      g.celebrateUpgrade(id);
      const c = this.cards.find((x) => x.u.id === id);
      c.card.classList.remove('pop');
      void c.card.offsetWidth;
      c.card.classList.add('pop');
    }
    this.refresh();
  }

  // ---- layout ----------------------------------------------------------------

  /** `expand` reopens a collapsed panel (user picked a tab); false on startup. */
  setTab(id, expand = true) {
    this.tab = id;
    this.root.dataset.tab = id;
    TABS.forEach((t, i) => {
      const selected = t.id === id;
      toggleClass(this.tabBtns[i], 'on', selected);
      this.tabBtns[i].setAttribute('aria-pressed', String(selected));
    });
    for (const [tid, grid] of Object.entries(this.grids)) grid.style.display = tid === id ? '' : 'none';
    this.prestigeBox.style.display = id === 'souls' ? '' : 'none';
    this.statsView.style.display = id === 'stats' ? '' : 'none';
    this.featsView.style.display = id === 'feats' ? '' : 'none';
    if (id === 'feats') this.unseenFeats = 0;
    this.buyAllBtn.style.visibility = INFO_TABS.has(id) ? 'hidden' : '';
    this.filters.setTab(id);
    toggleClass(this.emptyNote, 'on', false);
    if (expand && this.game.state.settings.panelCollapsed) this.toggleCollapse();
    this.refresh();
  }

  toggleCollapse() {
    const s = this.game.state;
    s.settings.panelCollapsed = !s.settings.panelCollapsed;
    this.applyCollapse();
    saveState(s);
  }

  applyCollapse() {
    const c = !!this.game.state.settings.panelCollapsed;
    toggleClass(this.root, 'collapsed', c);
    setText(this.collapseBtn, c ? '▴' : '▾');
    this.collapseBtn.setAttribute('aria-expanded', String(!c));
    this.collapseBtn.setAttribute('aria-label', c ? tr('Geliştirme menüsünü aç') : tr('Geliştirme menüsünü küçült'));
  }

  // ---- refresh ---------------------------------------------------------------

  refresh() {
    const s = this.game.state;
    const itemCount = s.heroInventory?.length ?? 0;
    // New finds since the window was last opened take over the badge
    const fresh = s.heroInventory?.filter((item) => item.fresh).length ?? 0;
    setText(this.inventoryCount, fresh ? `+${fresh}` : itemCount > 99 ? '99+' : String(itemCount));
    toggleClass(this.inventoryCount, 'hidden', itemCount === 0);
    toggleClass(this.inventoryBtn, 'fresh', fresh > 0);
    const affordCount = {};
    AMOUNTS.forEach((a, i) => {
      const selected = s.settings.buyAmount === a;
      toggleClass(this.amountBtns[i], 'on', selected);
      this.amountBtns[i].setAttribute('aria-pressed', String(selected));
    });

    for (const c of this.cards) {
      const { u } = c;
      const level = levelOf(s, u.id);
      const q = quote(s, u.id);
      const cost = displayCost(u.id, q.cost);
      const hired = isOwned(u, level);
      const can = !q.maxed && !q.locked && walletOf(s, u.id) >= cost;
      if (can) affordCount[c.tabId] = (affordCount[c.tabId] ?? 0) + 1;
      const short = u.short ?? u.describe;
      c.state = {
        owned: level > 0,
        afford: can,
        unowned: level === 0 && !q.locked,
        locked: !!q.locked,
        maxed: !!q.maxed,
        fav: !!s.settings.favorites?.[u.id],
      };
      if (c.barFill.parentNode) c.barFill.style.width = `${(level / maxLevel(u)) * 100}%`;

      setText(c.lvl, hired && !q.locked ? String(level) : '🔒');
      if (UNIT_BY_KIND[u.kind]) setText(c.rank, hired ? '★'.repeat(rankOf(level).stars) : '');
      if (q.locked) {
        setText(c.now, q.lockReason);
        setText(c.next, '');
        setText(c.cost, '🔒');
        setText(c.n, tr('Kilitli'));
      } else if (q.maxed) {
        setText(c.now, short(u.stat(level)));
        setText(c.next, tr('MAKS'));
        setText(c.cost, tr('MAKS'));
        setText(c.n, '');
      } else {
        setText(c.now, hired ? short(u.stat(level)) : tr('Kilitli'));
        setText(c.next, short(u.stat(level + q.n)));
        setText(c.cost, `${currencyIcon(u)}${fmt(cost)}`);
        setText(c.n, !hired && q.n === 1 ? (u.role === 'building' ? tr('Kur') : u.skill ? tr('Aç') : u.currency === 'heroEssence' ? tr('Al') : tr('Kirala')) : `+${q.n}`);
      }
      toggleClass(c.stat, 'locked-note', !!q.locked);
      // Small star when a milestone (extra arrow/soldier/pierce) is within reach of this purchase
      const ms = nextMilestone(u, level);
      setText(c.ms, ms && !q.maxed && ms.level <= level + q.n ? '★' : '');

      const progress = q.maxed || q.locked || can ? 0 : Math.min(1, walletOf(s, u.id) / cost);
      c.prog.style.width = `${progress * 100}%`;
      c.btn.disabled = !can;
      toggleClass(c.card, 'locked', !hired || !!q.locked);
      toggleClass(c.card, 'affordable', can);
      toggleClass(c.card, 'maxed', q.maxed);
      toggleClass(c.card, 'gated', !!q.locked);
    }
    this.refreshBest();
    if (this.tab === 'feats') this.refreshAchievements();
    this.applyFilters();

    // The achievements tab counts new unlocks instead of affordable upgrades
    affordCount.feats = this.unseenFeats;
    this.affordCount = affordCount;
    TABS.forEach((t, i) => {
      const n = affordCount[t.id] ?? 0;
      setText(this.tabBtns[i]._count, n ? String(n) : '');
    });
    const gain = soulsForWave(s.maxWave, this.game.stats.soul.harvest);
    toggleClass(this.tabBtns[SOULS_TAB], 'glow', gain > 0);
    this.buyAllBtn.disabled = !affordCount[this.tab];

    this.refreshPills();
    if (this.tab === 'souls') this.refreshPrestige(gain);
    if (this.tab === 'stats') this.refreshStats();
    if (this.tab === 'skills') this.refreshSkillsHeader();
    if (this.tab === 'village') this.refreshVillageHeads();
    if (this.tab === 'allies') this.refreshArmyHeads();
    if (this.tab === 'pets') this.refreshPets();
  }

  /**
   * Marks the upgrade in this tab that buys the most for its price right now: damage per
   * second per gold for the hero and the army, village income per gold in the village.
   */
  refreshBest() {
    const now = performance.now();
    if (this.bestTab === this.tab && now - (this.bestAt ?? 0) < BEST_EVERY) return;
    this.bestAt = now;
    this.bestTab = this.tab;
    const metric = BEST_METRIC[this.tab];
    let best = null;
    if (metric) {
      const s = this.game.state;
      const measure = (st) => (metric === 'dps' ? estimateDps(st).total : st.village.total);
      const base = measure(this.game.stats);
      for (const c of this.cards) {
        if (c.tabId !== this.tab || c.u.currency) continue;
        const q = quote(s, c.u.id);
        if (q.maxed || q.locked) continue;
        const cost = displayCost(c.u.id, q.cost);
        if (!(cost > 0)) continue;
        const projected = computeStats({ ...s, levels: { ...s.levels, [c.u.id]: levelOf(s, c.u.id) + q.n } });
        const gain = measure(projected) - base;
        if (gain > 0 && (!best || gain / cost > best.value)) best = { c, value: gain / cost, gain };
      }
    }
    this.best = best;
    for (const c of this.cards) toggleClass(c.card, 'best', c === best?.c);
  }

  // ---- village tab -----------------------------------------------------------------

  /** One box per site (its building and workers cards) plus the market, in shop order. */
  buildVillageView() {
    this.siteHeads = VILLAGE_SITES.map((site) => ({
      site,
      level: h('span.site-level'),
      chain: h('span.site-chain'),
      income: h('span.site-income'),
    }));
    const groups = this.siteHeads.map((head) => {
      const { site } = head;
      const header = tip(
        h('div.site-head', iconNode(site.icon, 'site-art', site.iconArt), h('span.site-name', site.name), head.level, h('span.site-spacer'), head.chain, head.income),
        () => this.siteTip(site),
      );
      head.group = h('div.site-group', { style: `--accent:${site.accent}` },
        header,
        this.buildCard(UPGRADE_BY_ID[site.building.id], 'village'),
        this.buildCard(UPGRADE_BY_ID[site.workers.id], 'village'),
      );
      return head.group;
    });
    this.marketGroup = h('div.site-group.market-group',
      h('div.site-head', iconNode('🏪', 'site-art', 'market'), h('span.site-name', tr('Köy Geneli'))),
      this.buildCard(UPGRADE_BY_ID.villageMarket, 'village'),
    );
    return h('div.village-view', ...groups, this.marketGroup);
  }

  refreshVillageHeads() {
    const v = this.game.stats.village;
    for (const head of this.siteHeads) {
      const st = v[head.site.key];
      setText(head.level, st.level ? tr('Sv {0}', st.level) : tr('Kurulmadı'));
      setText(head.income, st.income ? tr('{0}/sn', fmt(st.income)) : '—');
      setText(head.chain, st.chainBonus ? '🔗' : '');
      toggleClass(head.group, 'idle', !st.level);
    }
  }

  siteTip(site) {
    const v = this.game.stats.village;
    const st = v[site.key];
    const rows = [
      [tr('Bina'), st.level ? tr('Seviye {0}', st.level) : tr('Kurulmadı')],
      [tr('İşçi'), `${st.workers}/${MAX_WORKERS}`],
      [tr('İşçi başı'), tr('{0}/sn', fmt(st.rate))],
      [tr('Tesis geliri'), tr('{0}/sn', fmt(st.income))],
    ];
    for (const chain of v.chains.filter((c) => c.target === site.key)) {
      rows.push([chain.label, chain.bonus ? tr('+{0}% üretim', Number((chain.bonus * 100).toFixed(1))) : tr('Kaynak tesisi gerekli'), chain.bonus ? 'good' : 'bad']);
    }
    if (site.key === 'quarry') rows.push([tr('Kale onarımı'), tr('+{0} can/sn', v.quarry.repair.toFixed(2)), v.quarry.repair ? 'good' : 'bad']);
    // Miners alternate between the gallery and the shaft head (entities/Village.js)
    if (site.shaft && st.workers) rows.push([tr('Kazıcı · Taşıyıcı'), `${Math.ceil(st.workers / 2)} · ${Math.floor(st.workers / 2)}`]);
    return {
      icon: site.icon, iconArt: site.iconArt, title: site.name, badge: st.level ? tr('Sv {0}', st.level) : tr('Kurulmadı'),
      desc: site.building.desc, rows,
      foot: st.level && !st.workers ? tr('İşçisiz bina üretim yapmaz') : '', footClass: 'bad',
    };
  }

  // ---- army tab --------------------------------------------------------------------

  /** One box per branch: header (hired count, mastery, damage) and its unit cards. */
  buildArmyView() {
    this.branchHeads = BRANCHES.map((branch) => {
      const head = { branch, count: h('span.branch-count'), mastery: h('span.branch-mastery'), dps: h('span.branch-dps') };
      const header = tip(
        h('div.branch-head', iconNode(branch.icon, 'branch-art', branch.iconArt), h('span.branch-name', branch.name), head.count, h('span.site-spacer'), head.mastery, head.dps),
        () => this.branchTip(branch),
      );
      head.group = h('div.branch-group', { style: `--accent:${branch.accent}` },
        header,
        h('div.grid.branch-grid', ...UNITS_BY_BRANCH[branch.id].map((u) => this.buildCard(UPGRADE_BY_ID[u.id], 'allies'))),
      );
      return head;
    });
    return h('div.army-view', ...this.branchHeads.map((head) => head.group));
  }

  refreshArmyHeads() {
    const st = this.game.stats;
    const dps = estimateDps(st);
    for (const head of this.branchHeads) {
      const units = UNITS_BY_BRANCH[head.branch.id];
      const hired = units.filter((u) => st.allies[u.kind]).length;
      const branchDps = units.reduce((sum, u) => sum + (dps.perAlly[u.kind] ?? 0), 0);
      const mastered = st.army.mastered[head.branch.id];
      setText(head.count, `${hired}/${units.length}`);
      setText(head.mastery, mastered ? tr('🎖️ Usta +{0}%', Math.round(BRANCH_MASTERY * 100)) : '');
      setText(head.dps, branchDps ? tr('~{0}/sn', fmt(branchDps)) : '');
      toggleClass(head.group, 'mastered', mastered);
      toggleClass(head.group, 'idle', !hired);
    }
  }

  branchTip(branch) {
    const st = this.game.stats;
    const units = UNITS_BY_BRANCH[branch.id];
    const dps = estimateDps(st);
    return {
      icon: branch.icon, iconArt: branch.iconArt, title: branch.name,
      badge: st.army.mastered[branch.id] ? tr('USTA') : `${units.filter((u) => st.allies[u.kind]).length}/${units.length}`,
      desc: tr('{0}<div class="tt-info">Bütün birliklerini kiralarsan branş ustalaşır: +{1}% hasar ve şifa.</div>', branch.hint, Math.round(BRANCH_MASTERY * 100)),
      rows: units.map((u) => {
        const s = st.allies[u.kind];
        if (!s) return [u.name, tr('Kiralanmadı'), 'bad'];
        return [u.name, tr('Sv {0} · {1}{2}', s.level, s.rank.name, u.dps ? tr(' · ~{0}/sn', fmt(dps.perAlly[u.kind])) : '')];
      }),
    };
  }

  // ---- pets tab ----------------------------------------------------------------------

  /** The companion at the hero's side, a switch for every owned one, then the pet cards. */
  buildPetsView() {
    this.petCanvas = h('canvas.pet-portrait', { width: 112, height: 84, role: 'img', 'aria-label': tr('Yoldaşın') });
    this.petName = h('b.pet-name');
    this.petInfo = h('span.pet-info');
    this.petEssence = h('small.pet-essence');
    this.petChips = PET_UPGRADES.map((u) => ({ u, el: h('button.oath-chip', { onclick: () => this.pickPet(u) }, u.name) }));
    const grid = h('div.grid', ...PET_UPGRADES.map((u) => this.buildCard(u, 'pets')));
    return h('div.pets-view',
      h('div.pet-panel', this.petCanvas, h('div.pet-text', this.petName, this.petInfo, this.petEssence), h('div.pet-chips', ...this.petChips.map((c) => c.el))),
      grid,
    );
  }

  pickPet(u) {
    const s = this.game.state;
    if (!levelOf(s, u.id)) return;
    s.activePet = u.id;
    this.game.refreshStats();
    saveState(s);
    this.refresh();
  }

  refreshPets() {
    const s = this.game.state;
    const { pet } = this.game.stats;
    setText(this.petName, pet ? tr('{0} · Sv {1}', pet.def.name, pet.level) : tr('Henüz yoldaşın yok'));
    setText(this.petInfo, pet ? `${pet.def.describe(pet)}` : tr('Bir yoldaş sahiplenince kahramanın yanına gelir.'));
    setText(this.petEssence, tr('✦ {0} Öz · eşya satarak kazanılır · aynı anda bir yoldaş savaşır', fmt(s.heroEssence ?? 0)));
    for (const { u, el } of this.petChips) {
      const owned = levelOf(s, u.id) > 0;
      el.style.display = owned ? '' : 'none';
      toggleClass(el, 'on', pet?.def === u);
      el.setAttribute('aria-pressed', String(pet?.def === u));
    }
    const ctx = this.petCanvas.getContext('2d');
    ctx.clearRect(0, 0, 112, 84);
    if (pet) drawPet(ctx, pet.def.key, 54, pet.def.flies ? 56 : 72, this.game.time, { s: 1.35 });
  }

  // ---- skills tab ------------------------------------------------------------------

  /** Elmas header, active skill cards and the 3-branch talent tree. */
  buildSkillsView() {
    this.gemCount = h('span.gem-count');
    this.gemInfo = h('span.gem-info');
    const header = tip(h('div.gem-box', h('div.gem-text', this.gemCount, this.gemInfo)), () => ({
      icon: '💠', title: tr('Elmas nasıl kazanılır?'), desc: GEM_SOURCES,
      rows: [[tr('En iyi dalga'), this.game.state.bestWave], [tr('Toplam kazanılan'), fmt(this.game.state.totalGems ?? 0)]],
      foot: tr('Elmas ve yetenekler Yeniden Doğuş\'ta sıfırlanmaz'), footClass: 'good',
    }));

    const active = h('div.grid.skill-grid', ...ACTIVE_SKILLS.map((u) => this.buildCard(u, 'skills')));

    const tree = h('div.tree');
    tree.append(h('div.tree-corner'));
    for (const b of TALENT_BRANCHES) tree.append(h('div.tree-head', iconNode(b.icon, 'tree-art'), b.name));
    TALENT_TIERS.forEach((wave, tier) => {
      const label = tip(h('div.tree-tier', h('b', tr('Aşama {0}', tier + 1)), h('span', tr('Dalga {0}', wave))), () => tr('Bu aşamadaki yetenekler en iyi dalgan <b>{0}</b> olunca açılır.', wave));
      tree.append(label);
      for (const b of TALENT_BRANCHES) {
        const u = TALENTS.find((t) => t.branch === b.id && t.tier === tier);
        const node = h(`div.tree-node${tier ? '.linked' : ''}`, this.buildCard(u, 'skills'));
        node._u = u;
        tree.append(node);
      }
    });
    this.treeNodes = [...tree.querySelectorAll('.tree-node')];

    this.skillSections = {
      active: h('div.skill-section',
        h('div.section-title', tr('⚡ Aktif Yetenekler'), h('span', tr('Yetenek çubuğunda kullanılır · kısayollar Z X C V B N'))),
        active,
      ),
      tree: h('div.skill-section',
        h('div.section-title', tr('🌳 Yetenek Ağacı'), h('span', tr('Kalıcı pasif bonuslar · her düğüm üstündekini gerektirir'))),
        tree,
      ),
    };
    return h('div.skills-view', header, this.skillSections.active, this.skillSections.tree);
  }

  refreshSkillsHeader() {
    const s = this.game.state;
    setText(this.gemCount, tr('💠 {0} Elmas', fmt(s.gems)));
    setText(this.gemInfo, tr('En iyi dalga: {0} · Patron öldürerek ve aşamalara ulaşarak kazanılır', s.bestWave));
    // Light up the connector into a node once its prerequisite is owned
    for (const node of this.treeNodes) toggleClass(node, 'reached', !node._u.requires || levelOf(s, node._u.requires) > 0);
  }

  // ---- summary pills -----------------------------------------------------------

  /** Compact stat chips above the cards; each explains itself in a tooltip. */
  refreshPills() {
    const st = this.game.stats;
    const dps = estimateDps(st);
    let pills = [];
    if (this.tab === 'hero') {
      const hs = st.hero;
      pills = [
        ['⚔️', tr('~{0}/sn', fmt(dps.hero)), tr('Tahmini saniyelik hasar (kritik ve çoklu ok dahil)')],
        ['🏹', `${fmt(hs.damage)} × ${hs.multishot}`, tr('Ok başına hasar × aynı anda atılan ok')],
        ['⚡', tr('{0}/sn', hs.rate.toFixed(2)), tr('Saniyedeki atış')],
        ['🎯', `${pct(hs.critChance)} · x${hs.critMult.toFixed(2)}`, tr('Kritik şansı ve kritik hasar çarpanı')],
        ['🌧️', hs.rainArrows ? tr('{0} ok', hs.rainArrows) : tr('Kilitli'), tr('Ok Yağmuru: {0} sn\'de bir, ok başına {1} hasar', hs.rainCooldown.toFixed(1), fmt(hs.damage * 2))],
      ];
    } else if (this.tab === 'castle') {
      const c = st.castle;
      const hpLevel = this.game.state.levels.castleHp ?? 0;
      const tier = FORTRESS_TIERS.findLast((t) => hpLevel >= t.level);
      const next = FORTRESS_TIERS.find((t) => hpLevel < t.level);
      pills = [
        ['🏰', tier.name, next ? tr('Kale kademesi. Taş Duvarlar Sv {0}: {1}', next.level, next.name) : tr('Kale son kademede')],
        ['❤️', fmt(c.maxHp), tr('Kalenin maksimum canı')],
        ['🔨', tr('+{0}/sn', fmt(c.regen)), tr('Saniyelik onarım')],
        ['⛓️', pct(c.armor), tr('Kalenin aldığı hasardaki azalma')],
        ['💰', `x${c.goldMult.toFixed(2)}`, tr('Toplam altın çarpanı (Ruh bonusu dahil)')],
      ];
      const ow = this.game.outerWall;
      if (ow.built) {
        pills.push(['🧱', ow.alive ? tr('Sur {0}/{1}', fmt(ow.hp), fmt(ow.maxHp)) : tr('Sur yıkık'), ow.alive
          ? tr('Dış Sur: {0} kapı zırhı · {1} okçu. Kara düşmanları önce suru yıkmak zorunda.', pct(ow.armor), ow.archers.length)
          : tr('Dış Sur yıkıldı; sonraki dalga başında yarı canla onarılır.')]);
      }
    } else if (this.tab === 'allies') {
      const n = Object.values(st.allies).filter(Boolean).length;
      const mastered = Object.values(st.army.mastered).filter(Boolean).length;
      pills = [
        ['⚔️', tr('~{0}/sn', fmt(dps.allies)), tr('Birliklerin tahmini toplam saniyelik hasarı')],
        ['👥', `${n}/${UNITS.length}`, tr('Kiralanan birlik sayısı')],
        ['🎖️', tr('{0}/{1} branş', mastered, BRANCHES.length), tr('Bir branşın bütün birliklerini kiralarsan o branş ustalaşır: +{0}% hasar ve şifa.', Math.round(BRANCH_MASTERY * 100))],
        ['📈', tr('~{0}/sn', fmt(dps.total)), tr('Kahraman dahil toplam saniyelik hasar')],
      ];
    } else if (this.tab === 'village') {
      const v = st.village;
      const built = VILLAGE_SITES.filter((site) => v[site.key].level).length;
      pills = [
        ['🏘️', tr('+{0}/sn', fmt(v.total)), tr('Köyün toplam pasif geliri. İşçiler yükü ambara getirdikçe kasaya girer; çevrimdışı kazanca da dahildir.')],
        ['🏗️', tr('{0}/{1} tesis', built, VILLAGE_SITES.length), tr('Kurulan tesis sayısı. Her tesisin kutusunda seviyesi ve geliri görünür.')],
        ['🏪', `x${v.mult.toFixed(2)}`, tr('Toplam köy çarpanı: Pazar Yeri × Köy Bereketi × Altın Ruhu')],
        ['🧱', tr('+{0}/sn', v.quarry.repair.toFixed(2)), tr('Taş ustalarının kaleye sağladığı ek onarım')],
      ];
      const activeChains = v.chains.filter((chain) => chain.bonus > 0);
      pills.push(['🔗', tr('{0}/{1} üretim bağı', activeChains.length, VILLAGE_CHAINS.length), {
        icon: '🔗', title: tr('Köy üretim zincirleri'),
        desc: tr('Bir tesisi büyütmek, bağlı olduğu tesisin işçi başı gelirini de artırır.'),
        rows: [
          ...v.chains.map((chain) => [
            chain.label,
            chain.bonus ? tr('+{0}% üretim', Number((chain.bonus * 100).toFixed(1))) : tr('Kaynak tesisi gerekli'),
            chain.bonus ? 'good' : 'bad',
          ]),
          [tr('Taş Ocağı → Kale'), tr('+{0} can/sn onarım', v.quarry.repair.toFixed(2)), v.quarry.repair ? 'good' : 'bad'],
        ],
      }]);
      if (this.game.view.left > -330) pills.push(['👁️', tr('Köy ekran dışında'), tr('Köy kalenin arkasında. Görmek için pencereyi genişlet ya da menüyü küçült (H). Görünmese de işçiler çalışır.')]);
    } else if (this.tab === 'skills') {
      const tl = st.talent;
      const unlocked = ACTIVE_SKILLS.filter((u) => st.skills[u.key]).length;
      pills = [
        ['💠', fmt(this.game.state.gems), tr('Harcanabilir Elmas')],
        ['⚡', tr('{0}/{1} yetenek', unlocked, ACTIVE_SKILLS.length), tr('Açılan aktif yetenekler')],
        ['🏹', `×${(tl.heroDmg * tl.heroRate).toFixed(2)}`, tr('Okçuluk dalı: kahraman hasar × hız çarpanı')],
        ['🛡️', tr('×{0} can', tl.castleHp.toFixed(2)), tr('Savunma dalı: kale canı çarpanı')],
        ['💰', `×${tl.loot.toFixed(2)}`, tr('Ticaret dalı: ganimet çarpanı')],
      ];
    } else if (this.tab === 'pets') {
      const owned = PET_UPGRADES.filter((u) => levelOf(this.game.state, u.id) > 0).length;
      pills = [['🐾', tr('{0}/{1} yoldaş', owned, PET_UPGRADES.length), tr('Sahiplenilen yoldaşlar')]];
    } else if (this.tab === 'souls') {
      const so = st.soul;
      pills = [
        ['⚔️', `x${so.damage.toFixed(2)}`, tr('Ruh hasar çarpanı')],
        ['👑', `x${so.gold.toFixed(2)}`, tr('Ruh altın çarpanı')],
        ['🏯', `x${so.walls.toFixed(2)}`, tr('Ruh dayanıklılık çarpanı')],
        ['🥁', `x${so.haste.toFixed(2)}`, tr('Ruh hız çarpanı')],
        ['🌀', `x${so.harvest.toFixed(2)}`, tr('Ruh Taşı kazanç çarpanı (Ruh Hasadı, Kâhin ve yemin dahil)')],
      ];
    }
    const key = JSON.stringify(pills.map(([icon, value, hint]) => [icon, value, hint])) + this.tab;
    if (key === this.pillsKey) return;
    this.pillsKey = key;
    this.pills.replaceChildren(...pills.map(([icon, val, hint]) => tip(h('span.pill', iconNode(icon, 'pill-icon'), val), hint)));
    this.pills.style.display = pills.length ? '' : 'none';
  }

  // ---- prestige ------------------------------------------------------------------

  buildPrestige(onPrestige) {
    this.soulCount = h('b.soul-count');
    this.soulInfo = h('span.soul-info');
    this.soulFill = h('span');
    this.soulHistory = h('small.soul-history');
    this.prestigeBtn = tip(h('button.prestige-btn', { onclick: onPrestige }), () => {
      const s = this.game.state;
      const gain = soulsForWave(s.maxWave, this.game.stats.soul.harvest);
      return {
        icon: '✨', title: tr('Yeniden Doğuş'),
        desc: tr('Altın, dalga ve altınla alınan tüm geliştirmeler sıfırlanır. Ruh Taşları ve Ruh geliştirmeleri kalıcıdır.'),
        rows: [
          [tr('Kazanç'), gain ? `+${gain} 💎` : '—', 'gold'],
          [tr('En yüksek dalga'), s.maxWave],
          [tr('Sonraki artış'), gain ? tr('Dalga {0}', nextSoulWave(s.maxWave, this.game.stats.soul.harvest)) : tr('Dalga {0}', PRESTIGE_MIN_WAVE)],
        ],
        foot: gain ? tr('Tıkla: onay penceresi açılır') : tr('Dalga {0}\'ye ulaşınca açılır', PRESTIGE_MIN_WAVE),
        footClass: gain ? 'good' : 'bad',
      };
    });
    this.oathChips = OATHS.map((oath) => ({
      oath,
      el: tip(h('button.oath-chip', { onclick: () => this.pickOath(oath) }, oath.name), () => this.oathTip(oath)),
    }));
    this.oathNow = h('small.oath-now');
    this.prestigeBox = h('div.soul-panel',
      h('div.soul-orb', this.soulCount, h('small', tr('Ruh Taşı'))),
      h('div.soul-main', this.soulInfo, h('div.soul-bar', this.soulFill), this.soulHistory),
      this.prestigeBtn,
      h('div.oath-row', h('b', tr('Sonraki yolculuğun yemini')), ...this.oathChips.map((c) => c.el), this.oathNow),
    );
  }

  pickOath(oath) {
    const s = this.game.state;
    if (s.prestiges < oath.prestiges) return;
    s.nextOath = oath.id;
    saveState(s);
    this.refresh();
  }

  oathTip(oath) {
    const { prestiges } = this.game.state;
    const locked = prestiges < oath.prestiges;
    return {
      title: oath.name, badge: oath.souls > 1 ? tr('Ruh Taşı x{0}', oath.souls) : '', desc: oath.desc,
      foot: locked ? tr('{0} Yeniden Doğuş gerekli', oath.prestiges) : oath.souls > 1 ? tr('Yemin bir sonraki yolculuk boyunca geçerli') : '',
      footClass: locked ? 'bad' : 'good',
    };
  }

  refreshPrestige(gain) {
    const s = this.game.state;
    const { harvest } = this.game.stats.soul;
    const nextWave = gain > 0 ? nextSoulWave(s.maxWave, harvest) : PRESTIGE_MIN_WAVE;
    setText(this.soulCount, fmt(s.souls));
    setText(this.soulInfo, gain > 0
      ? tr('Şimdi doğarsan +{0} · dalga {1}\'de +{2}', fmt(gain), nextWave, fmt(soulsForWave(nextWave, harvest)))
      : tr('Dalga {0}\'de açılır · en yüksek dalgan {1}', PRESTIGE_MIN_WAVE, s.maxWave));
    this.soulFill.style.width = `${Math.min(100, (s.maxWave / nextWave) * 100)}%`;
    const last = s.prestigeLog?.[0];
    const best = (s.prestigeLog ?? []).reduce((top, run) => Math.max(top, run.souls / Math.max(60, run.time)), 0);
    setText(this.soulHistory, last
      ? tr('{0}. doğuş · son yolculuk: dalga {1}, +{2} 💎, {3} · en verimli: {4} 💎/saat', s.prestiges, last.wave, fmt(last.souls), fmtTime(last.time), (best * 3600).toFixed(0))
      : tr('Henüz Yeniden Doğuş yapmadın'));
    for (const { oath, el } of this.oathChips) {
      toggleClass(el, 'on', oath.id === (s.nextOath ?? 'none'));
      toggleClass(el, 'locked', s.prestiges < oath.prestiges);
      el.setAttribute('aria-pressed', String(oath.id === (s.nextOath ?? 'none')));
    }
    const now = oathById(s.oath);
    setText(this.oathNow, now.id === 'none' ? '' : tr('Şu an: {0} (Ruh Taşı x{1})', now.name, now.souls));
    setText(this.prestigeBtn, gain > 0 ? tr('✨ Yeniden Doğ +{0}', fmt(gain)) : tr('🔒 Dalga {0}', PRESTIGE_MIN_WAVE));
    this.prestigeBtn.disabled = gain <= 0;
  }

  // ---- achievements ------------------------------------------------------------------

  /** Called by the game when achievements unlock; badges the tab until it is opened. */
  onAchievements(list) {
    if (this.tab !== 'feats') this.unseenFeats += list.length;
    this.refresh();
  }

  buildAchievements() {
    const s = this.game.state;
    this.featSummary = h('span.feat-count');
    this.featGlory = h('span.feat-glory');
    this.rankName = h('b.rank-name');
    this.rankNext = h('small.rank-next');
    this.rankFill = h('span');
    this.rankNodes = GLORY_RANKS.map((rank) => tip(h('span.rank-node', rank.name), () => ({
      title: rank.name, badge: tr('{0} Şan', rank.points), desc: rank.desc,
      foot: gloryPoints(s) >= rank.points ? tr('Kazanıldı · kalıcı') : tr('{0} Şan kaldı', rank.points - gloryPoints(s)),
      footClass: gloryPoints(s) >= rank.points ? 'good' : '',
    })));
    this.featNext = h('div.feat-next');
    const header = h('div.rank-panel',
      tip(h('div.feat-box', h('div.feat-text', this.featSummary, this.featGlory)), () => {
        const n = achievementCount(s);
        return {
          icon: '🏆', iconArt: 'medal', title: tr('Şan'), badge: `${n} / ${ACHIEVEMENTS.length}`,
          desc: tr('Her başarım madalyasına göre Şan verir: Bronz 10, Gümüş 25, Altın 50. Şan tüm hasarı ve altını artırır, rütbeler kalıcı ödül verir.'),
          rows: [[tr('Şimdiki Şan'), tr('{0} · +%{1} hasar ve altın', gloryPoints(s), (gloryPercent(gloryPoints(s)) * 100).toFixed(1)), 'good']],
          foot: tr('Başarımlar Yeniden Doğuş\'ta sıfırlanmaz'), footClass: 'good',
        };
      }),
      h('div.rank-line', this.rankName, h('div.rank-bar', this.rankFill), this.rankNext),
      h('div.rank-road', ...this.rankNodes),
      this.featNext,
    );
    this.featCards = [];
    this.featSections = ACHIEVEMENT_GROUPS.map((group) => h('div.feat-section',
      h('div.section-title', `${group.icon} ${group.name}`),
      h('div.feat-grid', ...ACHIEVEMENTS.filter((a) => a.group === group.id).map((a) => this.buildFeatCard(a))),
    ));
    return h('div.feats-view', header, ...this.featSections);
  }

  buildFeatCard(a) {
    const medal = medalOf(a);
    const fill = h('div.feat-fill');
    const prog = h('span.feat-prog');
    const name = h('div.feat-name', a.name);
    const desc = h('div.feat-desc', a.desc);
    const card = h('div.feat', { style: `--medal:${medal.color}` },
      h('div.feat-icon', iconNode(a.icon, 'feat-art')),
      h('div.feat-info', name, desc, h('div.feat-bar', fill, prog)),
      h('div.feat-reward', h('b', `+${medal.points}`), a.gems ? h('span', `💠 ${a.gems}`) : null),
    );
    tip(card, () => {
      const s = this.game.state;
      const at = s.achievements?.[a.id];
      if (a.secret && !at) return { title: tr('Gizli başarım'), desc: tr('Ne yapman gerektiğini kendin keşfet.'), rows: [[tr('Ödül'), tr('+{0} Şan', medal.points), 'gold']] };
      return {
        icon: a.icon, title: a.name, badge: `${medal.name}${at ? tr(' · Tamamlandı') : ''}`, desc: a.desc,
        rows: [
          [tr('İlerleme'), `${fmt(Math.min(a.value(s), a.goal))} / ${fmt(a.goal)}`],
          [tr('Ödül'), tr('{0}+{1} Şan', a.gems ? tr('💠 {0} Elmas · ', a.gems) : '', medal.points), 'gold'],
          ...(at ? [[tr('Açıldı'), new Date(at).toLocaleDateString(language())]] : []),
        ],
      };
    });
    this.featCards.push({ a, card, fill, prog, name, desc });
    return card;
  }

  refreshAchievements() {
    const s = this.game.state;
    const n = achievementCount(s);
    setText(this.featSummary, `🏆 ${n} / ${ACHIEVEMENTS.length}`);
    const points = gloryPoints(s);
    const { index, rank, next } = gloryRank(points);
    setText(this.featGlory, tr('{0} Şan · +%{1} hasar ve altın', points, (gloryPercent(points) * 100).toFixed(1)));
    setText(this.rankName, rank.name);
    setText(this.rankNext, next ? tr('{0}: {1} Şan kaldı · {2}', next.name, next.points - points, next.desc) : tr('En yüksek rütbe'));
    this.rankFill.style.width = `${next ? ((points - rank.points) / (next.points - rank.points)) * 100 : 100}%`;
    this.rankNodes.forEach((node, i) => {
      toggleClass(node, 'on', i <= index);
      toggleClass(node, 'now', i === index);
    });
    // The three unearned goals closest to done, so there is always a next step in view
    const nearest = this.featCards
      .filter((c) => !c.a.secret && !s.achievements?.[c.a.id])
      .map((c) => ({ a: c.a, k: Math.min(1, c.a.value(s) / c.a.goal) }))
      .sort((x, y) => y.k - x.k)
      .slice(0, 3);
    const key = nearest.map((x) => `${x.a.id}:${Math.round(x.k * 100)}`).join();
    if (key !== this.featNextKey) {
      this.featNextKey = key;
      this.featNext.replaceChildren(h('small', tr('Sıradaki:')), ...nearest.map((x) => h('span.feat-next-item', { style: `--medal:${medalOf(x.a).color}` }, x.a.name, h('b', `%${Math.round(x.k * 100)}`))));
    }
    for (const c of this.featCards) {
      const done = !!s.achievements?.[c.a.id];
      const value = Math.min(c.a.value(s), c.a.goal);
      c.fill.style.width = `${(done ? 1 : value / c.a.goal) * 100}%`;
      setText(c.prog, done ? tr('✓ Tamamlandı') : `${fmt(value)} / ${fmt(c.a.goal)}`);
      toggleClass(c.card, 'done', done);
      const hidden = !!c.a.secret && !done;
      toggleClass(c.card, 'secret', hidden);
      setText(c.name, hidden ? '???' : c.a.name);
      setText(c.desc, hidden ? tr('Gizli başarım') : c.a.desc);
      if (hidden) setText(c.prog, '?');
    }
  }

  // ---- statistics ------------------------------------------------------------------

  buildStats() {
    this.statRows = {};
    const section = (id, title, keys) => h('div.stat-card', { 'data-section': id }, h('div.stat-title', title), ...keys.map(([key, label, hint]) => {
      const v = h('span.sv');
      this.statRows[key] = v;
      const row = h('div.srow', h('span.sk', label), v);
      if (hint) tip(row, hint);
      return row;
    }));
    this.statsView = h('div.stats-view',
      section('power', tr('⚔️ Savaş Gücü'), [
        ['dpsTotal', tr('Toplam'), tr('Kahraman + birlikler, tahmini saniyelik hasar')],
        ['dpsHero', tr('Kahraman')],
        // One row per unit that deals damage, in roster order
        ...UNITS.filter((u) => u.dps).map((u) => [`dps_${u.kind}`, u.name]),
      ]),
      section('enemy', tr('👹 Düşman'), [
        ['eWave', tr('Dalga')],
        ['eCount', tr('Düşman sayısı')],
        ['eHp', tr('Haydut canı'), tr('Bu dalgadaki temel düşmanın canı; diğer türler buna oranla güçlü')],
        ['eDmg', tr('Haydut hasarı')],
        ['eBoss', tr('Sonraki patron')],
        ['eBossHp', tr('Patron canı')],
        ['eTtk', tr('Haydudu öldürme'), tr('Toplam hasarınla bir Haydudun ne kadar sürede öldüğü')],
      ]),
      section('village', tr('🏘️ Köy'), [
        ...VILLAGE_SITES.map((site) => [`v_${site.key}`, site.name]),
        ['vTotal', tr('Toplam'), tr('Köyün bütün tesislerinden gelen pasif altın')],
      ]),
      section('session', tr('🕐 Bu Oturum'), [
        ['sGold', tr('Kazanılan altın'), tr('Oyunu bu açışından beri')],
        ['sKills', tr('Öldürülen düşman')],
        ['sTime', tr('Süre')],
        ['sRate', tr('Altın / saat'), tr('Bu oturumun ortalaması')],
      ]),
      section('progress', tr('📈 İlerleme'), [
        ['pMax', tr('En yüksek dalga')],
        ['pKills', tr('Öldürülen düşman')],
        ['pGold', tr('Toplam altın')],
        ['pGps', tr('Altın / sn'), tr('Savaş ve köy dahil son saniyelerdeki ortalama')],
        ['pVillage', tr('Köy geliri'), tr('Tarla, kereste ve madenden gelen pasif altın')],
        ['pTime', tr('Oynama süresi')],
        ['pPrest', tr('Yeniden doğuş')],
        ['pSouls', tr('Toplam Ruh Taşı')],
      ]),
    );
    this.statCards = [...this.statsView.children];
  }

  refreshStats() {
    const g = this.game;
    const s = g.state;
    const dps = estimateDps(g.stats);
    const r = this.statRows;
    const allyVal = (k) => (g.stats.allies[k] ? tr('{0}/sn', fmt(dps.perAlly[k])) : '—');
    setText(r.dpsTotal, tr('{0}/sn', fmt(dps.total)));
    setText(r.dpsHero, tr('{0}/sn', fmt(dps.hero)));
    for (const u of UNITS) if (u.dps) setText(r[`dps_${u.kind}`], allyVal(u.kind));

    const sc = waveScaling(s.wave);
    const nextBoss = isBossWave(s.wave) ? s.wave : Math.ceil(s.wave / 10) * 10;
    const gruntHp = ENEMY_TYPES.grunt.hp * sc.hp;
    setText(r.eWave, String(s.wave));
    setText(r.eCount, String(waveSize(s.wave) + (isBossWave(s.wave) ? 1 : 0)));
    setText(r.eHp, fmt(gruntHp));
    setText(r.eDmg, fmt(ENEMY_TYPES.grunt.damage * sc.dmg));
    const nextBossDef = ENEMY_TYPES[bossForWave(nextBoss)];
    setText(r.eBoss, `${nextBossDef.name} · ${nextBoss === s.wave ? tr('bu dalga') : tr('dalga {0}', nextBoss)}`);
    setText(r.eBossHp, fmt(nextBossDef.hp * waveScaling(nextBoss).hp));
    setText(r.eTtk, dps.total > 0 ? tr('{0} sn', (gruntHp / dps.total).toFixed(2)) : '—');

    setText(r.pMax, String(s.maxWave));
    setText(r.pKills, fmt(s.kills));
    setText(r.pGold, fmt(s.totalGold));
    setText(r.pGps, fmt(s.goldPerSec));
    setText(r.pVillage, tr('{0}/sn', fmt(g.stats.village.total)));
    setText(r.pTime, fmtTime(s.playTime));
    setText(r.pPrest, String(s.prestiges));
    setText(r.pSouls, fmt(s.totalSouls));

    const v = g.stats.village;
    for (const site of VILLAGE_SITES) {
      const st = v[site.key];
      setText(r[`v_${site.key}`], st.level ? tr('{0}/sn · Sv {1} · {2} işçi', fmt(st.income), st.level, st.workers) : tr('Kurulmadı'));
    }
    setText(r.vTotal, tr('{0}/sn', fmt(v.total)));
    const ss = this.session;
    const gold = Math.max(0, s.totalGold - ss.gold);
    const time = Math.max(0, s.playTime - ss.time);
    setText(r.sGold, fmt(gold));
    setText(r.sKills, fmt(Math.max(0, s.kills - ss.kills)));
    setText(r.sTime, fmtTime(time));
    setText(r.sRate, time > 30 ? fmt((gold / time) * 3600) : '—');
  }
}
