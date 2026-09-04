/**
 * Ploegtitels (champions.csv) en clubmomenten (club-events.csv) voor de
 * slingerende tijdlijn op /club/over-de-club/.
 */

export type Title = {
  /** Ploegcode op de site, bv. `1H` of `J2`. */
  team: string;
  category: 'Heren' | 'Dames' | 'Gemengd' | 'Jeugd';
  /** Leesbare reeks, bv. `3e provinciale C`. */
  division: string;
  points: number;
  teamUrl: string;
};

export type SeasonTitles = {
  /** `2007–2008` */
  season: string;
  seasonStart: number;
  titles: Title[];
};

export type ClubEvent = {
  year: number;
  title: string;
  /** Optionele externe link (3e CSV-kolom). */
  url?: string;
};

/** Clubmoment op de tijdlijn (één of meer per jaar). */
export type ClubEventItem = {
  title: string;
  url?: string;
};

export type Champions = {
  seasons: SeasonTitles[];
  count: number;
  oldest: string;
  newest: string;
};

/** Meetpunt op de tijdlijn. `pad` vult de vorige rij zodat 1987 op een nieuwe rij begint. */
export type TimelinePoint =
  | { kind: 'season'; season: string; seasonStart: number; titles: Title[] }
  | { kind: 'event'; year: number; titles: ClubEventItem[] }
  | { kind: 'founding'; year: number; title: string; url?: string }
  | { kind: 'pad' };

export type ClubTimeline = {
  points: TimelinePoint[];
  count: number;
  oldest: string;
  newest: string;
};

const TYPE_ORDER: Record<Title['category'], number> = {
  Heren: 0,
  Dames: 1,
  Gemengd: 2,
  Jeugd: 3,
};

/** Oprichtingsjaar: sluit de tijdlijn af en staat altijd alleen op de laatste rij. */
const FOUNDING_YEAR = 1987;

/** Meetpunten per rij op desktop — moet gelijk blijven aan `md:grid-cols-4` in over-de-club.astro. */
const COLUMNS = 4;

export function parseChampions(csv: string): Champions {
  const rows = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map(splitCsvLine)
    .filter((cols) => cols.length >= 8);

  const bySeason = new Map<number, SeasonTitles>();

  for (const cols of rows) {
    const [seasonRaw, , teamRaw, pouleRaw, rank, pointsRaw, won, teamUrl] = cols;
    if (won.trim().toLowerCase() !== 'true') continue;
    if (rank.trim() !== '1') continue;

    const years = seasonRaw.match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (!years) continue;
    const seasonStart = Number(years[1]);
    const season = `${years[1]}–${years[2]}`;
    const { category, division } = formatPoule(pouleRaw);

    const title: Title = {
      team: teamCode(teamRaw),
      category,
      division,
      points: Number(pointsRaw) || 0,
      teamUrl: teamUrl.trim(),
    };

    let group = bySeason.get(seasonStart);
    if (!group) {
      group = { season, seasonStart, titles: [] };
      bySeason.set(seasonStart, group);
    }
    group.titles.push(title);
  }

  for (const group of bySeason.values()) {
    group.titles.sort((a, b) => {
      const type = TYPE_ORDER[a.category] - TYPE_ORDER[b.category];
      if (type) return type;
      return teamSortKey(a.team) - teamSortKey(b.team);
    });
  }

  const seasons = [...bySeason.values()].sort((a, b) => b.seasonStart - a.seasonStart);
  return {
    seasons,
    count: seasons.reduce((n, s) => n + s.titles.length, 0),
    oldest: seasons.at(-1)?.season ?? '',
    newest: seasons[0]?.season ?? '',
  };
}

/** Clubmomenten: `year,title[,url]`. Jaar 1987 is de oprichting en komt altijd als laatste op een nieuwe rij. */
export function parseClubEvents(csv: string): ClubEvent[] {
  return csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map(splitCsvLine)
    .filter((cols) => cols.length >= 2)
    .map(([yearRaw, titleRaw, urlRaw]) => {
      const url = urlRaw?.trim();
      return {
        year: Number(yearRaw.trim()),
        title: titleRaw.trim(),
        ...(url ? { url } : {}),
      };
    })
    .filter((e) => Number.isFinite(e.year) && e.title.length > 0);
}

/**
 * Seizoenen + clubevents, nieuwste eerst. 1987 (oprichting) staat altijd
 * onderaan op een nieuwe rij — lege `pad`-cellen vullen gaten in de vorige rij
 * zodat dense-grid 1987 niet naast de laatste bol plaatst.
 */
export function buildClubTimeline(championsCsv: string, eventsCsv: string): ClubTimeline {
  const { seasons, count, oldest, newest } = parseChampions(championsCsv);
  const events = parseClubEvents(eventsCsv);

  const foundingEvent = events.find((e) => e.year === FOUNDING_YEAR);
  const founding: TimelinePoint = {
    kind: 'founding',
    year: FOUNDING_YEAR,
    title: foundingEvent?.title || 'Oprichting van de club',
    ...(foundingEvent?.url ? { url: foundingEvent.url } : {}),
  };

  type Sortable = { year: number; order: number; point: TimelinePoint };
  // Meerdere clubmomenten in hetzelfde jaar → één bol, titels onder elkaar.
  const eventsByYear = new Map<number, ClubEventItem[]>();
  for (const e of events.filter((ev) => ev.year !== FOUNDING_YEAR)) {
    const list = eventsByYear.get(e.year) ?? [];
    list.push(e.url ? { title: e.title, url: e.url } : { title: e.title });
    eventsByYear.set(e.year, list);
  }

  const merged: Sortable[] = [
    ...seasons.map((s, i) => ({
      year: s.seasonStart,
      order: i,
      point: { kind: 'season' as const, ...s },
    })),
    ...[...eventsByYear.entries()].map(([year, titles], i) => ({
      year,
      order: 1000 + i,
      point: { kind: 'event' as const, year, titles },
    })),
  ];

  // Nieuwste eerst; bij hetzelfde jaar eerst de seizoenstitels, dan het clubmoment.
  merged.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    const rank = (p: TimelinePoint) => (p.kind === 'season' ? 0 : 1);
    const dr = rank(a.point) - rank(b.point);
    if (dr) return dr;
    return a.order - b.order;
  });

  const body = merged.map((m) => m.point);
  // Vul de huidige rij af (max. COLUMNS), zodat 1987 op een verse rij begint.
  // De U-bocht volgt daarna de positie van de laatste echte bol (geen vaste kant).
  const padCount = (COLUMNS - (body.length % COLUMNS)) % COLUMNS;
  const pads: TimelinePoint[] = Array.from({ length: padCount }, () => ({ kind: 'pad' }));

  return {
    points: [...body, ...pads, founding],
    count,
    oldest,
    newest,
  };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function teamCode(name: string): string {
  const stripped = name.replace(/\s*\(\d+\)\s*$/, '').trim();
  const m = stripped.match(/([A-Za-z]*\d+[A-Za-z]*)$/);
  if (!m) return stripped;
  return m[1]
    .replace(/^([a-z]+)(\d+)/i, (_, letters: string, n: string) => letters.toUpperCase() + n)
    .replace(/(\d+)([a-z]+)$/i, (_, n: string, letters: string) => n + letters.toUpperCase());
}

function teamSortKey(code: string): number {
  const m = code.match(/(\d+)/);
  return m ? Number(m[1]) : 99;
}

function formatPoule(poule: string): Pick<Title, 'category' | 'division'> {
  const n = poule.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  const deg = n.replace(/(\d)de\b/gi, '$1e');

  if (/meisjes/i.test(deg) || /\bME\b/.test(deg)) {
    const age = deg.match(/(\d+)/);
    return { category: 'Jeugd', division: age ? `Meisjes U${age[1]}` : 'Meisjes' };
  }

  let category: Title['category'] = 'Gemengd';
  if (/dames/i.test(deg)) category = 'Dames';
  else if (/heren/i.test(deg)) category = 'Heren';
  else if (/gemeng/i.test(deg)) category = 'Gemengd';

  const provinciale = [...deg.matchAll(/(\d+e)\s+provinciale(?:\s+([A-Z])\b)?/gi)];
  if (provinciale.length) {
    const last = provinciale[provinciale.length - 1];
    const ordinal = last[1].toLowerCase();
    const letter = last[2] ?? deg.match(/\b([A-Z])\s*$/)?.[1] ?? loneLetter(deg);
    const division = letter ? `${ordinal} provinciale ${letter}` : `${ordinal} provinciale`;
    return { category, division };
  }

  const liga = [...deg.matchAll(/(\d+e)\s+liga(?:\s+([A-Z])\b)?/gi)];
  if (liga.length) {
    const last = liga[liga.length - 1];
    const ordinal = last[1].toLowerCase();
    const letter = last[2] ?? deg.match(/\b([A-Z])\s*$/)?.[1] ?? loneLetter(deg);
    const division = letter ? `${ordinal} liga ${letter}` : `${ordinal} liga`;
    return { category, division };
  }

  return { category, division: deg };
}

/** Pouleletter die achter een streepje staat (`5e Provinciale - C`). */
function loneLetter(text: string): string | undefined {
  const m = text.match(/-\s*([A-Z])\s*$/);
  return m?.[1];
}
