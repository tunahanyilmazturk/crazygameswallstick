import { tr } from '../i18n/i18n.js';
/*
 * Yenilikler: release notes shown from the main menu (newest first). The main menu marks the
 * button until the player has opened the notes for the current VERSION.
 *
 * Each item is [icon, text, kind]. kind is 'new' (yeni özellik), 'balance' (denge), 'change'
 * (iyileştirme, the default) or 'fix' (düzeltme). Keep texts short enough for one line.
 */
export const VERSION = 'v0.13';

export const CHANGELOG = [
  {
    version: 'v0.13',
    date: '2026-10-30',
    title: tr('Hız, Reklam ve Köy Olayları'),
    items: [
      ['🎯', tr("Zorluk artırıldı: dalga 12'den sonra düşmanlar hızla sertleşiyor, patronlar her dalgada daha dayanıklı."), 'balance'],
      ['⏩', tr("Oyun hızı kademeli: 1x ile başlanır, dalga 10'da 1.5x, dalga 20'de 2x açılır."), 'new'],
      ['🎬', tr('3x hız yalnızca reklamla açılır; her reklam 15 dakika verir, en fazla 60 dakika birikir.'), 'new'],
      ['⚡', tr('Hızlandırma artık yalnızca x2 altın veriyor; süresi dalga panelinde ara ara görünür.')],
      ['🛡️', tr('Otomatik Kuşanma: reklam izleyince 30 dakika boyunca düşen her daha güçlü eşya kendiliğinden kuşanılır.'), 'new'],
      ['🛡️', tr('Yenilgi Ganimeti: kale düşünce reklam izleyip altın ganimeti alabilirsin.'), 'new'],
      ['🎪', tr('Köy Olayları: Pazar Günü, Tüccar Kervanı ve Hasat Şenliği köy gelirini kısa süreliğine artırır.'), 'new'],
      ['📊', tr('İstatistikler yenilendi: özet kartları, ilerleme çubukları, set sayacı ve yolculuk geçmişi.')],
      ['💠', tr('Sol üstteki kaynak paneli yeniden tasarlandı: altın, Ruh Taşı ve Elmas için daha düzenli bir görünüm.')],
      ['🔊', tr('Reklam sonrası ses, sitenin sessize alma tercihini koruyor artık.'), 'fix'],
      ['🚫', tr('Reklam engelleyici açıkken reklam yerine açıklayıcı bir uyarı çıkıyor.')],
    ],
  },
  {
    version: 'v0.12',
    title: tr('Yeni Düşmanlar ve Yoldaşlar'),
    items: [
      ['💀', tr('Yeni düşmanlar: Lağımcı, Şaman, Suikastçı ve Demir Şövalye.'), 'new'],
      ['👹', tr('Her bölgede farklı bir savaş lordu; toplam sekiz patron.'), 'new'],
      ['🐺', tr('Altı evcil hayvan: Kurt Yavrusu ile Ejder Yavrusu arasında altı yoldaş.'), 'new'],
      ['🗺️', tr('Üç yeni bölge: Zehirli Bataklık, Kristal Vadi ve Boşluk Sınırı.'), 'new'],
    ],
  },
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
