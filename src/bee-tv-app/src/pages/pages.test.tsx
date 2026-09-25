import { act, screen, waitFor, within } from '@testing-library/react';
import { FakeHttpClient } from '@/test/fakeHttpClient';
import { DARK, DARK_RESULT, notFound, SEASONS } from '@/test/fixtures';
import { renderApp } from '@/test/render';

function detailsHttp() {
  return new FakeHttpClient()
    .on('GET', '/shows/17861', DARK)
    .on('GET', '/shows/17861/seasons', { items: SEASONS })
    .on('GET', '/shows/17861/watched-episodes', { items: [{ episodeId: '1', watchedAt: 'x' }] })
    .on('GET', '/shows/17861/comments', { items: [] })
    .on('GET', '/shows/17861/episodes/comment-counts', { items: [{ episodeId: '2', count: 4 }] });
}

describe('SearchPage', () => {
  it('debounces typing into the URL and shows results', async () => {
    const http = new FakeHttpClient().on('GET', '/shows', { items: [DARK_RESULT] });
    const { user, router } = await renderApp('/', http);

    expect(screen.getByRole('heading', { level: 1, name: 'Bee TV' })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'dark');

    expect(await screen.findByText('1 series found for “dark”')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?q=dark');
    expect(http.requestsTo('GET', '/shows')).toHaveLength(1);
    expect(document.title).toBe('Search: dark · Bee TV');
  });

  it('restores the query from the URL and submits immediately on Enter', async () => {
    const http = new FakeHttpClient().on('GET', '/shows', (req) => ({
      items: req.query?.q === 'lost' ? [] : [DARK_RESULT],
    }));
    const { user, router } = await renderApp('/?q=dark', http);

    const input = screen.getByRole('searchbox');
    expect(input).toHaveValue('dark');
    expect(await screen.findByText('1 series found for “dark”')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'lost{enter}');
    expect(router.state.location.search).toBe('?q=lost');
    expect(await screen.findByText('No series found for “lost”')).toBeInTheDocument();
  });

  it('syncs the input on back/forward navigation', async () => {
    const http = new FakeHttpClient().on('GET', '/shows', { items: [DARK_RESULT] });
    const { router } = await renderApp('/?q=dark', http);
    await screen.findByText('1 series found for “dark”');

    await act(() => router.navigate('/?q=other'));
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveValue('other'));
  });
});

describe('ShowDetailsPage', () => {
  it('composes details, Bee Review, watch tracking and comments', async () => {
    const http = detailsHttp();
    await renderApp('/shows/17861', http);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bee Review for Dark' })).toBeInTheDocument();
    expect(await screen.findByText('1 of 3 episodes watched')).toBeInTheDocument();

    const pilot = screen.getByRole('article', { name: 'Secrets' });
    expect(await within(pilot).findByRole('button', { name: /Watched: Secrets/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(pilot).getByRole('button', { name: 'Bee Review for Secrets' })).toBeInTheDocument();

    const second = screen.getByRole('article', { name: 'Lies' });
    expect(await within(second).findByRole('button', { name: '4 comments on Lies. Open comments' })).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Comments' })).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Dark · Bee TV'));
  });

  it('shows a friendly not-found state with a way back', async () => {
    const http = detailsHttp().on('GET', '/shows/17861', notFound);
    const { user, router } = await renderApp('/shows/17861', http);

    expect(await screen.findByText('This one flew away')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to search' }));
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('AppLayout', () => {
  it('offers a skip link, TVMaze attribution and header search on inner pages', async () => {
    const { user, router } = await renderApp('/shows/17861', detailsHttp().on('GET', '/shows', { items: [] }));

    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByRole('link', { name: 'TVMaze' })).toHaveAttribute('href', 'https://www.tvmaze.com');

    const header = screen.getByRole('banner');
    await user.type(within(header).getByRole('searchbox'), '  {enter}');
    expect(router.state.location.pathname).toBe('/shows/17861');

    await user.type(within(header).getByRole('searchbox'), 'dark matter{enter}');
    expect(router.state.location.pathname).toBe('/');
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('dark matter');
  });

  it('renders the not-found page for unknown routes', async () => {
    await renderApp('/nope');
    expect(await screen.findByText('This page flew out of the hive')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to search' })).toHaveAttribute('href', '/');
  });
});
