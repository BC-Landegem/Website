# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Twee evenwaardige doelgroepen (bevestigd door de opdrachtgever):

1. **Kandidaat-leden** uit de regio Nevele/Deinze — gezinnen met kinderen (jeugdwerking), volwassen recreanten en spelers met competitie-ambitie. Ze landen op de site om te weten: wanneer wordt er gespeeld, mag ik eens proberen, hoe word ik lid.
2. **Bestaande leden** — zoeken snel praktische info: speeluren, kalender/events, intraclub-standen, competitie, reglement.

## Product Purpose

De clubwebsite van BC Landegem (Badmintonclub Landegem): nieuwe leden werven én bestaande leden bedienen. Succes = een bezoeker die een proefbeurt komt doen of zich inschrijft, en een lid dat in enkele seconden vindt wanneer en waar er gespeeld wordt.

## Positioning

Dorpsclub met echte breedte: jeugdwerking, recreatieve avonden én competitieploegen onder één dak, sinds 1987, in Sporthal Oostbroek (Nevele, Deinze). Laagdrempelig: "proefbeurten zijn altijd welkom — spring gerust binnen."

## Operating Context

- **www.bclandegem.be is de échte, huidige website** (bevestigd door de opdrachtgever); deze repo is de vervanger in opbouw. De oude site heeft naast de secties van deze repo ook een Media-sectie (fotogalerijen) en een nieuws-/aankondigingenstroom (bv. "Open speeldag", "5-delige lessenreeks voor nieuwkomers & recreanten — gratis voor leden, €25 voor niet-leden, verrekend met het lidgeld"), plus een contactpagina. Zulke aankondigingen zijn het soort inhoud dat de nieuwe site moet kunnen dragen.
- **De oude site had een contactformulier, geen zichtbaar e-mailadres** (nagekeken in de Joomla-dump: menu-item `/contact` → `com_contact&view=contact&id=1`, met `info@bclandegem.be` als bestemming en `show_email` uit). De nieuwe site verving dat aanvankelijk door `mailto:info@` op zeven plaatsen; het contactformulier op `/club/contact/` herstelt het oude gedrag. Het adres hoort dus **niet** zichtbaar op de site: het stond er nooit, en in platte HTML wordt het geoogst.
- Vijf vaste speelmomenten per week (ma/wo/za/zo) in Sporthal Oostbroek; brondata in `src/data/trainings.json`.
- Inschrijven gebeurt via een extern Twizzit-formulier (link in trainings.json).
- Events komen live uit een publieke Google Calendar (`src/data/calendar.ts`); de events-sectie op de homepage blijft verborgen als er niets gepland is of de API faalt.
- Intraclub-standen worden apart getoond (`/intraclub/`).
- Fotoalbums (`/media/`) komen uit publiek gedeelde Google Photos-albums: de gecureerde lijst staat in `src/data/media.ts`, een nachtelijke workflow (`media-sync.yml`) scrapet de share-pagina's naar `src/data/media.json` (nooit met de hand bewerken) en de build leest enkel dat bestand. Foto's worden gehotlinkt vanaf Google's CDN. Foto verwijderen = uit het Google Photos-album halen; de volgende sync haalt hem van de site.
- Site is statisch (Astro, GitHub Pages) en volledig Nederlandstalig (nl-BE).
- **De site is een progressive web app**: installeerbaar op het beginscherm, met een service worker die de schil (startpagina, kalender, competitie, intraclub, jeugd, over-de-club, word-lid) offline houdt — inclusief de stijl en scripts van die pagina's, die de worker bij installatie uit de opgehaalde HTML opdiept omdat hun bestandsnamen gehasht zijn. Kalender- en intraclubdata komen netwerk-eerst met de laatst gekende stand als vangnet — nuttig in Sporthal Oostbroek, waar het bereik slecht is. Geen eigen installatieknop in de UI; de browser doet het aanbod.
- **Snelkoppelingen op het app-icoon**: een lange druk geeft Kalender, Intraclub en Competitie, elk met een eigen icoon. De oude PWA op www.bclandegem.be had de eerste twee; Competitie is erbij omdat spelers daar via het menu al rechtstreeks naartoe springen. Verandert die lijst, dan moeten de bijhorende iconen in `public/icons/` mee (zie DESIGN.md) — zonder icoon valt een launcher terug op het app-icoon en zijn de snelkoppelingen niet van elkaar te onderscheiden.
- **De oude site op bclandegem.be (Joomla) draagt vier service workers** in zijn root — `BCLandegemServiceWorker.js`, `pwabuilder-sw.js` (met `offline.html`, PWABuilder) en de twee OneSignal-workers voor pushberichten (`OneSignalSDKWorker.js`, `OneSignalSDKUpdaterWorker.js`). Bij terugkerende bezoekers blijven die geregistreerd ná de domeinswitch, en ze onderscheppen onze pagina's zolang ze bestaan. Wij ruimen ze zelf op: `src/sw/registration.js` meldt bij elke paginalading elke registratie af waarvan de scope onze pagina's omvat en die niet onze eigen worker is, en wist daarna elke cache die niet met `bcl-` begint. Onze worker op hetzelfde pad zetten als de oude is dus **niet** nodig: `register()` op dezelfde scope vervangt de bestaande registratie hoe die worker ook heet. Wat wél nodig is: dat onze pagina één keer laadt. Doet de oude worker HTML netwerk-eerst (het gebruikelijke PWABuilder-patroon), dan gebeurt dat meteen; cachet hij HTML agressief, dan pas na zijn eigen updatecheck. Reken er niet op dat de browser die workers zelf opruimt omdat hun script na de switch 404't — sommige doen dat, niet alle. Checklist voor die dag: (1) in de GitHub-environment `shared-hosting` de variable `SITE_URL` op de nieuwe domeinnaam en de FTP-secrets op het hoofdaccount (de base is daar al `/`; zie README "Bouwen en deployen") — manifest, iconen, precache-lijst en het opruimscript volgen vanzelf; (2) na de switch in DevTools → Application nakijken dat er precies één service worker staat (onze `/sw.js`) en dat de vreemde caches weg zijn; (3) de VAPID-sleutel van productie als `VAPID_PUBLIC_KEY` op de environment en het nieuwe origin bij de CORS-lijst van de API, anders staat push uit of kan niemand zich abonneren — OneSignal zelf is beslist, zie hieronder.
- **Pushberichten komen terug, maar niet via OneSignal** (beslist september 2026). De oude site stuurde push via OneSignal; die workers kunnen na de switch niet meer geladen worden en ons opruimscript meldt ze af, dus bestaande abonnees vallen weg. Dat is aanvaard: **iedereen start van nul.** Stil opnieuw abonneren was technisch gekund (de toestemming hangt aan het origin `www.bclandegem.be` en blijft staan), maar die toestemming werd aan OneSignal gegeven, niet aan ons — en het zou de switch afhankelijk maken van een feature die klaar moet zijn vóór die dag. Wie eerder al toestemming gaf, is wel met één tik opnieuw aan boord: de browser vraagt het niet nog eens.
- **Eigen Web Push (VAPID) via de Laravel-app** op intra.bclandegem.be, dezelfde die de intraclub-API en de formulieren draagt: geen derde partij in de service worker, geen gratis tier waar je aan hangt, en de intraclub-berichten kunnen daar rechtstreeks vertrekken. **Twee onderwerpen, apart aan te vinken**: `club` (met de hand: een speelavond die niet doorgaat, een open speeldag, een lessenreeks, het ledenfeest — enkele keren per seizoen) en `intraclub` (automatisch zodra een nieuwe speeldag berekend is; enkel voor wie intra speelt, dus niet voor iedereen). Geen kalenderherinneringen: Twizzit doet ploeg en aanwezigheid al, en dit mag daar niet mee concurreren. Aan- en afzetten op `/club/pushberichten/`, per toestel. Die pagina staat **niet in het Club-menu**: het is een instelling, geen clubinfo, en het menu is al lang genoeg. Je komt er via de footer en via de regel op `/intraclub/` ("Krijg een bericht bij een nieuwe stand") — daar verkoopt push zichzelf, want wie om de twee weken komt kijken of de stand er al staat, kan zich dat besparen. Geen prompt bij het laden van een pagina — de vraag komt pas bij het eerste vinkje, en een geweigerde toestemming is voor de site onherroepelijk. Op iOS werkt het alleen als de site op het beginscherm staat; de pagina legt dat uit in plaats van stil te falen. **Wat nog moet gebeuren aan de Laravel-kant** staat als contract in de README onder Databronnen · Pushberichten: de twee endpoints, de tabel, het verzenden (een scherm of commando voor `club`, een trigger op een nieuwe speeldag voor `intraclub`) en het VAPID-sleutelpaar per omgeving. De privacyverklaring beschrijft wat er bewaard wordt (endpoint, sleutels, onderwerpen, tijdstip; geen naam) en hoe je eraf raakt.

## Capabilities and Constraints

- Astro 7 + Tailwind CSS v4 (`@theme`-tokens in `src/styles/global.css`), statische build op GitHub Pages met `base`-prefix via `src/lib/url.ts`.
- Geen backend; alle dynamiek is client-side fetch naar publieke API's.
- PWA-onderdelen: `src/data/pwa.ts` (naam, kleuren, precache-lijst), `src/pages/manifest.webmanifest.ts` (gegenereerd, volgt de base path), `src/sw/service-worker.js` (sjabloon) via `src/pages/sw.js.ts`, `src/sw/registration.js` (registratie + opruimen van vreemde workers, inline in de head), `/offline/` als vangnetpagina en `scripts/generate-icons.mjs` voor de iconen in `public/icons/`.
- Pushberichten: `src/data/push.ts` (endpoint, publieke VAPID-sleutel uit `PUBLIC_VAPID_PUBLIC_KEY`, de twee onderwerpen), `src/lib/push-client.ts` + `src/components/PushSettings.astro` (de vinkjes op `/club/pushberichten/`) en de push-handlers onderaan de service worker. Zonder sleutel staat het uit en verdwijnen de links ernaartoe. De verzendkant leeft in de Laravel-app, niet hier.
- De homepage-events-sectie moet gracieus kunnen wegvallen (bestaand gedrag behouden).
- **Beeldmateriaal (bevestigd):** er is één echte clubfoto (`src/assets/hero.jpg`, zaalactie). Het ontwerp mag ofwel een pad voorstellen dat op meer echte foto's rekent, ofwel een pad dat volledig zonder fotografie werkt; de huidige header op www.bclandegem.be is de bestaande referentie. Nooit stockbeelden of verzonnen clubfoto's presenteren als echt.

## Brand Commitments

- **Bindend (bevestigd):** het bestaande logo (`public/images/logo-bc1.svg`, monochroom zwart, shuttle-motief met clubnaam) en het clubrood `#eb4024`, op een zwart/wit-basis.
- Naam: "BC Landegem", voluit "Badmintonclub Landegem". Opgericht 1987.
- Toon: warm, nuchter, uitnodigend Vlaams ("sla je altijd raak", "spring gerust eens binnen") — geen corporate taal.
- Sponsors (Wema, Libertatem, Lieven Tyvaert) krijgen zichtbaarheid in de footer.

## Evidence on Hand

- Echte clubfoto: `src/assets/hero.jpg` (actie in de sporthal).
- Sponsorlogo's: `src/assets/sponsors/`.
- Clubgeschiedenis sinds 1987 met citaten van stichtend lid Herman (`/club/over-de-club/`).
- De oude site (www.bclandegem.be) heeft fotogalerijen (Media-sectie) — er bestaan dus echte clubfoto's die overgenomen kunnen worden.
- Geen testimonials of ledenaantallen vastgelegd; lidgeldbedragen staan nergens op de oude site — niet verzinnen.

## Product Principles

1. **Speeluren zijn de kern** — wanneer/waar er gespeeld wordt moet vanaf de homepage in één oogopslag te vinden zijn.
2. **Drempel verlagen** — elke wervende sectie eindigt in een concrete, vrijblijvende stap (proefbeurt of inschrijven).
3. **Echt boven mooi** — alleen echte data, echte foto's, echte geschiedenis; secties zonder inhoud verdwijnen stil.
4. **Beide publieken evenwaardig** — werving mag de snelle info voor leden nooit verdringen, en omgekeerd.
