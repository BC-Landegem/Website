#!/usr/bin/env node
/**
 * Haalt de beelden en documenten op waar de oude Joomla-artikels naar verwijzen.
 *
 * Waarom dit bestaat: www.bclandegem.be draait op het moment van schrijven nog en
 * serveert `images/...` gewoon. Na de domeinswitch is dat voorbij en zijn die
 * bestanden definitief weg. Externe bronnen (imgur, Facebook-CDN, Picasa) zijn
 * grotendeels al dood; wat nog leeft nemen we mee.
 *
 * Draaien:  node scripts/archief-beelden.mjs
 * Bron:     scraped/bclandegem_database_*.sql  (staat buiten de repo — bevat
 *           wachtwoordhashes en e-mailadressen, zie .gitignore)
 * Doel:     public/archief/beelden/  + een manifest dat oude URL -> bestandsnaam
 *           mapt, zodat de conversie later weet wat ze moet herschrijven.
 *
 * Het script is idempotent: bestanden die er al staan worden overgeslagen.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const WORTEL = path.resolve(import.meta.dirname, '..');
const DOEL = path.join(WORTEL, 'public/archief/beelden');
const MANIFEST = path.join(WORTEL, 'src/data/archief-beelden.json');
const OUDE_SITE = 'https://www.bclandegem.be/';
const GELIJKTIJDIG = 8;
const TIMEOUT = 20_000;

// ---------------------------------------------------------------- dump lezen

const BS = String.fromCharCode(92);

/** Leest de tuples van één INSERT-statement uit een mysqldump. */
function leesTabel(sql, tabel) {
  const re = new RegExp('INSERT INTO `' + tabel + '` VALUES ', 'g');
  const rijen = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    let i = m.index + m[0].length;
    while (i < sql.length) {
      if (sql[i] === ';') { i++; break; }
      if (sql[i] !== '(') { i++; continue; }
      i++;
      const waarden = [];
      let huidig = '';
      let inString = false;
      while (i < sql.length) {
        const c = sql[i];
        if (inString) {
          if (c === BS) {
            // mysqldump escapet \n \r \t \0 \\ \' \" en \Z
            const n = sql[i + 1];
            huidig += n === 'n' ? '\n' : n === 'r' ? '\r' : n === 't' ? '\t' : n === '0' ? '\0' : n;
            i += 2;
            continue;
          }
          if (c === "'") { inString = false; i++; continue; }
          huidig += c; i++; continue;
        }
        if (c === "'") { inString = true; i++; continue; }
        if (c === ',') { waarden.push(huidig); huidig = ''; i++; continue; }
        if (c === ')') { waarden.push(huidig); i++; break; }
        huidig += c; i++;
      }
      rijen.push(waarden);
      if (sql[i] === ',') i++;
    }
  }
  return rijen;
}

function vindDump() {
  const map = path.join(WORTEL, 'scraped');
  const bestand = fs.readdirSync(map).find((b) => b.endsWith('.sql'));
  if (!bestand) {
    console.error('Geen .sql-dump gevonden in scraped/. Zonder de dump kan dit script niets.');
    process.exit(1);
  }
  return path.join(map, bestand);
}

// ------------------------------------------------------------ urls verzamelen

const entiteiten = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Joomla-editorsmileys en andere plugin-artefacten: die redden we niet. */
const isArtefact = (src) => /plugins\/editors|\/emotions\/|media\/system\/images|smiley/i.test(src);

const isDocument = (u) => /\.(pdf|docx?|xlsx?|pptx?)($|\?)/i.test(u);

function verzamelUrls(artikels) {
  const gevonden = new Map(); // absolute url -> Set van artikel-ids
  const noteer = (ruw, artId) => {
    const src = entiteiten(ruw).trim();
    if (!src || src.startsWith('data:') || isArtefact(src)) return;
    let abs;
    try {
      abs = new URL(src, OUDE_SITE).href;
    } catch {
      return;
    }
    if (!/^https?:/.test(abs)) return;
    if (!gevonden.has(abs)) gevonden.set(abs, new Set());
    gevonden.get(abs).add(artId);
  };

  for (const a of artikels) {
    const body = a.intro + a.full;
    for (const m of body.matchAll(/<img[^>]+src\s*=\s*"([^"]+)"/gi)) noteer(m[1], a.id);
    for (const m of body.matchAll(/<img[^>]+src\s*=\s*'([^']+)'/gi)) noteer(m[1], a.id);
    // Links naar beelden en documenten zijn even vergankelijk als de <img>-tags.
    for (const m of body.matchAll(/href\s*=\s*"([^"]+)"/gi)) {
      const h = entiteiten(m[1]);
      if (/\.(jpe?g|png|gif|webp|bmp)($|\?)/i.test(h) || isDocument(h)) noteer(m[1], a.id);
    }
  }
  return gevonden;
}

// ---------------------------------------------------------------- bestandsnaam

const TYPE_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/bmp': '.bmp', 'image/svg+xml': '.svg', 'application/pdf': '.pdf',
};

/** Leesbare, botsingsvrije naam: geschoonde basisnaam + 6 tekens hash van de bron-URL. */
function bestandsnaam(url, contentType) {
  const pad = decodeURIComponent(new URL(url).pathname);
  let basis = path.basename(pad).replace(/\.[^.]*$/, '');
  basis = basis
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
  if (!basis) basis = 'beeld';
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 6);
  const ext = TYPE_EXT[(contentType || '').split(';')[0].trim().toLowerCase()]
    || (path.extname(pad).match(/^\.[a-z0-9]{2,5}$/i) ? path.extname(pad).toLowerCase() : '.bin');
  return `${basis}-${hash}${ext}`;
}

// -------------------------------------------------------------------- ophalen

async function haalOp(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Sommige hosts (imgur) geven 429 of een placeholder zonder herkenbare UA.
        'User-Agent': 'Mozilla/5.0 (compatible; BCLandegem-archief/1.0; +https://www.bclandegem.be/)',
        Accept: 'image/*,application/pdf;q=0.9,*/*;q=0.5',
      },
    });
    if (!res.ok) return { ok: false, reden: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return { ok: false, reden: 'leeg' };
    // imgur serveert een 200 met een grijze placeholder van precies 503 bytes
    // voor verwijderde afbeeldingen. Die willen we niet.
    if (/imgur\.com/.test(url) && buf.length < 1500) return { ok: false, reden: 'imgur-placeholder' };
    if (!/^(image\/|application\/pdf|application\/octet-stream|application\/msword|application\/vnd)/.test(type)) {
      return { ok: false, reden: `geen bestand (${type.split(';')[0] || 'onbekend'})` };
    }
    return { ok: true, buf, type };
  } catch (e) {
    return { ok: false, reden: e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 60) };
  } finally {
    clearTimeout(timer);
  }
}

/** Draait `taak` over `items` met een vaste hoeveelheid gelijktijdige werkers. */
async function metWerkers(items, aantal, taak) {
  let index = 0;
  const werkers = Array.from({ length: Math.min(aantal, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await taak(items[i], i);
    }
  });
  await Promise.all(werkers);
}

// ------------------------------------------------------------------------ main

const sql = fs.readFileSync(vindDump(), 'utf8');
const categorieen = Object.fromEntries(leesTabel(sql, 's8hxk_categories').map((c) => [c[0], c[8]]));
const artikels = leesTabel(sql, 's8hxk_content')
  .map((r) => ({ id: r[0], titel: r[2], intro: r[4], full: r[5], state: r[6], cat: categorieen[r[7]] }))
  // Gepubliceerd of gearchiveerd; "Enkel voor site" is paginainhoud, geen nieuws.
  .filter((a) => (a.state === '1' || a.state === '2') && a.cat !== 'Enkel voor site');

console.log(`${artikels.length} artikels gelezen uit de dump.`);

const urls = verzamelUrls(artikels);
console.log(`${urls.size} unieke bron-URL's gevonden (smileys en editor-artefacten al uitgesloten).\n`);

fs.mkdirSync(DOEL, { recursive: true });
const bestaand = new Set(fs.readdirSync(DOEL));

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const resultaten = [];

await metWerkers([...urls.keys()], GELIJKTIJDIG, async (url) => {
  const artikelIds = [...urls.get(url)];
  const eerder = manifest[url];
  if (eerder?.bestand && bestaand.has(eerder.bestand)) {
    resultaten.push({ url, status: 'overgeslagen', bestand: eerder.bestand, artikelIds });
    return;
  }
  const res = await haalOp(url);
  if (!res.ok) {
    resultaten.push({ url, status: 'dood', reden: res.reden, artikelIds });
    return;
  }
  const naam = bestandsnaam(url, res.type);
  fs.writeFileSync(path.join(DOEL, naam), res.buf);
  resultaten.push({ url, status: 'gered', bestand: naam, bytes: res.buf.length, artikelIds });
});

// -------------------------------------------------------------------- rapport

const gered = resultaten.filter((r) => r.status === 'gered');
const overgeslagen = resultaten.filter((r) => r.status === 'overgeslagen');
const dood = resultaten.filter((r) => r.status === 'dood');

const host = (u) => { try { return new URL(u).hostname; } catch { return '?'; } };
const tel = (lijst) => {
  const t = {};
  for (const r of lijst) t[host(r.url)] = (t[host(r.url)] || 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
};

console.log('\n=== GERED ===');
for (const [h, n] of tel(gered)) console.log('  ' + String(n).padStart(4), h);
console.log('  ' + String(gered.length).padStart(4), 'totaal, ' +
  (gered.reduce((s, r) => s + r.bytes, 0) / 1024 / 1024).toFixed(2) + ' MB');

if (overgeslagen.length) console.log(`\n=== AL AANWEZIG === ${overgeslagen.length}`);

console.log('\n=== DOOD ===');
for (const [h, n] of tel(dood)) console.log('  ' + String(n).padStart(4), h);
console.log('  ' + String(dood.length).padStart(4), 'totaal');

const perReden = {};
for (const r of dood) perReden[r.reden] = (perReden[r.reden] || 0) + 1;
console.log('\n  reden:', Object.entries(perReden).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(', '));

const geraakt = new Set(dood.flatMap((r) => r.artikelIds));
console.log(`\n${geraakt.size} artikels verliezen minstens één beeld of document.`);

// Manifest schrijven: de conversie leest dit om <img src> te herschrijven naar
// /archief/beelden/... of om de tag weg te halen als er niets te redden viel.
for (const r of resultaten) {
  manifest[r.url] = r.status === 'dood'
    ? { dood: true, reden: r.reden }
    : { bestand: r.bestand };
}
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n');
console.log(`\nManifest geschreven: ${path.relative(WORTEL, MANIFEST)} (${Object.keys(manifest).length} URL's)`);
console.log(`Bestanden staan in: ${path.relative(WORTEL, DOEL)}`);
