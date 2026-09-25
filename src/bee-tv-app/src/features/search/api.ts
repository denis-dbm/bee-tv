import type { HttpClient, Page } from '@/shared/api';

export interface ShowSearchResult {
  id: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
}

export interface SearchApi {
  searchShows(query: string, signal?: AbortSignal): Promise<ShowSearchResult[]>;
}

export function createSearchApi(http: HttpClient): SearchApi {
  return {
    async searchShows(query, signal) {
      const page = await http.get<Page<ShowSearchResult>>('/shows', { query: { q: query }, signal });
      return page.items;
    },
  };
}
