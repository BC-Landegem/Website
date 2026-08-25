import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'archief'>;
export type Group = NonNullable<Article['data']['groep']>;

/** De vijf deelpagina's, in de volgorde waarin ze op /archief/ verschijnen. */
export const GROUPS: { key: Group; label: string; description: string }[] = [
  {
    key: 'competitie',
    label: 'Competitie',
    description: 'Wedstrijdverslagen, klassementen en alles rond de ploegen.',
  },
  {
    key: 'intraclub',
    label: 'Intraclub',
    description: 'Speeldagen, uitslagen en eindstanden van de clubcompetitie.',
  },
  {
    key: 'toernooien',
    label: 'Toernooien',
    description: 'Provinciale kampioenschappen, toernooiverslagen en uitnodigingen.',
  },
  {
    key: 'jeugd',
    label: 'Jeugd',
    description: 'Jeugdcups, trainingen en de badmintonweekends.',
  },
  {
    key: 'club',
    label: 'Clubleven',
    description: 'Mededelingen, recepties, seizoensstarten en varia.',
  },
];

export const groupLabel = (g: Group): string => GROUPS.find((x) => x.key === g)?.label ?? g;

let cache: Article[] | null = null;

/** Alle archiefartikels, nieuwste eerst. */
export async function allArticles(): Promise<Article[]> {
  cache ??= (await getCollection('archief')).sort(
    (a, b) => b.data.datum.getTime() - a.data.datum.getTime(),
  );
  return cache;
}

export const yearOf = (a: Article): string => String(a.data.datum.getUTCFullYear());

/** Jaren met hun artikels, nieuwste jaar eerst. */
export async function byYear(): Promise<Map<string, Article[]>> {
  const years = new Map<string, Article[]>();
  for (const a of await allArticles()) {
    const y = yearOf(a);
    if (!years.has(y)) years.set(y, []);
    years.get(y)!.push(a);
  }
  return years;
}

export async function inGroup(group: Group): Promise<Article[]> {
  return (await allArticles()).filter((a) => a.data.groep === group);
}

/** '9 november 2013' */
export function dateLong(d: Date): string {
  return d.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** '09.11.2013' — voor de smalle datumkolom in lijsten. */
export function dateShort(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

export const articlePath = (a: Article): string => `/archief/${yearOf(a)}/${a.data.urlnaam}/`;

/**
 * Eerste zinnen van de body, als samenvatting in lijsten. De markdown bevat
 * geen frontmatter meer, maar wel links en beelden — die strippen we hier.
 */
export function excerpt(a: Article, maxLength = 180): string {
  const text = a.body
    ?.replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const space = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, space > 80 ? space : maxLength)}…`;
}
