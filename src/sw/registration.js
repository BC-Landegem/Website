/*
 * Registreert de service worker en ruimt vreemde workers op. Sjabloon: het
 * script wordt inline in de <head> gezet door src/layouts/Layout.astro, dat de
 * twee placeholders hieronder invult.
 *
 * Dat opruimen is nodig voor de domeinswitch naar bclandegem.be. Daar staat nu
 * een Joomla-site met vier service workers in de root (BCLandegemServiceWorker,
 * pwabuilder-sw en twee OneSignal-workers). Bij terugkerende bezoekers blijven
 * die geregistreerd; ze onderscheppen onze pagina's zolang ze bestaan. Een
 * worker kan zijn collega's niet afmelden — een pagina wel, en dat gebeurt hier.
 *
 * We melden alleen registraties af waarvan de scope onze eigen pagina's omvat.
 * Dat is precies de groep die ons in de weg kan zitten, en het spaart op
 * bc-landegem.github.io de workers van eventuele andere projecten op datzelfde
 * domein. De caches ruimen we pas op als er echt zo'n vreemde worker stond.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var SW_PATH = '__SW_PATH__';
  var BASE = '__BASE__';
  var OUR_SCRIPT = new URL(SW_PATH, location.origin).href;

  addEventListener('load', function () {
    navigator.serviceWorker.register(SW_PATH).then(cleanUp, cleanUp);
  });

  // Onze eigen registratie kan tijdens een update nog een oude active worker
  // hebben, dus kijken we naar alle drie de fases voor we iets afmelden.
  function isOurs(registration) {
    return ['active', 'installing', 'waiting'].some(function (phase) {
      return registration[phase] && registration[phase].scriptURL === OUR_SCRIPT;
    });
  }

  function cleanUp() {
    if (!navigator.serviceWorker.getRegistrations) return;
    navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        var foreign = registrations.filter(function (registration) {
          if (isOurs(registration)) return false;
          var scope = new URL(registration.scope).pathname;
          return BASE.indexOf(scope) === 0;
        });
        if (!foreign.length) return;
        return Promise.all(
          foreign.map(function (registration) {
            return registration.unregister().catch(function () {});
          }),
        ).then(clearForeignCaches);
      })
      .catch(function () {});
  }

  function clearForeignCaches() {
    if (!self.caches || !caches.keys) return;
    return caches
      .keys()
      .then(function (names) {
        return Promise.all(
          names.map(function (name) {
            return name.indexOf('bcl-') === 0 ? null : caches.delete(name).catch(function () {});
          }),
        );
      })
      .catch(function () {});
  }
})();
