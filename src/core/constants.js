import { tr } from '../i18n/i18n.js';
// World layout (logical pixels). The canvas is scaled to fit the screen.
export const WORLD_W = 1280;
export const WORLD_H = 720;
export const GROUND_Y = 610;
// Widest visible area; extra width beyond WORLD_W is shown left of the castle (x < 0)
export const MAX_VIEW_W = 2240;
export const SCENERY_MIN_X = WORLD_W - MAX_VIEW_W - 40;
// Leftmost world x the camera may pan to: the mountain beyond the village (lumber camp)
export const WORLD_MIN_X = -1240;

export const WALL_TOP = 440;      // walkway on top of the wall
export const WALL_FRONT = 250;    // right edge of the wall
// Leftmost battlefield x for clicks: enemies at the wall's foot stand just past WALL_FRONT
export const FIELD_MIN_X = WALL_FRONT - 10;
export const TOWER_TOP = 280;     // top of the keep tower
// Taş Duvarlar levels where the castle is rebuilt in better stone (entities/Castle.js)
export const FORTRESS_TIERS = [
  { level: 0, name: tr('Taş Karakol') },
  { level: 10, name: tr('Hisar') },
  { level: 25, name: tr('Büyük Kale') },
  { level: 50, name: tr('Altın Hisar') },
];
export const SPAWN_X = WORLD_W + 50;

// Where the hero stands (every other unit's post is in units/roster.js)
export const SLOTS = {
  hero: { x: 214, y: WALL_TOP },
};

export const GRAVITY = 900;
export const FIXED_DT = 1 / 120;
export const INK = '#15131a';
export const FLASH = '#fff4e0';
