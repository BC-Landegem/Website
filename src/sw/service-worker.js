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
 *
 * Onderaan staat een vierde taak, los van de caches: pushberichten ontvangen
 * en tonen (zie src/data/push.ts en de README onder Databronnen).
 */

const VERSION = '__VERSION__';
const BASE = '__BASE__';
const SHELL = /* __SHELL__ */ [];
// Pushberichten. Een lege sleutel betekent: push staat uit, en dan doen de
// handlers onderaan niets — het abonnement dat er misschien nog staat, blijft
// dan stil tot een build mét sleutel het weer oppikt.
const PUSH_ENDPOINT = '__PUSH_ENDPOINT__';
const VAPID_PUBLIC_KEY = '__VAPID_PUBLIC_KEY__';

// De schil- en assetcaches horen bij één build en worden bij elke nieuwe
// versie weggegooid. De datacache overleeft dat bewust: anders sta je na een
// nachtelijke media-sync met lege handen in de zaal.
const SHELL_CACHE = `bcl-shell-${VERSION}`;
const ASSET_CACHE = `bcl-assets-${VERSION}`;
const DATA_CACHE = 'bcl-data';
const CURRENT = [SHELL_CACHE, ASSET_CACHE, DATA_CACHE];

const NAVIGATION_TIMEOUT = 5000;
const DATA_TIMEOUT = 4000;
// Ruim boven de handvol sleutels die we echt gebruiken (de kalenderbronnen en
// de intraclub). De grens bestaat alleen omdat deze cache de versiewissel
// overleeft en dus anders nooit iets kwijtraakt.
const DATA_MAX = 32;

const ASSET_EXTENSIONS = /\.(?:css|js|mjs|woff2?|png|jpe?g|webp|avif|gif|svg|ico)$/;
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// Verwijzingen naar gehashte bundels. De HTML noemt ze met hun volledige pad,
// een module verwijst naar zijn chunks met een relatieve import
// (`from"./kalender.CRV8d0q3.js"`). Alles ligt plat in _astro/, dus levert de
// bestandsnaam in beide gevallen het pad op — vandaar de capture group. BASE is
// een pad zonder regex-tekens en mag er zo in.
const ASSET_REFERENCE = new RegExp(`(?:${BASE}_astro/|\\./)([\\w.-]+\\.(?:css|js))`, 'g');

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Eén voor één, niet met addAll: een enkel pad dat 404't mag de hele
      // installatie niet onderuithalen.
      await Promise.all(
        SHELL.map((path) => cache.add(new Request(path, { cache: 'reload' })).catch(() => {})),
      );
      await precacheAssets(cache);
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
async function precacheAssets(shellCache) {
  const assetCache = await caches.open(ASSET_CACHE);
  const done = new Set();
  let sources = await Promise.all(
    SHELL.filter((path) => path.endsWith('/')).map((path) => shellCache.match(path)),
  );

  for (let round = 0; round < 3 && sources.length; round++) {
    const found = new Set();
    for (const source of sources) {
      if (!source) continue;
      const text = await source.text().catch(() => '');
      for (const [, file] of text.matchAll(ASSET_REFERENCE)) {
        const name = `${BASE}_astro/${file}`;
        if (done.has(name)) continue;
        done.add(name);
        found.add(name);
      }
    }
    // Alleen JS lezen we opnieuw: daar staan de verwijzingen naar verdere
    // chunks. De CSS die Tailwind uitspuwt bevat geen @import.
    sources = (
      await Promise.all(
        [...found].map((name) =>
          assetCache
            .add(new Request(name, { cache: 'reload' }))
            .then(() => (name.endsWith('.js') ? assetCache.match(name) : null))
            .catch(() => null),
        ),
      )
    ).filter(Boolean);
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith('bcl-') && !CURRENT.includes(name)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const target = new URL(request.url);
  // Alleen http(s): schema's als chrome-extension: horen hier niet thuis.
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigation(event, request));
  } else if (isData(target)) {
    event.respondWith(data(event, request, target));
  } else if (isStatic(target)) {
    event.respondWith(cacheFirst(event, request));
  }
  // De rest (o.a. de foto's van het Google-CDN) laten we ongemoeid: die
  // regelt de browsercache prima en ze zouden onze opslag opblazen.
});

/**
 * De twee live bronnen: Google Calendar en de intraclub-API.
 *
 * De intraclub-API stond vroeger op www.bclandegem.be/intra-app/api/ — een pad
 * op het oude domein, dus volstond een pathname-test. Ze staat nu op een eigen
 * host, en zonder de hostnaam erbij valt elk API-antwoord in de assetcache of
 * nergens. Dan verlies je de network-first-met-vangnet die in Sporthal Oostbroek
 * het nut van de PWA is.
 */
function isData(target) {
  if (target.hostname === 'www.googleapis.com' && target.pathname.startsWith('/calendar/v3/')) return true;
  return target.hostname === 'intra.bclandegem.be' && target.pathname.startsWith('/api/');
}

function isStatic(target) {
  if (FONT_HOSTS.includes(target.hostname)) return true;
  if (target.origin !== self.location.origin) return false;
  return target.pathname.startsWith(`${BASE}_astro/`) || ASSET_EXTENSIONS.test(target.pathname);
}

/**
 * Cachesleutel voor data. De kalender vraagt timeMin op de milliseconde
 * nauwkeurig op; zonder deze normalisatie krijgt elke paginalading dus een
 * eigen sleutel en raakt de cache nooit. De API-key gaat er meteen mee uit — die
 * hoort niet in een cachesleutel thuis.
 */
function dataKey(target) {
  const key = new URL(target);
  for (const param of ['key', 'timeMin', 'timeMax']) key.searchParams.delete(param);
  return new Request(key.toString());
}

/** Cachesleutel voor HTML: zonder querystring, want die stuurt alleen de client-side render (?id=...). */
function pageKey(target) {
  return new Request(target.origin + target.pathname);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('time-out')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
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
function save(event, network, cache, key, after) {
  event.waitUntil(
    network
      .then(async (response) => {
        if (!response.ok) return;
        await cache.put(key, response.clone());
        if (after) await after();
      })
      .catch(() => {}),
  );
}

async function navigation(event, request) {
  const cache = await caches.open(SHELL_CACHE);
  const key = pageKey(new URL(request.url));
  const network = fetch(request);
  save(event, network, cache, key);

  try {
    return await withTimeout(network, NAVIGATION_TIMEOUT);
  } catch {
    return (await cache.match(key)) ?? (await cache.match(`${BASE}offline/`)) ?? Response.error();
  }
}

async function data(event, request, target) {
  const cache = await caches.open(DATA_CACHE);
  const key = dataKey(target);
  const network = fetch(request);
  save(event, network, cache, key, () => limitData(cache));

  const cached = await cache.match(key);
  // Niets in de cache: dan maar wachten op het netwerk, hoe traag ook.
  if (!cached) return network;

  try {
    return await withTimeout(network, DATA_TIMEOUT);
  } catch {
    return cached;
  }
}

/**
 * Houdt de datacache begrensd. cache.keys() geeft de sleutels in de volgorde
 * waarin ze erin kwamen, en een put op een bestaande sleutel houdt zijn plaats
 * — dus staat het oudste vooraan.
 */
async function limitData(cache) {
  const keys = await cache.keys();
  const excess = keys.length - DATA_MAX;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
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
async function cacheFirst(event, request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    event.waitUntil(cache.put(request, response.clone()));
  }
  return response;
}

/*
 * Pushberichten.
 *
 * De server (Laravel, intra.bclandegem.be) stuurt een JSON-payload:
 *   { title, body, url?, tag?, topic? }
 * `url` is waar een tik naartoe gaat, relatief aan de site (bv.
 * "/intraclub/speeldag/?id=123") of absoluut. `tag` laat een nieuw bericht een
 * ouder met dezelfde tag vervangen in plaats van ernaast te komen: één "nieuwe
 * stand" tegelijk, niet vijf. Ontbreekt de payload of is hij geen JSON, dan
 * tonen we toch iets: een stil verloren bericht is erger dan een karig bericht.
 */
self.addEventListener('push', (event) => {
  if (!VAPID_PUBLIC_KEY) return;
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'BC Landegem';
  const options = {
    body: payload.body || '',
    icon: `${BASE}icons/icon-192.png`,
    // Het badge-icoon is wat Android in de statusbalk zet: één kleur, alleen
    // de vorm telt. Zie scripts/generate-icons.mjs.
    badge: `${BASE}icons/badge-96.png`,
    lang: 'nl-BE',
    data: { url: payload.url || BASE, topic: payload.topic || null },
  };
  if (payload.tag) {
    options.tag = payload.tag;
    // Zonder renotify vervangt een bericht met dezelfde tag het vorige stíl:
    // geen trilling, geen geluid. Een nieuwe stand verdient wel een seintje.
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

/*
 * Een tik op het bericht opent de bijhorende pagina. Staat de app al open op
 * precies die pagina, dan halen we dat venster naar voren in plaats van een
 * tweede te openen. Enkel http(s), en enkel als het pad naar onze eigen site
 * of een absolute link uit onze eigen payload wijst — alles anders valt terug
 * op de startpagina.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = resolveUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => client.url.split('#')[0] === target);
      if (open && 'focus' in open) return open.focus();
      return self.clients.openWindow(target);
    })(),
  );
});

function resolveUrl(url) {
  const fallback = new URL(BASE, self.location.origin).href;
  if (typeof url !== 'string' || !url) return fallback;
  try {
    const resolved = new URL(url, self.location.origin);
    return resolved.protocol === 'https:' || resolved.protocol === 'http:' ? resolved.href : fallback;
  } catch {
    return fallback;
  }
}

/*
 * De browser kan een abonnement van zijn kant vernieuwen (de pushdienst
 * roteert, het endpoint verloopt). Dan krijgt de server het oude endpoint mee,
 * zodat hij de onderwerpen kan overzetten en het oude kan wissen. Zonder dit
 * verdwijnt zo'n abonnee stil uit de lijst en weet hij dat zelf niet.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  if (!VAPID_PUBLIC_KEY) return;
  event.waitUntil(
    (async () => {
      const previous = event.oldSubscription ? event.oldSubscription.endpoint : null;
      const subscription = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(),
      });
      const body = subscription.toJSON();
      body.previous_endpoint = previous;
      await fetch(PUSH_ENDPOINT, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
      });
    })().catch(() => {}),
  );
});

/** base64url → Uint8Array, wat pushManager.subscribe als applicationServerKey wil. */
function vapidKey() {
  const padded = VAPID_PUBLIC_KEY + '='.repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
