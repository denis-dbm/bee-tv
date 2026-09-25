import type { HttpClient, Page } from '@/shared/api';

export interface Comment {
  id: number;
  showId: string;
  episodeId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
}

/** A comment belongs to a series, or to one episode of that series. */
export interface CommentTarget {
  showId: string;
  episodeId?: string;
}

export interface EpisodeCommentCount {
  episodeId: string;
  count: number;
}

export const MAX_COMMENT_LENGTH = 2000;

export interface CommentsApi {
  list(target: CommentTarget, signal?: AbortSignal): Promise<Comment[]>;
  create(target: CommentTarget, body: string): Promise<Comment>;
  countByEpisode(showId: string, signal?: AbortSignal): Promise<EpisodeCommentCount[]>;
}

export function commentsPath({ showId, episodeId }: CommentTarget): string {
  const show = `/shows/${encodeURIComponent(showId)}`;
  return episodeId ? `${show}/episodes/${encodeURIComponent(episodeId)}/comments` : `${show}/comments`;
}

export function createCommentsApi(http: HttpClient): CommentsApi {
  return {
    async list(target, signal) {
      return (await http.get<Page<Comment>>(commentsPath(target), { signal })).items;
    },
    create: (target, body) => http.post<Comment>(commentsPath(target), { body }),
    async countByEpisode(showId, signal) {
      const path = `/shows/${encodeURIComponent(showId)}/episodes/comment-counts`;
      return (await http.get<Page<EpisodeCommentCount>>(path, { signal })).items;
    },
  };
}
