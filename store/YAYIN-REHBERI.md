# CrazyGames yayın rehberi

## Yüklenecek dosyalar
- Oyun: `lord-of-the-walls-build.zip`
- Kapaklar: `cover-landscape.png` (1920x1080), `cover-portrait.png` (800x1200), `cover-square.png` (800x800)
- Videolar: henüz yok, aşağıdaki bölüme göre çekilmeli

## Formda seçilecekler
- Oyun adı: Lord of the Walls
- Yön: Yatay (landscape)
- Kategori önerisi: Strateji, Kule Savunma, Idle
- Cihaz: Masaüstü, mobil yatay
- **Progress Save** seçeneği: Data modülünü seç. Seçilmezse bulut kayıt kapalı kalır.
- SDK: Evet, entegre
- Dil: İngilizce, Türkçe

## Açıklama (İngilizce, forma yapıştır)
Hold the last castle against endless waves of raiders. Click to fire your arrows, hire archers, mages and siege crews, and raise your walls from a stone outpost to a golden fortress.

Build a village that earns while you are away, equip gear in sets, raise companions like the Wolf Pup and the Dragon Hatchling, and face a different boss in each of eight regions. When progress slows, Rebirth for Soul Stones and come back stronger.

## Kontroller (İngilizce, forma yapıştır)
- Click or tap the battlefield: fire arrows. Hold for rapid fire.
- Space, Z, X, C, V, B, N: skills
- Q W E R T O Y U I: menu tabs
- A: buy all, H: collapse the menu, 1 2 3: game speed, Arrow keys or drag: move the camera

## Açıklama (Türkçe)
Son kaleyi bitmeyen akın dalgalarına karşı savun. Tıklayarak ok at, okçu, büyücü ve kuşatma birlikleri kirala, surlarını taş karakoldan altın hisara yükselt.

Sen yokken de kazanan bir köy kur, set eşyaları kuşan, Kurt Yavrusu ve Ejder Yavrusu gibi yoldaşlar büyüt, sekiz bölgenin her birinde farklı bir patronla yüzleş. İlerleme yavaşlayınca Yeniden Doğ, Ruh Taşlarıyla daha güçlü dön.

## Önizleme videoları (senin çekmen gerekiyor)
CrazyGames iki video istiyor: yatay 1920x1080 ve dikey 2:3, ikisi de en fazla 20 saniye ve 50 MB, sessiz.
1. Windows'ta OBS Studio ile oyun penceresini kaydet.
2. İlk kareler kapak görseliyle başlasın, sonra dalga 25+ bir savaş göster.
3. Hızlandırılmış görüntü, yazı, "Play Now", logo, siyah şerit ve fare imleci kullanma.
4. Dikey video için aynı görüntüyü kaleye yakın kırp.

## Yayın adımları
1. https://developer.crazygames.com adresinde geliştirici hesabı aç.
2. Yeni oyun oluştur, bu klasördeki dosyaları ve metinleri yükle.
3. Testte oyunu aç: yükleme, ses, kayıt ve İngilizce metni kontrol et.
4. Gönder. Oyun önce Basic Launch'a girer (reklam yok, gelir yok).
5. En az 7 gün ve 500 oynanış sonrası metrikleri takip et.

## Full Launch'a seçilirsen
1. `src/platform/platform.js` içinde `ADS_LIVE = false` değerini `true` yap.
2. `npm run build` çalıştır, `dist` içeriğini yeniden zip'le ve güncelle.

Bu ayar açılınca Hızlandırma ve VIP Elçi pencerelerinde "Reklam izle" seçeneği ve patron sonrası ara reklam devreye girer. Basic Launch'ta açık bırakılırsa etkisiz reklam düğmesi kuralı ihlal edilir.

## Satışı etkileyen ayarlar (`src/config/rewards.js`)
- Hızlandırma: 30 dk, x2 altın, +%25 saldırı hızı, 3x oyun hızı, reklamsız bedeli 2 Elmas
- VIP Elçi: 12 dakikada bir, reklamla 2 Elmas, altınla 1 Elmas
- Ara reklam: 15. dakikadan sonra, yalnızca patron dalgası bitince, en az 7 dakika arayla
