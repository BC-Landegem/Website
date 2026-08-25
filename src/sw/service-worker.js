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
// Ruim boven de handvol sleutels die we echt gebruiken (de kalenderbronnen en
// de intraclub). De grens bestaat alleen omdat deze cache de versiewissel
// overleeft en dus anders nooit iets kwijtraakt.
const DATA_MAX = 32;

const ASSET_EXTENSIES = /\.(?:css|js|mjs|woff2?|png|jpe?g|webp|avif|gif|svg|ico)$/;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// Verwijzingen naar gehashte bundels. De HTML noemt ze met hun volledige pad,
// een module verwijst naar zijn chunks met een relatieve import
// (`from"./kalender.CRV8d0q3.js"`). Alles ligt plat in _astro/, dus levert de
// bestandsnaam in beide gevallen het pad op — vandaar de capture group. BASE is
// een pad zonder regex-tekens en mag er zo in.
const ASSET_VERWIJZING = new RegExp(`(?:${BASE}_astro/|\\./)([\\w.-]+\\.(?:css|js))`, 'g');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SCHIL_CACHE);
      // Eén voor één, niet met addAll: een enkel pad dat 404't mag de hele
      // installatie niet onderuithalen.
      await Promise.all(
        SCHIL.map((pad) => cache.add(new Request(pad, { cache: 'reload' })).catch(() => {})),
      );
      await precachAssets(cache);
      await self.skipWaiting();
    })(),
  );
});

/**
 * Haalt de gehashte assets op waar de net geprecachte schil naar verwijst.
 *
 * Zonder dit staat de schil er na een deploy naakt bij: activate gooit de
 * assetcache van de vorige versie weg, en de pagina die de update aanzwengelde
 * had haar CSS toen al binnen — dus zit er niets in de nieuwe cache. Ga je op
 * dat moment offline, dan krijg je de hele schil zonder stijl of script. Dat
 * herstelt zichzelf bij de eerstvolgende online navigatie, maar dat is precies
 * het moment waarop je er niet op wil rekenen.
 *
 * De bestandsnamen kennen we niet wanneer deze worker gebouwd wordt (Astro
 * hasht ze), dus lezen we ze uit wat we net ophaalden — in lagen, want een
 * module verwijst op haar beurt naar chunks die in geen enkele HTML staan:
 * HTML → entry → chunk. Drie ronden dekt dat en maakt een cyclus onschadelijk.
 */
async function precachAssets(schilCache) {
  const assetCache = await caches.open(ASSET_CACHE);
  const gedaan = new Set();
  let bronnen = await Promise.all(
    SCHIL.filter((pad) => pad.endsWith('/')).map((pad) => schilCache.match(pad)),
  );

  for (let ronde = 0; ronde < 3 && bronnen.length; ronde++) {
    const nieuw = new Set();
    for (const bron of bronnen) {
      if (!bron) continue;
      const tekst = await bron.text().catch(() => '');
      for (const [, bestand] of tekst.matchAll(ASSET_VERWIJZING)) {
        const naam = `${BASE}_astro/${bestand}`;
        if (gedaan.has(naam)) continue;
        gedaan.add(naam);
        nieuw.add(naam);
      }
    }
    // Alleen JS lezen we opnieuw: daar staan de verwijzingen naar verdere
    // chunks. De CSS die Tailwind uitspuwt bevat geen @import.
    bronnen = (
      await Promise.all(
        [...nieuw].map((naam) =>
          assetCache
            .add(new Request(naam, { cache: 'reload' }))
            .then(() => (naam.endsWith('.js') ? assetCache.match(naam) : null))
            .catch(() => null),
        ),
      )
    ).filter(Boolean);
  }
}

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

/*
 * Wegschrijven naar de cache loopt via event.waitUntil, en die roepen we aan
 * vóór de time-out — niet pas wanneer de fetch klaar is. Een FetchEvent is
 * namelijk maar "actief" tot het is afgehandeld: hebben we al met de cache
 * geantwoord, dan gooit waitUntil een InvalidStateError en belandt de verse
 * respons juist op een trage lijn nooit in de cache. Nu aanroepen, terwijl het
 * event zeker nog actief is, houdt het in leven tot het wegschrijven klaar is.
 *
 * De .clone() moet in de eerste microtask na de fetch gebeuren, vóór de body
 * naar de pagina gaat — vandaar dat deze .then als eerste op de belofte hangt.
 */
function bewaar(event, netwerk, cache, sleutel, daarna) {
  event.waitUntil(
    netwerk
      .then(async (antwoord) => {
        if (!antwoord.ok) return;
        await cache.put(sleutel, antwoord.clone());
        if (daarna) await daarna();
      })
      .catch(() => {}),
  );
}

async function navigatie(event, verzoek) {
  const cache = await caches.open(SCHIL_CACHE);
  const sleutel = paginaSleutel(new URL(verzoek.url));
  const netwerk = fetch(verzoek);
  bewaar(event, netwerk, cache, sleutel);

  try {
    return await metTimeout(netwerk, NAVIGATIE_TIMEOUT);
  } catch {
    return (await cache.match(sleutel)) ?? (await cache.match(`${BASE}offline/`)) ?? Response.error();
  }
}

async function data(event, verzoek, doel) {
  const cache = await caches.open(DATA_CACHE);
  const sleutel = dataSleutel(doel);
  const netwerk = fetch(verzoek);
  bewaar(event, netwerk, cache, sleutel, () => beperkData(cache));

  const gecacht = await cache.match(sleutel);
  // Niets in de cache: dan maar wachten op het netwerk, hoe traag ook.
  if (!gecacht) return netwerk;

  try {
    return await metTimeout(netwerk, DATA_TIMEOUT);
  } catch {
    return gecacht;
  }
}

/**
 * Houdt de datacache begrensd. cache.keys() geeft de sleutels in de volgorde
 * waarin ze erin kwamen, en een put op een bestaande sleutel houdt zijn plaats
 * — dus staat het oudste vooraan.
 */
async function beperkData(cache) {
  const sleutels = await cache.keys();
  const teveel = sleutels.length - DATA_MAX;
  if (teveel <= 0) return;
  await Promise.all(sleutels.slice(0, teveel).map((sleutel) => cache.delete(sleutel)));
}

/**
 * Cache eerst, voor de gehashte assets en de Google Fonts.
 *
 * Die fonts-stylesheet komt binnen als no-cors verzoek (de <link> draagt geen
 * crossorigin), dus is de respons opaque: status 0 en ok false. Filteren op
 * `ok` betekende dus dat hij nooit in de cache belandde en de app offline
 * zonder Archivo stond, ondanks fonts.googleapis.com in FONT_HOSTS. Opaque mag
 * er daarom door. De prijs: een 404 van zo'n host valt niet van een geldige
 * respons te onderscheiden en zou blijven plakken tot de volgende deploy. Voor
 * twee vaste Google-URL's is dat een betere ruil dan een crossorigin op de
 * <link>, want dan hangt het laden van de stylesheet zélf van een CORS-header
 * af. Same-origin responsen worden nooit opaque, dus daar verandert niets.
 */
async function cacheEerst(event, verzoek) {
  const cache = await caches.open(ASSET_CACHE);
  const gecacht = await cache.match(verzoek);
  if (gecacht) return gecacht;

  const antwoord = await fetch(verzoek);
  if (antwoord.ok || antwoord.type === 'opaque') {
    event.waitUntil(cache.put(verzoek, antwoord.clone()));
  }
  return antwoord;
}
