import { h } from './dom.js';
import { iconNode } from './icons.js';

const SHOW_MS = 4200;
const MAX_VISIBLE = 3;

/**
 * Small slide-in notices (achievements, rare loot, set bonuses) stacked at the top right.
 * They sit above dialogs so a set bonus earned inside the hero window still shows.
 * kind: 'achievement' | 'loot' | 'set' (only changes the accent colour).
 */
export class Toasts {
  constructor(parent = document.body) {
    this.root = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    parent.append(this.root);
  }

  show({ icon, art, title, sub = '', kind = 'achievement', color }) {
    const el = h(`div.toast.toast-${kind}`,
      h('div.toast-icon', iconNode(icon, 'toast-art', art)),
      h('div.toast-text', h('b', title), sub ? h('span', sub) : null),
    );
    if (color) el.style.setProperty('--toast', color);
    this.root.prepend(el);
    // Oldest notices make room for new ones
    while (this.root.children.length > MAX_VISIBLE) this.root.lastChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(() => el.remove(), 400);
    }, SHOW_MS);
  }
}
