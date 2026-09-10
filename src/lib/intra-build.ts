/**
 * De bevroren helft van de intraclub: zeventien eindstanden die niet meer
 * veranderen. Die hoort niet elke bezoeker opnieuw op te halen, dus haalt de
 * build ze op en zet er platte HTML van neer — nul fetches in de browser,
 * meteen indexeerbaar, en offline gewoon leesbaar.
 *
 * Van een afgesloten seizoen is publiek enkel de eindstand: geen speeldagen,
 * geen wedstrijden, geen aanwezigheden, geen klassementsverloop. Wie één
 * persoon over meerdere seizoenen wil zien, moet daarvoor bij zijn fiche zijn
 * — en die beslist live of dat mag, want dat hangt ervan af of hij nog lid is.
 * Vandaar dat er hier geen loopbaanpagina's meer gebouwd worden.
 *
 * Alles hier draait uitsluitend tijdens `astro build`. De live helft (het
 * lopende klassement, één speeldag, één speler) loopt langs src/lib/intra.ts.
 */
const API = import.meta.env.PUBLIC_INTRA_API ?? 'https://intra.bclandegem.be/api';

/* ---------------------------------------------------------------- ophalen */

const cache = new Map<string, Promise<unknown>>();

/**
 * Eén ophaling per pad per build. De erelijst en de zeventien seizoenspagina's
 * leunen op dezelfde standen; zonder deze cache haalt elke pagina ze opnieuw op.
 *
 * Daarom staat er nergens nog `&limit=1`: dat leverde een ánder pad op voor
 * dezelfde stand, en dus een cachemisser voor een lijst die al in het geheugen
 * zat. Wie alleen de winnaar wil, neemt `[0]` van de volledige lijst.
 */
export function getApi<T, M = unknown>(path: string): Promise<{ data: T; meta?: M }> {
  let promise = cache.get(path) as Promise<{ data: T; meta?: M }> | undefined;
  if (!promise) {
    promise = fetchOnce<T, M>(path);
    cache.set(path, promise);
  }
  return promise;
}

export async function getData<T>(path: string): Promise<T> {
  return (await getApi<T>(path)).data;
}

/**
 * Eén hapering hoort de hele deploy niet te laten mislukken, dus twee
 * herkansingen met oplopende pauze. Lukt het daarna nog niet, dan faalt de
 * build met opzet: een halve historiek is erger dan geen deploy.
 */
async function fetchOnce<T, M = unknown>(path: string): Promise<{ data: T; meta?: M }> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 400 * attempt));
    try {
      const res = await fetch(`${API}${path}`);
      if (!res.ok) throw new Error(`${res.status} op ${path}`);
      return (await res.json()) as { data: T; meta?: M };
    } catch (error_) {
      last = error_;
    }
  }
  throw new Error(`Intra-API onbereikbaar: ${path} (${String(last)})`);
}

/**
 * Hoeveel verzoeken er tegelijk mogen lopen. Nagemeten op 40 opeenvolgende
 * rondes: serieel 7,6 s, met vier tegelijk 2,0 s, met acht 1,1 s. Daarbóven
 * wordt het niet sneller maar wél trager per antwoord — met twaalf tegelijk
 * verdubbelt de mediaan van 196 naar 340 ms, met vierentwintig naar 596 ms, en
 * blijft de wandklok op ~1,2 s hangen. Acht is de knik.
 *
 * De build haalt nu een dertigtal antwoorden op in plaats van vijfhonderd, dus
 * dit plafond kost bijna niets meer. Het staat er omdat `champions()` anders
 * zeventien standen tegelijk opvraagt, en dat is boven de knik.
 */
const CONCURRENCY = 8;

/** Parallel ophalen met een plafond; zie CONCURRENCY. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ------------------------------------------------------------------ namen */

/**
 * De API schrijft seizoensnamen niet uniform: "2009 - 2010" naast "2023-2024".
 * Eén vorm voor het scherm én voor de URL, zodat een link niet afhangt van
 * waar de naam vandaan kwam.
 */
export function seasonSlug(name: string): string {
  return name.replace(/\s+/g, '');
}

import { displayName, seasonState, type RankingMeta } from './intra';
// Alleen het type: de erelijst leest de CSV zelf, dit bestand rekent er enkel mee.
import type { PreArchiveChampion } from './champions';

/* ------------------------------------------------------------------ types */

export interface ArchiveSeason {
  id: number;
  name: string;
  /** `comp` is 2009-2013, `intra` is 2013-2023. Zelfde vorm, andere herkomst. */
  source: 'comp' | 'intra';
  rounds_count: number;
  /** De lengte van de eindstand, niet het aantal inschrijvingen. */
  players_count: number;
}

export interface ArchiveStanding {
  archive_player_id: number;
  /**
   * `null` voor wie nooit in het huidige ledenbestand terechtkwam — een derde
   * van alle archiefrijen. Voor die mensen bestaat er geen fiche, dus blijft
   * hun naam in de eindstand platte tekst.
   */
  player_id: number | null;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: 'male' | 'female' | null;
  ranking: string | null;
  average: number;
  base_points: number;
  sets: { won: number; total: number };
  points: { won: number; total: number };
  games: { won: number; total: number };
  rounds: { present: number };
}

export interface Season {
  id: number;
  name: string;
  rounds_count: number;
  /** De lengte van de eindstand, niet het aantal inschrijvingen. */
  players_count: number;
}

/* ------------------------------------------------------ samengestelde weergaven */

/**
 * Eén seizoen op de site, ongeacht waar het vandaan komt. `format` bepaalt
 * welke kolommen de eindstand krijgt — het oude format speelde met vaste teams
 * in best-of-3 en kent dus gewonnen wedstrijden, het huidige niet.
 */
export interface SeasonEntry {
  slug: string;
  label: string;
  id: number;
  format: 'archive' | 'current';
  rounds_count: number;
  players_count: number;
  /** Het huidige seizoen krijgt geen eigen pagina: dat is /intraclub/ zelf. */
  isCurrent: boolean;
  /**
   * Of dat huidige seizoen ook echt nog loopt. De API blijft van juni tot
   * september hetzelfde seizoen als "current" aanwijzen, dus zou de erelijst
   * een afgesloten jaargang drie maanden lang "lopend" noemen.
   */
  isRunning: boolean;
}

/**
 * Alle seizoenen, oudste eerst. Het lopende seizoen zit erbij maar wordt niet
 * als pagina gebouwd: zijn stand leeft en hoort dus op /intraclub/ te staan,
 * niet in een bevroren kopie die de dag na de build al achterloopt.
 */
export async function allSeasons(): Promise<SeasonEntry[]> {
  const [archive, current, ranking] = await Promise.all([
    getData<ArchiveSeason[]>('/archive/seasons'),
    getApi<Season[], { current_season_id: number }>('/seasons'),
    getApi<unknown[], RankingMeta>('/rankings/general?limit=1'),
  ]);
  const currentId = current.meta?.current_season_id;
  const running = seasonState(ranking.meta?.round ?? null) === 'running';

  const entries: SeasonEntry[] = [
    ...archive.map((season) => ({
      slug: seasonSlug(season.name),
      label: seasonSlug(season.name),
      id: season.id,
      format: 'archive' as const,
      rounds_count: season.rounds_count,
      players_count: season.players_count,
      isCurrent: false,
      isRunning: false,
    })),
    ...current.data.map((season) => ({
      slug: seasonSlug(season.name),
      label: seasonSlug(season.name),
      id: season.id,
      format: 'current' as const,
      rounds_count: season.rounds_count,
      players_count: season.players_count,
      isCurrent: season.id === currentId,
      isRunning: season.id === currentId && running,
    })),
  ];

  return entries.sort((a, b) => a.slug.localeCompare(b.slug));
}

/* -------------------------------------------------- seizoenen voor de browser */

export interface SeasonLink {
  slug: string;
  /** Hoe groot het veld was: de lengte van de eindstand. */
  players: number;
}

/**
 * De sleutel waaronder een seizoen in de browser teruggevonden wordt.
 *
 * De letter is geen versiering. De twee generaties hebben elk hun eigen
 * id-reeks en die overlappen: `season_id: 1` is 2013-2014 in het archief en
 * 2023-2024 in het huidige format. Wie op `season_id` alleen indexeert, koppelt
 * die twee stil aan elkaar en linkt tien jaar naast de waarheid — zonder fout,
 * zonder leeg veld. `is_archive` hoort dus in de sleutel, niet ernaast.
 */
export function seasonKey(id: number, isArchive: boolean): string {
  return `${isArchive ? 'a' : 's'}${id}`;
}

/**
 * Welke seizoenen een eindstandpagina hebben, en hoe groot hun veld was.
 *
 * De spelerspagina leeft in de browser en krijgt zijn geschiedenis uit het veld
 * `seasons` van de API. Die geeft id's, geen URL's — en de browser kan de
 * seizoenslijst niet zelf ophalen zonder een tweede call. Dus geeft de build
 * dit tabelletje mee; het is een paar honderd bytes.
 *
 * Een lopend seizoen staat er niet in: dat heeft geen pagina, en het staat ook
 * niet in `seasons` (dat is de fiche zelf).
 */
export async function seasonLinks(): Promise<Record<string, SeasonLink>> {
  const seasons = await allSeasons();
  const map: Record<string, SeasonLink> = {};
  for (const season of seasons) {
    if (season.isRunning) continue;
    map[seasonKey(season.id, season.format === 'archive')] = {
      slug: season.slug,
      players: season.players_count,
    };
  }
  return map;
}

/* ---------------------------------------------------------------- erelijst */

export interface ChampionEntry {
  name: string;
  average: number;
  playerId: number | null;
}

export interface Champion {
  season: SeasonEntry;
  winner: ChampionEntry | null;
  /**
   * De hoogste vrouw in de eindstand. Vanaf 2023-2024 is dat het damesklassement
   * dat de club zelf bijhoudt; daarvoor leidt de site het af uit de algemene
   * stand, waar `gender` per rij meekomt. Dat is verdedigbaar omdat geslacht
   * niet per seizoen verandert — anders dan de badmintonranking, die in het
   * archief maar één keer per persoon bewaard is en dus geen
   * recreantenerelijst kan dragen.
   */
  women: ChampionEntry | null;
  note: string | null;
}

/**
 * De erelijst: één naam per seizoen. Voor het archief is dat de eerste rij van
 * de bewaarde eindstand, voor het huidige format de kop van het algemene
 * klassement — met ?members=0, anders filtert ook een afgesloten seizoen op wie
 * er vandaag nog lid is en mist 2023-2024 er 36 van de 96.
 *
 * `preArchive` levert de seizoenen van vóór 2009-2010, die de API niet kent.
 * Ze komen niet in de teruggegeven lijst — de erelijst zet ze in een eigen blok
 * onder de rail — maar ze tellen wel mee voor de grijze regels: wie in
 * 2005-2006 won, heeft in 2011-2012 geen eerste titel meer.
 *
 * De parameter is met opzet verplicht en heeft geen lege standaardwaarde: wie
 * ze vergeet, krijgt geen fout maar stil verkeerde regels terug — een "de
 * eerste" op een seizoen dat het niet is.
 */
export async function champions(preArchive: PreArchiveChampion[]): Promise<Champion[]> {
  const seasons = await allSeasons();

  const entries = await mapLimit(seasons, CONCURRENCY, async (season) => {
    if (season.format === 'archive') {
      const rows = await getData<ArchiveStanding[]>(`/archive/seasons/${season.id}/standings`);
      const entry = (row: ArchiveStanding | undefined): ChampionEntry | null =>
        row
          ? { name: displayName(row.full_name), average: row.average, playerId: row.player_id }
          : null;
      return {
        winner: entry(rows[0]),
        women: entry(rows.find((row) => row.gender === 'female')),
      };
    }

    // Dezelfde twee paden die de seizoenspagina opvraagt, dus cachetreffers.
    const [general, womenRanking] = await Promise.all([
      getData<RankingHead[]>(`/rankings/general?season=${season.id}&members=0`),
      getData<RankingHead[]>(`/rankings/women?season=${season.id}&members=0`),
    ]);
    const entry = (row: RankingHead | undefined) =>
      row ? { name: displayName(row.full_name), average: row.average, playerId: row.id } : null;
    return { winner: entry(general[0]), women: entry(womenRanking[0]) };
  });

  // Nieuwste bovenaan: een erelijst leest van nu naar toen.
  const list = seasons.map((season, i) => ({
    season,
    winner: entries[i].winner,
    women: entries[i].women,
    note: null as string | null,
  }));
  list.reverse();

  return withNotes(list, preArchive);
}

interface RankingHead {
  id: number;
  full_name: string;
  average: number;
}

/** Beginjaar van een seizoenslabel: `2011-2012` → `2011`. */
const startYear = (label: string) => Number(label.slice(0, 4));

/**
 * De grijze regel achter een naam ("derde op rij", "twaalf seizoenen na de
 * eerste titel"). Berekend uit de lijst zelf, nooit met de hand getypt: klopt
 * de voorwaarde niet, dan staat er niets in plaats van een halve waarheid.
 *
 * Gerekend wordt over álles wat de pagina over winnaars weet, dus ook over de
 * pre-archiefrijen die niet in de rail staan. Anders zwijgt de rail over een
 * herhaling die de pagina zelf een blok lager toont.
 */
function withNotes(list: Champion[], preArchive: PreArchiveChampion[]): Champion[] {
  // De rail eerst: staat een jaargang daar, dan is dat de bron. Een
  // handgetypte CSV-regel voor een seizoen dat de API óók kent, is een typfout
  // en mag de berekening niet overnemen.
  const railYears = new Set(list.map((entry) => startYear(entry.season.slug)));
  const timeline = [
    ...list.map((entry) => ({
      year: startYear(entry.season.slug),
      name: entry.winner?.name ?? null,
    })),
    ...preArchive
      .filter((row) => !railYears.has(startYear(row.season)))
      .map((row) => ({ year: startYear(row.season), name: row.winner })),
  ].sort((a, b) => b.year - a.year);
  const indexByYear = new Map(timeline.map((row, i) => [row.year, i]));

  /*
    "De eerste" is een uitspraak over de hele clubgeschiedenis, niet over de
    lijst. Bestaat er pre-archiefdata, dan is dat het bewijs dat de reeks
    onvolledig is — dat bestand bestaat juist voor wat buiten de API valt, en
    het gat tussen 2006-2007 en 2009-2010 staat er open bij. Dan mag geen enkel
    seizoen nog "de eerste" heten.
  */
  const complete = preArchive.length === 0;

  return list.map((entry) => {
    if (!entry.winner) return entry;
    const name = entry.winner.name;
    const i = indexByYear.get(startYear(entry.season.slug))!;

    // "Op rij" vraagt aansluitende jaargangen, geen aansluitende lijstplaatsen:
    // met gaten in het pre-archief liggen twee rijen naast elkaar in de lijst
    // zonder naast elkaar te liggen in de tijd.
    let inARow = 1;
    for (let j = i + 1; j < timeline.length; j++) {
      if (timeline[j].year !== timeline[j - 1].year - 1) break;
      if (timeline[j].name !== name) break;
      inARow++;
    }
    if (inARow > 1) {
      const word = ['', '', 'tweede', 'derde', 'vierde', 'vijfde'][inARow] ?? `${inARow}e`;
      return { ...entry, note: `${word} op rij` };
    }

    // Geen reeks: stond deze naam er ooit eerder? Dan is de afstand het verhaal.
    const first = timeline.findLast((row) => row.name === name)!;
    if (first.year < timeline[i].year) {
      return { ...entry, note: `${timeline[i].year - first.year} seizoenen na de eerste titel` };
    }

    if (complete && i === timeline.length - 1) return { ...entry, note: 'de eerste' };
    return entry;
  });
}
