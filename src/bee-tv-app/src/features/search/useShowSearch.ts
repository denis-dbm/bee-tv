import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHttpClient } from '@/shared/api';
import { createSearchApi } from './api';

export const searchKeys = {
  all: ['search'] as const,
  query: (query: string) => ['search', query.toLowerCase()] as const,
};

export function useShowSearch(query: string) {
  const http = useHttpClient();
  const api = useMemo(() => createSearchApi(http), [http]);
  const normalized = query.trim();

  return useQuery({
    queryKey: searchKeys.query(normalized),
    queryFn: ({ signal }) => api.searchShows(normalized, signal),
    enabled: normalized.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
