#!/usr/bin/env node
/**
 * Zet de artikels uit de oude Joomla-site om naar de content collection
 * `src/content/archief/`.
 *
 * Draaien:  node scripts/archief-conversie.mjs [--dry]
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

const WORTEL = path.resolve(import.meta.dirname, '..');
const DOEL = path.join(WORTEL, 'src/content/archief');
const MANIFEST = path.join(WORTEL, 'src/data/archief-beelden.json');
const DROOG = process.argv.includes('--dry');
const BS = String.fromCharCode(92);

// ============================================================ dump uitlezen

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
      const w = [];
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
        if (c === ',') { w.push(cur); cur = ''; i++; continue; }
        if (c === ')') { w.push(cur); i++; break; }
        cur += c; i++;
      }
      rijen.push(w);
      if (sql[i] === ',') i++;
    }
  }
  return rijen;
}

function kolommen(sql, tabel) {
  const m = sql.match(new RegExp('CREATE TABLE `' + tabel + '` \\(([\\s\\S]*?)\\n\\) ENGINE'));
  return m[1].split('\n').map((l) => l.trim()).filter((l) => l.startsWith('`')).map((l) => l.split('`')[1]);
}

const dumpBestand = fs.readdirSync(path.join(WORTEL, 'scraped')).find((b) => b.endsWith('.sql'));
if (!dumpBestand) {
  console.error('Geen .sql-dump in scraped/. Zie README, sectie Databronnen.');
  process.exit(1);
}
const sql = fs.readFileSync(path.join(WORTEL, 'scraped', dumpBestand), 'utf8');

// ====================================================== categorieën groeperen

// Op catid mappen, niet op naam: "Algemene mededelingen" en "Trainingen" bestaan
// elk twee keer in Joomla (één onder de club, één onder de jeugd).
const GROEP_PER_CATID = {
  30: 'competitie', 28: 'competitie', 29: 'competitie', 31: 'competitie',
  25: 'intraclub', 42: 'intraclub',
  36: 'jeugd', 35: 'jeugd', 32: 'jeugd', 34: 'jeugd', 33: 'jeugd',
  38: 'toernooien', 40: 'toernooien', 39: 'toernooien',
  24: 'club', 27: 'club', 26: 'club',
  2: null, // Uncategorised — de nieuwsstroom van vóór ze categorieën invoerden
};

const catNaam = Object.fromEntries(leesTabel(sql, 's8hxk_categories').map((c) => [c[0], c[8]]));
const gebruikers = Object.fromEntries(leesTabel(sql, 's8hxk_users').map((u) => [u[0], u[1]]));

// ============================================================ artikels lezen

const ruw = leesTabel(sql, 's8hxk_content').map((r) => ({
  id: Number(r[0]),
  titel: r[2],
  alias: r[3],
  intro: r[4],
  full: r[5],
  state: r[6],
  catid: Number(r[7]),
  created: r[8],
  auteurRuw: r[10] || gebruikers[r[9]] || '',
  publishUp: r[15],
}));

const artikels = ruw.filter(
  (a) => (a.state === '1' || a.state === '2') && catNaam[a.catid] !== 'Enkel voor site',
);

const datumVan = (a) =>
  (a.publishUp && !a.publishUp.startsWith('0000') ? a.publishUp : a.created).slice(0, 10);

// ------------------------------------------------------- dubbels wegwerken

// Twee artikels zijn per ongeluk twee keer gepost (zelfde dag, zelfde tekst).
// We houden de oudste id — dat is de eerste publicatie.
const vingerafdruk = (a) =>
  (a.intro + a.full).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/[^a-z0-9]+/gi, '').toLowerCase().slice(0, 120);

const gezien = new Map();
const dubbels = [];
const uniek = [];
for (const a of artikels.slice().sort((x, y) => x.id - y.id)) {
  const k = datumVan(a) + '|' + vingerafdruk(a);
  if (vingerafdruk(a).length >= 40 && gezien.has(k)) {
    dubbels.push({ weg: a, blijft: gezien.get(k) });
    continue;
  }
  gezien.set(k, a);
  uniek.push(a);
}

// ------------------------------------------------------- auteurs normaliseren

// 'bart', 'Bart' en 'Bart Ivens' zijn één persoon. We groeperen op de voornaam
// in kleine letters en tonen de spelling die het vaakst voorkomt — datagestuurd,
// zodat we niemand een naam aanmeten die hij zelf nooit gebruikte.
//
// Twee gevallen die een heuristiek niet kan zien, dus met de hand:
// het Joomla-account 'Vydt Filip' schreef zelf altijd 'Filip' (achternaam eerst),
// en de enige spelling van Andreas' account begint met een kleine letter.
const HANDMATIG = {
  'vydt filip': 'Filip',
  'andreas ducheyne': 'Andreas Ducheyne',
};

const spellingen = new Map();
for (const a of uniek) {
  const naam = a.auteurRuw.trim();
  if (!naam) continue;
  if (HANDMATIG[naam.toLowerCase()]) continue;
  const sleutel = naam.split(/\s+/)[0].toLowerCase();
  if (!spellingen.has(sleutel)) spellingen.set(sleutel, new Map());
  const t = spellingen.get(sleutel);
  t.set(naam, (t.get(naam) || 0) + 1);
}
const canoniek = new Map();
for (const [sleutel, tellingen] of spellingen) {
  // Bij gelijke telling wint de spelling met een hoofdletter, daarna de langste.
  const beste = [...tellingen.entries()].sort((a, b) =>
    b[1] - a[1]
    || (/^[A-Z]/.test(b[0]) ? 1 : 0) - (/^[A-Z]/.test(a[0]) ? 1 : 0)
    || b[0].length - a[0].length,
  )[0][0];
  canoniek.set(sleutel, beste.replace(/^[a-z]/, (c) => c.toUpperCase()));
}
const auteurVan = (a) => {
  const naam = a.auteurRuw.trim();
  if (!naam) return null;
  if (HANDMATIG[naam.toLowerCase()]) return HANDMATIG[naam.toLowerCase()];
  return canoniek.get(naam.split(/\s+/)[0].toLowerCase()) || naam;
};

// ============================================================ reacties lezen

const jcKol = kolommen(sql, 's8hxk_jcomments');
const reactiesPer = new Map();
for (const r of leesTabel(sql, 's8hxk_jcomments')) {
  const o = Object.fromEntries(jcKol.map((c, i) => [c, r[i]]));
  if (o.published !== '1' || o.object_group !== 'com_content') continue;
  const lijst = reactiesPer.get(Number(o.object_id)) || [];
  lijst.push({
    naam: (o.name || o.username || '').trim() || 'Anoniem',
    datum: (o.date || '').slice(0, 10),
    tekst: o.comment,
    // e-mail, IP, homepage en useragent gaan hier bewust NIET mee: die staan in
    // de dump maar horen niet in een publieke, statische build. Zie README.
  });
  reactiesPer.set(Number(o.object_id), lijst);
}

// ============================================================ HTML opschonen

const beeldManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

const SMILEYS = {
  'smiley-wink.gif': '😉', 'smiley-smile.gif': '🙂', 'smiley-laughing.gif': '😄',
  'smiley-surprised.gif': '😮', 'smiley-innocent.gif': '😇',
};

// JComments bewaarde smileys niet als <img> maar als tekstcode. Die codes stonden
// op de oude site voor een plaatje; als kale tekst betekenen ze niets meer.
const TEKST_SMILEYS = {
  ':wink:': '😉', ':lol:': '😄', ':sad:': '🙁', ':woohoo:': '🎉',
  ':whistle:': '😗', ':silly:': '😜', ':unsure:': '😕', ':shock:': '😱',
  ':roll:': '🙄', ':oops:': '😳', ':evil:': '😈', ':cheer:': '👏',
  ':kiss:': '😘', ':angry:': '😠', ':blush:': '😊', ':pinch:': '😖',
  ':dry:': '😐', ':sick:': '🤢', ':side:': '😏', ':P': '😛', ':huh:': '😐',
};
const TEKST_SMILEY_RE = new RegExp(
  Object.keys(TEKST_SMILEYS).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g',
);
const smileysNaarEmoji = (s) => s.replace(TEKST_SMILEY_RE, (m) => {
  statistiek.tekstSmileys++;
  return TEKST_SMILEYS[m];
});

const ent = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Absolute URL zoals het beeldscript hem ook opbouwde, zodat het manifest matcht. */
function absoluut(src) {
  try { return new URL(ent(src).trim(), 'https://www.bclandegem.be/').href; } catch { return null; }
}

const statistiek = {
  beeldenBehouden: 0, beeldenWeg: 0, smileys: 0, tekstSmileys: 0,
  linksOntkoppeld: 0, linksBehouden: 0, videos: 0, sup: 0, pluginTags: 0,
};

function schoonHtml(html, artikel) {
  let h = html;

  // 0. Joomla-contentplugins. Deze tags werden op de oude site door een plugin
  //    vervangen; hier blijven ze als kale tekst achter en betekenen ze niets.
  h = h.replace(/\{youtube\}\s*([\w-]{6,})\s*\{\/youtube\}/gi, (m, id) => {
    statistiek.videos++;
    return `<p><a href="https://www.youtube.com/watch?v=${id}">Bekijk de video op YouTube</a></p>`;
  });
  // De .wmv-bestanden stonden op de oude server en zijn niet meer op te halen
  // (alle waarschijnlijke paden geven 404). Liever een eerlijke noot dan een
  // stilzwijgend gat waar ooit een video stond.
  h = h.replace(/\{wmv\}[^{]*\{\/wmv\}/gi, () => {
    statistiek.pluginTags++;
    return '<p><em>(video niet bewaard gebleven)</em></p>';
  });
  // {tab=1G} hoorde bij de Tabs-plugin: elk label kopte een blok. Een kop doet
  // hetzelfde werk zonder JavaScript.
  h = h.replace(/\{tab=([^}]*)\}/gi, (m, label) => {
    statistiek.pluginTags++;
    return `<h3>${label.trim().replace(/:$/, '')}</h3>`;
  });
  h = h.replace(/\{\/?tabs?\}/gi, () => { statistiek.pluginTags++; return ''; });
  h = h.replace(/\{emailcloak=[^}]*\}/gi, () => { statistiek.pluginTags++; return ''; });

  // Opmaakskelet van de oude editor-tabellen; de tabel zelf houden we.
  h = h.replace(/<colgroup>[\s\S]*?<\/colgroup>/gi, '').replace(/<col\b[^>]*>/gi, '');

  // 1. Smileys worden echte emoji. Een <img> van 16px die een knipoog voorstelt
  //    heeft in markdown geen enkele reden om een <img> te blijven.
  h = h.replace(/<img[^>]*src="[^"]*\/((?:smiley|emoticon)[^"/]*\.(?:gif|png))"[^>]*\/?>/gi, (m, naam) => {
    statistiek.smileys++;
    return SMILEYS[naam.toLowerCase()] || '';
  });
  h = h.replace(/<img[^>]*src="[^"]*(?:plugins\/editors|\/emotions\/)[^"]*"[^>]*\/?>/gi, () => {
    statistiek.smileys++;
    return '';
  });

  // 2. YouTube-iframes worden een gewone link. Een embed in een archiefpagina is
  //    zwaar en trekt de bezoeker naar Google; de video blijft zo gewoon kijkbaar.
  h = h.replace(/<iframe[^>]*src="([^"]*youtube[^"]*)"[^>]*>\s*<\/iframe>/gi, (m, src) => {
    statistiek.videos++;
    const id = (src.match(/embed\/([A-Za-z0-9_-]{6,})/) || [])[1];
    const url = id ? `https://www.youtube.com/watch?v=${id}` : ent(src).replace(/^\/\//, 'https://');
    return `<p><a href="${url}">Bekijk de video op YouTube</a></p>`;
  });

  // 3. Beelden herschrijven naar wat het redscript binnenhaalde, of weghalen.
  h = h.replace(/<img([^>]*)>/gi, (tag, attrs) => {
    const src = (attrs.match(/src\s*=\s*"([^"]*)"/i) || attrs.match(/src\s*=\s*'([^']*)'/i) || [])[1];
    const abs = src && absoluut(src);
    const treffer = abs && beeldManifest[abs];
    if (!treffer || treffer.dood || !treffer.bestand) {
      statistiek.beeldenWeg++;
      return '';
    }
    statistiek.beeldenBehouden++;
    const alt = (attrs.match(/alt\s*=\s*"([^"]*)"/i) || [])[1] || '';
    return `<img src="/archief/beelden/${treffer.bestand}" alt="${alt.replace(/"/g, '')}">`;
  });

  // 4. Links. Alles wat naar de oude Joomla-plumbing wijst is dood en blijft dood:
  //    die ontkoppelen we tot platte tekst — de woorden blijven, de href gaat weg.
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (m, attrs, inhoud) => {
    const href = ent((attrs.match(/href\s*=\s*"([^"]*)"/i) || attrs.match(/href\s*=\s*'([^']*)'/i) || [])[1] || '').trim();
    if (!href || href.startsWith('#')) { statistiek.linksOntkoppeld++; return inhoud; }

    // Verwees de link naar een beeld dat we gered hebben? Dan wijst hij daarheen.
    const abs = absoluut(href);
    const treffer = abs && beeldManifest[abs];
    if (treffer && !treffer.dood && treffer.bestand) {
      statistiek.linksBehouden++;
      return `<a href="/archief/beelden/${treffer.bestand}">${inhoud}</a>`;
    }

    const dood = /index\.php|com_(content|jumi|phocagallery|phocadownload|jevents|rokin|mailto)|icalrepeat|listevents|Stand-intraclub|bclandegem\.be\/(intraclub|component)/i.test(href);
    if (dood) { statistiek.linksOntkoppeld++; return inhoud; }
    statistiek.linksBehouden++;
    return `<a href="${href}">${inhoud}</a>`;
  });

  // 5. Rangtelwoorden: 4<sup>de</sup> -> 4de. Superscript overleeft markdown niet
  //    en betekent hier niets wiskundigs.
  h = h.replace(/<sup>\s*(ste|de|e|d)\s*<\/sup>/gi, (m, s) => { statistiek.sup++; return s; });

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

function naarMarkdown(html, artikel) {
  let md = smileysNaarEmoji(turndown.turndown(schoonHtml(html, artikel)));
  md = md
    .replace(/ /g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return md;
}

/** Reactietekst: JComments bewaarde HTML-fragmenten met <br /> erin. */
function reactieTekst(html) {
  return smileysNaarEmoji(turndown.turndown(html.replace(/<br\s*\/?>/gi, '\n')))
    .replace(/ /g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================ slugs en paden

const slugVan = (a) =>
  (a.alias || a.titel)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'artikel';

// Joomla plakte er soms al `-514` achter; die staart halen we eraf en botsingen
// lossen we daarna zelf op, per jaar, want de URL wordt /archief/{jaar}/{slug}/.
const slugSchoon = (s, id) => s.replace(new RegExp('-' + id + '$'), '').replace(/-\d+$/, (m) => (Number(m.slice(1)) > 1900 ? m : ''));

const gebruikteSlugs = new Map();
function uniekeSlug(a) {
  const jaar = datumVan(a).slice(0, 4);
  let s = slugSchoon(slugVan(a), a.id);
  const sleutel = jaar + '/' + s;
  if (!gebruikteSlugs.has(sleutel)) { gebruikteSlugs.set(sleutel, a.id); return s; }
  return `${s}-${a.id}`;
}

// ============================================================ wegschrijven

const yaml = (v) => JSON.stringify(v);

let geschreven = 0;
let metReacties = 0;
let leeg = 0;
const overgeslagenLeeg = [];
const bestanden = [];

for (const a of uniek.slice().sort((x, y) => datumVan(x).localeCompare(datumVan(y)) || x.id - y.id)) {
  const datum = datumVan(a);
  const slug = uniekeSlug(a);
  const body = naarMarkdown(a.intro + (a.full ? '\n' + a.full : ''), a);
  const reacties = (reactiesPer.get(a.id) || [])
    .map((r) => ({ ...r, tekst: reactieTekst(r.tekst) }))
    .filter((r) => r.tekst)
    .sort((x, y) => x.datum.localeCompare(y.datum));
  // Artikels zonder inhoud slaan we over. Dit zijn er geen die wij leegmaakten:
  // ze bevatten in Joomla al alleen een plugintag, een &nbsp; of een <div> die
  // een browserextensie in de editor had achtergelaten. Een titel zonder tekst
  // is geen clubgeheugen.
  if (!body) {
    leeg++;
    overgeslagenLeeg.push(`${datum} — ${a.titel} (id ${a.id})`);
    continue;
  }
  if (reacties.length) metReacties++;

  const auteur = auteurVan(a);
  const groep = GROEP_PER_CATID[a.catid] ?? null;

  let fm = '---\n';
  fm += `titel: ${yaml(a.titel.trim())}\n`;
  fm += `datum: ${datum}\n`;
  fm += `urlnaam: ${yaml(slug)}\n`;
  if (auteur) fm += `auteur: ${yaml(auteur)}\n`;
  fm += `categorie: ${yaml(catNaam[a.catid] || 'Onbekend')}\n`;
  if (groep) fm += `groep: ${yaml(groep)}\n`;
  fm += `joomlaId: ${a.id}\n`;
  if (reacties.length) {
    fm += 'reacties:\n';
    for (const r of reacties) {
      fm += `  - naam: ${yaml(r.naam)}\n`;
      fm += `    datum: ${r.datum}\n`;
      fm += `    tekst: ${yaml(r.tekst)}\n`;
    }
  }
  fm += '---\n\n';

  const naam = `${datum}-${slug}.md`;
  bestanden.push({ naam, inhoud: fm + body + '\n', a, body, reacties });
}

if (!DROOG) {
  fs.rmSync(DOEL, { recursive: true, force: true });
  fs.mkdirSync(DOEL, { recursive: true });
  for (const b of bestanden) {
    fs.writeFileSync(path.join(DOEL, b.naam), b.inhoud);
    geschreven++;
  }
}

// ============================================================ rapport

console.log(`Dump:            ${dumpBestand}`);
console.log(`Gelezen:         ${ruw.length} artikels, ${artikels.length} na filter (state 1/2, geen paginateksten)`);
console.log(`Dubbels weg:     ${dubbels.length}`);
for (const d of dubbels) console.log(`                 id ${d.weg.id} valt weg voor id ${d.blijft.id} — ${JSON.stringify(d.weg.titel.slice(0, 50))}`);
console.log(`Geschreven:      ${DROOG ? bestanden.length + ' (DROOG, niets weggeschreven)' : geschreven} bestanden`);
console.log(`Met reacties:    ${metReacties} artikels, ${[...reactiesPer.values()].flat().length} reacties totaal`);
console.log(`Leeg, dus weg:   ${leeg}`);
for (const r of overgeslagenLeeg) console.log(`                 ${r}`);
console.log('');
console.log('Inhoud:');
console.log(`  beelden behouden   ${statistiek.beeldenBehouden}`);
console.log(`  beelden verwijderd ${statistiek.beeldenWeg}  (bron dood, zie manifest)`);
console.log(`  smileys -> emoji   ${statistiek.smileys} als <img>, ${statistiek.tekstSmileys} als tekstcode (:wink:)`);
console.log(`  plugintags weg     ${statistiek.pluginTags}  ({tab=}, {wmv}, {emailcloak})`);
console.log(`  links behouden     ${statistiek.linksBehouden}`);
console.log(`  links ontkoppeld   ${statistiek.linksOntkoppeld}  (dode Joomla-paden, tekst blijft)`);
console.log(`  video's -> link    ${statistiek.videos}`);
console.log(`  rangtelwoorden     ${statistiek.sup}`);

const auteurTelling = {};
for (const b of bestanden) { const n = auteurVan(b.a) || '—'; auteurTelling[n] = (auteurTelling[n] || 0) + 1; }
console.log('\nAuteurs na normalisatie:');
Object.entries(auteurTelling).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} ${k}`));

const groepTelling = {};
for (const b of bestanden) { const g = GROEP_PER_CATID[b.a.catid] ?? 'geen groep'; groepTelling[g] = (groepTelling[g] || 0) + 1; }
console.log('\nGroepen (voor de deelpagina\'s):');
Object.entries(groepTelling).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} ${k}`));

// ======================================================== eindcontrole

// Zelfcontrole: alles wat na de conversie nog naar Joomla ruikt is een gemist
// geval, geen inhoud. Liever hier luidruchtig falen dan het op de site ontdekken.
const KLACHTEN = [
  { naam: 'Joomla-plugintag', re: /\{[a-z][a-z0-9_]*[=}]/i },
  { naam: 'smileycode', re: /:(?:wink|lol|sad|woohoo|whistle|silly|unsure|shock|roll|oops|evil|cheer|kiss|angry|blush|huh):/i },
  // Alleen echte linkdoelen: een auteur die de URL van zijn eigen artikel uittypte
  // is inhoud, geen kapotte link.
  { naam: 'link naar index.php', re: /\]\([^)]*index\.php|href="[^"]*index\.php/i },
  { naam: 'restant <span>/<div>/<font>', re: /<(?:span|div|font)\b/i },
  { naam: 'style-attribuut', re: /\sstyle\s*=/i },
  { naam: 'beeld buiten /archief/beelden/', re: /!\[[^\]]*\]\((?!\/archief\/beelden\/)[^)]*\)|<img[^>]+src="(?!\/archief\/beelden\/)/i },
  { naam: 'lege markdown-link', re: /\[\]\(\s*\)/ },
  { naam: 'mso/Word-rommel', re: /mso-|MsoNormal/i },
];

const gevonden = new Map();
for (const b of bestanden) {
  for (const k of KLACHTEN) {
    if (k.re.test(b.inhoud)) {
      const lijst = gevonden.get(k.naam) || [];
      lijst.push(b.naam);
      gevonden.set(k.naam, lijst);
    }
  }
}

console.log('\nEindcontrole:');
if (gevonden.size === 0) {
  console.log(`  schoon — geen Joomla-restanten in de ${bestanden.length} bestanden`);
} else {
  for (const [naam, lijst] of gevonden) {
    console.log(`  ⚠ ${naam}: ${lijst.length} bestand(en)`);
    lijst.slice(0, 4).forEach((n) => console.log(`      ${n}`));
    if (lijst.length > 4) console.log(`      … en ${lijst.length - 4} meer`);
  }
}

if (!DROOG) console.log(`\nBestanden staan in: ${path.relative(WORTEL, DOEL)}`);
