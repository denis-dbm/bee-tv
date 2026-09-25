import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHttpClient } from '@/shared/api';
import { createBeeReviewApi, type ReviewTarget } from './api';

export const reviewKeys = {
  review: ({ showId, episodeId }: ReviewTarget, includeComments: boolean) =>
    ['bee-review', showId, episodeId ?? 'series', includeComments] as const,
};

export function useBeeReview(target: ReviewTarget, includeComments: boolean, enabled = true) {
  const http = useHttpClient();
  const api = useMemo(() => createBeeReviewApi(http), [http]);
  return useQuery({
    queryKey: reviewKeys.review(target, includeComments),
    queryFn: ({ signal }) => api.getReview(target, includeComments, signal),
    enabled,
    staleTime: 60_000,
  });
}
