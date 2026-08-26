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
 * media.json (nachtelijke scrape) en intraclub-example.json (snapshot). Die
 * wijzigen vanzelf en mogen de hook nooit doen afgaan.
 */
const WATCHED = [
  { pattern: /^src\/data\/(?!media\.json$|intraclub-example\.json$)/, section: 'Inhoud aanpassen · Databronnen' },
  { pattern: /^scripts\//, section: 'Scripts' },
  { pattern: /^\.github\/workflows\//, section: 'Bouwen en deployen' },
  { pattern: /^astro\.config\.mjs$/, section: 'Aan de slag · Valkuilen' },
  { pattern: /^package\.json$/, section: 'Aan de slag' },
  { pattern: /^src\/lib\/(url|intra)\.ts$/, section: 'Databronnen · Valkuilen' },
  { pattern: /^src\/styles\/global\.css$/, section: 'Inhoud aanpassen' },
];

/** Alles wat in de werkmap afwijkt van HEAD, inclusief niet-gevolgde bestanden. */
function changedFiles() {
  const out = execFileSync('git', ['status', '--porcelain', '-z'], { encoding: 'utf8' });
  const records = out.split('\0').filter(Boolean);
  const paths = [];
  for (let i = 0; i < records.length; i++) {
    const status = records[i].slice(0, 2);
    paths.push(records[i].slice(3));
    // Bij een hernoeming volgt het oude pad als apart record; dat slaan we over.
    if (status[0] === 'R' || status[0] === 'C') i++;
  }
  return paths;
}

/** Leest de hook-payload van stdin. Leeg (of geen stdin) is prima. */
async function payload() {
  if (process.stdin.isTTY) return {};
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

const input = await payload();

// Claude is al aan het werk gezet dóór deze hook. Nog eens blokkeren zou een
// lus opleveren waar de beurt nooit uit komt.
if (input.stop_hook_active) process.exit(0);

const manual = process.argv.slice(2);
const changed = manual.length ? manual : changedFiles();

if (changed.includes('README.md')) process.exit(0);

const affected = changed
  .map((path) => {
    const rule = WATCHED.find(({ pattern }) => pattern.test(path));
    return rule && { path, section: rule.section };
  })
  .filter(Boolean);

if (!affected.length) process.exit(0);

const list = affected.map(({ path, section }) => `  - ${path}  → sectie "${section}"`).join('\n');

process.stdout.write(
  JSON.stringify({
    decision: 'block',
    reason:
      'README.md is niet mee gewijzigd terwijl deze bestanden dat wel zijn:\n' +
      `${list}\n\n` +
      'Lees README.md en werk de genoemde secties bij als de wijziging iets ' +
      'verandert aan wat er staat — commando\'s, bestandsnamen, databronnen, ' +
      'workflows of valkuilen. Verandert er inhoudelijk niets aan de ' +
      'documentatie, zeg dat dan kort en stop; deze hook blokkeert maar één ' +
      'keer per beurt.',
  }),
);
