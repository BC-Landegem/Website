// Astro laadt de Vite-clienttypes niet mee, dus `import x from './y.csv?raw'`
// is zonder deze declaratie voor TypeScript een onbekende module.
declare module '*.csv?raw' {
  const content: string;
  export default content;
}
