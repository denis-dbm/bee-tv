import { act, render, renderHook, screen } from '@testing-library/react';
import { createMemoryRouter, NavigationType, RouterProvider } from 'react-router';
import { NavigationHistoryProvider } from './NavigationHistoryProvider';
import {
  isInAppPath,
  loadPreviousLocations,
  MAX_TRACKED_ENTRIES,
  type NavigationApi,
  previousFromNavigationApi,
  recordNavigation,
  savePreviousLocations,
  toHref,
} from './previousLocation';
import { usePreviousLocation } from './previousLocationContext';

const loc = (key: string, pathname: string, search = '', hash = '') => ({ key, pathname, search, hash });

describe('isInAppPath', () => {
  it.each([
    ['/', true],
    ['/shows/1', true],
    ['//evil.com', false],
    ['/\\evil.com', false],
    ['https://google.com', false],
    ['shows/1', false],
  ])('%s -> %s', (path, expected) => {
    expect(isInAppPath(path)).toBe(expected);
  });
});

describe('recordNavigation', () => {
  const empty = new Map();

  it('PUSH remembers the origin of the new entry', () => {
    const next = recordNavigation(empty, NavigationType.Push, loc('a', '/', '?q=pokemon'), { key: 'b' });
    const origin = next.get('b');
    expect(origin).toEqual({ pathname: '/', search: '?q=pokemon', hash: '' });
    expect(origin && toHref(origin)).toBe('/?q=pokemon');
  });

  it('REPLACE inherits the replaced entry origin and forgets the replaced key', () => {
    const pushed = recordNavigation(empty, NavigationType.Push, loc('a', '/shows/590'), { key: 'b' });
    const replaced = recordNavigation(pushed, NavigationType.Replace, loc('b', '/shows/591'), { key: 'c' });
    expect(replaced.get('c')).toEqual({ pathname: '/shows/590', search: '', hash: '' });
    expect(replaced.has('b')).toBe(false);
  });

  it('REPLACE of an entry reached from outside the app stays without origin', () => {
    expect(recordNavigation(empty, NavigationType.Replace, loc('default', '/'), { key: 'c' }).has('c')).toBe(false);
  });

  it('POP changes nothing', () => {
    const pushed = recordNavigation(empty, NavigationType.Push, loc('a', '/'), { key: 'b' });
    expect(recordNavigation(pushed, NavigationType.Pop, loc('b', '/shows/1'), { key: 'a' })).toBe(pushed);
  });

  it('never records an origin that could leave the domain', () => {
    const stale = new Map([['b', { pathname: '/old', search: '', hash: '' }]]);
    expect(recordNavigation(stale, NavigationType.Push, loc('a', '//evil.com'), { key: 'b' }).has('b')).toBe(false);
  });

  it('bounds the number of tracked entries', () => {
    let map: ReturnType<typeof recordNavigation> = new Map();
    for (let i = 0; i <= MAX_TRACKED_ENTRIES + 5; i += 1) {
      map = recordNavigation(map, NavigationType.Push, loc(`k${i}`, `/shows/${i}`), { key: `k${i + 1}` });
    }
    expect(map.size).toBe(MAX_TRACKED_ENTRIES);
    expect(map.has('k1')).toBe(false);
  });
});

describe('storage', () => {
  it('round-trips through sessionStorage', () => {
    const map = new Map([['12345678', { pathname: '/', search: '?q=a', hash: '#x' }]]);
    savePreviousLocations(sessionStorage, map);
    expect(loadPreviousLocations(sessionStorage)).toEqual(map);
  });

  it('ignores malformed or tampered data', () => {
    sessionStorage.setItem('bee-tv:previous-locations', '{nope');
    expect(loadPreviousLocations(sessionStorage).size).toBe(0);
    sessionStorage.setItem('bee-tv:previous-locations', '{"a":1}');
    expect(loadPreviousLocations(sessionStorage).size).toBe(0);
    sessionStorage.setItem(
      'bee-tv:previous-locations',
      JSON.stringify([
        ['ok', { pathname: '/', search: '', hash: '' }],
        ['evil', { pathname: '//evil.com', search: '', hash: '' }],
        ['bad', { pathname: 1 }],
        'junk',
      ]),
    );
    expect([...loadPreviousLocations(sessionStorage).keys()]).toEqual(['ok']);
  });

  it('degrades silently without storage or when writes fail', () => {
    expect(loadPreviousLocations(null).size).toBe(0);
    const full = { setItem: () => { throw new Error('QuotaExceeded'); } } as unknown as Storage;
    expect(() => savePreviousLocations(full, new Map())).not.toThrow();
  });
});

function Probe() {
  const previous = usePreviousLocation();
  return <output aria-label="previous">{previous ? toHref(previous) : 'none'}</output>;
}

function renderTracker(
  initialEntries: (string | { pathname: string; key: string })[],
  storage?: Storage | null,
  navigation: NavigationApi | null = null,
) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <NavigationHistoryProvider storage={storage} navigation={navigation}>
            <Probe />
          </NavigationHistoryProvider>
        ),
      },
    ],
    { initialEntries },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const previous = () => screen.getByRole('status', { name: 'previous' }).textContent;

describe('NavigationHistoryProvider (fallback tracker)', () => {
  it('has no previous for the entry the user arrived on', () => {
    renderTracker(['/shows/21083']);
    expect(previous()).toBe('none');
  });

  it('follows push, replace and back/forward', async () => {
    const router = renderTracker(['/']);
    await act(() => router.navigate('/?q=pokemon', { replace: true }));
    expect(previous()).toBe('none');

    await act(() => router.navigate('/shows/21083'));
    expect(previous()).toBe('/?q=pokemon');

    await act(() => router.navigate('/shows/590'));
    await act(() => router.navigate('/shows/591'));
    expect(previous()).toBe('/shows/590');

    await act(() => router.navigate(-1));
    expect(previous()).toBe('/shows/21083');
    await act(() => router.navigate(1));
    expect(previous()).toBe('/shows/590');
  });

  it('survives a reload: history keys are restored from sessionStorage', () => {
    savePreviousLocations(sessionStorage, new Map([['k2', { pathname: '/', search: '?q=dark', hash: '' }]]));
    renderTracker([{ pathname: '/shows/17861', key: 'k2' }]);
    expect(previous()).toBe('/?q=dark');
  });

  it('works without storage', async () => {
    const router = renderTracker(['/'], null);
    await act(() => router.navigate('/shows/1'));
    expect(previous()).toBe('/');
  });

  it('requires the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => usePreviousLocation())).toThrow(/NavigationHistoryProvider/);
  });
});

/** Mutable fake of the browser Navigation API. */
function fakeNavigation(urls: (string | null)[], currentIndex: number) {
  const api = {
    urls,
    currentIndex,
    get currentEntry() {
      return { index: api.currentIndex };
    },
    entries: () => api.urls.map((url, index) => ({ index, url })),
  };
  return api;
}

const ORIGIN = window.location.origin;

describe('previousFromNavigationApi', () => {
  it('is undefined when the browser has no Navigation API', () => {
    expect(previousFromNavigationApi(null, ORIGIN)).toBeUndefined();
    expect(previousFromNavigationApi({ currentEntry: null, entries: () => [] }, ORIGIN)).toBeUndefined();
  });

  it('returns the previous same-origin entry, full page loads included', () => {
    const nav = fakeNavigation([`${ORIGIN}/shows/590`, `${ORIGIN}/shows/591`], 1);
    expect(previousFromNavigationApi(nav, ORIGIN)).toEqual({ pathname: '/shows/590', search: '', hash: '' });
  });

  it('keeps query and hash of the previous entry', () => {
    const nav = fakeNavigation([`${ORIGIN}/?q=pokemon#top`, `${ORIGIN}/shows/21083`], 1);
    expect(previousFromNavigationApi(nav, ORIGIN)).toEqual({ pathname: '/', search: '?q=pokemon', hash: '#top' });
  });

  it('has no previous at the first same-origin entry (e.g. arriving from google.com)', () => {
    expect(previousFromNavigationApi(fakeNavigation([`${ORIGIN}/shows/1`], 0), ORIGIN)).toBeNull();
  });

  it('rejects hidden, foreign or malformed entries defensively', () => {
    expect(previousFromNavigationApi(fakeNavigation([null, `${ORIGIN}/x`], 1), ORIGIN)).toBeNull();
    expect(previousFromNavigationApi(fakeNavigation(['https://google.com/', `${ORIGIN}/x`], 1), ORIGIN)).toBeNull();
    expect(previousFromNavigationApi(fakeNavigation(['not a url', `${ORIGIN}/x`], 1), ORIGIN)).toBeNull();
    expect(previousFromNavigationApi(fakeNavigation([`${ORIGIN}//evil.com`, `${ORIGIN}/x`], 1), ORIGIN)).toBeNull();
  });
});

describe('NavigationHistoryProvider (Navigation API)', () => {
  it('prefers the browser history over the fallback tracker', async () => {
    const nav = fakeNavigation([`${ORIGIN}/shows/590`], 0);
    const router = renderTracker(['/shows/590'], null, nav);
    expect(previous()).toBe('none');

    // Simulates a typed URL / full page load: invisible to the router, visible to the browser.
    nav.urls.push(`${ORIGIN}/shows/591`);
    nav.currentIndex = 1;
    await act(() => router.navigate('/shows/591'));
    expect(previous()).toBe('/shows/590');
  });

  it('detects the real browser API by default', () => {
    const nav = fakeNavigation([`${ORIGIN}/?q=dark`, `${ORIGIN}/shows/1`], 1);
    Object.defineProperty(window, 'navigation', { value: nav, configurable: true });
    try {
      // No `navigation` prop: the provider must detect `window.navigation` itself.
      const router = createMemoryRouter(
        [{ path: '*', element: <NavigationHistoryProvider storage={null}><Probe /></NavigationHistoryProvider> }],
        { initialEntries: ['/shows/1'] },
      );
      render(<RouterProvider router={router} />);
      expect(previous()).toBe('/?q=dark');
    } finally {
      Reflect.deleteProperty(window, 'navigation');
    }
  });
});
