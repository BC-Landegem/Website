// Het contactformulier praat met een endpoint op intra.bclandegem.be — dezelfde
// Laravel-app als de intraclub-API, want daar draait al PHP.
//
// Bewust een gewone <form method="post"> en géén fetch(): een native form-POST
// is een simple request, dus is er geen CORS-configuratie nodig. Dat is precies
// de valstrik die bij de intraclub-migratie tijd gekost heeft (de API laat maar
// één origin toe). De server antwoordt met een redirect terug naar deze site.
export const CONTACT_ENDPOINT =
  import.meta.env.PUBLIC_CONTACT_ENDPOINT ?? 'https://intra.bclandegem.be/api/contact';

// Sitesleutel van Cloudflare Turnstile. Leeg (of niet gezet) betekent: geen
// widget. Het formulier blijft dan werken op honeypot, tijdslot en de rate
// limit van de server — zo kan de Astro-kant live vóór het Cloudflare-account
// bestaat. De server beslist zelf of hij een token eist.
export const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? '';

// Het algemene adres. Staat hier zodat de plekken die het nog tonen (de
// contactpagina onder het formulier, de foutmelding, de offline-melding en de
// privacyverklaring) niet uit elkaar kunnen lopen.
export const CLUB_MAIL = 'info@bclandegem.be';

// Het meldformulier voor grensoverschrijdend gedrag (/club/melden/). Een eigen
// endpoint naast /api/contact, met de ontvanger hard in de Laravel-config: de
// melding mag nooit bij het bestuur belanden, en een bestemming die de client
// zou kiezen is precies de bug die dat ooit laat gebeuren. Zelfde mechaniek als
// het contactformulier (native form-POST, redirect terug). Het contract staat in
// de README onder Databronnen.
export const REPORT_ENDPOINT =
  import.meta.env.PUBLIC_REPORT_ENDPOINT ?? 'https://intra.bclandegem.be/api/melding';

// Zonder endpoint rendert <form action=""> als een post naar de pagina zelf, en
// krijgt de melder een kale 405 van de statische host. Bij het contactformulier
// staat het mailadres op de pagina; hier is er geen tweede weg, dus liever een
// build die faalt dan een formulier dat stil in het niets post.
if (!REPORT_ENDPOINT) {
  throw new Error('PUBLIC_REPORT_ENDPOINT is leeg — /club/melden/ zou stil in het niets posten');
}

// Het Aanspreekpunt Integriteit. Haar mailadres staat bewust nérgens op de site
// (op haar vraag, september 2026): het formulier is de enige schriftelijke weg,
// en de ontvanger ervan staat alleen in de Laravel-config. Wisselt de persoon,
// dan verandert deze naam, de tekst op /club/aanspreekpunt-integriteit/ én die
// config-regel.
export const INTEGRITY_NAME = 'Lieselot Van Haute';
