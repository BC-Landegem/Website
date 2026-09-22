# BC Landegem — clubwebsite

De clubwebsite van Badmintonclub Landegem: een statische site gebouwd met
[Astro](https://astro.build) 7 en Tailwind CSS v4. Ze wordt op twee plaatsen
gepubliceerd: op GitHub Pages en, via FTP, op de shared hosting van bclandegem.be.

Live: <https://bc-landegem.github.io/Website/> — de opvolger van www.bclandegem.be.
De FTP-deploy zet dezelfde build op een testsubdomein van de hosting (noindex),
tot de domeinswitch; zie "Bouwen en deployen".

Deze README beschrijft **hóe** de site werkt en hoe je eraan werkt. Het **waarom**
— doelgroepen, context en de redenering achter de keuzes — staat in
[PRODUCT.md](PRODUCT.md); het ontwerpsysteem (kleuren, typografie, componenten)
in [DESIGN.md](DESIGN.md).

## Aan de slag

Je hebt **Node 22.18 of nieuwer** nodig. Niet zomaar een ondergrens:
`scripts/scrape-media.mjs` importeert een `.ts`-bestand rechtstreeks en leunt dus
op type stripping. De workflows draaien op Node 24. Eén script valt buiten Node:
`scripts/scrape-champions/` is Python 3.10 met Playwright, en dat heb je alleen
nodig om de kampioenstitels bij te werken — zie Scripts.

```bash
npm install
npm run dev       # dev-server met hot reload
npm run build     # statische build naar dist/, daarna de zoekindex
npm run preview   # dist/ lokaal serveren zoals Pages het doet
```

Of draai de dev-server in de lichte Node Alpine-container; de broncode wordt
rechtstreeks gemount en dependencies blijven in een apart Docker-volume:

```bash
docker compose up
```

Open daarna <http://localhost:4321/Website/>. Stoppen en het dependency-volume
mee verwijderen kan met `docker compose down --volumes`.

> **`npm run build` doet twee dingen.** Na `astro build` draait `pagefind --site dist`
> over de gebouwde HTML en schrijft de zoekindex naar `dist/pagefind/`. In dev
> bestaat die index dus niet en zegt het zoekveld op `/archief/` dat gewoon;
> zoeken testen doe je met `npm run build && npm run preview`.

> **De build haalt data op.** De intraclub-historiek (erelijst, zeventien
> eindstanden, records) wordt bij het bouwen uit de API gehaald in plaats van in
> de browser. Dat zijn een dertigtal verzoeken en kost een paar seconden. Zonder
> netwerk faalt de build; zie "Databronnen · Intraclub-API".

> **Let op de base-prefix.** De site staat op GitHub Pages onder `/Website`, en
> Astro past die prefix ook in dev toe. De dev-server draait dus op
> <http://localhost:4321/Website/> — niet op de root. `http://localhost:4321/`
> geeft een 404; dat is verwacht gedrag, geen defect. Blijf ook op **4321**: dat
> is het enige lokale origin dat de intraclub-API toelaat. Wil je zien hoe de
> site er op de root van een eigen domein uitziet — zoals de FTP-deploy hem
> bouwt — zet dan `SITE_URL` en `BASE_PATH=/` in `.env` (zie `.env.example`);
> `astro.config.mjs` leest die twee en valt zonder terug op github.io/`/Website`.

## Mappenstructuur

```
src/
  assets/       Afbeeldingen die door de build gaan (hero, sponsorlogo's)
  components/   Header, Footer en kleine bouwstenen (o.a. het archiefzoekveld)
  content/      archief/: 837 markdownbestanden uit de oude Joomla-site
  data/         Alle inhoud die geen code is — zie "Inhoud aanpassen"
  layouts/      Layout.astro: de enige layout, draagt <head>, PWA en navigatie
  lib/          Logica: intraclub, kalender, media, pushabonnement, de verloopgrafiek, en url()
  pages/        Eén bestand per route (plus twee endpoints: manifest en sw.js)
  styles/       global.css met de Tailwind @theme-tokens
  sw/           Broncode van de service worker en het opruimscript
public/         Wordt onaangeraakt gekopieerd (logo, iconen, favicons,
                en de geredde beelden uit het Joomla-archief)
scripts/        Onderhoudsscripts die je met de hand draait — zie hieronder
.claude/        Projectconfiguratie voor Claude Code — zie "De README bijhouden"
```

## Inhoud aanpassen

Bijna alles wat verandert aan de club verandert in `src/data/` — geen componenten
aanraken.

| Wil je dit wijzigen | Bewerk | Wat er verandert |
| --- | --- | --- |
| Speeluren, sporthal, inschrijflink | `src/data/trainings.json` | Homepage, `/jeugd/`, `/club/word-lid/` en de footer |
| Competitieploegen, seizoen | `src/data/teams.json` | `/competitie/` én de ploeglinks in de navigatie (`Header.astro`) |
| Kampioenstitels van de ploegen | `src/data/champions.csv` | De tijdlijn op `/club/over-de-club/` — seizoenen nieuwste eerst, elke titel linkt naar toernooi.nl |
| Clubmomenten (jubilea, …) | `src/data/club-events.csv` | Zelfde tijdlijn: `year,title[,url[,album]]` — meerdere rijen met hetzelfde jaar komen onder één bol; optionele URL wordt een link; `album` is een slug uit `media.ts` en geeft een link naar de foto's; jaar 1987 is de oprichting en staat altijd alleen op de laatste rij |
| Intraclubwinnaars van vóór 2009-2010 | `src/data/intraclub-pre-archive.csv` | Het blok "Vóór het archief" onderaan `/intraclub/erelijst/`: `season,winner[,women[,note]]` — namen zonder cijfers, want van die jaargangen bewaarde de club geen gemiddelden. Zie Databronnen |
| Sponsors | `src/data/sponsors.json` + logo in `src/assets/sponsors/` | De sponsorbalk in de footer |
| Fotoalbums | `src/data/media.ts` | `/media/` én de fotostrook op de homepage — pas na een sync, zie Databronnen |
| Facebook-/Instagram-links | `src/data/social.ts` | De knoppen "Volg de club" in de footer — leeg = het blok verdwijnt |
| Kalenderbronnen en -kleuren | `src/data/calendar.ts` | `/kalender/` en de events op de homepage |
| App-naam, offline schil, snelkoppelingen | `src/data/pwa.ts` | Manifest en service worker (iconen genereer je apart) |
| Contactformulier: endpoint, Turnstile-sleutel, clubadres | `src/data/contact.ts` | Het formulier op `/club/contact/` — zie Databronnen |
| Meldformulier: endpoint, naam en adres van het Aanspreekpunt Integriteit | `src/data/contact.ts` | `/club/melden/`, de bedankpagina en de uitwijkadressen — de ontvanger zelf staat in de Laravel-config, zie Databronnen |
| Pushberichten: onderwerpen, endpoint | `src/data/push.ts` | `/club/pushberichten/` en de service worker — de sleutel komt uit de build-omgeving (`PUBLIC_VAPID_PUBLIC_KEY`), zie Databronnen |
| Kleuren en typografie | `src/styles/global.css` (`@theme`) | De hele site — voor het clubrood eerst het kleurlab, zie hieronder |
| Losse tekst | De `.astro`-pagina zelf | Alleen die pagina |

## Databronnen

Zes bronnen leven buiten deze repo. Ze verschillen in *wanneer* ze opgehaald
worden en in *wat er gebeurt als ze falen* — dat verschil is bewust.

**Google Calendar** — geconfigureerd in `src/data/calendar.ts`, opgehaald in de
browser van de bezoeker. Faalt een bron of is ze leeg, dan wordt ze stil
genegeerd en verdwijnt de eventssectie op de homepage; de rest van de pagina
blijft staan. De sleutel in dat bestand is een publieke, referrer-restricted
browser-key: die hoort in de broncode. Roteer je hem, zet de referrer-restrictie
dan mee — zonder restrictie is het geen publieke sleutel meer. De `color`- en
`text`-velden van `categories` belanden rechtstreeks als CSS-kleur in een
inline stijl (legende, eventblokken, detailpaneel): een hex mag, een token als
`var(--color-club-600)` ook — de events staan bewust op dat token zodat ze
meekleuren wanneer het clubrood wijzigt. Zet er iets dat geen geldige CSS-kleur
is en het blok blijft stil ongekleurd.

**Google Photos** — de gecureerde albumlijst staat in `src/data/media.ts`, de
foto's zelf blijven bij Google. De nachtelijke workflow `media-sync.yml` leest de
publieke share-pagina's uit en schrijft `src/data/media.json`; de build leest
alleen dat bestand en praat nooit met Google. De sectie "Uit de club" op de
homepage toont de eerste vijf foto's van het nieuwste album uit diezelfde lijst:
komt er een album bij, dan ververst die strook vanzelf. Die foto's dragen elk
`referrerpolicy="no-referrer"` — Google's CDN antwoordt met 429 zodra er een
vreemde referer meekomt, en op de homepage kan dat niet paginabreed omdat de
Google Calendar-key juist referrer-restricted is. Breekt de scrape, dan blijft de
vorige data staan, kleurt de workflow rood en draait de site gewoon door. Een
foto van de site halen doe je in het Google Photos-album zelf.

**Intraclub-API** — `https://intra.bclandegem.be/api` (Laravel), instelbaar via
`PUBLIC_INTRA_API` (zie `.env.example`). Deze bron wordt op **twee momenten**
aangesproken, en dat onderscheid is de kern van de intraclub-pagina's:

- `src/lib/intra.ts` draait **in de browser** en bedient het lopende seizoen:
  `/intraclub/`, `/intraclub/speler/?id=` en `/intraclub/speeldag/?id=`. Valt de
  API weg, dan tonen die drie een foutmelding en blijft de rest van de site staan.
- `src/lib/intra-build.ts` draait **tijdens de build** en maakt platte HTML van
  alles wat bevroren is: de erelijst, zeventien eindstanden en de clubrecords.
  Nul fetches in de browser, meteen indexeerbaar, leesbaar zonder netwerk. Een
  `Map` ontdubbelt de paden, want de erelijst en de seizoenspagina's vragen
  dezelfde standen op — vandaar ook dat er nergens `&limit=1` staat: dat zou een
  ander pad zijn voor een lijst die al in het geheugen zit.

De API begint bij 2009-2010. Wat ouder is bestaat alleen nog in oude
club-Excels: losse winnaarsnamen, zonder gemiddelde, zonder spelersaantal,
zonder speeldagen. Die staan in `src/data/intraclub-pre-archive.csv` en krijgen
een eigen blok **onder** de rail op de erelijst, geparseerd door
`parsePreArchiveChampions()` in `src/lib/champions.ts`. Bewust niet in de rail:
die draagt berekende cijfers uit de API, en een met de hand getypte naam
ertussen zou liegen over waar de rest vandaan komt. De `oldest` van de pagina
neemt wél het oudste jaar van beide bronnen — anders belooft de intro 2009
terwijl er 2005 onderaan staat. Ontbrekende seizoenen ontbreken gewoon; het gat
tussen 2006-2007 en 2009-2010 is wat er niet teruggevonden is.

Die rijen staan wél in de berekening van de grijze regels achter een naam.
`champions()` in `intra-build.ts` krijgt ze daarom mee als verplichte parameter:
zonder die lijst zou de rail Luc Van Tornhout in 2011-2012 een eerste titel
toeschrijven en 2009-2010 "de eerste" noemen, terwijl er twee oudere seizoenen
onder staan. En zodra er pre-archiefdata is, verdwijnt "de eerste" helemaal —
dat bestand bestaat juist omdat de reeks onvolledig is, dus mag geen enkel
seizoen die titel nog dragen. "Op rij" rekent op aansluitende jaartallen, niet
op aansluitende lijstplaatsen, want het pre-archief heeft gaten.

**Van een afgesloten seizoen is publiek enkel de eindstand.** Geen speeldagen,
geen uitslagen, geen aanwezigheden, geen klassementsverloop. De regel erachter,
in één zin: *één regel uit een eindstand mag altijd; die regels van één persoon
bij elkaar zetten mag alleen als die persoon nog lid is.* Twee gevolgen die je
in de code terugziet:

- De spelerspagina **moet** client-side blijven. Of iemand nog lid is verandert
  ná de build, en er is bewust geen rebuild-trigger vanuit de API. Een
  build-time fiche zou maanden blijven staan nadat iemand gestopt is. Vraag je
  een niet-lid op, dan geeft de API `403 not_a_member` **zonder naam**; de pagina
  toont dan een neutrale melding en verbergt de kop. `403 season_closed` werkt
  net zo. Beide lopen via `ApiError`/`refusalCode()` in `intra.ts`.
- In een eindstand is een naam klikbaar zodra er een `player_id` achter zit. In
  het archief geldt dat voor twee derde van de rijen; de rest speelde vóór het
  huidige ledenbestand en heeft er nooit een gekregen. Dat de fiche daarna zelf
  beslist of ze iets toont, is het punt — de build weet niet wie er in maart nog
  lid is.

> **Twee id-reeksen die overlappen.** Het archief en het huidige format tellen
> elk vanaf 1: `season_id: 1` is 2013-2014 in het archief en 2023-2024 daarbuiten.
> Het veld `is_archive` hoort dus in de sleutel, niet ernaast — zie `seasonKey()`
> in `intra-build.ts`. Wie op `season_id` alleen indexeert, linkt tien jaar naast
> de waarheid zonder fout en zonder leeg veld.

`/intraclub/zo-werkt-het/` is de uitzondering op allebei — die draait op een
bevroren snapshot in `src/data/intraclub-example.json` en doet geen enkel request.
Verversen kan alleen tijdens een **lopend** seizoen: `node scripts/intra-snapshot.mjs`
haalt de laatst berekende speeldag op, en van een afgesloten seizoen geeft de API
die niet meer.

> **CORS is per origin.** De API laat `http://localhost:4321` en
> `https://bc-landegem.github.io` toe. Draai je de dev-server of preview op een
> andere poort, dan faalt elke browsercall met `net::ERR_FAILED` en zegt de
> pagina "De standen konden niet geladen worden" — dat lijkt op een codefout maar
> is er geen. Bij de domeinswitch moet het nieuwe origin bij
> `CORS_ALLOWED_ORIGINS` aan de kant van de API.

**Twizzit** — het inschrijfformulier is één externe link in
`src/data/trainings.json`. Geen integratie, geen sleutel.

**Het contactformulier** — `src/data/contact.ts` wijst naar een endpoint in
diezelfde Laravel-app: `https://intra.bclandegem.be/api/contact`, instelbaar via
`PUBLIC_CONTACT_ENDPOINT`. Het is de enige bron waar de site iets *heen* stuurt
in plaats van ophaalt, en de enige die als een gewone `<form method="post">`
werkt in plaats van als `fetch`. Dat is bewust: een native form-POST is een
simple request, dus geldt de CORS-waarschuwing hierboven er níét voor. De server
antwoordt met een redirect naar `/club/contact/bedankt/` bij succes of naar
`/club/contact/?error=…` bij een fout; welke origins hij mag terugsturen staat in
een allowlist aan zijn kant, en het formulier stuurt zijn eigen origin mee zodat
dit op localhost, op github.io en na de domeinswitch werkt zonder aanpassing.

> **Zonder `PUBLIC_TURNSTILE_SITE_KEY` bouwt het formulier zonder Turnstile.**
> Dan leunt de verdediging op het honeypotveld, het tijdslot en de rate limit van
> de server. Zet je hem aan, dan moet de bijhorende `TURNSTILE_SECRET` mee aan de
> Laravel-kant: maar één van de twee betekent ofwel geen bescherming, ofwel dat
> elke inzending geweigerd wordt.

**Het meldformulier** — `/club/melden/` post naar een *tweede* endpoint in dezelfde
Laravel-app, `https://intra.bclandegem.be/api/melding` (instelbaar via
`PUBLIC_REPORT_ENDPOINT`). Zelfde mechaniek als het contactformulier, maar een
eigen route met de ontvanger hard in de config: een melding over grensoverschrijdend
gedrag mag nooit bij het bestuur belanden, en een bestemming die de client kiest is
precies de bug die dat ooit laat gebeuren. Het contract dat de twee kanten
bijeenhoudt:

| | Contactformulier (`/api/contact`) | Meldformulier (`/api/melding`) |
|---|---|---|
| Velden | `name`, `email`, `message` — alle verplicht | `message` verplicht (max 10 000, en `maxlength` op het tekstvak staat daaraan gelijk); `name` (max 100) en `contact` (max 190, vrije tekst: e-mail óf telefoon) optioneel |
| Anti-spam | honeypot `website` (stil 200 bij inhoud), `loaded_at` (tijdslot), 3 per IP per uur, Turnstile `cf-turnstile-response` met `action=contact` | idem, Turnstile-`action=melding` (wordt echt gecontroleerd) en een eigen emmer van 3 per IP per uur |
| Turnstile onbereikbaar | dicht | **door**, met `[ongeverifieerd]` in het onderwerp |
| Terug | `return_ok` / `return_error` tegen een allowlist van origins | idem; standaard `/club/melden/bedankt/` en `/club/melden/?error=<code>` — de site toont twee boodschappen: `validation`/`bot` → probeer opnieuw; al de rest → niet aangekomen, spreek het aanspreekpunt aan |
| Ontvanger | `info@bclandegem.be` | het adres van het Aanspreekpunt Integriteit, **alleen uit de config en zonder standaardwaarde**, nooit uit het request; geen CC/BCC naar het bestuur. Staat het leeg, dan komt de site terug met `?error=unavailable` |
| Onderwerp | `[Website] Bericht van <naam>` | `[Melding] <dd-mm-jjjj uu:mm>` — nooit de naam (die staat in de notificatie op een vergrendeld scherm); vast voorvoegsel voor een mailfilter |
| Reply-To | de bezoeker | alleen als `contact` op een e-mailadres lijkt; anders géén Reply-To |
| In de mail | naam, e-mail, bericht, tijdstip | bericht, naam en `contact` als ingevuld, tijdstip — **geen IP-adres, geen user-agent, geen Turnstile-details**: bij een anonieme melding breekt dat de anonimiteit |
| Bewaring | mail-only | mail-only, en ook **niet in het Laravel-log** (geen `Log::info` met de inhoud) |
| Bevestiging naar de inzender | geen | geen — een kopie van de melding in de inbox van een kind op een gedeelde computer is een risico, geen service |
| In de browser | velden komen bij `?error=` terug uit `sessionStorage` | **niets**: `autocomplete="off"` op het formulier, geen storage; een mislukte inzending is het verhaal kwijt, en dat staat zo op het formulier |

> Het mailadres van het aanspreekpunt staat **nergens op de site** (op haar vraag);
> het formulier is de enige schriftelijke weg en de ontvanger staat alleen in de
> Laravel-config. Wisselt de persoon, dan verandert `INTEGRITY_NAME` in
> `src/data/contact.ts`, de tekst op `/club/aanspreekpunt-integriteit/` én die
> config-regel. Vergeet je de laatste, dan post het formulier stil naar het oude adres.

**Pushberichten** — eigen Web Push (VAPID) met de abonnementen in dezelfde
Laravel-app: `https://intra.bclandegem.be/api/push/subscriptions`, instelbaar via
`PUBLIC_PUSH_ENDPOINT`. De oude Joomla-site deed dit via OneSignal; waarom we dat
niet overnemen en iedereen van nul start, staat in PRODUCT.md. Drie stukken code:
`src/data/push.ts` (endpoint, sleutel, de twee onderwerpen), `src/lib/push-client.ts`
met `src/components/PushSettings.astro` (de vinkjes op `/club/pushberichten/`) plus
`src/components/PushNudge.astro` (de wegklikbare strook die naar die pagina wijst), en het
staartstuk van `src/sw/service-worker.js` (ontvangen, tikken, een verlopen abonnement
vernieuwen).

Dit is, anders dan de formulieren, wél een `fetch` met JSON — een abonnement is een
object, geen formulierveld — dus geldt de CORS-waarschuwing hierboven: het origin van
de site moet bij `CORS_ALLOWED_ORIGINS` van de API, en `PUT`/`DELETE` moeten door
op dit pad. Het contract:

| | |
|---|---|
| `PUT /api/push/subscriptions` | Body: de `PushSubscription.toJSON()` van de browser (`endpoint`, `keys.p256dh`, `keys.auth`) plus optioneel `topics: string[]` en `previous_endpoint`. Upsert op `endpoint`. **Zonder `topics`** blijven de bewaarde onderwerpen staan (nieuw endpoint: `[]`) — zo leest de pagina de stand terug zonder eigen GET. Met `previous_endpoint` (uit `pushsubscriptionchange`) neemt de rij de onderwerpen van het oude endpoint over en verdwijnt dat oude. Antwoord `200 { "topics": [...] }`; onbekend onderwerp → `422` |
| `DELETE /api/push/subscriptions` | Body `{ "endpoint" }` → `204`. De site roept dit aan als de abonnee alle vinkjes uitzet, vóór `subscription.unsubscribe()` |
| Onderwerpen | `club` (met de hand: een afgelasting, open speeldag, lessenreeks, ledenfeest) en `intraclub` (automatisch zodra een nieuwe speeldag berekend is, met `url` naar `/intraclub/speeldag/?id=…`). De lijst staat in `PUSH_TOPICS`; een nieuw onderwerp moet aan beide kanten |
| Payload naar de browser | JSON `{ "title", "body", "url"?, "tag"?, "topic"? }`. `url` relatief aan de site of absoluut; `tag` laat een nieuw bericht het vorige met dezelfde tag vervangen (mét seintje), bv. `intraclub` zodat er nooit vijf standen naast elkaar hangen. Zet een TTL van hoogstens een paar dagen: een afgelasting van vorige week hoeft niet meer aan te komen |
| Opruimen | Antwoordt de pushdienst `404` of `410` op een bericht, dan is het endpoint dood en gaat de rij eruit. Dat is ook het pad voor wie zich via de browserinstellingen afmeldt in plaats van via de pagina |
| Bewaring | Endpoint, de twee sleutels, onderwerpen, tijdstip. Geen IP, geen user-agent, geen koppeling aan een lid — de privacyverklaring belooft dat |
| Sleutels | Eén VAPID-paar per omgeving. De private helft en het `mailto:`-contact staan in de Laravel-config; de publieke helft komt als `PUBLIC_VAPID_PUBLIC_KEY` in de build (zie "Bouwen en deployen"). Een ander paar voor test en productie houdt testberichten weg van echte abonnees — en een abonnement hangt sowieso aan het origin, dus wat op het testsubdomein of op github.io geabonneerd raakt, bestaat na de switch niet meer |

> **Zonder `PUBLIC_VAPID_PUBLIC_KEY` staat push uit.** `/club/pushberichten/` zegt dat
> dan, de links ernaartoe (footer, `/intraclub/`, `llms.txt`) verschijnen
> niet, en de service worker doet niets met een `push`-event. Een verkeerde sleutel
> (niet base64url, niet 65 bytes) geeft op de pagina "De sleutel van de site klopt
> niet" zodra iemand een vinkje zet. De badge in de statusbalk (`badge-96.png`) komt
> uit `scripts/generate-icons.mjs`, net als de andere iconen.

**De oude Joomla-site** — de enige bron die *eenmalig* is en een vervaldatum heeft.
De databasedump staat in `scraped/` en blijft **buiten git** (zie `.gitignore`): hij
bevat de wachtwoordhashes van 74 ledenaccounts, plus e-mailadressen en IP-adressen
uit de reacties. Alleen de uitvoer van de conversie hoort in de repo, nooit de bron.

`scripts/archive-images.mjs` leest die dump, zoekt elke `<img>` en elke link naar
een beeld of document in de oude artikels op, en haalt op wat nog bestaat. Resultaat:
de bestanden in `public/archief/beelden/` en een manifest in
`src/data/archive-images.json` dat per bron-URL vastlegt welk bestand het werd — of
waarom er geen is (`404`, `403`, timeout, imgur-placeholder). De conversie leest dat
manifest later om `<img src>` te herschrijven of de tag weg te halen.

> **Hier zit een klok op.** www.bclandegem.be draait op het moment van schrijven nog
> en serveert `images/…` gewoon; na de domeinswitch is dat voorbij. Van de 163
> bron-URL's leefden er 98 — de rest (vooral Facebook-CDN) was toen al dood. Opnieuw
> draaien ná de switch levert minder op, nooit meer.

**Kampioenstitels** — anders dan de zes bronnen hierboven leeft deze in de repo:
`src/data/champions.csv`. Geen live-ophaling. Een nieuwe titel is een extra
rij; de tijdlijn op `/club/over-de-club/` volgt bij de volgende build. De URL's
in die CSV wijzen naar toernooi.nl; `src/lib/champions.ts` leest het bestand
tijdens de build en houdt enkel rijen met `won=True` en rang 1 over. Bijwerken
vanaf toernooi.nl: zie [`scripts/scrape-champions/README.md`](scripts/scrape-champions/README.md)
— en kijk de winnaars na, want een afgebroken seizoen (2020-2021, corona) staat
ook met rang 1 en een paar punten in de stand. Clubmomenten (jubilea, oprichting)
staan in `src/data/club-events.csv` (`year,title[,url[,album]]`, met `album` een slug uit `src/data/media.ts` voor een fotolink) en komen op dezelfde slinger.

## Archief

De 837 artikels van de oude Joomla-site leven onder `/archief/`. Drie routes doen
het werk:

| Route | Bestand | Wat het toont |
| --- | --- | --- |
| `/archief/` | `pages/archief/index.astro` | Zoekveld, de vijf onderwerpen, de jaarlijn |
| `/archief/2013/` en `/archief/competitie/` | `pages/archief/[segment]/index.astro` | Eén route, twee soorten overzicht |
| `/archief/2013/de-titel/` | `pages/archief/[segment]/[slug].astro` | Het artikel met zijn reacties |

Jaar en onderwerp delen bewust één route: ze zitten op dezelfde plek in de URL, en
twee dynamische mappen naast elkaar kan Astro niet uit elkaar houden.

**Kurk in plaats van clubrood.** Het hele archief draait op `cork-*` en `feather-100`
waar de levende site `club-*` en `feather-50` gebruikt. Dat is geen versiering maar
het afgesproken signaal: rood betekent "dit geldt nu", kurk betekent "dit gold
toen". Elk artikel draagt daarbovenop een expliciete band. Nodig, want een deel
van deze artikels léést als nieuws — *"Nu woensdag is er intraclub, graag om
20u30"* ging ooit over aanstaande woensdag.

**Zoeken.** Pagefind indexeert alleen wat in `data-pagefind-body` staat, en dat
attribuut draagt enkel het `<article>` op een archiefpagina. Zodra één pagina het
heeft, slaat Pagefind alle pagina's zonder over — de rest van de site komt dus
niet in de resultaten. De bijlijn onder de titel draagt `data-pagefind-ignore`,
anders begint elk resultaat met "6 november 2011 · door Luc · Clubnieuws".

**Valstrik bij het frontmatter.** Het veld heet `urlnaam`, niet `slug`. Een veld
dat `slug` heet wordt door de glob-loader geclaimd als de identiteit van de entry,
en die moet dan over de héle collectie uniek zijn. Onze namen zijn uniek per jaar
— `intraclub` bestaat in 2010, 2012 én 2013 — en de loader liet die dubbels
stilzwijgend vallen. Dat kostte twintig artikels, met alleen een `[WARN]` in de
build als aanwijzing.

## Kleurlab

Alle rode oppervlakken lopen via de tokens `--color-club-50..900`. Om een ander
clubrood te bespreken zonder eerst te committen: zet `?kleurlab` achter een
willekeurige URL. Er verschijnt een paneel dat die tien tokens live herrekent
(felheid, diepte, tint), de contrastwaarden meet en een deelbare link geeft.
De keuze blijft staan tijdens het navigeren en zit enkel in de browser van wie
het aanzette — zonder de parameter wordt `public/kleurlab.js` niet eens
opgehaald.

Is er een winnaar, dan plak je het blok uit "Kopieer CSS" in het `@theme`-blok
van `src/styles/global.css`. Daarna mag het lab eruit: `ColorLab.astro`,
`public/kleurlab.js` en de import in `Layout.astro`.

De vier contrastregels in het paneel volgen de twee-roden-regel uit DESIGN.md:
witte tekst staat op `club-600`, donkere tekst op `club-500`, kleine rode tekst
op veerwit is `club-700`, en de vluchtdraad is een lijn (3:1 volstaat). Zolang
die vier groen staan is de keuze vrij — de felheid is dan een smaakkwestie,
geen leesbaarheidskwestie.

## Scripts

Handmatig te draaien, geen onderdeel van de build. Elk script legt in zijn kop
uit waarom het bestaat en wanneer je het opnieuw draait.

```bash
node scripts/generate-icons.mjs    # PWA-iconen uit het logo — na een logo- of kleurwijziging
node scripts/scrape-media.mjs      # media.json lokaal bijwerken (doet de workflow 's nachts ook)
node scripts/intra-snapshot.mjs    # nieuw voorbeeld voor /intraclub/zo-werkt-het/
node scripts/archive-images.mjs    # beelden uit de oude Joomla-artikels redden — zie Databronnen
node scripts/archive-conversion.mjs # die artikels omzetten naar src/content/archief/ (--dry om te proefdraaien)
python scripts/scrape-champions/scrape_champions.py  # kampioenstitels ophalen bij toernooi.nl — Python, zie de README in die map
```

`intra-snapshot.mjs` schrijft het hele voorbeeld weg, inclusief de spelregels die
per seizoen verschillen: de puntenschaal (`points_per_set`, 15 sinds 2026-2027) en
de exacte basispunten op vier decimalen, die het apart bij
`/seasons/{id}/statistics?members=0` haalt omdat de stand er maar twee geeft.

> **Eén ding kan het script niet weten: met welk lotingsysteem er die avond
> geloot is.** De API geeft dat veld niet, dus leidt het script het af uit de
> maand van de speeldag — tot nieuwjaar "wisselende tegenstanders", vanaf januari
> "sterktegroepen". Dat is een clubafspraak en geen code: in de Laravel-app is
> `seasons.draw_system` één kolom die een beheerder met de hand omzet. Wijzigt de
> afspraak, dan moeten het script én de tekst op `/intraclub/zo-werkt-het/` mee.

Het script controleert zichzelf: het herberekent elk dagcijfer uit de setstanden
en vergelijkt dat met `day_score` van de API. Wijken ze meer dan een afronding af,
dan stopt het met een foutmelding, want dan zijn de rekenregels in de
clubapplicatie veranderd en klopt de uitlegpagina niet meer.

`archive-images.mjs` is idempotent: wat al in `public/archief/beelden/` staat wordt
overgeslagen, dus opnieuw draaien pikt alleen op wat nog ontbreekt. Het heeft de
SQL-dump nodig en stopt met een foutmelding als die er niet is.

`archive-conversion.mjs` is dat **niet**: het gooit `src/content/archief/` weg en
schrijft alles opnieuw. Draai eerst met `--dry`. Het leunt op `turndown`
(devDependency, draait alleen hier — komt nooit in de browser) en op het manifest
van `archive-images.mjs`, dus draai dat eerst. Onderaan zijn uitvoer staat een
eindcontrole die klaagt over alles wat nog naar Joomla ruikt: overgebleven
plugintags, smileycodes, `<span>`-restanten, beelden buiten `/archief/beelden/`.
Blijft die stil, dan is de conversie schoon.

`scrape-champions/` is het enige script dat niet in Node draait: Python 3.10 met
Playwright, omdat toernooi.nl zijn standen pas na JavaScript toont. Het schrijft
`placements.csv` en `champions.csv` naast zichzelf, beide buiten git; wat op de
site hoort, kopieer je naar `src/data/champions.csv`. Draai het na het einde van
het seizoen en kijk de winnaars na voor je kopieert — zie Databronnen.

## Bouwen en deployen

Een push naar `master` start twee workflows die dezelfde broncode bouwen voor
twee bestemmingen:

| Workflow | Bouwt voor | Publiceert via | Blijft tot |
| --- | --- | --- | --- |
| `deploy.yml` | `https://bc-landegem.github.io/Website/` | GitHub Pages | de domeinswitch; dan weg |
| `deploy-ftp.yml` | de root van `SITE_URL` (nu het testsubdomein) | FTPS naar de shared hosting (DirectAdmin) | wordt bij de switch productie |

Het verschil zit in twee omgevingsvariabelen die `astro.config.mjs` leest:
`SITE_URL` en `BASE_PATH`. Zonder die twee (lokaal, in `deploy.yml`) bouwt Astro
voor Pages; `deploy-ftp.yml` zet ze op het eigen domein en `/`. Alles wat van de
base afhangt — `url()`, het manifest, de service worker, de redirect van het
oude reglement, de origin die het contactformulier meestuurt — volgt vanzelf.

**GitHub Pages** vraagt geen secrets — wel twee omgevingsvariabelen die in de
workflow staan: `PUBLIC_INTRA_API` (hardgecodeerd) en
`PUBLIC_TURNSTILE_SITE_KEY`, die uit de repository variable
`TURNSTILE_SITE_KEY` komt. Die laatste is geen secret — een Turnstile-sitesleutel
staat sowieso in de HTML — vandaar een variable en geen secret. Is ze niet gezet,
dan bouwt het contactformulier zonder captcha en faalt er niets. Hetzelfde geldt
voor `PUBLIC_VAPID_PUBLIC_KEY` uit de variable `VAPID_PUBLIC_KEY`: leeg betekent een
site zonder pushberichten. Op Pages zet je die hoogstens om te testen, met een ander
sleutelpaar dan productie — een abonnement hangt aan het origin en overleeft de
domeinswitch niet.

**De FTP-deploy** leest zijn instellingen van de environment `shared-hosting`
(Settings → Environments), zodat test en productie alleen verschillen in wat
daar ingevuld staat:

| Soort | Naam | Betekenis |
| --- | --- | --- |
| secret | `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` | Het FTP-account van het (sub)domein — in DirectAdmin heeft elk subdomein er een eigen |
| variable | `SITE_URL` | **Verplicht**, bv. `https://nieuw.bclandegem.be`. Ontbreekt hij, dan stopt de workflow vóór de build in plaats van een github.io-build op het subdomein te zetten |
| variable | `FTP_SERVER_DIR` | Webroot op de server, standaard `public_html/` (met slash) |
| variable | `FTP_PROTOCOL` | Standaard `ftps`; alleen `ftp` als de host geen TLS kan — dan gaat het wachtwoord in klare tekst |
| variable | `NOINDEX` | `true` zolang het een testomgeving is: de workflow voegt `X-Robots-Tag: noindex` aan `.htaccess` toe en schrijft een `robots.txt` met `Disallow: /` |
| variable | `VAPID_PUBLIC_KEY` | De publieke VAPID-sleutel van déze omgeving; leeg = geen pushberichten. Per environment, zodat test en productie een eigen sleutelpaar hebben — zie "Databronnen · Pushberichten" |

De upload is een incrementele sync ([FTP-Deploy-Action](https://github.com/SamKirkland/FTP-Deploy-Action)):
alleen gewijzigde bestanden gaan over, en wat lokaal verdween wordt op de server
gewist. Daarvoor bewaart de action `.ftp-deploy-sync-state.json` in de doelmap —
laat dat bestand staan, anders gaat de volgende deploy weer alles uploaden. Ze
verwijdert alleen wat ze zelf ooit uploadde, dus bestaande bestanden in de map
blijven ongemoeid. De sync wordt nooit halverwege afgebroken
(`cancel-in-progress: false`): een tweede push wacht.

`public/.htaccess` gaat mee in de build en regelt wat GitHub Pages zelf doet:
`404.html` als foutpagina, het mimetype van het manifest, een jaar cache voor de
gehashte bestanden onder `/_astro/` en `no-cache` voor HTML, manifest en `sw.js`.
Op Pages is het bestand onschadelijk.

> **Vier dingen staan buiten deze repo en moeten mee bij een nieuw domein**, ook
> bij het testsubdomein: het origin bij `CORS_ALLOWED_ORIGINS` van de
> intraclub-API (anders "De standen konden niet geladen worden", en anders kan
> ook niemand zich op pushberichten abonneren), datzelfde origin in de
> redirect-allowlist van het contact- en meldformulier aan de Laravel-kant, het
> domein bij de Turnstile-widget in Cloudflare (anders weigert de captcha), en
> een VAPID-sleutelpaar voor die omgeving (privaat in de Laravel-config, publiek
> als `VAPID_PUBLIC_KEY` op de environment). Zie "Databronnen".

**De domeinswitch** is met deze opzet geen code-wijziging: `SITE_URL` op
`https://www.bclandegem.be`, de FTP-secrets op het hoofdaccount, `NOINDEX` weg
of op `false`, en `deploy.yml` verwijderen (plus de `gh workflow run deploy.yml`
in `media-sync.yml`). Wat er daarna in de browser nagekeken moet worden — de
oude service workers van Joomla — staat in PRODUCT.md.

> **De build praat met de intraclub-API.** De erelijst, de eindstanden en de
> records worden gebouwd, niet opgehaald in de browser. Ligt
> `intra.bclandegem.be` plat, dan faalt de deploy — met opzet: een halve
> historiek is erger dan geen deploy. Er zit een herkansing op elk verzoek voor
> losse haperingen. Met de nachtelijke cron hieronder betekent dat wel dat een
> hapering om 04:00 een rode workflow oplevert.

Beide deploy-workflows draaien ook **elke nacht om 04:00 UTC**. Niet omdat er dan
iets gepusht is, maar omdat een deel van de build aan de klok hangt en niet aan
een commit: een seizoen wordt pas als eindstandpagina gebouwd zodra het niet meer
loopt, en dat "niet meer" volgt uit de datum van de laatste berekende speeldag.
Een statische site heeft geen klok, alleen builds. Zonder deze cron zou de
eindstand van een net afgesloten seizoen pas verschijnen bij de volgende push.

`media-sync.yml` draait elke nacht om 03:00 UTC — in de winter 4u, in de zomer 5u Belgische tijd (en kan met de hand via Actions). Vindt
hij nieuwe foto's, dan commit hij `src/data/media.json` en **start hij zelf beide
deploys** — nodig, omdat een push met het standaard `GITHUB_TOKEN` geen andere
workflows triggert.

## Valkuilen

- **`src/data/media.json` bewerk je nooit met de hand.** Het is uitvoer van de
  scrape en wordt bij de volgende sync overschreven. Wijzig `media.ts` of het
  Google Photos-album.
- **Interne links altijd via `url()`** uit `src/lib/url.ts`. Een hardgecodeerde
  `/kalender/` werkt lokaal en breekt op Pages, waar alles onder `/Website/`
  hangt.
- **Wat je vanuit de offline schil linkt, hoort zelf in de schil.** De pagina's in
  `SHELL_PATHS` (`src/data/pwa.ts`) werken zonder bereik; een link daaruit naar een
  pagina die er niet in staat, loopt dood op `/offline/`. Zo kwam `/club/contact/`
  erbij: `/club/word-lid/` verwees naar een `mailto:` — dat werkt offline, want de
  mailapp verstuurt later — en na de omschakeling naar het contactformulier wees
  diezelfde link naar een pagina die niet gecachet was.
- **`public/icons/` is gegenereerde uitvoer die tóch in git staat.** Bewerk de
  PNG's niet met de hand — pas het logo of de kleuren aan en draai
  `generate-icons.mjs` opnieuw.
- **`src/content/archief/` is na de eerste conversie de bron van waarheid.**
  De 837 markdownbestanden zijn ooit uit de dump gegenereerd, maar
  `archive-conversion.mjs` opnieuw draaien **wist de map en schrijft alles over** —
  handmatige correcties in een artikel zijn dan weg. Verbeter een typo in het
  `.md`-bestand, niet in het script.
- **`public/archief/beelden/` ziet er gegenereerd uit, maar is onvervangbaar.**
  Anders dan `public/icons/` kun je deze bestanden niet opnieuw maken: hun bron
  verdwijnt met de domeinswitch. Gooi ze niet weg om ze "opnieuw te laten
  ophalen" — dan zijn ze weg. Hetzelfde geldt voor
  `src/data/archive-images.json`: dat is uitvoer van het script en bewerk je niet
  met de hand, maar het bijhouden ervan is wél hoe je weet wat er ontbreekt.
- **Service workers houden vast.** Test je de PWA lokaal, ruim dan af en toe je
  registratie op in DevTools → Application; anders debug je een oude cache.
- **De intraclub-pagina's hangen aan poort 4321.** De API laat alleen dat origin
  toe (en dat van Pages; elk nieuw domein, ook het testsubdomein, moet er aan de
  API-kant bij). `--port 4322` geeft `net::ERR_FAILED` op elke call — een
  CORS-weigering, geen bug in de site.
- **Seizoenspagina's verschijnen pas als het seizoen niet meer loopt.** De API
  blijft een afgesloten seizoen maandenlang `current` noemen; `intra-build.ts`
  leidt uit de datum van de laatste berekende speeldag af of het écht nog loopt.
  Zolang dat zo is, leeft die stand op `/intraclub/` en wordt er geen bevroren
  kopie gebouwd. Zie de nachtelijke cron bij "Bouwen en deployen": die grens
  wordt overschreden door de kalender, niet door een commit.
- **`?members=0` is niet optioneel op een afgesloten seizoen.** Zonder die
  parameter filtert de API ook een oude stand op wie er vandaag nog lid is, en
  dan mist de eindstand van 2023-2024 er 36 van de 96. Geldt evengoed binnen het
  lopende seizoen: `scripts/intra-snapshot.mjs` heeft hem nodig omdat er anders
  iemand die deze zomer stopte uit het voorbeeld valt.
- **`average` is `null` voor wie in het lopende seizoen niet meer meespeelt.**
  Een gemiddelde van weken oud zegt niets over vandaag, dus de API laat het weg.
  Die rijen staan achteraan in het klassement, mét hun echte `rank` — sorteer
  dus niet zelf opnieuw. Reken nergens op een getal: `row.average.toFixed(2)`
  brak de top-10 op de homepage. Gebruik `decimal()` uit `src/lib/intra.ts`
  (streepje) of toon "Niet actief". In een eindstand van een afgesloten seizoen
  is het veld altijd gevuld.
- **`players_count` is de lengte van de eindstand**, niet het aantal
  inschrijvingen. Je mag het dus als teller boven een tabel zetten. Vroeger niet:
  voor 2018-2019 stond er 142 boven een stand van 81.
- **Het archief is niet volledig, en dat is zichtbaar.** Er is geen `gender` per
  seizoen bewaard maar wel per rij in de eindstand — daarop draait de dameslijn
  van de erelijst. `ranking` staat er maar één keer per persoon en niet per
  seizoen: daarom draagt de erelijst wél een dameslijn en géén recreantenlijn.
- **Vergelijk gemiddelden niet over de twee generaties heen.** Het oude format
  (2009-2023) speelde met vaste teams in best-of-3, het huidige met duo's die per
  set roteren. De cijfers zien er hetzelfde uit en betekenen iets anders; daarom
  staat er een breuklijn in de geschiedenistabel op de spelerspagina.

## De README bijhouden

Dit bestand raakt achterop zodra iemand de data, de scripts of de config wijzigt
zonder hier te kijken. `.claude/hooks/readme-actueel.mjs` vangt dat op: het draait
als Stop-hook van Claude Code en meldt het wanneer een bewaakt bestand wijzigde
terwijl README.md ongemoeid bleef.

Bewaakt worden `src/data/`, `scripts/`, `.github/workflows/`, `astro.config.mjs`,
`package.json`, `src/lib/url.ts`, `src/lib/intra.ts` en `src/styles/global.css`.
Bewust niet: `src/pages/` en `src/components/` (de README somt geen pagina's op),
en de twee gegenereerde bestanden `media.json` en `intraclub-example.json`.

Los van Claude Code draaien kan ook:

```bash
node .claude/hooks/readme-actueel.mjs                  # kijkt naar git status
node .claude/hooks/readme-actueel.mjs src/data/x.json  # kijkt naar deze paden
```

## Verder lezen

- [PRODUCT.md](PRODUCT.md) — doelgroepen, operationele context, de checklist voor
  de domeinswitch naar bclandegem.be
- [DESIGN.md](DESIGN.md) — het ontwerpsysteem "De Shuttle": kleuren, typografie,
  componenten en hun regels
