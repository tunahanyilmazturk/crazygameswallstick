import { EN } from './en.js';

/*
 * Turkish is the source language: every text in the code is its own key, wrapped in tr().
 * Other languages map those keys to translations, with {0}, {1}… for the inserted values.
 * The language is fixed for a page load; changing it reloads the game.
 */
const LANG_KEY = 'surlar-dil';
const DICTS = { en: EN };

let lang = 'en';

export function initLanguage(locale) {
  let chosen = null;
  try {
    chosen = localStorage.getItem(LANG_KEY);
  } catch {
    /* storage blocked: follow the locale */
  }
  const code = chosen ?? String(locale ?? 'en').slice(0, 2).toLowerCase();
  lang = code === 'tr' ? 'tr' : 'en';
  document.documentElement.lang = lang;
}

export const language = () => lang;

/** Saves the player's choice; the caller reloads. */
export function chooseLanguage(code) {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {
    /* storage blocked: the choice lasts until the reload */
  }
}

export function tr(key, ...args) {
  const text = DICTS[lang]?.[key] ?? key;
  return args.length ? text.replace(/\{(\d+)\}/g, (_, i) => args[i]) : text;
}
