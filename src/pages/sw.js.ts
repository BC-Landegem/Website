// Serveert de service worker op /sw.js (met base path: /Website/sw.js). Het
// sjabloon staat in src/sw/service-worker.js; hier vullen we de build-waarden
// in die de worker zelf niet kan weten.
//
// LET OP bij de domeinswitch naar bclandegem.be: daar draait vandaag al een
// PWA, dus staat er bij bestaande bezoekers al een service worker op de root
// van dat domein. Zolang die niet vervangen wordt, blijft hij hun de oude site
// serveren — ook nadat deze site er live staat. Zorg dat dit bestand dan op
// exact hetzelfde pad terechtkomt als de service worker van de oude site (die
// bestandsnaam moet je op de oude site nakijken); de browser ziet hem dan als
// een update, installeert deze en gooit in activate elke vreemde cache weg.
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
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      // Voorkomt dat een browser of proxy een oude worker blijft opdissen.
      'cache-control': 'no-cache',
    },
  });
};
