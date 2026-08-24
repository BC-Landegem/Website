import fotodataJson from '../data/media.json';
import { albums, type MediaAlbum, type MediaCategorie } from '../data/media';

export interface Foto {
  url: string;
  b: number;
  h: number;
}

export interface AlbumFotos {
  cover: string;
  titelGp?: string;
  fotos: Foto[];
}

export const fotodata = fotodataJson as Record<string, AlbumFotos>;

/** Albums waarvoor de sync al foto's opleverde, nieuwste eerst. */
export const zichtbareAlbums: MediaAlbum[] = albums
  .filter((a) => fotodata[a.slug]?.fotos.length)
  .sort((a, b) => b.datum.localeCompare(a.datum));

export const categorieLabels: Record<MediaCategorie, string> = {
  jeugd: 'Jeugd',
  competitie: 'Competitie',
  intraclub: 'Intraclub',
  club: 'Clubleven',
};

/** '2026-03' -> 'maart 2026'; '2015' (maand onbekend) -> '2015' */
export function maandNaam(datum: string): string {
  const [jaar, maand] = datum.split('-').map(Number);
  if (!maand) return String(jaar);
  return new Date(jaar, maand - 1, 1).toLocaleDateString('nl-BE', {
    month: 'long',
    year: 'numeric',
  });
}

/** Google-CDN-afbeelding op een gevraagde breedte (hoogte volgt de verhouding). */
export function fotoOpBreedte(url: string, breedte: number): string {
  return `${url}=w${breedte}`;
}

/** Bijgesneden cover voor albumtegels. */
export function coverUrl(url: string, breedte: number, hoogte: number): string {
  return `${url}=w${breedte}-h${hoogte}-p`;
}

/** Lightbox-versie: past binnen 2048px, met de exacte maten die daarbij horen. */
export function fotoGroot(f: Foto): { src: string; b: number; h: number } {
  const schaal = Math.min(1, 2048 / Math.max(f.b, f.h));
  const b = Math.round(f.b * schaal);
  const h = Math.round(f.h * schaal);
  return { src: `${f.url}=w${b}-h${h}`, b, h };
}
