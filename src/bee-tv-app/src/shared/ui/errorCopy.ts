import type { ErrorKind } from '@/shared/api';
import type { BeeMood } from './BeeMascot';

export interface ErrorCopy {
  mood: BeeMood;
  title: string;
  description: string;
  retryable: boolean;
}

/** Creative, human copy for every failure class: users should never see raw errors. */
export const ERROR_COPY: Record<ErrorKind, ErrorCopy> = {
  offline: {
    mood: 'lost',
    title: 'The hive lost its signal',
    description: "We can't reach Bee TV right now. Check your connection and we'll buzz right back.",
    retryable: true,
  },
  unavailable: {
    mood: 'sleepy',
    title: 'Our bees are taking a short nap',
    description:
      'One of our partner services is resting for a moment. Your data is safe, so try again in a few seconds.',
    retryable: true,
  },
  'not-found': {
    mood: 'lost',
    title: 'This one flew away',
    description: "We couldn't find what you were looking for. It may have been moved or never existed.",
    retryable: false,
  },
  invalid: {
    mood: 'dizzy',
    title: 'That made our antennae spin',
    description: 'Something about this request looks off. Please adjust it and try again.',
    retryable: false,
  },
  unknown: {
    mood: 'dizzy',
    title: 'Something stung us',
    description: 'An unexpected hiccup happened on our side. Give it another try in a moment.',
    retryable: true,
  },
};
