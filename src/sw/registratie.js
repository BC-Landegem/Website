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

  var SW_PAD = '__SW_PAD__';
  var BASE = '__BASE__';
  var ONS_SCRIPT = new URL(SW_PAD, location.origin).href;

  addEventListener('load', function () {
    navigator.serviceWorker.register(SW_PAD).then(ruimOp, ruimOp);
  });

  // Onze eigen registratie kan tijdens een update nog een oude active worker
  // hebben, dus kijken we naar alle drie de fases voor we iets afmelden.
  function isOnze(registratie) {
    return ['active', 'installing', 'waiting'].some(function (fase) {
      return registratie[fase] && registratie[fase].scriptURL === ONS_SCRIPT;
    });
  }

  function ruimOp() {
    if (!navigator.serviceWorker.getRegistrations) return;
    navigator.serviceWorker
      .getRegistrations()
      .then(function (registraties) {
        var vreemd = registraties.filter(function (registratie) {
          if (isOnze(registratie)) return false;
          var scope = new URL(registratie.scope).pathname;
          return BASE.indexOf(scope) === 0;
        });
        if (!vreemd.length) return;
        return Promise.all(
          vreemd.map(function (registratie) {
            return registratie.unregister().catch(function () {});
          }),
        ).then(wisVreemdeCaches);
      })
      .catch(function () {});
  }

  function wisVreemdeCaches() {
    if (!self.caches || !caches.keys) return;
    return caches
      .keys()
      .then(function (namen) {
        return Promise.all(
          namen.map(function (naam) {
            return naam.indexOf('bcl-') === 0 ? null : caches.delete(naam).catch(function () {});
          }),
        );
      })
      .catch(function () {});
  }
})();
