// Kalenderbronnen, overgenomen van de oude site (Joomla/FullCalendar v4-config).
// De API-key is een publieke, referrer-restricted browser-key voor de Google Calendar API.
export const googleCalendarApiKey = 'AIzaSyDnzhbVO9JCyQqot348j_yt9pSUYfiMHY4';

export interface KalenderBron {
  label: string;
  googleCalendarId: string;
  color: string;
  /** Gegroepeerd label voor de legende */
  groep: string;
  /**
   * Vaste weergavetekst in de hero-chip ("Eerstvolgend speelmoment"). Enkel
   * bronnen met dit veld tellen als speelmoment; de tijden komen uit de
   * kalender, de tekst bewust niet (kalendertitels zijn interne jargon).
   * Thuismatchen tellen ook mee, maar krijgen hun tekst uit het ploeglabel.
   */
  speelmoment?: { omschrijving: string; doelgroep: string };
}

export const bronnen: KalenderBron[] = [
  { label: 'Events', groep: 'Events', color: '#EB4024', googleCalendarId: '96vl7c6jvq0ilvbkk62vh058rp2uc5pj@import.calendar.google.com' },
  { label: 'Vrij spelen', groep: 'Vrij spelen', color: '#3d998d', googleCalendarId: 'q2tp121lj5fs101js7ph7qq2hgv7iqu1@import.calendar.google.com', speelmoment: { omschrijving: 'Vrij spel', doelgroep: 'iedereen' } },
  { label: 'Training jeugd', groep: 'Jeugd', color: '#7390c7', googleCalendarId: '1s8ga8r6ua28mb0ld3eol386amag2j54@import.calendar.google.com', speelmoment: { omschrijving: 'Jeugdtraining', doelgroep: 'jeugd' } },
  { label: 'Vrij spelen jeugd', groep: 'Jeugd', color: '#0b56e3', googleCalendarId: 'v5i8e94tare1r1ah3r4ssqf944sm064o@import.calendar.google.com', speelmoment: { omschrijving: 'Vrij spel jeugd', doelgroep: 'jeugd' } },
  { label: 'Intraclub', groep: 'Intraclub', color: '#8d548d', googleCalendarId: 'sdjvdn71tmsqcadobrjc541f9oh1hcns@import.calendar.google.com', speelmoment: { omschrijving: 'Intraclub + vrij spel', doelgroep: 'iedereen' } },
  { label: 'Training competitie', groep: 'Trainingen', color: '#687582', googleCalendarId: 'jrqfpmov52k09tld4a7g8t2dts@group.calendar.google.com', speelmoment: { omschrijving: 'Competitietraining', doelgroep: 'competitiespelers' } },
  { label: 'Training recreanten', groep: 'Trainingen', color: '#BF5FFF', googleCalendarId: '22m1pqspb1tlr688orr685hl6o@group.calendar.google.com', speelmoment: { omschrijving: 'Recreantentraining', doelgroep: 'recreanten' } },
  { label: 'Landegem 1H', groep: 'Competitiematchen', color: '#b04949', googleCalendarId: 'a5a6i555m4u1v56ppjl7af372kra8rtn@import.calendar.google.com' },
  { label: 'Landegem 2H', groep: 'Competitiematchen', color: '#bc6032', googleCalendarId: 'h455u0c25j6cfdteg82cr0vk2ol65eue@import.calendar.google.com' },
  { label: 'Landegem 3H', groep: 'Competitiematchen', color: '#c78226', googleCalendarId: '3k48lvi3a4s9970rk87cbfahedcn69u9@import.calendar.google.com' },
  { label: 'Landegem 4H', groep: 'Competitiematchen', color: '#fa9000', googleCalendarId: '6d1jv0kmvf5046j66btbtnpcij9qautr@import.calendar.google.com' },
  { label: 'Landegem 5H', groep: 'Competitiematchen', color: '#E67C73', googleCalendarId: '7gikav0isvq2uvo10vhapneidr5erg8c@import.calendar.google.com' },
  { label: 'Landegem 1G', groep: 'Competitiematchen', color: '#488968', googleCalendarId: 'g9cbvfob18d2vmfii34cj91set7s0n0v@import.calendar.google.com' },
  { label: 'Landegem 2G', groep: 'Competitiematchen', color: '#318c36', googleCalendarId: '3mgba1ist2lv2rrmqcctsqlpvgsmvu0c@import.calendar.google.com' },
  { label: 'Landegem 3G', groep: 'Competitiematchen', color: '#6b9926', googleCalendarId: 'hddvr1pqmj1sg0qqdhstc82tctfofuoj@import.calendar.google.com' },
  { label: 'Landegem 4G', groep: 'Competitiematchen', color: '#59BFB3', googleCalendarId: '0rkkoo1qg3rphgf6une0cicnfot71nnr@import.calendar.google.com' },
  { label: 'Landegem 1D', groep: 'Competitiematchen', color: '#496b8d', googleCalendarId: 'l2pdrt0e4rkmk0r5sar5ro3j2hdghilc@import.calendar.google.com' },
  { label: 'Landegem 2D', groep: 'Competitiematchen', color: '#496bb0', googleCalendarId: 'q5m58b7lggqbojdblvp5710qam2kh745@import.calendar.google.com' },
];

/** Voor de legende: unieke groepen met een representatieve kleur. */
export const legende = [
  { label: 'Events', color: '#EB4024' },
  { label: 'Vrij spelen', color: '#3d998d' },
  { label: 'Jeugd', color: '#7390c7' },
  { label: 'Intraclub', color: '#8d548d' },
  { label: 'Trainingen', color: '#687582' },
  { label: 'Competitiematchen (kleur per ploeg)', color: '#c78226' },
];
