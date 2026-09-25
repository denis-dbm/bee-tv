import { classifyError } from '@/shared/api';
import { ERROR_COPY } from './errorCopy';

/** One-line friendly message for transient toasts (mutations). */
export function friendlyErrorMessage(action: string, error: unknown): string {
  const kind = classifyError(error);
  if (kind === 'invalid' || kind === 'not-found') return `Couldn't ${action}: ${ERROR_COPY[kind].title.toLowerCase()}.`;
  return `Couldn't ${action}. ${ERROR_COPY[kind].title}, please try again.`;
}
