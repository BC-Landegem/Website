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
// het jarenlang laat staan.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://www.bclandegem.be/intra-app/api/index.php';
const outputPath = fileURLToPath(new URL('../src/data/intraclub-example.json', import.meta.url));

async function fetchJson(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Bonuspunten per speler, letterlijk overgenomen uit de intra-app
 * (intra-app/js/helpers.js, calculateBonusPoints). Hoger dubbelklassement
 * betekent zwakker, dus meer voorsprong.
 */
function bonusPoints(player) {
  let bonus = 0;
  if (player.gender === 'Woman') bonus += 2;
  if (Number(player.playsCompetition) === 0) {
    bonus += 5;
  } else {
    const doubleRanking = Number(player.doubleRanking);
    if (doubleRanking > 10) bonus += 4;
    else if (doubleRanking > 8) bonus += 3;
    else if (doubleRanking > 6) bonus += 2;
    else if (doubleRanking > 4) bonus += 1;
  }
  return bonus;
}

/** Draait maximaal `concurrency` taken tegelijk — de API is een gedeelde host. */
async function inBatches(items, concurrency, task) {
  const out = [];
  for (let i = 0; i < items.length; i += concurrency) {
    out.push(...(await Promise.all(items.slice(i, i + concurrency).map(task))));
  }
  return out;
}

const [matchday, playerList, rankings] = await Promise.all([
  fetchJson('/rounds/latestCalculated'),
  fetchJson('/players'),
  fetchJson('/rankings'),
]);

if (!matchday || !matchday.id) throw new Error('Geen berekende speeldag gevonden');

const ranking = rankings.general;
const rankingById = new Map(ranking.map((row) => [String(row.id), row]));
const propertiesById = new Map(playerList.map((p) => [String(p.id), p]));

// De spelers die er die avond écht waren: precies wie in een baan stond.
const courts = matchday.matches.map((match) => ({
  players: [match.firstPlayer, match.secondPlayer, match.thirdPlayer, match.fourthPlayer].map((p) =>
    String(p.id),
  ),
  sets: [
    [match.firstSet.home, match.firstSet.away],
    [match.secondSet.home, match.secondSet.away],
    [match.thirdSet.home, match.thirdSet.away],
  ],
}));

const presentIds = [...new Set(courts.flatMap((court) => court.players))];

const courtById = new Map();
for (const court of courts) for (const id of court.players) courtById.set(id, court);

/** Terugschalen boven 21, zoals Utilities::trimSets in de API. */
const trim = (own, other) => (Math.max(own, other) > 21 ? (21 / Math.max(own, other)) * own : own);

/** Wie met wie per set: 1+2, 1+3, 1+4 aan de thuiskant. */
const SET_LINEUP = [
  [0, 1],
  [0, 2],
  [0, 3],
];

/** Het speeldagcijfer van één speler: zijn gemiddeld aantal punten per set. */
function dayScoreOf(id) {
  const court = courtById.get(id);
  const spot = court.players.indexOf(id);
  const points = SET_LINEUP.map((home, set) => {
    const [homeScore, awayScore] = court.sets[set];
    return home.includes(spot) ? trim(homeScore, awayScore) : trim(awayScore, homeScore);
  });
  return points.reduce((sum, p) => sum + p, 0) / points.length;
}

// Het gemiddelde ná de vorige speeldag is nodig om de stand te kunnen
// herrekenen wanneer je op de pagina de scores verschuift:
//   nieuwe stand = (vorig gemiddelde × speeldagen + dagcijfer) / (speeldagen + 1)
// waarbij `speeldagen` het basispunt meetelt (na speeldag 16 is dat 17).
//
// De API geeft die tussenstanden afgerond op twee decimalen terug. Met dát cijfer
// als vertrekpunt komt de formule soms 0,01 naast de stand uit die op /intraclub/
// staat — onhandig op een pagina die net uitlegt hoe er gerekend wordt. Daarom
// draaien we het om: we leiden het vorige gemiddelde af uit de gepubliceerde
// stand en het exacte speeldagcijfer, zodat de som op de pagina precies uitkomt
// op het getal dat de bezoeker in het klassement ziet. De afgeronde waarde uit de
// API dient nog als controle.
const histories = await inBatches(presentIds, 6, async (id) => {
  const detail = await fetchJson(`/players/${encodeURIComponent(id)}`);
  const history = detail.statistics.rankingHistory ?? [];
  const previous = history[history.length - 2];
  return [id, previous ? previous.average : null];
});
const reportedPreviousById = new Map(histories);
const matchdays = Number(matchday.number);

let largestDeviation = 0;
const previousById = new Map(
  presentIds.map((id) => {
    const published = rankingById.get(id).average;
    const derived = (published * (matchdays + 1) - dayScoreOf(id)) / matchdays;
    const reported = reportedPreviousById.get(id);
    if (reported != null) largestDeviation = Math.max(largestDeviation, Math.abs(derived - reported));
    return [id, derived];
  }),
);
if (largestDeviation > 0.05) {
  throw new Error(
    `Afgeleide tussenstand wijkt ${largestDeviation.toFixed(3)} af van wat de API meldt — ` +
      'controleer of de rekenregels in de applicatie veranderd zijn.',
  );
}

const players = presentIds
  .map((id) => {
    const rankingRow = rankingById.get(id);
    const properties = propertiesById.get(id);
    if (!rankingRow || !properties) throw new Error(`Speler ${id} ontbreekt in stand of spelerslijst`);
    return {
      id,
      // De ledenadministratie bevat hier en daar een spatie te veel.
      firstName: rankingRow.firstName.trim(),
      name: rankingRow.name.trim(),
      rank: rankingRow.rank,
      average: rankingRow.average,
      difference: rankingRow.difference,
      previousAverage: previousById.get(id),
      bonus: bonusPoints(properties),
    };
  })
  .sort((a, b) => a.rank - b.rank);

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
  seasonId: rankings.seasonId,
  // Aantal speeldagen tot en met deze; het basispunt telt als extra deler mee.
  matchdaysPlayed: Number(matchday.number),
  playersInRanking: ranking.length,
  matchday: {
    id: String(matchday.id),
    number: Number(matchday.number),
    date: matchday.date.slice(0, 10),
    averageAbsent: Number(matchday.averageAbsent),
  },
  players,
  courts,
};

writeFileSync(outputPath, JSON.stringify(snapshot, null, 1) + '\n');
console.log(
  `intraclub-example.json geschreven: speeldag ${snapshot.matchday.number} ` +
    `(${snapshot.matchday.date}), ${players.length} spelers, ${courts.length} banen`,
);
