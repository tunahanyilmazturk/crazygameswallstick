import { tr } from '../i18n/i18n.js';
/*
 * Yenilikler: release notes shown from the main menu (newest first). The main menu marks the
 * button until the player has opened the notes for the current VERSION.
 */
export const VERSION = 'v0.11';

export const CHANGELOG = [
  {
    version: 'v0.11',
    title: tr('Dağ, Maden ve Demirhane'),
    items: [
      ['⛰️', tr('Köyün batısında yeni bir dağ: kamera artık oraya kadar kayıyor.')],
      ['🪓', tr('Kereste Ocağı dağdaki düzlüğe taşındı; oduncular kıvrımlı dağ yolundan kütük indiriyor.')],
      ['⛏️', tr('Altın Madeni yeraltına indi: kazıcılar galeride kazıyor, kova kuyudan çıkarıyor, taşıyıcılar ambara götürüyor.')],
      ['🔨', tr('Yeni tesis Demirhane ve yeni üretim bağı Maden → Demirhane.')],
      ['⚙️', tr('Ayarlar yenilendi: grafik kalitesi, arayüz boyutu, sayı biçimi, kayıt dışa/içe aktarma.')],
      ['★', tr('Geliştirme panelinde Önerilen işareti ve tamamlananları gizleme.')],
      ['🎒', tr('Kahraman penceresi: sıralama ve yuva filtresi, ▲ daha iyi eşya ve YENİ işaretleri, kuşanılı eşyayla karşılaştırma, eşya kilitleme, çift tıkla kuşan, canlı karakter.')],
    ],
  },
  {
    version: 'v0.10',
    title: tr('Canlanan Savaş Alanı'),
    items: [
      ['🏹', tr('Kahraman ve okçular gerçek bir atış döngüsüyle: sadaktan ok alır, takar, çeker, bırakır.')],
      ['⚔️', tr('Bütün birlikler ve düşmanlar yeniden çizildi: kostümler, silahlar ve aşamalı saldırılar.')],
      ['🏘️', tr('Köylüler iki elle alet kullanıyor; vinç blok kaldırıyor, tavuklar eşeleniyor.')],
      ['🌄', tr('Manzara: hacimli bulutlar, gölgeli dağlar, sis, göl yansıması, kayan yıldızlar.')],
    ],
  },
];
