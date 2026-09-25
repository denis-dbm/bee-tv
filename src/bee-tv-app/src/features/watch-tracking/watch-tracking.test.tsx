import { screen, waitFor } from '@testing-library/react';
import { FakeHttpClient } from '@/test/fakeHttpClient';
import { unavailable } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { createWatchTrackingApi } from './api';
import { EpisodeWatchToggle } from './components/WatchedToggle';
import { WatchProgress } from './components/WatchProgress';
import { applyToggle } from './useWatchedEpisodes';

const LIST = '/shows/1/watched-episodes';

describe('watch-tracking api', () => {
  it('uses idempotent PUT/DELETE on the watched-episodes resource', async () => {
    const http = new FakeHttpClient()
      .on('GET', LIST, { items: [{ episodeId: 'a', watchedAt: 'x' }] })
      .on('PUT', `${LIST}/a`, { episodeId: 'a', watchedAt: 'x' })
      .on('DELETE', `${LIST}/a`, undefined);
    const api = createWatchTrackingApi(http);
    await expect(api.listWatched('1')).resolves.toHaveLength(1);
    await api.markWatched('1', 'a');
    await api.unmarkWatched('1', 'a');
    expect(http.requests.map((r) => r.method)).toEqual(['GET', 'PUT', 'DELETE']);
  });
});

describe('applyToggle', () => {
  const now = new Date('2024-01-01T00:00:00Z');
  it('adds and removes entries without duplicates', () => {
    const added = applyToggle(undefined, { episodeId: 'a', watched: true }, now);
    expect(added).toEqual([{ episodeId: 'a', watchedAt: now.toISOString() }]);
    expect(applyToggle(added, { episodeId: 'a', watched: true }, now)).toHaveLength(1);
    expect(applyToggle(added, { episodeId: 'a', watched: false })).toEqual([]);
  });
});

describe('EpisodeWatchToggle', () => {
  it('toggles watched state optimistically and persists it', async () => {
    const http = new FakeHttpClient()
      .on('GET', LIST, { items: [] })
      .on('PUT', `${LIST}/e1`, { episodeId: 'e1', watchedAt: 'now' })
      .on('DELETE', `${LIST}/e1`, undefined);
    const { user } = renderWithProviders(<EpisodeWatchToggle showId="1" episodeId="e1" episodeTitle="Pilot" />, { http });

    const toggle = await screen.findByRole('button', { name: 'Mark Pilot as watched' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    http.on('GET', LIST, { items: [{ episodeId: 'e1', watchedAt: 'now' }] });
    await user.click(toggle);
    expect(await screen.findByRole('button', { name: /Watched: Pilot/ })).toHaveAttribute('aria-pressed', 'true');
    expect(http.requestsTo('PUT', `${LIST}/e1`)).toHaveLength(1);

    http.on('GET', LIST, { items: [] });
    await user.click(screen.getByRole('button', { name: /Watched: Pilot/ }));
    expect(await screen.findByRole('button', { name: 'Mark Pilot as watched' })).toBeInTheDocument();
    expect(http.requestsTo('DELETE', `${LIST}/e1`)).toHaveLength(1);
  });

  it('rolls back and notifies when saving fails', async () => {
    const http = new FakeHttpClient().on('GET', LIST, { items: [] }).on('PUT', `${LIST}/e1`, unavailable);
    const { user } = renderWithProviders(<EpisodeWatchToggle showId="1" episodeId="e1" episodeTitle="Pilot" />, { http });

    const toggle = await screen.findByRole('button', { name: 'Mark Pilot as watched' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);

    expect(await screen.findByText(/Couldn't mark it as watched/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Pilot as watched' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('WatchProgress', () => {
  it('summarizes progress', async () => {
    const http = new FakeHttpClient().on('GET', LIST, { items: [{ episodeId: 'a', watchedAt: 'x' }] });
    renderWithProviders(<WatchProgress showId="1" episodeIds={['a', 'b']} />, { http });
    expect(await screen.findByText('1 of 2 episodes watched')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Watch progress' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('celebrates completion', async () => {
    const http = new FakeHttpClient().on('GET', LIST, { items: [{ episodeId: 'a', watchedAt: 'x' }] });
    renderWithProviders(<WatchProgress showId="1" episodeIds={['a']} />, { http });
    expect(await screen.findByText(/All 1 episodes watched/)).toBeInTheDocument();
  });

  it('renders nothing without episodes', async () => {
    const http = new FakeHttpClient().on('GET', LIST, { items: [] });
    const { container } = renderWithProviders(<WatchProgress showId="1" episodeIds={[]} />, { http });
    await waitFor(() => expect(http.requests).toHaveLength(1));
    expect(container).toBeEmptyDOMElement();
  });
});
