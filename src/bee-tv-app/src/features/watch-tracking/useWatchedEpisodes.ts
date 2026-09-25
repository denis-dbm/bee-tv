import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useHttpClient } from '@/shared/api';
import { friendlyErrorMessage, useNotify } from '@/shared/ui';
import { createWatchTrackingApi, type WatchedEpisode } from './api';

export const watchedKeys = {
  show: (showId: string) => ['watched', showId] as const,
};

interface ToggleVariables {
  episodeId: string;
  watched: boolean;
}

export function applyToggle(
  current: WatchedEpisode[] | undefined,
  { episodeId, watched }: ToggleVariables,
  now: Date = new Date(),
): WatchedEpisode[] {
  const others = (current ?? []).filter((item) => item.episodeId !== episodeId);
  return watched ? [...others, { episodeId, watchedAt: now.toISOString() }] : others;
}

/** Watched state for a show, shared through the query cache by every toggle on the page. */
export function useWatchedEpisodes(showId: string) {
  const http = useHttpClient();
  const api = useMemo(() => createWatchTrackingApi(http), [http]);
  const queryClient = useQueryClient();
  const notify = useNotify();
  const key = watchedKeys.show(showId);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => api.listWatched(showId, signal),
  });

  const mutation = useMutation({
    mutationFn: async ({ episodeId, watched }: ToggleVariables): Promise<void> => {
      if (watched) await api.markWatched(showId, episodeId);
      else await api.unmarkWatched(showId, episodeId);
    },
    // Optimistic update: the toggle flips instantly and rolls back on failure.
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<WatchedEpisode[]>(key);
      queryClient.setQueryData<WatchedEpisode[]>(key, (current) => applyToggle(current, variables));
      return { previous };
    },
    onError: (error, variables, context) => {
      queryClient.setQueryData(key, context?.previous);
      notify(friendlyErrorMessage(variables.watched ? 'mark it as watched' : 'unmark it', error), 'error');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const watchedIds = useMemo(() => new Set((query.data ?? []).map((item) => item.episodeId)), [query.data]);
  const { mutate } = mutation;
  const toggle = useCallback(
    (episodeId: string) => mutate({ episodeId, watched: !watchedIds.has(episodeId) }),
    [mutate, watchedIds],
  );

  return {
    watchedIds,
    isWatched: (episodeId: string) => watchedIds.has(episodeId),
    toggle,
    isLoading: query.isPending,
    isError: query.isError,
  };
}
