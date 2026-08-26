// De sociale kanalen van de club, zoals ze onderaan elke pagina verschijnen.
//
// Bewust géén ingebedde tijdlijn van Facebook of Instagram: die vraagt een
// token en een server (de site is statisch), sleept trackingcookies mee en
// oogt dood zodra er een paar maanden niets gepost wordt. Een knop naar het
// profiel doet hetzelfde werk zonder één van die drie problemen.
//
// Een leeg blok is een leeg blok: staat er niets in deze lijst, dan verdwijnt
// de hele sectie uit de footer. Kanaal toevoegen = één regel hieronder.

export type SocialIcon = 'facebook' | 'instagram';

export interface SocialChannel {
  /** Naam zoals hij in de tooltip en voor schermlezers gebruikt wordt. */
  name: string;
  /** Volledige URL van het profiel of de pagina. */
  url: string;
  icon: SocialIcon;
}

export const channels: SocialChannel[] = [
   { name: 'BC Landegem op Facebook', url: 'https://www.facebook.com/BCLandegem', icon: 'facebook' },
   { name: 'BC Landegem op Instagram', url: 'https://www.instagram.com/bclandegem', icon: 'instagram' },
];
