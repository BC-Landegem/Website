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
