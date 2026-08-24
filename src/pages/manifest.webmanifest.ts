// De web app manifest wordt gegenereerd in plaats van als vast bestand in
// public/ gezet: start_url, scope, id en de icoonpaden moeten de base path
// volgen. Die staat nu op /Website (GitHub Pages) en wordt bij de domeinswitch
// naar bclandegem.be '/' — dan klopt dit bestand vanzelf nog.
import type { APIRoute } from 'astro';
import {
  ACHTERGROND_KLEUR,
  APP_BESCHRIJVING,
  APP_KORTE_NAAM,
  APP_NAAM,
  THEMA_KLEUR,
} from '../data/pwa';
import { url } from '../lib/url';

export const GET: APIRoute = () => {
  const start = url('/');

  const manifest = {
    // De id bepaalt of een browser dit als dezelfde app ziet als een eerdere
    // installatie. Op bclandegem.be wordt dat '/', net als bij de bestaande
    // PWA daar — die installaties werken dan bij in plaats van te verdubbelen.
    id: start,
    name: APP_NAAM,
    short_name: APP_KORTE_NAAM,
    description: APP_BESCHRIJVING,
    lang: 'nl-BE',
    dir: 'ltr',
    start_url: start,
    scope: start,
    display: 'standalone',
    background_color: ACHTERGROND_KLEUR,
    theme_color: THEMA_KLEUR,
    categories: ['sports'],
    icons: [
      { src: url('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: url('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: url('/icons/icon-maskable-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      { name: 'Kalender', short_name: 'Kalender', url: url('/kalender/') },
      { name: 'Intraclub', short_name: 'Intraclub', url: url('/intraclub/') },
      { name: 'Competitie', short_name: 'Competitie', url: url('/competitie/') },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
};
