// De sociale kanalen van de club, zoals ze onderaan elke pagina verschijnen.
//
// Bewust géén ingebedde tijdlijn van Facebook of Instagram: die vraagt een
// token en een server (de site is statisch), sleept trackingcookies mee en
// oogt dood zodra er een paar maanden niets gepost wordt. Een knop naar het
// profiel doet hetzelfde werk zonder één van die drie problemen.
//
// Een leeg blok is een leeg blok: staat er niets in deze lijst, dan verdwijnt
// de hele sectie uit de footer. Kanaal toevoegen = één regel hieronder.

export type SociaalIcoon = 'facebook' | 'instagram';

export interface SociaalKanaal {
  /** Naam zoals hij in de tooltip en voor schermlezers gebruikt wordt. */
  naam: string;
  /** Volledige URL van het profiel of de pagina. */
  url: string;
  icoon: SociaalIcoon;
}

export const kanalen: SociaalKanaal[] = [
  // { naam: 'BC Landegem op Facebook', url: 'https://www.facebook.com/…', icoon: 'facebook' },
  // { naam: 'BC Landegem op Instagram', url: 'https://www.instagram.com/…', icoon: 'instagram' },
];
