// Leest de publieke Google Photos share-pagina's van de albums in
// src/data/media.ts uit en schrijft de fotolijsten naar src/data/media.json.
//
// Draait in de media-sync workflow (nachtelijk) en lokaal met:
//   node scripts/scrape-media.mjs
// Vereist Node >= 22.18 (importeert media.ts rechtstreeks via type stripping).
//
// Er bestaat geen officiële API meer die bestaande albums kan uitlezen
// (Google schrapte de readonly-scope in maart 2025), dus dit script parseert
// de share-pagina zelf: elk media-item staat daar als ["<lh3-url>",breedte,hoogte].
// Als Google die structuur ooit wijzigt, levert een album 0 foto's op; dit
// script behoudt dan de vorige data en eindigt met exitcode 1 zodat de
// workflow rood kleurt — de site blijft intussen gewoon werken.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { albums } from '../src/data/media.ts';

const outputPath = fileURLToPath(new URL('../src/data/media.json', import.meta.url));

let previous = {};
try {
  previous = JSON.parse(readFileSync(outputPath, 'utf8'));
} catch {
  // Geen bestaande media.json — eerste run.
}

/** Haalt één share-pagina op en parseert de foto's eruit. */
async function scrapeAlbum(album) {
  const res = await fetch(album.share, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Elk media-item: ["https://lh3.googleusercontent.com/...",breedte,hoogte
  // Video's zijn in de share-HTML niet betrouwbaar van foto's te onderscheiden
  // en verschijnen dus als stilstaand beeld; de albumpagina linkt naar Google
  // Photos voor het volledige album.
  const fotos = [];
  const seen = new Set();
  const itemRegex = /\["(https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9\-_/]+)",(\d+),(\d+)/g;
  for (const m of html.matchAll(itemRegex)) {
    const [, url, b, h] = m;
    if (seen.has(url)) continue;
    seen.add(url);
    fotos.push({ url, b: Number(b), h: Number(h) });
  }
  if (fotos.length === 0) throw new Error('geen foto’s gevonden — share-paginastructuur gewijzigd?');

  // Albumcover: og:image (de gekozen cover in Google Photos), zonder maatsuffix.
  const og = html.match(/property="og:image" content="(https:\/\/lh3\.googleusercontent\.com\/[^"=]+)/);
  const cover = og?.[1] ?? fotos[0].url;

  const titelGp = html.match(/<title>([^<]*?) - Google Photos<\/title>/)?.[1];
  return { cover, titelGp, fotos };
}

const result = {};
let errors = 0;

for (const album of albums) {
  try {
    const data = await scrapeAlbum(album);
    result[album.slug] = data;
    console.log(`ok    ${album.slug}: ${data.fotos.length} foto's (GP: "${data.titelGp ?? '?'}")`);
  } catch (err) {
    errors++;
    if (previous[album.slug]) {
      result[album.slug] = previous[album.slug];
      console.error(`FOUT  ${album.slug}: ${err.message} — vorige data behouden (${previous[album.slug].fotos.length} foto's)`);
    } else {
      console.error(`FOUT  ${album.slug}: ${err.message} — nog geen data, album verschijnt niet op de site`);
    }
  }
}

writeFileSync(outputPath, JSON.stringify(result, null, 1) + '\n');
console.log(`\nmedia.json geschreven: ${Object.keys(result).length} album(s), ${errors} fout(en)`);
process.exit(errors > 0 ? 1 : 0);
