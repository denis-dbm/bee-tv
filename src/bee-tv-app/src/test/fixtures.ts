import type { BeeReview } from '@/features/bee-review';
import type { Comment } from '@/features/comments';
import type { ShowSearchResult } from '@/features/search';
import type { Season, ShowDetails } from '@/features/show-details';
import { ApiError } from '@/shared/api';

export const DARK: ShowDetails = {
  id: '17861',
  title: 'Dark',
  year: 2017,
  posterUrl: 'https://img/dark.jpg',
  summary: 'A family saga with a supernatural twist.',
  genres: ['Drama', 'Science-Fiction'],
  status: 'Ended',
  language: 'German',
  network: 'Netflix',
  rating: 8.2,
  premiered: '2017-12-01',
  ended: '2020-06-27',
};

export const DARK_RESULT: ShowSearchResult = {
  id: DARK.id,
  title: DARK.title,
  year: DARK.year,
  posterUrl: DARK.posterUrl,
};

export const SEASONS: Season[] = [
  {
    number: 1,
    episodes: [
      { id: '1', season: 1, number: 1, title: 'Secrets', summary: 'A boy vanishes.', airdate: '2017-12-01', runtime: 52, imageUrl: null, rating: 8.1 },
      { id: '2', season: 1, number: 2, title: 'Lies', summary: '', airdate: null, runtime: null, imageUrl: 'https://img/e2.jpg', rating: null },
    ],
  },
  {
    number: 2,
    episodes: [
      { id: '3', season: 2, number: 1, title: 'Beginnings and Endings', summary: 'Time loops.', airdate: '2019-06-21', runtime: 60, imageUrl: null, rating: null },
    ],
  },
];

export function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 1,
    showId: DARK.id,
    episodeId: null,
    authorName: 'Guest',
    body: 'Mind-blowing!',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function review(overrides: Partial<BeeReview> = {}): BeeReview {
  return {
    subject: 'series',
    text: 'A cerebral time-travel puzzle for fans of dark drama.',
    source: 'ai',
    generator: 'meta-llama/Llama-3.1-8B-Instruct',
    commentsConsidered: 0,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export const unavailable = () => new ApiError(503, 'catalog_unavailable', 'The TV catalog is temporarily unavailable');
export const notFound = () => new ApiError(404, 'show_not_found', 'TV series not found');
