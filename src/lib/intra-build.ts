/**
 * De bevroren helft van de intraclub: zeventien seizoenen die niet meer
 * veranderen. Die hoort niet elke bezoeker opnieuw op te halen, dus haalt de
 * build ze op en zet er platte HTML van neer — nul fetches in de browser,
 * meteen indexeerbaar, en offline gewoon leesbaar.
 *
 * Alles hier draait uitsluitend tijdens `astro build`. De live helft (het
 * lopende klassement, één speeldag, één speler) loopt langs src/lib/intra.ts.
 */
const API = import.meta.env.PUBLIC_INTRA_API ?? 'https://intra.bclandegem.be/api';

/* ---------------------------------------------------------------- ophalen */

const cache = new Map<string, Promise<unknown>>();

/**
 * Eén ophaling per pad per build. Astro rendert honderden pagina's die
 * dezelfde seizoenslijst nodig hebben; zonder deze cache is dat honderden
 * keer hetzelfde antwoord.
 *
 * Let op: de zware antwoorden (een speler mét al zijn wedstrijden, ~100 kB)
 * gaan hier bewust nìet door — die worden per pagina opgehaald en weer
 * losgelaten, anders staat het hele archief tegelijk in het geheugen.
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

/** Zonder cache: voor de grote antwoorden die maar één pagina nodig heeft. */
export async function getFresh<T>(path: string): Promise<T> {
  return (await fetchOnce<T>(path)).data;
}

/**
 * Een build doet ruim vijfhonderd verzoeken. Eén hapering hoort de hele
 * deploy niet te laten mislukken, dus twee herkansingen met oplopende pauze.
 */
async function fetchOnce<T, M = unknown>(path: string): Promise<{ data: T; meta?: M }> {
  let last: unknown;
  for (let poging = 0; poging < 3; poging++) {
    if (poging > 0) await new Promise((r) => setTimeout(r, 400 * poging));
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
 * Parallel ophalen met een plafond. De API staat op één host en wordt merkbaar
 * trager zodra ze te veel tegelijk krijgt; acht is de plek waar de build snel
 * is zonder dat de antwoorden gaan slepen.
 */
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

/**
 * De slug van een loopbaanpagina leeft in intra.ts: de spelerspagina bouwt hem
 * in de browser om ernaartoe te linken, deze module bij de build om die
 * pagina's te maken. Eén definitie, twee gebruikers.
 */
export { careerSlug, careerUrl } from './intra';
import { careerSlug, displayName, seasonState, type RankingMeta } from './intra';

/**
 * Het archief bewaart nog "Man"/"Vrouw", de rest van de API geeft sinds de
 * omzetting male/female. De site toont geslacht nergens, maar één vertaling
 * hier is goedkoper dan die afwijking later terugvinden.
 */
export function normalizeGender(value: string | null): 'male' | 'female' | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === 'man' || v === 'male') return 'male';
  if (v === 'vrouw' || v === 'female') return 'female';
  return null;
}

/* ------------------------------------------------------------------ types */

export interface ArchiveSeason {
  id: number;
  name: string;
  /** `comp` is 2009-2013, `intra` is 2013-2023. Zelfde vorm, andere herkomst. */
  source: 'comp' | 'intra';
  rounds_count: number;
  players_count: number;
}

export interface ArchiveStanding {
  archive_player_id: number;
  player_id: number | null;
  first_name: string;
  last_name: string;
  full_name: string;
  ranking: string | null;
  average: number;
  base_points: number;
  sets: { won: number; total: number };
  points: { won: number; total: number };
  games: { won: number; total: number };
  rounds: { present: number };
}

export interface ArchiveRound {
  id: number;
  number: number;
  date: string;
  average_absent: number;
  season_id: number;
  games_count: number;
}

export interface ArchivePlayerRef {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: string | null;
  ranking: string | null;
  player_id: number | null;
}

/** Het oude format: vaste teams, best of three — geen duo's die per set wisselen. */
export interface ArchiveGame {
  id: number;
  round_id: number;
  team1: ArchivePlayerRef[];
  team2: ArchivePlayerRef[];
  sets: { team1: number; team2: number }[];
  sets_won: { team1: number; team2: number };
}

export interface ArchiveRoundDetail extends ArchiveRound {
  season_name: string;
  games: ArchiveGame[];
}

export interface ArchivePlayerSeason {
  season_id: number;
  season_name: string;
  base_points: number;
  sets: { won: number; total: number };
  points: { won: number; total: number };
  games: { won: number; total: number };
  rounds: { present: number };
}

export interface ArchivePlayerDetail extends ArchivePlayerRef {
  seasons: ArchivePlayerSeason[];
  games: ArchiveGame[];
}

export interface Season {
  id: number;
  name: string;
  rounds_count: number;
  players_count: number;
}

/* ------------------------------------------------------ samengestelde weergaven */

/**
 * Eén seizoen op de site, ongeacht waar het vandaan komt. `format` bepaalt
 * welke kolommen de eindstand krijgt en welke speeldagcomponent er past — het
 * oude format speelde met vaste teams, dus die twee zijn niet uitwisselbaar.
 */
export interface SeasonEntry {
  slug: string;
  label: string;
  id: number;
  format: 'archief' | 'huidig';
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
  const loopt = seasonState(ranking.meta?.round ?? null) === 'loopt';

  const entries: SeasonEntry[] = [
    ...archive.map((season) => ({
      slug: seasonSlug(season.name),
      label: seasonSlug(season.name),
      id: season.id,
      format: 'archief' as const,
      rounds_count: season.rounds_count,
      players_count: season.players_count,
      isCurrent: false,
      isRunning: false,
    })),
    ...current.data.map((season) => ({
      slug: seasonSlug(season.name),
      label: seasonSlug(season.name),
      id: season.id,
      format: 'huidig' as const,
      rounds_count: season.rounds_count,
      players_count: season.players_count,
      isCurrent: season.id === currentId,
      isRunning: season.id === currentId && loopt,
    })),
  ];

  return entries.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Iedereen die ooit intraclub speelde, ongeacht wanneer. Het archief kent er
 * 200; wie ná de formaatwissel lid werd staat daar niet in en zou anders geen
 * loopbaanpagina krijgen — terwijl juist die mensen er al drie seizoenen op
 * hebben zitten.
 */
export interface CareerPerson {
  slug: string;
  name: string;
  archiveId: number | null;
  playerId: number | null;
}

export async function allCareers(): Promise<CareerPerson[]> {
  const archive = await getData<ArchivePlayerRef[]>('/archive/players');
  const seasons = (await allSeasons()).filter(
    (season) => season.format === 'huidig' && !season.isRunning,
  );

  const mensen = new Map<string, CareerPerson>();
  /**
   * `actueel` betekent: deze naam komt uit het huidige ledenbestand en wint dus
   * van de naam in het archief. Dat is niet cosmetisch — de spelerspagina bouwt
   * de link naar deze pagina in de browser uit de naam die zíj kent, en die komt
   * uit dezelfde bron. Wijken ze af, dan wijst de link naar een 404.
   */
  const zet = (person: Omit<CareerPerson, 'slug'>, actueel = false) => {
    const sleutel = person.playerId ? `s${person.playerId}` : `a${person.archiveId}`;
    const bestaand = mensen.get(sleutel);
    if (bestaand) {
      bestaand.archiveId ??= person.archiveId;
      if (actueel) {
        bestaand.name = person.name;
        bestaand.slug = careerSlug(bestaand);
      }
      return;
    }
    mensen.set(sleutel, { ...person, slug: careerSlug(person) });
  };

  for (const speler of archive) {
    zet({
      name: displayName(speler.full_name) || 'Onbekende speler',
      archiveId: speler.id,
      playerId: speler.player_id,
    });
  }

  // De klassementen van de afgesloten seizoenen in het huidige format: daar
  // staat iedereen in die toen meespeelde, ook wie ondertussen gestopt is —
  // vandaar ?members=0.
  const perSeizoen = await mapLimit(seasons, 4, (season) =>
    getData<{ id: number; full_name: string }[]>(
      `/rankings/general?season=${season.id}&members=0`,
    ),
  );
  for (const ranking of perSeizoen) {
    for (const speler of ranking) {
      zet({ name: displayName(speler.full_name), archiveId: null, playerId: speler.id }, true);
    }
  }

  return [...mensen.values()];
}

/** Eén seizoen uit de loopbaan van een speler, ongeacht het format. */
export interface CareerSeason {
  slug: string;
  label: string;
  rank: number | null;
  /** Hoe groot het veld was waarin die plaats behaald werd. */
  field: number;
  average: number | null;
  sets: { won: number; total: number };
  /**
   * Gespeelde wedstrijden. `won` bestaat alleen in het oude format: daar
   * speelden twee vaste teams best of three, dus was er een winnaar per
   * wedstrijd. In het huidige format wisselt elke set van samenstelling en is
   * er dus niets te winnen op wedstrijdniveau — enkel sets.
   */
  games: { won: number | null; total: number };
  present: number;
  rounds_count: number;
  /**
   * Het verloop binnen dat seizoen. Wat erin zit hangt af van de bron:
   * het huidige format geeft dagscore én plaats per speeldag, het archief
   * (2013-2023) enkel het gemiddelde, en de vier oudste seizoenen (2009-2013)
   * niets — daar is per speeldag nooit iets bewaard.
   */
  history: CareerRound[];
}

export interface CareerRound {
  number: number;
  date: string;
  /** `null` waar het archief geen verloop per speeldag bewaarde (2009-2013). */
  average: number | null;
  day_score: number | null;
  rank: number | null;
}

/**
 * Op welke speeldagen iemand effectief speelde. Er is geen aanwezigheidsvlag in
 * het verloop, maar zijn wedstrijden zijn het bewijs: staat er een wedstrijd op
 * die speeldag, dan stond hij op de baan. Dat werkt in beide formats, ook waar
 * er verder niets per speeldag bewaard is.
 */
function playedRounds(games: { round_id?: number; round?: { id: number } }[]): Set<number> {
  return new Set(
    games
      .map((game) => game.round_id ?? game.round?.id)
      .filter((id): id is number => typeof id === 'number'),
  );
}

/**
 * De seizoenen die een huidig lid in het nieuwe format speelde. De erelijst en
 * de spelerspagina's uit het archief stoppen anders in 2022-2023, terwijl
 * dezelfde mensen daarna gewoon zijn blijven spelen.
 *
 * Alle calls hier zijn gecacht en er zijn maar drie seizoenen, dus dit kost
 * niets extra hoeveel spelerspagina's er ook gebouwd worden.
 */
export async function currentFormatCareer(playerId: number): Promise<CareerSeason[]> {
  const seasons = (await allSeasons()).filter(
    (season) => season.format === 'huidig' && !season.isRunning,
  );

  const rijen = await mapLimit(seasons, 4, async (season) => {
    const [ranking, statistics] = await Promise.all([
      getData<{ id: number; average: number; rank: number }[]>(
        `/rankings/general?season=${season.id}&members=0`,
      ),
      getData<{ player: { id: number }; statistics: CurrentStatistics }[]>(
        `/seasons/${season.id}/statistics?members=0`,
      ),
    ]);

    const stand = ranking.find((row) => row.id === playerId);
    const stat = statistics.find((row) => row.player.id === playerId)?.statistics;
    if (!stand && !stat) return null;

    // Eén call per speler per seizoen, en dus niet gecacht: dit is het enige
    // antwoord dat over één persoon in één seizoen gaat. `games` zit erbij om
    // te weten op welke speeldagen hij effectief speelde — het verloop bevat
    // ook de avonden waarop hij er niet was.
    const detail = await getFresh<{
      ranking_history?: (CareerRound & { round_id: number })[];
      games?: { round?: { id: number } }[];
    }>(`/players/${playerId}?season=${season.id}&include=games,ranking_history`);

    const gespeeld = playedRounds(detail.games ?? []);
    const history = (detail.ranking_history ?? []).filter((ronde) => gespeeld.has(ronde.round_id));

    return {
      slug: season.slug,
      label: season.label,
      rank: stand?.rank ?? null,
      field: ranking.length,
      average: stand?.average ?? null,
      sets: stat?.sets ?? { won: 0, total: 0 },
      games: { won: null, total: stat?.games.total ?? 0 },
      present: stat?.rounds.present ?? 0,
      rounds_count: season.rounds_count,
      history,
    } satisfies CareerSeason;
  });

  return rijen.filter((rij): rij is CareerSeason => rij !== null);
}

interface CurrentStatistics {
  sets: { won: number; total: number };
  rounds: { present: number };
  games: { total: number };
}

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
   * stand, want een aparte damesstand bestond toen niet. Dat is verdedigbaar
   * omdat geslacht niet per seizoen verandert — anders dan de badmintonranking,
   * die in het archief maar één keer per persoon bewaard is en dus geen
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
 */
export async function champions(): Promise<Champion[]> {
  const seasons = await allSeasons();
  // Geslacht staat op de archiefspeler, niet in de eindstand. Eén lijst van 200
  // volstaat voor alle veertien seizoenen.
  const archivePlayers = await getData<ArchivePlayerRef[]>('/archive/players');
  const geslacht = new Map(
    archivePlayers.map((speler) => [speler.id, normalizeGender(speler.gender)]),
  );

  const rijen = await mapLimit(seasons, 4, async (season) => {
    if (season.format === 'archief') {
      const rows = await getData<ArchiveStanding[]>(`/archive/seasons/${season.id}/standings`);
      const maak = (row: ArchiveStanding | undefined): ChampionEntry | null =>
        row ? { name: displayName(row.full_name), average: row.average, playerId: row.player_id } : null;
      return {
        winner: maak(rows[0]),
        women: maak(rows.find((row) => geslacht.get(row.archive_player_id) === 'female')),
      };
    }

    const [algemeen, dames] = await Promise.all([
      getData<{ full_name: string; average: number; id: number }[]>(
        `/rankings/general?season=${season.id}&members=0&limit=1`,
      ),
      getData<{ full_name: string; average: number; id: number }[]>(
        `/rankings/women?season=${season.id}&members=0&limit=1`,
      ),
    ]);
    const maak = (row: { full_name: string; average: number; id: number } | undefined) =>
      row ? { name: displayName(row.full_name), average: row.average, playerId: row.id } : null;
    return { winner: maak(algemeen[0]), women: maak(dames[0]) };
  });

  // Nieuwste bovenaan: een erelijst leest van nu naar toen.
  const lijst = seasons.map((season, i) => ({
    season,
    winner: rijen[i].winner,
    women: rijen[i].women,
    note: null as string | null,
  }));
  lijst.reverse();

  return withNotes(lijst);
}

/**
 * De grijze regel achter een naam ("derde op rij", "twaalf seizoenen na zijn
 * eerste"). Berekend uit de lijst zelf, nooit met de hand getypt: klopt de
 * voorwaarde niet, dan staat er niets in plaats van een halve waarheid.
 */
function withNotes(lijst: Champion[]): Champion[] {
  // De lijst staat nieuwste eerst; voor "op rij" tellen we naar ouder toe.
  return lijst.map((entry, i) => {
    if (!entry.winner) return entry;
    const naam = entry.winner.name;

    let opRij = 1;
    for (let j = i + 1; j < lijst.length; j++) {
      if (lijst[j].winner?.name === naam) opRij++;
      else break;
    }
    if (opRij > 1) {
      const woord = ['', '', 'tweede', 'derde', 'vierde', 'vijfde'][opRij] ?? `${opRij}e`;
      return { ...entry, note: `${woord} op rij` };
    }

    // Geen reeks: stond deze naam er ooit eerder? Dan is de afstand het verhaal.
    const eerste = lijst.findLast((e) => e.winner?.name === naam)!;
    if (eerste !== entry) {
      const jaren = Number(entry.season.slug.slice(0, 4)) - Number(eerste.season.slug.slice(0, 4));
      return { ...entry, note: `${jaren} seizoenen na de eerste titel` };
    }

    if (i === lijst.length - 1) return { ...entry, note: 'de eerste' };
    return entry;
  });
}
