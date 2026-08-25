import photoDataJson from '../data/media.json';
import { albums, type MediaAlbum, type MediaCategory } from '../data/media';

export interface Photo {
  url: string;
  b: number;
  h: number;
}

export interface AlbumPhotos {
  cover: string;
  titelGp?: string;
  fotos: Photo[];
}

export const photoData = photoDataJson as Record<string, AlbumPhotos>;

/** Albums waarvoor de sync al foto's opleverde, nieuwste eerst. */
export const visibleAlbums: MediaAlbum[] = albums
  .filter((a) => photoData[a.slug]?.fotos.length)
  .sort((a, b) => b.datum.localeCompare(a.datum));

export const categoryLabels: Record<MediaCategory, string> = {
  jeugd: 'Jeugd',
  competitie: 'Competitie',
  intraclub: 'Intraclub',
  club: 'Clubleven',
};

/** '2026-03' -> 'maart 2026'; '2015' (maand onbekend) -> '2015' */
export function monthName(date: string): string {
  const [year, month] = date.split('-').map(Number);
  if (!month) return String(year);
  return new Date(year, month - 1, 1).toLocaleDateString('nl-BE', {
    month: 'long',
    year: 'numeric',
  });
}

/** Google-CDN-afbeelding op een gevraagde breedte (hoogte volgt de verhouding). */
export function photoAtWidth(url: string, width: number): string {
  return `${url}=w${width}`;
}

/** Bijgesneden cover voor albumtegels. */
export function coverUrl(url: string, width: number, height: number): string {
  return `${url}=w${width}-h${height}-p`;
}

/** Lightbox-versie: past binnen 2048px, met de exacte maten die daarbij horen. */
export function largePhoto(f: Photo): { src: string; b: number; h: number } {
  const scale = Math.min(1, 2048 / Math.max(f.b, f.h));
  const b = Math.round(f.b * scale);
  const h = Math.round(f.h * scale);
  return { src: `${f.url}=w${b}-h${h}`, b, h };
}
