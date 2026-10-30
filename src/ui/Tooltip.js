/**
 * One shared floating tooltip. Attach content with tip(el, content) where content is a
 * string, a spec object, or a function returning either (re-evaluated while visible so
 * live values like cooldowns and costs stay current).
 *
 * spec: { icon, title, badge, desc, rows: [[label, value, cls?]], foot, footClass }
 */
import { iconHtml } from './icons.js';

const SHOW_DELAY = 220;
const REFRESH_MS = 250;
const TOUCH_HIDE_MS = 2600;

let el = null;
let target = null;
let showTimer = 0;
let refreshTimer = 0;
let hideTimer = 0;
let lastHide = 0;

export function tip(node, content) {
  node._tip = content;
  node.classList.add('has-tip');
  node.removeAttribute('title');
  return node;
}

export function renderTip(spec) {
  if (typeof spec === 'string') return `<div class="tt-desc">${spec}</div>`;
  let html = '';
  if (spec.title) {
    html += `<div class="tt-head">${spec.icon ? `<span class="tt-icon">${iconHtml(spec.icon, 'tt-art', spec.iconArt)}</span>` : ''}<span class="tt-title">${spec.title}</span>${spec.badge ? `<span class="tt-badge">${spec.badge}</span>` : ''}</div>`;
  }
  if (spec.desc) html += `<div class="tt-desc">${spec.desc}</div>`;
  if (spec.rows?.length) {
    html += '<div class="tt-rows">';
    for (const [k, v, cls] of spec.rows) {
      if (k === '---') html += '<div class="tt-sep"></div>';
      else html += `<span class="tt-k">${k}</span><span class="tt-v ${cls ?? ''}">${v}</span>`;
    }
    html += '</div>';
  }
  if (spec.foot) html += `<div class="tt-foot ${spec.footClass ?? ''}">${spec.foot}</div>`;
  return html;
}

function contentOf(node) {
  const c = node._tip;
  return typeof c === 'function' ? c() : c;
}

function paint() {
  if (!target || !target.isConnected) return hide();
  const c = contentOf(target);
  if (!c) return hide();
  const html = renderTip(c);
  if (el.innerHTML !== html) el.innerHTML = html;
  place();
}

function place() {
  const r = target.getBoundingClientRect();
  const tw = el.offsetWidth;
  const th = el.offsetHeight;
  const pad = 8;
  let x = r.left + r.width / 2 - tw / 2;
  x = Math.max(pad, Math.min(window.innerWidth - tw - pad, x));
  let y = r.top - th - 10;
  let below = false;
  if (y < pad) {
    y = r.bottom + 10;
    below = true;
  }
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.classList.toggle('below', below);
  // Arrow points at the element's centre even when the box is clamped
  el.style.setProperty('--arrow-x', `${Math.round(r.left + r.width / 2 - x)}px`);
}

function show(node) {
  target = node;
  paint();
  el.classList.add('on');
  clearInterval(refreshTimer);
  refreshTimer = setInterval(paint, REFRESH_MS);
}

function hide() {
  clearTimeout(showTimer);
  clearInterval(refreshTimer);
  clearTimeout(hideTimer);
  if (target) lastHide = performance.now();
  target = null;
  el?.classList.remove('on');
}

export function initTooltips() {
  el = document.createElement('div');
  el.className = 'tooltip';
  document.body.append(el);

  document.addEventListener('pointerover', (e) => {
    const node = e.target.closest?.('.has-tip');
    if (!node || node === target) return;
    clearTimeout(showTimer);
    // Moving between tooltipped items feels instant once one is open
    const quick = target || performance.now() - lastHide < 300;
    if (target) hide();
    showTimer = setTimeout(() => show(node), quick ? 0 : SHOW_DELAY);
    if (e.pointerType === 'touch') hideTimer = setTimeout(hide, TOUCH_HIDE_MS);
  });
  document.addEventListener('pointerout', (e) => {
    const node = e.target.closest?.('.has-tip');
    if (!node) return;
    if (e.relatedTarget && node.contains(e.relatedTarget)) return;
    if (node.contains(document.activeElement)) return;
    if (e.pointerType !== 'touch') hide();
  });
  document.addEventListener('focusin', (e) => {
    const node = e.target.closest?.('.has-tip');
    if (!node || node === target) return;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    show(node);
  });
  document.addEventListener('focusout', (e) => {
    const node = e.target.closest?.('.has-tip');
    if (!node || (e.relatedTarget && node.contains(e.relatedTarget))) return;
    if (target === node) hide();
  });
  document.addEventListener('scroll', hide, true);
  window.addEventListener('blur', hide);
}
