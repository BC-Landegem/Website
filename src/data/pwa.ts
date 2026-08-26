// Configuratie van de progressive web app: gedeeld door de manifest-endpoint
// (src/pages/manifest.webmanifest.ts) en de service worker (src/pages/sw.js.ts).
export const APP_NAME = 'BC Landegem — Badmintonclub Landegem';
export const APP_SHORT_NAME = 'BC Landegem';
export const APP_DESCRIPTION =
  'Badmintonclub Landegem — speeluren, kalender, intraclub en clubinfo bij de hand.';

// Veerwit, gelijk aan de header (bg-feather-50) en de body-achtergrond: zo loopt
// de statusbalk van de geïnstalleerde app naadloos door in de pagina.
export const THEME_COLOR = '#faf7f1';
export const BACKGROUND_COLOR = '#faf7f1';

/**
 * Pagina's die de service worker meteen bij installatie ophaalt. Bewust kort:
 * de schil die je offline echt wil (wat, waar, wanneer) plus de offline-pagina
 * als vangnet. Al de rest belandt in de cache zodra je ze één keer bezoekt.
 */
export const SHELL_PATHS = [
  '/',
  '/kalender/',
  '/competitie/',
  '/intraclub/',
  '/jeugd/',
  '/club/over-de-club/',
  '/club/word-lid/',
  '/offline/',
];

/**
 * Vaste bestanden uit public/ die bij de schil horen. De gehashte assets van
 * Astro staan hier niet bij: hun namen zijn hier niet bekend, dus leest de
 * service worker die bij installatie uit de HTML die hij net ophaalde.
 */
export const SHELL_ASSETS = [
  '/images/logo-bc1.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/shortcut-kalender.png',
  '/icons/shortcut-intraclub.png',
  '/icons/shortcut-competitie.png',
];
