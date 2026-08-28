# BC Landegem — clubwebsite

De clubwebsite van Badmintonclub Landegem: een statische site gebouwd met
[Astro](https://astro.build) 7 en Tailwind CSS v4, gehost op GitHub Pages.

Live: <https://bc-landegem.github.io/Website/> — de opvolger van www.bclandegem.be.

Deze README beschrijft **hóe** de site werkt en hoe je eraan werkt. Het **waarom**
— doelgroepen, context en de redenering achter de keuzes — staat in
[PRODUCT.md](PRODUCT.md); het ontwerpsysteem (kleuren, typografie, componenten)
in [DESIGN.md](DESIGN.md).

## Aan de slag

Je hebt **Node 22.18 of nieuwer** nodig. Niet zomaar een ondergrens:
`scripts/scrape-media.mjs` importeert een `.ts`-bestand rechtstreeks en leunt dus
op type stripping. De workflows draaien op Node 24.

```bash
npm install
npm run dev       # dev-server met hot reload
npm run build     # statische build naar dist/, daarna de zoekindex
npm run preview   # dist/ lokaal serveren zoals Pages het doet
```

> **`npm run build` doet twee dingen.** Na `astro build` draait `pagefind --site dist`
> over de gebouwde HTML en schrijft de zoekindex naar `dist/pagefind/`. In dev
> bestaat die index dus niet en zegt het zoekveld op `/archief/` dat gewoon;
> zoeken testen doe je met `npm run build && npm run preview`.

> **De build haalt data op en duurt daardoor ~2 minuten.** De intraclub-historiek
> (erelijst, seizoenen, speeldagen, loopbanen, records) wordt bij het bouwen uit
> de API gehaald in plaats van in de browser. Zonder netwerk faalt de build; zie
> "Databronnen · Intraclub-API".

> **Let op de base-prefix.** De site staat op GitHub Pages onder `/Website`, en
> Astro past die prefix ook in dev toe. De dev-server draait dus op
> <http://localhost:4321/Website/> — niet op de root. `http://localhost:4321/`
> geeft een 404; dat is verwacht gedrag, geen defect. Blijf ook op **4321**: dat
> is het enige lokale origin dat de intraclub-API toelaat.

## Mappenstructuur

```
src/
  assets/       Afbeeldingen die door de build gaan (hero, sponsorlogo's)
  components/   Header, Footer en kleine bouwstenen (o.a. het archiefzoekveld)
  content/      archief/: 837 markdownbestanden uit de oude Joomla-site
  data/         Alle inhoud die geen code is — zie "Inhoud aanpassen"
  layouts/      Layout.astro: de enige layout, draagt <head>, PWA en navigatie
  lib/          Logica: intraclub, kalender, media, de verloopgrafiek, en url()
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
| Sponsors | `src/data/sponsors.json` + logo in `src/assets/sponsors/` | De sponsorbalk in de footer |
| Fotoalbums | `src/data/media.ts` | `/media/` én de fotostrook op de homepage — pas na een sync, zie Databronnen |
| Facebook-/Instagram-links | `src/data/social.ts` | De knoppen "Volg de club" in de footer — leeg = het blok verdwijnt |
| Kalenderbronnen en -kleuren | `src/data/calendar.ts` | `/kalender/` en de events op de homepage |
| App-naam, offline schil, snelkoppelingen | `src/data/pwa.ts` | Manifest en service worker (iconen genereer je apart) |
| Kleuren en typografie | `src/styles/global.css` (`@theme`) | De hele site — voor het clubrood eerst het kleurlab, zie hieronder |
| Losse tekst | De `.astro`-pagina zelf | Alleen die pagina |

## Databronnen

Vijf bronnen leven buiten deze repo. Ze verschillen in *wanneer* ze opgehaald
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
  alles wat bevroren is: de erelijst, 17 seizoenspagina's, 275 speeldagpagina's,
  256 loopbaanpagina's en de clubrecords. Nul fetches in de browser, meteen
  indexeerbaar, leesbaar zonder netwerk. Die module cachet per pad binnen één
  build en haalt met acht tegelijk op; de zware antwoorden gaan bewust langs de
  cache heen zodat niet het hele archief tegelijk in het geheugen staat.

`/intraclub/zo-werkt-het/` is de uitzondering op allebei — die draait op een
bevroren snapshot in `src/data/intraclub-example.json` en doet geen enkel request.

> **CORS is per origin.** De API laat `http://localhost:4321` en
> `https://bc-landegem.github.io` toe. Draai je de dev-server of preview op een
> andere poort, dan faalt elke browsercall met `net::ERR_FAILED` en zegt de
> pagina "De standen konden niet geladen worden" — dat lijkt op een codefout maar
> is er geen. Bij de domeinswitch moet het nieuwe origin bij
> `CORS_ALLOWED_ORIGINS` aan de kant van de API.

**Twizzit** — het inschrijfformulier is één externe link in
`src/data/trainings.json`. Geen integratie, geen sleutel.

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
```

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

## Bouwen en deployen

Een push naar `master` start `deploy.yml`: Astro bouwt en GitHub Pages
publiceert. Geen handmatige stap, geen secrets — wel één omgevingsvariabele,
`PUBLIC_INTRA_API`, die in de workflow staat.

> **De build praat met de intraclub-API.** De historiekpagina's worden gebouwd,
> niet opgehaald in de browser, dus doet één build ruim vijfhonderd verzoeken en
> duurt hij ongeveer twee minuten. Ligt `intra.bclandegem.be` plat, dan faalt de
> deploy — met opzet: een halve historiek is erger dan geen deploy. Er zit een
> herkansing op elk verzoek voor losse haperingen.

`media-sync.yml` draait elke nacht om 03:00 UTC — in de winter 4u, in de zomer 5u Belgische tijd (en kan met de hand via Actions). Vindt
hij nieuwe foto's, dan commit hij `src/data/media.json` en **start hij zelf een
deploy** — nodig, omdat een push met het standaard `GITHUB_TOKEN` geen andere
workflows triggert.

## Valkuilen

- **`src/data/media.json` bewerk je nooit met de hand.** Het is uitvoer van de
  scrape en wordt bij de volgende sync overschreven. Wijzig `media.ts` of het
  Google Photos-album.
- **Interne links altijd via `url()`** uit `src/lib/url.ts`. Een hardgecodeerde
  `/kalender/` werkt lokaal en breekt op Pages, waar alles onder `/Website/`
  hangt.
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
  toe (en dat van Pages). `--port 4322` geeft `net::ERR_FAILED` op elke call — een
  CORS-weigering, geen bug in de site.
- **Seizoenspagina's verschijnen pas als het seizoen niet meer loopt.** De API
  blijft een afgesloten seizoen maandenlang `current` noemen; `intra-build.ts`
  leidt uit de datum van de laatste berekende speeldag af of het écht nog loopt.
  Zolang dat zo is, leeft die stand op `/intraclub/` en wordt er geen bevroren
  kopie gebouwd.
- **Het archief is niet volledig, en dat is zichtbaar.** Van 2009-2013 is per
  speeldag niets bewaard dan de datum, en van 2013-2023 alleen het gemiddelde —
  geen plaats, geen dagscore. De pagina's laten die kolommen dan weg in plaats van
  ze met streepjes te vullen. Ook `ranking` staat er maar één keer per persoon en
  niet per seizoen: daarom draagt de erelijst wél een dameslijn en géén
  recreantenlijn.

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
