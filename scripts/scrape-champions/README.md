# Kampioenstitels ophalen bij toernooi.nl

`scrape_champions.py` leest de clubstanden van **BC Landegem** op
[toernooi.nl](https://www.toernooi.nl): PBO-competitie en Vlaamse competitie.
Een ploeg die **eerste** eindigt in haar poule (met punten) telt als kampioen.

De winnaars zet je daarna zelf in `src/data/champions.csv` — die CSV stuurt de
tijdlijn op `/club/over-de-club/`. Er is geen live-ophaling op de site.

## Vereisten

Het enige script in deze repo dat niet in Node draait: toernooi.nl toont zijn
standen pas na JavaScript, vandaar Playwright.

- Python 3.10 of nieuwer
- [Playwright](https://playwright.dev/python/) met Chromium

```bash
pip install playwright
playwright install chromium
```

## Gebruik

Draai vanuit deze map (`scripts/scrape-champions/`), zodat de CSV's hier landen:

```bash
cd scripts/scrape-champions

# Volledige scrape (PBO + Vlaams), samengevoegd met de bestaande CSV's
python3 scrape_champions.py

# Alleen PBO of alleen de Vlaamse competitie
python3 scrape_champions.py --only pbo
python3 scrape_champions.py --only vlaams

# Proef: de eerste N seizoenen
python3 scrape_champions.py --limit 3

# Browser zichtbaar (om te debuggen)
python3 scrape_champions.py --headed --limit 1

# CSV's overschrijven in plaats van samenvoegen
python3 scrape_champions.py --replace
```

Een volledige run bezoekt veel seizoenspagina's en duurt een hele tijd. Het
script wacht tussen de pagina's; houd rekening met rate limiting op toernooi.nl.

## Uitvoer

| Bestand | Inhoud |
| --- | --- |
| `placements.csv` | Alle Landegem-ploegen met rang en punten |
| `champions.csv` | Deelverzameling met `won=True` (poule-eerste met punten) |

Kolommen: `season`, `league_id`, `team`, `poule`, `rank`, `points`, `won`,
`team_url`, `poule_url`, `standings_url`.

Standaard **voegt** het script nieuwe rijen samen met de bestaande CSV's
(zelfde `league_id` + `team` + `poule` wordt bijgewerkt). Met `--replace` begin
je opnieuw.

Beide bestanden staan buiten git (zie `.gitignore`). Wat op de site hoort,
kopieer je naar `src/data/champions.csv` — zelfde kolommen.

## Hoe het werkt

1. Zoekt seizoenen via de league-zoekpagina's (PBO / Vlaamse competitie), tot
   eind volgend jaar.
2. Per seizoen: clubs-pagina → club-id van Landegem (clubnummer 30050) → clubstand.
3. Elke Landegem-rij in `table.ruler` wordt een plaats; `won` als rang 1 en
   punten > 0.

## Site bijwerken

**Kijk de winnaars na voor je kopieert.** Het criterium "rang 1 met punten"
kent geen afgebroken seizoenen: in 2020-2021 (corona) stond Landegem 1D na één
wedstrijd eerste met 2 punten, en dat is geen titel. Zo'n rij haal je er met de
hand uit.

```bash
# Na een scrape: winnaars naar de site-CSV (controleer eerst de diff)
cp champions.csv ../../src/data/champions.csv
```

Of plak alleen de nieuwe rijen in `src/data/champions.csv`. De build leest dat
bestand via `src/lib/champions.ts`.
