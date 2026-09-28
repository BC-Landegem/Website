// Vervangt de service worker van de oude github.io-versie (/Website/sw.js).
// Wie de site hier ooit bezocht of installeerde, haalt dit bestand bij de
// volgende updatecheck op. Het wist onze caches, meldt zich af en herlaadt open
// vensters, die dan op de doorverwijzing naar www.bclandegem.be uitkomen.
// Zonder dit bestand 404't die updatecheck en blijft de oude worker de
// gecachte schil serveren, offline zelfs voor altijd.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Alleen bcl-: op bc-landegem.github.io kunnen andere projecten hun
      // eigen caches hebben.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith('bcl-')).map((name) => caches.delete(name)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.navigate(client.url));
    })(),
  );
});
