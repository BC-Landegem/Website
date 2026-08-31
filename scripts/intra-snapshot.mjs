// Bevriest één echte intraclub-speeldag als src/data/intraclub-example.json,
// het werkvoorbeeld waarop /intraclub/zo-werkt-het/ draait.
//
// Draaien met:
//   node scripts/intra-snapshot.mjs
//
// Waarom een snapshot en geen live fetch: de uitlegpagina legt de spélregels
// uit, en die veranderen niet. Door de data in de build te bakken is de pagina
// server-side gerenderd, heeft ze geen laad- of fouttoestand, en blijft ze
// leesbaar in Sporthal Oostbroek, waar het bereik slecht is. Alle interactie op
// de pagina is rekenwerk op dit bestand — er gaat geen enkel request uit.
//
// Draai dit opnieuw wanneer je een recenter voorbeeld wil; niets breekt als je
// het jarenlang laat staan. Eén beperking: het kan alleen tijdens een lópend
// seizoen. Van een afgesloten seizoen geeft /rounds/{id} een 403, dus na de
// seizoenswissel moet je wachten tot er een nieuwe speeldag berekend is.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = process.env.PUBLIC_INTRA_API ?? 'https://intra.bclandegem.be/api';
const outputPath = fileURLToPath(new URL('../src/data/intraclub-example.json', import.meta.url));

async function fetchApi(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

// meta.round is de speeldag waarop het klassement geldt: de laatst berekende.
// De aparte /rounds/latestCalculated die hier vroeger stond, bestaat niet meer.
//
// ?members=0 is hier geen detail. Zonder die parameter filtert de stand op wie
// er vandaag nog lid is, ook binnen het lopende seizoen — en dan verdwijnt wie
// er tussen die speeldag en nu gestopt is uit het voorbeeld. Voor speeldag 17
// van 2025-2026 is dat één speelster van de 48 op de baan: zij zou een fiche
// zonder plaats krijgen, en de banen zouden niet meer kloppen met de avond.
// Dezelfde reden waarom `attendances[].rank` voor haar `null` is; vandaar dat
// plaats, gemiddelde en verschil hier uit de stand komen en niet daaruit.
const rankings = await fetchApi('/rankings/general?members=0');
const round = rankings.meta?.round;
if (!round) throw new Error('Geen berekende speeldag: het seizoen is nog niet begonnen');

const { data: detail } = await fetchApi(`/rounds/${round.id}`);

/**
 * De vier spelers van een baan, op de plaats die de rotatie hun geeft: set 1 is
 * P1+P2, set 2 is P1+P3, set 3 is P1+P4. P1 is dus de enige die alle drie de
 * sets aan dezelfde kant staat, en daaruit volgt de rest.
 *
 * Afgeleid en niet aangenomen: de volgorde van `game.players` is geen contract,
 * die van `sets[].home.player_ids` wel. De uitlegpagina rekent op deze plaatsen.
 */
function seatOrder(game) {
  const homes = game.sets.map((set) => set.home.player_ids);
  const first = homes[0].find((id) => homes[1].includes(id) && homes[2].includes(id));
  if (first === undefined) throw new Error(`Baan ${game.id}: geen speler in alle drie de thuissets`);
  const partner = (ids) => ids.find((id) => id !== first);
  return [first, partner(homes[0]), partner(homes[1]), partner(homes[2])].map(String);
}

const courts = detail.games.map((game) => ({
  players: seatOrder(game),
  sets: game.sets.map((set) => [set.home.score, set.away.score]),
}));

const presentIds = new Set(courts.flatMap((court) => court.players));

/** Terugschalen boven 21, zoals de API het doet bij het berekenen. */
const trim = (own, other) => (Math.max(own, other) > 21 ? (21 / Math.max(own, other)) * own : own);

/** Wie met wie per set: 1+2, 1+3, 1+4 aan de thuiskant. */
const SET_LINEUP = [
  [0, 1],
  [0, 2],
  [0, 3],
];

const courtById = new Map();
for (const court of courts) for (const id of court.players) courtById.set(id, court);

/**
 * Het speeldagcijfer zoals de uitlegpagina het uitrekent uit de scores.
 *
 * De API geeft `day_score` mee, maar afgerond op twee decimalen — en dat is net
 * te grof voor wat hieronder gebeurt. De pagina laat de bezoeker scores
 * verschuiven en rekent er dan zelf mee, vertrekkend van `previousAverage`; is
 * dat getal afgeleid uit een afgerond dagcijfer, dan komt de som 0,01 naast de
 * stand uit die op /intraclub/ staat. Onhandig op een pagina die net uitlegt
 * hoe er gerekend wordt.
 *
 * Dus rekent dit script het exact uit, met `day_score` van de API ernaast als
 * controle: wijken ze meer dan een afronding af, dan zijn de rekenregels in de
 * applicatie veranderd en klopt deze pagina niet meer.
 */
function exactDayScore(id) {
  const court = courtById.get(id);
  const spot = court.players.indexOf(id);
  const points = SET_LINEUP.map((home, set) => {
    const [homeScore, awayScore] = court.sets[set];
    return home.includes(spot) ? trim(homeScore, awayScore) : trim(awayScore, homeScore);
  });
  return points.reduce((sum, p) => sum + p, 0) / points.length;
}

const standingById = new Map(rankings.data.map((row) => [String(row.id), row]));
const matchdays = round.number;

let largestDeviation = 0;

// Het gemiddelde ná de vorige speeldag is nodig om de stand te kunnen
// herrekenen wanneer je op de pagina de scores verschuift:
//   nieuwe stand = (vorig gemiddelde × speeldagen + dagcijfer) / (speeldagen + 1)
// waarbij `speeldagen` het basispunt meetelt (na speeldag 16 is dat 17).
//
// De API geeft tussenstanden afgerond op twee decimalen. Met dát cijfer als
// vertrekpunt komt de formule soms 0,01 naast de stand uit die op /intraclub/
// staat — onhandig op een pagina die net uitlegt hoe er gerekend wordt. Daarom
// draaien we het om: we leiden het vorige gemiddelde af uit de gepubliceerde
// stand en het exacte dagcijfer, zodat de som op de pagina precies uitkomt op
// het getal dat de bezoeker in het klassement ziet.
const players = detail.attendances
  .filter((row) => presentIds.has(String(row.player.id)))
  .map((row) => {
    const id = String(row.player.id);
    if (row.day_score === null) throw new Error(`Speler ${id} speelde wel maar heeft geen dagscore`);
    const standing = standingById.get(id);
    if (!standing) throw new Error(`Speler ${id} stond op een baan maar niet in de stand`);
    const dayScore = exactDayScore(id);
    largestDeviation = Math.max(largestDeviation, Math.abs(dayScore - row.day_score));
    return {
      id,
      // De ledenadministratie bevat hier en daar een spatie te veel.
      firstName: standing.first_name.trim(),
      name: standing.last_name.trim(),
      rank: standing.rank,
      average: standing.average,
      difference: standing.difference,
      previousAverage: (standing.average * (matchdays + 1) - dayScore) / matchdays,
      // Kwam vroeger uit een herhaling van calculateBonusPoints uit de intra-app;
      // de API rekent hem nu zelf uit en zet hem op de speler.
      bonus: row.player.bonus_points,
    };
  })
  .sort((a, b) => a.rank - b.rank);

if (largestDeviation > 0.005) {
  throw new Error(
    `Herberekende dagscore wijkt ${largestDeviation.toFixed(3)} af van die van de API — ` +
      'controleer of de rekenregels in de applicatie veranderd zijn.',
  );
}

if (players.length !== presentIds.size) {
  throw new Error(`${presentIds.size} spelers op een baan, ${players.length} in de aanwezigheden`);
}

// De loting van die avond werkte met de stand ná de vórige speeldag — de
// speeldag zelf was toen nog niet berekend. Sorteren op `average` (ná deze
// speeldag) geeft een net andere volgorde en verklaart de echte banen niet:
// met `previousAverage` vallen 11 van de 12 banen zuiver binnen één band, de
// twaalfde is de restbaan uit het algoritme. Vandaar dit aparte veld.
const eveningOrder = [...players].sort((a, b) => b.previousAverage - a.previousAverage);
eveningOrder.forEach((player, i) => {
  player.rankOnEvening = i + 1;
});

const snapshot = {
  // Vastgelegd op deze datum; de spelregels die de pagina uitlegt veranderen niet.
  frozenOn: new Date().toISOString().slice(0, 10),
  seasonId: rankings.meta.season.id,
  // Aantal speeldagen tot en met deze; het basispunt telt als extra deler mee.
  matchdaysPlayed: round.number,
  playersInRanking: rankings.data.length,
  matchday: {
    id: String(round.id),
    number: round.number,
    date: round.date.slice(0, 10),
    averageAbsent: detail.average_absent,
  },
  players,
  courts,
};

writeFileSync(outputPath, JSON.stringify(snapshot, null, 1) + '\n');
console.log(
  `intraclub-example.json geschreven: speeldag ${snapshot.matchday.number} ` +
    `(${snapshot.matchday.date}), ${players.length} spelers, ${courts.length} banen`,
);
