/** Minimal element builder: h('div.card.locked', { onclick }, child1, 'text'). */
export function h(tag, props = {}, ...children) {
  // Props are optional: h('div', 'text') / h('div', childNode)
  if (typeof props !== 'object' || props === null || props instanceof Node || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Sets textContent only when it changed (avoids layout churn at 60fps). */
export function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export function toggleClass(el, cls, on) {
  if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on);
}
