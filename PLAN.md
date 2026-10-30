# Surların Efendisi — Son Okçu Ayakta

Web tabanlı, çöp adam (stick figure) siluet stilinde, idle (otomatik) kule savunma oyunu. (Eski çalışma adı: Çöp Kale.)

## Oyun Döngüsü
1. Sol tarafta **kalemiz** var, duvarın üstünde **kahraman okçu** otomatik ateş ediyor.
2. Sağdan **düşman dalgaları** geliyor; öldürülen her düşman **altın** verir.
3. Altınla kahramanı, kaleyi geliştir ve **destek birlikleri** kirala.
4. Her 10. dalgada **Patron (Savaş Lordu)** gelir, gece olur.
5. Kale düşerse oyun bitmez: 2 dalga geri çekilinir (idle tarzı farm), ilerleme korunur.
6. Oyun kapalıyken **çevrimdışı kazanç** birikir (en fazla 8 saat, %50 verim).

## Kahraman (Okçu)
| Geliştirme | Etki |
|---|---|
| Keskin Oklar | Ok hasarı |
| Seri Atış | Atış hızı |
| Ölümcül Nişan | Kritik şansı |
| Zehirli Uç | Kritik çarpanı |
| Çoklu Ok | Aynı anda atılan ok |
| Ok Yağmuru | Aktif yetenek (otomatik kullanım açılabilir) |

**Tıklayarak ateş (v0.9):** Kahraman başta kendiliğinden ateş etmez; oyuncu savaş alanına tıklar ya da basılı tutar
(seri atış, kahraman atış hızının 1,25 katı; Çoklu Ok da geçerli). **Otomatik Atış** (Kahraman sekmesi, 💠 Elmas,
Dalga 10 aşaması, en fazla 6 seviye: 💠 3 → 4 → 6 → 9 → 13 → 19) otomatik ateşi atış hızının %30 → %44 → %58 → %72 → %86 → %100'ü
ile açar; Yeniden Doğuş'ta kaybolmaz. Elle atış otomatik atıştan bağımsızdır, aktif oyuncu ikisini birden kullanır.
Tıklanmadığında ve düşman varken ekranda "Düşmanlara tıkla" ipucu yanıp söner. Eski kayıtlarda en iyi dalgası 10+ olanlara
Otomatik Atış Sv 1 verilir. Simülasyon botu Otomatik Atış tamamlanana kadar en öndeki düşmana basılı tutar.

## Yetenek görselleri (v0.11, `render/skillFx.js`)
Her yetenek kahramanın ayağında dönen bir rün çemberiyle başlar. Ok Yağmuru fırtına cephesi ve yer işareti, Savaş Narası
ışınlar ve şok halkaları, Meteor kapanan hedef halkası ve soğuyan krater, İlahi Kalkan altıgen dokulu kubbe (darbede
dalgalanır, bitince kırılır), Zaman Dondurma buz kabukları, kenarlarda don ve geri dönen saat (bitişte buz parçalanır),
Midas altın ışınlar ve yağan paralar gösterir. Görseller oyun mantığını etkilemez. Yetenek çubuğu saat gibi bekleme
süresi, kalan saniye, etkin süre halkası ve hazır/kullanım animasyonları kullanır; renkler `SKILL_COLORS`'tan gelir.

## Kale
Taş Duvarlar (can), Onarım Ekibi (can yenileme), Demir Kaplama (zırh), Hazine Odası (altın çarpanı).

**Yeniden tasarım (v0.11):** Kale; kule (keep), kapı binası ve surun ucundaki yuvarlak ön burçla baştan çizildi
(`entities/Castle.js`, eklentiler `render/castleProps.js`). Birimlerin durduğu `WALL_TOP`/`TOWER_TOP` değişmedi; ön burcun
yüzü yine `WALL_FRONT`'tur. Taş Duvarlar seviyesi kale kademesini belirler (`FORTRESS_TIERS`, Kale sekmesinde gösterilir):
Sv 0 Taş Karakol (kaba taş, sarmaşık), Sv 10 Hisar (iç salon, payanda), Sv 25 Büyük Kale (açık kesme taş, kornişler),
Sv 50 Altın Hisar (soluk kireçtaşı, altın kapaklar, taçlı arma).
Her kale geliştirmesi kalede görünür:

| Geliştirme | Etki | Görünüm |
|---|---|---|
| Onarım Ekibi | Can yenileme | Sürekli duran iskele; hasarda duvarcı çalışır |
| Demir Kaplama | Hasar azaltma | Burç kuşakları ve köşe plakaları; Sv 15 demir kapı, Sv 25 uzun parmaklık, Sv 30 kule kuşakları |
| Hazine Odası | Altın çarpanı | Sancak süslemesi; Sv 10 altın şerit, Sv 20 altın kapı kuşakları |
| Altın Kasası | Faiz | Kule yüzünde yuvarlak kasa kapısı |
| Gözcü Ateşi (yeni) | Kahraman kritik şansı +%0.4/sv (maks 20) | Kuleden uzanan cresset; ateş seviyeyle büyür |
| Erzak Ambarı (yeni) | Dalga başında kale ve Dış Sur canının %2/sv'si onarılır (maks 20) | Kule dibinde dolan sundurma |
| Savaş Çanı (yeni) | Duvara yaklaşan düşman varsa çalar: yakındakiler %20-48 yavaşlar, 3 sn (maks 15) | Sur üstünde taş çan kemeri |
| Burç Mancınığı (yeni) | En kalabalık kara kümesine kaya (alan hasarı, 6-11 sn) | Kule tepesinde mancınık; kol kaya atarken savrulur |

**Hasar görünümü (v0.11, `render/battleDamage.js`):** Kale ve Dış Sur aynı dört aşamayı kullanır (`damageStage`): %75 üstü
sağlam, %75-50 çatlak, %50-25 gedik ve is, %25 altı yanıyor. Aşama kötüleşince parça ve toz dökülür, ekran sarsılır;
onarımla aşama düşünce kalede "Duvarlar onarıldı" yazar. Kale: tek tek darbeler ön burçta çentik bırakır (onarımla kapanır), salon
çatısı delinir, sancak yırtılır, mazgallar düşer, en kötü aşamada ön burcun tepesi yıkılır. Dış Sur: çit kütükleri kırılır,
taş surun tepesi yıkılır, kapı yarılır, kule çatıları yanar; yıkılınca kömürleşmiş kalıntı tüter, onarılınca yerden yükselir.

### Dış Sur (v0.4, `entities/OuterWall.js`)
Kalenin önünde, kalkanlı askerlerin hemen arkasında (x 380–452) kapılı bir sur. Kara düşmanları (kuşatma makineleri
dahil) önce askerleri, sonra suru aşmak zorundadır; uçanlar üstünden geçer.
| Geliştirme | Etki | Görünüm |
|---|---|---|
| Dış Sur | Surun canı (Ruh/yetenek/set can bonusları uygulanır) | Sv 1 ahşap çit, Sv 10 taş sur, Sv 25 köşe kuleli sur |
| Sur Kapısı (Dış Sur gerekir) | Sura gelen hasar azalır (%4/sv bileşik, maks 40) | Sv 10 demir kuşak, Sv 25 demir parmaklık |
| Sur Okçuları (Dış Sur gerekir) | Surun üstünde 1/2/3 okçu (Sv 1/10/25) | Sur ayaktayken ateş ederler |
Sur, kale onarımının yarısıyla kendini onarır; Şifacı da onarır. Yıkılırsa sonraki dalga başında yarı canla,
kale düşünce tamamen onarılır. Süvari geçerken kapı açılır.

## Ordu (Birlikler, v0.5 — `src/units/`)
Her birlik tek yerde tanımlanır: `units/roster.js` (kimlik, branş, konum, ekonomi, davranış, çizim, statlar).
`units/behaviors.js` savaş davranışları (`shoot`, `melee`, `heal`, `aura`, `chain`, `hounds`), `units/art.js` çizimler,
`units/Army.js` birlikleri kurar, günceller ve üç katmanda çizer; kalkanlı askerler (`Soldier`) ve süvari (`Knight`) de ordudadır.
Kayıt anahtarları (`allyArcher`…) eskisiyle aynıdır.

**Çizim ve animasyon (v0.10):** Figürler eklem açısıyla değil ellerin gittiği noktayla pozlanır (`render/stick.js`
`drawPosed`/`reachArm`, iki kemikli IK); kıyafet `drawFigure`'ın `body` kancasıyla arka kol ile ön kol arasına çizilir.
`units/kit.js` ortak kostüm (tunik/cübbe, pelerin, zırh, miğfer türleri, kapüşon, şapka), `units/weapons.js` kılıç,
mızrak, cıvata, kalkan, bomba; `render/anim.js` zamanlama yardımcıları (`span`, `keys`, easing, `facing` aynalama).
Her birim eylem döngüsünü `since` (son saldırıdan beri geçen süre), hazırlığı `cd` (bekleme süresinin son anları) ve
duruşunu `alert` (rahat 0 → savaş 1) ile oynatır: okçular kahramanın `bowCycle` döngüsünü (bırak → sadaktan al → tak →
çek → tut) paylaşır; arbaletçi krankla gerer, cıvatayı yerleştirir; balistacı vinci çevirir, raftan cıvata taşır;
büyücüler asayı geri kaldırıp güç toplar ve hedefe savurur; topçu geri teper, tokmakla temizler, gülleyi taşır, fitili
deliğe indirir; bombacı çantadan bomba alır, fitili yakar, geri gerilip atar; muhafız/asker kılıcı kaldırıp iz bırakan
vuruş yapar; mızrakçı sırttan cirit çekip fırlatır; süvarinin atı eklemli dörtnala koşar; köpekler koşar, ısırır,
kulübe önünde oturur.

Düşmanlar aynı araçlarla `entities/enemyArt.js`'te çizilir (sola dönük, `facing` ile aynalanır); `Enemy.js` yalnızca
ölüm/ezilme dönüşümünü ve can çubuğunu yapar. Saldırı `atkAnim` üzerinden `u` (0 → 1) ile oynar: hazırlık → `STRIKE_AT`'te
darbe → toparlanma. Haydut satırla, akıncı bıçakla, Dev çift elli baltayla, Savaş Lordu savaş çekiciyle tepeden vurur (iz
bırakan yay); mızrakçı geri gerilip fırlatır ve sırtındaki demetten yenisini alır; kalkanlı kule kalkanla iter. Akbaba
ve kuzgun parmaklı kanatlarla çırpar, akbaba pençeleri açıp dalar; koçbaşını iki akıncı iter; mancınıkçı çıkrığı çevirip
kolu indirir. `painter` donma/yanma/vurulma rengini kostümlere de uygular.

Köylüler (`render/villageArt.js`) de aynı araçlarla pozlanır: aletler iki elle (IK) tutulur; oduncu ve taş ustası
baltayı/balyozu yavaşça kaldırıp hızla indirir, önlerindeki kütük/taş sarsılır, talaş ve kıvılcım saçılır; çiftçi tırpanı
yerden geçirir; değirmenci çuvalı eğilip kaldırır ve yığına atar; yük taşırken yük adımla sallanır, arabada eğilip bırakır
(`drop`), dönüşte alet omuzdadır. Binalarda: taş ocağı vinci blok kaldırıp boş kancayı indirir, maden arabası galeriden
dolu çıkıp boş girer, çamlar rüzgârda salınır, ahır önünde tavuklar eşelenir, pazarda satıcı para sayıp el sallar.

**Köy düzeni (v0.11):** Harita batıya `WORLD_MIN_X = -1240`'a kadar uzar (kamera oraya kayabilir; arka plan sırtları
eski tohum sırası bozulmadan uzatılır). Köy yolunun batı ucunda (`ROAD_X0`) bir **dağ** yükselir: kıvrımlı dağ yolu
(`MOUNTAIN_ROAD`) yamaçtaki düzlüğe (`CAMP_Y`) çıkar, **Kereste Ocağı** orada; oduncular dikili ağaçları yandan
keser, kütüğü dağ yolundan indirir. **Altın Madeni** artık bir kuyudur (`MINE`): yolun altında kesit görünümlü galeri;
madenciler sırayla **kazıcı** (galeride kazar, cevheri sepetle kuyuya taşır; kova çıkrıkla yukarı çıkar) ve
**taşıyıcı** (kuyu başındaki yığından küreyle el arabasına doldurur, ambara iter). Her işçi bir rota (`route`) boyunca
yürür; teslimat `oran × kendi tur süresi` öder, böylece gelir rota uzunluğundan ve rolden bağımsızdır. Boşalan arsada
yeni tesis **Demirhane** (`villageSmithy`/`villageSmiths`): ocak, körük, örs, silah rafı; demirciler kızgın demiri
döver, kılıç demetlerini taşır. Yeni üretim bağı **Maden → Demirhane** (%2,5/sv, en fazla %25).

**Menüler (v0.11):** Ana menü: büyük Devam Et, altında ikişerli ızgara (Ayarlar, İstatistikler, Nasıl Oynanır,
Kısayollar, Yenilikler, Yeni Oyun); duraklatmada anlık özet (altın/sn, hasar/sn, köy). Ayarlar bölümlü: Ses, Görüntü
(grafik kalitesi — Düşük'te hava olayı, sis, ışık huzmesi ve kenar kararması kapanır; arayüz boyutu %80–130; sayı biçimi
kısa/bilimsel — bilimsel milyondan itibaren), Oynanış, Kayıt (şimdi kaydet; kaydı base64 kod olarak dışa/içe aktar —
`exportSave`/`importSave`, içe aktarma doğrular ve sayfayı kaydı ezmeden yeniler). Yenilikler `config/changelog.js`'ten
gelir; açılmamış sürüm notları düğmede nokta ile işaretlenir (`state.seenVersion`). İstatistikler dört grupta. Geliştirme
panelinde **★ Önerilen**: kahraman/birlik sekmesinde altın başına en çok hasar, köyde en çok gelir artışı veren
geliştirme (saniyede bir, her kartın alımı simüle edilerek); 👁 düğmesi en yüksek seviyedeki ve kilitli kartları gizler;
İstatistik sekmesine Köy (tesis başı gelir) ve Bu Oturum (kazanılan altın, öldürülen, süre, altın/saat) eklendi.

**Kahraman penceresi (v0.11, `ui/HeroWindow.js`):** Envanter sıralanır (en yeni / güç / sınıf / yuva) ve yuvaya göre
süzülür; hücrelerde ▲ (kuşanılandan güçlü), YENİ (pencere en son kapatıldığından beri düşen — `item.fresh`, Envanter
sekmesinin rozeti de +N olur) ve 🔒 (kilitli — `item.locked`, tekli ve toplu satıştan korunur). Güç = otomatik kuşanma
puanı × 1000; seçili eşyada güç, sonraki seviyenin değeri ve kuşanılı parçayla ▲/▼ güç farkı görünür. Çift tıklama
kuşandırır. Karakter tarafında hasar/sn, ok sayısı, kritik çarpanı ve toplam donanım gücü; kahraman pencere açıkken nefes
alıp yay çeker.

**Manzara (`render/Background.js`):** Gökyüzü üç duraklı geçiş ve güneşin altındaki ufuk parlamasıyla çizilir; güneşin
yumuşak halesi, gecenin gölgeli ayı (patron gecesi kan ayı), haç parıltılı parlak yıldızlar ve ara sıra kayan yıldız
vardır. Bulutlar düz tabanlı, alttan gölgeli, güneş tarafı aydınlık kabarık kümelerdir. Dağlar: sisin içinde soluk en
uzak sıra, güneşten dönük yüzleri gölgeli karlı zirveler, sırtlarında kenar ışığı; katmanlar aşağı doğru sise karışır.
Tepeler arasında sis şeritleri süzülür, göl güneşi/ayı yansıtır; çam ve yuvarlak ağaçların güneş tarafı aydınlıktır.
Zemin: çim şeridi, iki tonlu otlar, toprak katmanları, kenar taşlı ve çakıllı yol, yakın çayırda lekeler ve çalılar;
en üstte hafif bir kenar kararması. Yeni süsler ayrı tohumdan (`rng2`) üretilir, eski yerleşim değişmez.

| Branş | Birlikler |
|---|---|
| Okçular | Okçu, Avcı (uçanlar x2,5), **Arbaletçi** (zırhın %60'ını deler, zırhlıları önce vurur), Balista Kulesi |
| Büyücüler | Büyücü, Buz Büyücüsü, **Fırtına Büyücüsü** (4–7 hedefe zincirleme şimşek, sekme başına -%15) |
| Kuşatma | Topçu, Bombacı |
| Piyade | Kalkanlı Asker, Kapı Muhafızı, Mızrakçı, **Savaş Köpekleri** (2–4 köpek koşup ısırır, saldırılamaz), Süvari |
| Destek | Şifacı (kale, sur ve askerler), Sancaktar (hasar/şifa/can aurası), **Davulcu** (saldırı hızı aurası, en fazla +%25) |

**Takımlar (v0.6):** Okçu takımı kalenin **arka surunda** durur, her 10 seviyede +1 okçu (en fazla 8). Kalkanlı Asker,
Kapı Muhafızı ve Mızrakçı her 25 seviyede +1 kişi alır (en fazla 4/3/3). Askerler ve muhafızlar mevzilerinden yakındaki
kara düşmanına yürüyüp saldırır, düşman kalmayınca geri döner. Arka kale (yüksek kule) kaldırıldı; yerine üstünde
okçuların ve topun durduğu bir arka sur (`Castle.js` `REAR`) var. Arbaletçi ön surda, Topçu arka surun ucunda.

**Rütbeler:** Acemi → Kıdemli (Sv 10) → Usta (25) → Seçkin (50) → Efsane (100); rütbe başına +%6 hasar/şifa, birliğin
üstünde altın çavuş işareti. **Branş ustalığı:** bir branşın bütün birlikleri kiralanınca o branşa +%10 hasar/şifa.
Birlikler sekmesi branş kutularıyla gruplanır (kiralanan sayısı, ustalık, branş hasarı). Başarım: Tam Ordu.
Simülasyon (v0.5): ilk oyun ≈ dalga 69–75, ilk Yeniden Doğuş sonrası ≈ dalga 98.

## Düşmanlar
Haydut, Akıncı (hızlı), Mızrakçı (menzilli), Kalkanlı (zırhlı), Dev (tank), Akbaba (uçan; kalkanlıları aşarak kaleye dalar), Savaş Lordu (patron).
Can ×1.15^dalga·(1+0.05·dalga), hasar ×1.115^dalga, altın ×1.08^dalga ölçeklenir.

Yeni türler (v0.3):
| Düşman | Dalga | Özellik |
|---|---|---|
| Kuzgun | 12+ | Uçan, üçlü sürü (her üye bir dalga yuvası), yüksekten ve çok hızlı |
| Koçbaşı | 16+ | Kuşatma: askerleri ezip geçer, kapıyı döver; %35 zırh, geri savrulmaz |
| Mancınık | 25+ | Kuşatma: ~560 birim uzaktan surlara kaya fırlatır; geri savrulmaz |

Bir tür ilk kez sahaya çıkınca "Yeni Düşman" afişiyle tanıtılır (`state.seenEnemies`; eski kayıtlarda eski türler görülmüş sayılır).

## Yeni düşmanlar, bölgeler ve patronlar (v0.12, `config/enemies.js`)
**Genel düşmanlar:** Lağımcı (Dalga 14, değince patlar), Şaman (18, çevresini iyileştirir), Suikastçı (22, fiziksel vuruşlardan %30
kaçar), Demir Şövalye (32, %60 zırh).
**Bölge düşmanları** (`regions`): Buz Cadısı (Karlı Geçit), Kum Akrebi (Kızıl Bozkır, kum altındayken vurulamaz), Lav Golemi (Kül
Diyarı, ölünce 2 Kor), Zehir Tükürücü (Zehirli Bataklık), Kristal Dev (Kristal Vadi, ölünce 3 parça), Hayalet (Boşluk Sınırı).
**Yeni bölgeler:** Zehirli Bataklık (125), Kristal Vadi (150), Boşluk Sınırı (175).
**Patronlar** bölgeye göre gelir: Savaş Lordu, Dağ Trolü (iyileşir), Buz Devi (sarsıntı), Çöl Firavunu (büyü, akrep çağırır), Kül Ejderi
(uçar, ateş kusar), Ölü Çağıran (ölü çağırır), Kristal Kral (ağır zırh, sarsıntı), Boşluk Lordu (hepsi). Her patron %30 canın altında öfkelenir.

## Başarımlar ve Şan
Başarımlar kalıcıdır (`config/achievements.js`) ve Elmas ödülüne göre madalya alır: Bronz 10, Gümüş 25, Altın 50 Şan puanı.
Şan puanı başına tüm hasar ve altın +%0,04. Rütbeler (`GLORY_RANKS`) kalıcı ödül verir: Er +%3 atış hızı, Onbaşı +%2 kritik,
Çavuş +10 çanta yuvası, Yüzbaşı +%10 kale canı, Binbaşı +%15 köy geliri, Albay +%5 atış hızı, Mareşal +%15 altın ve +%3 kritik.
Dört gizli başarım kazanılana dek ??? görünür. Yeni gruplar: Kale ve Zanaat, Gizli. Açılınca madalya renginde konfeti, yeni
rütbede tüm sahaya konfeti ve üstte duyuru çıkar. Sekme üstünde rütbe çubuğu, rütbe yolu ve en yakın üç hedef görünür.

## Eşya Setleri
| Set | Parçalar | 2 parça | 4 parça | 6 (5) parça |
|---|---|---|---|---|
| Avcının Yolu | Avcı Yayı, Gözcü Miğferi, Gümüş Küpeler, Avcı Eldivenleri, Avcı Kemeri, Yolcu Çizmeleri | +%8 atış hızı | +%5 kritik | +1 ok |
| Kale Muhafızı | Kale Muhafızı Yayı, Kral Muhafızının Miğferi, Koruyucu Gerdanlık, Hafif Zincir Zırh, Muhafız Kemeri, Demir Uçlu Çizmeler | +%10 hasar | +%20 kale canı | -%10 kaleye hasar |
| Akıncı Ruhu | Yolcu Yayı, Şahin Miğferi, Akıncı Halkaları, Akıncı Pelerini, Şahin Pençeleri, Rüzgâr Adımları | +%4 kritik | +x0,5 kritik hasarı | +1 delme |
| Kraliyet Hazinesi | Aytaşı Küpeler, Kehribar Kolye, Demir Bileklikler, Kraliyet Kemeri, Zafer Nişanı | +%10 altın | +%20 köy geliri | (5) +%20 altın |

Setler `HERO_ITEM_SETS` (HeroItems.js) içinde tanımlıdır; nadirlik fark etmez. Envanterde set parçası ⬢ ile işaretlenir.

## Oyun Hissi (v0.3)
Vuruşta sıkışma animasyonu, ganimet düştüğü yerde nadirlik renginde ışık sütunu (nadir+ için ses), destansı/efsanevi
eşya bildirimi, öldürme serisi çağrıları (10/25/50/100/200), patron ölünce kısa ağır çekim ve beyaz parlama
(azaltılmış harekette parlama yok), kusursuz dalga yazısı, kuşatma makinesi yıkılınca tahta kıymıkları.

## Denge
`node scripts/balance-sim.mjs [saat] [prestijSayısı]` gerçek simülasyonu en ucuz geliştirmeyi alan bir botla
çalıştırır ve dalga kilometre taşlarını yazar. Hedef eğri (mevcut değerler): dalga 10 ≈ 3 dk, dalga 20 ≈ 12 dk,
kale ilk kez ≈ dalga 25'te düşer, ilk oyun ≈ dalga 60'ta tıkanır (~80 dk); ilk Yeniden Doğuş sonrası ≈ dalga 90.

**Zorluk ayarı (v0.13):** Dalga 12'den sonra düşman canı dalga başına +%3,5, hasarı +%1,5 ek büyür; patron canı `bossHpMult` ile 1 + %2,5 × dalga
katına çıkar. Ruh geliştirmeleri pahalandı, Ruh Taşı kazancı 1/4'e indi (eski 1/3), Kadim Hafıza %2/sv. 1x'ten başlanır; 1.5x dalga 10'da, 2x dalga 20'de açılır. 3x yalnızca reklamla, her reklam 15 dakika verir. Simülasyon (1x, bot eşya kullanmaz): ilk yolculuk dalga 39, altıncı yolculuk dalga 73 civarında durur.

## Atmosfer
- Siluet çöp adamlar, paralaks dağlar, bulutlar, kuşlar
- Dalgaya göre gündüz → gün batımı → gece döngüsü, patronda kızıl ay
- Meşaleler, kıvılcımlar, patlamalar, yere saplanan oklar, ekran sarsıntısı
- WebAudio ile sentezlenmiş ses efektleri (dosya gerekmez)
- Geniş ekranlarda görüş kalenin arkasına uzar (en fazla 2240 birim): ana kule, surlar ve köy
  (yel değirmeni, kilise, bacası tüten evler) görünür; savaş alanı her ekranda aynı kalır
- Uzakta düşman ordugâhı (çadırlar, kamp ateşi), karlı dağlar, harabe kule, yol, barikat, savaş artıkları

## Harita Bölgeleri (v0.7, `render/biomes.js`, `render/Weather.js`)
Her 25 dalgada harita değişir; yeni bölgeye girerken dalga afişinde "Yeni bölge" yazar, renkler 3 sn'de geçer.
| Bölge | Dalga | Ağaçlar | Vadi | Zemin | Hava | Özel |
|---|---|---|---|---|---|---|
| Yeşil Vadi | 1–24 | çam, yuvarlak | göl | çayır, çiçek | 5'te bir yağmur | — |
| Sonbahar Ormanı | 25–49 | turuncu-kızıl taç | göl | dökülmüş yapraklar | yaprak, ara sıra yağmur | — |
| Karlı Geçit | 50–74 | karlı çam | donmuş göl | kar örtüsü | kar | gece kuzey ışıkları |
| Kızıl Bozkır | 75–99 | kaktüs, kuru ağaç | — | kum dalgaları | 3'te bir toz | mesalar |
| Kül Diyarı | 100+ | kuru ağaç | lav gölü | kül, parlayan lav çatlakları | kül ve kıvılcım | dumanlı yanardağ |
Bölge renkleri gün/gece paletine karışır (kale ve köy de etkilenir). Savaş alanının ortası (x 150–760) kaya ve çalıdan boş tutulur.

## Ana Menü (v0.8, `ui/MainMenu.js`)
Açılışta krallık manzaralı ana menü gelir (oyun duraklatılmış): **Devam Et** (kayıt özeti: dalga, bölge, en iyi dalga,
Ruh/Elmas, oynama süresi), **Yeni Oyun** (kayıt varsa onay ister, siler ve doğrudan yeni oyunu başlatır), **Ayarlar**
(ses, ses seviyesi, ekran sarsıntısı, hasar sayıları, otomatik ilerle, otomatik Ok Yağmuru), **Nasıl Oynanır**,
**İstatistikler**, **Çıkış** (kaydeder, sekmeyi kapatmayı dener, olmazsa veda ekranı). Oyun içinde **Esc** ya da ⚙
aynı menüyü duraklatma menüsü olarak açar. Çevrimdışı kazanç ve ilk eğitim, menüden oyuna girince gösterilir.

## Yayın ve para kazanma (`platform/platform.js`, `config/rewards.js`, `store/YAYIN-REHBERI.md`)
`boot.js` önce SDK'ya bağlanır, dili seçer, sonra oyunu yükler. SDK yoksa oyun yerel kayıtla reklamsız çalışır.
Metinler `tr()` ile sarılıdır; Türkçe anahtar, İngilizce `i18n/en.js` içinde. Yeni metin eklenince oraya da yazılmalı.
**Hızlandırma:** 30 dk x2 altın; reklam ya da 2 Elmas. **VIP Elçi:** kale penceresinde belirir; reklamla 2, altınla 1 Elmas.
İkisi de oyunu duraklatan pencerededir, çünkü reklam düğmesi aktif oyun ekranında olamaz ve her ödülün reklamsız seçeneği olmalıdır.
`ADS_LIVE` Full Launch'a kadar kapalı kalır. **Coach:** ilk dakikalarda adım adım ipucu; yeni oyuncu doğrudan savaşa girer.

## Nasıl Oynanır (`ui/HowToPlay.js`)
On konulu rehber: Başlarken, Savaş, Geliştirme, Eşyalar, Yoldaşlar, Düşmanlar, Yetenek ve Elmas, Yeniden Doğuş, Başarımlar, Kısayollar.
Başlarken sayfası oyuncunun kaydına bakıp "Sıradaki adımın" önerir. Bağlantılar ilgili sekmeye götürür. Ana menüden ve alt menüdeki ❔ düğmesinden açılır.

## Teknik Yapı
- **Vite** (geliştirme sunucusu + build), saf ES modülleri, Canvas 2D (1280×720 mantıksal çözünürlük)
- Sabit zaman adımı (1/120 sn) — 1x/2x/3x hız
- Kayıt: `localStorage`, 10 sn'de bir otomatik

```
src/
  main.js                 giriş noktası
  core/      Game.js (döngü, dünya), State.js (kayıt), Audio.js, constants.js
  config/    upgrades.js (tüm geliştirmeler + formüller), enemies.js
  systems/   Stats.js (türetilmiş istatistikler), WaveManager.js, Economy.js
  entities/  Hero.js, Castle.js, Enemy.js, Ally.js, Soldier.js, Projectile.js, Effects.js
  render/    stick.js (çöp adam iskeleti), Background.js
  ui/        HUD.js, ShopPanel.js, Modal.js
  utils/     math.js, format.js
  styles/    main.css
```

## Ek Geliştirmeler (v0.2)
| Grup | Geliştirme | Etki |
|---|---|---|
| Kahraman | Delici Oklar | Oklar +1/+2/+3 düşmanı deler |
| Kahraman | Ateşli Oklar | İsabet 3 sn yakar (ok hasarının %7–45'i/sn, zırh yok sayar) |
| Kahraman | Fırtına Çağrısı | Ok Yağmuru bekleme süresi ×0.94/sv |
| Kale | Dikenli Surlar | Yakın dövüşte duvara vuran, maks. canının %1.5/sv'sini kaybeder |
| Kale | Kaynar Yağ | Duvar dibine düzenli alan hasarı (zırh yok sayar) |
| Kale | Altın Kasası | 10 sn'de bir kasadaki altına %0.4/sv faiz (≤30 sn kazanç) |
| Birlik | Buz Büyücüsü | Alan hasarı + %30–60 yavaşlatma (patron yarı) |
| Birlik | Süvari | Kapıdan hücum: yolundaki her düşmana vurur, geri savurur |
| Köy | Un Değirmeni + Değirmenci | 4. tesis (yel değirmeni), 450/sn işçi başı |
| Köy | Taş Ocağı + Taş Ustası | 5. tesis; taş ustaları kale onarımını destekler |
| Köy | Pazar Yeri | Tüm köy geliri +%8/sv |
| Ruh | Ruh Hasadı / Hızlı Başlangıç / Kutsal Oklar / Köy Bereketi | +%10 Ruh Taşı · Dalga 1+2·sv'den başla · +%2 kritik · +%10 köy geliri |

Simülasyon (bot): ilk oyun ≈ dalga 70, ilk Yeniden Doğuş sonrası ≈ dalga 98.

## Yetenek Sistemi — 💠 Elmas
Elmas; patron öldürünce (1 + dalga/30, ilk kez yenilen patronda +1), aşama ödüllerinde (dalga 25/50/75/100/150/200)
ve her Yeniden Doğuş'ta (+1) kazanılır. Elmas, aktif yetenekler ve yetenek ağacı **Yeniden Doğuş'ta sıfırlanmaz**.
Aşama kilitleri "en iyi dalga"ya (`bestWave`) bakar.

| Aktif yetenek | Kısayol | Aşama | Etki |
|---|---|---|---|
| Ok Yağmuru | Z / Boşluk | — | (Kahraman sekmesinden) |
| Savaş Narası | X | 15 | +%50–90 hasar, +%20–40 saldırı hızı |
| Meteor | C | 30 | En kalabalık gruba ok hasarı ×16–32 alan hasarı |
| İlahi Kalkan | V | 35 | Kale hasarsız + anında onarım |
| Zaman Dondurma (özel) | B | 45 | Tüm düşmanlar donar (patron yarı) |
| Midas Dokunuşu (özel) | N | 60 | Düşman altını ×3–5 |

Her yetenekte otomatik kullanım düğmesi (A) vardır; varsayılan açıktır.
Yetenek ağacı: Okçuluk / Savunma / Ticaret × 4 aşama (dalga 10/25/50/80); her düğüm üstündekini gerektirir.
Simülasyon (bot, Elmas da harcar): ilk oyun ≈ dalga 76, ilk Yeniden Doğuş sonrası ≈ dalga 114.

## Köy — Pasif Gelir
Kalenin arkasındaki köyde beş tesis kurulur; her tesise işçi kiralanır (en fazla 8). İşçiler sahada çalışır,
yükünü kale önündeki ambar arabasına taşır; her teslimat `işçi başı gelir × tur süresi` kadar altın getirir.

| Tesis | İşçi | İlk maliyet | İşçi başı gelir (Sv 1) |
|---|---|---|---|
| Tarla | Çiftçi | 250 | 1/sn |
| Kereste Ocağı | Oduncu | 2.500 | 8/sn |
| Altın Madeni | Madenci | 20.000 | 60/sn |
| Taş Ocağı | Taş Ustası | 80.000 | 180/sn |
| Un Değirmeni | Değirmenci | 150.000 | 450/sn |

Tesis seviyesi işçi başı geliri ×1.11/sv artırır; Ruh "Altın Ruhu" çarpanı uygulanır. Üretim zincirleri: her tarla seviyesi değirmen gelirine +%3 (en çok +%30), her değirmen seviyesi tarla gelirine +%2 (en çok +%20), her kereste seviyesi maden gelirine +%2,5 (en çok +%25) verir. Her taş ustası kale yenilenmesine +0,25 can/sn ekler; taş ocağı seviyesi bu katkıyı seviye başına %5, en çok %50 artırır. Pazar Yeri tüm köy gelirini artırır. Yeniden Doğuş'ta köy seviyeleri sıfırlanır.
Köy geliri ortalama altın/sn'ye girdiği için çevrimdışı kazanca da dahildir. Köye tıklamak Köy sekmesini açar (R).

**Yapı:** Her tesis tek yerde tanımlanır: `config/village.js` (ad, simge, arsa, çalışma noktası, ekonomi, üretim bağları).
`upgrades.js`, `Stats.js`, Köy sekmesi ve oyun alanı bu tanımı okur. `entities/Village.js` yalnızca simülasyondur
(işçiler, ambar, ödeme); çizim `render/villageArt.js` içindedir.

**Yerleşim:** Tesisler kaleden sola tek bir köy yolu üzerinde eşit arsalarda dizilir: Tarla, Değirmen, Kereste,
Maden, Taş Ocağı; yolun kale ucunda ambar arabası ve Pazar Yeri durur. Bütün işçiler aynı yolda yürür, madenciler
çalışırken galerinin içindedir. Arkadaki evler ve kilise çayır sırtında küçük ve puslu bir uzak köydür.

**Ortak görsel dil:** Tek renk paleti (gün/gece tonlu), her arsanın sağ önünde ad + seviye rozetli tabela ve gece
yanan fener. Seviye 5'te ek dekor, 10'da flama, 25'te altın çerçeveli tabela (`VILLAGE_TIERS`). Kurulmamış arsa
kazık ve iple çevrilidir; binanın soluk taslağı görünür.

**Köy sekmesi:** Her tesis için bir kutu (bina + işçi kartı, başlıkta seviye, gelir ve üretim bağı); en sonda Pazar Yeri.

## Prestij — Ruh Taşları
Dalga 20'ye ulaşınca **Yeniden Doğuş** açılır: altın, dalga ve altınla alınan tüm geliştirmeler sıfırlanır,
karşılığında `floor((enYüksekDalga − 14)^1.3 / 4)` Ruh Taşı (💎) kazanılır (Dalga 20 → 2, Dalga 40 → 17, Dalga 60 → 36).
Ruh Taşları ve Ruh geliştirmeleri kalıcıdır:

| Geliştirme | Etki |
|---|---|
| Kadim Güç | Tüm hasar +%15/sv |
| Altın Ruhu | Tüm altın +%15/sv |
| Yıkılmaz Surlar | Kale canı, yenilenme, asker canı ve şifa +%20/sv |
| Savaş Ritmi | Tüm saldırı hızları +%4/sv (maks 25) |
| Başlangıç Altını | Yeniden doğunca 50×5^sv altınla başla (maks 10) |
| Zaman Bükücü | Çevrimdışı kazanç +%10 ve +2 saat/sv (maks 5) |

Yeni geliştirmeler: Lord Katili (patronlara +%10/sv), Ganimet Kokusu (eşya şansı +%8/sv), Elmas Damarı (doğuş başı +1 Elmas/sv),
Kadim Hafıza (altın geliştirmelerinin %2/sv'si yeni yolculuğa geçer, maks %20).

**Yeminler (`config/oaths.js`):** Bir sonraki yolculuk için seçilir, Yeniden Doğuş'la başlar ve o yolculuğun Ruh Taşı kazancını artırır:
Demir (düşman canı +%40, x1,3), Kan (kale canı -%40, x1,3), Yoksulluk (altın -%35, x1,35; 2 doğuş gerekir), Yıkım (üçü birden, x2,2; 5 doğuş
gerekir). Çarpan `soul.harvest` içindedir. Son 5 yolculuk `prestigeLog` içinde tutulur; sekme son yolculuğu ve en verimli 💎/saat değerini gösterir.

## Yoldaşlar (v0.12, `config/pets.js`, `entities/Pet.js`, `render/petArt.js`)
Öz ile sahiplenilir ve büyütülür (`petLevels`, Yeniden Doğuş'ta kalır, maks Sv 20). Aynı anda biri savaşır (`activePet`):
Kurt Yavrusu (Dalga 5, ısırık, +atış hızı), Altın Tilki (10, define, +altın), Av Şahini (15, uçanlara dalış, +kritik), Kaya Kaplumbağası (20,
kale onarır, -kale hasarı), Gece Baykuşu (30, ötüşle yavaşlatır, +eşya şansı), Ejder Yavrusu (40, yakan alev topu, +kahraman hasarı).

## Kahraman Eşyaları
Düşme şansı kill başına: sıradan %2, kalkanlı %3, dev %5; patron %60 (`DROP_CHANCE`, HeroItems.js). 9 yuva, 27 şablon, 5 nadirlik.
Eşyalar Yeniden Doğuş'ta **korunur**: kuşanılan eşya ve envanter, altınla alınan geliştirmelerden ayrıdır.

**Envanter sınırı:** Başlangıç 30 yuva. "Envanter Genişletme" Ruh geliştirmesi her seferinde +5 yuva açar
(maks 12 kademe → 90 yuva; toplam 279 Ruh). Ruh geliştirmesi `soulLevels`'ta tutulur, Yeniden Doğuş'ta kalır.
Envanter doluyken düşen eşya otomatik satılır (değeri altın olarak verilir, "Envanter dolu" yazısı çıkar).
Eşyalar tek tek veya toplu satılarak yer açılır.

**Kahraman görünümü** (`render/archer.js`, oyun alanı ve envanter aynı çizimi kullanır): ahşap yay ve deri kabza,
gölgeli pelerin, kapüşon içinde göz parıltısı, sırtta çapraz sadak (tüyleri pelerin renginde), zırhta omuzluk ve gölge.
Nadir ve üstü eşya takılıyken kahramanın arkasında en yüksek nadirliğin renginde hafif bir parıltı olur.
Sadak ve parıltı yalnızca kahramanda (`hero: true`); ok/yay/kapüşon iyileştirmeleri okçu birliklerine de yansır.

**Alt menü filtreleri (v0.11, `ui/ShopFilters.js`):** Her sekmede durum filtresi (Satın alınan, Alınabilir, Alınmamış, Kilitli,
Tamamlanan, Favoriler; sayılar canlı), tür filtresi, arama ve sıralama vardır. Seçimler sekme başına `settings.shopView`,
favoriler `settings.favorites` içinde saklanır. Tümünü Al yalnızca listelenen kartlara harcar. Eski "Sadeleştir" düğmesi kalktı.

**Envanter ekranı (v0.11, `ui/HeroWindow.js`):** Dört sekme: **Çanta** (karakter, kaydırılan eşya ızgarası, seçili eşya ve
stat stat karşılaştırma), **Demirci** (Birleştir, Toplu Satış, Otomatik Satış), **Setler** (ilerleme, eldeki parçaları kuşan),
**Koleksiyon** (bulunan eşya türleri). Üç takım kaydedilebilir (`heroLoadouts`).

**Ek özellikler:** Nadir 1, Destansı 2, Efsanevi 3 rastgele ek stat taşır (`item.affixes`; ana statla aynı olamaz, seviyeyle
ölçeklenir). Yeni statlar: kritik hasarı, kale canı, köy geliri. Eski eşyalarda ek stat yoktur.
**Öz:** Satılan her eşya altının yanında Öz verir (`heroEssence`). 3 aynı sınıf eşya + Öz bir üst sınıftan rastgele eşya yapar;
Yeniden Döv ek statları değiştirir. **Koleksiyon:** Her yeni eşya türü kalıcı +%0,5 kahraman hasarı (`heroCodex`).
**Otomatik Satış:** Seçilen sınıf ve altı çantaya girmeden satılır; set parçaları ve ilk kez bulunanlar korunur.
Yeni set: Fırtına Çağıran (6 parça).

**Kayıt güvenliği:** `loadState` başarılı her yüklemede `cop-kale-save-v1-yedek` kopyası tutar; yükleme hata verirse bozuk
veri `-yedek-hata` anahtarına alınır.

## Tasarım Notları
- Kayıt: 10 sn'de bir, sayfa kapanırken ve sekme gizlenirken yazılır. Eşya düşüşünde ayrıca yazılmaz.
  Oyun açıkken `localStorage` dışarıdan düzenlenirse sayfa kapanırken bellekteki eski durum üzerine yazılır.
- Yanma (Ateşli Oklar, Bomba) yalnızca çalışan bir yanma varken üst üste biner; bittiğinde hız sıfırlanır.

Simülasyon (v0.3, başarımlar ve kuşatma dahil): dalga 20 ≈ 12 dk, dalga 50 ≈ 45 dk, ilk oyun ≈ dalga 79–85,
ilk Yeniden Doğuş sonrası ≈ dalga 116.

## Sonraki Adımlar (fikirler)
- Otomatik kuşanmanın set bonuslarını hesaba katması
- Düşman ansiklopedisi (görülen türler)
