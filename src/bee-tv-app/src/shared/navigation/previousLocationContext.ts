import { createContext, useContext } from 'react';
import type { InAppLocation } from './previousLocation';

export const PreviousLocationContext = createContext<InAppLocation | null | undefined>(undefined);

/**
 * The in-app location the current history entry was navigated from, or `null` when the user
 * arrived from outside the app (another site, a bookmark, a typed URL, a new tab).
 */
export function usePreviousLocation(): InAppLocation | null {
  const previous = useContext(PreviousLocationContext);
  if (previous === undefined) throw new Error('usePreviousLocation must be used within a NavigationHistoryProvider');
  return previous;
}
