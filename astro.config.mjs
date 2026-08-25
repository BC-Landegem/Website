// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages: https://bc-landegem.github.io/Website/
// Bij de latere domein-switch naar bclandegem.be: site aanpassen en base op '/' zetten.
const base = '/Website';

export default defineConfig({
  site: 'https://bc-landegem.github.io',
  // Aan sinds Astro 7: de compressor plakte vroeger woorden aaneen wanneer een
  // tekstregel na een tag begon (bv. </strong> op het regeleinde). Dat is opgelost —
  // nagemeten over alle pagina's, de tekstinhoud is identiek. Scheelt ~180 kB ruw.
  compressHTML: true,
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
