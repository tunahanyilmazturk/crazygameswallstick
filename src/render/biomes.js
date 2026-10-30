import { tr } from '../i18n/i18n.js';
/*
 * Regions the march passes through. The map changes every 25 waves: a region tints the
 * day-cycle palette toward its own colours, picks which trees grow on the hills, what lies
 * in the valley (lake, ice, lava), what covers the ground and what weather blows in.
 *
 *   tint      palette colours to blend toward (keys of Background PALETTES), at `strength`
 *   trees     weights for the hill trees: pine, round, snowy (snow-capped pine), dead, cactus
 *   density   share of tree spots that hold a tree here
 *   leaves    colours of round-tree crowns (autumn mixes several)
 *   valley    'water' | 'ice' | 'lava' | null — the lake glimpsed between the hills
 *   cover     ground detail: 'meadow' | 'leaves' | 'snow' | 'sand' | 'ash'
 *   weather   (wave) => particle type or null: 'rain' | 'leaves' | 'snow' | 'dust' | 'ash'
 *   special   extra sky/landscape feature: 'aurora' | 'volcano' | 'mesa' | null
 */
export const BIOMES = [
  {
    id: 'vale', name: tr('Yeşil Vadi'), fromWave: 1, strength: 0,
    tint: {},
    trees: { pine: 0.6, round: 0.4 }, density: 1, leaves: ['#4a627c'],
    valley: 'water', cover: 'meadow', special: null,
    weather: (w) => (w % 5 === 3 ? 'rain' : null),
  },
  {
    id: 'autumn', name: tr('Sonbahar Ormanı'), fromWave: 25, strength: 0.6,
    tint: { forest: '#7a3f26', mid: '#6d5546', far: '#a08a86', near: '#4d3c34', groundTop: '#5e4527', grass: '#9a6a2a', flower: '#e08a3a', fog: '#f0b07a' },
    trees: { pine: 0.25, round: 0.75 }, density: 1, leaves: ['#b8562a', '#d0862e', '#9a3a26', '#c9a03a'],
    valley: 'water', cover: 'leaves', special: null,
    weather: (w) => (w % 6 === 2 ? 'rain' : 'leaves'),
  },
  {
    id: 'snow', name: tr('Karlı Geçit'), fromWave: 50, strength: 0.72,
    tint: {
      skyTop: '#7fa6d6', skyBot: '#e3ecf7', far: '#c8d2e4', snow: '#ffffff', mid: '#9fadc4', forest: '#4e5f7e', near: '#aab6ca',
      groundTop: '#e2e9f3', grass: '#c9d4e2', ground: '#454a58', road: '#7a808e', fog: '#eef3fa', flower: '#ffffff',
    },
    trees: { snowy: 1 }, density: 0.9, leaves: ['#4e5f7e'],
    valley: 'ice', cover: 'snow', special: 'aurora',
    weather: () => 'snow',
  },
  {
    id: 'desert', name: tr('Kızıl Bozkır'), fromWave: 75, strength: 0.75,
    tint: {
      skyTop: '#4f8fd0', skyBot: '#f6d39a', far: '#c98a5c', snow: '#e8b88a', mid: '#b07042', forest: '#6e4e30', near: '#a0663a',
      groundTop: '#c4955a', grass: '#a2823e', ground: '#563a24', road: '#8a6a44', fog: '#f2c890', flower: '#e8c860',
    },
    trees: { cactus: 0.6, dead: 0.4 }, density: 0.32, leaves: ['#6e4e30'],
    valley: null, cover: 'sand', special: 'mesa',
    weather: (w) => (w % 3 === 0 ? 'dust' : null),
  },
  {
    id: 'volcano', name: tr('Kül Diyarı'), fromWave: 100, strength: 0.8,
    tint: {
      skyTop: '#2a1418', skyBot: '#b0503a', sun: '#ff9a6a', far: '#4a2a2a', snow: '#6e3428', mid: '#3a2226', forest: '#24161a',
      near: '#2e1c1e', groundTop: '#3a2622', grass: '#4a2a22', ground: '#1c1214', road: '#3a2420', fog: '#c4583a', flower: '#ff8a4a',
    },
    trees: { dead: 1 }, density: 0.45, leaves: ['#24161a'],
    valley: 'lava', cover: 'ash', special: 'volcano',
    weather: () => 'ash',
  },
  {
    id: 'swamp', name: tr('Zehirli Bataklık'), fromWave: 125, strength: 0.78,
    tint: {
      skyTop: '#3a4a3a', skyBot: '#a8b47a', far: '#5e6e52', snow: '#7a8a62', mid: '#465a40', forest: '#2a3a28',
      near: '#34442e', groundTop: '#4a5a32', grass: '#5e7030', ground: '#26301e', road: '#4a4a30', fog: '#a8c47a', flower: '#c8e04a',
    },
    trees: { dead: 0.6, round: 0.4 }, density: 0.7, leaves: ['#3a5a2a', '#5a6a2a'],
    valley: 'water', cover: 'leaves', special: null,
    weather: (w) => (w % 2 ? 'rain' : null),
  },
  {
    id: 'crystal', name: tr('Kristal Vadi'), fromWave: 150, strength: 0.8,
    tint: {
      skyTop: '#2e2456', skyBot: '#c4a8e8', far: '#7a68b0', snow: '#e6d8ff', mid: '#5a4a8a', forest: '#3a2e66',
      near: '#46387a', groundTop: '#6a5a9a', grass: '#8a78c0', ground: '#2a2244', road: '#5a4e80', fog: '#d6c4ff', flower: '#e6d8ff',
    },
    trees: { dead: 0.5, snowy: 0.5 }, density: 0.5, leaves: ['#3a2e66'],
    valley: 'ice', cover: 'snow', special: 'aurora',
    weather: (w) => (w % 3 === 0 ? 'snow' : null),
  },
  {
    id: 'void', name: tr('Boşluk Sınırı'), fromWave: 175, strength: 0.86,
    tint: {
      skyTop: '#0c0a14', skyBot: '#3a2a5a', sun: '#b48cff', far: '#221a34', snow: '#3a2e54', mid: '#1a1428', forest: '#100c1a',
      near: '#16101f', groundTop: '#241c30', grass: '#2e2440', ground: '#0e0a14', road: '#221a2c', fog: '#5a3a8a', flower: '#b48cff',
    },
    trees: { dead: 1 }, density: 0.3, leaves: ['#100c1a'],
    valley: null, cover: 'ash', special: null,
    weather: () => 'ash',
  },
];

export function biomeForWave(wave) {
  let biome = BIOMES[0];
  for (const b of BIOMES) if (wave >= b.fromWave) biome = b;
  return biome;
}
