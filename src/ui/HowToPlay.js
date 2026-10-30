import { h } from './dom.js';
import { showModal } from './Modal.js';
import { HERO_ITEM_RARITIES } from '../systems/HeroItems.js';
import { MEDALS } from '../config/achievements.js';
import { OATHS } from '../config/oaths.js';
import { levelOf } from '../systems/Economy.js';
import { tr } from '../i18n/i18n.js';

const tip = (text) => tr('<p class="guide-tip"><b>İpucu</b> {0}</p>', text);
const go = (tab, label) => `<button class="guide-link" data-go="${tab}">${label} →</button>`;
const rows = (list) => `<dl class="guide-rows">${list.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
const steps = (list) => `<ol class="guide-steps">${list.map((s) => `<li>${s}</li>`).join('')}</ol>`;

/** What this player should do next, read from their own game; at most three items. */
function nextSteps(game) {
  const s = game.state;
  const list = [];
  const owned = (id) => levelOf(s, id) > 0;
  if (!owned('heroDamage')) list.push([tr('Keskin Oklar al: altınının ilk ve en iyi yatırımı.'), 'hero', tr('Kahraman')]);
  if (!owned('allyArcher') && s.gold >= 10 && s.bestWave >= 2) list.push([tr('İlk birliğini kirala: sen tıklamazken de savaşırlar.'), 'allies', tr('Birlikler')]);
  if (s.bestWave >= 10 && !s.gemLevels.heroAuto && s.gems >= 3) list.push([tr('Otomatik Atış\'ı aç: kahraman kendiliğinden ateş etsin.'), 'hero', tr('Kahraman')]);
  if (s.heroInventory?.length && !Object.values(s.heroEquipment).some(Boolean)) list.push([tr('Bulduğun eşyaları kuşan: "En Güçlüleri Kuşan" tek tıkla halleder.'), 'inventory', tr('Envanter')]);
  if (s.bestWave >= 5 && (s.heroEssence ?? 0) >= 10 && !Object.keys(s.petLevels ?? {}).length) list.push([tr('Kurt Yavrusu\'nu sahiplen: Öz biriktirdin.'), 'pets', tr('Yoldaşlar')]);
  if (s.bestWave >= 20 && !s.prestiges) list.push([tr('Yeniden Doğuş açıldı: takılınca Ruh Taşı alıp güçlenerek dön.'), 'souls', tr('Ruh')]);
  if (!list.length) list.push([tr('Dalga {0} patronuna hazırlan: önerilen (★) geliştirmeleri al.', Math.ceil((s.wave + 1) / 10) * 10), 'hero', tr('Kahraman')]);
  return list.slice(0, 3);
}

const CHAPTERS = [
  {
    id: 'start', icon: '🏰', title: tr('Başlarken'),
    body: (game) => tr('\n      <p class="guide-lead">Kaleni dalga dalga gelen düşmanlardan koru. Her dalga seni biraz daha güçlendirir; yenilmek oyunun sonu değildir.</p>\n      <div class="guide-loop" aria-label="Oyun döngüsü">\n        <span>🏹 Düşman yen</span><i>→</i><span>💰 Altın topla</span><i>→</i><span>⚡ Geliştir</span><i>→</i><span>🌊 Daha ileri git</span>\n      </div>\n      <h4>Sıradaki adımın</h4>\n      <ul class="guide-next">{0}</ul>\n      {1}', nextSteps(game).map(([text, tab, label]) => `<li><span>${text}</span>${go(tab, label)}</li>`).join(''), tip(tr('Takıldığında panik yapma: oyun kapalıyken bile altın birikir (başta 8 saate kadar, %50 verimle).'))),
  },
  {
    id: 'fight', icon: '🏹', title: tr('Savaş'),
    body: () => `
      ${steps([
        tr('<b>Savaş alanına tıkla:</b> kahraman oraya ok atar.'),
        tr('<b>Basılı tut:</b> seri atış yapar. İlerde Otomatik Atış bunu devralır.'),
        tr('<b>Yetenekleri kullan:</b> alttaki çubuktan ya da Boşluk, Z, X, C, V, B, N tuşlarıyla. <b>A</b> rozeti açıksa kendiliğinden kullanılır.'),
      ])}
      ${rows([
        [tr('Patron'), tr('Her 10. dalgada gelir. Canı %30\'un altına düşünce öfkelenir, hızlanır.')],
        [tr('Kale düşerse'), tr('2 dalga geri çekilirsin. İlerleme silinmez, kale onarılır.')],
        [tr('Tekrar / İlerle'), tr('Üstteki düğme: "Tekrar" aynı dalgada altın toplar, "İlerle" yeni dalgaya geçer.')],
        [tr('Oyun hızı'), tr('Üstten ya da 1, 2, 3 tuşlarıyla değişir. 3x, ilk Yeniden Doğuş\'ta ya da Hızlandırma sırasında açılır.')],
      ])}
      ${tip(tr('Bir dalgada zorlanıyorsan "Tekrar"a al, biraz altın biriktirip güçlenince devam et.'))}`,
  },
  {
    id: 'upgrade', icon: '⚡', title: tr('Geliştirme'),
    body: () => tr('\n      {0}\n      <h4>Menüyü kullanmak</h4>\n      <ul class="guide-list">\n        <li><b>★ Önerilen:</b> altın başına en çok güç veren kart.</li>\n        <li><b>x1, x10, MAX:</b> tek tıkta kaç seviye alınacağı.</li>\n        <li><b>Tümünü Al:</b> listelenen kartlardan en ucuzunu tekrar tekrar alır.</li>\n        <li><b>Filtreler:</b> Satın alınan, Alınabilir, Favoriler; ayrıca arama ve sıralama.</li>\n      </ul>\n      {1}', rows([
        [`${go('hero', tr('Kahraman'))}`, tr('Ok hasarı, atış hızı, kritik ve Ok Yağmuru.')],
        [`${go('castle', tr('Kale'))}`, tr('Can, onarım, zırh, Dış Sur ve savunma yapıları. Taş Duvarlar Sv 10, 25 ve 50\'de kale büyür.')],
        [`${go('allies', tr('Birlikler'))}`, tr('Kendi kendine savaşan okçular, büyücüler, kuşatma ve piyade. Bir dalın hepsini kiralarsan ustalaşır.')],
        [`${go('village', tr('Köy'))}`, tr('Pasif altın. Bina kur, sonra işçi kirala: işçisiz bina üretmez.')],
      ]), tip(tr('Kartın üstüne gelince tam değerleri ve bir sonraki seviyeyi görürsün.'))),
  },
  {
    id: 'items', icon: '🎒', title: tr('Eşyalar'),
    body: () => tr('\n      <p>Düşmanlar nadiren, patronlar sık sık eşya düşürür. Eşyalar Yeniden Doğuş\'ta kaybolmaz.</p>\n      <div class="guide-chips">{0}</div>\n      <p class="guide-note">Sınıf yükseldikçe eşya güçlenir. Nadir 1, Destansı 2, Efsanevi 3 ek özellik taşır.</p>\n      {1}\n      {2}\n      {3}', HERO_ITEM_RARITIES.map((r) => `<span style="--c:${r.color}">${r.name}</span>`).join(''), rows([
        [tr('Çanta'), tr('<b>▲</b> işaretli eşya kuşandığından güçlüdür. Çift tıkla kuşan, altınla geliştir.')],
        [tr('Demirci'), tr('Eşya satmak <b>Öz</b> verir. 3 aynı sınıf eşyayı Öz ile bir üst sınıfa birleştir.')],
        [tr('Setler'), tr('Aynı setten parçalar (<b>⬢</b>) 2, 4 ve 6 parçada ek güç açar.')],
        [tr('Koleksiyon'), tr('Her yeni eşya türü kalıcı +%0,5 kahraman hasarı verir.')],
      ]), go('inventory', tr('Envanteri aç')), tip(tr('Demirci\'deki Otomatik Satış, işe yaramayan sıradan eşyaları çantaya girmeden satar.'))),
  },
  {
    id: 'pets', icon: '🐾', title: tr('Yoldaşlar'),
    body: () => tr('\n      <p>Yoldaşlar kahramanın yanında savaşır ve pasif bonus verir. Öz ile sahiplenir, büyütürsün; Yeniden Doğuş\'ta seninle kalırlar.</p>\n      {0}\n      <p class="guide-note">Aynı anda bir yoldaş savaşır; sekmeden istediğin zaman değiştirirsin.</p>\n      {1}', rows([
        [tr('Saldırgan'), tr('Kurt Yavrusu, Av Şahini, Ejder Yavrusu düşmanlara saldırır.')],
        [tr('Savunma'), tr('Kaya Kaplumbağası kaleyi onarır, kale hasarını azaltır.')],
        [tr('Destek'), tr('Altın Tilki altın bulur, Gece Baykuşu yavaşlatır ve eşya şansını artırır.')],
      ]), go('pets', tr('Yoldaşlar'))),
  },
  {
    id: 'enemies', icon: '👹', title: tr('Düşmanlar'),
    body: () => tr('\n      <p>Her düşman farklı bir cevap ister. Yeni tür ilk geldiğinde ekranda tanıtılır.</p>\n      <table class="guide-table">\n        <thead><tr><th>Düşman</th><th>Tehlikesi</th><th>Cevabın</th></tr></thead>\n        <tbody>\n          <tr><td>Kalkanlı, Demir Şövalye</td><td>Yüksek zırh</td><td>Büyü ve yanma zırhı yok sayar</td></tr>\n          <tr><td>Akbaba, Kuzgun, Hayalet</td><td>Askerleri aşar</td><td>Avcı, okçular, büyücüler</td></tr>\n          <tr><td>Lağımcı</td><td>Değince patlar</td><td>Ulaşmadan vur</td></tr>\n          <tr><td>Şaman</td><td>Çevresini iyileştirir</td><td>Önce onu hedefle</td></tr>\n          <tr><td>Suikastçı</td><td>Oklardan sıyrılır</td><td>Büyü her zaman isabet eder</td></tr>\n          <tr><td>Koçbaşı, Mancınık</td><td>Surları döver</td><td>Topçu, Dış Sur, tıklayarak odaklan</td></tr>\n        </tbody>\n      </table>\n      <p class="guide-note">Her 25 dalgada yeni bölgeye geçersin. Her bölgenin kendi düşmanı ve patronu vardır; son bölge dalga 175\'te başlar.</p>'),
  },
  {
    id: 'skills', icon: '✨', title: tr('Yetenek ve Elmas'),
    body: () => tr('\n      <p><b>💠 Elmas</b> patronlardan, aşama ödüllerinden, başarımlardan ve Yeniden Doğuş\'tan gelir. Hiç sıfırlanmaz.</p>\n      {0}\n      {1}\n      {2}', rows([
        [tr('Otomatik Atış'), tr('Dalga 10 · Kahraman sekmesi. İlk harcaman bu olsun.')],
        [tr('Aktif yetenekler'), tr('Savaş Narası (15), Meteor (30), İlahi Kalkan (35), Zaman Dondurma (45), Midas Dokunuşu (60).')],
        [tr('Yetenek Ağacı'), tr('Okçuluk, Savunma ve Ticaret dallarında kalıcı bonuslar.')],
      ]), go('skills', tr('Yetenekler')), tip(tr('Parantez içindeki sayı, yeteneğin açılması için gereken en iyi dalgandır.'))),
  },
  {
    id: 'rebirth', icon: '💎', title: tr('Yeniden Doğuş'),
    body: () => tr('\n      <p>Dalga 20\'den sonra Ruh sekmesinden yeniden doğabilirsin. Geliştirmeler sıfırlanır, karşılığında kalıcı <b>Ruh Taşı</b> kazanırsın. Ne kadar ileri gittiysen o kadar çok kazanırsın.</p>\n      <div class="guide-compare">\n        <div><b>Sıfırlanır</b><span>Altın ve dalga</span><span>Kahraman ve kale geliştirmeleri</span><span>Birlikler ve köy</span></div>\n        <div><b>Kalır</b><span>Ruh Taşı ve geliştirmeleri</span><span>Elmas, yetenekler, başarımlar</span><span>Eşyalar, yoldaşlar, Koleksiyon</span></div>\n      </div>\n      <h4>Yeminler</h4>\n      <p>Sonraki yolculuğu zorlaştırıp daha çok Ruh Taşı al: {0}.</p>\n      {1}\n      {2}', OATHS.filter((o) => o.souls > 1).map((o) => `${o.name} x${o.souls}`).join(', '), go('souls', tr('Ruh')), tip(tr('İlerleme yavaşladığında doğmak genellikle en hızlı yoldur; ilk Ruh Taşları Kadim Güç ve Altın Ruhu\'na gitsin.'))),
  },
  {
    id: 'glory', icon: '🏆', title: tr('Başarımlar'),
    body: () => tr('\n      <p>Her başarım Elmas ve kalıcı <b>Şan</b> verir. Şan tüm hasarı ve altını artırır.</p>\n      <div class="guide-chips">{0}</div>\n      <p class="guide-note">Şan biriktikçe rütbe atlarsın; her rütbe kalıcı bir ödül verir (Er, Onbaşı … Mareşal). Gizli başarımlar kazanılana kadar ??? görünür.</p>\n      {1}', MEDALS.map((m) => tr('<span style="--c:{0}">{1} · {2} Şan</span>', m.color, m.name, m.points)).join(''), go('feats', tr('Başarımlar'))),
  },
  {
    id: 'keys', icon: '⌨', title: tr('Kısayollar'),
    body: () => `
      ${rows([
        ['Q W E R T', tr('Kahraman, Kale, Birlikler, Köy, Ruh')],
        ['O Y U I', tr('Yoldaşlar, Yetenekler, İstatistik, Başarımlar')],
        [tr('Boşluk, Z'), tr('Ok Yağmuru')],
        ['X C V B N', tr('Diğer yetenekler')],
        ['A', tr('Tümünü Al')],
        ['H', tr('Menüyü küçült, savaş alanı büyür')],
        ['1 2 3', tr('Oyun hızı')],
        ['← →', tr('Kamerayı kaydır, köyü gör')],
        ['Esc', tr('Menü')],
      ])}`,
  },
];

/**
 * Nasıl Oynanır: a chaptered guide. Chapters sit in a side list, the first one reads the
 * player's own save for what to do next, and links jump straight to the tab they explain.
 * hooks: { onOpen(tab), onClose() }; `tab` may be 'inventory'.
 */
export function showHowToPlay(root, game, { onOpen, onClose }) {
  let index = 0;
  const content = h('div.guide');
  let close = null;

  const render = () => {
    const chapter = CHAPTERS[index];
    content.innerHTML = tr('\n      <nav class="guide-nav" aria-label="Konular">{0}</nav>\n      <article class="guide-page">\n        <h3>{1} {2}</h3>\n        <div class="guide-body">{3}</div>\n        <footer>\n          <button class="guide-arrow" data-page="{4}" {5}>← Geri</button>\n          <span>{6} / {7}</span>\n          <button class="guide-arrow" data-page="{8}" {9}>İleri →</button>\n        </footer>\n      </article>', CHAPTERS.map((c, i) => `<button class="${i === index ? 'on' : ''}" data-page="${i}" aria-current="${i === index ? 'page' : 'false'}"><span>${c.icon}</span>${c.title}</button>`).join(''), chapter.icon, chapter.title, chapter.body(game), index - 1, index ? '' : 'disabled', index + 1, CHAPTERS.length, index + 1, index < CHAPTERS.length - 1 ? '' : 'disabled');
  };

  const turn = (to) => {
    if (to < 0 || to >= CHAPTERS.length) return;
    index = to;
    render();
  };

  content.addEventListener('click', (event) => {
    const page = event.target.closest('[data-page]');
    if (page) return turn(Number(page.dataset.page));
    const link = event.target.closest('[data-go]');
    if (!link) return undefined;
    close?.();
    return onOpen(link.dataset.go);
  });
  // Arrow keys turn the page here instead of panning the camera behind the dialog
  content.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.stopPropagation();
    turn(index + (event.key === 'ArrowRight' ? 1 : -1));
  });

  render();
  const modal = showModal(root, {
    title: tr('Nasıl Oynanır?'),
    body: content,
    className: 'guide-modal',
    buttons: [{ label: tr('Savaşa Dön'), primary: true }],
    onClose,
  });
  close = modal;
}
