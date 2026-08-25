// Bewaakt of README.md nog klopt.
//
// Draait als Stop-hook: wanneer Claude klaar is met een beurt, kijkt dit script
// of er in de werkmap iets wijzigde aan bestanden die de README beschrijft
// terwijl README.md zelf ongemoeid bleef. Zo ja, dan krijgt Claude de opdracht
// terug om de README na te lopen vóór de beurt echt eindigt.
//
// Met de hand draaien:
//   node .claude/hooks/readme-actueel.mjs                  — kijkt naar git status
//   node .claude/hooks/readme-actueel.mjs src/data/x.json  — kijkt naar deze paden
//
// De uitvoer is de JSON die Claude Code van een Stop-hook verwacht: niets =
// alles in orde, decision "block" = de README verdient een blik.

import { execFileSync } from 'node:child_process';

/**
 * Wat de README beschrijft, en welke sectie erop slaat. Bewust géén src/pages/
 * of src/components/: de README somt geen pagina's op, dus een nieuwe pagina
 * verandert niets aan wat er staat.
 *
 * Twee uitzonderingen binnen src/data/ zijn uitvoer van scripts, geen inhoud:
 * media.json (nachtelijke scrape) en intraclub-voorbeeld.json (snapshot). Die
 * wijzigen vanzelf en mogen de hook nooit doen afgaan.
 */
const BEWAAKT = [
  { patroon: /^src\/data\/(?!media\.json$|intraclub-voorbeeld\.json$)/, sectie: 'Inhoud aanpassen · Databronnen' },
  { patroon: /^scripts\//, sectie: 'Scripts' },
  { patroon: /^\.github\/workflows\//, sectie: 'Bouwen en deployen' },
  { patroon: /^astro\.config\.mjs$/, sectie: 'Aan de slag · Valkuilen' },
  { patroon: /^package\.json$/, sectie: 'Aan de slag' },
  { patroon: /^src\/lib\/(url|intra)\.ts$/, sectie: 'Databronnen · Valkuilen' },
  { patroon: /^src\/styles\/global\.css$/, sectie: 'Inhoud aanpassen' },
];

/** Alles wat in de werkmap afwijkt van HEAD, inclusief niet-gevolgde bestanden. */
function gewijzigdeBestanden() {
  const uit = execFileSync('git', ['status', '--porcelain', '-z'], { encoding: 'utf8' });
  const records = uit.split('\0').filter(Boolean);
  const paden = [];
  for (let i = 0; i < records.length; i++) {
    const status = records[i].slice(0, 2);
    paden.push(records[i].slice(3));
    // Bij een hernoeming volgt het oude pad als apart record; dat slaan we over.
    if (status[0] === 'R' || status[0] === 'C') i++;
  }
  return paden;
}

/** Leest de hook-payload van stdin. Leeg (of geen stdin) is prima. */
async function payload() {
  if (process.stdin.isTTY) return {};
  let ruw = '';
  for await (const stuk of process.stdin) ruw += stuk;
  try {
    return JSON.parse(ruw || '{}');
  } catch {
    return {};
  }
}

const invoer = await payload();

// Claude is al aan het werk gezet dóór deze hook. Nog eens blokkeren zou een
// lus opleveren waar de beurt nooit uit komt.
if (invoer.stop_hook_active) process.exit(0);

const handmatig = process.argv.slice(2);
const gewijzigd = handmatig.length ? handmatig : gewijzigdeBestanden();

if (gewijzigd.includes('README.md')) process.exit(0);

const geraakt = gewijzigd
  .map((pad) => {
    const regel = BEWAAKT.find(({ patroon }) => patroon.test(pad));
    return regel && { pad, sectie: regel.sectie };
  })
  .filter(Boolean);

if (!geraakt.length) process.exit(0);

const lijst = geraakt.map(({ pad, sectie }) => `  - ${pad}  → sectie "${sectie}"`).join('\n');

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason:
      'README.md is niet mee gewijzigd terwijl deze bestanden dat wel zijn:\n' +
      `${lijst}\n\n` +
      'Lees README.md en werk de genoemde secties bij als de wijziging iets ' +
      'verandert aan wat er staat — commando\'s, bestandsnamen, databronnen, ' +
      'workflows of valkuilen. Verandert er inhoudelijk niets aan de ' +
      'documentatie, zeg dat dan kort en stop; deze hook blokkeert maar één ' +
      'keer per beurt.',
  }),
);
