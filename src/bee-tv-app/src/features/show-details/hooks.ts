import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHttpClient } from '@/shared/api';
import { createShowDetailsApi, type ShowDetails } from './api';

export const showKeys = {
  show: (showId: string) => ['show', showId] as const,
  seasons: (showId: string) => ['show', showId, 'seasons'] as const,
};

function useShowDetailsApi() {
  const http = useHttpClient();
  return useMemo(() => createShowDetailsApi(http), [http]);
}

export function useShow(showId: string) {
  const api = useShowDetailsApi();
  return useQuery({
    queryKey: showKeys.show(showId),
    queryFn: ({ signal }) => api.getShow(showId, signal),
    staleTime: 5 * 60_000,
  });
}

export function useSeasons(showId: string) {
  const api = useShowDetailsApi();
  return useQuery({
    queryKey: showKeys.seasons(showId),
    queryFn: ({ signal }) => api.getSeasons(showId, signal),
    staleTime: 5 * 60_000,
  });
}

/** Title of a series only if it is already cached: never triggers a request. */
export function useCachedShowTitle(showId: string | undefined): string | undefined {
  const queryClient = useQueryClient();
  return showId ? queryClient.getQueryData<ShowDetails>(showKeys.show(showId))?.title : undefined;
}
