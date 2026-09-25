import { type Location, NavigationType } from 'react-router';

/** The URL parts of an in-app history entry (always same-origin by construction). */
export interface InAppLocation {
  pathname: string;
  search: string;
  hash: string;
}

/** History entry key -> the in-app location that entry was navigated from. */
export type PreviousLocations = ReadonlyMap<string, InAppLocation>;

export const MAX_TRACKED_ENTRIES = 100;

/**
 * A path is only trusted if it cannot escape the origin: `//host` and `/\host` are
 * protocol-relative URLs that browsers resolve to *another* domain.
 */
export function isInAppPath(pathname: string): boolean {
  return pathname.startsWith('/') && !pathname.startsWith('//') && !pathname.startsWith('/\\');
}

export function toInAppLocation({ pathname, search, hash }: Pick<Location, 'pathname' | 'search' | 'hash'>): InAppLocation | null {
  return isInAppPath(pathname) ? { pathname, search, hash } : null;
}

export function toHref({ pathname, search, hash }: InAppLocation): string {
  return `${pathname}${search}${hash}`;
}

function trim(entries: Map<string, InAppLocation>): Map<string, InAppLocation> {
  while (entries.size > MAX_TRACKED_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  return entries;
}

/**
 * Pure transition applied on every navigation:
 * - PUSH: the new entry remembers where it came from.
 * - REPLACE: the new entry takes over the replaced entry's origin (same slot in history).
 * - POP (back/forward/reload): entries already exist; nothing to record.
 * Entries reached from outside the app never get a value, so they have no in-app previous.
 */
export function recordNavigation(
  previous: PreviousLocations,
  type: NavigationType,
  from: Pick<Location, 'key' | 'pathname' | 'search' | 'hash'>,
  to: Pick<Location, 'key'>,
): PreviousLocations {
  if (type === NavigationType.Push) {
    const origin = toInAppLocation(from);
    const next = new Map(previous);
    if (origin) next.set(to.key, origin);
    else next.delete(to.key);
    return trim(next);
  }
  if (type === NavigationType.Replace) {
    const next = new Map(previous);
    const inherited = next.get(from.key);
    next.delete(from.key);
    if (inherited) next.set(to.key, inherited);
    else next.delete(to.key);
    return trim(next);
  }
  return previous;
}

const STORAGE_KEY = 'bee-tv:previous-locations';

function isInAppLocation(value: unknown): value is InAppLocation {
  if (typeof value !== 'object' || value === null) return false;
  const { pathname, search, hash } = value as Record<string, unknown>;
  return typeof pathname === 'string' && typeof search === 'string' && typeof hash === 'string' && isInAppPath(pathname);
}

/** Tolerant load: anything malformed (or tampered with) is simply ignored. */
export function loadPreviousLocations(storage: Storage | null): PreviousLocations {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return new Map();
    const entries = parsed.filter(
      (entry): entry is [string, InAppLocation] =>
        Array.isArray(entry) && typeof entry[0] === 'string' && isInAppLocation(entry[1]),
    );
    return trim(new Map(entries));
  } catch {
    return new Map();
  }
}

export function savePreviousLocations(storage: Storage | null, previous: PreviousLocations): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify([...previous]));
  } catch {
    // Storage full or disabled: the feature degrades to "no back link", never breaks.
  }
}

/** `sessionStorage` is tab-scoped, exactly like browser history. Access may throw (privacy modes). */
export function getSessionStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The slice of the browser Navigation API we rely on (injectable for tests). */
export interface NavigationApi {
  readonly currentEntry: { readonly index: number } | null;
  entries(): readonly { readonly index: number; readonly url: string | null }[];
}

/** The Navigation API is missing on older browsers: detect it, never assume it. */
export function getNavigationApi(): NavigationApi | null {
  return typeof window !== 'undefined' && 'navigation' in window && window.navigation ? window.navigation : null;
}

/**
 * The real previous history entry, from the browser itself. `navigation.entries()` only lists
 * the same-origin entries contiguous with the current one (full page loads included), so an
 * external previous entry (e.g. google.com) means index 0, i.e. no previous.
 * Returns `undefined` when the API is unavailable (callers fall back to in-app tracking).
 */
export function previousFromNavigationApi(navigation: NavigationApi | null, origin: string): InAppLocation | null | undefined {
  const current = navigation?.currentEntry;
  if (!navigation || !current) return undefined;
  if (current.index <= 0) return null;
  const entry = navigation.entries().find(({ index }) => index === current.index - 1);
  // `url` is null for entries whose document hides it (Referrer-Policy: no-referrer / origin).
  if (!entry?.url) return null;
  try {
    const url = new URL(entry.url);
    return url.origin === origin ? toInAppLocation(url) : null;
  } catch {
    return null;
  }
}
