// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import trainings from './src/data/trainings.json' with { type: 'json' };

// Twee bestemmingen, één broncode:
//   GitHub Pages   https://bc-landegem.github.io/Website/   (deploy.yml, standaard)
//   Shared hosting https://www.bclandegem.be/               (deploy-ftp.yml)
// De workflows zetten SITE_URL en BASE_PATH; zonder die variabelen (lokaal, in
// de container, in deploy.yml) blijft alles zoals het was: /Website op github.io.
// Lokaal tegen de root bouwen kan met dezelfde variabelen in .env — zie .env.example.
// Alles wat van de base afhangt (url(), manifest, service worker, redirects)
// leest hem uit import.meta.env.BASE_URL en volgt dus vanzelf.
const env = { ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''), ...process.env };
const site = env.SITE_URL || 'https://bc-landegem.github.io';
// Altijd met voorloopslash en zonder slash op het einde; '/' blijft '/'.
const base = `/${(env.BASE_PATH ?? '/Website').replace(/^\/+|\/+$/g, '')}`;

export default defineConfig({
  site,
  // Aan sinds Astro 7: de compressor plakte vroeger woorden aaneen wanneer een
  // tekstregel na een tag begon (bv. </strong> op het regeleinde). Dat is opgelost —
  // nagemeten over alle pagina's, de tekstinhoud is identiek. Scheelt ~180 kB ruw.
  compressHTML: true,
  base,
  // Het intern reglement is opgegaan in de gedragscode; oude links blijven werken.
  // Astro zet de base niet voor de bestemming van een redirect, vandaar expliciet.
  redirects: {
    '/club/intern-reglement': `${base}/club/gedragscode/`.replace(/\/{2,}/g, '/'),
    // Zoals op de oude site: /inschrijven gaat rechtstreeks naar het Twizzit-formulier.
    // Een korte link om door te geven, bewust niet in het menu.
    '/inschrijven': trainings.registrationForm,
  },
  // Archivo komt van Google, maar bij de build: Astro haalt de bestanden op en
  // zet ze onder /_astro/fonts/. Rechtstreeks van fonts.googleapis.com was de
  // stylesheet render-blocking op een vreemd origin (Lighthouse: ~750 ms), met
  // daarachter nog een sprong naar fonts.gstatic.com voor het bestand zelf — en
  // elk bezoek gaf het IP-adres van de bezoeker aan Google. Eén variabel bestand
  // draagt de drie typestemmen; de breedte-as moet er expliciet bij, anders
  // levert Google alleen wdth 100 en vallen display, baan en cijfer samen.
  fonts: [
    {
      name: 'Archivo',
      cssVariable: '--font-archivo',
      provider: fontProviders.google(),
      weights: ['300 900'],
      styles: ['normal'],
      // latin-ext voor spelersnamen buiten het Nederlandse alfabet; de browser
      // haalt dat bestand pas op wanneer zo'n teken echt op de pagina staat.
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      // Astro rekent anders een Arial met size-adjust uit, maar meet dit
      // variabele bestand verkeerd: 131%, en een zin die in Archivo 704px breed
      // is, werd in die fallback 935px (kaal Arial: 715px). Ook vette tekst
      // kwam er mager uit. Zonder voelt het wisselen rustiger.
      optimizedFallbacks: false,
      options: { experimental: { variableAxis: { wdth: [['62', '125']] } } },
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
