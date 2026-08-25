import { getCollection, type CollectionEntry } from 'astro:content';

export type Artikel = CollectionEntry<'archief'>;
export type Groep = NonNullable<Artikel['data']['groep']>;

/** De vijf deelpagina's, in de volgorde waarin ze op /archief/ verschijnen. */
export const GROEPEN: { sleutel: Groep; label: string; uitleg: string }[] = [
  {
    sleutel: 'competitie',
    label: 'Competitie',
    uitleg: 'Wedstrijdverslagen, klassementen en alles rond de ploegen.',
  },
  {
    sleutel: 'intraclub',
    label: 'Intraclub',
    uitleg: 'Speeldagen, uitslagen en eindstanden van de clubcompetitie.',
  },
  {
    sleutel: 'toernooien',
    label: 'Toernooien',
    uitleg: 'Provinciale kampioenschappen, toernooiverslagen en uitnodigingen.',
  },
  {
    sleutel: 'jeugd',
    label: 'Jeugd',
    uitleg: 'Jeugdcups, trainingen en de badmintonweekends.',
  },
  {
    sleutel: 'club',
    label: 'Clubleven',
    uitleg: 'Mededelingen, recepties, seizoensstarten en varia.',
  },
];

export const groepLabel = (g: Groep): string =>
  GROEPEN.find((x) => x.sleutel === g)?.label ?? g;

let cache: Artikel[] | null = null;

/** Alle archiefartikels, nieuwste eerst. */
export async function alleArtikels(): Promise<Artikel[]> {
  cache ??= (await getCollection('archief')).sort(
    (a, b) => b.data.datum.getTime() - a.data.datum.getTime(),
  );
  return cache;
}

export const jaarVan = (a: Artikel): string => String(a.data.datum.getUTCFullYear());

/** Jaren met hun artikels, nieuwste jaar eerst. */
export async function perJaar(): Promise<Map<string, Artikel[]>> {
  const jaren = new Map<string, Artikel[]>();
  for (const a of await alleArtikels()) {
    const j = jaarVan(a);
    if (!jaren.has(j)) jaren.set(j, []);
    jaren.get(j)!.push(a);
  }
  return jaren;
}

export async function vanGroep(groep: Groep): Promise<Artikel[]> {
  return (await alleArtikels()).filter((a) => a.data.groep === groep);
}

/** '9 november 2013' */
export function datumLang(d: Date): string {
  return d.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** '09.11.2013' — voor de smalle datumkolom in lijsten. */
export function datumKort(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export const artikelPad = (a: Artikel): string => `/archief/${jaarVan(a)}/${a.data.urlnaam}/`;

/**
 * Eerste zinnen van de body, als samenvatting in lijsten. De markdown bevat
 * geen frontmatter meer, maar wel links en beelden — die strippen we hier.
 */
export function inleiding(a: Artikel, maxLengte = 180): string {
  const tekst = a.body
    ?.replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!tekst) return '';
  if (tekst.length <= maxLengte) return tekst;
  const geknipt = tekst.slice(0, maxLengte);
  const spatie = geknipt.lastIndexOf(' ');
  return `${geknipt.slice(0, spatie > 80 ? spatie : maxLengte)}…`;
}
