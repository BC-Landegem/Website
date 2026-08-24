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

- **www.bclandegem.be is de échte, huidige website** (bevestigd door de opdrachtgever); deze repo is de vervanger in opbouw. De oude site heeft naast de secties van deze repo ook een Media-sectie (fotogalerijen) en een nieuws-/aankondigingenstroom (bv. "Open speeldag", "5-delige lessenreeks voor nieuwkomers & recreanten — gratis voor leden, €25 voor niet-leden, verrekend met het lidgeld"), plus een contact-e-mailadres (info@…). Zulke aankondigingen zijn het soort inhoud dat de nieuwe site moet kunnen dragen.
- Vijf vaste speelmomenten per week (ma/wo/za/zo) in Sporthal Oostbroek; brondata in `src/data/trainingen.json`.
- Inschrijven gebeurt via een extern Twizzit-formulier (link in trainingen.json).
- Events komen live uit een publieke Google Calendar (`src/data/kalender.ts`); de events-sectie op de homepage blijft verborgen als er niets gepland is of de API faalt.
- Intraclub-standen worden apart getoond (`/intraclub/`).
- Site is statisch (Astro, GitHub Pages) en volledig Nederlandstalig (nl-BE).

## Capabilities and Constraints

- Astro 7 + Tailwind CSS v4 (`@theme`-tokens in `src/styles/global.css`), statische build op GitHub Pages met `base`-prefix via `src/lib/url.ts`.
- Geen backend; alle dynamiek is client-side fetch naar publieke API's.
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
