import { GROUND_Y, WORLD_W } from '../core/constants.js';
import { rand } from '../utils/math.js';
import { fmt } from '../utils/format.js';
import { VILLAGE_SITES, DEPOT_X, MOUNTAIN_ROAD, CAMP_Y, MINE } from '../config/village.js';
import { villageColors, drawMountain, drawRoad, drawSite, drawDepot, drawMarket, drawWorker } from '../render/villageArt.js';

/*
 * The village economy behind the castle. Every worker runs the same loop along its route:
 * work at the site → carry the load to where it is dropped → walk back. Most routes run down
 * the village road to the depot cart; the lumber camp's climbs the mountain road first, and
 * the mine splits its crew: diggers carry ore across the gallery to the shaft (the hoist
 * lifts it), haulers barrow it from the shaft head to the cart. Each delivery pays
 * rate × that worker's cycle time, so average income equals the stats' gold/s whatever the
 * distance or the role. Layout comes from config/village.js; drawing from render/villageArt.js.
 */
const SPEED = 46;
const DROP_TIME = 0.4;
const PAYOUT_EVERY = 1.2;
const HOIST_UP = 1.6;   // seconds for the bucket to rise with ore
const HOIST_DOWN = 1.2;

/** The path from the work spot to where the load is dropped, as [x, y] points. */
function routeOf(site, role, offset) {
  const drop = [DEPOT_X - 14 + offset * 0.3, GROUND_Y];
  if (role === 'dig') return [[MINE.faceX + offset * 0.8, GROUND_Y + MINE.floor], [MINE.shaftX - 9, GROUND_Y + MINE.floor]];
  if (role === 'haul') return [[MINE.shaftX + 14 + Math.abs(offset) * 0.9, GROUND_Y], drop];
  if (site.mountain) return [[site.workX + offset, GROUND_Y - CAMP_Y], ...MOUNTAIN_ROAD.map(([x, h]) => [x, GROUND_Y - h]), drop];
  return [[site.workX + offset, GROUND_Y], drop];
}

class Worker {
  constructor(site, index) {
    this.site = site;
    // Miners alternate: diggers below ground, haulers above
    this.role = site.shaft ? (index % 2 ? 'haul' : 'dig') : 'work';
    // Golden-ratio steps spread any number of workers evenly over the site's work area
    const slot = site.shaft ? Math.floor(index / 2) : index;
    this.offset = (((slot * 0.618 + 0.5) % 1) - 0.5) * site.spread + rand(-1.5, 1.5);
    this.route = routeOf(site, this.role, this.offset);
    this.legs = this.route.slice(1).map((p, i) => Math.hypot(p[0] - this.route[i][0], p[1] - this.route[i][1]));
    this.len = this.legs.reduce((a, b) => a + b, 0);
    this.cycle = site.work + (2 * this.len) / SPEED + DROP_TIME;
    this.homeX = this.route[0][0];
    this.d = 0; // distance along the route from the work spot
    this.state = 'work';
    this.timer = rand(0, site.work);
    this.phase = rand(0, 6);
    this.load = 0;
    this.speed = SPEED * rand(0.9, 1.1);
    this.place();
  }

  /** Position on the route at distance d, the way it faces and how steep the ground is. */
  place() {
    let d = this.d;
    let i = 0;
    while (i < this.legs.length - 1 && d > this.legs[i]) d -= this.legs[i++];
    const [ax, ay] = this.route[i];
    const [bx, by] = this.route[i + 1];
    const k = this.legs[i] ? Math.min(1, d / this.legs[i]) : 0;
    this.x = ax + (bx - ax) * k;
    this.y = ay + (by - ay) * k;
    const ahead = Math.sign(bx - ax) || 1; // the way the route runs toward the drop
    this.f = this.state === 'return' ? -ahead : this.state === 'work' ? -1 : ahead;
    // Positive when the worker is walking uphill
    this.climb = Math.abs(bx - ax) > 0.1 ? ((ay - by) / Math.abs(bx - ax)) * (this.state === 'return' ? -1 : 1) : 0;
  }

  update(dt, village, rate) {
    this.phase += dt * (this.state === 'work' ? 6 : this.speed * 0.12);
    switch (this.state) {
      case 'work':
        this.timer -= dt;
        if (this.timer <= 0 && rate > 0) {
          this.state = 'carry';
          this.load = rate * this.cycle;
          if (this.role === 'haul') village.orePile = Math.max(0, village.orePile - 1);
        }
        break;
      case 'carry':
        this.d += this.speed * dt;
        if (this.d >= this.len) {
          this.d = this.len;
          this.state = 'drop';
          this.timer = DROP_TIME;
          // Diggers tip their ore into the hoist bucket; everyone else into the depot cart
          village.deliver(this.load, this.role !== 'dig');
          if (this.role === 'dig') village.hoistQueue++;
          this.load = 0;
        }
        break;
      case 'drop':
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'return';
        break;
      case 'return':
        this.d -= this.speed * dt;
        if (this.d <= 0) {
          this.d = 0;
          this.state = 'work';
          this.timer = this.site.work * rand(0.85, 1.15);
        }
        break;
    }
    this.place();
  }
}

export class Village {
  constructor() {
    this.workers = Object.fromEntries(VILLAGE_SITES.map((site) => [site.key, []]));
    this.levels = Object.fromEntries(VILLAGE_SITES.map((site) => [site.key, 0]));
    this.market = false;
    this.pending = 0;
    this.payTimer = PAYOUT_EVERY;
    this.t = 0;
    this.cartBump = 0;
    // Mine hoist: ore waiting below, the bucket's ride (0 → 1 up, then back down) and the pile at the top
    this.hoistQueue = 0;
    this.hoist = { k: 0, up: false, busy: false };
    this.orePile = 0;
  }

  /** Match worker counts and building levels to the current stats. */
  sync(villageStats) {
    for (const site of VILLAGE_SITES) {
      const st = villageStats[site.key];
      const want = st.level ? st.workers : 0;
      const list = this.workers[site.key];
      while (list.length < want) list.push(new Worker(site, list.length));
      list.length = want;
      this.levels[site.key] = st.level;
    }
    this.market = villageStats.market > 1;
  }

  deliver(amount, atCart = true) {
    this.pending += amount;
    if (atCart) this.cartBump = 0.3;
  }

  /** The bucket rides up with each load the diggers tip in, empties on the pile, and goes back down. */
  updateHoist(dt) {
    const h = this.hoist;
    if (!h.busy) {
      if (this.hoistQueue <= 0) return;
      this.hoistQueue--;
      h.busy = true;
      h.up = true;
      h.k = 0;
    }
    if (h.up) {
      h.k = Math.min(1, h.k + dt / HOIST_UP);
      if (h.k >= 1) {
        h.up = false;
        this.orePile = Math.min(5, this.orePile + 1);
      }
    } else {
      h.k = Math.max(0, h.k - dt / HOIST_DOWN);
      if (h.k <= 0) h.busy = false;
    }
  }

  update(dt, game) {
    this.t += dt;
    this.cartBump = Math.max(0, this.cartBump - dt);
    this.updateHoist(dt);
    const vs = game.stats.village;
    for (const site of VILLAGE_SITES) {
      for (const w of this.workers[site.key]) w.update(dt, this, vs[site.key].rate);
    }
    this.payTimer -= dt;
    if (this.payTimer <= 0) {
      this.payTimer = PAYOUT_EVERY;
      if (this.pending > 0) {
        game.addGold(this.pending);
        game.effects.text(DEPOT_X, GROUND_Y - 70, '+' + fmt(this.pending), '#ffd34d', 16);
        game.effects.coinBurst(DEPOT_X, GROUND_Y - 40, Math.min(3, 1 + Math.floor(Math.log10(this.pending + 1) / 2)), WORLD_W - 70, 28);
        this.pending = 0;
      }
    }
  }

  draw(ctx, pal, night) {
    const c = villageColors(pal, night);
    drawMountain(ctx, c, this.t);
    drawRoad(ctx, c);
    for (const site of VILLAGE_SITES) drawSite(ctx, c, site, this.levels[site.key], this.t, this);
    drawDepot(ctx, c, this.cartBump);
    if (this.market) drawMarket(ctx, c, this.t);
    for (const site of VILLAGE_SITES) {
      for (const w of this.workers[site.key]) drawWorker(ctx, c, w);
    }
  }
}
