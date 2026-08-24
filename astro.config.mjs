// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages: https://bc-landegem.github.io/Website/
// Bij de latere domein-switch naar bclandegem.be: site aanpassen en base verwijderen.
export default defineConfig({
  site: 'https://bc-landegem.github.io',
  base: '/Website',
  vite: {
    plugins: [tailwindcss()],
  },
});
