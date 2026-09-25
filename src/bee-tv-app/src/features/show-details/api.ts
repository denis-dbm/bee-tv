import type { HttpClient, Page } from '@/shared/api';

export interface ShowDetails {
  id: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  summary: string;
  genres: string[];
  status: string | null;
  language: string | null;
  network: string | null;
  rating: number | null;
  premiered: string | null;
  ended: string | null;
}

export interface Episode {
  id: string;
  season: number;
  number: number | null;
  title: string;
  summary: string;
  airdate: string | null;
  runtime: number | null;
  imageUrl: string | null;
  rating: number | null;
}

export interface Season {
  number: number;
  episodes: Episode[];
}

export interface ShowDetailsApi {
  getShow(showId: string, signal?: AbortSignal): Promise<ShowDetails>;
  getSeasons(showId: string, signal?: AbortSignal): Promise<Season[]>;
}

export function createShowDetailsApi(http: HttpClient): ShowDetailsApi {
  const base = (showId: string) => `/shows/${encodeURIComponent(showId)}`;
  return {
    getShow: (showId, signal) => http.get<ShowDetails>(base(showId), { signal }),
    async getSeasons(showId, signal) {
      const page = await http.get<Page<Season>>(`${base(showId)}/seasons`, { signal });
      return page.items;
    },
  };
}
