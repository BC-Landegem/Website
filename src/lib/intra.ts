// Gedeelde types en helpers voor de intraclub-pagina's die hun data in de
// browser ophalen: het klassement, één speeldag en één speler.
//
// De bevroren data (archief, afgesloten seizoenen, records) loopt niet langs
// dit bestand maar langs src/lib/intra-build.ts — die haalt op tijdens de build
// en zet er platte HTML van neer.
export const INTRA_API =
  import.meta.env.PUBLIC_INTRA_API ?? 'https://intra.bclandegem.be/api';

export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
}

export interface RankingRow extends Player {
  average: number;
  rank: number;
  difference: number;
}

/** De speeldag waarop een klassement geldt; `null` zolang er geen berekend is. */
export interface RankingRound {
  id: number;
  number: number;
  date: string;
}

export interface RankingMeta {
  category: string;
  season: { id: number; name: string };
  round: RankingRound | null;
}

export interface Round {
  id: number;
  number: number;
  date: string;
  is_calculated: boolean;
  average_absent: number;
  games_count: number;
  /** Het echte aantal aanwezigen. Niet games_count × 4: dat klopt niet zodra er iemand uitgeloot is. */
  players_present: number;
  players_drawn_out: number;
}

export interface SetSide {
  player_ids: number[];
  /** `null` wanneer de set niet gespeeld is. */
  score: number | null;
  /** Som van de bonuspunten van dit duo; het verschil is de voorsprong waarmee gestart werd. */
  bonus: number;
}

export interface GameSet {
  number: number;
  is_played: boolean;
  winner: 'home' | 'away' | null;
  home: SetSide;
  away: SetSide;
}

export interface Game {
  id: number;
  round?: RankingRound;
  players: (Player & { bonus_points: number })[];
  is_complete: boolean;
  sets: GameSet[];
}

/** Eén statistiekrij per speler voor één speeldag: aanwezig, uitgeloot of afwezig. */
export interface Attendance {
  player: Player & { bonus_points: number };
  is_present: boolean;
  is_drawn_out: boolean;
  /** Gespeeld: het herschaalde puntengemiddelde. Afwezig: het verliezersgemiddelde. Uitgeloot: null. */
  day_score: number | null;
  average: number | null;
  rank: number | null;
}

export interface RoundDetail extends Round {
  season: { id: number; name: string };
  games: Game[];
  attendances: Attendance[];
}

export type RankingCategory = 'general' | 'women' | 'recreants' | 'veterans';

/**
 * Elke collectie zit in `data`, met `meta` ernaast. Twee helpers dus: één die
 * beide teruggeeft (nodig voor `meta.round`) en één die enkel de rijen wil.
 */
export async function fetchApi<T, M = unknown>(path: string): Promise<{ data: T; meta?: M }> {
  const res = await fetch(`${INTRA_API}${path}`);
  if (!res.ok) throw new Error(`API-fout: ${res.status}`);
  return res.json();
}

export async function fetchData<T>(path: string): Promise<T> {
  return (await fetchApi<T>(path)).data;
}

/**
 * Namen komen uit handmatig gevulde velden en dragen soms rommel: er staat een
 * lid in met achternaam `"Van Haute "`, spatie op het einde. Dat valt op als
 * een gat vóór de komma, en het levert een slug op die op een streepje eindigt.
 */
export function displayName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/** Namen komen uit een databank en gaan via innerHTML naar het scherm. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

export function playerUrl(id: number | string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/speler/?id=${id}`;
}

export function matchdayUrl(id: number | string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/speeldag/?id=${id}`;
}

function kebab(name: string): string {
  return displayName(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Slug voor een loopbaanpagina. Het id staat voorop met een letter ervoor, want
 * er zijn twee id-ruimtes die elkaar overlappen: een huidig lid (`s`) en een
 * speler die enkel in het archief bestaat (`a`). Namen komen dubbel voor en het
 * archief bevat zelfs een rij zonder naam, dus het id draagt de identiteit en
 * de naam alleen de leesbaarheid.
 *
 * Staat hier en niet in intra-build.ts omdat de spelerspagina hem in de browser
 * moet kunnen samenstellen om naar de loopbaan door te linken.
 */
export function careerSlug(person: { playerId?: number | null; archiveId?: number | null; name: string }): string {
  const sleutel = person.playerId ? `s${person.playerId}` : `a${person.archiveId}`;
  const naam = kebab(person.name);
  return naam ? `${sleutel}-${naam}` : sleutel;
}

export function careerUrl(person: { playerId?: number | null; archiveId?: number | null; name: string }): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/loopbaan/${careerSlug(person)}/`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Twee decimalen met een komma, zoals de rest van de site cijfers zet. */
export function decimal(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return '–';
  return value.toFixed(digits).replace('.', ',');
}

/**
 * In welke toestand het seizoen verkeert. De API heeft daar geen vlag voor:
 * ze geeft altijd het "huidige" seizoen, ook wanneer dat sinds mei afgelopen
 * is. Zonder deze afleiding staat er van juni tot september een bevroren
 * eindstand op de pagina alsof het de stand van deze week is.
 */
export type SeasonState = 'loopt' | 'af' | 'nieuw';

/** Acht weken zonder berekende speeldag: dan is het geen lopend seizoen meer. */
const STILGEVALLEN_MS = 8 * 7 * 24 * 60 * 60 * 1000;

export function seasonState(round: RankingRound | null, now = new Date()): SeasonState {
  if (!round) return 'nieuw';
  return now.getTime() - new Date(round.date).getTime() > STILGEVALLEN_MS ? 'af' : 'loopt';
}

/**
 * De regel naast de kop van het klassement, in de toestand waarin het seizoen
 * verkeert. Geeft HTML terug: de speeldag is een link naar zijn uitslagen.
 */
export function standingLine(meta: RankingMeta, now = new Date()): string {
  const state = seasonState(meta.round, now);
  if (state === 'nieuw') {
    return `Seizoen ${esc(seasonLabel(meta.season.name))} — de stand vertrekt van de basispunten.`;
  }
  const round = meta.round!;
  const link = `<a href="${matchdayUrl(round.id)}" class="font-semibold text-club-700 hover:text-club-800 hover:underline">speeldag ${round.number} (${formatDate(round.date)})</a>`;
  return state === 'af'
    ? `Eindstand ${esc(seasonLabel(meta.season.name))}, na ${link}`
    : `Stand na ${link}`;
}

/**
 * De API schrijft seizoensnamen niet uniform: "2009 - 2010" naast "2023-2024".
 * Eén vorm op het scherm, en dezelfde vorm in de URL (zie intra-build.ts).
 */
export function seasonLabel(name: string): string {
  return name.replace(/\s+/g, '');
}

function playerHtml(player: Player, highlightId?: number): string {
  const name = esc(player.full_name);
  if (highlightId !== undefined && player.id === highlightId) {
    return `<span class="bg-club-100 px-1 font-semibold text-club-800">${name}</span>`;
  }
  return `<a href="${playerUrl(player.id)}" class="hover:text-club-600 hover:underline">${name}</a>`;
}

function duoHtml(duo: Player[], wins: boolean, highlightId?: number): string {
  const names = duo.map((player) => playerHtml(player, highlightId)).join(' &amp; ');
  return wins ? `<span class="font-semibold">${names}</span>` : names;
}

/**
 * Rendert de drie sets van een wedstrijd als rijen "duo — score — duo".
 *
 * De samenstelling per set komt uit de API (`sets[].home/away.player_ids`); de
 * rotatiehelper die dat vroeger in de browser uitrekende is weg. Ook `winner`
 * en `is_played` komen mee: een gelijke of ongespeelde set telt als winst voor
 * het uitduo, en dat is een regel die bij de puntenberekening hoort, niet hier.
 */
export function renderGameSets(game: Game, highlightId?: number): string {
  const byId = new Map(game.players.map((player) => [player.id, player]));
  const lookup = (ids: number[]) => ids.map((id) => byId.get(id)).filter(Boolean) as Player[];

  return game.sets
    .map((set) => {
      const scoreHtml = set.is_played
        ? `${set.home.score}–${set.away.score}`
        : '<span class="text-ink-950/20">–</span>';
      const bonus = (side: SetSide) =>
        `<span class="type-numeral ml-1 text-[0.65rem] font-normal text-ink-500">+${side.bonus}</span>`;
      // Mobiel: label + score op één lijn, de duo's eronder. Vanaf sm: alles op één rij.
      // minmax(0,1fr) laat de namen krimpen/afbreken i.p.v. de kaart breder te duwen.
      return `
        <div class="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 border-b border-ink-950/5 py-2 last:border-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:border-0 sm:py-1">
          <span class="type-label text-xs text-ink-500">Set ${set.number}</span>
          <span class="type-numeral min-w-14 justify-self-start bg-feather-100 px-2 py-0.5 text-center sm:col-start-3 sm:row-start-1 sm:justify-self-auto">${scoreHtml}</span>
          <span class="col-start-2 hyphens-auto break-words sm:row-start-1 sm:text-right">${duoHtml(lookup(set.home.player_ids), set.winner === 'home', highlightId)}${bonus(set.home)}</span>
          <span class="col-start-2 hyphens-auto break-words sm:col-start-4 sm:row-start-1">${duoHtml(lookup(set.away.player_ids), set.winner === 'away', highlightId)}${bonus(set.away)}</span>
        </div>`;
    })
    .join('');
}

/** Eén wedstrijdkaart: drie set-rijen in een scherp omkaderd blok. */
export function renderGameCard(game: Game, highlightId?: number): string {
  return `<div class="border border-ink-950/10 p-4 text-sm">${renderGameSets(game, highlightId)}</div>`;
}
