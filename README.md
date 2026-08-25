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
npm run build     # statische build naar dist/
npm run preview   # dist/ lokaal serveren zoals Pages het doet
```

> **Let op de base-prefix.** De site staat op GitHub Pages onder `/Website`, en
> Astro past die prefix ook in dev toe. De dev-server draait dus op
> <http://localhost:4321/Website/> — niet op de root. `http://localhost:4321/`
> geeft een 404; dat is verwacht gedrag, geen defect.

## Mappenstructuur

```
src/
  assets/       Afbeeldingen die door de build gaan (hero, sponsorlogo's)
  components/   Header, Footer en twee kleine bouwstenen
  data/         Alle inhoud die geen code is — zie "Inhoud aanpassen"
  layouts/      Layout.astro: de enige layout, draagt <head>, PWA en navigatie
  lib/          Logica: intraclub, kalender, media, de verloopgrafiek, en url()
  pages/        Eén bestand per route (plus twee endpoints: manifest en sw.js)
  styles/       global.css met de Tailwind @theme-tokens
  sw/           Broncode van de service worker en het opruimscript
public/         Wordt onaangeraakt gekopieerd (logo, iconen, favicons)
scripts/        Onderhoudsscripts die je met de hand draait — zie hieronder
.claude/        Projectconfiguratie voor Claude Code — zie "De README bijhouden"
```

## Inhoud aanpassen

Bijna alles wat verandert aan de club verandert in `src/data/` — geen componenten
aanraken.

| Wil je dit wijzigen | Bewerk | Wat er verandert |
| --- | --- | --- |
| Speeluren, sporthal, inschrijflink | `src/data/trainingen.json` | Homepage, `/jeugd/`, `/club/word-lid/` en de footer |
| Competitieploegen, seizoen | `src/data/teams.json` | `/competitie/` én de ploeglinks in de navigatie (`Header.astro`) |
| Sponsors | `src/data/sponsors.json` + logo in `src/assets/sponsors/` | De sponsorbalk in de footer |
| Fotoalbums | `src/data/media.ts` | `/media/` — pas na een sync, zie Databronnen |
| Kalenderbronnen en -kleuren | `src/data/kalender.ts` | `/kalender/` en de events op de homepage |
| App-naam, offline schil, snelkoppelingen | `src/data/pwa.ts` | Manifest en service worker (iconen genereer je apart) |
| Kleuren en typografie | `src/styles/global.css` (`@theme`) | De hele site |
| Losse tekst | De `.astro`-pagina zelf | Alleen die pagina |

## Databronnen

Vier bronnen leven buiten deze repo. Ze verschillen in *wanneer* ze opgehaald
worden en in *wat er gebeurt als ze falen* — dat verschil is bewust.

**Google Calendar** — geconfigureerd in `src/data/kalender.ts`, opgehaald in de
browser van de bezoeker. Faalt een bron of is ze leeg, dan wordt ze stil
genegeerd en verdwijnt de eventssectie op de homepage; de rest van de pagina
blijft staan. De sleutel in dat bestand is een publieke, referrer-restricted
browser-key: die hoort in de broncode. Roteer je hem, zet de referrer-restrictie
dan mee — zonder restrictie is het geen publieke sleutel meer.

**Google Photos** — de gecureerde albumlijst staat in `src/data/media.ts`, de
foto's zelf blijven bij Google. De nachtelijke workflow `media-sync.yml` leest de
publieke share-pagina's uit en schrijft `src/data/media.json`; de build leest
alleen dat bestand en praat nooit met Google. Breekt de scrape, dan blijft de
vorige data staan, kleurt de workflow rood en draait de site gewoon door. Een
foto van de site halen doe je in het Google Photos-album zelf.

**Intraclub-API** — `src/lib/intra.ts` roept
`https://www.bclandegem.be/intra-app/api/index.php` aan vanuit de browser. Die
API draait op het oude domein: verdwijnt hij, dan vallen de intraclub-pagina's
stil. Houd daar rekening mee bij de domeinswitch (zie PRODUCT.md).
`/intraclub/zo-werkt-het/` is de uitzondering — die draait op een bevroren
snapshot in `src/data/intraclub-voorbeeld.json` en doet geen enkel request.

**Twizzit** — het inschrijfformulier is één externe link in
`src/data/trainingen.json`. Geen integratie, geen sleutel.

## Scripts

Handmatig te draaien, geen onderdeel van de build. Elk script legt in zijn kop
uit waarom het bestaat en wanneer je het opnieuw draait.

```bash
node scripts/genereer-iconen.mjs   # PWA-iconen uit het logo — na een logo- of kleurwijziging
node scripts/scrape-media.mjs      # media.json lokaal bijwerken (doet de workflow 's nachts ook)
node scripts/intra-snapshot.mjs    # nieuw voorbeeld voor /intraclub/zo-werkt-het/
```

## Bouwen en deployen

Een push naar `master` start `deploy.yml`: Astro bouwt en GitHub Pages
publiceert. Geen handmatige stap, geen secrets.

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
  `genereer-iconen.mjs` opnieuw.
- **Service workers houden vast.** Test je de PWA lokaal, ruim dan af en toe je
  registratie op in DevTools → Application; anders debug je een oude cache.

## De README bijhouden

Dit bestand raakt achterop zodra iemand de data, de scripts of de config wijzigt
zonder hier te kijken. `.claude/hooks/readme-actueel.mjs` vangt dat op: het draait
als Stop-hook van Claude Code en meldt het wanneer een bewaakt bestand wijzigde
terwijl README.md ongemoeid bleef.

Bewaakt worden `src/data/`, `scripts/`, `.github/workflows/`, `astro.config.mjs`,
`package.json`, `src/lib/url.ts`, `src/lib/intra.ts` en `src/styles/global.css`.
Bewust niet: `src/pages/` en `src/components/` (de README somt geen pagina's op),
en de twee gegenereerde bestanden `media.json` en `intraclub-voorbeeld.json`.

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
