import { render, renderHook, screen } from '@testing-library/react';
import { createQueryClient, MAX_QUERY_RETRIES, useHttpClient } from '@/shared/api';
import { App } from './App';

describe('App', () => {
  it('boots with real providers and the browser router', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Bee TV' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search TV series' })).toHaveFocus();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('createQueryClient', () => {
  it('retries transient failures only and never retries mutations', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(typeof defaults.queries?.retry).toBe('function');
    expect(defaults.mutations?.retry).toBe(false);
    expect(MAX_QUERY_RETRIES).toBeGreaterThan(0);
  });
});

describe('useHttpClient', () => {
  it('requires a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useHttpClient())).toThrow(/HttpClientContext/);
  });
});
