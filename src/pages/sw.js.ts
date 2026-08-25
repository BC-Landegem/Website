// Serveert de service worker op /sw.js (met base path: /Website/sw.js). Het
// sjabloon staat in src/sw/service-worker.js; hier vullen we de build-waarden
// in die de worker zelf niet kan weten.
//
// De naam van dit bestand doet niet ter zake voor de domeinswitch naar
// bclandegem.be, waar vandaag al workers van de oude site staan: register() op
// dezelfde scope vervangt de bestaande registratie hoe die worker ook heet, en
// src/sw/registratie.js meldt de rest af. Zie PRODUCT.md.
import type { APIRoute } from 'astro';
import sjabloon from '../sw/service-worker.js?raw';
import { SCHIL_ASSETS, SCHIL_PADEN } from '../data/pwa';
import { url } from '../lib/url';

export const GET: APIRoute = () => {
  const schil = [...SCHIL_PADEN, ...SCHIL_ASSETS].map((pad) => url(pad));
  // Buildtijdstip als cacheversie: elke deploy levert nieuwe, gehashte assets
  // op, dus mag de oude schil- en assetcache dan weg.
  const versie = new Date().toISOString();

  const code = sjabloon
    .replace('__VERSIE__', versie)
    .replace('__BASE__', url('/'))
    .replace('/* __SCHIL__ */ []', JSON.stringify(schil));

  return new Response(code, {
    // Alleen het content-type: dit endpoint wordt bij de statische build naar
    // een bestand geprerenderd, dus vallen eigen headers weg en bepaalt GitHub
    // Pages ze. Hoeft ook niet — een browser omzeilt zijn HTTP-cache voor het
    // hoofdscript van een service worker.
    headers: { 'content-type': 'text/javascript; charset=utf-8' },
  });
};
