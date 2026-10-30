import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-ext-600.css';
import '@fontsource/cinzel/latin-800.css';
import '@fontsource/cinzel/latin-ext-800.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-ext-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-ext-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-ext-800.css';
import { initPlatform, platform } from './platform/platform.js';
import { initLanguage } from './i18n/i18n.js';

/*
 * Game text is resolved while its modules load, so the language has to be known first:
 * connect to the platform, pick the language, and only then load the game.
 */
await initPlatform();
initLanguage(platform.locale);
await import('./main.js');
