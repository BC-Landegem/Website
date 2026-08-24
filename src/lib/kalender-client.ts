// Client-side kalenderdata: haalt de Google Calendar-bronnen uit
// src/data/kalender.ts op en normaliseert ze tot KalenderItems. Bronnen die
// falen of leeg zijn worden stil genegeerd.
import { googleCalendarApiKey, bronnen, type KalenderBron } from '../data/kalender';

export interface GoogleEvent {
  summary?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export interface KalenderItem {
  bron: KalenderBron;
  event: GoogleEvent;
  start: Date;
  einde: Date | null;
}

export const NU = new Date();
// Venster voor de routinebronnen; de schaarse Events-kalender kent geen
// venster (een tornooi wil je weken vooraf zien).
const VENSTER = new Date(NU.getTime() + 42 * 24 * 60 * 60 * 1000);

export const dagKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const uurTekst = (d: Date) => `${d.getHours()}u${String(d.getMinutes()).padStart(2, '0')}`;
export const datumTekst = (d: Date) => d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'long' });

// Thuismatch: titel begint met "Landegem" (thuisploeg staat eerst in de
// Badminton Vlaanderen-import) én de locatie ligt in Nevele.
export function isThuismatch(item: KalenderItem): boolean {
  return (
    item.bron.categorie === 'match' &&
    (item.event.summary?.startsWith('Landegem') ?? false) &&
    /nevele/i.test(item.event.location ?? '')
  );
}

async function haalBron(bron: KalenderBron): Promise<KalenderItem[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(bron.googleCalendarId)}/events`,
  );
  const params = new URLSearchParams({
    key: googleCalendarApiKey,
    timeMin: NU.toISOString(),
    maxResults: '30',
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  if (bron.label !== 'Events') params.set('timeMax', VENSTER.toISOString());
  url.search = params.toString();

  const res = await fetch(url);
  if (!res.ok) return [];
  const data: { items?: GoogleEvent[] } = await res.json();
  return (data.items ?? [])
    .filter((event) => event.start?.dateTime || event.start?.date)
    .map((event) => ({
      bron,
      event,
      start: new Date(event.start.dateTime ?? event.start.date!),
      einde: event.end?.dateTime ? new Date(event.end.dateTime) : null,
    }));
}

/** Alle bronnen in één pass, chronologisch gesorteerd. */
export async function haalKalender(): Promise<KalenderItem[]> {
  const resultaten = await Promise.allSettled(bronnen.map(haalBron));
  return resultaten
    .flatMap((resultaat) => (resultaat.status === 'fulfilled' ? resultaat.value : []))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
