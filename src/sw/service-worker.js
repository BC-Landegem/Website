/*
 * Service worker van BC Landegem.
 *
 * Dit bestand is een sjabloon: src/pages/sw.js.ts vult de drie placeholders
 * hieronder in bij de build en serveert het resultaat als /sw.js. Bewerk dus
 * dít bestand, niet de gegenereerde versie.
 *
 * Drie strategieën, elk voor wat het is:
 *
 *   navigatie (HTML)  netwerk eerst, met korte time-out. Online zie je altijd
 *                     de actuele pagina; op een slechte lijn of offline komt de
 *                     laatst bezochte versie uit de cache, en anders de
 *                     offline-pagina.
 *   statische assets  cache eerst. Astro hasht de bestandsnamen, dus wat in de
 *                     cache zit hoort onveranderlijk bij deze versie.
 *   data (API's)      netwerk eerst met time-out, cache als vangnet. Bewust
 *                     géén stale-while-revalidate: de kalender- en
 *                     intraclubpagina's halen hun data één keer op en
 *                     hertekenen niet, dus zou "eerst stale, dan stil
 *                     bijwerken" betekenen dat je online structureel oude
 *                     standen ziet. Nu is online altijd vers, en valt alleen
 *                     een trage of dode lijn terug op wat we laatst wisten.
 *
 * Let op: die terugval kan gedateerd zijn. Een gecachte kalender kan een
 * training tonen die intussen voorbij is. Dat is de prijs voor iets zien in een
 * sporthal zonder bereik; de service worker kent de betekenis van de data niet
 * en kan er niet op filteren.
 */

const VERSIE = '__VERSIE__';
const BASE = '__BASE__';
const SCHIL = /* __SCHIL__ */ [];

// De schil- en assetcaches horen bij één build en worden bij elke nieuwe
// versie weggegooid. De datacache overleeft dat bewust: anders sta je na een
// nachtelijke media-sync met lege handen in de zaal.
const SCHIL_CACHE = `bcl-schil-${VERSIE}`;
const ASSET_CACHE = `bcl-assets-${VERSIE}`;
const DATA_CACHE = 'bcl-data';
const HUIDIG = [SCHIL_CACHE, ASSET_CACHE, DATA_CACHE];

const NAVIGATIE_TIMEOUT = 5000;
const DATA_TIMEOUT = 4000;

const ASSET_EXTENSIES = /\.(?:css|js|mjs|woff2?|png|jpe?g|webp|avif|gif|svg|ico)$/;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SCHIL_CACHE);
      // Eén voor één, niet met addAll: een enkel pad dat 404't mag de hele
      // installatie niet onderuithalen.
      await Promise.all(
        SCHIL.map((pad) => cache.add(new Request(pad, { cache: 'reload' })).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(
        namen.filter((naam) => naam.startsWith('bcl-') && !HUIDIG.includes(naam)).map((naam) => caches.delete(naam)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const verzoek = event.request;
  if (verzoek.method !== 'GET') return;

  const doel = new URL(verzoek.url);
  // Alleen http(s): schema's als chrome-extension: horen hier niet thuis.
  if (doel.protocol !== 'https:' && doel.protocol !== 'http:') return;

  if (verzoek.mode === 'navigate') {
    event.respondWith(navigatie(event, verzoek));
  } else if (isData(doel)) {
    event.respondWith(data(event, verzoek, doel));
  } else if (isStatisch(doel)) {
    event.respondWith(cacheEerst(event, verzoek));
  }
  // De rest (o.a. de foto's van het Google-CDN) laten we ongemoeid: die
  // regelt de browsercache prima en ze zouden onze opslag opblazen.
});

/** De twee live bronnen: Google Calendar en de intraclub-API. */
function isData(doel) {
  if (doel.hostname === 'www.googleapis.com' && doel.pathname.startsWith('/calendar/v3/')) return true;
  return doel.pathname.startsWith('/intra-app/api/');
}

function isStatisch(doel) {
  if (FONT_HOSTS.includes(doel.hostname)) return true;
  if (doel.origin !== self.location.origin) return false;
  return doel.pathname.startsWith(`${BASE}_astro/`) || ASSET_EXTENSIES.test(doel.pathname);
}

/**
 * Cachesleutel voor data. De kalender vraagt timeMin op de milliseconde
 * nauwkeurig op; zonder deze normalisatie krijgt elke paginalading dus een
 * eigen sleutel en raakt de cache nooit. De API-key gaat er meteen mee uit — die
 * hoort niet in een cachesleutel thuis.
 */
function dataSleutel(doel) {
  const sleutel = new URL(doel);
  for (const param of ['key', 'timeMin', 'timeMax']) sleutel.searchParams.delete(param);
  return new Request(sleutel.toString());
}

/** Cachesleutel voor HTML: zonder querystring, want die stuurt alleen de client-side render (?id=...). */
function paginaSleutel(doel) {
  return new Request(doel.origin + doel.pathname);
}

function metTimeout(belofte, ms) {
  return new Promise((resolve, reject) => {
    const teller = setTimeout(() => reject(new Error('time-out')), ms);
    belofte.then(resolve, reject).finally(() => clearTimeout(teller));
  });
}

async function navigatie(event, verzoek) {
  const cache = await caches.open(SCHIL_CACHE);
  const netwerk = fetch(verzoek).then((antwoord) => {
    if (antwoord.ok) {
      event.waitUntil(cache.put(paginaSleutel(new URL(verzoek.url)), antwoord.clone()));
    }
    return antwoord;
  });
  netwerk.catch(() => {});

  try {
    return await metTimeout(netwerk, NAVIGATIE_TIMEOUT);
  } catch {
    return (
      (await cache.match(paginaSleutel(new URL(verzoek.url)))) ??
      (await cache.match(`${BASE}offline/`)) ??
      Response.error()
    );
  }
}

async function data(event, verzoek, doel) {
  const cache = await caches.open(DATA_CACHE);
  const sleutel = dataSleutel(doel);
  const netwerk = fetch(verzoek).then((antwoord) => {
    if (antwoord.ok) event.waitUntil(cache.put(sleutel, antwoord.clone()));
    return antwoord;
  });
  netwerk.catch(() => {});

  const gecacht = await cache.match(sleutel);
  // Niets in de cache: dan maar wachten op het netwerk, hoe traag ook.
  if (!gecacht) return netwerk;

  try {
    return await metTimeout(netwerk, DATA_TIMEOUT);
  } catch {
    return gecacht;
  }
}

async function cacheEerst(event, verzoek) {
  const cache = await caches.open(ASSET_CACHE);
  const gecacht = await cache.match(verzoek);
  if (gecacht) return gecacht;

  const antwoord = await fetch(verzoek);
  if (antwoord.ok) event.waitUntil(cache.put(verzoek, antwoord.clone()));
  return antwoord;
}
