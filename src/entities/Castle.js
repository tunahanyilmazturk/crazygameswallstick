import { GROUND_Y, WALL_TOP, WALL_FRONT, TOWER_TOP, FORTRESS_TIERS, INK } from '../core/constants.js';
import { rand, lerp, lerpColor, mulberry32 } from '../utils/math.js';
import { drawFigure } from '../render/stick.js';
import { drawCatapult, drawBell, drawBeacon, drawStores } from '../render/castleProps.js';
import { damageStage, drawBreach, drawCracks, drawFire, drawRubble, drawScorch, clipBrokenTop, crumble } from '../render/battleDamage.js';
import { tr } from '../i18n/i18n.js';

// Building footprints (units stand on WALL_TOP and TOWER_TOP, so those stay fixed)
const TOWER = { x0: 10, x1: 122 };
// Rear rampart behind the tower: as high as the front walkway so a squad can stand on it
export const REAR = { x0: -280, x1: 10, top: WALL_TOP };
const GATE = { cx: 180, r: 30, spring: 556 };
// Round tower closing the wall; its face is the WALL_FRONT that enemies batter
const DRUM = { x0: 224, x1: 262 };
// Hall roof seen over the curtain wall (behind the walkway units)
const HALL = { x0: 128, x1: 206, eave: 410, ridge: 386 };
// Daylight stone per fortress tier: rough field stone up to pale dressed limestone
const TIER_STONE = ['#676270', '#7f786f', '#a0967f', '#c9bca0'];
const MORTAR = '#121016';
const GOLD = '#e2b33c';
const IRON = '#3a3842';
const SCAFFOLD = { x0: 124, x1: 146 };
const THROW_TIME = 1.1; // Burç Mancınığı arm swing
const RING_TIME = 1.2;  // Savaş Çanı rocking
const MAX_SCARS = 14;   // chips left on the front tower by individual hits

// Damage by stage: crack paths appear two per stage, then breaches, scorch marks and fires
const CRACKS = [
  [[250, 454], [241, 474], [247, 492], [236, 520]],
  [[100, 402], [92, 420], [99, 436], [88, 462]],
  [[214, 456], [207, 472], [213, 484], [203, 500]],
  [[24, 416], [36, 442], [30, 458], [42, 484]],
  [[232, 540], [242, 558], [236, 582]],
  [[-60, 470], [-70, 490], [-62, 505], [-74, 532]],
];
const BREACHES = [[211, 482, 10], [44, 432, 10], [242, 520, 12], [92, 412, 12], [-120, 505, 13]];
const SCORCH = [[211, 490, 28], [44, 440, 24], [242, 530, 24]];
const FIRES = [[206, 452, 1], [92, 402, 1.15], [244, 500, 0.8], [-120, 492, 0.9]];
const DRUM_RUIN = [[220, 472], [226, 448], [232, 458], [239, 428], [246, 446], [252, 436], [258, 464], [266, 480]];

/**
 * What the castle upgrades look like (from saved levels): `wall` is the Taş Duvarlar tier,
 * the others are the upgrade levels themselves (0 = not bought).
 */
function castleLook(levels = {}) {
  const l = (id) => levels[id] ?? 0;
  return {
    wall: FORTRESS_TIERS.filter((t) => l('castleHp') >= t.level).length - 1,
    armor: l('castleArmor'),
    thorns: l('castleThorns'),
    oil: l('castleOil'),
    gold: l('castleGold'),
    vault: l('castleInterest'),
    repair: l('castleRegen'),
    catapult: l('castleCatapult'),
    bell: l('castleBell'),
    stores: l('castleStores'),
    beacon: l('castleBeacon'),
  };
}

/** Rows of irregular stone blocks covering a rectangle: [x, y, w, h, shade]. */
function masonry(rng, x0, x1, y0, y1) {
  const blocks = [];
  let row = 0;
  for (let y = y0; y < y1; y += 15, row++) {
    const h = Math.min(15, y1 - y);
    let x = x0 - (row % 2 ? 9 : 0);
    while (x < x1) {
      const w = 16 + rng() * 16;
      const bx = Math.max(x, x0);
      const bw = Math.min(x + w, x1) - bx;
      if (bw > 3) blocks.push([bx, y, bw, h, (rng() - 0.5) * 0.22]);
      x += w;
    }
  }
  return blocks;
}

export class Castle {
  constructor() {
    this.maxHp = 100;
    this.hp = 100;
    this.regen = 0;
    this.armor = 0;
    this.flash = 0;
    this.alive = true;
    this.t = 0;
    this.look = castleLook();
    this.pourT = 0;        // Kaynar Yağ cauldron tipping animation
    this.throwT = 0;       // Burç Mancınığı arm swing
    this.ringT = 0;        // Savaş Çanı rocking
    this.scars = [];       // [x, y, r] chips where blows landed
    this.lastHitY = 520;
    this.shownStage = 0;   // stage the castle was last drawn at, to catch changes
    this.repairing = false;

    const rng = mulberry32(77);
    this.stones = {
      back: masonry(rng, REAR.x0, REAR.x1, REAR.top + 8, GROUND_Y),
      wall: masonry(rng, 0, WALL_FRONT, WALL_TOP + 8, GROUND_Y),
      tower: masonry(rng, TOWER.x0, TOWER.x1, TOWER_TOP + 14, GROUND_Y),
    };
    this.ivy = Array.from({ length: 26 }, () => [rng() * WALL_FRONT, GROUND_Y - rng() * 50, 3 + rng() * 5]);
    this.rubble = Array.from({ length: 15 }, () => [DRUM.x0 + 26 + rng() * 34, 3 + rng() * 4, (rng() - 0.5) * 1.4]);
  }

  get stage() {
    return damageStage(this.hp / this.maxHp);
  }

  /** levels: saved upgrade levels, so the castle can show what has been bought. */
  applyStats(st, levels) {
    this.look = castleLook(levels);
    const ratio = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = st.maxHp;
    this.hp = Math.min(this.maxHp, Math.max(this.hp, ratio * this.maxHp));
    this.regen = st.regen;
    this.armor = st.armor;
  }

  reset() {
    this.hp = this.maxHp;
    this.alive = true;
    this.scars.length = 0;
    this.shownStage = 0;
  }

  startThrow() {
    this.throwT = THROW_TIME;
  }

  startRing() {
    this.ringT = RING_TIME;
  }

  /** y: where the blow landed on the wall face. */
  takeDamage(amount, y = this.lastHitY) {
    const dealt = amount * (1 - this.armor);
    this.hp = Math.max(0, this.hp - dealt);
    this.flash = 0.12;
    this.lastHitY = y;
    // Heavy blows chip the stone; the chips stay until the wall is repaired
    if (dealt > this.maxHp * 0.01 || Math.random() < 0.2) {
      if (this.scars.length >= MAX_SCARS) this.scars.shift();
      this.scars.push([rand(DRUM.x0 + 8, DRUM.x1 - 3), y, rand(1.8, 4)]);
    }
    return dealt;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt, game) {
    const effects = game.effects;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.pourT = Math.max(0, this.pourT - dt);
    this.throwT = Math.max(0, this.throwT - dt);
    this.ringT = Math.max(0, this.ringT - dt);
    if (this.hp > 0) this.heal(this.regen * dt);
    // The repair crew climbs the scaffold whenever the walls are below full strength
    this.repairing = this.regen > 0 && this.hp > 0 && this.hp < this.maxHp * 0.995;
    if (this.repairing && Math.random() < dt * 2.5) {
      effects.sparks(SCAFFOLD.x0 + 8, 528, 3, '#ffd27a');
    }

    const stage = this.stage;
    if (stage !== this.shownStage) this.onStageChange(stage, game);
    // Repairs fill the chips in again, oldest first
    const keep = Math.ceil(MAX_SCARS * Math.min(1, (1 - this.hp / this.maxHp) * 1.6));
    if (this.scars.length > keep) this.scars.shift();

    // A battered castle smokes from its breaches and sheds grit; a broken one burns
    if (stage >= 2 && Math.random() < dt * (stage >= 3 ? 16 : 6)) {
      const [x, y] = stage >= 3 ? FIRES[Math.floor(rand(0, FIRES.length))] : BREACHES[Math.floor(rand(0, 2))];
      effects.burst(x, y, 1, { color: 'rgba(50,46,58,0.55)', speedMin: 10, speedMax: 30, angleMin: -Math.PI * 0.7, angleMax: -Math.PI * 0.3, lifeMin: 1.2, lifeMax: 2.2, gravity: -40, drag: 0.5, sizeMin: 6, sizeMax: 12, shrink: false });
      if (stage >= 3) {
        effects.burst(x, y - 8, 3, { color: Math.random() < 0.5 ? '#ff9a3c' : '#ffd36a', speedMin: 10, speedMax: 50, angleMin: -Math.PI * 0.8, angleMax: -Math.PI * 0.2, lifeMin: 0.3, lifeMax: 0.8, gravity: -120, glow: true, sizeMin: 1.5, sizeMax: 3 });
      }
    }
    if (stage >= 1 && Math.random() < dt * stage * 1.2) {
      effects.burst(rand(DRUM.x0, DRUM.x1), rand(WALL_TOP, 540), 1, { color: '#6b6474', angleMin: 1.2, angleMax: 1.9, speedMin: 10, speedMax: 40, lifeMin: 0.5, lifeMax: 0.9, sizeMin: 1.2, sizeMax: 2.4 });
    }
  }

  /** Worse: a section gives way. Better: the masons finish a repair. */
  onStageChange(stage, game) {
    const worse = stage > this.shownStage;
    this.shownStage = stage;
    if (!worse) {
      game.effects.burst(DRUM.x0, WALL_TOP + 30, 14, { color: '#ffe9a8', speedMin: 30, speedMax: 110, gravity: -50, glow: true });
      game.effects.text(DRUM.x0 - 30, WALL_TOP - 66, tr('Duvarlar onarıldı'), '#9fe3a8', 16);
      return;
    }
    const colors = this.stoneColors();
    const [x, y] = stage >= 3 ? [DRUM.x0 + 18, WALL_TOP + 4] : stage === 2 ? BREACHES[0] : [DRUM.x0 + 18, WALL_TOP + 40];
    crumble(game.effects, x, y, 1 + stage * 0.5, colors);
    if (stage >= 2) crumble(game.effects, BREACHES[1][0], BREACHES[1][1], stage * 0.5, colors);
    game.shake(3 + stage * 2);
    game.audio.play('crumble');
  }

  stoneColors() {
    const base = TIER_STONE[this.look.wall];
    return [base, lerpColor(base, MORTAR, 0.35)];
  }

  /** The castle has fallen: the whole front comes down in dust. */
  collapseEffects(game) {
    const colors = this.stoneColors();
    for (const [x, y] of [[DRUM.x0, 470], [180, 480], [66, 400]]) crumble(game.effects, x, y, 2.6, colors);
    game.audio.play('crumble');
  }

  /**
   * Inner hall, rear rampart, curtain wall, gatehouse, front drum tower and keep. Drawn before
   * units so they stand on it. `pal` is the background palette so the stone takes on the light
   * of the time of day; the stone itself gets paler and better cut with each fortress tier.
   */
  draw(ctx, night, pal, dayTime = 0) {
    const dmg = 1 - this.hp / this.maxHp;
    const stage = this.stage;
    const day = Math.max(0, 1 - dayTime);
    const look = this.look;
    const base = TIER_STONE[look.wall];
    const stone = pal ? lerpColor(base, pal.near, 0.26 + night * 0.2) : base;
    const stoneFar = pal ? lerpColor(stone, pal.mid, 0.45) : stone;
    // Rough early walls show every joint; dressed stone keeps them fine
    const mortar = lerpColor(stone, MORTAR, look.wall ? 0.34 : 0.55);
    const roof = pal ? lerpColor('#34508f', pal.near, 0.3 + night * 0.3) : '#34508f';
    const winLit = `rgba(255,190,90,${0.4 + 0.6 * night})`;
    const goldTips = look.gold >= 10 || look.wall >= 3;
    const trim = lerpColor(stone, '#f1e6cf', look.wall >= 2 ? 0.45 : 0.2);
    const iron = lerpColor(IRON, stone, 0.15 + night * 0.2);

    if (look.catapult) drawCatapult(ctx, look.catapult, this.throwT / THROW_TIME, night);
    if (look.wall >= 1) this.drawHall(ctx, stoneFar, roof, winLit, night, goldTips);

    // ---- rear rampart running into the village, with a walkway for the archers
    const rearStone = lerpColor(stone, stoneFar, 0.35);
    this.fillMasonry(ctx, this.stones.back, rearStone, lerpColor(rearStone, MORTAR, 0.4));
    walkway(ctx, REAR.x0, REAR.x1, REAR.top, rearStone, look.wall >= 2 ? trim : null);
    merlons(ctx, REAR.x0, REAR.x1, REAR.top, 11, rearStone, stage >= 3 ? [3, 7, 8, 12] : [], look.wall >= 3);
    for (const x of [-235, -175, -65]) slit(ctx, x, REAR.top + 70);
    plinth(ctx, REAR.x0 - 10, REAR.x1, GROUND_Y - 22, 0, lerpColor(rearStone, MORTAR, 0.22), null);
    // Corner turret where the rampart ends
    const tx0 = REAR.x0 - 16;
    ctx.fillStyle = rearStone;
    ctx.fillRect(tx0, REAR.top - 40, 38, GROUND_Y - REAR.top + 40);
    merlons(ctx, tx0 - 2, tx0 + 40, REAR.top - 40, 9, rearStone, [], look.wall >= 3);
    roofCone(ctx, tx0 - 4, tx0 + 42, REAR.top - 48, REAR.top - 96, roof, goldTips);
    this.flag(ctx, tx0 + 19, REAR.top - 99, 0.9);
    archWindow(ctx, tx0 + 19, REAR.top - 22, 4, 10, winLit, night);
    archWindow(ctx, tx0 + 19, REAR.top + 50, 4, 10, winLit, night);
    shade(ctx, tx0, REAR.top - 48, REAR.x1 - tx0, GROUND_Y - REAR.top + 48, day);

    // ---- curtain wall and gatehouse
    this.fillMasonry(ctx, this.stones.wall, stone, mortar);
    if (look.bell) drawBell(ctx, stone, mortar, look.bell, this.ringT / RING_TIME, this.t, goldTips);
    walkway(ctx, TOWER.x1 - 4, DRUM.x0 + 2, WALL_TOP, stone, look.wall >= 2 ? trim : null);
    const brokenWall = stage >= 3 ? [1, 2, 4, 6, 7] : stage >= 2 ? [2, 4] : [];
    merlons(ctx, TOWER.x1, DRUM.x0, WALL_TOP, 12, stone, brokenWall, look.wall >= 3);
    if (look.wall >= 1) buttress(ctx, 134, stone, mortar);
    plinth(ctx, 0, DRUM.x0, GROUND_Y - 26, 0, lerpColor(stone, MORTAR, 0.24), look.wall >= 2 ? trim : null);
    this.drawGate(ctx, stone, mortar, trim, night);
    shade(ctx, 0, WALL_TOP, DRUM.x0, GROUND_Y - WALL_TOP, day);

    // ---- front drum tower: the corner every enemy batters
    this.drawDrum(ctx, stone, mortar, trim, iron, night, day);
    if (look.oil) this.drawOil(ctx, iron);

    // ---- keep
    this.fillMasonry(ctx, this.stones.tower, stone, mortar);
    plinth(ctx, TOWER.x0 - 8, TOWER.x1 + 8, GROUND_Y - 40, 8, lerpColor(stone, MORTAR, 0.2), look.wall >= 1 ? trim : null);
    quoins(ctx, TOWER.x0, TOWER.x1, TOWER_TOP + 20, GROUND_Y - 42, trim);
    if (look.wall >= 1) for (const y of [408, 470]) band(ctx, TOWER.x0, TOWER.x1, y, trim);
    // Machicolation gallery with corbels under the parapet
    ctx.fillStyle = trim;
    ctx.fillRect(TOWER.x0 - 7, TOWER_TOP, TOWER.x1 - TOWER.x0 + 14, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(TOWER.x0 - 7, TOWER_TOP + 12, TOWER.x1 - TOWER.x0 + 14, 2);
    for (let x = TOWER.x0 - 3; x < TOWER.x1 + 3; x += 12) {
      ctx.fillStyle = trim;
      ctx.beginPath();
      ctx.moveTo(x, TOWER_TOP + 14);
      ctx.lineTo(x + 7, TOWER_TOP + 14);
      ctx.lineTo(x + 3.5, TOWER_TOP + 23);
      ctx.fill();
      ctx.fillStyle = 'rgba(8,6,10,0.55)';
      ctx.fillRect(x + 8, TOWER_TOP + 14, 3.5, 6);
    }
    merlons(ctx, TOWER.x0 - 7, TOWER.x1 + 7, TOWER_TOP, 13, stone, stage >= 3 ? [1, 3] : stage >= 2 ? [1] : [], look.wall >= 3);
    this.flag(ctx, 114, TOWER_TOP - 13, 1.1);
    archWindow(ctx, 30, 346, 6, 22, winLit, night);
    archWindow(ctx, 102, 346, 6, 22, winLit, night);
    slit(ctx, 66, 432);
    slit(ctx, 34, 492);
    slit(ctx, 98, 492);
    this.banner(ctx, 50, TOWER_TOP + 30, 32, 76, 1);
    // Demir Kaplama: heavy armour bands the keep too
    if (look.armor >= 30) for (const y of [396, 530]) ironBand(ctx, TOWER.x0, TOWER.x1, y, iron);
    if (look.armor) ironEdge(ctx, TOWER.x1 - 7, TOWER_TOP + 24, GROUND_Y - 44, iron, look.armor >= 20);
    if (look.vault) this.drawVault(ctx, stone);
    shade(ctx, TOWER.x0 - 7, TOWER_TOP, TOWER.x1 - TOWER.x0 + 14, GROUND_Y - TOWER_TOP, day);

    // Ivy creeping up from the ground, thinning out as the walls are dressed
    if (pal) {
      ctx.fillStyle = lerpColor(pal.grass, '#2f4a2a', 0.5);
      ctx.beginPath();
      const ivy = this.ivy.length - look.wall * 6;
      for (let i = 0; i < ivy; i++) {
        const [x, y, r] = this.ivy[i];
        if (x > GATE.cx - GATE.r - 12 && x < GATE.cx + GATE.r + 12) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    if (look.stores) drawStores(ctx, look.stores, night);
    for (const [x, y] of [[146, WALL_TOP + 34], [DRUM.x0 - 4, WALL_TOP + 34]]) torch(ctx, x, y, this.t);
    if (look.beacon) drawBeacon(ctx, look.beacon, this.t, night, iron);

    this.drawDamage(ctx, dmg, stone);
    if (look.thorns) this.drawStakes(ctx, look.thorns, night);
    if (look.repair) this.drawScaffold(ctx, night);

    // Dust-lit impact where the blow landed
    if (this.flash > 0) {
      const y = this.lastHitY;
      const g = ctx.createRadialGradient(DRUM.x1, y, 2, DRUM.x1, y, 54);
      g.addColorStop(0, `rgba(255,130,90,${this.flash * 5})`);
      g.addColorStop(1, 'rgba(255,130,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(DRUM.x1 - 54, y - 54, 108, 108);
    }
  }

  /** Great hall seen over the wall from Taş Duvarlar's first tier: gabled, with a lit lantern. */
  drawHall(ctx, stone, roof, lit, night, gold) {
    const { x0, x1, eave, ridge } = HALL;
    const cx = (x0 + x1) / 2;
    ctx.fillStyle = stone;
    ctx.fillRect(x0, eave, x1 - x0, WALL_TOP - eave);
    ctx.fillStyle = roof;
    ctx.beginPath();
    ctx.moveTo(x0 - 6, eave + 2);
    ctx.lineTo(x0 + 14, ridge);
    ctx.lineTo(x1 - 14, ridge);
    ctx.lineTo(x1 + 6, eave + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x0 - 6, eave, x1 - x0 + 12, 2);
    ctx.fillStyle = gold ? GOLD : 'rgba(255,255,255,0.12)';
    ctx.fillRect(x0 + 14, ridge - 1, x1 - x0 - 28, 2);
    for (const x of [cx - 26, cx, cx + 26]) archWindow(ctx, x, eave + 12, 3, 9, lit, night);
    // Shells punch through the slates, leaving bare rafters
    const stage = this.stage;
    if (stage >= 2) {
      const x = cx + 6;
      const w = stage >= 3 ? 34 : 18;
      ctx.fillStyle = '#0d0b10';
      ctx.beginPath();
      ctx.moveTo(x - w / 2, ridge + 1);
      ctx.lineTo(x + w / 2, ridge + 1);
      ctx.lineTo(x + w / 2 + 6, eave - 4);
      ctx.lineTo(x + 3, eave - 9);
      ctx.lineTo(x - w / 2 - 5, eave - 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#4a3322';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let rx = x - w / 2 + 3; rx < x + w / 2; rx += 7) {
        ctx.moveTo(rx, ridge + 1);
        ctx.lineTo(rx + (rx - x) * 0.2, eave - 3);
      }
      ctx.stroke();
    }
  }

  /** Round tower closing the wall. Courses bow around it and joints bunch toward its edges. */
  drawDrum(ctx, stone, mortar, trim, iron, night, day) {
    const { x0, x1 } = DRUM;
    const stage = this.stage;
    ctx.save();
    if (stage >= 3) clipBrokenTop(ctx, x0 - 6, x1 + 10, DRUM_RUIN);
    const cx = (x0 + x1) / 2;
    const r = (x1 - x0) / 2;
    const top = WALL_TOP;
    ctx.fillStyle = stone;
    ctx.fillRect(x0, top, x1 - x0, GROUND_Y - top);
    ctx.strokeStyle = mortar;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let row = 0;
    for (let y = top + 22; y < GROUND_Y; y += 15, row++) {
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(cx, y + 5, x1, y);
      for (let k = row % 2 ? -0.75 : -0.5; k < 1; k += 0.5) {
        const x = cx + Math.sin((k * Math.PI) / 2) * r;
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x, y - 12);
      }
    }
    ctx.stroke();
    // Cylinder shading: lit from the right, falling off at both edges
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(0.62, 'rgba(0,0,0,0)');
    g.addColorStop(0.82, `rgba(255,232,190,${0.06 + 0.1 * day})`);
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, top, x1 - x0, GROUND_Y - top);

    // Corbelled head, wider than the shaft
    ctx.fillStyle = trim;
    ctx.fillRect(x0 - 3, top, x1 - x0 + 6, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x0 - 3, top + 9, x1 - x0 + 6, 3);
    merlons(ctx, x0 - 3, x1 + 3, top, 9, stone, stage >= 2 ? [1] : [], this.look.wall >= 3);
    slit(ctx, cx + 3, top + 62);
    slit(ctx, cx + 3, top + 118);
    plinth(ctx, x0, x1, GROUND_Y - 26, 8, lerpColor(stone, MORTAR, 0.24), this.look.wall >= 2 ? trim : null);
    // Demir Kaplama: iron hoops around the tower, doubling at Sv 20
    if (this.look.armor) {
      const hoops = this.look.armor >= 20 ? [top + 30, top + 88, top + 138] : [top + 88];
      for (const y of hoops) hoop(ctx, x0, x1, y, iron);
    }
    ctx.restore();
  }

  fillMasonry(ctx, blocks, stone, mortar) {
    // Mortar backing, then every block inset by a pixel so joints show through
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y, w, h] of blocks) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x + w);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y + h);
    }
    ctx.fillStyle = mortar;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.fillStyle = stone;
    ctx.beginPath();
    for (const [x, y, w, h] of blocks) ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.fill();
    // Per-block tone variation, batched into a light and a dark pass
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    for (const [x, y, w, h, s] of blocks) if (s > 0.03) ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    for (const [x, y, w, h, s] of blocks) if (s < -0.03) ctx.rect(x + 1, y + 1, w - 2, h - 2);
    ctx.fill();
    // Top highlight on each block
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (const [x, y, w] of blocks) ctx.rect(x + 1, y + 1, w - 2, 2);
    ctx.fill();
  }

  /** Gatehouse: pilasters, a pointed arch, oak doors under a portcullis and the arms above. */
  drawGate(ctx, stone, mortar, trim, night) {
    const { cx, r, spring } = GATE;
    const look = this.look;
    // Pilasters framing the bay, up to the walkway
    for (const x of [cx - r - 20, cx + r + 12]) {
      ctx.fillStyle = lerpColor(stone, '#ffffff', 0.09);
      ctx.fillRect(x, WALL_TOP + 11, 8, GROUND_Y - WALL_TOP - 11);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, WALL_TOP + 11, 2.5, GROUND_Y - WALL_TOP - 11);
    }
    // Moulded surround: dressed voussoirs around the opening
    ctx.fillStyle = trim;
    pointedArch(ctx, cx, r + 9, spring);
    ctx.fill();
    ctx.strokeStyle = mortar;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 1; i < 10; i++) {
      const a = Math.PI + (i * Math.PI) / 10;
      const lift = 1 + 0.25 * Math.sin((i * Math.PI) / 10);
      ctx.moveTo(cx + Math.cos(a) * r, spring + Math.sin(a) * r * lift);
      ctx.lineTo(cx + Math.cos(a) * (r + 9), spring + Math.sin(a) * (r + 9) * lift);
    }
    ctx.stroke();
    // Deep reveal, then the doors set back inside it
    ctx.fillStyle = '#0f0d12';
    pointedArch(ctx, cx, r, spring);
    ctx.fill();
    const oak = lerpColor('#6a4426', stone, 0.2 + night * 0.25);
    ctx.fillStyle = oak;
    pointedArch(ctx, cx, r - 4, spring);
    ctx.fill();
    ctx.save();
    pointedArch(ctx, cx, r - 4, spring);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = cx - r + 8; x < cx + r; x += 8) {
      ctx.moveTo(x, GROUND_Y);
      ctx.lineTo(x, spring - r * 1.3);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(cx - 1, spring - r * 1.3, 2, GROUND_Y - spring + r * 1.3);
    // Demir Kaplama: the doors are sheathed in riveted iron from Sv 15
    if (look.armor >= 15) {
      ctx.fillStyle = 'rgba(70,72,84,0.6)';
      ctx.fillRect(cx - r, spring - r * 1.3, r * 2, GROUND_Y - spring + r * 1.3);
      ctx.fillStyle = 'rgba(210,214,224,0.38)';
      for (let y = spring - 16; y < GROUND_Y - 4; y += 9) {
        for (let x = cx - r + 6; x < cx + r - 3; x += 9) ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    // Iron straps with studs, gilded by a full treasury
    const strap = look.gold >= 20 ? GOLD : '#1c1a20';
    for (const y of look.armor ? [spring + 2, spring + 22, spring + 42] : [spring + 4, spring + 38]) {
      ctx.fillStyle = strap;
      ctx.fillRect(cx - r, y, r * 2, 4.5);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let x = cx - r + 5; x < cx + r; x += 10) ctx.fillRect(x, y + 1.4, 1.8, 1.8);
    }
    // Portcullis, raised into the arch: taller teeth from Sv 25
    const drop = spring + (look.armor >= 25 ? 8 : -8);
    ctx.strokeStyle = '#141218';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = cx - r + 6; x < cx + r - 2; x += 8) {
      ctx.moveTo(x, spring - r * 1.3);
      ctx.lineTo(x, drop);
    }
    for (let y = spring - 30; y < drop - 4; y += 11) {
      ctx.moveTo(cx - r, y);
      ctx.lineTo(cx + r, y);
    }
    ctx.stroke();
    ctx.restore();
    // Ring handles
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    for (const x of [cx - 6, cx + 6]) {
      ctx.beginPath();
      ctx.arc(x, spring + 30, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.drawArms(ctx, cx, WALL_TOP + 30);
  }

  /** Carved heraldic shield over the gate; it gains a gold border and crown with the tier. */
  drawArms(ctx, x, y) {
    const tier = this.look.wall;
    ctx.fillStyle = tier >= 2 ? GOLD : '#3b2a1c';
    shield(ctx, x, y, 15);
    ctx.fill();
    ctx.fillStyle = '#2459b8';
    shield(ctx, x, y, 12.5);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 6, -1.2, 1.2);
    ctx.moveTo(x - 2 + Math.cos(-1.2) * 6, y - 2 + Math.sin(-1.2) * 6);
    ctx.lineTo(x - 2 + Math.cos(1.2) * 6, y - 2 + Math.sin(1.2) * 6);
    ctx.moveTo(x - 6, y - 2);
    ctx.lineTo(x + 7, y - 2);
    ctx.stroke();
    if (tier >= 3) {
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 15);
      ctx.lineTo(x - 11, y - 25);
      ctx.lineTo(x - 5, y - 19);
      ctx.lineTo(x, y - 27);
      ctx.lineTo(x + 5, y - 19);
      ctx.lineTo(x + 11, y - 25);
      ctx.lineTo(x + 10, y - 15);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Hanging cloth banner with a gold bow emblem; it sways in the wind. */
  banner(ctx, x, y, w, h, s) {
    const sway = Math.sin(this.t * 1.8 + x) * 3;
    const torn = this.stage >= 2;
    ctx.fillStyle = '#3b2a1c';
    ctx.fillRect(x - 3, y - 3, w + 6, 4);
    ctx.fillStyle = '#2459b8';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w + sway * 0.6, y + h - (torn ? 30 : 8) * s);
    if (torn) {
      // Shredded hem
      ctx.lineTo(x + w * 0.76 + sway, y + h - 14 * s);
      ctx.lineTo(x + w * 0.6 + sway, y + h - 26 * s);
      ctx.lineTo(x + w * 0.42 + sway, y + h - 6 * s);
      ctx.lineTo(x + w * 0.26 + sway, y + h - 22 * s);
      ctx.lineTo(x + w * 0.12 + sway, y + h - 12 * s);
    } else {
      ctx.lineTo(x + w / 2 + sway, y + h);
    }
    ctx.lineTo(x + sway * 0.6, y + h - (torn ? 24 : 8) * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + w - 4, y, 4, h - 10 * s);
    if (this.look.gold && !torn) {
      // Hazine Odası: gold-embroidered hem
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.4 * s;
      ctx.beginPath();
      ctx.moveTo(x + 1.5, y + 1);
      ctx.lineTo(x + 1.5 + sway * 0.6, y + h - 8 * s);
      ctx.lineTo(x + w / 2 + sway, y + h - 2);
      ctx.lineTo(x + w - 1.5 + sway * 0.6, y + h - 8 * s);
      ctx.lineTo(x + w - 1.5, y + 1);
      ctx.stroke();
    }
    // Emblem: a bow and arrow
    const ex = x + w / 2 + sway * 0.4;
    const ey = y + h * 0.42;
    ctx.strokeStyle = '#e2b33c';
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(ex - 2 * s, ey, 7 * s, -1.2, 1.2);
    ctx.moveTo(ex - 2 * s + Math.cos(-1.2) * 7 * s, ey + Math.sin(-1.2) * 7 * s);
    ctx.lineTo(ex - 2 * s + Math.cos(1.2) * 7 * s, ey + Math.sin(1.2) * 7 * s);
    ctx.moveTo(ex - 6 * s, ey);
    ctx.lineTo(ex + 8 * s, ey);
    ctx.stroke();
  }

  flag(ctx, x, y, s) {
    const wave = Math.sin(this.t * 3) * 4;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 40 * s);
    ctx.stroke();
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.moveTo(x, y - 40 * s);
    ctx.quadraticCurveTo(x + 18 * s, y - 42 * s + wave, x + 36 * s, y - 36 * s + wave);
    ctx.lineTo(x + 30 * s, y - 28 * s + wave * 0.5);
    ctx.lineTo(x + 36 * s, y - 19 * s + wave);
    ctx.quadraticCurveTo(x + 18 * s, y - 22 * s + wave, x, y - 20 * s);
    ctx.fill();
    if (this.look.gold >= 10) {
      // A rich treasury flies a gold stripe and a gold pole tip
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(x, y - 30 * s);
      ctx.quadraticCurveTo(x + 16 * s, y - 32 * s + wave, x + 32 * s, y - 28 * s + wave * 0.7);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(x, y - 41 * s, 2.6 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Altın Kasası: a round iron vault door in the keep, glinting now and then. */
  drawVault(ctx, stone) {
    const cx = 66;
    const cy = 500;
    const r = 16;
    ctx.fillStyle = lerpColor(stone, '#f1e6cf', 0.25);
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2a33';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3), 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spoked wheel handle, turning slowly as interest is counted
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    const spin = this.t * 0.4;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI) / 3;
      ctx.moveTo(cx - Math.cos(a) * 8, cy - Math.sin(a) * 8);
      ctx.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
    }
    ctx.stroke();
    // A glint sweeps across the door every few seconds
    const g = (this.t % 4) / 0.6;
    if (g < 1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,240,190,0.35)';
      ctx.translate(cx - r - 6 + g * (2 * r + 12), cy);
      ctx.rotate(0.5);
      ctx.fillRect(-3, -r - 6, 6, 2 * r + 12);
      ctx.restore();
    }
  }

  /** Kaynar Yağ: a cauldron over a fire at the wall's edge; it tips over when oil is poured. */
  drawOil(ctx, iron) {
    const x = WALL_FRONT - 7;
    const y = WALL_TOP - 1;
    // Wooden hoarding chute the oil runs through
    ctx.fillStyle = '#3b2a1c';
    ctx.fillRect(WALL_FRONT - 2, WALL_TOP + 4, 12, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(WALL_FRONT + 2, WALL_TOP + 11, 6, 2);
    // fire under the pot
    const flick = Math.sin(this.t * 14) * 1.2;
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.ellipse(x, y - 2, 4, 3 + flick * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // tripod
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x, y - 20);
    ctx.lineTo(x + 7, y);
    ctx.stroke();
    // pot, tipped toward the field while pouring
    const tip = this.pourT > 0 ? Math.sin(Math.min(1, this.pourT / 0.8) * Math.PI) * 1.1 : 0;
    ctx.save();
    ctx.translate(x, y - 12);
    ctx.rotate(tip);
    ctx.fillStyle = iron;
    ctx.beginPath();
    ctx.moveTo(-7, -4);
    ctx.lineTo(7, -4);
    ctx.quadraticCurveTo(7, 6, 0, 6);
    ctx.quadraticCurveTo(-7, 6, -7, -4);
    ctx.fill();
    ctx.fillStyle = '#c98a2a';
    ctx.fillRect(-6, -5, 12, 2);
    ctx.restore();
    // steam curls rising from the pot
    for (let i = 0; i < 3; i++) {
      const k = (this.t * 0.5 + i / 3) % 1;
      ctx.fillStyle = `rgba(230,225,215,${0.32 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(this.t * 2 + i * 2) * 3, y - 18 - k * 22, 2.5 + k * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Dikenli Surlar: sharpened stakes at the wall foot; more per level, iron tips from level 6. */
  drawStakes(ctx, level, night) {
    const n = Math.min(12, 3 + level);
    const wood = lerpColor('#5a3b22', '#1c1820', 0.2 + night * 0.4);
    for (let i = 0; i < n; i++) {
      const x = WALL_FRONT + 20 + i * 7 + (i % 3) * 1.5;
      const h = 14 + (i % 2) * 5;
      const tx = x + 7;
      const ty = GROUND_Y - h;
      ctx.strokeStyle = wood;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 2);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.fillStyle = level >= 6 ? '#b9bec8' : '#c9a37a';
      ctx.beginPath();
      ctx.moveTo(tx + 2, ty - 3);
      ctx.lineTo(tx - 1.6, ty + 1.2);
      ctx.lineTo(tx + 1.2, ty + 2.4);
      ctx.closePath();
      ctx.fill();
    }
    // a cross rail lashes the row together
    ctx.strokeStyle = wood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WALL_FRONT + 18, GROUND_Y - 6);
    ctx.lineTo(WALL_FRONT + 26 + (n - 1) * 7, GROUND_Y - 8);
    ctx.stroke();
  }

  /** Onarım Ekibi: a standing scaffold against the wall; a mason works on it while it is damaged. */
  drawScaffold(ctx, night) {
    const { x0, x1 } = SCAFFOLD;
    const wood = lerpColor('#6b4a2e', '#1c1820', 0.15 + night * 0.4);
    ctx.strokeStyle = wood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, GROUND_Y);
    ctx.lineTo(x0, 500);
    ctx.moveTo(x1, GROUND_Y);
    ctx.lineTo(x1, 500);
    ctx.moveTo(x0, GROUND_Y - 4);
    ctx.lineTo(x1, 562);
    ctx.stroke();
    ctx.fillStyle = wood;
    ctx.fillRect(x0 - 3, 558, x1 - x0 + 6, 3);
    ctx.fillRect(x0 - 3, 512, x1 - x0 + 6, 3);
    if (!this.repairing) return;
    // the mason, swinging a hammer at the stones
    const k = Math.max(0, Math.sin(this.t * 9));
    const j = drawFigure(ctx, { x: x0 + 13, y: 558, s: 0.62, f: -1, lean: 0.1, armF: [1.4 + k * 1.3, 1.6 + k * 1.2], armB: [0.5, 0.9] });
    const [hx, hy] = j.handF;
    const a = Math.atan2(hy - j.elbowF[1], hx - j.elbowF[0]);
    ctx.strokeStyle = wood;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.cos(a) * 7, hy + Math.sin(a) * 7);
    ctx.stroke();
    ctx.save();
    ctx.translate(hx + Math.cos(a) * 7, hy + Math.sin(a) * 7);
    ctx.rotate(a);
    ctx.fillStyle = '#8a8f99';
    ctx.fillRect(-1.5, -3, 3, 6);
    ctx.restore();
    // a fresh, lighter stone being set into the wall
    ctx.fillStyle = 'rgba(220,214,200,0.55)';
    ctx.fillRect(x0 - 1, 522, 9, 7);
    // hard hat
    ctx.fillStyle = '#d6b23c';
    ctx.beginPath();
    ctx.arc(j.head[0], j.head[1] - j.headR * 0.3, j.headR * 1.1, Math.PI, 0);
    ctx.fill();
  }

  /** Everything the current damage stage adds on top of the finished castle. */
  drawDamage(ctx, dmg, stone) {
    const stage = this.stage;
    for (const [x, y, r] of this.scars) drawBreach(ctx, x, y, r, stone);
    if (!stage) return;
    drawCracks(ctx, CRACKS, stage * 2);
    if (stage >= 2) {
      for (const [x, y, r] of SCORCH) drawScorch(ctx, x, y, r, 0.3 + dmg * 0.35);
      for (const [x, y, r] of BREACHES.slice(0, stage === 2 ? 2 : BREACHES.length)) drawBreach(ctx, x, y, r, stone);
    }
    drawRubble(ctx, this.rubble, 3 + stage * 4, lerpColor(stone, MORTAR, 0.34));
    if (stage >= 3) FIRES.forEach(([x, y, s], i) => drawFire(ctx, x, y, s, this.t + i * 1.7));
  }
}

/** Crenellations along a top edge; indices in `broken` are knocked off; `gilded` caps them in gold. */
function merlons(ctx, x0, x1, y, size, color, broken = [], gilded = false) {
  ctx.fillStyle = color;
  let i = 0;
  for (let x = x0; x < x1 - 2; x += size * 2, i++) {
    if (broken.includes(i)) {
      ctx.fillRect(x, y - size * 0.35, size * 0.6, size * 0.35 + 1);
      continue;
    }
    ctx.fillRect(x, y - size, size, size + 1);
    ctx.fillStyle = gilded ? GOLD : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, y - size, size, gilded ? 2.5 : 2);
    ctx.fillStyle = color;
  }
}

/** Walkway slab with its shadow and, from the second tier, a carved cornice below. */
function walkway(ctx, x0, x1, y, stone, cornice) {
  ctx.fillStyle = lerpColor(stone, '#ffffff', 0.1);
  ctx.fillRect(x0, y, x1 - x0, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x0, y + 8, x1 - x0, 3);
  if (cornice) band(ctx, x0, x1, y + 9, cornice);
}

/** Battered foot: the wall flares out `flare` px on the right as it meets the ground. */
function plinth(ctx, x0, x1, y, flare, color, cap) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.lineTo(x1 + flare, GROUND_Y + 2);
  ctx.lineTo(x0, GROUND_Y + 2);
  ctx.fill();
  ctx.fillStyle = cap ?? 'rgba(255,255,255,0.07)';
  ctx.fillRect(x0, y, x1 - x0, cap ? 3 : 2);
}

/** Alternating long and short dressed stones up both corners of a building. */
function quoins(ctx, x0, x1, y0, y1, color) {
  ctx.fillStyle = color;
  let long = true;
  for (let y = y0; y < y1; y += 15, long = !long) {
    const w = long ? 15 : 9;
    ctx.fillRect(x0, y, w, 13.5);
    ctx.fillRect(x1 - w, y, w, 13.5);
  }
}

/** Pointed (Gothic) arch path from the ground up. */
function pointedArch(ctx, cx, r, spring) {
  ctx.beginPath();
  ctx.moveTo(cx - r, GROUND_Y);
  ctx.lineTo(cx - r, spring);
  ctx.quadraticCurveTo(cx - r, spring - r * 0.85, cx, spring - r * 1.3);
  ctx.quadraticCurveTo(cx + r, spring - r * 0.85, cx + r, spring);
  ctx.lineTo(cx + r, GROUND_Y);
  ctx.closePath();
}

/** Heater shield path, `r` wide either side of its centre. */
function shield(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - r);
  ctx.lineTo(x + r, y - r);
  ctx.lineTo(x + r, y + r * 0.2);
  ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.95, x, y + r * 1.35);
  ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.95, x - r, y + r * 0.2);
  ctx.closePath();
}

/** Carved cornice: a pale stone course with a shadow under it. */
function band(ctx, x0, x1, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, x1 - x0, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(x0, y + 4, x1 - x0, 2);
}

/** Stepped buttress standing out from the wall face. */
function buttress(ctx, x, stone, mortar) {
  const top = WALL_TOP + 40;
  ctx.fillStyle = lerpColor(stone, '#ffffff', 0.12);
  ctx.beginPath();
  ctx.moveTo(x - 5, top);
  ctx.lineTo(x + 5, top);
  ctx.lineTo(x + 5, GROUND_Y - 60);
  ctx.lineTo(x + 9, GROUND_Y - 54);
  ctx.lineTo(x + 9, GROUND_Y);
  ctx.lineTo(x - 9, GROUND_Y);
  ctx.lineTo(x - 9, GROUND_Y - 54);
  ctx.lineTo(x - 5, GROUND_Y - 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mortar;
  for (let y = top + 14; y < GROUND_Y - 4; y += 15) ctx.fillRect(x - 9, y, 18, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(x - 9, GROUND_Y - 54, 5, 54);
  ctx.fillRect(x - 5, top, 3, GROUND_Y - 60 - top);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x - 5, top, 10, 2);
  ctx.fillRect(x - 9, GROUND_Y - 54, 18, 2);
}

/** Riveted iron plates down a corner; `heavy` doubles the rivet rows. */
function ironEdge(ctx, x, y0, y1, color, heavy) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y0, 7, y1 - y0);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = y0 + 22; y < y1; y += 22) ctx.fillRect(x, y, 7, 1.2);
  ctx.fillStyle = 'rgba(220,224,232,0.55)';
  for (let y = y0 + 5; y < y1 - 2; y += heavy ? 6 : 11) {
    ctx.fillRect(x + 1.5, y, 1.5, 1.5);
    if (heavy) ctx.fillRect(x + 4.5, y + 3, 1.5, 1.5);
  }
}

/** Iron hoop bowing around a round tower. */
function hoop(ctx, x0, x1, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + 6, x1, y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,224,232,0.55)';
  for (let k = 0.15; k < 1; k += 0.175) ctx.fillRect(x0 + (x1 - x0) * k, y + 1 + 6 * k * (1 - k) * 2, 1.6, 1.6);
}

function ironBand(ctx, x0, x1, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, x1 - x0, 6);
  ctx.fillStyle = 'rgba(220,224,232,0.5)';
  for (let x = x0 + 4; x < x1 - 2; x += 9) ctx.fillRect(x, y + 2, 1.6, 1.6);
}

/** Conical tower roof: shaded left half, slate courses, eave and a finial (gold when rich). */
function roofCone(ctx, x0, x1, base, apex, color, gold) {
  const cx = (x0 + x1) / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, base);
  ctx.lineTo(cx, apex);
  ctx.lineTo(x1, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(x0, base);
  ctx.lineTo(cx, apex);
  ctx.lineTo(cx, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0.22; k < 1; k += 0.15) {
    const y = lerp(apex, base, k);
    const hw = ((x1 - x0) / 2) * k;
    ctx.moveTo(cx - hw, y);
    ctx.quadraticCurveTo(cx, y + 3 * k, cx + hw, y);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(cx, apex);
  ctx.lineTo(cx + (x1 - cx) * 0.35, base);
  ctx.lineTo(cx + (x1 - cx) * 0.2, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x0 - 2, base - 2, x1 - x0 + 4, 3);
  ctx.fillStyle = gold ? GOLD : INK;
  ctx.beginPath();
  ctx.arc(cx, apex - 1, 3, 0, Math.PI * 2);
  ctx.fill();
}

function archWindow(ctx, x, y, hw, h, lit, night = 0) {
  if (night > 0.3) {
    // Lamplight spills onto the stone around a lit window
    const g = ctx.createRadialGradient(x, y + h / 2, 2, x, y + h / 2, 26);
    g.addColorStop(0, `rgba(255,180,90,${0.22 * night})`);
    g.addColorStop(1, 'rgba(255,180,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, y + h / 2 - 26, 52, 52);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(x - hw - 2, y + h + 2);
  ctx.lineTo(x - hw - 2, y);
  ctx.arc(x, y, hw + 2, Math.PI, 0);
  ctx.lineTo(x + hw + 2, y + h + 2);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.moveTo(x - hw, y + h);
  ctx.lineTo(x - hw, y);
  ctx.arc(x, y, hw, Math.PI, 0);
  ctx.lineTo(x + hw, y + h);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - 0.75, y - hw, 1.5, h + hw);
}

function slit(ctx, x, y) {
  ctx.fillStyle = 'rgba(8,6,10,0.85)';
  ctx.fillRect(x - 1.5, y - 10, 3, 20);
  ctx.fillRect(x - 5, y - 1.5, 10, 3);
}

/** Directional light: darker on the left face, warm rim on the right in daylight. */
function shade(ctx, x, y, w, h, day) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(0,0,0,0.3)');
  g.addColorStop(0.6, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(255,225,180,${0.04 + 0.08 * day})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function torch(ctx, x, y, t) {
  ctx.strokeStyle = '#3b2a1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 14);
  ctx.stroke();
  const flick = Math.sin(t * 13 + x) * 1.5 + Math.sin(t * 7.3 + x) * 1;
  const glow = ctx.createRadialGradient(x, y - 18, 2, x, y - 18, 46 + flick * 3);
  glow.addColorStop(0, 'rgba(255,190,90,0.45)');
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 50, y - 70, 100, 100);
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.ellipse(x, y - 19 - flick * 0.5, 4, 7 + flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff1b8';
  ctx.beginPath();
  ctx.ellipse(x, y - 17, 2, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
}
