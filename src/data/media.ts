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
  title: string;
  /** Jaar en maand van het event, 'JJJJ-MM' — bepaalt ook de volgorde. Enkel 'JJJJ' mag als de maand onbekend is. */
  date: string;
  category: MediaCategory;
  /** Publieke share-link van het Google Photos-album. */
  share: string;
}

export const albums: MediaAlbum[] = [
  {
    slug: 'pbo-jeugdcup-2026',
    title: 'PBO Jeugdcup 2026',
    date: '2026-03',
    category: 'jeugd',
    share: 'https://photos.app.goo.gl/2axZmDtYLtPkDxeg6',
  },
  {
    slug: 'pbo-jeugdcup-2025',
    title: 'PBO Jeugdcup 2025',
    date: '2025-03',
    category: 'jeugd',
    share: 'https://photos.app.goo.gl/kWhWmVNU7mx6AsXU7',
  },
  {
    slug: 'weekend-2023',
    title: 'Weekend 2023',
    date: '2023-10',
    category: 'club',
    share: 'https://photos.app.goo.gl/qJR7EW4o5RsQb8Hx6',
  },
  {
    slug: 'weekend-2019',
    title: 'Weekend 2019',
    date: '2019-11',
    category: 'club',
    share: 'https://photos.app.goo.gl/cVeQGsD8vbEJsmKa7',
  },
  {
    slug: 'hoge-duinen-2017',
    title: 'Hoge Duinen 2017',
    date: '2017',
    category: 'club',
    share: 'https://photos.app.goo.gl/X5kHuXn3Le6s5oFV9',
  },
  {
    slug: 'bezoek-sporthal-nevele',
    title: 'Bezoek sporthal Nevele',
    date: '2016-04',
    category: 'club',
    share: 'https://photos.app.goo.gl/h9X2AqUgCBS6MrKs7',
  },
  {
    slug: 'badmintonweekend-2016',
    title: 'Badmintonweekend 2016',
    date: '2016',
    category: 'club',
    share: 'https://photos.app.goo.gl/2H6ZLh5EwHFcPVN9A',
  },
  {
    slug: 'kluisbos-2015',
    title: 'Kluisbos 2015',
    date: '2015',
    category: 'club',
    share: 'https://photos.app.goo.gl/VX43gSLm7iEA8S5j7',
  },
  {
    slug: 'hapje-tapje-2015',
    title: 'Hapje-Tapje 2015',
    date: '2015',
    category: 'club',
    share: 'https://photos.app.goo.gl/QHobrUtHAw9NrcPt8',
  },
  {
    slug: 'fluo-badminton-2015',
    title: 'Fluo badminton 2015',
    date: '2015',
    category: 'club',
    share: 'https://photos.app.goo.gl/w68fNTbcKk7eRQ2n8',
  },
  {
    slug: 'eerste-intraclub-2014',
    title: 'Eerste intraclub + prijsuitreiking',
    date: '2014-09',
    category: 'intraclub',
    share: 'https://photos.app.goo.gl/L3AYpeTsx7zapyCb9',
  },
  {
    slug: 'de-panne-2014',
    title: 'De Panne 2014',
    date: '2014',
    category: 'club',
    share: 'https://photos.app.goo.gl/msZwtqRP54NJZNrZ8',
  },
  {
    slug: 'fluo-badminton-2014',
    title: 'Fluo badminton 2014',
    date: '2014',
    category: 'club',
    share: 'https://photos.app.goo.gl/aDjVjDDuUvTGPucC9',
  },
  {
    slug: 'play-offs-2014',
    title: 'Play-offs 2014',
    date: '2014',
    category: 'competitie',
    share: 'https://photos.app.goo.gl/AMRrzReggrfAJVvF8',
  },
  {
    slug: 'jeugdcup-buggenhout-2014',
    title: 'Jeugdcup Buggenhout 2014',
    date: '2014',
    category: 'jeugd',
    share: 'https://photos.app.goo.gl/ntB2E6p4nZAudqZM7',
  },
];
