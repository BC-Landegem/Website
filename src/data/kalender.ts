// Kalenderbronnen, overgenomen van de oude site (Joomla/FullCalendar v4-config).
// De API-key is een publieke, referrer-restricted browser-key voor de Google Calendar API.
export const googleCalendarApiKey = 'AIzaSyDnzhbVO9JCyQqot348j_yt9pSUYfiMHY4';

/**
 * Soort activiteit; bepaalt de kleur op de kalender. De Joomla-kleuren per
 * ploeg zijn bewust weg: kleur zegt wát je er kan doen (spelen, trainen,
 * kijken, meemaken), de titel draagt de details.
 */
export type KalenderCategorie = 'spelen' | 'training' | 'match' | 'event';

/**
 * Wereldkleuren per categorie (De Shuttle): kurk = zelf spelen, inkt =
 * trainingen en matchen, clubrood = de events. `tekst` is de tekstkleur op
 * gevulde eventblokken (contrast ≥ 4.5:1).
 */
export const categorieen: Record<KalenderCategorie, { label: string; kleur: string; tekst: string }> = {
  spelen: { label: 'Vrij spel & intraclub', kleur: '#a97438', tekst: '#1b1410' }, // kurk-600 / inkt-950
  training: { label: 'Trainingen', kleur: '#6b5c50', tekst: '#ffffff' }, // inkt-500
  match: { label: 'Competitiematchen', kleur: '#1b1410', tekst: '#faf7f1' }, // inkt-950 / veer-50
  event: { label: 'Events', kleur: '#d03117', tekst: '#ffffff' }, // club-600
};

/**
 * Haal "groep N" uit een ruwe kalendertitel. De jeugdtraining op zaterdag
 * bestaat uit groep 1 (9u30) en groep 2 (11u) in één bron; de groep moet
 * overal op de site zichtbaar blijven, ook al vervangen we de rest van de
 * interne titel door de vaste omschrijving.
 */
export function groepUitTitel(titel: string | undefined): string | null {
  const match = titel?.match(/groep\s*(\d+)/i);
  return match ? `groep ${match[1]}` : null;
}

export interface KalenderBron {
  label: string;
  googleCalendarId: string;
  categorie: KalenderCategorie;
  /**
   * Vaste weergavetekst voor deze bron. Enkel bronnen met dit veld tellen als
   * speelmoment (hero-chip op de homepage) én krijgen op de kalender een
   * vaste titel — de tijden komen uit de kalender, de tekst bewust niet
   * (kalendertitels zijn interne jargon). Thuismatchen tellen ook mee als
   * speelmoment, maar krijgen hun tekst uit het ploeglabel.
   */
  speelmoment?: { omschrijving: string; doelgroep: string };
}

export const bronnen: KalenderBron[] = [
  { label: 'Events', categorie: 'event', googleCalendarId: '96vl7c6jvq0ilvbkk62vh058rp2uc5pj@import.calendar.google.com' },
  { label: 'Vrij spelen', categorie: 'spelen', googleCalendarId: 'q2tp121lj5fs101js7ph7qq2hgv7iqu1@import.calendar.google.com', speelmoment: { omschrijving: 'Vrij spel', doelgroep: 'iedereen' } },
  { label: 'Training jeugd', categorie: 'training', googleCalendarId: '1s8ga8r6ua28mb0ld3eol386amag2j54@import.calendar.google.com', speelmoment: { omschrijving: 'Jeugdtraining', doelgroep: 'jeugd' } },
  { label: 'Vrij spelen jeugd', categorie: 'spelen', googleCalendarId: 'v5i8e94tare1r1ah3r4ssqf944sm064o@import.calendar.google.com', speelmoment: { omschrijving: 'Vrij spel jeugd', doelgroep: 'jeugd' } },
  { label: 'Intraclub', categorie: 'spelen', googleCalendarId: 'sdjvdn71tmsqcadobrjc541f9oh1hcns@import.calendar.google.com', speelmoment: { omschrijving: 'Intraclub + vrij spel', doelgroep: 'iedereen' } },
  { label: 'Training competitie', categorie: 'training', googleCalendarId: 'jrqfpmov52k09tld4a7g8t2dts@group.calendar.google.com', speelmoment: { omschrijving: 'Competitietraining', doelgroep: 'competitiespelers' } },
  { label: 'Training recreanten', categorie: 'training', googleCalendarId: '22m1pqspb1tlr688orr685hl6o@group.calendar.google.com', speelmoment: { omschrijving: 'Recreantentraining', doelgroep: 'recreanten' } },
  { label: 'Landegem 1H', categorie: 'match', googleCalendarId: 'a5a6i555m4u1v56ppjl7af372kra8rtn@import.calendar.google.com' },
  { label: 'Landegem 2H', categorie: 'match', googleCalendarId: 'h455u0c25j6cfdteg82cr0vk2ol65eue@import.calendar.google.com' },
  { label: 'Landegem 3H', categorie: 'match', googleCalendarId: '3k48lvi3a4s9970rk87cbfahedcn69u9@import.calendar.google.com' },
  { label: 'Landegem 4H', categorie: 'match', googleCalendarId: '6d1jv0kmvf5046j66btbtnpcij9qautr@import.calendar.google.com' },
  { label: 'Landegem 5H', categorie: 'match', googleCalendarId: '7gikav0isvq2uvo10vhapneidr5erg8c@import.calendar.google.com' },
  { label: 'Landegem 1G', categorie: 'match', googleCalendarId: 'g9cbvfob18d2vmfii34cj91set7s0n0v@import.calendar.google.com' },
  { label: 'Landegem 2G', categorie: 'match', googleCalendarId: '3mgba1ist2lv2rrmqcctsqlpvgsmvu0c@import.calendar.google.com' },
  { label: 'Landegem 3G', categorie: 'match', googleCalendarId: 'hddvr1pqmj1sg0qqdhstc82tctfofuoj@import.calendar.google.com' },
  { label: 'Landegem 4G', categorie: 'match', googleCalendarId: '0rkkoo1qg3rphgf6une0cicnfot71nnr@import.calendar.google.com' },
  { label: 'Landegem 1D', categorie: 'match', googleCalendarId: 'l2pdrt0e4rkmk0r5sar5ro3j2hdghilc@import.calendar.google.com' },
  { label: 'Landegem 2D', categorie: 'match', googleCalendarId: 'q5m58b7lggqbojdblvp5710qam2kh745@import.calendar.google.com' },
];
