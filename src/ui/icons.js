import { h } from './dom.js';

const iconAssets = import.meta.glob('../assets/icons/*.{webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
});

const iconNames = {
  '💰': 'gold', '🪙': 'gold', '👑': 'treasure',
  '💎': 'soul-crystal', '🌀': 'soul-crystal', '💠': 'diamond',
  '🏹': 'bow', '🏰': 'castle', '🏯': 'castle', '⚔': 'sword-shield',
  '🛡': 'shield-guard', '🏘': 'village', '📊': 'spellbook', '✨': 'healing-staff',
  '📯': 'banner', '☄': 'fire-arrow', '🔰': 'shield-guard', '🧊': 'frost-mage',
  '🌟': 'medal', '🎯': 'target', '⚡': 'lightning-rune', '💀': 'poison-vial',
  '☠': 'poison-vial', '🌪': 'arrow-rain', '🧱': 'wall', '🗿': 'wall',
  '🥇': 'medal', '🌾': 'wheat', '🔮': 'mage-orb', '🎐': 'arrow-rain',
  '🌧': 'arrow-rain', '🔱': 'spear', '🔥': 'fire-arrow', '🌩': 'lightning-rune',
  '🔨': 'hammer', '⛓': 'sword-shield', '🌵': 'thorns', '🫕': 'hot-oil',
  '🏦': 'treasure', '💣': 'bomb', '🗼': 'ballista', '❄': 'frost-mage',
  '🐎': 'cavalry', '🚩': 'banner', '🗡': 'gate-guard', '👨‍🌾': 'farmer',
  '🪵': 'logs', '🪓': 'lumberjack', '⚒': 'sword-shield', '👷': 'miner', '⛏': 'miner',
  '🪨': 'quarry', '🌬': 'windmill', '🧑‍🍳': 'flour', '🏪': 'market',
  '🥁': 'gears', '⏳': 'gears', '⚙': 'gears', '🚀': 'arrow-rain', '✴': 'spellbook',
  '🌻': 'wheat', '💥': 'bomb', '🔔': 'banner',
};

function iconUrl(icon, preferredName) {
  const name = preferredName ?? iconNames[String(icon).replace(/\uFE0F/g, '')];
  return name
    ? iconAssets[`../assets/icons/${name}.webp`] ?? iconAssets[`../assets/icons/${name}.svg`] ?? null
    : null;
}

export function iconNode(icon, sizeClass = '', preferredName) {
  const src = iconUrl(icon, preferredName);
  if (!src) return h(`span${sizeClass ? `.${sizeClass}` : ''}`, icon ?? '');
  return h(`img.art-icon${sizeClass ? `.${sizeClass}` : ''}`, {
    src,
    alt: '',
    draggable: 'false',
    'aria-hidden': 'true',
  });
}

export function iconHtml(icon, sizeClass = 'tt-art', preferredName) {
  const src = iconUrl(icon, preferredName);
  if (!src) {
    const safe = String(icon ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
    return safe;
  }
  return `<img class="art-icon ${sizeClass}" src="${src}" alt="">`;
}
