// Genereert de PWA-iconen uit public/images/logo-bc1.svg.
//
// Draaien:  node scripts/generate-icons.mjs
// De uitvoer (public/icons/*.png) staat in git — dit script hoeft alleen te
// lopen als het logo of de kleuren wijzigen. sharp komt mee met Astro; er is
// dus geen extra dependency.
//
// Twee smaken van het app-icoon, want een launcher behandelt ze anders:
//   any       — het icoon wordt getoond zoals het is: logo in inkt op veerwit.
//   maskable  — de launcher knipt er zelf een vorm uit (cirkel, squircle).
//               Ook hier inkt op veerwit, net als het beeldmerk op de site en
//               op de oude bclandegem.be: bij een installatie is dat wat je op
//               je scherm verwacht, geen rood vlak. Het veerwit loopt wel tot
//               in de rand door (de launcher knipt weg wat hij niet wil) en het
//               logo blijft klein genoeg voor de veilige zone (cirkel van 80%
//               van de zijde): een vierkant dat daarin past is ~57% breed.
//
// Plus drie iconen voor de snelkoppelingen uit de manifest. Die komen niet uit
// het logo maar zijn getekend in het icoonidioom van de site (24-grid, stroke
// 2.5, round caps) — zie DESIGN.md.
//
// En één badge voor pushberichten (badge-96.png): het beeldmerk in wit op een
// doorzichtige achtergrond. Android toont een badge in één kleur in de
// statusbalk en gebruikt alleen het alfakanaal; kleur of achtergrond zouden
// er een grijze klodder van maken.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const FEATHER_50 = '#faf7f1';
const INK_950 = '#1b1410';

const logo = await readFile(new URL('../public/images/logo-bc1.svg', import.meta.url), 'utf8');
// potrace zet de vulkleur op de <g>; hergebruiken we om het logo te hertinten.
const colored = (color) => Buffer.from(logo.replaceAll('fill="#000000"', `fill="${color}"`));

async function icon({ file, side, background, logoColor, coverage }) {
  // trim() haalt de lege marge uit het SVG-canvas weg, anders staat het logo
  // uit het midden. Daarna past de hele bounding box in een vierkant vak.
  const box = Math.round(side * coverage);
  const layer = await sharp(colored(logoColor), { density: 150 })
    .trim()
    .resize({ width: box, height: box, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const png = await sharp({
    create: { width: side, height: side, channels: 4, background },
  })
    .composite([{ input: layer, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(new URL(`../public/icons/${file}`, import.meta.url), png);
  console.log(`${file}  ${side}×${side}`);
}

// De glyphs van de snelkoppelingen: kalenderblad, oplopende staven voor de
// intraclubstand, en een schild als ploegembleem voor de competitie. Alle drie
// op hetzelfde 24-grid getekend, zodat ze naast elkaar even groot ogen.
const GLYPHS = {
  kalender: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M8 2.5v4M16 2.5v4M3.5 10.5h17"/>',
  intraclub: '<path d="M5 20.5V16M12 20.5V11M19 20.5V4.5"/>',
  competitie: '<path d="M12 3l7 3v6c0 4.2-3 7.2-7 8.5-4-1.3-7-4.3-7-8.5V6l7-3z"/>',
};

async function shortcut(name) {
  // Android knipt ook deze iconen rond, dus geldt dezelfde veilige zone als bij
  // maskable — hier iets ruimer genomen omdat een lijntekening lichter weegt dan
  // een vlak beeldmerk. Inkt op veerwit, gelijk aan het app-icoon: de rij
  // snelkoppelingen leest zo als familie van het beeldmerk erboven.
  const side = 192;
  const box = Math.round(side * 0.52);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 24 24" ` +
      `fill="none" stroke="${INK_950}" stroke-width="2.5" stroke-linecap="round" ` +
      `stroke-linejoin="round">${GLYPHS[name]}</svg>`,
  );
  const layer = await sharp(svg).png().toBuffer();
  const png = await sharp({
    create: { width: side, height: side, channels: 4, background: FEATHER_50 },
  })
    .composite([{ input: layer, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  const file = `shortcut-${name}.png`;
  await writeFile(new URL(`../public/icons/${file}`, import.meta.url), png);
  console.log(`${file}  ${side}×${side}`);
}

await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true });
await icon({ file: 'icon-192.png', side: 192, background: FEATHER_50, logoColor: INK_950, coverage: 0.78 });
await icon({ file: 'icon-512.png', side: 512, background: FEATHER_50, logoColor: INK_950, coverage: 0.78 });
await icon({ file: 'icon-maskable-512.png', side: 512, background: FEATHER_50, logoColor: INK_950, coverage: 0.56 });
for (const name of Object.keys(GLYPHS)) await shortcut(name);
await icon({
  file: 'badge-96.png',
  side: 96,
  background: { r: 0, g: 0, b: 0, alpha: 0 },
  logoColor: '#ffffff',
  coverage: 0.9,
});
