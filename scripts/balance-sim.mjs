/**
 * Headless balance check: runs the real game simulation with a bot that buys the
 * cheapest affordable upgrade, and prints when each wave milestone is reached.
 *
 *   node scripts/balance-sim.mjs [hours=2] [prestigeRuns=0]
 */
import { Game } from '../src/core/Game.js';
import { createDefaultState } from '../src/core/State.js';
import { HERO_UPGRADES, CASTLE_UPGRADES, ALLY_UPGRADES, VILLAGE_UPGRADES, SOUL_UPGRADES, soulsForWave } from '../src/config/upgrades.js';
import { quote, purchase, walletOf } from '../src/systems/Economy.js';
import { ACTIVE_SKILLS, TALENTS } from '../src/config/skills.js';
import { frontmost } from '../src/systems/Targeting.js';

const HOURS = Number(process.argv[2] ?? 2);
const RUNS = Number(process.argv[3] ?? 0) + 1;
const DT = 1 / 60;
const BUY_EVERY = 2;
const MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 100];

const stubCanvas = { getContext: () => ({}), style: {} };
// Pass "novillage" as the 3rd argument to compare against a run without the village
const GOLD_LIST = [...HERO_UPGRADES, ...CASTLE_UPGRADES, ...ALLY_UPGRADES, ...(process.argv[4] === 'novillage' ? [] : VILLAGE_UPGRADES)];
const GOLD_IDS = GOLD_LIST.map((u) => u.id);
const SOUL_IDS = SOUL_UPGRADES.map((u) => u.id);
const GEM_IDS = [...ACTIVE_SKILLS, ...TALENTS].map((u) => u.id);

function buyCheapest(game, ids) {
  const s = game.state;
  s.settings.buyAmount = 1;
  let bought = 0;
  for (;;) {
    let best = null;
    for (const id of ids) {
      const q = quote(s, id);
      if (q.maxed || walletOf(s, id) < Math.ceil(q.cost)) continue;
      if (!best || q.cost < best.cost) best = { id, cost: q.cost };
    }
    if (!best || !purchase(s, best.id)) break;
    bought++;
  }
  if (bought) game.refreshStats();
}

const fmtT = (sec) => `${Math.floor(sec / 60)}m${String(Math.floor(sec % 60)).padStart(2, '0')}s`;

const state = createDefaultState();
state.settings.autoAdvance = true;
const game = new Game(stubCanvas, state);
let falls = 0;
const origFall = game.onCastleFallen.bind(game);
game.onCastleFallen = () => { falls++; origFall(); };

for (let run = 1; run <= RUNS; run++) {
  console.log(`\n=== Run ${run} (souls ${state.souls}, soul levels ${JSON.stringify(state.soulLevels)}) ===`);
  const limit = HOURS * 3600;
  let t = 0;
  let buyT = 0;
  let next = 0;
  let lastMaxT = 0;
  falls = 0;
  while (t < limit) {
    // Until Otomatik Atış is maxed the player holds fire on the nearest enemy, leading it a
    // little like a person would; afterwards the bot plays idle and lets the hero shoot.
    const target = game.stats.hero.autoFire >= 1 ? null : frontmost(game.enemies);
    game.aim = target ? { x: target.x - (target.walking ? target.speed * 0.5 : 0), y: target.centerY } : null;
    game.update(DT);
    t += DT;
    buyT += DT;
    if (buyT >= BUY_EVERY) {
      buyT = 0;
      buyCheapest(game, GOLD_IDS);
      buyCheapest(game, GEM_IDS);
    }
    while (next < MILESTONES.length && state.maxWave >= MILESTONES[next]) {
      console.log(`wave ${String(MILESTONES[next]).padStart(3)} @ ${fmtT(t).padStart(8)}  gold/s ${state.goldPerSec.toFixed(1).padStart(10)}  village/s ${game.stats.village.total.toFixed(1).padStart(9)}  falls ${falls}`);
      next++;
      lastMaxT = t;
    }
    // Stalled for 15 minutes → this run is over
    if (t - lastMaxT > 900) break;
  }
  const lv = Object.entries(state.levels).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`end ${fmtT(t)} maxWave ${state.maxWave} falls ${falls} souls-if-prestige ${soulsForWave(state.maxWave, game.stats.soul.harvest)}`);
  console.log(`levels ${lv}`);
  console.log(`gems left ${state.gems} (total ${state.totalGems}) · bestWave ${state.bestWave} · gemLevels ${JSON.stringify(state.gemLevels)}`);
  if (run < RUNS) {
    game.prestige();
    buyCheapest(game, SOUL_IDS);
  }
}
