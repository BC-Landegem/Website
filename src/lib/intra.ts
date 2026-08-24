// Gedeelde types en helpers voor de intraclub-pagina's (client-side gebruikt).
export const INTRA_API = 'https://www.bclandegem.be/intra-app/api/index.php';

export interface Speler {
  id: string;
  firstName: string;
  name: string;
}

export interface SetScore {
  home: number;
  away: number;
}

export interface Match {
  firstPlayer: Speler;
  secondPlayer: Speler;
  thirdPlayer: Speler;
  fourthPlayer: Speler;
  firstSet: SetScore;
  secondSet: SetScore;
  thirdSet: SetScore;
  round?: { id: number; number: number };
}

export interface RankingRij extends Speler {
  average: number;
  rank: number;
  difference: number;
}

export async function fetchJson<T>(pad: string): Promise<T> {
  const res = await fetch(`${INTRA_API}${pad}`);
  if (!res.ok) throw new Error(`API-fout: ${res.status}`);
  return res.json();
}

export const naam = (speler: Speler) => `${speler.firstName} ${speler.name}`;

export function spelerUrl(id: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/speler/?id=${id}`;
}

export function speeldagUrl(id: string | number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/intraclub/speeldag/?id=${id}`;
}

export function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString('nl-BE', {
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
export function setIndeling(match: Match) {
  const [p1, p2, p3, p4] = [match.firstPlayer, match.secondPlayer, match.thirdPlayer, match.fourthPlayer];
  return [
    { label: 'Set 1', thuis: [p1, p2], uit: [p3, p4], score: match.firstSet },
    { label: 'Set 2', thuis: [p1, p3], uit: [p2, p4], score: match.secondSet },
    { label: 'Set 3', thuis: [p1, p4], uit: [p2, p3], score: match.thirdSet },
  ];
}

function spelerHtml(speler: Speler, highlightId?: string): string {
  const isHighlight = highlightId !== undefined && speler.id === highlightId;
  if (isHighlight) {
    return `<span class="rounded bg-club-100 px-1 font-semibold text-club-800">${naam(speler)}</span>`;
  }
  return `<a href="${spelerUrl(speler.id)}" class="hover:text-club-600 hover:underline">${naam(speler)}</a>`;
}

function duoHtml(duo: Speler[], wint: boolean, highlightId?: string): string {
  const namen = duo.map((speler) => spelerHtml(speler, highlightId)).join(' &amp; ');
  return wint ? `<span class="font-semibold">${namen}</span>` : namen;
}

/**
 * Rendert de drie sets van een match als rijen "duo — score — duo",
 * zodat de wisselende samenstelling per set duidelijk is. Het winnende
 * duo staat in het vet.
 */
export function renderMatchSets(match: Match, highlightId?: string): string {
  return setIndeling(match)
    .map(({ label, thuis, uit, score }) => {
      const gespeeld = score.home > 0 || score.away > 0;
      const scoreHtml = gespeeld
        ? `${score.home}–${score.away}`
        : '<span class="text-neutral-300">–</span>';
      return `
        <div class="grid grid-cols-[2.75rem_1fr_auto_1fr] items-center gap-x-2 py-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-neutral-400">${label}</span>
          <span class="text-right">${duoHtml(thuis, gespeeld && score.home > score.away, highlightId)}</span>
          <span class="min-w-14 rounded bg-neutral-100 px-2 py-0.5 text-center font-bold tabular-nums">${scoreHtml}</span>
          <span>${duoHtml(uit, gespeeld && score.away > score.home, highlightId)}</span>
        </div>`;
    })
    .join('');
}

/** Eén matchkaart: drie set-rijen in een omkaderd blok. */
export function renderMatchKaart(match: Match, highlightId?: string): string {
  return `<div class="rounded-xl border border-neutral-200 p-4 text-sm">${renderMatchSets(match, highlightId)}</div>`;
}
