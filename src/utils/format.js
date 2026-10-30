import { language } from '../i18n/i18n.js';

const SUFFIX = {
  tr: ['', 'B', 'Mn', 'Mr', 'Tr', 'Ka', 'Kn', 'Sx', 'Sp', 'Ok', 'No', 'Dc'],
  en: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'],
};

// 'short' (1.25Mn) or 'sci' (1.25e6); chosen in Ayarlar → Görüntü
let style = 'short';
export function setNumberStyle(s) {
  style = s === 'sci' ? 'sci' : 'short';
}

/** Short number format: 1.25B (bin), 3.4Mn (milyon), 12Mr (milyar)... or scientific. */
export function fmt(n) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) return n < 10 && n % 1 !== 0 ? n.toFixed(1) : String(Math.floor(n));
  // Thousands stay short either way (8.15B reads better than 8.15e3)
  if (style === 'sci' && n >= 1e6) {
    const e = Math.floor(Math.log10(n));
    return `${(n / 10 ** e).toFixed(2)}e${e}`;
  }
  const suffix = SUFFIX[language()];
  let i = 0;
  while (n >= 1000 && i < suffix.length - 1) {
    n /= 1000;
    i++;
  }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + suffix[i];
}

export function pct(v) {
  const n = (v * 100).toFixed(v < 0.1 ? 1 : 0);
  return language() === 'tr' ? `%${n}` : `${n}%`;
}

export function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const [hr, min, se] = language() === 'tr' ? ['sa', 'dk', 'sn'] : ['h', 'm', 's'];
  if (h) return `${h} ${hr} ${m} ${min}`;
  if (m) return `${m} ${min} ${s} ${se}`;
  return `${s} ${se}`;
}
