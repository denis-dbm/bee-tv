import { QueryClient } from '@tanstack/react-query';
import { isRetryable } from './errors';

export const MAX_QUERY_RETRIES = 2;

/** Retry only what can heal by itself (outages, network blips); never 4xx. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isRetryable(error);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 60_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
