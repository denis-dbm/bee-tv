import { act, renderHook } from '@testing-library/react';
import { formatDate, formatRelativeTime, pluralize } from './format';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { APP_NAME, useDocumentTitle } from './hooks/useDocumentTitle';

describe('format helpers', () => {
  it('formats dates and tolerates missing or invalid values', () => {
    expect(formatDate('2017-12-01')).toBe('Dec 1, 2017');
    expect(formatDate(null)).toBeNull();
    expect(formatDate('not-a-date')).toBeNull();
  });

  it('formats relative time', () => {
    const now = new Date('2024-01-10T12:00:00Z');
    expect(formatRelativeTime('2024-01-10T11:59:50Z', now)).toBe('just now');
    expect(formatRelativeTime('2024-01-10T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatRelativeTime('2024-01-09T12:00:00Z', now)).toBe('yesterday');
    expect(formatRelativeTime('2023-01-10T12:00:00Z', now)).toBe('last year');
  });

  it('pluralizes', () => {
    expect(pluralize(1, 'comment')).toBe('1 comment');
    expect(pluralize(0, 'comment')).toBe('0 comments');
    expect(pluralize(2, 'series', 'series')).toBe('2 series');
  });
});

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits the latest value after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    expect(result.current).toBe('a');
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('abc');
  });
});

describe('useDocumentTitle', () => {
  it('prefixes the app name', () => {
    const { rerender } = renderHook(({ title }: { title?: string | null }) => useDocumentTitle(title), {
      initialProps: { title: 'Dark' as string | null },
    });
    expect(document.title).toBe(`Dark · ${APP_NAME}`);
    rerender({ title: null });
    expect(document.title).toBe(APP_NAME);
  });
});
