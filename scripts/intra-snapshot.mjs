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
const uitvoerPad = fileURLToPath(new URL('../src/data/intraclub-voorbeeld.json', import.meta.url));

async function haal(pad) {
  const res = await fetch(`${API}${pad}`);
  if (!res.ok) throw new Error(`${pad}: HTTP ${res.status}`);
  return res.json();
}

/**
 * Bonuspunten per speler, letterlijk overgenomen uit de intra-app
 * (intra-app/js/helpers.js, calculateBonusPoints). Hoger dubbelklassement
 * betekent zwakker, dus meer voorsprong.
 */
function bonuspunten(speler) {
  let bonus = 0;
  if (speler.gender === 'Woman') bonus += 2;
  if (Number(speler.playsCompetition) === 0) {
    bonus += 5;
  } else {
    const dubbel = Number(speler.doubleRanking);
    if (dubbel > 10) bonus += 4;
    else if (dubbel > 8) bonus += 3;
    else if (dubbel > 6) bonus += 2;
    else if (dubbel > 4) bonus += 1;
  }
  return bonus;
}

/** Draait maximaal `gelijktijdig` taken tegelijk — de API is een gedeelde host. */
async function inBatches(items, gelijktijdig, taak) {
  const uit = [];
  for (let i = 0; i < items.length; i += gelijktijdig) {
    uit.push(...(await Promise.all(items.slice(i, i + gelijktijdig).map(taak))));
  }
  return uit;
}

const [speeldag, spelerslijst, rankings] = await Promise.all([
  haal('/rounds/latestCalculated'),
  haal('/players'),
  haal('/rankings'),
]);

if (!speeldag || !speeldag.id) throw new Error('Geen berekende speeldag gevonden');

const stand = rankings.general;
const standOp = new Map(stand.map((rij) => [String(rij.id), rij]));
const eigenschappenOp = new Map(spelerslijst.map((sp) => [String(sp.id), sp]));

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

const aanwezigeIds = [...new Set(banen.flatMap((baan) => baan.spelers))];

const baanVan = new Map();
for (const baan of banen) for (const id of baan.spelers) baanVan.set(id, baan);

/** Terugschalen boven 21, zoals Utilities::trimSets in de API. */
const trim = (eigen, ander) => (Math.max(eigen, ander) > 21 ? (21 / Math.max(eigen, ander)) * eigen : eigen);

/** Wie met wie per set: 1+2, 1+3, 1+4 aan de thuiskant. */
const SETINDELING = [
  [0, 1],
  [0, 2],
  [0, 3],
];

/** Het speeldagcijfer van één speler: zijn gemiddeld aantal punten per set. */
function dagcijferVan(id) {
  const baan = baanVan.get(id);
  const plek = baan.spelers.indexOf(id);
  const punten = SETINDELING.map((thuis, set) => {
    const [thuisScore, uitScore] = baan.sets[set];
    return thuis.includes(plek) ? trim(thuisScore, uitScore) : trim(uitScore, thuisScore);
  });
  return punten.reduce((som, p) => som + p, 0) / punten.length;
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
const historieken = await inBatches(aanwezigeIds, 6, async (id) => {
  const detail = await haal(`/players/${encodeURIComponent(id)}`);
  const geschiedenis = detail.statistics.rankingHistory ?? [];
  const vorige = geschiedenis[geschiedenis.length - 2];
  return [id, vorige ? vorige.average : null];
});
const gemeldVorigOp = new Map(historieken);
const speeldagen = Number(speeldag.number);

let grootsteAfwijking = 0;
const vorigOp = new Map(
  aanwezigeIds.map((id) => {
    const gepubliceerd = standOp.get(id).average;
    const afgeleid = (gepubliceerd * (speeldagen + 1) - dagcijferVan(id)) / speeldagen;
    const gemeld = gemeldVorigOp.get(id);
    if (gemeld != null) grootsteAfwijking = Math.max(grootsteAfwijking, Math.abs(afgeleid - gemeld));
    return [id, afgeleid];
  }),
);
if (grootsteAfwijking > 0.05) {
  throw new Error(
    `Afgeleide tussenstand wijkt ${grootsteAfwijking.toFixed(3)} af van wat de API meldt — ` +
      'controleer of de rekenregels in de applicatie veranderd zijn.',
  );
}

const spelers = aanwezigeIds
  .map((id) => {
    const standRij = standOp.get(id);
    const eigenschappen = eigenschappenOp.get(id);
    if (!standRij || !eigenschappen) throw new Error(`Speler ${id} ontbreekt in stand of spelerslijst`);
    return {
      id,
      // De ledenadministratie bevat hier en daar een spatie te veel.
      voornaam: standRij.firstName.trim(),
      naam: standRij.name.trim(),
      rang: standRij.rank,
      gemiddelde: standRij.average,
      verschil: standRij.difference,
      vorigGemiddelde: vorigOp.get(id),
      bonus: bonuspunten(eigenschappen),
    };
  })
  .sort((a, b) => a.rang - b.rang);

// De loting van die avond werkte met de stand ná de vórige speeldag — de
// speeldag zelf was toen nog niet berekend. Sorteren op `gemiddelde` (ná deze
// speeldag) geeft een net andere volgorde en verklaart de echte banen niet:
// met `vorigGemiddelde` vallen 11 van de 12 banen zuiver binnen één band, de
// twaalfde is de restbaan uit het algoritme. Vandaar dit aparte veld.
const opAvondVolgorde = [...spelers].sort((a, b) => b.vorigGemiddelde - a.vorigGemiddelde);
opAvondVolgorde.forEach((speler, i) => {
  speler.rangOpAvond = i + 1;
});

const snapshot = {
  // Vastgelegd op deze datum; de spelregels die de pagina uitlegt veranderen niet.
  bevrorenOp: new Date().toISOString().slice(0, 10),
  seizoenId: rankings.seasonId,
  // Aantal speeldagen tot en met deze; het basispunt telt als extra deler mee.
  speeldagenGespeeld: Number(speeldag.number),
  spelersInStand: stand.length,
  speeldag: {
    id: String(speeldag.id),
    nummer: Number(speeldag.number),
    datum: speeldag.date.slice(0, 10),
    gemiddeldeAfwezig: Number(speeldag.averageAbsent),
  },
  spelers,
  banen,
};

writeFileSync(uitvoerPad, JSON.stringify(snapshot, null, 1) + '\n');
console.log(
  `intraclub-voorbeeld.json geschreven: speeldag ${snapshot.speeldag.nummer} ` +
    `(${snapshot.speeldag.datum}), ${spelers.length} spelers, ${banen.length} banen`,
);
