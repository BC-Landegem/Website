// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages: https://bc-landegem.github.io/Website/
// Bij de latere domein-switch naar bclandegem.be: site aanpassen en base op '/' zetten.
const base = '/Website';

export default defineConfig({
  site: 'https://bc-landegem.github.io',
  // Uit: de HTML-compressie van Astro slikt de spatie op wanneer een tekstregel
  // begint na een tag (bv. </strong> op het regeleinde). Dat plakt woorden aan
  // elkaar. Kost ~0,5 kB gzip per pagina — dat is het waard.
  compressHTML: false,
  base,
  // Het intern reglement is opgegaan in de gedragscode; oude links blijven werken.
  // Astro zet de base niet voor de bestemming van een redirect, vandaar expliciet.
  redirects: {
    '/club/intern-reglement': `${base}/club/gedragscode/`.replace(/\/{2,}/g, '/'),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
