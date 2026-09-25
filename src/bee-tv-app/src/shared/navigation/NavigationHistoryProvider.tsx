import { type ReactNode, useEffect, useState } from 'react';
import { type Location, useLocation, useNavigationType } from 'react-router';
import {
  getNavigationApi,
  getSessionStorage,
  loadPreviousLocations,
  type NavigationApi,
  previousFromNavigationApi,
  type PreviousLocations,
  recordNavigation,
  savePreviousLocations,
} from './previousLocation';
import { PreviousLocationContext } from './previousLocationContext';

interface TrackerState {
  current: Location;
  previous: PreviousLocations;
}

export interface NavigationHistoryProviderProps {
  children: ReactNode;
  /** Defaults to `sessionStorage`; `null` disables persistence. */
  storage?: Storage | null;
  /** Defaults to the browser Navigation API when available; `null` forces the fallback tracker. */
  navigation?: NavigationApi | null;
}

/**
 * Must be rendered inside the router. Exposes the real previous history entry when it belongs
 * to this app:
 * 1. Browser Navigation API (authoritative: sees full page loads and typed URLs too).
 * 2. Fallback for browsers without it: an in-app tracker keyed by history entry, persisted in
 *    `sessionStorage` (tab-scoped, like history) so reloads keep working.
 */
export function NavigationHistoryProvider({ children, storage, navigation }: NavigationHistoryProviderProps) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [store] = useState(() => (storage === undefined ? getSessionStorage() : storage));
  const [browserHistory] = useState(() => (navigation === undefined ? getNavigationApi() : navigation));
  const [state, setState] = useState<TrackerState>(() => ({
    current: location,
    previous: loadPreviousLocations(store),
  }));

  // Derived state updated during render: React re-renders before committing, so the
  // back link is correct on the very first paint of the new page (no flicker).
  let { previous } = state;
  if (state.current.key !== location.key) {
    previous = recordNavigation(state.previous, navigationType, state.current, location);
    setState({ current: location, previous });
  }

  useEffect(() => savePreviousLocations(store, state.previous), [store, state.previous]);

  // Read on every navigation (this component re-renders on each location change).
  const fromBrowser = previousFromNavigationApi(browserHistory, window.location.origin);
  const value = fromBrowser === undefined ? (previous.get(location.key) ?? null) : fromBrowser;

  return <PreviousLocationContext.Provider value={value}>{children}</PreviousLocationContext.Provider>;
}
