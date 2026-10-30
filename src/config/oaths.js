import { tr } from '../i18n/i18n.js';
/*
 * Yeminler: a handicap sworn for one run in exchange for more Ruh Taşı. The player picks one
 * for the next run (state.nextOath); Yeniden Doğuş makes it the running one (state.oath).
 *
 *   souls      multiplier on the Ruh Taşı that run pays
 *   enemyHp, castleHp, gold   what the handicap does to that run
 *   prestiges  Yeniden Doğuş count needed before it can be sworn
 */
export const OATHS = [
  { id: 'none', name: tr('Yeminsiz'), desc: tr('Sıradan bir yolculuk'), souls: 1, enemyHp: 1, castleHp: 1, gold: 1, prestiges: 0 },
  { id: 'iron', name: tr('Demir Yemini'), desc: tr('Düşmanların canı %40 fazla'), souls: 1.3, enemyHp: 1.4, castleHp: 1, gold: 1, prestiges: 1 },
  { id: 'blood', name: tr('Kan Yemini'), desc: tr('Kalenin canı %40 az'), souls: 1.3, enemyHp: 1, castleHp: 0.6, gold: 1, prestiges: 1 },
  { id: 'poverty', name: tr('Yoksulluk Yemini'), desc: tr('Kazanılan altın %35 az'), souls: 1.35, enemyHp: 1, castleHp: 1, gold: 0.65, prestiges: 2 },
  { id: 'ruin', name: tr('Yıkım Yemini'), desc: tr('Üçü birden: can, kale ve altın cezası'), souls: 2.2, enemyHp: 1.4, castleHp: 0.6, gold: 0.65, prestiges: 5 },
];

export const oathById = (id) => OATHS.find((oath) => oath.id === id) ?? OATHS[0];
