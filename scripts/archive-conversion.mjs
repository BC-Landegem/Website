#!/usr/bin/env node
/**
 * Zet de artikels uit de oude Joomla-site om naar de content collection
 * `src/content/archief/`.
 *
 * Draaien:  node scripts/archive-conversion.mjs [--dry]
 * Bron:     scraped/bclandegem_database_*.sql  (buiten de repo, zie README)
 * Doel:     src/content/archief/JJJJ-MM-DD-alias.md
 *
 * Dit script draait éénmalig. Daarna zijn de markdownbestanden de bron van
 * waarheid: verbeter een typo dáár, niet hier en opnieuw converteren — dat
 * overschrijft handmatige correcties.
 *
 * Wat er onderweg gebeurt en waarom, zie de blokken hieronder.
 */
import fs from 'node:fs';
import path from 'node:path';
import TurndownService from 'turndown';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET = path.join(ROOT, 'src/content/archief');
const MANIFEST = path.join(ROOT, 'src/data/archive-images.json');
const DRY = process.argv.includes('--dry');
const BS = String.fromCharCode(92);

// ============================================================ dump uitlezen

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
      let cur = '', inStr = false;
      while (i < sql.length) {
        const c = sql[i];
        if (inStr) {
          if (c === BS) {
            const n = sql[i + 1];
            cur += n === 'n' ? '\n' : n === 'r' ? '\r' : n === 't' ? '\t' : n === '0' ? '\0' : n;
            i += 2;
            continue;
          }
          if (c === "'") { inStr = false; i++; continue; }
          cur += c; i++; continue;
        }
        if (c === "'") { inStr = true; i++; continue; }
        if (c === ',') { values.push(cur); cur = ''; i++; continue; }
        if (c === ')') { values.push(cur); i++; break; }
        cur += c; i++;
      }
      rows.push(values);
      if (sql[i] === ',') i++;
    }
  }
  return rows;
}

function columns(sql, table) {
  const m = sql.match(new RegExp('CREATE TABLE `' + table + '` \\(([\\s\\S]*?)\\n\\) ENGINE'));
  return m[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('`')).map((l) => l.split('`')[1]);
}

const dumpFile = fs.readdirSync(path.join(ROOT, 'scraped')).find((b) => b.endsWith('.sql'));
if (!dumpFile) {
  console.error('Geen .sql-dump in scraped/. Zie README, sectie Databronnen.');
  process.exit(1);
}
const sql = fs.readFileSync(path.join(ROOT, 'scraped', dumpFile), 'utf8');

// ====================================================== categorieën groeperen

// Op catid mappen, niet op naam: "Algemene mededelingen" en "Trainingen" bestaan
// elk twee keer in Joomla (één onder de club, één onder de jeugd).
const GROUP_PER_CATID = {
  30: 'competitie', 28: 'competitie', 29: 'competitie', 31: 'competitie',
  25: 'intraclub', 42: 'intraclub',
  36: 'jeugd', 35: 'jeugd', 32: 'jeugd', 34: 'jeugd', 33: 'jeugd',
  38: 'toernooien', 40: 'toernooien', 39: 'toernooien',
  24: 'club', 27: 'club', 26: 'club',
  2: null, // Uncategorised — de nieuwsstroom van vóór ze categorieën invoerden
};

const categoryName = Object.fromEntries(readTable(sql, 's8hxk_categories').map((c) => [c[0], c[8]]));
const users = Object.fromEntries(readTable(sql, 's8hxk_users').map((u) => [u[0], u[1]]));

// ============================================================ artikels lezen

const raw = readTable(sql, 's8hxk_content').map((r) => ({
  id: Number(r[0]),
  title: r[2],
  alias: r[3],
  intro: r[4],
  full: r[5],
  state: r[6],
  catid: Number(r[7]),
  created: r[8],
  authorRaw: r[10] || users[r[9]] || '',
  publishUp: r[15],
}));

const articles = raw.filter(
  (a) => (a.state === '1' || a.state === '2') && categoryName[a.catid] !== 'Enkel voor site',
);

const dateOf = (a) =>
  (a.publishUp && !a.publishUp.startsWith('0000') ? a.publishUp : a.created).slice(0, 10);

// ------------------------------------------------------- dubbels wegwerken

// Twee artikels zijn per ongeluk twee keer gepost (zelfde dag, zelfde tekst).
// We houden de oudste id — dat is de eerste publicatie.
const fingerprint = (a) =>
  (a.intro + a.full).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/[^a-z0-9]+/gi, '').toLowerCase().slice(0, 120);

const seen = new Map();
const duplicates = [];
const unique = [];
for (const a of articles.slice().sort((x, y) => x.id - y.id)) {
  const k = dateOf(a) + '|' + fingerprint(a);
  if (fingerprint(a).length >= 40 && seen.has(k)) {
    duplicates.push({ dropped: a, kept: seen.get(k) });
    continue;
  }
  seen.set(k, a);
  unique.push(a);
}

// ------------------------------------------------------- auteurs normaliseren

// 'bart', 'Bart' en 'Bart Ivens' zijn één persoon. We groeperen op de voornaam
// in kleine letters en tonen de spelling die het vaakst voorkomt — datagestuurd,
// zodat we niemand een naam aanmeten die hij zelf nooit gebruikte.
//
// Twee gevallen die een heuristiek niet kan zien, dus met de hand:
// het Joomla-account 'Vydt Filip' schreef zelf altijd 'Filip' (achternaam eerst),
// en de enige spelling van Andreas' account begint met een kleine letter.
const MANUAL = {
  'vydt filip': 'Filip',
  'andreas ducheyne': 'Andreas Ducheyne',
};

const spellings = new Map();
for (const a of unique) {
  const name = a.authorRaw.trim();
  if (!name) continue;
  if (MANUAL[name.toLowerCase()]) continue;
  const key = name.split(/\s+/)[0].toLowerCase();
  if (!spellings.has(key)) spellings.set(key, new Map());
  const t = spellings.get(key);
  t.set(name, (t.get(name) || 0) + 1);
}
const canonical = new Map();
for (const [key, counts] of spellings) {
  // Bij gelijke telling wint de spelling met een hoofdletter, daarna de langste.
  const best = [...counts.entries()].sort((a, b) =>
    b[1] - a[1]
    || (/^[A-Z]/.test(b[0]) ? 1 : 0) - (/^[A-Z]/.test(a[0]) ? 1 : 0)
    || b[0].length - a[0].length,
  )[0][0];
  canonical.set(key, best.replace(/^[a-z]/, (c) => c.toUpperCase()));
}
const authorOf = (a) => {
  const name = a.authorRaw.trim();
  if (!name) return null;
  if (MANUAL[name.toLowerCase()]) return MANUAL[name.toLowerCase()];
  return canonical.get(name.split(/\s+/)[0].toLowerCase()) || name;
};

// ============================================================ reacties lezen

const jcCols = columns(sql, 's8hxk_jcomments');
const commentsPer = new Map();
for (const r of readTable(sql, 's8hxk_jcomments')) {
  const o = Object.fromEntries(jcCols.map((c, i) => [c, r[i]]));
  if (o.published !== '1' || o.object_group !== 'com_content') continue;
  const list = commentsPer.get(Number(o.object_id)) || [];
  list.push({
    name: (o.name || o.username || '').trim() || 'Anoniem',
    date: (o.date || '').slice(0, 10),
    text: o.comment,
    // e-mail, IP, homepage en useragent gaan hier bewust NIET mee: die staan in
    // de dump maar horen niet in een publieke, statische build. Zie README.
  });
  commentsPer.set(Number(o.object_id), list);
}

// ============================================================ HTML opschonen

const imageManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const SMILEYS = {
  'smiley-wink.gif': '😉', 'smiley-smile.gif': '🙂', 'smiley-laughing.gif': '😄',
  'smiley-surprised.gif': '😮', 'smiley-innocent.gif': '😇',
};

// JComments bewaarde smileys niet als <img> maar als tekstcode. Die codes stonden
// op de oude site voor een plaatje; als kale tekst betekenen ze niets meer.
const TEXT_SMILEYS = {
  ':wink:': '😉', ':lol:': '😄', ':sad:': '🙁', ':woohoo:': '🎉',
  ':whistle:': '😗', ':silly:': '😜', ':unsure:': '😕', ':shock:': '😱',
  ':roll:': '🙄', ':oops:': '😳', ':evil:': '😈', ':cheer:': '👏',
  ':kiss:': '😘', ':angry:': '😠', ':blush:': '😊', ':pinch:': '😖',
  ':dry:': '😐', ':sick:': '🤢', ':side:': '😏', ':P': '😛', ':huh:': '😐',
};
const TEXT_SMILEY_RE = new RegExp(
  Object.keys(TEXT_SMILEYS).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);
const smileysToEmoji = (s) => s.replace(TEXT_SMILEY_RE, (m) => {
  stats.textSmileys++;
  return TEXT_SMILEYS[m];
});

const ent = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Absolute URL zoals het beeldscript hem ook opbouwde, zodat het manifest matcht. */
function absolute(src) {
  try { return new URL(ent(src).trim(), 'https://www.bclandegem.be/').href; } catch { return null; }
}

const stats = {
  imagesKept: 0, imagesRemoved: 0, smileys: 0, textSmileys: 0,
  linksUnlinked: 0, linksKept: 0, videos: 0, sup: 0, pluginTags: 0,
};

function cleanHtml(html, article) {
  let h = html;

  // 0. Joomla-contentplugins. Deze tags werden op de oude site door een plugin
  //    vervangen; hier blijven ze als kale tekst achter en betekenen ze niets.
  h = h.replace(/\{youtube\}\s*([\w-]{6,})\s*\{\/youtube\}/gi, (m, id) => {
    stats.videos++;
    return `<p><a href="https://www.youtube.com/watch?v=${id}">Bekijk de video op YouTube</a></p>`;
  });
  // De .wmv-bestanden stonden op de oude server en zijn niet meer op te halen
  // (alle waarschijnlijke paden geven 404). Liever een eerlijke noot dan een
  // stilzwijgend gat waar ooit een video stond.
  h = h.replace(/\{wmv\}[^{]*\{\/wmv\}/gi, () => {
    stats.pluginTags++;
    return '<p><em>(video niet bewaard gebleven)</em></p>';
  });
  // {tab=1G} hoorde bij de Tabs-plugin: elk label kopte een blok. Een kop doet
  // hetzelfde werk zonder JavaScript.
  h = h.replace(/\{tab=([^}]*)\}/gi, (m, label) => {
    stats.pluginTags++;
    return `<h3>${label.trim().replace(/:$/, '')}</h3>`;
  });
  h = h.replace(/\{\/?tabs?\}/gi, () => { stats.pluginTags++; return ''; });
  h = h.replace(/\{emailcloak=[^}]*\}/gi, () => { stats.pluginTags++; return ''; });

  // Opmaakskelet van de oude editor-tabellen; de tabel zelf houden we.
  h = h.replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, '').replace(/<col\b[^>]*>/gi, '');

  // 1. Smileys worden echte emoji. Een <img> van 16px die een knipoog voorstelt
  //    heeft in markdown geen enkele reden om een <img> te blijven.
  h = h.replace(/<img[^>]*src="[^"]*\/((?:smiley|emoticon)[^"/]*\.(?:gif|png))"[^>]*\/?>/gi, (m, name) => {
    stats.smileys++;
    return SMILEYS[name.toLowerCase()] || '';
  });
  h = h.replace(/<img[^>]*src="[^"]*(?:plugins\/editors|\/emotions\/)[^"]*"[^>]*\/?>/gi, () => {
    stats.smileys++;
    return '';
  });

  // 2. YouTube-iframes worden een gewone link. Een embed in een archiefpagina is
  //    zwaar en trekt de bezoeker naar Google; de video blijft zo gewoon kijkbaar.
  h = h.replace(/<iframe[^>]*src="([^"]*youtube[^"]*)"[^>]*>\s*<\/iframe>/gi, (m, src) => {
    stats.videos++;
    const id = (src.match(/embed\/([A-Za-z0-9_-]{6,})/) || [])[1];
    const url = id ? `https://www.youtube.com/watch?v=${id}` : ent(src).replace(/^\/\//, 'https://');
    return `<p><a href="${url}">Bekijk de video op YouTube</a></p>`;
  });

  // 3. Beelden herschrijven naar wat het redscript binnenhaalde, of weghalen.
  h = h.replace(/<img([^>]*)>/gi, (tag, attrs) => {
    const src = (attrs.match(/src\s*=\s*"([^"]*)"/i) || attrs.match(/src\s*=\s*'([^']*)'/i) || [])[1];
    const abs = src && absolute(src);
    const hit = abs && imageManifest[abs];
    if (!hit || hit.dead || !hit.file) {
      stats.imagesRemoved++;
      return '';
    }
    stats.imagesKept++;
    const alt = (attrs.match(/alt\s*=\s*"([^"]*)"/i) || [])[1] || '';
    return `<img src="/archief/beelden/${hit.file}" alt="${alt.replace(/"/g, '')}">`;
  });

  // 4. Links. Alles wat naar de oude Joomla-plumbing wijst is dood en blijft dood:
  //    die ontkoppelen we tot platte tekst — de woorden blijven, de href gaat weg.
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, inner) => {
    const href = ent((attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i) || [])[1] || '').trim();
    if (!href || href.startsWith('#')) { stats.linksUnlinked++; return inner; }

    // Verwees de link naar een beeld dat we gered hebben? Dan wijst hij daarheen.
    const abs = absolute(href);
    const hit = abs && imageManifest[abs];
    if (hit && !hit.dead && hit.file) {
      stats.linksKept++;
      return `<a href="/archief/beelden/${hit.file}">${inner}</a>`;
    }

    const dead = /index\.php|com_(content|jumi|phocagallery|phocadownload|jevents|rokin|mailto)|icalrepeat|listevents|Stand-intraclub|bclandegem\.be\/(intraclub|component)/i.test(href);
    if (dead) { stats.linksUnlinked++; return inner; }
    stats.linksKept++;
    return `<a href="${href}">${inner}</a>`;
  });

  // 5. Rangtelwoorden: 4<sup>de</sup> -> 4de. Superscript overleeft markdown niet
  //    en betekent hier niets wiskundigs.
  h = h.replace(/<sup>\s*(ste|de|e|d)\s*<\/sup>/gi, (m, s) => { stats.sup++; return s; });

  // 6. Opmaakrommel van de editors: font-family-spans, Word-divs, lege stijlen.
  h = h.replace(/\s(?:style|class|lang|face|color|width|height|border|align|valign|cellpadding|cellspacing)\s*=\s*"[^"]*"/gi, '');
  h = h.replace(/\s(?:style|class|lang|face|color)\s*=\s*'[^']*'/gi, '');
  h = h.replace(/<\/?(?:span|font|o:p)\b[^>]*>/gi, '');
  h = h.replace(/<div\b[^>]*>/gi, '<p>').replace(/<\/div>/gi, '</p>');

  // 7. Lege paragrafen en dubbele <br> die na het strippen overblijven.
  h = h.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');

  return h;
}

// ============================================================ markdown maken

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

// Tabellen laat turndown standaard vallen; die zeven stuks houden we als ruwe HTML.
turndown.keep(['table', 'thead', 'tbody', 'tr', 'th', 'td']);

function toMarkdown(html, article) {
  let md = smileysToEmoji(turndown.turndown(cleanHtml(html, article)));
  md = md
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
}

/** Reactietekst: JComments bewaarde HTML-fragmenten met <br /> erin. */
function commentText(html) {
  return smileysToEmoji(turndown.turndown(html.replace(/<br\s*\/?>/gi, '\n')))
    .replace(/ /g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================ slugs en paden

const slugOf = (a) =>
  (a.alias || a.title)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'artikel';

// Joomla plakte er soms al `-514` achter; die staart halen we eraf en botsingen
// lossen we daarna zelf op, per jaar, want de URL wordt /archief/{jaar}/{slug}/.
const cleanSlug = (s, id) => s.replace(new RegExp('-' + id + '$'), '').replace(/-\d+$/, (m) => (Number(m.slice(1)) > 1900 ? m : ''));

const usedSlugs = new Map();
function uniqueSlug(a) {
  const year = dateOf(a).slice(0, 4);
  let s = cleanSlug(slugOf(a), a.id);
  const key = year + '/' + s;
  if (!usedSlugs.has(key)) { usedSlugs.set(key, a.id); return s; }
  return `${s}-${a.id}`;
}

// ============================================================ wegschrijven

const yaml = (v) => JSON.stringify(v);

let written = 0;
let withComments = 0;
let empty = 0;
const skippedEmpty = [];
const files = [];

for (const a of unique.slice().sort((x, y) => dateOf(x).localeCompare(dateOf(y)) || x.id - y.id)) {
  const date = dateOf(a);
  const slug = uniqueSlug(a);
  const body = toMarkdown(a.intro + (a.full ? '\n' + a.full : ''), a);
  const comments = (commentsPer.get(a.id) || [])
    .map((r) => ({ ...r, text: commentText(r.text) }))
    .filter((r) => r.text)
    .sort((x, y) => x.date.localeCompare(y.date));
  // Artikels zonder inhoud slaan we over. Dit zijn er geen die wij leegmaakten:
  // ze bevatten in Joomla al alleen een plugintag, een &nbsp; of een <div> die
  // een browserextensie in de editor had achtergelaten. Een titel zonder tekst
  // is geen clubgeheugen.
  if (!body) {
    empty++;
    skippedEmpty.push(`${date} — ${a.title} (id ${a.id})`);
    continue;
  }
  if (comments.length) withComments++;

  const author = authorOf(a);
  const group = GROUP_PER_CATID[a.catid] ?? null;

  // De frontmatter-keys blijven Nederlands: dat is het contract met de
  // bestaande content collection (zie src/content.config.ts).
  let fm = '---\n';
  fm += `titel: ${yaml(a.title.trim())}\n`;
  fm += `datum: ${date}\n`;
  fm += `urlnaam: ${yaml(slug)}\n`;
  if (author) fm += `auteur: ${yaml(author)}\n`;
  fm += `categorie: ${yaml(categoryName[a.catid] || 'Onbekend')}\n`;
  if (group) fm += `groep: ${yaml(group)}\n`;
  fm += `joomlaId: ${a.id}\n`;
  if (comments.length) {
    fm += 'reacties:\n';
    for (const r of comments) {
      fm += `  - naam: ${yaml(r.name)}\n`;
      fm += `    datum: ${r.date}\n`;
      fm += `    tekst: ${yaml(r.text)}\n`;
    }
  }
  fm += '---\n\n';

  const name = `${date}-${slug}.md`;
  files.push({ name, content: fm + body + '\n', a, body, comments });
}

if (!DRY) {
  fs.rmSync(TARGET, { recursive: true, force: true });
  fs.mkdirSync(TARGET, { recursive: true });
  for (const f of files) {
    fs.writeFileSync(path.join(TARGET, f.name), f.content);
    written++;
  }
}

// ============================================================ rapport

console.log(`Dump:            ${dumpFile}`);
console.log(`Gelezen:         ${raw.length} artikels, ${articles.length} na filter (state 1/2, geen paginateksten)`);
console.log(`Dubbels weg:     ${duplicates.length}`);
for (const d of duplicates) console.log(`                 id ${d.dropped.id} valt weg voor id ${d.kept.id} — ${JSON.stringify(d.dropped.title.slice(0, 50))}`);
console.log(`Geschreven:      ${DRY ? files.length + ' (DROOG, niets weggeschreven)' : written} bestanden`);
console.log(`Met reacties:    ${withComments} artikels, ${[...commentsPer.values()].flat().length} reacties totaal`);
console.log(`Leeg, dus weg:   ${empty}`);
for (const r of skippedEmpty) console.log(`                 ${r}`);
console.log('');
console.log('Inhoud:');
console.log(`  beelden behouden   ${stats.imagesKept}`);
console.log(`  beelden verwijderd ${stats.imagesRemoved}  (bron dood, zie manifest)`);
console.log(`  smileys -> emoji   ${stats.smileys} als <img>, ${stats.textSmileys} als tekstcode (:wink:)`);
console.log(`  plugintags weg     ${stats.pluginTags}  ({tab=}, {wmv}, {emailcloak})`);
console.log(`  links behouden     ${stats.linksKept}`);
console.log(`  links ontkoppeld   ${stats.linksUnlinked}  (dode Joomla-paden, tekst blijft)`);
console.log(`  video's -> link    ${stats.videos}`);
console.log(`  rangtelwoorden     ${stats.sup}`);

const authorCounts = {};
for (const f of files) { const n = authorOf(f.a) || '—'; authorCounts[n] = (authorCounts[n] || 0) + 1; }
console.log('\nAuteurs na normalisatie:');
Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} ${k}`));

const groupCounts = {};
for (const f of files) { const g = GROUP_PER_CATID[f.a.catid] ?? 'geen groep'; groupCounts[g] = (groupCounts[g] || 0) + 1; }
console.log('\nGroepen (voor de deelpagina\'s):');
Object.entries(groupCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} ${k}`));

// ======================================================== eindcontrole

// Zelfcontrole: alles wat na de conversie nog naar Joomla ruikt is een gemist
// geval, geen inhoud. Liever hier luidruchtig falen dan het op de site ontdekken.
const COMPLAINTS = [
  { name: 'Joomla-plugintag', re: /\{[a-z][a-z0-9_]*[=}]/i },
  { name: 'smileycode', re: /:(?:wink|lol|sad|woohoo|whistle|silly|unsure|shock|roll|oops|evil|cheer|kiss|angry|blush|huh):/i },
  // Alleen echte linkdoelen: een auteur die de URL van zijn eigen artikel uittypte
  // is inhoud, geen kapotte link.
  { name: 'link naar index.php', re: /\]\([^)]*index\.php|href="[^"]*index\.php/i },
  { name: 'restant <span>/<div>/<font>', re: /<(?:span|div|font)\b/i },
  { name: 'style-attribuut', re: /\sstyle\s*=/i },
  { name: 'beeld buiten /archief/beelden/', re: /!\[[^\]]*\]\((?!\/archief\/beelden\/)[^)]*\)|<img[^>]+src="(?!\/archief\/beelden\/)/i },
  { name: 'lege markdown-link', re: /\[\]\(\s*\)/ },
  { name: 'mso/Word-rommel', re: /mso-|MsoNormal/i },
];

const found = new Map();
for (const f of files) {
  for (const k of COMPLAINTS) {
    if (k.re.test(f.content)) {
      const list = found.get(k.name) || [];
      list.push(f.name);
      found.set(k.name, list);
    }
  }
}

console.log('\nEindcontrole:');
if (found.size === 0) {
  console.log(`  schoon — geen Joomla-restanten in de ${files.length} bestanden`);
} else {
  for (const [name, list] of found) {
    console.log(`  ⚠ ${name}: ${list.length} bestand(en)`);
    list.slice(0, 4).forEach((n) => console.log(`      ${n}`));
    if (list.length > 4) console.log(`      … en ${list.length - 4} meer`);
  }
}

if (!DRY) console.log(`\nBestanden staan in: ${path.relative(ROOT, TARGET)}`);
