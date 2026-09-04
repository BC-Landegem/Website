#!/usr/bin/env python3
"""Find BC Landegem poule winners across PBO and Vlaamse Competitie seasons.

For each season in the league searches, look up LANDEGEM BC on the clubs page,
then read club standings. Teams ranked 1 in their poule (with points) are winners.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import TimeoutError as PwTimeout
from playwright.sync_api import sync_playwright

BASE = "https://www.toernooi.nl"
SEARCHES = [
    {
        "name": "pbo",
        "url": (
            f"{BASE}/find/league"
            "?Q=pbo+competitie+20"
            "&StartDate=2001-01-01"
            "&EndDate=2026-12-04"
            "&StatusFilterID=false"
            "&SportID=2"
        ),
        "title_re": r"pbo.*competitie|competitie.*pbo",
    },
    {
        "name": "vlaams",
        "url": (
            f"{BASE}/find/league"
            "?Q=vlaamse+competitie"
            "&StartDate=2013-01-01"
            "&EndDate=2026-12-04"
            "&StatusFilterID=false"
            "&SportID=2"
        ),
        "title_re": r"vlaamse.*competitie|competitie.*vlaams",
    },
]
PAUSE = 0.4
PLAATSEN_CSV = "landegem_plaatsen.csv"
KAMPIOENEN_CSV = "landegem_kampioenen.csv"
CSV_FIELDS = [
    "season",
    "league_id",
    "team",
    "poule",
    "rank",
    "points",
    "won",
    "team_url",
    "poule_url",
    "standings_url",
]


@dataclass
class Placement:
    season: str
    league_id: str
    team: str
    poule: str
    rank: int
    points: str
    won: bool
    team_url: str
    poule_url: str
    standings_url: str


def accept_cookies(page) -> None:
    page.wait_for_timeout(400)
    btn = page.get_by_role("button", name=re.compile(r"Akkoord|Accept", re.I))
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(400)
        return
    loc = page.locator("button").filter(has_text=re.compile(r"akkoord|accept", re.I))
    if loc.count():
        loc.first.click()
        page.wait_for_timeout(400)


def goto(page, url: str) -> bool:
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        accept_cookies(page)
        page.wait_for_load_state("networkidle", timeout=15000)
        return True
    except PwTimeout:
        print(f"  timeout: {url}", file=sys.stderr)
        return False


def collect_leagues(page, search_url: str, title_re: str, label: str) -> list[tuple[str, str]]:
    """Return (league_id, title) in search-result order."""
    found: dict[str, str] = {}
    order: list[str] = []
    page_no = 1
    empty = 0

    while page_no <= 10:
        url = f"{search_url}&page={page_no}"
        if not goto(page, url):
            break
        page.wait_for_timeout(800)

        hits = page.evaluate(
            """(titleRe) => {
              const out = [];
              const seen = new Set();
              const guid = /[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/;
              const title = new RegExp(titleRe, 'i');
              for (const a of document.querySelectorAll('a[href]')) {
                const href = a.getAttribute('href') || '';
                const text = (a.innerText || '').replace(/\\s+/g, ' ').trim();
                if (!text || text.length < 8) continue;
                if (!title.test(text)) continue;
                const m = href.match(guid);
                if (!m) continue;
                const id = m[0].toUpperCase();
                if (seen.has(id)) continue;
                seen.add(id);
                out.push({id, title: text});
              }
              return out;
            }""",
            title_re,
        )
        new = 0
        for hit in hits:
            lid = hit["id"]
            if lid in found:
                continue
            found[lid] = hit["title"]
            order.append(lid)
            new += 1
        print(f"{label} page {page_no}: +{new} seasons (total {len(found)})")
        if new == 0:
            empty += 1
            if empty >= 2:
                break
        else:
            empty = 0
        page_no += 1
        time.sleep(PAUSE)

    return [(lid, found[lid]) for lid in order]


def find_club_id(page, league_id: str) -> str | None:
    if not goto(page, f"{BASE}/sport/clubs.aspx?id={league_id}"):
        return None
    return page.evaluate(
        """() => {
          for (const a of document.querySelectorAll('a[href*="club="]')) {
            const text = (a.innerText || '') + ' ' + (a.getAttribute('href') || '');
            if (!/landegem/i.test(text) && !/30050/.test(text)) continue;
            const m = (a.getAttribute('href') || '').match(/[?&]club=(\\d+)/i);
            if (m) return m[1];
          }
          return null;
        }"""
    )


def parse_standings(page, season: str, league_id: str, standings_url: str) -> list[Placement]:
    rows = page.evaluate(
        """() => {
          const out = [];
          for (const table of document.querySelectorAll('table.ruler')) {
            const cap = table.querySelector('caption');
            const poule = (cap?.innerText || '').replace(/\\s+/g, ' ').trim();
            const pouleHref = cap?.querySelector('a')?.getAttribute('href') || '';
            for (const tr of table.querySelectorAll('tbody tr')) {
              const rankEl = tr.querySelector('.standingsrank');
              const a = tr.querySelector('a[href*="team"]');
              if (!rankEl || !a) continue;
              const name = (a.innerText || '').replace(/\\s+/g, ' ').trim();
              if (!/landegem/i.test(name)) continue;
              const tds = [...tr.querySelectorAll('td')];
              const points = (tds[2]?.innerText || '').trim();
              out.push({
                poule,
                pouleHref,
                rank: rankEl.innerText.trim(),
                team: name,
                href: a.getAttribute('href') || '',
                points,
              });
            }
          }
          return out;
        }"""
    )
    placements: list[Placement] = []
    for row in rows:
        try:
            rank = int(re.sub(r"\D", "", row["rank"]) or "0")
        except ValueError:
            continue
        if rank < 1:
            continue
        try:
            points_n = int(re.sub(r"\D", "", row["points"]) or "0")
        except ValueError:
            points_n = 0
        placements.append(
            Placement(
                season=season,
                league_id=league_id,
                team=row["team"],
                poule=row["poule"] or "",
                rank=rank,
                points=row["points"],
                won=rank == 1 and points_n > 0,
                team_url=urljoin(BASE + "/sport/", row["href"]),
                poule_url=urljoin(BASE + "/sport/", row["pouleHref"]) if row["pouleHref"] else "",
                standings_url=standings_url,
            )
        )
    return placements


def scrape_league(page, league_id: str, season: str) -> list[Placement]:
    club_id = find_club_id(page, league_id)
    if not club_id:
        print("  no Landegem club")
        return []
    standings_url = f"{BASE}/sport/clubstandings.aspx?id={league_id}&cid={club_id}"
    if not goto(page, standings_url):
        return []
    placements = parse_standings(page, season, league_id, standings_url)
    print(
        f"  {len(placements)} Landegem team(s), "
        f"{sum(1 for p in placements if p.won)} poule winner(s)"
    )
    for p in placements:
        mark = "WON" if p.won else f"#{p.rank}"
        print(f"    {mark:4} {p.team}  ({p.poule})")
    time.sleep(PAUSE)
    return placements


def placement_key(row: Placement) -> tuple[str, str, str]:
    return (row.league_id, row.team, row.poule)


def load_csv(path: str) -> list[Placement]:
    p = Path(path)
    if not p.exists():
        return []
    out: list[Placement] = []
    with p.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out.append(
                Placement(
                    season=row["season"],
                    league_id=row["league_id"],
                    team=row["team"],
                    poule=row["poule"],
                    rank=int(row["rank"]),
                    points=row["points"],
                    won=row["won"] == "True",
                    team_url=row["team_url"],
                    poule_url=row["poule_url"],
                    standings_url=row["standings_url"],
                )
            )
    return out


def write_csv(path: str, rows: list[Placement]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow(asdict(row))


def merge_rows(existing: list[Placement], new: list[Placement]) -> list[Placement]:
    by_key = {placement_key(r): r for r in existing}
    for row in new:
        by_key[placement_key(row)] = row
    return list(by_key.values())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=0, help="Scan only the first N seasons")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument(
        "--only",
        choices=["pbo", "vlaams", "all"],
        default="all",
        help="Which league search to scrape",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Overwrite CSVs instead of merging with existing rows",
    )
    args = parser.parse_args()

    searches = SEARCHES if args.only == "all" else [s for s in SEARCHES if s["name"] == args.only]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        page = browser.new_page(locale="nl-NL")
        page.set_default_timeout(25000)

        leagues: list[tuple[str, str]] = []
        seen_ids: set[str] = set()
        for search in searches:
            print(f"=== search: {search['name']} ===")
            for lid, title in collect_leagues(page, search["url"], search["title_re"], search["name"]):
                if lid in seen_ids:
                    continue
                seen_ids.add(lid)
                leagues.append((lid, title))
            print()

        if args.limit:
            leagues = leagues[: args.limit]
        print(f"{len(leagues)} seasons to scan\n")

        new_rows: list[Placement] = []
        for i, (lid, title) in enumerate(leagues, 1):
            print(f"[{i}/{len(leagues)}] {title}")
            new_rows.extend(scrape_league(page, lid, title))

        browser.close()

    existing = [] if args.replace else load_csv(PLAATSEN_CSV)
    all_rows = merge_rows(existing, new_rows)
    winners = [r for r in all_rows if r.won]

    write_csv(PLAATSEN_CSV, all_rows)
    write_csv(KAMPIOENEN_CSV, winners)

    print("\n=== new poule winners this run ===")
    new_winners = [r for r in new_rows if r.won]
    if not new_winners:
        print("None found.")
    for w in new_winners:
        print(f"- {w.season}: {w.team}  (1st in {w.poule})")

    print(f"\nWrote {len(all_rows)} placements to {PLAATSEN_CSV}")
    print(f"Wrote {len(winners)} winners to {KAMPIOENEN_CSV}")


if __name__ == "__main__":
    main()
