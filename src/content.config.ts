import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Het archief van de oude Joomla-site: 837 artikels uit 2009–2025.
 *
 * De bestanden zijn ooit gegenereerd door `scripts/archief-conversie.mjs`, maar
 * zijn sindsdien de bron van waarheid — opnieuw converteren wist ze. Zie README.
 */
const archief = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/archief' }),
  schema: z.object({
    titel: z.string(),
    datum: z.date(),
    /**
     * Laatste stuk van de URL: /archief/{jaar}/{urlnaam}/. Bewust niet `slug`:
     * de glob-loader claimt dat veld en eist dan dat het over de hele collectie
     * uniek is. Onze namen zijn uniek per jaar — `intraclub` bestaat in 2010,
     * 2012 én 2013 — en de loader gooide de dubbels stilletjes weg.
     */
    urlnaam: z.string(),
    /** Ontbreekt bij een handvol artikels waar Joomla geen auteur bewaarde. */
    auteur: z.string().optional(),
    /** De Joomla-categorie zoals ze heette, ook als die naam achteraf loog. */
    categorie: z.string(),
    /** Bundelt categorieën tot de vijf deelpagina's; leeg voor de oude nieuwsstroom. */
    groep: z.enum(['competitie', 'intraclub', 'jeugd', 'toernooien', 'club']).optional(),
    joomlaId: z.number(),
    reacties: z
      .array(
        z.object({
          naam: z.string(),
          datum: z.date(),
          tekst: z.string(),
        }),
      )
      .optional(),
  }),
});

export const collections = { archief };
