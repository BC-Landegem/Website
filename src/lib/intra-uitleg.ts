// De spelregels van de intraclub, één op één overgenomen uit de clubapplicatie
// (github.com/BC-Landegem/Intraclub). Dit bestand rekent, het tekent niets:
// /intraclub/zo-werkt-het/ gebruikt het zowel bij het bouwen (voor de HTML die
// je meteen ziet) als in de browser (wanneer je iets versleept of opnieuw loot),
// zodat er maar één waarheid is.
//
// Herkomst per functie:
//   loot()          → intra-app/js/main.js, generateMatches()
//   trimSet()       → api/src/intraclub/common/Utilities.php, trimSets()
//   dagcijfer()     → idem, calculateMatchStatistics() → averagePlayerN
//   afwezigencijfer → idem, averageLosing + SeasonManager::calculateCurrentSeason()
//   nieuweStand()   → SeasonManager::calculateCurrentSeason()

export interface Speler {
  id: string;
  voornaam: string;
  naam: string;
  /** Rang in de algemene stand ná deze speeldag. */
  rang: number;
  gemiddelde: number;
  verschil: number;
  /** Gemiddelde ná de vórige speeldag: de stand waarmee er die avond geloot werd. */
  vorigGemiddelde: number;
  bonus: number;
  /** Plaats onder de aanwezigen op de avond zelf, 1 = beste. */
  rangOpAvond: number;
}

export interface Baan {
  spelers: string[];
  sets: [number, number][];
}

export const volledigeNaam = (speler: Speler) => `${speler.voornaam} ${speler.naam}`;

/**
 * De twee banden overlappen: elke band beslaat 60% van de aanwezigen, de
 * bovenste vanaf de beste speler, de onderste tot de zwakste. Wie in de
 * middelste 20% valt, zit in allebei en kan dus naar boven of naar onder geloot
 * worden.
 */
export function banden(aantal: number) {
  return {
    /** Eerste index die niet meer in de bovenste band zit. */
    totBoven: Math.floor(aantal * 0.6),
    /** Eerste index die wél in de onderste band zit. */
    vanOnder: Math.floor(aantal * 0.4),
  };
}

export type Bandsoort = 'boven' | 'overlap' | 'onder';

export function bandVan(index: number, aantal: number): Bandsoort {
  const { totBoven, vanOnder } = banden(aantal);
  if (index < vanOnder) return 'boven';
  if (index < totBoven) return 'overlap';
  return 'onder';
}

/** Waar een geloote baan vandaan komt. `rest` is de restbaan, `uitgeloot` speelt niet. */
export type Baanbron = 'boven' | 'onder' | 'rest' | 'uitgeloot';

export interface GelooteBaan {
  bron: Baanbron;
  spelers: Speler[];
}

/**
 * De loting. Spelers moeten op sterkte staan (beste eerst). Om beurt worden er
 * vier namen uit de bovenste en vier uit de onderste band getrokken; wie geloot
 * is, verdwijnt ook uit de andere band. Wat daarna overblijft, wordt samengegooid
 * ongeacht band — vandaar dat de laatste baan spelers uit beide uiteinden kan
 * bevatten. Blijven er minder dan vier over, dan zijn die uitgeloot.
 */
export function loot(opSterkte: Speler[], willekeur: () => number = Math.random): GelooteBaan[] {
  const { totBoven, vanOnder } = banden(opSterkte.length);
  const boven = opSterkte.slice(0, totBoven);
  const onder = opSterkte.slice(vanOnder);
  const banen: GelooteBaan[] = [];

  function trekVier(uit: Speler[], bron: Baanbron) {
    const gekozen: Speler[] = [];
    for (let i = 0; i < 4; i++) {
      gekozen.push(...uit.splice(Math.floor(willekeur() * uit.length), 1));
    }
    banen.push({ bron, spelers: gekozen });
    return gekozen;
  }

  function haalWeg(gekozen: Speler[], uit: Speler[]) {
    for (const speler of gekozen) {
      const i = uit.indexOf(speler);
      if (i > -1) uit.splice(i, 1);
    }
  }

  while (boven.length >= 4 || onder.length >= 4) {
    if (boven.length >= 4) haalWeg(trekVier(boven, 'boven'), onder);
    if (onder.length >= 4) haalWeg(trekVier(onder, 'onder'), boven);
  }

  const rest = [...boven, ...onder].filter(
    (speler, i, alle) => alle.findIndex((ander) => ander.id === speler.id) === i,
  );
  if (rest.length >= 4) trekVier(rest, 'rest');
  if (rest.length > 0) banen.push({ bron: 'uitgeloot', spelers: [...rest] });

  return banen;
}

/**
 * Wie met wie speelt, per set. De cijfers zijn plaatsen in de baan: in set 1
 * vormen speler 1 en 2 een duo tegen 3 en 4, in set 2 speelt 1 met 3, in set 3
 * met 4. Zo speel je één set met en twee sets tegen elke andere speler.
 */
export const SETINDELING = [
  { thuis: [0, 1], uit: [2, 3] },
  { thuis: [0, 2], uit: [1, 3] },
  { thuis: [0, 3], uit: [1, 2] },
] as const;

/** Positie 0–3 in de baan → of die speler in set `set` aan de thuiskant staat. */
export function staatThuis(positie: number, set: number): boolean {
  return (SETINDELING[set].thuis as readonly number[]).includes(positie);
}

/**
 * Een set die in verlenging gaat, telt niet zwaarder mee: alles boven 21 wordt
 * proportioneel teruggeschaald. Bij 24–22 krijgt de winnaar 21 en de verliezer
 * 21/24 × 22 = 19,25.
 */
export function trimSet(eigen: number, ander: number): number {
  const hoogste = Math.max(eigen, ander);
  return hoogste > 21 ? (21 / hoogste) * eigen : eigen;
}

/** De punten die één speler in de drie sets bij elkaar speelde, na terugschaling. */
export function setpunten(sets: readonly [number, number][], positie: number): number[] {
  return SETINDELING.map((_, set) => {
    const [thuis, uit] = sets[set];
    return staatThuis(positie, set) ? trimSet(thuis, uit) : trimSet(uit, thuis);
  });
}

/** Je cijfer voor één speeldag: het gemiddelde aantal punten per set. */
export function dagcijfer(punten: readonly number[]): number {
  return punten.reduce((som, p) => som + p, 0) / punten.length;
}

/**
 * Het cijfer dat afwezigen krijgen: over alle banen van die avond het
 * gemiddelde van wat de verliezende duo's per set bij elkaar speelden.
 */
export function afwezigencijfer(banen: readonly Baan[]): number {
  const perBaan = banen.map(
    (baan) =>
      baan.sets.reduce((som, [thuis, uit]) => som + trimSet(Math.min(thuis, uit), Math.max(thuis, uit)), 0) /
      baan.sets.length,
  );
  return perBaan.reduce((som, p) => som + p, 0) / perBaan.length;
}

/**
 * De score van de tegenstander wanneer jij een set verliest met `punten`: 21,
 * of twee meer dan jij zodra de set in verlenging ging. Zo levert elke waarde
 * een geldige badmintonuitslag op.
 */
export function tegenpunten(punten: number): number {
  return punten <= 19 ? 21 : punten + 2;
}

/** De voorsprong waarmee een set begint: het verschil in bonuspunten tussen de duo's. */
export function voorsprong(bonussen: readonly number[], set: number) {
  const { thuis, uit } = SETINDELING[set];
  const optellen = (plekken: readonly number[]) =>
    plekken.reduce<number>((som, i) => som + bonussen[i], 0);
  const thuisBonus = optellen(thuis);
  const uitBonus = optellen(uit);
  return {
    thuisBonus,
    uitBonus,
    thuis: Math.max(0, thuisBonus - uitBonus),
    uit: Math.max(0, uitBonus - thuisBonus),
  };
}

/**
 * De stand is het gemiddelde van je basispunt en al je speeldagcijfers. Na
 * `speeldagen` speeldagen zijn dat `speeldagen + 1` waarden, dus één speeldag
 * erbij verschuift je stand maar een beetje — en steeds minder naarmate het
 * seizoen vordert.
 */
export function nieuweStand(vorigGemiddelde: number, dagcijfer: number, speeldagen: number): number {
  return (vorigGemiddelde * speeldagen + dagcijfer) / (speeldagen + 1);
}

/** Vaste komma en Belgische komma, zoals de rest van de site cijfers toont. */
export function komma(getal: number, decimalen = 2): string {
  return getal.toFixed(decimalen).replace('.', ',');
}
