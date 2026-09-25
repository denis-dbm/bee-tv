import { matchPath } from 'react-router';
import type { InAppLocation } from '@/shared/navigation';

export const SHOW_ROUTE = '/shows/:showId';

/** Human label naming the real destination; `showTitle` is only known when already cached. */
export function describeBackTarget(target: InAppLocation, showTitle?: string): string {
  if (target.pathname === '/') {
    const query = new URLSearchParams(target.search).get('q')?.trim();
    return query ? `Back to results for “${query}”` : 'Back to search';
  }
  if (matchPath(SHOW_ROUTE, target.pathname)) {
    return showTitle ? `Back to ${showTitle}` : 'Back to previous series';
  }
  return 'Back';
}
