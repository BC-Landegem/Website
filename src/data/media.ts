// Gecureerde lijst van fotoalbums op de site.
//
// De foto's zelf blijven in Google Photos; per album is hier enkel de publieke
// share-link nodig ("Delen" > "Link maken" in Google Photos). De workflow
// media-sync (nachtelijk, of handmatig via Actions) leest die share-pagina's
// uit en schrijft de fotolijsten naar media.json — dat bestand bewerk je nooit
// met de hand. Lokaal bijwerken kan met: node scripts/scrape-media.mjs
//
// Album toevoegen = hier één blok toevoegen; album (of losse foto) verwijderen
// van de site = uit het Google Photos-album halen of hier de regel schrappen.

export type MediaCategorie = 'jeugd' | 'competitie' | 'intraclub' | 'club';

export interface MediaAlbum {
  /** URL-deel op de site, bv. 'pbo-jeugdcup-2026' -> /media/pbo-jeugdcup-2026/ */
  slug: string;
  /** Nette titel zoals hij op de site verschijnt. */
  titel: string;
  /** Jaar en maand van het event, 'JJJJ-MM' — bepaalt ook de volgorde. */
  datum: string;
  categorie: MediaCategorie;
  /** Publieke share-link van het Google Photos-album. */
  share: string;
}

export const albums: MediaAlbum[] = [
  {
    slug: 'pbo-jeugdcup-2026',
    titel: 'PBO Jeugdcup 2026',
    datum: '2026-03',
    categorie: 'jeugd',
    share: 'https://photos.app.goo.gl/2axZmDtYLtPkDxeg6',
  },
];
