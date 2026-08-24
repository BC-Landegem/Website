---
name: BC Landegem — De Shuttle
description: Clubwebsite opgebouwd uit de anatomie van de shuttle — kurk, rode band, verenkrans en vluchtbaan.
colors:
  club-500: "#eb4024"
  club-600: "#d03117"
  club-700: "#a72713"
  club-800: "#7d1d0e"
  club-400: "#ee6a54"
  club-300: "#f19486"
  club-100: "#fbdfda"
  club-50: "#fdf1ef"
  veer-50: "#faf7f1"
  veer-100: "#f2ecdf"
  veer-200: "#e6dcc8"
  inkt-950: "#1b1410"
  inkt-700: "#493c33"
  inkt-500: "#6b5c50"
  kurk-400: "#cf9a5f"
  kurk-300: "#ddb887"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontWeight: 900
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  baan:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 110"
  cijfer:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontWeight: 800
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 112"
    fontFeature: "tabular-nums"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  scherp: "0px"
  focus: "2px"
  vol: "9999px"
spacing:
  container-pad: "1rem"
  sectie: "5rem"
  sectie-ruim: "6rem"
  rail-inspring: "2.5rem"
components:
  knop-primair:
    backgroundColor: "{colors.club-500}"
    textColor: "#ffffff"
    typography: "{typography.baan}"
    rounded: "{rounded.vol}"
    padding: "0.875rem 1.75rem"
  knop-primair-hover:
    backgroundColor: "{colors.club-600}"
  knop-omtrek:
    backgroundColor: "transparent"
    textColor: "{colors.inkt-950}"
    typography: "{typography.baan}"
    rounded: "{rounded.vol}"
    padding: "0.75rem 1.75rem"
  knop-invers:
    backgroundColor: "#ffffff"
    textColor: "{colors.club-600}"
    typography: "{typography.baan}"
    rounded: "{rounded.vol}"
    padding: "0.875rem 1.75rem"
  kurk-cta:
    backgroundColor: "{colors.club-500}"
    textColor: "#ffffff"
    typography: "{typography.baan}"
    rounded: "{rounded.vol}"
    size: "9rem"
---

# Design System: BC Landegem — De Shuttle

<!-- Substitutie: dit document is inline geschreven door de Impeccable-documenterrol (geen subagent-harness); grondwaarheid is de gebouwde code, niet het plan. -->

## Overview

**Creative North Star: "De Shuttle"**

De site is opgebouwd uit de anatomie van de veren shuttle — kurk, rode band, verenkrans, vluchtbaan — en weigert bewust de standaard clubsite van fotohero plus kaartengrid. Elk visueel middel is een shuttle-onderdeel: het kurkpunt linksonder in de hero draagt de primaire actie ("Word lid!"), de rode band is een full-bleed rode sectie met dikke donkerrode randen, de verenkrans is radiale vlakgeometrie op een strak raster, en één doorlopende rode vluchtlijn draagt echte data (speeluren, events, 1987) als meetpunten.

De wereld is warm en nuchter, zoals de dorpsclub zelf: veerwit (#faf7f1) als grond, warm inktzwart (bruinzwart, geen koolzwart) als basis, clubrood #eb4024 dat hele banen bezit, kurk-beige als zeldzaam accent. Eén lettertype (Archivo variabel) over drie breedtes doet al het typografische werk. Vlakken zijn scherp gesneden (clip-path), lijnen zijn getekend, en beweging volgt shuttlevlucht-fysica: explosief lanceren, beslist neervallen.

De browser draagt de wereld mee: selectie is clubrood met wit, de caret is clubrood, de scrollbalk is inkt op veer, focusringen zijn 2px clubrood met 3px offset.

**Key Characteristics:**
- Grafisch in plaats van fotografisch: geometrie uit de shuttle, één echte clubfoto in het zwarte slot.
- Eén doorlopende rode draad (4px, clubrood) die echte data als meetpunten draagt.
- Clubrood bezit hele banen (secties, panelen), nooit versnipperd als decoratie.
- Eén familie, drie breedtes: Archivo expanded display, baan-labels, tabulaire cijfers.
- Rasterdiscipline: 12-kolomsraster met bewuste verspringing, geen gelijke kaartengrids.
- Beweging als shuttlevlucht: van boven, kort, beslist — en volledig optioneel (JS- en reduced-motion-gegate).

## Colors

Warm drieklank: veerwit als grond, warm inktbruinzwart als basis, clubrood dat hele banen bezit, kurk als zeldzaam derde accent.

### Primary
- **Clubrood** ({colors.club-500}): het bindende merkrood. Bezit hele banen: de rode band-sectie, het kurk-CTA-punt, de vluchtdraad (stroke 4px), de meetpuntbollen, primaire knoppen, actieve nav-onderstreping, ::selection en caret.
- **Clubrood diep** ({colors.club-600}): hover-toestand van primaire knoppen en tekstlinks op lichte grond; tekstkleur van de inverse knop op rood.
- **Clubrood donker** ({colors.club-700}): kleine rode tekst op lichte gronden (baan-labels, "Ontdek meer"-links) én de dikke randen (8px) van de rode band. Contrastregel, zie hieronder.
- **Clubrood zeer donker** ({colors.club-800}): hover van kleine rode tekstlinks.
- **Clubrood licht** ({colors.club-300}): rode accenten op donkere (inkt) grond — hoverkleur van links en koppen op inkt-950.
- **Clubrood pastel** ({colors.club-100} / {colors.club-50}): gevulde veer in de verenkrans (100, op lage opaciteit); hovergrond van de inverse knop (50).

### Secondary
- **Kurk** ({colors.kurk-400}): de kurkring rond het CTA-punt (ring-4 met veer-50 offset) en de kurkdop van de getekende shuttle-glyph. Zeldzaam en fysiek: kurk verschijnt alleen waar de echte shuttle kurk heeft.
- **Kurk licht** ({colors.kurk-300}): gevulde veer in de verenkrans, op lage opaciteit (0.35).

### Neutral
- **Veerwit** ({colors.veer-50}): de grond van de hele site (body-achtergrond) en de ring rond meetpuntbollen; tekstkleur op inkt-950.
- **Veer** ({colors.veer-100}): hovergrond in de navigatie; scrollbalkspoor.
- **Veer diep** ({colors.veer-200}): het lichtste veerpaneel (Competitie), tekst op inkt-950 (footer), gevulde veer in de verenkrans.
- **Inktzwart** ({colors.inkt-950}): warm bruinzwart. Alle basistekst, donkere panelen (Jeugd-veer, slotsectie, footer), hairlines op 6–10% opaciteit (borders, verenkrans-stralen).
- **Inkt** ({colors.inkt-700}): lopende tekst met iets minder nadruk (intro's, paragrafen naast koppen).
- **Inkt licht** ({colors.inkt-500}): tertiaire tekst (doelgroep-regels, locatieregels), scrollbalkduim.

### Named Rules
**De hele-baan-regel.** Clubrood bezit hele banen: een volledige sectie, een volledig paneel, de volledige draad. Rood verschijnt nooit als klein decoratief strooisel — de enige kleine rode elementen zijn functioneel (meetpuntbollen op de draad, de actieve nav-streep) en horen bij de draadgrammatica.

**De kleine-letter-regel.** Kleine rode tekst (baan-labels, tekstlinks, cijfers ≤ text-lg) op lichte grond gebruikt club-700, nooit club-500 — club-500 haalt op veerwit onvoldoende contrast voor kleine tekst. Wit op club-500 is alleen toegestaan voor grote/vette tekst (display-koppen, baan-knoppen, tekst ≥ text-xl bold); gewone lopende tekst op een rood vlak is inkt-950 (zoals op het Recreatief-veerpaneel). Op inkt-950 is de rode accentkleur club-300.

## Typography

**Display Font:** Archivo (variabel, wdth 62–125, wght 300–900; fallback ui-sans-serif, system-ui, "Segoe UI", sans-serif)
**Body Font:** Archivo (zelfde familie)
**Label/Cijfer Font:** Archivo (zelfde familie, andere breedte)

**Character:** Eén familie, drie breedtes — sportief, direct en zonder franje. De stemmen verschillen in `font-variation-settings: "wdth"`, niet in familie. Geladen via Google Fonts als variabel font (`Archivo:wdth,wght@62..125,300..900`).

### Hierarchy
- **Display** (`.stem-display`: wdth 125, weight 900, uppercase, letter-spacing -0.02em, line-height 0.95, text-wrap balance): alle sectiekoppen en de hero-kop. Grootte per context: hero text-5xl→7xl, sectiekoppen text-4xl/5xl, paneelkoppen text-3xl/4xl, compacte chroomkoppen (bv. de kalender-maandtitel) text-2xl (1.5rem).
- **Baan** (`.stem-baan`: wdth 110, weight 700, uppercase, letter-spacing 0.08em): labels en knoppen — dag-labels op de speelurenrail, alle knopteksten, navigatiekopjes, footerkopjes, "Ontdek meer"-links. Vrijwel altijd text-xs of text-sm.
- **Cijfer** (`.stem-cijfer`: wdth 112, weight 800, tabular-nums, letter-spacing -0.01em): alle data op de draad — speeluren (text-2xl/3xl), eventdatums (text-lg), het jaartal 1987 (text-2xl), het eerstvolgende speelmoment. Tabulaire cijfers zodat uren op de rail uitlijnen.
- **Body** (weight 400–500, text-sm–lg, leading-relaxed): lopende tekst in inkt-950 of inkt-700; nadruk met weight 700 (`font-bold`), nooit met een extra kleur.

### Named Rules
**De drie-stemmen-regel.** Elke tekst is één van vier dingen: display-kop, baan-label, cijfer of lopende tekst. Nieuwe tekstsoorten worden op een van deze vier gemapt; er komt geen vierde stem bij.

**De geen-kicker-regel.** Boven een display-kop staat nooit een kicker/eyebrow-label. De kop draagt zichzelf; context komt uit de paragraaf eronder of uit de draad ernaast.

## Layout

- **Container:** `max-w-6xl mx-auto px-4` (72rem) voor alle inhoud, ook binnen full-bleed banen. Secties ademen met py-20 (5rem) tot py-24 (6rem).
- **Paginaritme (homepage als referentie):** hero (min-h-[88vh], verenkrans vanuit het kurkpunt linksonder) → full-bleed rode band → speelurenrail → events-rail (verdwijnt stil bij leegte) → drie veerpanelen → stille 1987-regel → zwart slot met foto. Licht en donker wisselen; de draad naait de secties aaneen.
- **De draad- en railgrammatica (de kern van de wereld):**
  - De **vluchtdraad** is één `<path>` (stroke clubrood, 4px, round linecap) in een absoluut gepositioneerde SVG achter de inhoud (`-z-[1]`), van het kurkpunt via de shuttle-glyph naar de speelurenrail, langs 1987 tot de slotsectie; een tweede **staartpad** leeft ín de slotsectie (boven de zwarte grond) en landt op de foto. Hij wordt met de scroll getekend (stroke-dasharray/-offset, geactiveerd tot 85% viewporthoogte) en na een resize herbouwd.
  - De **rail-x** ligt op de linkerrand van de lijst + 6px; lijstitems krijgen `pl-10` (2.5rem inspringing) en een **meetpuntbol**: `h-3.5 w-3.5 rounded-full bg-club-500 ring-4 ring-veer-50`, absoluut op `left-[6px] -translate-x-1/2`. Rijen scheiden met hairlines (`border-b border-inkt-950/10`, eerste rij ook border-t).
  - **Een pagina zonder script gebruikt statische rails:** dezelfde bollen en inspringing, met desnoods een statische verticale lijn (border-l of een vaste SVG-lijn) op de rail-x — de scroll-getekende draad is exclusief voor pagina's die het script dragen. Zonder JavaScript is er geen draad, maar alle inhoud blijft volledig zichtbaar en de bollen blijven staan.
- **Rasterdiscipline met verspringing:** de veerpanelen staan op een 12-kolomsraster (`grid-cols-12`) met bewuste overlap: col-span-7/5/6 met verschillende col-start en negatieve topmarges (sm:-mt-12, sm:-mt-8) zodat ze elkaar als veren overlappen. Nooit drie gelijke kolommen naast elkaar.
- **Responsief:** mobiel stapelt alles op col-span-12 (of col-span-11 met kleine inspringing); de speelurenrij wordt op ≥sm een `grid-cols-[8rem_16rem_1fr]` baseline-grid; de navigatie klapt onder md samen in een checkbox-gestuurd hamburgermenu (geen JS nodig); de hero-SVG is `w-[max(100%,75rem)]` zodat de verenkrans op smalle schermen niet verschrompelt en het kurkpunt via `calc(max(100%,75rem)/18)` op de geometrie blijft zitten.
- **Motoriek (hoort bij de wereld):** twee easings — `--ease-lancering` (cubic-bezier(0.16,1,0.3,1): explosief uit, dan hangen; voor verschijnen, hover-lifts, schaal) en `--ease-drop` (cubic-bezier(0.55,0,0.55,1): de val; voor de transform van landende elementen). Elementen dalen neer als een shuttle: `.vlucht` start op `opacity:0; translateY(-1.25rem)` en landt (`.geland`, gezet door een IntersectionObserver op threshold 0.2) in 0.45s/0.6s. Dit alles is dubbel gegate: achter een `.js`-klasse op `<html>` (inline gezet in de head — zonder JS is alles gewoon zichtbaar) én achter `prefers-reduced-motion: no-preference`. Bij reduced motion wordt de draad niet getekend maar volledig getoond. Hovers zijn kort en fysiek: `hover:-translate-y-2` op panelen, `hover:translate-x-2` op railrijen, `hover:scale-110` op het kurkpunt, pijlen schuiven 1 eenheid mee (300ms, ease-lancering).

## Elevation & Depth

Vlak. De wereld gebruikt geen schaduwen als ontwerpmiddel: diepte komt uit kleurbanen (licht/donker/rood wisselend), overlappende clip-path-panelen met negatieve marges, rotatie, en de draad die vóór of achter inhoud loopt (z-index, niet schaduw). De enige toegestane schaduw is functioneel chroom: `shadow-lg` op het uitklapmenu van de navigatie (mobiel paneel en desktop-dropdown), zodat het menu zich van de pagina losmaakt. Introduceer geen nieuwe schaduwen op inhoudselementen; til een element bij hover op met transform, niet met schaduw.

## Shapes

- **Scherp gesneden vlakken (0px):** secties en panelen hebben geen border-radius. Veerpanelen en de slotfoto worden schuin afgesneden met `clip-path: polygon(...)` — één of twee randen hellen 8–10% (bv. `polygon(0 10%, 100% 0, 100% 100%, 0 100%)`), als veerbladen. Elk veerpaneel roteert licht en afwisselend van teken: -1° / 1.25° / -0.75°; blijf binnen ±1.5°.
- **Volrond (9999px) voor alles wat een shuttle-onderdeel is:** knoppen (pillen), het kurk-CTA-punt (cirkel, 7rem mobiel / 9rem ≥sm, kurkring eromheen), meetpuntbollen, de statuspunt van het eerstvolgende speelmoment.
- **Hairlines:** scheidingslijnen zijn inkt-950 op 10% opaciteit (1px); de verenkrans-stralen 1.5px op 8–10%; de skirtbogen gestreepte cirkels (stroke-dasharray "3 10" / "3 14") op 6–8%.
- **Getekende geometrie:** de verenkrans is code-berekende SVG (16 stralen vanuit het kurkpunt, drie gevulde veerdriehoeken op lage opaciteit, twee gestreepte skirtbogen); de shuttle-glyph is een handgetekend SVG-pad met kurkdop (kurk-400), rode band (club-500) en verenkrans (veer-50, inkt-outline 2px).
- **Focus:** 2px clubrood outline, 3px offset, 2px radius — overal, gedefinieerd op `:focus-visible`.

## Components

### Buttons
Alle knoppen zijn `.stem-baan`-pillen; ze veranderen bij hover alleen van kleur (300ms), nooit van vorm.
- **Shape:** volrond (rounded-full).
- **Primair:** clubrood ({colors.club-500}) met witte tekst, px-7 py-3.5; hover {colors.club-600}. Op donkere grond (slot): hover wordt lichter ({colors.club-400}).
- **Omtrek:** transparant met 2px inkt-950-rand en inkt-950-tekst, px-7 py-3; hover: rand en tekst naar club-600. Op donkere grond: rand veer-200/40, tekst veer-50; hover rand club-400, tekst club-300.
- **Invers (op rode band):** witte grond, club-600-tekst; hover club-50-grond.
- **Kurk-CTA (signatuur, alleen hero):** cirkel van 7rem (≥sm 9rem), clubrood, witte baan-tekst, `ring-4 ring-kurk-400 ring-offset-4 ring-offset-veer-50`, verankerd op het kurkpunt van de verenkrans; hover `scale-110` met ease-lancering.

### Cards / Containers
- **Veerpanelen (signatuur):** géén gelijke kaarten. Schuin geknipte, licht geroteerde, overlappende vlakken op het 12-kolomsraster; elk paneel een andere kleurbaan (inkt-950 met veer-50-tekst / club-500 met inkt-950-bodytekst en witte kop / veer-200 met inkt-950-tekst). Interne padding p-8 (≥sm p-10). Het hele paneel is de link; hover tilt het op (-translate-y-2, ease-lancering) en kleurt de kop (op inkt: naar club-300).
- **Rode band:** full-bleed sectie in club-500 met `border-y-8 border-club-700`, display-kop in wit, vette witte subregel (text-xl bold), inverse knop rechts. Eén per pagina, hooguit.
- **Zwart slot:** inkt-950-sectie met veer-50/veer-200-tekst, twee knoppen (primair + omtrek-donker) en de clubfoto in een clip-path-figuur; de draadstaart landt op de foto.

### Lijsten op de rail
- **Railrij (speeluren, events):** pl-10, meetpuntbol op de rail-x, hairline-scheiding, `stem-baan`-daglabel in club-700, `stem-cijfer`-uren in inkt-950, omschrijving bold met doelgroep in inkt-500. Hover: de rij-inhoud schuift 2 eenheden naar rechts; de bol blijft op de draad en schaalt 125%. Sectiekoppen en intro's boven een rail-lijst staan mee op de rail-inspringing (pl-10), zodat de draad links van de letters loopt.
- **Stille regel (1987):** één railpunt zonder lijst — bol, cijfer, één paragraaf, één baan-link. Voor enkelvoudige feiten op de draad.

### Navigation
- **Header:** sticky, veer-50 op 95% met backdrop-blur, hairline onderrand. Logo (monochroom zwart SVG) + clubnaam in stem-baan. Links: text-sm font-semibold, hover naar club-600; actief: `border-b-2 border-club-500` + club-600-tekst. "Word lid!" staat als primaire pil rechts in de nav. Mobiel: checkbox-hamburger (CSS-only) met uitklappaneel; submenu Club op desktop als hover/focus-within-dropdown op veer-50.
- **Footer:** inkt-950 met veer-200-tekst; sponsorlogo's op veer-50-tegels (hover: ring-2 club-500); kolomkopjes in stem-baan wit; links hoveren naar club-300.

### Iconen
Iconen zijn altijd inline getekende SVG's (stroke currentColor, stroke-width 2–2.5, round caps), 16–24px: hamburger/kruis, chevron, en de pijl `M4 12h16m0 0l-6-6m6 6l-6 6`. Pijlen bewegen mee met hover (translate-x-1).

## Do's and Don'ts

### Do:
- **Do** laat elke nieuwe pagina met echte tijdsdata (uren, datums, standen) op de rail aansluiten: pl-10, meetpuntbollen (h-3.5 w-3.5, club-500, ring-4 veer-50) op de rail-x, hairline-rijen, stem-cijfer voor de data. Zonder eigen script: statische rail, geen scroll-draad.
- **Do** geef clubrood hele banen (een rode band-sectie of een rood paneel) en gebruik club-700 voor alle kleine rode tekst op lichte grond.
- **Do** gate alle beweging dubbel: achter `.js` op `<html>` én `prefers-reduced-motion`; gebruik uitsluitend --ease-lancering en --ease-drop en houd de duur ≤ 0.6s.
- **Do** snijd panelen met clip-path (8–10% helling) en roteer ze licht (±1.5°, afwisselend teken) op het 12-kolomsraster met bewuste overlap.
- **Do** laat lege secties stil verdwijnen (hidden tot data er is), zoals de events-sectie — echt boven mooi.

### Don't:
- **Don't** zet kickers of eyebrow-labels boven koppen; de display-kop draagt zichzelf.
- **Don't** bouw gelijke kaartengrids (drie identieke kolommen met dezelfde kaart) — dit is de wereld die de site expliciet weigert.
- **Don't** gebruik unicode-tekens als iconen (→, ▸, ✓, •) — pijlen en iconen zijn getekende inline SVG's.
- **Don't** zet witte tekst kleiner dan text-xl op club-500, en gebruik nooit club-500 voor kleine tekst op veerwit (neem club-700); lopende tekst op rood is inkt-950.
- **Don't** voeg schaduwen toe aan inhoud of foto's; diepte komt uit kleurbanen, overlap en transform.
- **Don't** introduceer een tweede lettertype of een vierde typestem; alles is Archivo in drie breedtes.

---

*Status van de migratie: alle pagina's leven in De Shuttle. De paginakop op de statische rail (bol + korte vaste draad + eindpunt) is een component: `src/components/RailKop.astro`; contentblokken eronder staan mee op de rail-inspringing (pl-10). De kalender toont hoe chroom van derden (FullCalendar) de wereldtokens overneemt: baan-pillen als knoppen, display-maandtitel, club-700 dagkoppen, tabulaire dagcijfers, hairline-raster. De intraclub-paginas tonen de datagrammatica: stem-baan tabelkoppen in club-700, stem-cijfer cellen, SVG-driehoekjes voor stijgen/dalen (dalen = club-700, stijgen = inkt-950), laden als pulserende meetpuntbol, fouten als scherp club-50-vlak met club-500-rand. Lopende tekst is handgezet (space-y-4, inkt-700, links in club-700 met underline) — de prose-plugin is geen onderdeel van de wereld en PageHeader.astro is verwijderd.*
