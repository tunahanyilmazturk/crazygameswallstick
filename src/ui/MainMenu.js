import { h } from './dom.js';
import { fmt, fmtTime, setNumberStyle } from '../utils/format.js';
import { saveState, exportSave } from '../core/State.js';
import { biomeForWave } from '../render/biomes.js';
import { ACHIEVEMENTS, achievementCount } from '../config/achievements.js';
import { CHANGELOG, VERSION } from '../config/changelog.js';
import { estimateDps } from '../systems/Stats.js';
import { codexProgress, getHeroSetProgress } from '../systems/HeroItems.js';
import { oathById } from '../config/oaths.js';
import { chooseLanguage, language } from '../i18n/i18n.js';
import { tr } from '../i18n/i18n.js';

/** "5 dk önce" style age of a timestamp. */
function ago(ms) {
  const sec = Math.max(0, (Date.now() - ms) / 1000);
  if (sec < 60) return tr('az önce');
  if (sec < 3600) return tr('{0} dk önce', Math.floor(sec / 60));
  if (sec < 86400) return tr('{0} sa önce', Math.floor(sec / 3600));
  return tr('{0} gün önce', Math.floor(sec / 86400));
}

const SHORTCUTS = [
  [tr('Savaş'), [
    [tr('Tıkla / basılı tut'), tr('Kahraman tıkladığın yere ok atar; basılı tutunca seri atış')],
    [tr('Boşluk · Z'), tr('Ok Yağmuru')],
    ['X C V B N', tr('Diğer aktif yetenekler')],
    ['1 · 2 · 3', tr('Oyun hızı')],
  ]],
  [tr('Menüler'), [
    ['Q W E R T Y U I', tr('Kahraman · Kale · Birlikler · Köy · Ruh · Yetenekler · İstatistik · Başarımlar')],
    ['A', tr('Sekmede alınabilen her şeyi al')],
    ['H', tr('Geliştirme menüsünü küçült / aç')],
    ['Esc', tr('Ana menü (duraklatır)')],
  ]],
  [tr('Kamera'), [
    ['← →', tr('Savaş alanı ile köy arasında kaydır')],
    [tr('Sürükle'), tr('Fareyle ya da parmakla kaydır')],
  ]],
];

/*
 * Main menu over the whole screen. In 'title' mode (on launch) it shows the kingdom art and
 * offers Devam Et / Yeni Oyun; in 'pause' mode (Esc or ⚙ in game) the frozen battle shows
 * through with a quick summary of the run. The game is paused while it is open. Views: main,
 * settings, save, stats, keys, news, confirm-new. Actions are buttons with
 * data-action (or data-choice for a setting's option), handled in one place.
 */
export class MainMenu {
  /**
   * hooks: { hasSave(), onPlay(), onNewGame(), onHelp(), onImport(code) → error|null,
   *          onSettingsChanged(key) }
   * onPlay closes the menu and resumes (or starts) play; onNewGame wipes the save.
   */
  constructor(root, game, hooks) {
    this.game = game;
    this.hooks = hooks;
    this.mode = 'title';
    this.view = 'main';
    this.panel = h('div.mm-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mm-title' });
    this.el = h('div.main-menu.hidden',
      h('div.mm-art'),
      h('div.mm-shade'),
      h('div.mm-content',
        h('div.mm-brand', h('h1', { id: 'mm-title' }, tr('Surların'), h('br'), tr('Efendisi')), h('p', tr('Son Okçu Ayakta'))),
        this.panel,
      ),
      h('div.mm-foot', h('span', VERSION), h('span.mm-foot-hint', tr('Esc: menü · 1–3 hız · Q–I sekmeler'))),
    );
    root.append(this.el);
    this.panel.addEventListener('click', (e) => this.onClick(e));
    this.panel.addEventListener('input', (e) => this.onInput(e));
    setNumberStyle(game.state.settings.numberStyle);

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.repeat) return;
      // Dialogs (modals) close on their own Esc first
      if (document.querySelector('#modal-root .modal-overlay')) return;
      if (this.isOpen) {
        if (this.view !== 'main') this.show('main');
        else if (this.mode === 'pause') this.close();
      } else {
        this.open('pause');
      }
      e.preventDefault();
    });
  }

  get isOpen() {
    return !this.el.classList.contains('hidden');
  }

  /** mode: 'title' on launch, 'pause' from inside the game. */
  open(mode = 'pause') {
    this.mode = mode;
    this.game.paused = true;
    this.el.classList.toggle('pause', mode === 'pause');
    this.el.classList.remove('hidden');
    this.show('main');
    if (mode === 'pause') saveState(this.game.state);
  }

  close() {
    this.el.classList.add('hidden');
    this.game.paused = false;
  }

  show(view, focus = true) {
    this.view = view;
    this.panel.innerHTML = this[`view_${view.replace('-', '_')}`]();
    this.panel.dataset.view = view;
    if (focus) this.panel.querySelector('button:not(:disabled), input')?.focus();
  }

  // ---- views ---------------------------------------------------------------------

  view_main() {
    const s = this.game.state;
    const saved = this.hooks.hasSave();
    const resume = this.mode === 'pause';
    const summary = saved || resume
      ? tr('<div class="mm-save">\n          <div><b>Dalga {0}</b><span class="mm-region"> · {1}</span></div>\n          <small>En iyi dalga {2} · 💎 {3} · 💠 {4} · {5} oynandı{6}</small>\n        </div>', s.wave, biomeForWave(s.wave).name, s.bestWave, fmt(s.souls), fmt(s.gems), fmtTime(s.playTime), resume ? '' : ` · ${ago(s.lastSaved)}`)
      : tr('<div class="mm-save"><b>Yeni bir kale seni bekliyor</b><small>Surları kur, okçularını diz, dalgalara karşı dayan.</small></div>');
    // A glance at the run while paused
    let chips = '';
    if (resume) {
      const st = this.game.stats;
      chips = tr('<div class="mm-chips">\n        <span title="Altın / sn">💰 {0}/sn</span>\n        <span title="Tahmini toplam hasar / sn">⚔️ {1}/sn</span>\n        <span title="Köy geliri">🏘️ {2}/sn</span>\n      </div>', fmt(s.goldPerSec), fmt(estimateDps(st).total), fmt(st.village.total));
    }
    const news = s.seenVersion !== VERSION ? '<i class="mm-dot" aria-label="yeni"></i>' : '';
    return tr('{0}{1}\n      <nav class="mm-buttons">\n        {2}\n        <div class="mm-grid">\n          <button class="mm-btn small" data-action="settings">⚙ Ayarlar</button>\n          {3}\n          <button class="mm-btn small" data-action="help">❔ Nasıl Oynanır</button>\n          <button class="mm-btn small" data-action="keys">⌨ Kısayollar</button>\n          <button class="mm-btn small" data-action="news">🆕 Yenilikler{4}</button>\n          {5}\n        </div>\n      </nav>', summary, chips, resume || saved
          ? `<button class="mm-btn primary" data-action="play">${resume ? tr('▶ Oyuna Dön') : tr('▶ Devam Et')}</button>`
          : tr('<button class="mm-btn primary" data-action="new">▶ Yeni Oyun</button>'), saved || resume ? tr('<button class="mm-btn small" data-action="stats">📊 İstatistikler</button>') : '', news, resume || saved ? tr('<button class="mm-btn small" data-action="confirm-new">✦ Yeni Oyun</button>') : '');
  }

  view_settings() {
    const st = { ...this.game.state.settings, language: language() };
    const toggle = (key, label, hint) => `<label class="mm-toggle"><span><b>${label}</b><small>${hint}</small></span>
      <input type="checkbox" data-setting="${key}" ${st[key] !== false ? 'checked' : ''}><i></i></label>`;
    const range = (key, label, value, min, max, step, shown) => `<label class="mm-range"><span><b>${label}</b><small data-label="${key}">${shown}</small></span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-setting="${key}"></label>`;
    const choice = (key, label, hint, options) => `<div class="mm-choice"><span><b>${label}</b><small>${hint}</small></span>
      <div class="mm-seg" role="group" aria-label="${label}">${options.map(([v, text]) =>
        `<button data-choice="${key}:${v}" aria-pressed="${st[key] === v}" class="${st[key] === v ? 'on' : ''}">${text}</button>`).join('')}</div></div>`;
    const volume = Math.round((st.volume ?? 0.8) * 100);
    const ui = Math.round((st.uiScale ?? 1) * 100);
    return tr('<h2 class="mm-title">Ayarlar</h2>\n      <div class="mm-settings">\n        <div class="mm-section">🌐 Dil / Language</div>\n        {0}\n        <div class="mm-section">🔊 Ses</div>\n        {1}\n        {2}\n        <div class="mm-section">🖥️ Görüntü</div>\n        {3}\n        {4}\n        {5}\n        {6}\n        {7}\n        <div class="mm-section">🎮 Oynanış</div>\n        {8}\n        {9}\n        <div class="mm-section">💾 Kayıt</div>\n        <div class="mm-row-btns">\n          <button class="mm-btn small" data-action="save-now">💾 Şimdi kaydet</button>\n          <button class="mm-btn small" data-action="save">📤 Dışa / içe aktar</button>\n        </div>\n        <small class="mm-note" data-note>Oyun otomatik kaydedilir · son kayıt {10}</small>\n      </div>\n      <nav class="mm-buttons"><button class="mm-btn" data-action="back">‹ Geri</button></nav>', choice('language', 'Dil / Language', tr('Değişince oyun yeniden yüklenir'), [['tr', 'Türkçe'], ['en', 'English']]), toggle('sound', tr('Ses'), tr('Ok, patlama ve arayüz sesleri')), range('volume', tr('Ses seviyesi'), volume, 0, 100, 5, `%${volume}`), choice('quality', tr('Grafik kalitesi'), tr('Düşük: hava olayı, sis ve ışık efektleri kapanır'), [['high', tr('Yüksek')], ['low', tr('Düşük')]]), range('uiScale', tr('Arayüz boyutu'), ui, 80, 130, 5, `%${ui}`), choice('numberStyle', tr('Sayı biçimi'), tr('Büyük sayıların yazılışı'), [['short', '1,25Mr'], ['sci', '1.25e9']]), toggle('shake', tr('Ekran sarsıntısı'), tr('Patlamalarda ve patron adımlarında')), toggle('damageNumbers', tr('Hasar sayıları'), tr('Düşmanların üstünde uçuşan hasar yazıları')), toggle('autoAdvance', tr('Otomatik ilerle'), tr('Kapalıyken aynı dalga tekrar oynanır (altın kasmak için)')), toggle('autoSkill', tr('Otomatik Ok Yağmuru'), tr('Kalabalık ya da patron gelince kendiliğinden kullanılır')), ago(this.game.state.lastSaved));
  }

  view_save() {
    const code = exportSave(this.game.state);
    return tr('<h2 class="mm-title">Kayıt Aktarımı</h2>\n      <p class="mm-text small">Kodu kopyalayıp sakla; başka bir tarayıcıda ya da cihazda içe aktararak kaldığın yerden devam et.</p>\n      <label class="mm-field"><b>Bu kaydın kodu</b>\n        <textarea readonly rows="3" data-export>{0}</textarea></label>\n      <div class="mm-row-btns"><button class="mm-btn small" data-action="copy">📋 Kopyala</button></div>\n      <label class="mm-field"><b>Kod ile içe aktar</b>\n        <textarea rows="3" data-import placeholder="Kodu buraya yapıştır…"></textarea></label>\n      <small class="mm-note bad" data-error></small>\n      <div class="mm-row-btns"><button class="mm-btn small danger" data-action="import">📥 İçe aktar (mevcut kaydın yerine geçer)</button></div>\n      <nav class="mm-buttons"><button class="mm-btn" data-action="settings">‹ Ayarlar</button></nav>', code);
  }

  view_stats() {
    const s = this.game.state;
    const c = s.counters ?? {};
    const st = this.game.stats;
    const row = (k, v) => `<div class="mm-stat"><span>${k}</span><b>${v}</b></div>`;
    const bar = (k, n, total) => `<div class="mm-stat mm-bar-row"><span>${k}</span><b>${fmt(n)} / ${fmt(total)}</b><i style="--p:${total ? Math.min(100, (n / total) * 100) : 0}%"></i></div>`;
    const group = (title, rows) => `<div class="mm-section">${title}</div><div class="mm-stats">${rows.join('')}</div>`;
    const tile = (icon, k, v) => `<div class="mm-tile"><small>${icon} ${k}</small><b>${v}</b></div>`;
    const codex = codexProgress(s);
    const sets = getHeroSetProgress(s);
    const doneSets = sets.filter((set) => set.count >= set.pieces.length).length;
    const runs = s.prestigeLog ?? [];
    const history = runs.length
      ? runs.map((run) => `<div class="mm-run"><span>${tr('Dalga {0}', run.wave)}</span><b>💎 ${fmt(run.souls)}</b><small>${fmtTime(run.time ?? 0)} · ${oathById(run.oath).name}</small></div>`).join('')
      : tr('<p class="mm-muted">Henüz Yeniden Doğuş yok.</p>');
    const tiles = `<div class="mm-tiles">${tile('🌊', tr('En iyi dalga'), s.bestWave)}${tile('💰', tr('Toplam altın'), fmt(s.totalGold))}${tile('⏳', tr('Oynama süresi'), fmtTime(s.playTime))}${tile('🔁', tr('Yeniden doğuş'), s.prestiges)}</div>`;
    return tr('<h2 class="mm-title">İstatistikler</h2>\n      <div class="mm-scroll">\n        {0}\n        {1}\n        {2}\n        {3}\n      </div>\n      <nav class="mm-buttons"><button class="mm-btn" data-action="back">‹ Geri</button></nav>', tiles + group(tr('⚔️ Savaş'), [
          row(tr('En iyi dalga'), s.bestWave),
          row(tr('Öldürülen düşman'), fmt(s.kills)),
          row(tr('Yenilen Savaş Lordu'), fmt(c.bossKills ?? 0)),
          row(tr('Kuşatma makinesi'), fmt(c.siegeKills ?? 0)),
          row(tr('Kritik vuruş'), fmt(c.crits ?? 0)),
          row(tr('En uzun seri'), fmt(c.bestStreak ?? 0)),
          row(tr('Kusursuz dalga'), fmt(c.perfectWaves ?? 0)),
          row(tr('Hasar / sn'), fmt(estimateDps(st).total)),
        ]), group(tr('💰 Ekonomi'), [
          row(tr('Toplam altın'), fmt(s.totalGold)),
          row(tr('Altın / sn'), fmt(s.goldPerSec)),
          row(tr('Köy geliri'), tr('{0}/sn', fmt(st.village.total))),
          row(tr('Toplam Elmas'), fmt(s.totalGems ?? 0)),
        ]), group(tr('🏆 Koleksiyon'), [
          bar(tr('Başarımlar'), achievementCount(s), ACHIEVEMENTS.length),
          bar(tr('Eşya kütüphanesi'), codex.found, codex.total),
          row(tr('Tamamlanan set'), `${doneSets} / ${sets.length}`),
          row(tr('Bulunan eşya'), fmt(c.itemsFound ?? 0)),
          row(tr('Efsanevi eşya'), fmt(c.legendaries ?? 0)),
          row(tr('Kullanılan yetenek'), fmt(c.skillCasts ?? 0)),
        ]), group(tr('⏳ Yolculuk'), [
          row(tr('Oynama süresi'), fmtTime(s.playTime)),
          row(tr('Yeniden doğuş'), s.prestiges),
          row(tr('Toplam Ruh Taşı'), fmt(s.totalSouls)),
          row(tr('Kale düştü'), fmt(c.castleFalls ?? 0)),
        ]) + `<div class="mm-section">${tr('Yolculuk geçmişi')}</div><div class="mm-runs">${history}</div>`);
  }

  view_keys() {
    return tr('<h2 class="mm-title">Kısayollar</h2>\n      <div class="mm-scroll">\n        {0}\n      </div>\n      <nav class="mm-buttons"><button class="mm-btn" data-action="back">‹ Geri</button></nav>', SHORTCUTS.map(([title, rows]) => `<div class="mm-section">${title}</div>
          <div class="mm-keys">${rows.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div>`).join(''));
  }

  view_news() {
    const s = this.game.state;
    if (s.seenVersion !== VERSION) {
      s.seenVersion = VERSION;
      saveState(s);
    }
    const KIND_LABEL = { new: tr('YENİ'), balance: tr('DENGE'), change: tr('İYİLEŞTİRME'), fix: tr('DÜZELTME') };
    return tr('<h2 class="mm-title">Yenilikler</h2>\n      <div class="mm-scroll">\n        {0}\n      </div>\n      <nav class="mm-buttons"><button class="mm-btn" data-action="back">‹ Geri</button></nav>', CHANGELOG.map((rel, i) => `<div class="mm-release">
          <div class="mm-release-head"><b>${rel.title}</b><span>${i === 0 ? `<em class="mm-tag latest">${tr('SON')}</em>` : ''}${rel.version}${rel.date ? ` · ${rel.date}` : ''}</span></div>
          <ul>${rel.items.map(([icon, text, kind = 'change']) => `<li><i>${icon}</i><span><em class="mm-tag ${kind}">${KIND_LABEL[kind]}</em>${text}</span></li>`).join('')}</ul>
        </div>`).join(''));
  }

  view_confirm_new() {
    return tr('<h2 class="mm-title danger">Yeni oyun başlatılsın mı?</h2>\n      <p class="mm-text">Mevcut kayıt <b>kalıcı olarak silinir</b>: dalgalar, altın, Ruh Taşları, Elmas, eşyalar ve başarımlar dahil her şey.</p>\n      <p class="mm-text small">İstersen önce Ayarlar → Kayıt\'tan kodunu dışa aktararak sakla.</p>\n      <nav class="mm-buttons">\n        <button class="mm-btn" data-action="back">Vazgeç</button>\n        <button class="mm-btn danger" data-action="new">Evet, sıfırdan başla</button>\n      </nav>');
  }

  // ---- input -------------------------------------------------------------------------

  onClick(e) {
    const s = this.game.state;
    const choice = e.target.closest('button[data-choice]');
    if (choice) {
      const [key, value] = choice.dataset.choice.split(':');
      s.settings[key] = value;
      if (key === 'language') {
        chooseLanguage(value);
        saveState(this.game.state);
        location.reload();
        return;
      }
      if (key === 'numberStyle') setNumberStyle(value);
      saveState(s);
      this.hooks.onSettingsChanged?.(key);
      this.game.audio.play('buy');
      this.show('settings', false);
      return;
    }
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    this.game.audio.unlock();
    this.game.audio.play('buy');
    const action = btn.dataset.action;
    switch (action) {
      case 'play':
        this.close();
        this.hooks.onPlay();
        break;
      case 'new':
        this.hooks.onNewGame();
        break;
      case 'help':
        this.hooks.onHelp();
        break;
      case 'back':
        this.show('main');
        break;
      case 'save-now': {
        saveState(s);
        const note = this.panel.querySelector('[data-note]');
        if (note) note.textContent = tr('✓ Kaydedildi');
        break;
      }
      case 'copy': {
        const area = this.panel.querySelector('[data-export]');
        area.select();
        const done = () => { btn.textContent = tr('✓ Kopyalandı'); };
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(area.value).then(done, () => document.execCommand('copy') && done());
        else if (document.execCommand('copy')) done();
        break;
      }
      case 'import': {
        const code = this.panel.querySelector('[data-import]').value;
        const out = this.panel.querySelector('[data-error]');
        if (!code.trim()) {
          out.textContent = tr('Önce bir kod yapıştır.');
          break;
        }
        const error = this.hooks.onImport(code);
        if (error) out.textContent = error;
        break;
      }
      default:
        this.show(action); // settings, save, stats, keys, news, confirm-new
    }
  }

  onInput(e) {
    const input = e.target.closest('[data-setting]');
    if (!input) return;
    const s = this.game.state;
    const key = input.dataset.setting;
    if (key === 'volume') {
      s.settings.volume = Number(input.value) / 100;
      this.game.audio.setVolume(s.settings.volume);
      this.panel.querySelector('[data-label="volume"]').textContent = `%${input.value}`;
    } else if (key === 'uiScale') {
      s.settings.uiScale = Number(input.value) / 100;
      this.panel.querySelector('[data-label="uiScale"]').textContent = `%${input.value}`;
      this.hooks.onSettingsChanged?.(key);
    } else {
      s.settings[key] = input.checked;
      if (key === 'sound') {
        this.game.audio.enabled = input.checked;
        this.game.audio.unlock();
      }
    }
    saveState(s);
  }
}
