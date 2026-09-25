import type { HttpClient } from '@/shared/api';

export type ReviewSubject = 'series' | 'episode';
/** `ai` came from the LLM provider; `fallback` from Bee TV's offline rule engine. */
export type ReviewSource = 'ai' | 'fallback';

export interface BeeReview {
  subject: ReviewSubject;
  text: string;
  source: ReviewSource;
  generator: string;
  commentsConsidered: number;
  generatedAt: string;
}

export interface ReviewTarget {
  showId: string;
  episodeId?: string;
}

export interface BeeReviewApi {
  getReview(target: ReviewTarget, includeComments: boolean, signal?: AbortSignal): Promise<BeeReview>;
}

export function reviewPath({ showId, episodeId }: ReviewTarget): string {
  const show = `/shows/${encodeURIComponent(showId)}`;
  return episodeId ? `${show}/episodes/${encodeURIComponent(episodeId)}/review` : `${show}/review`;
}

export function createBeeReviewApi(http: HttpClient): BeeReviewApi {
  return {
    getReview: (target, includeComments, signal) =>
      http.get<BeeReview>(reviewPath(target), { query: { includeComments }, signal }),
  };
}
