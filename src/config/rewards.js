/*
 * Optional bonuses. Every one has a choice that needs no ad, so the game loses nothing when
 * ads are off (Basic Launch, ad blockers, other sites), and both are offered in a paused
 * window, because CrazyGames does not allow ad buttons on an active gameplay screen.
 */

/** Hızlandırma: enemy gold and attack speed for a stretch of played time. */
export const BOOST = {
  seconds: 1800,
  gold: 2,
  rate: 1.25,
  gems: 2,           // the price without an ad
  renewBelow: 300,   // can be taken again once this many seconds are left
};

/** VIP Elçi: shows up in the keep's window now and then and offers Elmas. */
export const VIP = {
  firstAfter: 480,   // seconds of play before the first visit
  every: 720,        // seconds of play between visits
  retry: 200,        // comes back sooner when the player missed him
  stay: 45,          // how long he waits at the window
  minWave: 5,
  adGems: 2,
  goldGems: 1,
  goldSeconds: 120,  // gold price: this many seconds of current income
  minGold: 200,
};

/**
 * Oyun hızı: 2x opens at wave `wave2` of a run. 3x is never earned by playing; each ad
 * watched gives `fastSeconds` of it, and the stock can stack up to `maxSeconds`.
 */
export const SPEED = {
  wave2: 10,
  fastSeconds: 900,
  maxSeconds: 3600,
};

/** Yenilgi Ganimeti: after the castle falls, an ad can turn the setback into gold. */
export const FALL_RELIEF = {
  firstAfter: 300,   // seconds of play before it can show
  every: 600,        // seconds of play between offers
  goldSeconds: 120,  // this many seconds of current income
  minGold: 100,
  delayMs: 1800,     // lets the "Kale Düştü!" banner be read first
};

/** Ara reklam: only after a boss wave, and never in a player's first minutes. */
export const MIDGAME = {
  firstAfter: 900,
  every: 420,
};
