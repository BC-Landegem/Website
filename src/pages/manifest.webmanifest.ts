// De web app manifest wordt gegenereerd in plaats van als vast bestand in
// public/ gezet: start_url, scope, id en de icoonpaden moeten de base path
// volgen. Die staat nu op /Website (GitHub Pages) en wordt bij de domeinswitch
// naar bclandegem.be '/' — dan klopt dit bestand vanzelf nog.
import type { APIRoute } from 'astro';
import {
  BACKGROUND_COLOR,
  APP_DESCRIPTION,
  APP_SHORT_NAME,
  APP_NAME,
  THEME_COLOR,
} from '../data/pwa';
import { url } from '../lib/url';

const shortcut = (name: string, description: string, path: string, icon: string) => ({
  name,
  short_name: name,
  description,
  url: url(path),
  icons: [
    { src: url(`/icons/shortcut-${icon}.png`), sizes: '192x192', type: 'image/png' },
  ],
});

export const GET: APIRoute = () => {
  const start = url('/');

  const manifest = {
    // De id bepaalt of een browser dit als dezelfde app ziet als een eerdere
    // installatie. Op bclandegem.be wordt dat '/', net als bij de bestaande
    // PWA daar — die installaties werken dan bij in plaats van te verdubbelen.
    id: start,
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    lang: 'nl-BE',
    dir: 'ltr',
    start_url: start,
    scope: start,
    display: 'standalone',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
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
    // Snelkoppelingen: wat je krijgt bij een lange druk op het app-icoon. De
    // oude PWA op www.bclandegem.be had er twee (Kalender en de intraclub-
    // tussenstand), elk met een beschrijving en een eigen icoon — die vullen we
    // hier aan met Competitie, omdat spelers daar via het menu al rechtstreeks
    // naartoe springen. Beschrijving én icoon horen erbij: zonder icoon valt een
    // launcher terug op het app-icoon en zijn de drie niet van elkaar te
    // onderscheiden. De ?utm_source=pwa van de oude site laten we weg; er is
    // hier geen analytics die er iets mee doet.
    shortcuts: [
      shortcut('Kalender', 'Bekijk de kalender van BC Landegem', '/kalender/', 'kalender'),
      shortcut('Intraclub', 'Bekijk de intraclub tussenstand', '/intraclub/', 'intraclub'),
      shortcut('Competitie', 'Bekijk de ploegen en uitslagen', '/competitie/', 'competitie'),
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'content-type': 'application/manifest+json; charset=utf-8' },
  });
};
