import { WORLD_W, WORLD_H, WALL_FRONT, WALL_TOP, GROUND_Y, GRAVITY, FIXED_DT, WORLD_MIN_X, FIELD_MIN_X, INK } from './constants.js';
import { Audio } from './Audio.js';
import { saveState } from './State.js';
import { computeStats } from '../systems/Stats.js';
import { WaveManager } from '../systems/WaveManager.js';
import { frontmost, densest } from '../systems/Targeting.js';
import { waveScaling, ENEMY_TYPES, isBossWave, bossForWave } from '../config/enemies.js';
import { SPEED } from '../config/rewards.js';
import { ACHIEVEMENTS, gloryPoints, gloryRank, medalOf } from '../config/achievements.js';
import { soulsForWave, UPGRADE_BY_ID } from '../config/upgrades.js';
import { Background } from '../render/Background.js';
import { Castle } from '../entities/Castle.js';
import { Hero } from '../entities/Hero.js';
import { Pet } from '../entities/Pet.js';
import { Vip } from '../entities/Vip.js';
import { Projectile } from '../entities/Projectile.js';
import { Effects } from '../entities/Effects.js';
import { Enemy } from '../entities/Enemy.js';
import { Village } from '../entities/Village.js';
import { SITE_BY_KEY, DEPOT_X } from '../config/village.js';
import { Army } from '../units/Army.js';
import { UNIT_BY_KIND } from '../units/roster.js';
import { OuterWall, OUTER } from '../entities/OuterWall.js';
import { PROPS, catapultMuzzle } from '../render/castleProps.js';
import { SkillSystem } from '../systems/Skills.js';
import { CastleBar } from '../render/castleBar.js';
import { bossGems, GEM_MILESTONES, PRESTIGE_GEMS } from '../config/skills.js';
import { fmt } from '../utils/format.js';
import { rand, lerp, clamp, ballistic } from '../utils/math.js';
import { rollHeroItem, getHeroItemTemplate, getHeroItemRarity, heroItemSellValue, heroItemEssence, recordDiscovery, shouldAutoSell } from '../systems/HeroItems.js';
import { inventoryCapacity } from '../systems/Economy.js';
import { language, tr } from '../i18n/i18n.js';

const SAVE_EVERY = 10;
const GPS_WINDOW = 5;
const ACHIEVE_EVERY = 1;
const STREAK_GAP = 1.5;                      // seconds between kills that keep a streak alive
const STREAK_CALLOUTS = [10, 25, 50, 100, 200];
const BOSS_SLOWMO = 0.9;                     // real seconds of slow motion after a boss falls
const FLASH_TIME = 0.35;
const PAN_SPEED = 900;                       // world units per second while an arrow is held
const MIN_VIEW_LEFT = WORLD_MIN_X;            // leftmost world x the camera may show

export class Game {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.audio = new Audio();
    this.audio.enabled = state.settings.sound;
    this.audio.setVolume(state.settings.volume ?? 0.8);
    this.paused = false; // true while the main menu is open
    this.aim = null;     // world point the player is holding a click on (steady manual fire)
    this.lastManual = -10;

    this.bg = new Background();
    this.castle = new Castle();
    this.outerWall = new OuterWall();
    this.hero = new Hero();
    this.pet = new Pet();
    this.vip = new Vip();
    this.effects = new Effects();
    this.village = new Village();
    this.onVillageTap = null;
    this.onItemDrop = null;
    this.onAchievement = null;
    this.army = new Army();
    this.enemies = [];
    this.projectiles = [];
    this.waves = new WaveManager(this);
    this.skills = new SkillSystem(this);
    this.castleBar = new CastleBar();

    this.time = 0;
    this.shakeAmt = 0;
    const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reducedMotion = !!motionQuery?.matches;
    motionQuery?.addEventListener?.('change', (event) => {
      this.reducedMotion = event.matches;
      if (event.matches) this.shakeAmt = 0;
    });
    this.banner = null;
    this.rainCd = 3;
    this.oilCd = 2;
    this.catapultCd = 3;
    this.bellCd = 0;
    this.interestT = 0;
    this.saveTimer = SAVE_EVERY;
    this.achieveTimer = ACHIEVE_EVERY;
    this.gpsTimer = 0;
    this.gpsGold = 0;
    this.streak = { count: 0, last: -10 };
    this.waveHurt = false;  // castle took damage this wave (for Kusursuz Savunma)
    this.slowT = 0;         // real-time slow motion left
    this.flashT = 0;        // real-time white flash left
    this.view = { scale: 1, dpr: 1, w: WORLD_W, left: 0 };
    // offset: world units panned left of the battle view; vel in units/s
    this.cam = { offset: 0, vel: 0, input: 0, max: 0, goto: null, dragging: false };
    this.effects.coinTarget = () => [this.view.left + this.view.w - 70, 28];
    this.frameListeners = [];

    this.refreshStats();
    this.castle.reset();
    this.bg.snapWave(state.wave);
    this.waves.abort(1.2);
  }

  // ---- setup / stats -------------------------------------------------------

  refreshStats() {
    this.stats = computeStats(this.state);
    this.castle.applyStats(this.stats.castle, this.state.levels);
    this.outerWall.sync(this.stats.castle.outer);
    this.village.sync(this.stats.village);
    this.army.sync(this);
  }

  /** The shield soldiers holding the line (enemies stop at them first). */
  get soldiers() {
    return this.army.soldiers;
  }

  get knight() {
    return this.army.knight;
  }

  /** viewW: visible world width; anything beyond WORLD_W is revealed left of x = 0. */
  resize(cssW, cssH, viewW = WORLD_W) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.view = { scale: cssW / viewW, dpr, w: viewW, left: WORLD_W - viewW };
    // How far the camera may slide left (toward the village) from the battle view
    this.cam.max = Math.max(0, WORLD_W - viewW - MIN_VIEW_LEFT);
    this.cam.offset = clamp(this.cam.offset, 0, this.cam.max);
    this.applyCamera();
  }

  // ---- camera ----------------------------------------------------------------

  /** dir: -1 pans toward the village (left), +1 toward the battle (right), 0 stops. */
  setPan(dir) {
    this.cam.input = dir;
    if (dir) this.cam.goto = null;
  }

  /** Smoothly glide back to the default battle view (or another offset). */
  panTo(offset) {
    this.cam.goto = clamp(offset, 0, this.cam.max);
  }

  /** 2x opens at wave 10 of a run; 3x exists only while ad-bought time is left. */
  get speedLimit() {
    if ((this.state.fastLeft ?? 0) > 0) return 3;
    return this.state.maxWave >= SPEED.wave2 ? 2 : 1;
  }

  get gameSpeed() {
    return Math.min(this.state.settings.speed, this.speedLimit);
  }

  /** Runs on real (not game-speed) time so panning works the same at 1x–3x. */
  updateCamera(dt) {
    const c = this.cam;
    if (c.dragging) return;
    if (c.input) {
      c.vel = lerp(c.vel, -c.input * PAN_SPEED, Math.min(1, dt * 10));
    } else if (c.goto != null) {
      c.offset = lerp(c.offset, c.goto, Math.min(1, dt * 7));
      c.vel = 0;
      if (Math.abs(c.offset - c.goto) < 1) {
        c.offset = c.goto;
        c.goto = null;
      }
    } else {
      c.vel *= Math.max(0, 1 - dt * 5); // momentum after a flick
      if (Math.abs(c.vel) < 2) c.vel = 0;
    }
    c.offset += c.vel * dt;
    if (c.offset <= 0 || c.offset >= c.max) {
      c.offset = clamp(c.offset, 0, c.max);
      if (!c.input) c.vel = 0;
    }
    this.applyCamera();
  }

  applyCamera() {
    this.view.left = WORLD_W - this.view.w - this.cam.offset;
  }

  /** World x at the centre of the screen (for banners and screen-space overlays). */
  get viewCenterX() {
    return this.view.left + this.view.w / 2;
  }

  toWorld(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    return [this.view.left + ((clientX - r.left) / r.width) * this.view.w, ((clientY - r.top) / r.height) * WORLD_H];
  }

  // ---- loop ----------------------------------------------------------------

  start() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.flashT = Math.max(0, this.flashT - dt);
      this.slowT = Math.max(0, this.slowT - dt);
      // Slow motion holds at 30% and eases back to full speed over its last 0.3 s
      const timeScale = this.slowT > 0.3 ? 0.3 : 0.3 + 0.7 * (1 - this.slowT / 0.3);
      // The main menu pauses the world; the camera and drawing keep going behind it
      acc = this.paused ? 0 : acc + dt * this.gameSpeed * timeScale;
      let steps = 0;
      while (acc >= FIXED_DT && steps < 40) {
        this.update(FIXED_DT);
        acc -= FIXED_DT;
        steps++;
      }
      if (steps >= 40) acc = 0;
      this.updateCamera(dt);
      this.render();
      for (const fn of this.frameListeners) fn(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  onFrame(fn) {
    this.frameListeners.push(fn);
  }

  update(dt) {
    const s = this.state;
    this.time += dt;
    s.playTime += dt;

    this.bg.update(dt, this.view);
    this.waves.update(dt);
    this.castle.update(dt, this);
    this.outerWall.update(dt, this);
    this.village.update(dt, this);
    this.hero.update(dt, this);
    this.pet.update(dt, this);
    this.vip.update(dt, this);
    // Hızlandırma counts real playing time, whatever the game speed
    if (s.boostLeft > 0) s.boostLeft = Math.max(0, s.boostLeft - dt / this.gameSpeed);
    if ((s.fastLeft ?? 0) > 0) {
      s.fastLeft = Math.max(0, s.fastLeft - dt / this.gameSpeed);
      if (s.fastLeft === 0 && s.settings.speed > this.speedLimit) s.settings.speed = this.speedLimit;
    }
    if (this.aim && this.hero.manualShot(this, this.aim.x, this.aim.y)) {
      this.count('manualShots');
      this.lastManual = this.time;
    }
    this.army.update(dt, this);

    for (const e of this.enemies) e.update(dt, this);
    this.skills.update(dt);
    this.enemies = this.enemies.filter((e) => !e.removable);

    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.effects.update(dt);

    // Skill
    this.rainCd = Math.max(0, this.rainCd - dt);
    if (s.settings.autoSkill && this.rainCd <= 0 && this.stats.hero.rainArrows > 0) {
      const alive = this.enemies.filter((e) => e.alive && e.x < WORLD_W - 40);
      if (alive.length >= 4 || alive.some((e) => e.boss)) this.castRain();
    }

    // Kaynar Yağ
    const oil = this.stats.castle.oil;
    if (oil) {
      this.oilCd -= dt;
      if (this.oilCd <= 0 && this.pourOil(oil)) this.oilCd = oil.cooldown;
    }

    // Burç Mancınığı
    const catapult = this.stats.castle.catapult;
    if (catapult) {
      this.catapultCd -= dt;
      if (this.catapultCd <= 0 && this.throwStone(catapult)) this.catapultCd = catapult.cooldown;
    }

    // Savaş Çanı
    const bell = this.stats.castle.bell;
    if (bell) {
      this.bellCd -= dt;
      if (this.bellCd <= 0 && this.ringBell(bell)) this.bellCd = bell.cooldown;
    }

    // Altın Kasası: interest on banked gold, capped at ~30 s of income
    const interest = this.stats.castle.interest;
    if (interest) {
      this.interestT += dt;
      if (this.interestT >= 10) {
        this.interestT = 0;
        const gain = Math.min(s.gold * interest, Math.max(50, s.goldPerSec * 30));
        if (gain >= 1) {
          this.addGold(gain);
          this.effects.text(150, WALL_TOP - 60, tr('🏦 +{0} faiz', fmt(gain)), '#ffd34d', 15);
        }
      }
    }

    // Gold-per-second estimate (sim time, so game speed doesn't inflate offline gains)
    this.gpsTimer += dt;
    if (this.gpsTimer >= GPS_WINDOW) {
      const rate = this.gpsGold / this.gpsTimer;
      s.goldPerSec = s.goldPerSec ? lerp(s.goldPerSec, rate, 0.25) : rate;
      this.gpsTimer = 0;
      this.gpsGold = 0;
    }

    this.achieveTimer -= dt;
    if (this.achieveTimer <= 0) {
      this.achieveTimer = ACHIEVE_EVERY;
      this.checkAchievements();
    }

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = SAVE_EVERY;
      saveState(s);
    }

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 30);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
  }

  // ---- combat API used by entities ----------------------------------------

  addProjectile(p) {
    this.projectiles.push(p);
  }

  shake(amount) {
    if (this.reducedMotion || this.state.settings.shake === false) return;
    this.shakeAmt = Math.min(14, Math.max(this.shakeAmt, amount));
  }

  /**
   * What stands between an enemy and the castle: the nearest of the living soldiers and
   * the Dış Sur, else the castle wall.
   */
  findBlocker(enemy) {
    let best = null;
    for (const so of this.soldiers) {
      if (so.alive && so.x < enemy.x + 4 && (!best || so.x > best.x)) best = so;
    }
    const wall = this.outerWall;
    if (wall.alive && OUTER.x1 < enemy.x + 4 && (!best || OUTER.x1 >= best.x)) return this.siegeBlocker();
    if (best) return { x: best.x, halfW: best.halfW, hitY: best.hitY, ref: best };
    return { x: WALL_FRONT, halfW: 0, hitY: rand(470, 560), ref: this.castle };
  }

  /** Siege engines roll past the soldiers but must still batter down the Dış Sur. */
  siegeBlocker() {
    const wall = this.outerWall;
    if (wall.alive) return { x: OUTER.x1, halfW: 0, hitY: wall.hitY, ref: wall };
    return { x: WALL_FRONT, halfW: 0, hitY: rand(470, 560), ref: this.castle };
  }

  /** attacker: the melee enemy that struck (for Dikenli Surlar); absent for thrown spears. */
  enemyHitsBlocker(ref, damage, x, y, size = 1, attacker = null) {
    if (!ref || ref.alive === false) return;
    if (ref === this.castle) {
      if (this.skills.shielded) {
        // İlahi Kalkan absorbs the blow
        this.effects.sparks(WALL_FRONT + 4, y, 4, '#bfe8ff');
        this.skills.fx.shieldHit(y);
        return;
      }
      this.castle.takeDamage(damage, y);
      this.waveHurt = true;
      this.effects.burst(WALL_FRONT + 2, y, Math.round(5 * size), { color: '#6b6474', angleMin: -Math.PI * 0.9, angleMax: -Math.PI * 0.1, speedMin: 40, speedMax: 160 * size, sizeMin: 1.5, sizeMax: 2.5 * size });
      this.audio.play('wall');
      this.shake(1.2 * size);
      const thorns = this.stats.castle.thorns;
      if (thorns && attacker?.alive) {
        this.effects.burst(WALL_FRONT + 4, y, 5, { color: '#8fd16a', angleMin: -0.6, angleMax: 0.6, speedMin: 80, speedMax: 180, lifeMin: 0.15, lifeMax: 0.3, gravity: 0, sizeMin: 1, sizeMax: 2 });
        this.damageEnemy(attacker, attacker.maxHp * thorns, { magic: true, kb: 40, kind: 'thorns' });
      }
      if (this.castle.hp <= 0 && this.castle.alive) this.onCastleFallen();
    } else if (ref === this.outerWall) {
      ref.takeDamage(damage, this, y);
      const wood = ref.tier === 0;
      this.effects.burst(OUTER.x1 + 2, y, Math.round(4 * size), { color: wood ? '#6b4a2e' : '#6b6474', angleMin: -Math.PI * 0.9, angleMax: -Math.PI * 0.1, speedMin: 40, speedMax: 150 * size, sizeMin: 1.5, sizeMax: 2.5 * size });
      this.audio.play('wall');
      this.shake(0.8 * size);
    } else {
      ref.takeDamage(damage, this);
      this.effects.sparks(x, y, Math.round(4 * size), '#ffe2a8');
      this.audio.play('sword');
      if (size > 2) this.shake(4);
    }
  }

  /** opt: { crit, magic, x, y, kb (knockback force), kind, burn (dps to ignite with) } */
  damageEnemy(e, amount, opt = {}) {
    if (!e.alive) return;
    // Suikastçı and Hayalet slip past physical hits; spells always land
    if (e.def.dodge && !opt.magic && Math.random() < e.def.dodge) {
      if (this.state.settings.damageNumbers !== false) this.effects.text(opt.x ?? e.x, e.y - e.h - 6, tr('Iskaladı'), '#c8c0d8', 13);
      return;
    }
    amount *= this.skills.damageMult; // Savaş Narası
    if (e.boss) amount *= this.stats.soul.bossDmg; // Lord Katili
    const dealt = opt.magic ? amount : amount * (1 - e.armor * (1 - (opt.armorPierce ?? 0)));
    e.hp -= dealt;
    e.flash = 0.08;
    e.knockback(opt.kb ?? 30);
    if (opt.burn) e.ignite(opt.burn);
    const x = opt.x ?? e.x;
    const y = opt.y ?? e.centerY;
    const top = e.y - e.h;
    if (opt.crit) {
      this.count('crits');
      if (this.state.settings.damageNumbers !== false) this.effects.text(x, top - 10, fmt(dealt) + '!', '#ffb02e', 22);
      this.effects.sparks(x, y, 8);
      this.audio.play('crit');
    } else {
      const color = { thorns: '#a8f08a', oil: '#ffb347', frostball: '#bfe8ff', cannonball: '#ffcf8a', storm: '#bfe3ff' }[opt.kind] ?? (opt.magic ? '#e2b8ff' : '#ffffff');
      if (this.state.settings.damageNumbers !== false) this.effects.text(x, top - 6, fmt(dealt), color, 14);
      this.audio.play('hit');
    }
    // Armored enemies spark instead of bleeding ink
    if (e.armor >= 0.3 && !opt.magic) this.effects.sparks(x, y, 3, '#e6e9f0');
    else this.effects.ink(x, y, 4);
    if (e.hp <= 0) this.killEnemy(e, opt.kb ?? 30);
  }

  killEnemy(e, force = 30) {
    e.alive = false;
    e.hp = 0;
    if (this.skills.active.midas > 0) {
      this.skills.fx.goldKill(e);
      this.count('midasKills');
    }
    e.dyingT = 0;
    e.knockback(80 + force);
    const gold = e.gold * this.stats.castle.goldMult * this.skills.goldMult;
    this.addGold(gold);
    this.state.kills++;
    if (e.boss) {
      this.count('bossKills');
      (this.state.bossesSlain ??= {})[e.type] = true;
    }
    if (e.def.split) this.spawnBeside(e, ...e.def.split);
    if (e.siege) this.count('siegeKills');
    if (e.fly) this.count('flyerKills');
    this.bumpStreak();
    this.effects.text(e.x, e.y - e.h - 26, '+' + fmt(gold), '#ffd34d', e.boss ? 30 : 17);
    if (e.siege) {
      // Splintered timber instead of ink
      for (const color of ['#4a3324', INK]) {
        this.effects.burst(e.x, e.y - 30, 10, { color, angleMin: -Math.PI * 0.95, angleMax: -Math.PI * 0.05, speedMin: 80, speedMax: 260, sizeMin: 2, sizeMax: 4.5 });
      }
      this.effects.dust(e.x, e.y, 2.2);
      this.shake(4);
    } else {
      this.effects.ink(e.x, e.centerY, e.boss ? 40 : 12);
      this.effects.pool(e.x + 20 * e.s, e.s);
    }
    this.effects.coinBurst(e.x, e.centerY, e.boss ? 14 : Math.min(4, 1 + Math.floor(e.s * 1.5)), WORLD_W - 70, 28);
    this.audio.play('die');
    this.audio.play('coin');
    const item = rollHeroItem(this.state.wave, e.boss, e.type, this.stats.soul.drop);
    if (item) {
      this.state.heroInventory ??= [];
      const rarity = getHeroItemRarity(item);
      this.count('itemsFound');
      if (rarity.id === 'legendary') this.count('legendaries');
      // A pillar of the rarity colour marks where the loot fell
      this.effects.beam(e.x, rarity.color, rarity.id === 'legendary' || rarity.id === 'epic' ? 1.6 : 1.1);
      if (['rare', 'epic', 'legendary'].includes(rarity.id)) this.audio.play('loot');
      const autoSold = shouldAutoSell(this.state, item);
      recordDiscovery(this.state, item);
      if (!autoSold && this.state.heroInventory.length < inventoryCapacity(this.state)) {
        item.fresh = true; // marked YENİ in the inventory until the window is opened and closed
        this.state.heroInventory.push(item);
        this.effects.text(e.x, e.y - e.h - 48, `✦ ${this.itemName(item)}`, rarity.id === 'common' ? '#9fe3ff' : rarity.color, e.boss ? 22 : 16);
        this.onItemDrop?.(item);
      } else {
        // Full bag or Otomatik Satış: sold on the spot so the kill still pays out
        const value = heroItemSellValue(item);
        this.addGold(value);
        this.state.heroEssence = (this.state.heroEssence ?? 0) + heroItemEssence(item);
        this.effects.text(e.x, e.y - e.h - 48, `${autoSold ? tr('Satıldı') : tr('Envanter dolu')} · +${fmt(value)}`, '#ffd34d', 14);
      }
    }
    if (e.boss) {
      this.shake(12);
      this.slowT = BOSS_SLOWMO;
      if (!this.reducedMotion) this.flashT = FLASH_TIME;
      this.effects.explosion(e.x, e.centerY, 120, ['#ffe28a', '#ffd34d', '#fff']);
      const s = this.state;
      const first = s.wave > s.bestBossWave;
      const gems = bossGems(s.wave, first, this.stats.talent.bossGems);
      if (first) s.bestBossWave = s.wave;
      this.addGems(gems, e.x, e.y - e.h - 50);
      this.showBanner(tr('{0} Yenildi!', e.def.name), tr('+{0} altın · +{1} 💠 Elmas{2}', fmt(gold), gems, item ? tr(' · {0} düştü', this.itemName(item)) : ''), '#ffd34d');
    }
  }

  itemName(item) {
    return getHeroItemTemplate(item)?.name ?? tr('Eşya');
  }

  // ---- achievements & tallies ------------------------------------------------

  /** Adds to a lifetime tally in state.counters. */
  count(key, n = 1) {
    const c = (this.state.counters ??= {});
    c[key] = (c[key] ?? 0) + n;
  }

  /** Kills in quick succession build a streak; milestones get a callout. */
  bumpStreak() {
    const st = this.streak;
    st.count = this.time - st.last <= STREAK_GAP ? st.count + 1 : 1;
    st.last = this.time;
    const c = (this.state.counters ??= {});
    if (st.count > (c.bestStreak ?? 0)) c.bestStreak = st.count;
    if (STREAK_CALLOUTS.includes(st.count)) {
      this.effects.text(this.viewCenterX + 200, 330, tr('{0}\'lik SERİ!', st.count), st.count >= 50 ? '#ff7a4a' : '#ffb347', st.count >= 50 ? 34 : 28);
      this.audio.play('streak');
    }
  }

  /** Unlocks every achievement whose goal is met; pays Elmas and raises Şan. */
  checkAchievements() {
    const s = this.state;
    s.achievements ??= {};
    const rankBefore = gloryRank(gloryPoints(s)).index;
    const unlocked = [];
    for (const a of ACHIEVEMENTS) {
      if (s.achievements[a.id] || a.value(s) < a.goal) continue;
      s.achievements[a.id] = Date.now();
      s.gems += a.gems;
      s.totalGems = (s.totalGems ?? 0) + a.gems;
      unlocked.push(a);
    }
    if (!unlocked.length) return;
    this.refreshStats(); // Şan raises damage and gold
    this.audio.play('achieve');
    const { index, rank } = gloryRank(gloryPoints(s));
    const rankUp = index > rankBefore ? rank : null;
    this.celebrateAchievements(unlocked, rankUp);
    this.onAchievement?.(unlocked, rankUp);
    saveState(s);
  }

  /** Confetti in the medal's colours over the castle; a new rank gets the whole field. */
  celebrateAchievements(list, rankUp) {
    const colors = [...new Set(list.map((a) => medalOf(a).color))];
    const best = Math.max(...list.map((a) => a.gems));
    const x = 130;
    for (const color of colors) {
      this.effects.burst(x, WALL_TOP - 90, 20 + best * 14, { color, angleMin: -Math.PI, angleMax: 0, speedMin: 90, speedMax: 340, gravity: 300, glow: true, lifeMin: 0.7, lifeMax: 1.5, sizeMin: 1.5, sizeMax: 3.5 });
    }
    this.effects.rings.push({ x, y: WALL_TOP - 60, r: 12, max: 120 + best * 40, life: 0.6, maxLife: 0.6, color: colors[0] });
    if (!rankUp) return;
    for (let i = 0; i < 90; i++) {
      this.effects.burst(rand(this.view.left, WORLD_W), rand(-30, 40), 1, { color: ['#ffd34d', '#ffb347', '#fff1b8', '#9fd0ff'][i % 4], angleMin: 1.2, angleMax: 1.9, speedMin: 40, speedMax: 170, gravity: 90, drag: 0.4, lifeMin: 1.6, lifeMax: 3, sizeMin: 2, sizeMax: 4 });
    }
    this.shake(5);
    this.audio.play('wave');
  }

  /** Reinforcements appear around `e` (summoned, or split from it as it died). */
  spawnBeside(e, type, n) {
    for (let i = 0; i < n; i++) {
      const add = new Enemy(type, e.wave, this.stats.oath.enemyHp);
      add.x = Math.min(WORLD_W, e.x + (i - (n - 1) / 2) * 34 + rand(-6, 6));
      add.burrowed = false;
      this.enemies.push(add);
      this.effects.dust(add.x, add.y, 1.2);
    }
    this.onEnemySpawn?.(type);
  }

  /** A boss's shockwave: every soldier near it takes a share of its blow. */
  bossStomp(e) {
    const radius = 200;
    this.effects.rings.push({ x: e.x, y: GROUND_Y - 4, r: 20, max: radius, life: 0.5, maxLife: 0.5, color: '#bfe8ff' });
    this.effects.dust(e.x, GROUND_Y, 3);
    this.shake(6);
    this.audio.play('ram');
    for (const so of this.soldiers) if (so.alive && Math.abs(so.x - e.x) < radius) so.takeDamage(e.damage * 0.5, this);
  }

  onBossEnrage(e) {
    this.showBanner(tr('{0} Öfkelendi!', e.def.name), tr('Daha hızlı, daha sert vuruyor'), '#ff7a4a', 1.8);
    this.effects.burst(e.x, e.centerY, 30, { color: '#ff7a3c', speedMin: 60, speedMax: 240, gravity: -40, glow: true, lifeMin: 0.4, lifeMax: 0.9 });
    this.shake(7);
    this.audio.play('boss');
  }

  /** First appearance of an enemy type: introduce it with a banner. */
  onEnemySpawn(type) {
    const s = this.state;
    s.seenEnemies ??= [];
    if (s.seenEnemies.includes(type)) return;
    s.seenEnemies.push(type);
    const def = ENEMY_TYPES[type];
    if (def.intro) this.showBanner(tr('Yeni Düşman: {0}', def.name), def.intro, '#ffb347', 3.2);
  }

  addGems(n, x, y) {
    const s = this.state;
    s.gems += n;
    s.totalGems = (s.totalGems ?? 0) + n;
    if (x != null) this.effects.text(x, y, `+${n} 💠`, '#7fe6ff', 24);
    this.audio.play('buy');
  }

  /** Stage milestones: Elmas the first time the best wave ever reaches set waves. */
  checkMilestones() {
    const s = this.state;
    const prev = s.bestWave;
    s.bestWave = Math.max(s.bestWave, s.maxWave);
    for (const [wave, gems] of GEM_MILESTONES) {
      if (prev < wave && s.bestWave >= wave) {
        this.addGems(gems);
        this.showBanner(tr('Aşama: Dalga {0}', wave), tr('+{0} 💠 Elmas — yeni yetenekleri kontrol et', gems), '#7fe6ff', 3);
      }
    }
  }

  /** slow: fraction of speed removed from everyone caught in a frost blast. */
  explode(x, y, radius, damage, magic, kind, slow = 0, burn = 0) {
    const palette = { fireball: ['#fff1a8', '#ff9a3c', '#c2302a'], bomb: ['#fff1a8', '#ff8a36', '#853523'], frostball: ['#ffffff', '#bfe8ff', '#4f9cff'] }[kind];
    this.effects.explosion(x, y, radius, palette);
    this.shake(kind === 'meteor' ? 12 : kind === 'cannonball' ? 6 : kind === 'frostball' ? 1.5 : 3);
    this.audio.play(kind === 'frostball' ? 'frost' : 'boom');
    for (const e of this.enemies) {
      if (!e.alive || e.burrowed) continue;
      const d = Math.abs(e.x - x);
      if (d > radius + e.w * 0.5 || Math.abs(e.centerY - y) > radius + e.h * 0.5) continue;
      if (slow) e.slow(slow);
      this.damageEnemy(e, damage * (1 - 0.5 * Math.min(1, d / radius)), { magic, kind, x: e.x, y: e.centerY, kb: kind === 'cannonball' ? 160 : kind === 'frostball' ? 20 : 90, burn });
    }
  }

  /** Kaynar Yağ: scalding oil poured from the wall onto everyone at its foot. */
  pourOil(oil) {
    const reach = WALL_FRONT + 95;
    const targets = this.enemies.filter((e) => e.alive && e.x < reach);
    if (!targets.length) return false;
    for (let i = 0; i < 26; i++) {
      this.effects.burst(WALL_FRONT + rand(-8, 6), WALL_TOP + 6, 1, { color: Math.random() < 0.5 ? '#c98a2a' : '#7a4a14', angleMin: -0.1, angleMax: 0.7, speedMin: 60, speedMax: 200, lifeMin: 0.4, lifeMax: 0.7, gravity: 900, sizeMin: 2, sizeMax: 4 });
    }
    this.effects.burst((WALL_FRONT + reach) / 2, GROUND_Y - 4, 18, { color: 'rgba(230,200,150,0.45)', angleMin: -Math.PI, angleMax: 0, speedMin: 20, speedMax: 70, lifeMin: 0.6, lifeMax: 1.2, gravity: -60, drag: 1, sizeMin: 6, sizeMax: 12, shrink: false });
    for (const e of targets) this.damageEnemy(e, oil.damage, { magic: true, kind: 'oil', kb: 30 });
    this.audio.play('oil');
    this.castle.pourT = 0.8; // tip the cauldron
    return true;
  }

  /** Burç Mancınığı: a stone from the keep at the thickest knot of ground enemies. */
  throwStone(catapult) {
    const target = densest(this.enemies.filter((e) => !e.fly), catapult.radius);
    if (!target) return false;
    const [sx, sy] = catapultMuzzle();
    const shot = ballistic(sx, sy, target.x - (target.walking ? target.speed : 0), GROUND_Y - 10, GRAVITY, 500, 1, 1.6);
    this.addProjectile(new Projectile('stone', sx, sy, shot.vx, shot.vy, { damage: catapult.damage, radius: catapult.radius }));
    this.castle.startThrow();
    this.count('stonesThrown');
    this.audio.play('catapult');
    return true;
  }

  /** Savaş Çanı: tolls once something nears the wall and slows everything close by. */
  ringBell(bell) {
    const alarm = WALL_FRONT + 160;
    if (!this.enemies.some((e) => e.alive && e.x < alarm)) return false;
    for (const e of this.enemies) if (e.alive && e.x < alarm + 240) e.slow(bell.slow, bell.duration);
    this.castle.startRing();
    this.count('bellRings');
    this.audio.play('bell');
    return true;
  }

  addGold(n) {
    this.state.gold += n;
    this.state.totalGold += n;
    this.gpsGold += n;
  }

  /** Sparkle on whatever unit an upgrade just improved. */
  celebrateUpgrade(id) {
    const at = [];
    if (id.startsWith('hero') || id.startsWith('soul')) at.push([this.hero.x, this.hero.y - 35]);
    else if (id.startsWith('castleOuter')) at.push([OUTER.gate, this.outerWall.top - 10]);
    else if (id === 'castleCatapult') at.push([PROPS.catapult.x, PROPS.catapult.y]);
    else if (id === 'castleBell') at.push([PROPS.bell.x, PROPS.bell.y]);
    else if (id === 'castleBeacon') at.push([PROPS.beacon.x, PROPS.beacon.y - 10]);
    else if (id === 'castleStores') at.push([66, GROUND_Y - 30]);
    else if (id.startsWith('castle')) at.push([130, WALL_TOP + 40]);
    else if (id.startsWith('village')) {
      const site = UPGRADE_BY_ID[id].site;
      at.push([SITE_BY_KEY[site]?.workX ?? DEPOT_X, GROUND_Y - 30]);
    } else if (UPGRADE_BY_ID[id]?.kind && UNIT_BY_KIND[UPGRADE_BY_ID[id].kind]) {
      at.push(...this.army.positionsOf(UPGRADE_BY_ID[id].kind));
    }
    const color = id.startsWith('soul') ? '#c9a6ff' : '#ffe9a8';
    for (const [x, y] of at) {
      this.effects.burst(x, y, 14, { color, speedMin: 40, speedMax: 140, gravity: -60, glow: true, lifeMin: 0.4, lifeMax: 0.8, sizeMin: 1.5, sizeMax: 3 });
      this.effects.rings.push({ x, y: y + 30, r: 6, max: 34, life: 0.4, maxLife: 0.4 });
    }
  }

  // ---- skills & player input ----------------------------------------------

  castRain() {
    const n = this.stats.hero.rainArrows;
    if (!n || this.rainCd > 0) return false;
    const target = frontmost(this.enemies);
    if (!target) return false;
    const st = this.stats.hero;
    this.rainCd = st.rainCooldown;
    for (let i = 0; i < n; i++) {
      const crit = Math.random() < st.critChance;
      const x = target.x + rand(-40, 300);
      const y = -30 - rand(0, 520);
      this.addProjectile(new Projectile('rain', x, y, -70, 620, { damage: st.damage * 2 * (crit ? st.critMult : 1), crit }));
    }
    this.skills.fx.rain(target.x);
    this.count('skillCasts');
    this.audio.play('rain');
    this.showBanner(tr('Ok Yağmuru!'), '', '#9fd0ff', 1.2);
    return true;
  }

  /** Start (or move) a held aim on the battlefield; returns false outside the field. */
  aimAt(clientX, clientY) {
    this.audio.unlock();
    const [x, y] = this.toWorld(clientX, clientY);
    if (x <= FIELD_MIN_X || y >= GROUND_Y + 10) return false;
    this.aim = { x, y };
    return true;
  }

  releaseAim() {
    this.aim = null;
  }

  tapAt(clientX, clientY) {
    this.audio.unlock();
    const [x, y] = this.toWorld(clientX, clientY);
    if (this.vip.hit(x, y)) {
      this.onVipTap?.();
      return;
    }
    if (x > FIELD_MIN_X && y < GROUND_Y + 10) {
      if (this.hero.manualShot(this, x, y)) {
        this.count('manualShots');
        this.lastManual = this.time;
      }
    }
    else if (x < -300 && y > GROUND_Y - 140) this.onVillageTap?.(); // clicked the village plots
  }

  // ---- wave flow -----------------------------------------------------------

  onWaveStart(wave, boss) {
    const region = this.bg.setWave(wave);
    this.outerWall.rebuild(this);
    this.waveHurt = false;
    // Erzak Ambarı: the garrison patches the walls before each wave
    const stores = this.stats.castle.stores;
    if (stores) {
      if (this.castle.hp < this.castle.maxHp) {
        this.castle.heal(this.castle.maxHp * stores);
        this.effects.text(66, WALL_TOP - 60, tr('+%{0} onarım', Math.round(stores * 100)), '#9fe39a', 16);
      }
      this.outerWall.heal(this.outerWall.maxHp * stores);
    }
    if (boss) {
      this.showBanner(tr('Dalga {0}', wave), tr('{0} GELİYOR!', ENEMY_TYPES[bossForWave(wave)].name.toLocaleUpperCase(language())), '#ff5a4a', 3);
      this.audio.play('boss');
      this.shake(6);
    } else {
      this.showBanner(tr('Dalga {0}', wave), region ? tr('Yeni bölge: {0}', region.name) : '', '#ffffff', region ? 3 : 1.8);
      this.audio.play('wave');
    }
  }

  onWaveCleared() {
    const s = this.state;
    this.onWaveBreak?.(s.wave);
    const bonus = Math.round((5 + s.wave * 2) * waveScaling(s.wave).gold * this.stats.castle.goldMult);
    this.addGold(bonus);
    this.effects.text(this.viewCenterX, 210, tr('Dalga temizlendi! +{0}', fmt(bonus)), '#ffd34d', 24);
    if (!this.waveHurt) {
      this.count('perfectWaves');
      if (isBossWave(s.wave)) this.count('perfectBosses');
      this.effects.text(this.viewCenterX, 176, tr('🛡️ Kusursuz savunma!'), '#9fe3ff', 18);
    }
    if (s.settings.autoAdvance) {
      s.wave++;
      s.maxWave = Math.max(s.maxWave, s.wave);
      this.checkMilestones();
    }
    saveState(s);
  }

  onCastleFallen() {
    const s = this.state;
    this.castle.alive = false;
    this.count('castleFalls');
    this.streak.count = 0;
    this.audio.play('lose');
    this.shake(14);
    this.effects.explosion(WALL_FRONT - 20, 500, 90, ['#cfc7b8', '#8a8296', '#4a4452']);
    this.castle.collapseEffects(this);
    const back = Math.max(1, s.wave - 2);
    this.showBanner(tr('Kale Düştü!'), back < s.wave ? tr('Dalga {0}\'e geri çekiliyoruz...', back) : tr('Yeniden toparlanıyoruz...'), '#ff6b5a', 3);
    for (const e of this.enemies) if (e.alive) { e.alive = false; e.dyingT = 0.3; }
    this.projectiles = [];
    s.wave = back;
    this.waves.abort(3.5);
    // Rebuild instantly; the pause before the next wave is the "retreat"
    this.castle.reset();
    this.outerWall.rebuild(this, true);
    for (const so of this.soldiers) { so.alive = true; so.hp = so.maxHp; }
    saveState(s);
    this.onCastleFell?.(back);
  }

  /**
   * Yeniden Doğuş: trade this run's progress for Ruh Taşı. Gold, waves and gold
   * upgrades reset; souls, soul upgrades and lifetime stats stay.
   */
  prestige() {
    const s = this.state;
    const gain = soulsForWave(s.maxWave, this.stats.soul.harvest);
    if (gain <= 0) return 0;
    s.souls += gain;
    s.totalSouls += gain;
    s.prestiges++;
    s.prestigeLog = [{ wave: s.maxWave, souls: gain, time: s.playTime - (s.runStart ?? 0), oath: s.oath }, ...(s.prestigeLog ?? [])].slice(0, 5);
    s.runStart = s.playTime;
    if (s.oath !== 'none') this.count('oathRuns');
    s.oath = s.nextOath ?? 'none';
    // Kadim Hafıza carries part of every gold upgrade into the new run
    const keep = this.stats.soul.memory;
    s.levels = Object.fromEntries(Object.entries(s.levels).map(([id, level]) => [id, Math.floor(level * keep)]).filter(([, level]) => level > 0));
    this.addGems(PRESTIGE_GEMS + this.stats.soul.gems);
    // Hızlı Başlangıç lets a new run begin further ahead
    const start = this.stats.soul.startWave;
    s.wave = start;
    s.maxWave = start;
    s.goldPerSec = 0;

    this.enemies = [];
    this.projectiles = [];
    this.army.reset();
    this.effects.clear();
    this.refreshStats();
    s.gold = this.stats.soul.startGold;
    this.castle.reset();
    this.rainCd = 3;
    this.skills.reset();
    this.bg.setWave(start);
    this.waves.abort(2.5);

    this.effects.burst(this.hero.x, this.hero.y - 40, 60, { color: '#b98cff', speedMin: 60, speedMax: 320, gravity: -40, glow: true, lifeMin: 0.6, lifeMax: 1.4, sizeMin: 2, sizeMax: 4 });
    this.onPrestige?.(gain);
    this.audio.play('wave');
    saveState(s);
    return gain;
  }

  /** Lets the player replay or skip ahead to a wave they already reached. */
  jumpToWave(wave) {
    const s = this.state;
    s.wave = Math.max(1, Math.min(s.maxWave, wave));
    for (const e of this.enemies) if (e.alive) { e.alive = false; e.dyingT = 0.6; }
    this.projectiles = [];
    this.waves.abort(1);
  }

  showBanner(text, sub = '', color = '#fff', dur = 2) {
    this.banner = { text, sub, color, dur, t: 0 };
  }

  // ---- rendering -----------------------------------------------------------

  render() {
    const ctx = this.ctx;
    const { scale, dpr, left, w } = this.view;
    // World x = `left` maps to the left edge of the canvas
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, -left * scale * dpr, 0);
    ctx.save();
    if (this.shakeAmt > 0) ctx.translate(rand(-1, 1) * this.shakeAmt, rand(-1, 1) * this.shakeAmt);

    this.bg.low = this.state.settings.quality === 'low';
    const { night, pal } = this.bg.draw(ctx, this.time, left, w);
    // Tint only the scenery so silhouettes stay crisp against the night sky
    this.bg.drawNightTint(ctx, left, w);
    if (left < 0) this.village.draw(ctx, pal, night);
    this.army.drawBack(ctx, this.stats.allies);
    this.castle.draw(ctx, night, pal, this.bg.time);
    this.outerWall.draw(ctx, pal, night);
    this.army.drawPosts(ctx, this.stats.allies);
    this.hero.draw(ctx);
    this.pet.draw(ctx, this);
    this.vip.draw(ctx);
    this.effects.drawGround(ctx);
    this.skills.drawGround(ctx);
    this.army.drawField(ctx, this.stats.allies);
    // Draw living enemies after the dead ones so corpses stay behind
    for (const e of this.enemies) if (!e.alive) e.draw(ctx);
    for (const e of this.enemies) if (e.alive) e.draw(ctx);
    for (const p of this.projectiles) p.draw(ctx);
    this.effects.draw(ctx);
    this.skills.drawOverlays(ctx, left, w);
    this.castleBar.draw(ctx, this.castle, this.time, this.skills.shielded);
    this.bg.drawForeground(ctx, this.time, left, w);
    ctx.restore();

    this.drawVignette(ctx);
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,248,230,${(this.flashT / FLASH_TIME) * 0.5})`;
      ctx.fillRect(left, 0, w, WORLD_H);
    }
    this.drawBossBar(ctx);
    this.drawBanner(ctx);
    this.drawAimHint(ctx);
  }

  /** Before Otomatik Atış, remind an idle player that the hero shoots where they click. */
  drawAimHint(ctx) {
    if (this.stats.hero.autoFire || this.paused || this.time - this.lastManual < 3) return;
    if (!this.enemies.some((e) => e.alive && e.x < WORLD_W - 30)) return;
    const a = 0.65 + 0.35 * Math.sin(this.time * 5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = '800 26px Nunito, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(10,8,16,0.85)';
    const text = tr('🎯 Düşmanlara tıkla — basılı tutunca seri atış!');
    ctx.strokeText(text, this.viewCenterX + 120, 330);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(text, this.viewCenterX + 120, 330);
    ctx.restore();
  }

  /** Red pulsing edges when the castle is in danger or a boss is on the field. */
  drawVignette(ctx) {
    const hpRatio = this.castle.hp / this.castle.maxHp;
    const danger = Math.max(hpRatio < 0.35 ? (0.35 - hpRatio) / 0.35 : 0, this.enemies.some((e) => e.boss && e.alive) ? 0.35 : 0);
    if (danger <= 0) return;
    const a = danger * (0.35 + 0.15 * Math.sin(this.time * 5));
    const { left, w } = this.view;
    const cx = this.viewCenterX;
    const g = ctx.createRadialGradient(cx, WORLD_H / 2, WORLD_H * 0.45, cx, WORLD_H / 2, w * 0.7);
    g.addColorStop(0, 'rgba(160,0,0,0)');
    g.addColorStop(1, `rgba(160,10,10,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(left, 0, w, WORLD_H);
  }

  drawBossBar(ctx) {
    const boss = this.enemies.find((e) => e.boss && e.alive);
    if (!boss) {
      this.bossTrail = 1;
      return;
    }
    const ratio = boss.hp / boss.maxHp;
    // Lagging white bar shows chunks of damage
    this.bossTrail = Math.max(ratio, (this.bossTrail ?? 1) - 0.004);
    const w = 420;
    const x = this.viewCenterX - w / 2;
    const y = 122; // below the HUD wave panel
    ctx.fillStyle = 'rgba(10,6,12,0.75)';
    ctx.fillRect(x - 4, y - 4, w + 8, 22);
    ctx.fillStyle = '#5a0f14';
    ctx.fillRect(x, y, w, 14);
    ctx.fillStyle = '#ffe9d6';
    ctx.fillRect(x, y, w * this.bossTrail, 14);
    ctx.fillStyle = boss.flash > 0 ? '#ff8a7a' : '#e8453c';
    ctx.fillRect(x, y, w * ratio, 14);
    ctx.font = '700 15px Cinzel, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd9cf';
    ctx.fillText(`${boss.def.name} — ${fmt(boss.hp)}`, this.viewCenterX, y - 9);
  }

  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const inT = Math.min(1, b.t / 0.25);
    const outT = Math.min(1, (b.dur - b.t) / 0.4);
    const a = Math.max(0, Math.min(inT, outT));
    const scale = 0.8 + 0.2 * inT;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.viewCenterX, 250);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.font = '800 56px Cinzel, serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(10,8,16,0.85)';
    ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, 0, 0);
    if (b.sub) {
      ctx.font = '800 24px Nunito, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeText(b.sub, 0, 40);
      ctx.fillStyle = '#ffe9d6';
      ctx.fillText(b.sub, 0, 40);
    }
    ctx.restore();
  }
}
