import './styles/main.css';
import { WORLD_W, WORLD_H, MAX_VIEW_W } from './core/constants.js';
import { loadState, saveState, clearSave, hasSave, importSave, setSaveStore } from './core/State.js';
import { Game } from './core/Game.js';
import { HUD } from './ui/HUD.js';
import { ShopPanel } from './ui/ShopPanel.js';
import { HeroWindow } from './ui/HeroWindow.js';
import { showHowToPlay } from './ui/HowToPlay.js';
import { h } from './ui/dom.js';
import { medalOf } from './config/achievements.js';
import { oathById } from './config/oaths.js';
import { showModal } from './ui/Modal.js';
import { initTooltips } from './ui/Tooltip.js';
import { initCameraControls } from './ui/CameraControls.js';
import { Toasts } from './ui/Toasts.js';
import { MainMenu } from './ui/MainMenu.js';
import { getHeroItemRarity, getHeroItemTemplate, describeSetBonus } from './systems/HeroItems.js';
import { fmt, fmtTime } from './utils/format.js';
import { soulsForWave } from './config/upgrades.js';
import { isBossWave } from './config/enemies.js';
import { FALL_RELIEF, MIDGAME } from './config/rewards.js';
import { platform } from './platform/platform.js';
import { Offers } from './ui/Offers.js';
import { Coach } from './ui/Coach.js';
import { language, tr } from './i18n/i18n.js';

const OFFLINE_MIN = 60;

if (language() === 'en') {
  document.title = 'Lord of the Walls: Last Archer Standing';
  document.getElementById('game').setAttribute('aria-label', 'Lord of the Walls battlefield');
  document.getElementById('game-description').textContent = 'The hero and units fight enemies automatically. Click the battlefield for extra arrows, drag or use the arrow keys to move the camera. Upgrades and speed controls are in the menus around the field.';
}
setSaveStore(platform.store);
const firstVisit = !hasSave();
const state = loadState();
const canvas = document.getElementById('game');
const viewport = document.getElementById('viewport');
const stage = document.getElementById('stage');
const modalRoot = document.getElementById('modal-root');

initTooltips();
const game = new Game(canvas, state);
const heroWindow = new HeroWindow(modalRoot, game);
const hud = new HUD(document.getElementById('hud'), game, { onSettings: () => menu.open('pause'), onOpenSkills: () => shop.setTab('skills'), onOpenHero: () => heroWindow.open(), onBoost: () => offers.openBoost(), onFast: () => offers.openFast() });
const shop = new ShopPanel(document.getElementById('panel'), game, { onPrestige: confirmPrestige, onOpenInventory: () => heroWindow.open(), onHelp: () => openGuide() });
const toasts = new Toasts();
const offers = new Offers(modalRoot, game, (t) => toasts.show(t));
const coach = new Coach(viewport, game, shop);
game.onVipTap = () => offers.openVip();
game.onVipArrive = () => toasts.show({ icon: '👑', title: tr('VIP Elçi geldi!'), sub: tr('Kale penceresindeki elçiye tıkla') });
game.onVillageEvent = (def) => toasts.show({ icon: def.icon, title: def.name, sub: def.desc });
game.onAutoWearRequest = () => offers.openAutoWear();
platform.watchMute((muted) => { game.audio.muted = muted; });

/** Ara reklam, only after a boss falls: the natural pause in the climb. */
let lastMidgame = -Infinity;
game.onWaveBreak = (wave) => {
  if (!platform.adsOn || !isBossWave(wave) || state.playTime < MIDGAME.firstAfter) return;
  if (state.playTime - lastMidgame < MIDGAME.every || game.paused) return;
  lastMidgame = state.playTime;
  platform.showAd('midgame', {
    onStart: () => {
      game.paused = true;
      game.audio.muted = true;
    },
    onEnd: () => {
      game.paused = false;
      game.audio.muted = platform.siteMuted;
    },
  });
};
/** Yenilgi Ganimeti, a little after a fall so the banner is read first; capped by play time. */
let lastFallRelief = -Infinity;
game.onCastleFell = () => {
  setTimeout(() => {
    const s = state;
    if (!platform.adsOn || s.playTime < FALL_RELIEF.firstAfter) return;
    if (s.playTime - lastFallRelief < FALL_RELIEF.every || game.paused || menu.isOpen || offers.open) return;
    lastFallRelief = s.playTime;
    offers.openFallRelief();
  }, FALL_RELIEF.delayMs);
};
/** Announces a new Şan rank across the top of the field; clicks pass through it. */
function showRankUp(rank) {
  const el = h('div.rank-up', { role: 'status' },
    h('small', tr('YENİ ŞAN RÜTBESİ')),
    h('b', rank.name),
    h('span', rank.desc),
  );
  document.getElementById('app').append(el);
  setTimeout(() => el.remove(), 4200);
}
/** The rebirth itself: a violet flood over the field with the souls earned. */
game.onPrestige = (gain) => {
  const el = h('div.rebirth', { role: 'status' },
    h('div.rebirth-orb'),
    h('small', tr('KÜLLERİNDEN DOĞDUN')),
    h('b', tr('+{0} Ruh Taşı', fmt(gain))),
  );
  document.getElementById('app').append(el);
  setTimeout(() => el.remove(), 3000);
  platform.happytime();
};
game.onVillageTap = () => shop.setTab('village');
game.onItemDrop = (item) => {
  heroWindow.refresh();
  const rarity = getHeroItemRarity(item);
  if (rarity.id === 'epic' || rarity.id === 'legendary') {
    toasts.show({ icon: '🏹', art: getHeroItemTemplate(item)?.art, title: tr('{0} eşya!', rarity.name), sub: getHeroItemTemplate(item)?.name, kind: 'loot', color: rarity.color });
  }
};
game.onAchievement = (list, rankUp) => {
  shop.onAchievements(list);
  if (rankUp) showRankUp(rankUp);
  // A burst of retroactive unlocks (older saves) collapses into one notice
  if (list.length > 3) {
    const gems = list.reduce((sum, a) => sum + a.gems, 0);
    toasts.show({ icon: '🏆', art: 'medal', title: tr('{0} başarım açıldı!', list.length), sub: tr('+{0} 💠 Elmas · Başarımlar sekmesine bak (I)', gems) });
    return;
  }
  for (const a of list) {
    const medal = medalOf(a);
    toasts.show({ icon: a.icon, title: tr('{0} başarım: {1}', medal.name, a.name), sub: tr('{0} · +{1} Şan{2}', a.desc, medal.points, a.gems ? ` · +${a.gems} 💠` : ''), kind: 'feat', color: medal.color });
  }
};
heroWindow.onSetTier = (set, tier) => {
  game.audio.play('achieve');
  toasts.show({ icon: '🔮', title: tr('{0} ({1} parça)', set.name, tier.need), sub: describeSetBonus(tier.bonus), kind: 'set', color: set.color });
};

/*
 * Fit the world into the stage. The world is 720 tall; on screens wider than 16:9 the
 * view extends LEFT of the castle (into the village) instead of leaving empty bars, so
 * the battlefield itself — and the game balance — never changes.
 */
function resize() {
  const r = stage.getBoundingClientRect();
  const byHeight = r.height / WORLD_H;
  let scale;
  let viewW;
  if (r.width / byHeight >= WORLD_W) {
    scale = byHeight;
    viewW = Math.min(r.width / scale, MAX_VIEW_W);
  } else {
    scale = r.width / WORLD_W;
    viewW = WORLD_W;
  }
  const w = Math.floor(viewW * scale);
  const hgt = Math.floor(WORLD_H * scale);
  viewport.style.width = w + 'px';
  viewport.style.height = hgt + 'px';
  // Interface scale follows the screen, times the player's Arayüz boyutu setting
  const uiScale = state.settings.uiScale ?? 1;
  viewport.style.setProperty('--ui', String(Math.max(0.6, Math.min(1.15, scale * 1.15)) * uiScale));
  document.documentElement.style.setProperty('--ui-scale', String(uiScale));
  game.resize(w, hgt, viewW);
}
new ResizeObserver(resize).observe(stage);
resize();

initCameraControls(canvas, game);
window.addEventListener('pointerdown', () => game.audio.unlock(), { once: true });
window.addEventListener('keydown', (e) => {
  if (e.key >= '1' && e.key <= '3') {
    const v = Number(e.key);
    if (v > game.speedLimit) {
      if (v === 3) offers.openFast();
      return;
    }
    state.settings.speed = v;
  }
});

let shopTimer = 0;
game.onFrame((dt) => {
  hud.update();
  coach.update(dt);
  if (game.paused) platform.gameplayStop();
  else platform.gameplayStart();
  shopTimer -= dt;
  if (shopTimer <= 0) {
    shopTimer = 0.2;
    shop.refresh();
  }
});

// ---- offline / idle earnings ----------------------------------------------

function grantOffline(seconds) {
  if (seconds < OFFLINE_MIN || state.goldPerSec <= 0) return;
  const { rate, hours } = game.stats.soul.offline;
  const secs = Math.min(seconds, hours * 3600);
  const gold = state.goldPerSec * secs * rate;
  game.addGold(gold);
  showModal(modalRoot, {
    title: tr('🏰 Hoş geldin, Komutan!'),
    body: tr('<p>Sen yokken (<b>{0}</b>) askerlerin kaleyi korudu ve</p>\n           <p class="big-gold">💰 {1} altın</p><p>topladı.</p>', fmtTime(secs), fmt(gold)),
    buttons: [{ label: tr('Topla!'), primary: true, onClick: () => game.audio.play('coin') }],
  });
  saveState(state);
}

function openGuide() {
  showHowToPlay(modalRoot, game, {
    // A guide link leaves any menu and goes straight to what it explains
    onOpen: (tab) => {
      if (menu.isOpen) menu.close();
      startPlaying();
      if (tab === 'inventory') heroWindow.open();
      else shop.setTab(tab);
    },
    onClose: () => {
      state.tutorialSeen = true;
      saveState(state);
    },
  });
}

let hiddenAt = 0;
let wiping = false;
let started = false; // the first Devam Et / Yeni Oyun from the title menu
document.addEventListener('visibilitychange', () => {
  if (wiping || !started) return;
  if (document.hidden) {
    hiddenAt = Date.now();
    saveState(state);
  } else if (hiddenAt) {
    grantOffline((Date.now() - hiddenAt) / 1000);
    hiddenAt = 0;
  }
});
window.addEventListener('beforeunload', () => {
  // Only a game that was actually played gets saved; a closed title screen leaves no save
  if (!wiping && (started || hasSave())) saveState(state);
});

// ---- prestige ---------------------------------------------------------------

function confirmPrestige() {
  const gain = soulsForWave(state.maxWave, game.stats.soul.harvest);
  if (gain <= 0) return;
  const { soul, oath } = game.stats;
  const next = oathById(state.nextOath);
  showModal(modalRoot, {
    title: tr('✨ Yeniden Doğuş'),
    body: tr('<p class="big-gold soul">+{0} 💎 Ruh Taşı</p>\n           {1}\n           <div class="rebirth-lists">\n             <div><b>Sıfırlanır</b><span>Altın ve dalga</span><span>Kahraman ve kale geliştirmeleri</span><span>Birlikler ve köy{2}</span></div>\n             <div><b>Kalır</b><span>Ruh Taşları ve geliştirmeleri</span><span>Elmas, yetenekler, başarımlar</span><span>Eşyalar ve Koleksiyon</span></div>\n           </div>\n           <p><b>Yeni yolculuk:</b> Dalga {3} · 💰 {4} · {5}</p>', fmt(gain), oath.id !== 'none' ? tr('<p>{0} tamamlanıyor: Ruh Taşı x{1}</p>', oath.name, oath.souls) : '', soul.memory ? tr(' ({0}% seviye kalır)', Math.round(soul.memory * 100)) : '', soul.startWave, fmt(soul.startGold), next.name),
    buttons: [
      { label: tr('Vazgeç') },
      { label: tr('Yeniden Doğ!'), primary: true, onClick: () => { game.prestige(); shop.refresh(); } },
    ],
  });
}

// ---- main menu ------------------------------------------------------------------

const NEW_GAME_FLAG = 'cop-kale-new-game';

/** Leave the menu for the battlefield; the first time also pays offline gold. */
function startPlaying() {
  game.paused = false;
  if (started) return;
  started = true;
  grantOffline((Date.now() - state.lastSaved) / 1000);
}

const menu = new MainMenu(document.getElementById('app'), game, {
  hasSave: () => hasSave(),
  onPlay: startPlaying,
  onHelp: openGuide,
  onSettingsChanged: (key) => {
    if (key === 'uiScale') resize();
    shop.refresh();
  },
  onImport: (code) => {
    const error = importSave(code);
    if (error) return error;
    // The imported save must not be overwritten by this session on the way out
    wiping = true;
    location.reload();
    return null;
  },
  onNewGame: () => {
    // Wipe and reload; the flag skips the title menu so the new run starts right away
    wiping = true;
    clearSave();
    try {
      sessionStorage.setItem(NEW_GAME_FLAG, '1');
    } catch {
      /* no session storage: the title menu simply shows again */
    }
    location.reload();
  },
});

let freshStart = false;
try {
  freshStart = sessionStorage.getItem(NEW_GAME_FLAG) === '1';
  sessionStorage.removeItem(NEW_GAME_FLAG);
} catch {
  /* storage blocked */
}
// A first-time player lands straight in the fight; Coach walks them through it
if (freshStart || firstVisit) startPlaying();
else menu.open('title');

if (import.meta.env.DEV) window.game = game; // console debugging

game.start();
