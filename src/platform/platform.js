/*
 * The one place that talks to the CrazyGames SDK. Everything here is safe to call anywhere:
 * off CrazyGames, or when the script is blocked, the SDK stays null and the game simply runs
 * without ads and with local saves.
 */
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const LOAD_TIMEOUT = 4000;

/**
 * Turn on when the game reaches Full Launch. During Basic Launch CrazyGames serves no ads
 * and forbids ad buttons that do nothing, so offers then show only their non-ad choices.
 */
export const ADS_LIVE = false;

let sdk = null;
let environment = 'none';
let playing = false;

function loadScript() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
    setTimeout(() => resolve(false), LOAD_TIMEOUT);
  });
}

export async function initPlatform() {
  try {
    if (!(await loadScript()) || !window.CrazyGames?.SDK) return;
    await window.CrazyGames.SDK.init();
    environment = window.CrazyGames.SDK.environment;
    // On other sites the SDK runs "disabled" and every call throws
    if (environment === 'crazygames' || environment === 'local') sdk = window.CrazyGames.SDK;
  } catch {
    sdk = null;
  }
}

/** Run an SDK call; a failure there must never reach the game. */
function safely(fn) {
  if (!sdk) return undefined;
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export const platform = {
  /** Ads can really play: demo ads on localhost, real ones once ADS_LIVE is set. */
  get adsOn() {
    return !!sdk && (environment === 'local' || ADS_LIVE);
  },

  get locale() {
    return safely(() => sdk.user.systemInfo.locale) ?? navigator.language ?? 'en';
  },

  /** Cloud-synced key/value save on CrazyGames; null keeps saves in localStorage. */
  get store() {
    return environment === 'crazygames' ? sdk.data : null;
  },

  gameplayStart() {
    if (playing) return;
    playing = true;
    safely(() => sdk.game.gameplayStart());
  },

  gameplayStop() {
    if (!playing) return;
    playing = false;
    safely(() => sdk.game.gameplayStop());
  },

  happytime() {
    safely(() => sdk.game.happytime());
  },

  /** Calls `fn(muted)` now and whenever the site's mute setting changes. */
  watchMute(fn) {
    safely(() => {
      fn(!!sdk.game.settings.muteAudio);
      sdk.game.addSettingsChangeListener((settings) => fn(!!settings.muteAudio));
    });
  },

  /**
   * Plays an ad. onStart fires when it begins; onEnd(ok, code) always fires exactly once,
   * with ok false when the ad failed, so a rewarded ad only pays on ok.
   */
  showAd(type, { onStart, onEnd }) {
    if (!this.adsOn) {
      onEnd(false, 'adsDisabled');
      return;
    }
    let ended = false;
    const end = (ok, code) => {
      if (ended) return;
      ended = true;
      onEnd(ok, code);
    };
    try {
      sdk.ad.requestAd(type, {
        adStarted: () => onStart?.(),
        adFinished: () => end(true),
        adError: (error) => end(false, error?.code ?? 'other'),
      });
    } catch {
      end(false, 'other');
    }
  },
};
