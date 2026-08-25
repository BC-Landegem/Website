// Bevriest één echte intraclub-speeldag als src/data/intraclub-voorbeeld.json,
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
const outputPath = fileURLToPath(new URL('../src/data/intraclub-voorbeeld.json', import.meta.url));

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
    const doubleRank = Number(player.doubleRanking);
    if (doubleRank > 10) bonus += 4;
    else if (doubleRank > 8) bonus += 3;
    else if (doubleRank > 6) bonus += 2;
    else if (doubleRank > 4) bonus += 1;
  }
  return bonus;
}

/** Draait maximaal `gelijktijdig` taken tegelijk — de API is een gedeelde host. */
async function inBatches(items, concurrency, task) {
  const out = [];
  for (let i = 0; i < items.length; i += concurrency) {
    out.push(...(await Promise.all(items.slice(i, i + concurrency).map(task))));
  }
  return out;
}

const [speeldag, playerList, rankings] = await Promise.all([
  fetchJson('/rounds/latestCalculated'),
  fetchJson('/players'),
  fetchJson('/rankings'),
]);

if (!speeldag || !speeldag.id) throw new Error('Geen berekende speeldag gevonden');

const standings = rankings.general;
const standingsById = new Map(standings.map((row) => [String(row.id), row]));
const attributesById = new Map(playerList.map((sp) => [String(sp.id), sp]));

// De spelers die er die avond écht waren: precies wie in een baan stond.
const banen = speeldag.matches.map((match) => ({
  spelers: [match.firstPlayer, match.secondPlayer, match.thirdPlayer, match.fourthPlayer].map((p) =>
    String(p.id),
  ),
  sets: [
    [match.firstSet.home, match.firstSet.away],
    [match.secondSet.home, match.secondSet.away],
    [match.thirdSet.home, match.thirdSet.away],
  ],
}));

const presentIds = [...new Set(banen.flatMap((court) => court.spelers))];

const courtOf = new Map();
for (const court of banen) for (const id of court.spelers) courtOf.set(id, court);

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
  const court = courtOf.get(id);
  const position = court.spelers.indexOf(id);
  const points = SET_LINEUP.map((home, set) => {
    const [homeScore, awayScore] = court.sets[set];
    return home.includes(position) ? trim(homeScore, awayScore) : trim(awayScore, homeScore);
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
const speeldagen = Number(speeldag.number);

let largestDeviation = 0;
const previousById = new Map(
  presentIds.map((id) => {
    const published = standingsById.get(id).average;
    const derived = (published * (speeldagen + 1) - dayScoreOf(id)) / speeldagen;
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

const spelers = presentIds
  .map((id) => {
    const standingsRow = standingsById.get(id);
    const attributes = attributesById.get(id);
    if (!standingsRow || !attributes) throw new Error(`Speler ${id} ontbreekt in stand of spelerslijst`);
    return {
      id,
      // De ledenadministratie bevat hier en daar een spatie te veel.
      voornaam: standingsRow.firstName.trim(),
      naam: standingsRow.name.trim(),
      rang: standingsRow.rank,
      gemiddelde: standingsRow.average,
      verschil: standingsRow.difference,
      vorigGemiddelde: previousById.get(id),
      bonus: bonusPoints(attributes),
    };
  })
  .sort((a, b) => a.rang - b.rang);

// De loting van die avond werkte met de stand ná de vórige speeldag — de
// speeldag zelf was toen nog niet berekend. Sorteren op `gemiddelde` (ná deze
// speeldag) geeft een net andere volgorde en verklaart de echte banen niet:
// met `vorigGemiddelde` vallen 11 van de 12 banen zuiver binnen één band, de
// twaalfde is de restbaan uit het algoritme. Vandaar dit aparte veld.
const nightOrder = [...spelers].sort((a, b) => b.vorigGemiddelde - a.vorigGemiddelde);
nightOrder.forEach((player, i) => {
  player.rangOpAvond = i + 1;
});

const snapshot = {
  // Vastgelegd op deze datum; de spelregels die de pagina uitlegt veranderen niet.
  bevrorenOp: new Date().toISOString().slice(0, 10),
  seizoenId: rankings.seasonId,
  // Aantal speeldagen tot en met deze; het basispunt telt als extra deler mee.
  speeldagenGespeeld: Number(speeldag.number),
  spelersInStand: standings.length,
  speeldag: {
    id: String(speeldag.id),
    nummer: Number(speeldag.number),
    datum: speeldag.date.slice(0, 10),
    gemiddeldeAfwezig: Number(speeldag.averageAbsent),
  },
  spelers,
  banen,
};

writeFileSync(outputPath, JSON.stringify(snapshot, null, 1) + '\n');
console.log(
  `intraclub-voorbeeld.json geschreven: speeldag ${snapshot.speeldag.nummer} ` +
    `(${snapshot.speeldag.datum}), ${spelers.length} spelers, ${banen.length} banen`,
);
