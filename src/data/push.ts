// Pushberichten: eigen Web Push (VAPID) via de Laravel-app op
// intra.bclandegem.be, dezelfde app als de intraclub-API en de formulieren.
// Bewust geen OneSignal meer, zoals op de oude Joomla-site: de club heeft al
// een backend, en een derde partij in de service worker koopt niets wat die
// backend niet kan. Beslissing en redenering: PRODUCT.md.
//
// Gedeeld door drie kanten: de service worker (ontvangen, klikken, een
// verlopen abonnement vernieuwen), de instellingenpagina /club/pushberichten/
// (aan- en afzetten, onderwerpen kiezen) en de plekken die naar die pagina
// linken en moeten weten of push überhaupt aan staat.

/**
 * Het endpoint voor abonnementen. Het contract (PUT/DELETE, velden, wat de
 * server terugstuurt) staat in de README onder Databronnen · Pushberichten.
 */
export const PUSH_ENDPOINT =
  import.meta.env.PUBLIC_PUSH_ENDPOINT ?? 'https://intra.bclandegem.be/api/push/subscriptions';

/**
 * De publieke VAPID-sleutel (base64url, 65 bytes ongecomprimeerd P-256). Hij
 * hoort bij het private exemplaar in de Laravel-config; een ander paar per
 * omgeving houdt testberichten weg van de echte abonnees.
 *
 * Leeg betekent: push staat uit. De instellingenpagina zegt dat dan, de links
 * ernaartoe verdwijnen, en de service worker registreert geen handlers. Zo kan
 * de site-kant live vóór de Laravel-kant klaar is, en bouwt GitHub Pages zonder
 * sleutel gewoon een site zonder push.
 */
export const VAPID_PUBLIC_KEY = import.meta.env.PUBLIC_VAPID_PUBLIC_KEY ?? '';

export const PUSH_ENABLED = VAPID_PUBLIC_KEY !== '';

/**
 * De onderwerpen waarop je apart kan intekenen. De id is wat over de lijn gaat
 * en wat de server kent; label en uitleg zijn wat de abonnee ziet. Komt er een
 * onderwerp bij, dan ook aan de Laravel-kant (validatie én een verzender).
 */
export const PUSH_TOPICS = [
  // Intraclub staat eerst: daar bewijst push zijn nut. Clubberichten is bijzaak.
  // De clubcommunicatie (mailings, ploegberichten, afgelastingen) loopt via
  // Twizzit; dit kanaal dient hoogstens om occasioneel iets extra rond te
  // sturen. De teksten mogen het dus nergens groter maken dan het is.
  {
    id: 'intraclub',
    label: 'Intraclub',
    description:
      'Een bericht zodra de stand van een nieuwe speeldag berekend is, met een link naar de uitslag. Om de twee weken tijdens het seizoen.',
  },
  {
    id: 'club',
    label: 'Clubberichten',
    description:
      'Heel af en toe iets extra van het bestuur, naast wat al via Twizzit komt: een open speeldag, een lessenreeks. Hoogstens een paar keer per seizoen, vaak minder.',
  },
] as const;

export type PushTopic = (typeof PUSH_TOPICS)[number]['id'];
