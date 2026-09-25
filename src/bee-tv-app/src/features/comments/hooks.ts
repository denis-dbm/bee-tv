import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useHttpClient } from '@/shared/api';
import { type Comment, type CommentTarget, createCommentsApi } from './api';

export const commentKeys = {
  list: ({ showId, episodeId }: CommentTarget) => ['comments', showId, episodeId ?? 'series'] as const,
  counts: (showId: string) => ['comments', showId, 'counts'] as const,
};

function useCommentsApi() {
  const http = useHttpClient();
  return useMemo(() => createCommentsApi(http), [http]);
}

export function useComments(target: CommentTarget) {
  const api = useCommentsApi();
  return useQuery({
    queryKey: commentKeys.list(target),
    queryFn: ({ signal }) => api.list(target, signal),
  });
}

export function useCreateComment(target: CommentTarget) {
  const api = useCommentsApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.create(target, body),
    onSuccess: (created) => {
      queryClient.setQueryData<Comment[]>(commentKeys.list(target), (current) => [created, ...(current ?? [])]);
      if (target.episodeId) void queryClient.invalidateQueries({ queryKey: commentKeys.counts(target.showId) });
    },
  });
}

export function useEpisodeCommentCounts(showId: string) {
  const api = useCommentsApi();
  const query = useQuery({
    queryKey: commentKeys.counts(showId),
    queryFn: ({ signal }) => api.countByEpisode(showId, signal),
  });
  const counts = useMemo(
    () => new Map((query.data ?? []).map(({ episodeId, count }) => [episodeId, count])),
    [query.data],
  );
  return { counts, countFor: (episodeId: string) => counts.get(episodeId) ?? 0, isLoading: query.isPending };
}
