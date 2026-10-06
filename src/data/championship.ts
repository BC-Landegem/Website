// Provinciaal Kampioenschap Oost-Vlaanderen 2026: dit jaar organiseren we het
// samen met PBO Badminton, in onze eigen zaal. Eenmalig, dus de homepage toont
// het blok (en de sticker in de hero) tot en met zondag 1 november en laat het
// daarna stil wegvallen — bij de build, en in de browser voor wie nog een
// oudere build of de offline kopie van de service worker binnenkrijgt.
//
// De feiten komen van de toernooipagina (nagekeken 29 september 2026):
// inschrijven tot vr 16 okt 23u59, reeksen Open 1 tot 12, dubbel en gemengd
// dubbel in poules op zaterdag, enkelspel (HE en DE) op zondag. Op 6 oktober
// kwam erbij dat het dubbel zaterdag in de voormiddag valt en het gemengd in de
// namiddag.
export const championship = {
  url: 'https://badvla.tournamentsoftware.com/tournament/4b8952db-0974-4e48-b6aa-cfef53a5308b',
  registrationCloses: '2026-10-16T23:59:00+02:00',
  // Tijdens het weekend licht de helft van die dag op het veld op. Op 25
  // oktober gaat de klok terug: het weekend zelf valt in wintertijd (+01:00).
  days: [
    { key: 'sat', start: '2026-10-31T00:00:00+01:00', end: '2026-11-01T00:00:00+01:00' },
    { key: 'sun', start: '2026-11-01T00:00:00+01:00', end: '2026-11-02T00:00:00+01:00' },
  ],
  ends: '2026-11-02T00:00:00+01:00',
} as const;

export type ChampionshipDay = (typeof championship.days)[number]['key'];

/** `open` tot de deadline, daarna `closed` (loting en uitslagen), na het weekend `ended`. */
export function championshipPhase(now: Date): 'open' | 'closed' | 'ended' {
  if (now >= new Date(championship.ends)) return 'ended';
  return now > new Date(championship.registrationCloses) ? 'closed' : 'open';
}

export function championshipToday(now: Date): ChampionshipDay | null {
  const day = championship.days.find((d) => now >= new Date(d.start) && now < new Date(d.end));
  return day?.key ?? null;
}

/** Kalenderdagen tot de deadline, in Belgische tijd — 0 op de laatste dag zelf. */
export function daysUntilClose(now: Date): number {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(now);
  const close = championship.registrationCloses.slice(0, 10);
  return Math.round((Date.parse(close) - Date.parse(today)) / 86_400_000);
}
