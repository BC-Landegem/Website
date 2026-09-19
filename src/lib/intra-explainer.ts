// De spelregels van de intraclub, één op één overgenomen uit de clubapplicatie
// (github.com/BC-Landegem/Intraclub). Dit bestand rekent, het tekent niets:
// /intraclub/zo-werkt-het/ gebruikt het zowel bij het bouwen (voor de HTML die
// je meteen ziet) als in de browser (wanneer je iets versleept of opnieuw loot),
// zodat er maar één waarheid is.
//
// Herkomst per functie, telkens in app/app/ van die repository:
//   draw()              → Services/DrawService.php, composeGames() + selectSittingOut()
//   drawStrengthGroups  → idem, byStrengthGroups()
//   drawVaryingOpponents→ idem, byVaryingOpponents(), hardestToPlace(), leastMet()
//   remember()          → Services/SeasonEncounters.php
//   startScores()       → Services/Handicap.php
//   trimSet()           → Services/GameStatistics.php (trim naar het setmaximum)
//   dayScore()          → idem → gemiddelde per speler
//   absenteeScore()     → idem, verliezersgemiddelde + SeasonCalculator
//   newAverage()        → Services/SeasonCalculator.php
//   setCap(), startingBasePoints() → Enums/PointsPerSet.php

export interface Player {
  id: string;
  firstName: string;
  name: string;
  /** Rang in de algemene stand ná deze speeldag. */
  rank: number;
  average: number;
  difference: number;
  /** Waarmee de speler het seizoen begon: 14,000 of 19,000 plus de tiebreaker. */
  basePoints: number;
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

/* ── De puntenschaal ────────────────────────────────────────────────────── */

/** Tot hoeveel punten een set gaat: 15 sinds 2026-2027, 21 daarvoor. */
export type PointsPerSet = 15 | 21;

/**
 * Het plafond van een verlenging. Een set gaat tot het setmaximum met twee
 * punten verschil; op één punt onder het plafond beslist het volgende punt.
 */
export function setCap(pointsPerSet: PointsPerSet): number {
  return pointsPerSet === 15 ? 21 : 30;
}

/**
 * Het basispunt van de laatste in de stand bij de seizoensstart. Wie hoger
 * eindigde, krijgt er per plaats 0,0001 bovenop.
 */
export function startingBasePoints(pointsPerSet: PointsPerSet): number {
  return pointsPerSet === 15 ? 14 : 19;
}

/* ── De loting ──────────────────────────────────────────────────────────── */

/**
 * Welke regel de viertallen samenstelt. Tot nieuwjaar `varying`, vanaf januari
 * `strength`. Wie meedoet en wie aan de kant blijft, is voor beide hetzelfde.
 */
export type DrawSystem = 'varying' | 'strength';

export const DRAW_SYSTEM_NAME: Record<DrawSystem, string> = {
  varying: 'Wisselende tegenstanders',
  strength: 'Sterktegroepen',
};

export const DRAW_SYSTEM_PERIOD: Record<DrawSystem, string> = {
  varying: 'tot nieuwjaar',
  strength: 'vanaf januari',
};

/**
 * De twee banden van de sterktegroepen overlappen: elke band beslaat 60% van de
 * spelers, de bovenste vanaf de beste, de onderste tot de zwakste. Wie in de
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

/**
 * Waar een gelote baan vandaan komt. `upper`, `lower` en `rest` zijn de
 * sterktegroepen en hun restbaan; `varying` is een baan uit de loting op
 * wisselende tegenstanders; `drawnOut` zijn de spelers die aan de kant blijven.
 */
export type CourtSource = 'upper' | 'lower' | 'rest' | 'varying' | 'drawnOut';

export interface DrawnCourt {
  source: CourtSource;
  players: Player[];
  /** Hoeveel van de zes tweetallen op deze baan dit seizoen al eens samen op een baan stonden. */
  repeats: number;
}

/**
 * Het geheugen van de loting: wie stond dit seizoen met wie op een baan, en hoe
 * vaak. In de clubapplicatie wordt het elke avond opnieuw uit alle wedstrijden
 * van het seizoen geteld; hier bouwt de pagina het op uit de banen die ze toont.
 */
export type Encounters = Map<string, Map<string, number>>;

/** Tel één baan bij het geheugen. */
export function remember(encounters: Encounters, players: readonly Player[]): void {
  for (const player of players) {
    for (const other of players) {
      if (player.id === other.id) continue;
      const row = encounters.get(player.id) ?? new Map<string, number>();
      row.set(other.id, (row.get(other.id) ?? 0) + 1);
      encounters.set(player.id, row);
    }
  }
}

export function timesMet(encounters: Encounters, a: Player, b: Player): number {
  return encounters.get(a.id)?.get(b.id) ?? 0;
}

/** Hoeveel tweetallen op deze baan elkaar al kenden. */
export function repeatsOn(encounters: Encounters, players: readonly Player[]): number {
  let repeats = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      if (timesMet(encounters, players[i], players[j]) > 0) repeats++;
    }
  }
  return repeats;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function pickFour(from: readonly Player[], random: () => number): Player[] {
  return shuffle([...from], random).slice(0, 4);
}

/**
 * De loting van één avond. `byStrength` staat op sterkte (beste eerst).
 *
 * Eerst wordt bepaald wie aan de kant blijft: enkel de rest na deling door vier.
 * Daardoor is het aantal spelers een veelvoud van vier en houdt geen van de twee
 * samenstellers iemand over. In de clubapplicatie zijn wie de voorbije vijf
 * speeldagen al uitgeloot werd beschermd; dit voorbeeld kent maar één avond, dus
 * hier beslist het toeval.
 *
 * `encounters` is het geheugen waarmee wisselende tegenstanders rekent. Het wordt
 * hier alleen gelezen: wie de baan van vanavond wil onthouden, roept `remember()`.
 */
export function draw(
  byStrength: readonly Player[],
  system: DrawSystem,
  encounters: Encounters,
  random: () => number = Math.random,
): DrawnCourt[] {
  const sitOutCount = byStrength.length % 4;
  const drawnOut = new Set(shuffle([...byStrength], random).slice(0, sitOutCount));
  const playing = byStrength.filter((player) => !drawnOut.has(player));

  const courts =
    system === 'varying'
      ? drawVaryingOpponents(playing, encounters, random)
      : drawStrengthGroups(playing, random);

  for (const court of courts) court.repeats = repeatsOn(encounters, court.players);
  if (drawnOut.size > 0) courts.push({ source: 'drawnOut', players: [...drawnOut], repeats: 0 });

  return courts;
}

/**
 * Sterktegroepen: beurtelings vier namen uit de bovenste en vier uit de onderste
 * band, willekeurig binnen de band. Wie geloot is, verdwijnt uit allebei. Wat
 * daarna overblijft, komt samen op de restbaan, ongeacht band.
 */
function drawStrengthGroups(playing: readonly Player[], random: () => number): DrawnCourt[] {
  const { upperEnd, lowerStart } = bands(playing.length);
  const groups: { source: CourtSource; players: readonly Player[] }[] = [
    { source: 'upper', players: playing.slice(0, upperEnd) },
    { source: 'lower', players: playing.slice(lowerStart) },
  ];
  const used = new Set<string>();
  const courts: DrawnCourt[] = [];

  let drewThisPass: boolean;
  do {
    drewThisPass = false;
    for (const group of groups) {
      const available = group.players.filter((player) => !used.has(player.id));
      if (available.length < 4) continue;
      const picked = pickFour(available, random);
      for (const player of picked) used.add(player.id);
      courts.push({ source: group.source, players: picked, repeats: 0 });
      drewThisPass = true;
    }
  } while (drewThisPass);

  let remaining = playing.filter((player) => !used.has(player.id));
  while (remaining.length >= 4) {
    const picked = pickFour(remaining, random);
    courts.push({ source: 'rest', players: picked, repeats: 0 });
    remaining = remaining.filter((player) => !picked.includes(player));
  }

  return courts;
}

/**
 * Wisselende tegenstanders: deel in op wie dit seizoen nog het minst tegen
 * elkaar speelde. Sterkte speelt geen rol.
 *
 * Elk viertal begint bij wie het moeilijkst te plaatsen is (de speler die met de
 * meeste nog wachtende spelers al op een baan stond) en wordt aangevuld met
 * telkens de kandidaat die de spelers op de baan het minst kent. Staat het
 * viertal op drie en is er gelijke stand, dan wint de kandidaat waarbij de
 * grootste voorsprong over de drie sets het kleinst blijft.
 */
function drawVaryingOpponents(
  playing: readonly Player[],
  encounters: Encounters,
  random: () => number,
): DrawnCourt[] {
  const left = shuffle([...playing], random);
  const courts: DrawnCourt[] = [];

  while (left.length >= 4) {
    const game = left.splice(hardestToPlace(left, encounters), 1);
    while (game.length < 4) {
      game.push(...left.splice(leastMet(game, left, encounters), 1));
    }
    courts.push({ source: 'varying', players: game, repeats: 0 });
  }

  return courts;
}

/** De index van de speler die met de meeste anderen in `left` al op een baan stond. */
function hardestToPlace(left: readonly Player[], encounters: Encounters): number {
  let hardest = 0;
  let highestMet = -1;
  left.forEach((player, index) => {
    let met = 0;
    for (const other of left) if (other.id !== player.id) met += timesMet(encounters, player, other);
    if (met > highestMet) {
      hardest = index;
      highestMet = met;
    }
  });
  return hardest;
}

/**
 * De index van de kandidaat die het minst tegen dit halve viertal speelde. Bij
 * gelijke stand en een viertal op drie beslist de laagste hoogste voorsprong.
 * Gerangschikt op de som van de ontmoetingen, niet op de ergste ervan; zie de
 * toelichting in DrawService::leastMet().
 */
function leastMet(game: readonly Player[], candidates: readonly Player[], encounters: Encounters): number {
  let chosen = 0;
  let best: [number, number] | null = null;
  candidates.forEach((candidate, index) => {
    let met = 0;
    for (const member of game) met += timesMet(encounters, member, candidate);
    const handicap = game.length === 3 ? highestGap([...game, candidate].map((p) => p.bonus)) : 0;
    if (best === null || met < best[0] || (met === best[0] && handicap < best[1])) {
      chosen = index;
      best = [met, handicap];
    }
  });
  return chosen;
}

/** De grootste handicap die in dit viertal over de drie sets voorkomt. */
export function highestGap(bonuses: readonly number[]): number {
  return Math.max(...SET_LINEUP.map((_, set) => startScores(bonuses, set).gap));
}

/* ── Op de baan ─────────────────────────────────────────────────────────── */

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
 * De stand waarop de twee duo's aan een set beginnen. Het verschil tussen de
 * bonussommen is de handicap H, en die wordt gesplitst: het duo met de meeste
 * bonuspunten (het zwakkere) begint op ⌈H/2⌉, het andere op −⌊H/2⌋. Bij H=6 is
 * dat 3 en −3, bij H=7 4 en −3. Tot en met 2025-2026 kreeg het zwakkere duo het
 * hele verschil; sinds 2026-2027 ligt de afstand rond nul.
 */
export function startScores(bonuses: readonly number[], set: number) {
  const { home, away } = SET_LINEUP[set];
  const sumOf = (spots: readonly number[]) => spots.reduce<number>((sum, i) => sum + bonuses[i], 0);
  const homeBonus = sumOf(home);
  const awayBonus = sumOf(away);
  const difference = homeBonus - awayBonus;
  const gap = Math.abs(difference);
  const weaker = Math.ceil(gap / 2);
  const stronger = gap === 0 ? 0 : -Math.floor(gap / 2);
  return {
    homeBonus,
    awayBonus,
    gap,
    home: difference >= 0 ? weaker : stronger,
    away: difference >= 0 ? stronger : weaker,
  };
}

/** Een startstand met teken, met een echt minteken: +3, −3, 0. */
export function signed(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${-value}`;
  return '0';
}

/* ── Van uitslag naar stand ─────────────────────────────────────────────── */

/**
 * Een set die in verlenging gaat, telt niet zwaarder mee: alles boven het
 * setmaximum wordt proportioneel teruggeschaald. Bij sets tot 15 krijgt de
 * winnaar van 17–15 dus 15 en de verliezer 15/17 × 15 = 13,24.
 */
export function trimSet(own: number, other: number, pointsPerSet: PointsPerSet): number {
  const highest = Math.max(own, other);
  return highest > pointsPerSet ? (pointsPerSet / highest) * own : own;
}

/** De punten die één speler in de drie sets bij elkaar speelde, na terugschaling. */
export function setPoints(
  sets: readonly [number, number][],
  position: number,
  pointsPerSet: PointsPerSet,
): number[] {
  return SET_LINEUP.map((_, set) => {
    const [home, away] = sets[set];
    return isHomeSide(position, set) ? trimSet(home, away, pointsPerSet) : trimSet(away, home, pointsPerSet);
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
export function absenteeScore(courts: readonly Court[], pointsPerSet: PointsPerSet): number {
  const perCourt = courts.map(
    (court) =>
      court.sets.reduce(
        (sum, [home, away]) => sum + trimSet(Math.min(home, away), Math.max(home, away), pointsPerSet),
        0,
      ) / court.sets.length,
  );
  return perCourt.reduce((sum, p) => sum + p, 0) / perCourt.length;
}

/**
 * De score van de tegenstander wanneer jij een set verliest met `points`: het
 * setmaximum, of twee meer dan jij zodra de set in verlenging ging, tot aan het
 * plafond. Zo levert elke waarde een geldige badmintonuitslag op.
 */
export function opponentPoints(points: number, pointsPerSet: PointsPerSet): number {
  return points <= pointsPerSet - 2 ? pointsPerSet : Math.min(points + 2, setCap(pointsPerSet));
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
