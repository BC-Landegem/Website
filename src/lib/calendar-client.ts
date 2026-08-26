// Client-side kalenderdata: haalt de Google Calendar-bronnen uit
// src/data/calendar.ts op en normaliseert ze tot CalendarItems. Bronnen die
// falen of leeg zijn worden stil genegeerd.
import { googleCalendarApiKey, sources, type CalendarSource } from '../data/calendar';

export interface GoogleEvent {
  summary?: string;
  location?: string;
  start: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export interface CalendarItem {
  source: CalendarSource;
  event: GoogleEvent;
  start: Date;
  end: Date | null;
}

export const NOW = new Date();
// Venster voor de routinebronnen; de schaarse Events-kalender kent geen
// venster (een tornooi wil je weken vooraf zien).
const WINDOW_END = new Date(NOW.getTime() + 42 * 24 * 60 * 60 * 1000);

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
export const timeText = (d: Date) => `${d.getHours()}u${String(d.getMinutes()).padStart(2, '0')}`;
export const dateText = (d: Date) => d.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'long' });

// Thuismatch: titel begint met "Landegem" (thuisploeg staat eerst in de
// Badminton Vlaanderen-import) én de locatie ligt in Nevele.
export function isHomeMatch(item: CalendarItem): boolean {
  return (
    item.source.category === 'match' &&
    (item.event.summary?.startsWith('Landegem') ?? false) &&
    /nevele/i.test(item.event.location ?? '')
  );
}

async function fetchSource(source: CalendarSource): Promise<CalendarItem[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(source.googleCalendarId)}/events`,
  );
  const params = new URLSearchParams({
    key: googleCalendarApiKey,
    timeMin: NOW.toISOString(),
    maxResults: '30',
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  if (source.label !== 'Events') params.set('timeMax', WINDOW_END.toISOString());
  url.search = params.toString();

  const res = await fetch(url);
  if (!res.ok) return [];
  const data: { items?: GoogleEvent[] } = await res.json();
  return (data.items ?? [])
    .filter((event) => event.start?.dateTime || event.start?.date)
    .map((event) => ({
      source,
      event,
      start: new Date(event.start.dateTime ?? event.start.date!),
      end: event.end?.dateTime ? new Date(event.end.dateTime) : null,
    }));
}

/** Alle bronnen in één pass, chronologisch gesorteerd. */
export async function fetchCalendar(): Promise<CalendarItem[]> {
  const results = await Promise.allSettled(sources.map(fetchSource));
  return results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
