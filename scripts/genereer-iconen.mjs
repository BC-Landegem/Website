// Genereert de PWA-iconen uit public/images/logo-bc1.svg.
//
// Draaien:  node scripts/genereer-iconen.mjs
// De uitvoer (public/icons/*.png) staat in git — dit script hoeft alleen te
// lopen als het logo of de kleuren wijzigen. sharp komt mee met Astro; er is
// dus geen extra dependency.
//
// Twee smaken van het app-icoon, want een launcher behandelt ze anders:
//   any       — het icoon wordt getoond zoals het is: logo in inkt op veerwit.
//   maskable  — de launcher knipt er zelf een vorm uit (cirkel, squircle).
//               Vandaar clubrood tot in de rand en het logo klein genoeg om
//               binnen de veilige zone (cirkel van 80% van de zijde) te
//               blijven: een vierkant dat daarin past is ~57% breed.
//
// Plus drie iconen voor de snelkoppelingen uit de manifest. Die komen niet uit
// het logo maar zijn getekend in het icoonidioom van de site (24-grid, stroke
// 2.5, round caps) — zie DESIGN.md.
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

// De glyphs van de snelkoppelingen: kalenderblad, oplopende staven voor de
// intraclubstand, en een schild als ploegembleem voor de competitie. Alle drie
// op hetzelfde 24-grid getekend, zodat ze naast elkaar even groot ogen.
const GLYPHS = {
  kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 2.5v4M16 2.5v4M3.5 10.5h17"/>',
  intraclub: '<path d="M5 20.5V16M12 20.5V11M19 20.5V4.5"/>',
  competitie: '<path d="M12 3l7 3v6c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6l7-3z"/>',
};

async function snelkoppeling(naam) {
  // Android knipt ook deze iconen rond, dus geldt dezelfde veilige zone als bij
  // maskable — hier iets ruimer genomen omdat een lijntekening lichter weegt dan
  // een vlak beeldmerk. Inkt op veerwit, gelijk aan het rustige app-icoon: de
  // rij snelkoppelingen leest zo als familie van het rode beeldmerk erboven.
  const zijde = 192;
  const vak = Math.round(zijde * 0.52);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vak}" height="${vak}" viewBox="0 0 24 24" ` +
      `fill="none" stroke="${INKT_950}" stroke-width="2.5" stroke-linecap="round" ` +
      `stroke-linejoin="round">${GLYPHS[naam]}</svg>`,
  );
  const laag = await sharp(svg).png().toBuffer();
  const png = await sharp({
    create: { width: zijde, height: zijde, channels: 4, background: VEER_50 },
  })
    .composite([{ input: laag, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  const bestand = `snelkoppeling-${naam}.png`;
  await writeFile(new URL(`../public/icons/${bestand}`, import.meta.url), png);
  console.log(`${bestand}  ${zijde}×${zijde}`);
}

await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
await icoon({ bestand: 'icon-192.png', zijde: 192, achtergrond: VEER_50, logokleur: INKT_950, dekking: 0.78 });
await icoon({ bestand: 'icon-512.png', zijde: 512, achtergrond: VEER_50, logokleur: INKT_950, dekking: 0.78 });
await icoon({ bestand: 'icon-maskable-512.png', zijde: 512, achtergrond: CLUB_500, logokleur: VEER_50, dekking: 0.56 });
for (const naam of Object.keys(GLYPHS)) await snelkoppeling(naam);
