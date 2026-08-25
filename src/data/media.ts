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

export type MediaCategory = 'jeugd' | 'competitie' | 'intraclub' | 'club';

export interface MediaAlbum {
  /** URL-deel op de site, bv. 'pbo-jeugdcup-2026' -> /media/pbo-jeugdcup-2026/ */
  slug: string;
  /** Nette titel zoals hij op de site verschijnt. */
  titel: string;
  /** Jaar en maand van het event, 'JJJJ-MM' — bepaalt ook de volgorde. Enkel 'JJJJ' mag als de maand onbekend is. */
  datum: string;
  categorie: MediaCategory;
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
  {
    slug: 'pbo-jeugdcup-2025',
    titel: 'PBO Jeugdcup 2025',
    datum: '2025-03',
    categorie: 'jeugd',
    share: 'https://photos.app.goo.gl/kWhWmVNU7mx6AsXU7',
  },
  {
    slug: 'weekend-2023',
    titel: 'Weekend 2023',
    datum: '2023-10',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/qJR7EW4o5RsQb8Hx6',
  },
  {
    slug: 'weekend-2019',
    titel: 'Weekend 2019',
    datum: '2019-11',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/cVeQGsD8vbEJsmKa7',
  },
  {
    slug: 'hoge-duinen-2017',
    titel: 'Hoge Duinen 2017',
    datum: '2017',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/X5kHuXn3Le6s5oFV9',
  },
  {
    slug: 'bezoek-sporthal-nevele',
    titel: 'Bezoek sporthal Nevele',
    datum: '2016-04',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/h9X2AqUgCBS6MrKs7',
  },
  {
    slug: 'badmintonweekend-2016',
    titel: 'Badmintonweekend 2016',
    datum: '2016',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/2H6ZLh5EwHFcPVN9A',
  },
  {
    slug: 'kluisbos-2015',
    titel: 'Kluisbos 2015',
    datum: '2015',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/VX43gSLm7iEA8S5j7',
  },
  {
    slug: 'hapje-tapje-2015',
    titel: 'Hapje-Tapje 2015',
    datum: '2015',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/QHobrUtHAw9NrcPt8',
  },
  {
    slug: 'fluo-badminton-2015',
    titel: 'Fluo badminton 2015',
    datum: '2015',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/w68fNTbcKk7eRQ2n8',
  },
  {
    slug: 'eerste-intraclub-2014',
    titel: 'Eerste intraclub + prijsuitreiking',
    datum: '2014-09',
    categorie: 'intraclub',
    share: 'https://photos.app.goo.gl/L3AYpeTsx7zapyCb9',
  },
  {
    slug: 'de-panne-2014',
    titel: 'De Panne 2014',
    datum: '2014',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/msZwtqRP54NJZNrZ8',
  },
  {
    slug: 'fluo-badminton-2014',
    titel: 'Fluo badminton 2014',
    datum: '2014',
    categorie: 'club',
    share: 'https://photos.app.goo.gl/aDjVjDDuUvTGPucC9',
  },
  {
    slug: 'play-offs-2014',
    titel: 'Play-offs 2014',
    datum: '2014',
    categorie: 'competitie',
    share: 'https://photos.app.goo.gl/AMRrzReggrfAJVvF8',
  },
  {
    slug: 'jeugdcup-buggenhout-2014',
    titel: 'Jeugdcup Buggenhout 2014',
    datum: '2014',
    categorie: 'jeugd',
    share: 'https://photos.app.goo.gl/ntB2E6p4nZAudqZM7',
  },
];
