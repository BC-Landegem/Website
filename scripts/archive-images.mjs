#!/usr/bin/env node
/**
 * Haalt de beelden en documenten op waar de oude Joomla-artikels naar verwijzen.
 *
 * Waarom dit bestaat: www.bclandegem.be draait op het moment van schrijven nog en
 * serveert `images/...` gewoon. Na de domeinswitch is dat voorbij en zijn die
 * bestanden definitief weg. Externe bronnen (imgur, Facebook-CDN, Picasa) zijn
 * grotendeels al dood; wat nog leeft nemen we mee.
 *
 * Draaien:  node scripts/archive-images.mjs
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

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET = path.join(ROOT, 'public/archief/beelden');
const MANIFEST = path.join(ROOT, 'src/data/archive-images.json');
const OLD_SITE = 'https://www.bclandegem.be/';
const CONCURRENCY = 8;
const TIMEOUT = 20_000;

// ---------------------------------------------------------------- dump lezen

const BS = String.fromCharCode(92);

/** Leest de tuples van één INSERT-statement uit een mysqldump. */
function readTable(sql, table) {
  const re = new RegExp('INSERT INTO `' + table + '` VALUES ', 'g');
  const rows = [];
  let m;
  while ((m = re.exec(sql)) !== null) {
    let i = m.index + m[0].length;
    while (i < sql.length) {
      if (sql[i] === ';') { i++; break; }
      if (sql[i] !== '(') { i++; continue; }
      i++;
      const values = [];
      let current = '';
      let inString = false;
      while (i < sql.length) {
        const c = sql[i];
        if (inString) {
          if (c === BS) {
            // mysqldump escapet \n \r \t \0 \\ \' \" en \Z
            const n = sql[i + 1];
            current += n === 'n' ? '\n' : n === 'r' ? '\r' : n === 't' ? '\t' : n === '0' ? '\0' : n;
            i += 2;
            continue;
          }
          if (c === "'") { inString = false; i++; continue; }
          current += c; i++; continue;
        }
        if (c === "'") { inString = true; i++; continue; }
        if (c === ',') { values.push(current); current = ''; i++; continue; }
        if (c === ')') { values.push(current); i++; break; }
        current += c; i++;
      }
      rows.push(values);
      if (sql[i] === ',') i++;
    }
  }
  return rows;
}

function findDump() {
  const dir = path.join(ROOT, 'scraped');
  const file = fs.readdirSync(dir).find((b) => b.endsWith('.sql'));
  if (!file) {
    console.error('Geen .sql-dump gevonden in scraped/. Zonder de dump kan dit script niets.');
    process.exit(1);
  }
  return path.join(dir, file);
}

// ------------------------------------------------------------ urls verzamelen

const entities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Joomla-editorsmileys en andere plugin-artefacten: die redden we niet. */
const isArtifact = (src) => /plugins\/editors|\/emotions\/|media\/system\/images|smiley/i.test(src);

const isDocument = (u) => /\.(pdf|docx?|xlsx?|pptx?)($|\?)/i.test(u);

function collectUrls(articles) {
  const found = new Map(); // absolute url -> Set van artikel-ids
  const note = (raw, articleId) => {
    const src = entities(raw).trim();
    if (!src || src.startsWith('data:') || isArtifact(src)) return;
    let abs;
    try {
      abs = new URL(src, OLD_SITE).href;
    } catch {
      return;
    }
    if (!/^https?:/.test(abs)) return;
    if (!found.has(abs)) found.set(abs, new Set());
    found.get(abs).add(articleId);
  };

  for (const a of articles) {
    const body = a.intro + a.full;
    for (const m of body.matchAll(/<img[^>]+src\s*=\s*"([^"]+)"/gi)) note(m[1], a.id);
    for (const m of body.matchAll(/<img[^>]+src\s*=\s*'([^']+)'/gi)) note(m[1], a.id);
    // Links naar beelden en documenten zijn even vergankelijk als de <img>-tags.
    for (const m of body.matchAll(/href\s*=\s*"([^"]+)"/gi)) {
      const h = entities(m[1]);
      if (/\.(jpe?g|png|gif|webp|bmp)($|\?)/i.test(h) || isDocument(h)) note(m[1], a.id);
    }
  }
  return found;
}

// ---------------------------------------------------------------- bestandsnaam

const TYPE_EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/bmp': '.bmp', 'image/svg+xml': '.svg', 'application/pdf': '.pdf',
};

/** Leesbare, botsingsvrije naam: geschoonde basisnaam + 6 tekens hash van de bron-URL. */
function filenameFor(url, contentType) {
  const pathname = decodeURIComponent(new URL(url).pathname);
  let base = path.basename(pathname).replace(/\.[^.]*$/, '');
  base = base
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
  if (!base) base = 'beeld';
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 6);
  const ext = TYPE_EXT[(contentType || '').split(';')[0].trim().toLowerCase()]
    || (path.extname(pathname).match(/^\.[a-z0-9]{2,5}$/i) ? path.extname(pathname).toLowerCase() : '.bin');
  return `${base}-${hash}${ext}`;
}

// -------------------------------------------------------------------- ophalen

async function fetchUrl(url) {
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
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') || '';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return { ok: false, reason: 'leeg' };
    // imgur serveert een 200 met een grijze placeholder van precies 503 bytes
    // voor verwijderde afbeeldingen. Die willen we niet.
    if (/imgur\.com/.test(url) && buf.length < 1500) return { ok: false, reason: 'imgur-placeholder' };
    if (!/^(image\/|application\/pdf|application\/octet-stream|application\/msword|application\/vnd)/.test(type)) {
      return { ok: false, reason: `geen bestand (${type.split(';')[0] || 'onbekend'})` };
    }
    return { ok: true, buf, type };
  } catch (e) {
    return { ok: false, reason: e.name === 'AbortError' ? 'timeout' : e.message.slice(0, 60) };
  } finally {
    clearTimeout(timer);
  }
}

/** Draait `task` over `items` met een vaste hoeveelheid gelijktijdige werkers. */
async function withWorkers(items, count, task) {
  let index = 0;
  const workers = Array.from({ length: Math.min(count, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      await task(items[i], i);
    }
  });
  await Promise.all(workers);
}

// ------------------------------------------------------------------------ main

const sql = fs.readFileSync(findDump(), 'utf8');
const categories = Object.fromEntries(readTable(sql, 's8hxk_categories').map((c) => [c[0], c[8]]));
const articles = readTable(sql, 's8hxk_content')
  .map((r) => ({ id: r[0], title: r[2], intro: r[4], full: r[5], state: r[6], cat: categories[r[7]] }))
  // Gepubliceerd of gearchiveerd; "Enkel voor site" is paginainhoud, geen nieuws.
  .filter((a) => (a.state === '1' || a.state === '2') && a.cat !== 'Enkel voor site');

console.log(`${articles.length} artikels gelezen uit de dump.`);

const urls = collectUrls(articles);
console.log(`${urls.size} unieke bron-URL's gevonden (smileys en editor-artefacten al uitgesloten).\n`);

fs.mkdirSync(TARGET, { recursive: true });
const existing = new Set(fs.readdirSync(TARGET));

const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const results = [];

await withWorkers([...urls.keys()], CONCURRENCY, async (url) => {
  const articleIds = [...urls.get(url)];
  const previous = manifest[url];
  if (previous?.file && existing.has(previous.file)) {
    results.push({ url, status: 'skipped', file: previous.file, articleIds });
    return;
  }
  const res = await fetchUrl(url);
  if (!res.ok) {
    results.push({ url, status: 'dead', reason: res.reason, articleIds });
    return;
  }
  const name = filenameFor(url, res.type);
  fs.writeFileSync(path.join(TARGET, name), res.buf);
  results.push({ url, status: 'saved', file: name, bytes: res.buf.length, articleIds });
});

// -------------------------------------------------------------------- rapport

const saved = results.filter((r) => r.status === 'saved');
const skipped = results.filter((r) => r.status === 'skipped');
const dead = results.filter((r) => r.status === 'dead');

const host = (u) => { try { return new URL(u).hostname; } catch { return '?'; } };
const countByHost = (list) => {
  const t = {};
  for (const r of list) t[host(r.url)] = (t[host(r.url)] || 0) + 1;
  return Object.entries(t).sort((a, b) => b[1] - a[1]);
};

console.log('\n=== GERED ===');
for (const [h, n] of countByHost(saved)) console.log('  ' + String(n).padStart(4), h);
console.log('  ' + String(saved.length).padStart(4), 'totaal, ' +
  (saved.reduce((s, r) => s + r.bytes, 0) / 1024 / 1024).toFixed(2) + ' MB');

if (skipped.length) console.log(`\n=== AL AANWEZIG === ${skipped.length}`);

console.log('\n=== DOOD ===');
for (const [h, n] of countByHost(dead)) console.log('  ' + String(n).padStart(4), h);
console.log('  ' + String(dead.length).padStart(4), 'totaal');

const byReason = {};
for (const r of dead) byReason[r.reason] = (byReason[r.reason] || 0) + 1;
console.log('\n  reden:', Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(', '));

const affected = new Set(dead.flatMap((r) => r.articleIds));
console.log(`\n${affected.size} artikels verliezen minstens één beeld of document.`);

// Manifest schrijven: de conversie leest dit om <img src> te herschrijven naar
// /archief/beelden/... of om de tag weg te halen als er niets te redden viel.
for (const r of results) {
  manifest[r.url] = r.status === 'dead'
    ? { dead: true, reason: r.reason }
    : { file: r.file };
}
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n');
console.log(`\nManifest geschreven: ${path.relative(ROOT, MANIFEST)} (${Object.keys(manifest).length} URL's)`);
console.log(`Bestanden staan in: ${path.relative(ROOT, TARGET)}`);
