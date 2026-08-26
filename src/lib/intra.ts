// Gedeelde types en helpers voor de intraclub-pagina's (client-side gebruikt).
export const INTRA_API = 'https://www.bclandegem.be/intra-app/api/index.php';

export interface Player {
  id: string;
  firstName: string;
  name: string;
}

export interface SetScore {
  home: number;
  away: number;
}

export interface Match {
  firstPlayer: Player;
  secondPlayer: Player;
  thirdPlayer: Player;
  fourthPlayer: Player;
  firstSet: SetScore;
  secondSet: SetScore;
  thirdSet: SetScore;
  round?: { id: number; number: number };
}

export interface RankingRow extends Player {
  average: number;
  rank: number;
  difference: number;
}

export type RankingCategory = 'general' | 'women' | 'recreants' | 'veterans';

/**
 * /rankings geeft alle vier de categorieën in één keer, /rankings/<categorie>
 * er precies één. Dat laatste is ruim twee keer sneller — de API rekent per
 * speler het verschil met de vorige speeldag uit — dus halen de pagina's per
 * categorie op: enkel wat er op het scherm staat.
 */
export type Rankings = { seasonId: number } & Partial<Record<RankingCategory, RankingRow[]>>;

export interface Round {
  id: string;
  number: string;
  date: string;
  calculated: string;
  matches: string;
  averageAbsent: string;
}

/**
 * De laatst berekende speeldag. De API heeft daar een eigen endpoint voor
 * (/rounds/latestCalculated), maar dat sleept alle matchen én alle
 * aanwezigheden van die speeldag mee — 2,3 kB gzip tegen 0,3 kB voor heel
 * /rounds — terwijl we enkel nummer en datum nodig hebben. /rounds bevat dat
 * al, dus scheelt dit een volledig request op het kritieke pad.
 */
export function lastCalculated(rounds: Round[]): Round | undefined {
  return rounds.reduce<Round | undefined>(
    (best, round) =>
      round.calculated === '1' && (!best || Number(round.number) > Number(best.number))
        ? round
        : best,
    undefined,
  );
}

export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${INTRA_API}${path}`);
  if (!res.ok) throw new Error(`API-fout: ${res.status}`);
  return res.json();
}

export const fullName = (player: Player) => `${player.firstName} ${player.name}`;

export function playerUrl(id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/speler/?id=${id}`;
}

export function matchdayUrl(id: string | number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/speeldag/?id=${id}`;
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Een intraclub-match wordt gespeeld door 4 spelers die elke set in een
 * andere samenstelling dubbelen: set 1 = 1+2 vs 3+4, set 2 = 1+3 vs 2+4,
 * set 3 = 1+4 vs 2+3.
 */
export function setLineup(match: Match) {
  const [p1, p2, p3, p4] = [match.firstPlayer, match.secondPlayer, match.thirdPlayer, match.fourthPlayer];
  return [
    { label: 'Set 1', home: [p1, p2], away: [p3, p4], score: match.firstSet },
    { label: 'Set 2', home: [p1, p3], away: [p2, p4], score: match.secondSet },
    { label: 'Set 3', home: [p1, p4], away: [p2, p3], score: match.thirdSet },
  ];
}

function playerHtml(player: Player, highlightId?: string): string {
  const isHighlight = highlightId !== undefined && player.id === highlightId;
  if (isHighlight) {
    return `<span class="bg-club-100 px-1 font-semibold text-club-800">${fullName(player)}</span>`;
  }
  return `<a href="${playerUrl(player.id)}" class="hover:text-club-600 hover:underline">${fullName(player)}</a>`;
}

function duoHtml(duo: Player[], wins: boolean, highlightId?: string): string {
  const names = duo.map((player) => playerHtml(player, highlightId)).join(' &amp; ');
  return wins ? `<span class="font-semibold">${names}</span>` : names;
}

/**
 * Rendert de drie sets van een match als rijen "duo — score — duo",
 * zodat de wisselende samenstelling per set duidelijk is. Het winnende
 * duo staat in het vet.
 */
export function renderMatchSets(match: Match, highlightId?: string): string {
  return setLineup(match)
    .map(({ label, home, away, score }) => {
      const played = score.home > 0 || score.away > 0;
      const scoreHtml = played
        ? `${score.home}–${score.away}`
        : '<span class="text-ink-950/20">–</span>';
      // Mobiel: label + score op één lijn, de duo's eronder. Vanaf sm: alles op één rij.
      // minmax(0,1fr) laat de namen krimpen/afbreken i.p.v. de kaart breder te duwen.
      return `
        <div class="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 border-b border-ink-950/5 py-2 last:border-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:border-0 sm:py-1">
          <span class="type-label text-xs text-ink-500">${label}</span>
          <span class="type-numeral min-w-14 justify-self-start bg-feather-100 px-2 py-0.5 text-center sm:col-start-3 sm:row-start-1 sm:justify-self-auto">${scoreHtml}</span>
          <span class="col-start-2 hyphens-auto break-words sm:row-start-1 sm:text-right">${duoHtml(home, played && score.home > score.away, highlightId)}</span>
          <span class="col-start-2 hyphens-auto break-words sm:col-start-4 sm:row-start-1">${duoHtml(away, played && score.away > score.home, highlightId)}</span>
        </div>`;
    })
    .join('');
}

/** Eén matchkaart: drie set-rijen in een scherp omkaderd blok. */
export function renderMatchCard(match: Match, highlightId?: string): string {
  return `<div class="border border-ink-950/10 p-4 text-sm">${renderMatchSets(match, highlightId)}</div>`;
}
