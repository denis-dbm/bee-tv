import type { HttpClient, Page } from '@/shared/api';

export interface WatchedEpisode {
  episodeId: string;
  watchedAt: string;
}

export interface WatchTrackingApi {
  listWatched(showId: string, signal?: AbortSignal): Promise<WatchedEpisode[]>;
  markWatched(showId: string, episodeId: string): Promise<WatchedEpisode>;
  unmarkWatched(showId: string, episodeId: string): Promise<void>;
}

export function createWatchTrackingApi(http: HttpClient): WatchTrackingApi {
  const collection = (showId: string) => `/shows/${encodeURIComponent(showId)}/watched-episodes`;
  const item = (showId: string, episodeId: string) =>
    `${collection(showId)}/${encodeURIComponent(episodeId)}`;
  return {
    async listWatched(showId, signal) {
      return (await http.get<Page<WatchedEpisode>>(collection(showId), { signal })).items;
    },
    markWatched: (showId, episodeId) => http.put<WatchedEpisode>(item(showId, episodeId)),
    unmarkWatched: (showId, episodeId) => http.delete(item(showId, episodeId)),
  };
}
