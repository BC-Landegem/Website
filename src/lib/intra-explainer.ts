// De spelregels van de intraclub, één op één overgenomen uit de clubapplicatie
// (github.com/BC-Landegem/Intraclub). Dit bestand rekent, het tekent niets:
// /intraclub/zo-werkt-het/ gebruikt het zowel bij het bouwen (voor de HTML die
// je meteen ziet) als in de browser (wanneer je iets versleept of opnieuw loot),
// zodat er maar één waarheid is.
//
// Herkomst per functie:
//   draw()          → intra-app/js/main.js, generateMatches()
//   trimSet()       → api/src/intraclub/common/Utilities.php, trimSets()
//   dayScore()      → idem, calculateMatchStatistics() → averagePlayerN
//   absenteeScore   → idem, averageLosing + SeasonManager::calculateCurrentSeason()
//   newAverage()    → SeasonManager::calculateCurrentSeason()

export interface Player {
  id: string;
  firstName: string;
  name: string;
  /** Rang in de algemene stand ná deze speeldag. */
  rank: number;
  average: number;
  difference: number;
  /** Gemiddelde ná de vórige speeldag: de stand waarmee er die avond geloot werd. */
  previousAverage: number;
  bonus: number;
  /** Plaats onder de aanwezigen op de avond zelf, 1 = beste. */
  rankOnEvening: number;
}

export interface Court {
  players: string[];
  sets: [number, number][];
}

export const fullName = (player: Player) => `${player.firstName} ${player.name}`;

/**
 * De twee banden overlappen: elke band beslaat 60% van de aanwezigen, de
 * bovenste vanaf de beste speler, de onderste tot de zwakste. Wie in de
 * middelste 20% valt, zit in allebei en kan dus naar boven of naar onder geloot
 * worden.
 */
export function bands(count: number) {
  return {
    /** Eerste index die niet meer in de bovenste band zit. */
    upperEnd: Math.floor(count * 0.6),
    /** Eerste index die wél in de onderste band zit. */
    lowerStart: Math.floor(count * 0.4),
  };
}

export type BandKind = 'upper' | 'overlap' | 'lower';

export function bandOf(index: number, count: number): BandKind {
  const { upperEnd, lowerStart } = bands(count);
  if (index < lowerStart) return 'upper';
  if (index < upperEnd) return 'overlap';
  return 'lower';
}

/** Waar een geloote baan vandaan komt. `rest` is de restbaan, `drawnOut` speelt niet. */
export type CourtSource = 'upper' | 'lower' | 'rest' | 'drawnOut';

export interface DrawnCourt {
  source: CourtSource;
  players: Player[];
}

/**
 * De loting. Spelers moeten op sterkte staan (beste eerst). Om beurt worden er
 * vier namen uit de bovenste en vier uit de onderste band getrokken; wie geloot
 * is, verdwijnt ook uit de andere band. Wat daarna overblijft, wordt samengegooid
 * ongeacht band — vandaar dat de laatste baan spelers uit beide uiteinden kan
 * bevatten. Blijven er minder dan vier over, dan zijn die uitgeloot.
 */
export function draw(byStrength: Player[], random: () => number = Math.random): DrawnCourt[] {
  const { upperEnd, lowerStart } = bands(byStrength.length);
  const upper = byStrength.slice(0, upperEnd);
  const lower = byStrength.slice(lowerStart);
  const courts: DrawnCourt[] = [];

  function drawFour(from: Player[], source: CourtSource) {
    const chosen: Player[] = [];
    for (let i = 0; i < 4; i++) {
      chosen.push(...from.splice(Math.floor(random() * from.length), 1));
    }
    courts.push({ source, players: chosen });
    return chosen;
  }

  function removeFrom(chosen: Player[], from: Player[]) {
    for (const player of chosen) {
      const i = from.indexOf(player);
      if (i > -1) from.splice(i, 1);
    }
  }

  while (upper.length >= 4 || lower.length >= 4) {
    if (upper.length >= 4) removeFrom(drawFour(upper, 'upper'), lower);
    if (lower.length >= 4) removeFrom(drawFour(lower, 'lower'), upper);
  }

  const rest = [...upper, ...lower].filter(
    (player, i, all) => all.findIndex((other) => other.id === player.id) === i,
  );
  if (rest.length >= 4) drawFour(rest, 'rest');
  if (rest.length > 0) courts.push({ source: 'drawnOut', players: [...rest] });

  return courts;
}

/**
 * Wie met wie speelt, per set. De cijfers zijn plaatsen in de baan: in set 1
 * vormen speler 1 en 2 een duo tegen 3 en 4, in set 2 speelt 1 met 3, in set 3
 * met 4. Zo speel je één set met en twee sets tegen elke andere speler.
 */
export const SET_LINEUP = [
  { home: [0, 1], away: [2, 3] },
  { home: [0, 2], away: [1, 3] },
  { home: [0, 3], away: [1, 2] },
] as const;

/** Positie 0–3 in de baan → of die speler in set `set` aan de thuiskant staat. */
export function isHomeSide(position: number, set: number): boolean {
  return (SET_LINEUP[set].home as readonly number[]).includes(position);
}

/**
 * Een set die in verlenging gaat, telt niet zwaarder mee: alles boven 21 wordt
 * proportioneel teruggeschaald. Bij 24–22 krijgt de winnaar 21 en de verliezer
 * 21/24 × 22 = 19,25.
 */
export function trimSet(own: number, other: number): number {
  const highest = Math.max(own, other);
  return highest > 21 ? (21 / highest) * own : own;
}

/** De punten die één speler in de drie sets bij elkaar speelde, na terugschaling. */
export function setPoints(sets: readonly [number, number][], position: number): number[] {
  return SET_LINEUP.map((_, set) => {
    const [home, away] = sets[set];
    return isHomeSide(position, set) ? trimSet(home, away) : trimSet(away, home);
  });
}

/** Je cijfer voor één speeldag: het gemiddelde aantal punten per set. */
export function dayScore(points: readonly number[]): number {
  return points.reduce((sum, p) => sum + p, 0) / points.length;
}

/**
 * Het cijfer dat afwezigen krijgen: over alle banen van die avond het
 * gemiddelde van wat de verliezende duo's per set bij elkaar speelden.
 */
export function absenteeScore(courts: readonly Court[]): number {
  const perCourt = courts.map(
    (court) =>
      court.sets.reduce((sum, [home, away]) => sum + trimSet(Math.min(home, away), Math.max(home, away)), 0) /
      court.sets.length,
  );
  return perCourt.reduce((sum, p) => sum + p, 0) / perCourt.length;
}

/**
 * De score van de tegenstander wanneer jij een set verliest met `points`: 21,
 * of twee meer dan jij zodra de set in verlenging ging. Zo levert elke waarde
 * een geldige badmintonuitslag op.
 */
export function opponentPoints(points: number): number {
  return points <= 19 ? 21 : points + 2;
}

/** De voorsprong waarmee een set begint: het verschil in bonuspunten tussen de duo's. */
export function lead(bonuses: readonly number[], set: number) {
  const { home, away } = SET_LINEUP[set];
  const sumOf = (spots: readonly number[]) =>
    spots.reduce<number>((sum, i) => sum + bonuses[i], 0);
  const homeBonus = sumOf(home);
  const awayBonus = sumOf(away);
  return {
    homeBonus,
    awayBonus,
    home: Math.max(0, homeBonus - awayBonus),
    away: Math.max(0, awayBonus - homeBonus),
  };
}

/**
 * De stand is het gemiddelde van je basispunt en al je speeldagcijfers. Na
 * `matchdays` speeldagen zijn dat `matchdays + 1` waarden, dus één speeldag
 * erbij verschuift je stand maar een beetje — en steeds minder naarmate het
 * seizoen vordert.
 */
export function newAverage(previousAverage: number, dayScore: number, matchdays: number): number {
  return (previousAverage * matchdays + dayScore) / (matchdays + 1);
}

/** Vaste komma en Belgische komma, zoals de rest van de site cijfers toont. */
export function formatComma(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}
