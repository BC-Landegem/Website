# Landegem kampioenen scrapen

`landegem_kampioenen.py` haalt de clubstanden van **BC Landegem** op bij
[toernooi.nl](https://www.toernooi.nl): PBO-competitie en Vlaamse competitie.
Ploegen die **eerste** eindigen in hun poule (met punten) zijn kampioen.

De winnaars voed je daarna handmatig (of met een kopie) naar
`src/data/kampioenen.csv` — die CSV stuurt de tijdlijn op `/club/over-de-club/`.

## Vereisten

- Python 3.10+
- [Playwright](https://playwright.dev/python/) + Chromium

```bash
pip install playwright
playwright install chromium
```

## Gebruik

Draai vanuit deze map (`scripts/scraping_wins/`), zodat de CSV’s hier landen:

```bash
cd scripts/scraping_wins

# Volledige scrape (PBO + Vlaams), merge met bestaande CSV’s
python3 landegem_kampioenen.py

# Alleen PBO of alleen Vlaamse competitie
python3 landegem_kampioenen.py --only pbo
python3 landegem_kampioenen.py --only vlaams

# Proef: eerste N seizoenen
python3 landegem_kampioenen.py --limit 3

# Browser zichtbaar (debug)
python3 landegem_kampioenen.py --headed --limit 1

# CSV’s overschrijven i.p.v. mergen
python3 landegem_kampioenen.py --replace
```

Een volledige run bezoekt veel seizoenspagina’s en duurt een hele tijd. Houd
rekening met netwerk en eventuele rate limiting op toernooi.nl.

## Output

| Bestand | Inhoud |
| --- | --- |
| `landegem_plaatsen.csv` | Alle Landegem-ploegen met rank en punten |
| `landegem_kampioenen.csv` | Subset waar `won=True` (poule-eerste met punten) |

Kolommen: `season`, `league_id`, `team`, `poule`, `rank`, `points`, `won`,
`team_url`, `poule_url`, `standings_url`.

Standaard **merget** het script nieuwe rijen met bestaande CSV’s (zelfde
`league_id` + `team` + `poule` wordt bijgewerkt). Met `--replace` begin je
opnieuw.

Deze bestanden staan naast het script; commit ze niet per se. Wat op de site
hoort, kopieer je naar `src/data/kampioenen.csv` (zelfde kolommen).

## Hoe het werkt

1. Zoekt seizoenen via de league-zoekpagina’s (PBO / Vlaamse competitie).
2. Per seizoen: clubs-pagina → club-ID van Landegem → clubstand.
3. Elke Landegem-rij in `table.ruler` wordt een placement; `won` als rank 1 en
   punten > 0.

## Site bijwerken

```bash
# Na een scrape: winnaars naar de site-CSV (controleer eerst de diff)
cp landegem_kampioenen.csv ../../src/data/kampioenen.csv
```

Of plak alleen nieuwe rijen in `src/data/kampioenen.csv`. De build leest dat
bestand via `src/lib/kampioenen.ts`; geen live-API op de site.
