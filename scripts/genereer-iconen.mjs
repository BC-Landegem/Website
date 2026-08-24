// Genereert de PWA-iconen uit public/images/logo-bc1.svg.
//
// Draaien:  node scripts/genereer-iconen.mjs
// De uitvoer (public/icons/*.png) staat in git — dit script hoeft alleen te
// lopen als het logo of de kleuren wijzigen. sharp komt mee met Astro; er is
// dus geen extra dependency.
//
// Twee smaken, want een launcher behandelt ze anders:
//   any       — het icoon wordt getoond zoals het is: logo in inkt op veerwit.
//   maskable  — de launcher knipt er zelf een vorm uit (cirkel, squircle).
//               Vandaar clubrood tot in de rand en het logo klein genoeg om
//               binnen de veilige zone (cirkel van 80% van de zijde) te
//               blijven: een vierkant dat daarin past is ~57% breed.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const VEER_50 = '#faf7f1';
const INKT_950 = '#1b1410';
const CLUB_500 = '#eb4024';

const logo = await readFile(new URL('../public/images/logo-bc1.svg', import.meta.url), 'utf8');
// potrace zet de vulkleur op de <g>; hergebruiken we om het logo te hertinten.
const gekleurd = (kleur) => Buffer.from(logo.replaceAll('fill="#000000"', `fill="${kleur}"`));

async function icoon({ bestand, zijde, achtergrond, logokleur, dekking }) {
  // trim() haalt de lege marge uit het SVG-canvas weg, anders staat het logo
  // uit het midden. Daarna past de hele bounding box in een vierkant vak.
  const vak = Math.round(zijde * dekking);
  const laag = await sharp(gekleurd(logokleur), { density: 150 })
    .trim()
    .resize({ width: vak, height: vak, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const png = await sharp({
    create: { width: zijde, height: zijde, channels: 4, background: achtergrond },
  })
    .composite([{ input: laag, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(new URL(`../public/icons/${bestand}`, import.meta.url), png);
  console.log(`${bestand}  ${zijde}\u00d7${zijde}`);
}

await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
await icoon({ bestand: 'icon-192.png', zijde: 192, achtergrond: VEER_50, logokleur: INKT_950, dekking: 0.78 });
await icoon({ bestand: 'icon-512.png', zijde: 512, achtergrond: VEER_50, logokleur: INKT_950, dekking: 0.78 });
await icoon({ bestand: 'icon-maskable-512.png', zijde: 512, achtergrond: CLUB_500, logokleur: VEER_50, dekking: 0.56 });
