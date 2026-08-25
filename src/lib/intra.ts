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

export type RankingCategorie = 'general' | 'women' | 'recreants' | 'veterans';

/**
 * /rankings geeft alle vier de categorieën in één keer, /rankings/<categorie>
 * er precies één. Dat laatste is ruim twee keer sneller — de API rekent per
 * speler het verschil met de vorige speeldag uit — dus halen de pagina's per
 * categorie op: enkel wat er op het scherm staat.
 */
export type Rankings = { seasonId: number } & Partial<Record<RankingCategorie, RankingRij[]>>;

export interface Ronde {
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
export function laatsteBerekend(rondes: Ronde[]): Ronde | undefined {
  return rondes.reduce<Ronde | undefined>(
    (beste, ronde) =>
      ronde.calculated === '1' && (!beste || Number(ronde.number) > Number(beste.number))
        ? ronde
        : beste,
    undefined,
  );
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
    return `<span class="bg-club-100 px-1 font-semibold text-club-800">${naam(speler)}</span>`;
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
        : '<span class="text-inkt-950/20">–</span>';
      // Mobiel: label + score op één lijn, de duo's eronder. Vanaf sm: alles op één rij.
      // minmax(0,1fr) laat de namen krimpen/afbreken i.p.v. de kaart breder te duwen.
      return `
        <div class="grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-2 gap-y-0.5 border-b border-inkt-950/5 py-2 last:border-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto_minmax(0,1fr)] sm:border-0 sm:py-1">
          <span class="stem-baan text-xs text-inkt-500">${label}</span>
          <span class="stem-cijfer min-w-14 justify-self-start bg-veer-100 px-2 py-0.5 text-center sm:col-start-3 sm:row-start-1 sm:justify-self-auto">${scoreHtml}</span>
          <span class="col-start-2 hyphens-auto break-words sm:row-start-1 sm:text-right">${duoHtml(thuis, gespeeld && score.home > score.away, highlightId)}</span>
          <span class="col-start-2 hyphens-auto break-words sm:col-start-4 sm:row-start-1">${duoHtml(uit, gespeeld && score.away > score.home, highlightId)}</span>
        </div>`;
    })
    .join('');
}

/** Eén matchkaart: drie set-rijen in een scherp omkaderd blok. */
export function renderMatchKaart(match: Match, highlightId?: string): string {
  return `<div class="border border-inkt-950/10 p-4 text-sm">${renderMatchSets(match, highlightId)}</div>`;
}
