import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { FakeHttpClient } from '@/test/fakeHttpClient';
import { DARK_RESULT, unavailable } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { createSearchApi } from './api';
import { SearchBar } from './components/SearchBar';
import { SearchResults } from './components/SearchResults';

describe('search api', () => {
  it('unwraps the page envelope', async () => {
    const http = new FakeHttpClient().on('GET', '/shows', { items: [DARK_RESULT] });
    await expect(createSearchApi(http).searchShows('dark')).resolves.toEqual([DARK_RESULT]);
    expect(http.requests[0]?.query).toEqual({ q: 'dark' });
  });
});

describe('SearchBar', () => {
  it('is a labeled search landmark that reports changes and submits trimmed values', async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<SearchBar value="  dark " onChange={onChange} onSubmit={onSubmit} />);

    expect(screen.getByRole('search')).toBeInTheDocument();
    const input = screen.getByRole('searchbox', { name: 'Search TV series' });
    await userEvent.type(input, 'x');
    expect(onChange).toHaveBeenLastCalledWith('  dark x');

    await userEvent.type(input, '{enter}');
    expect(onSubmit).toHaveBeenCalledWith('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('hides the clear button when empty and supports the compact variant', () => {
    render(<SearchBar value="" onChange={vi.fn()} size="compact" />);
    expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
  });
});

describe('SearchResults', () => {
  it('invites the user to search when there is no query', () => {
    renderWithProviders(<SearchResults query="  " />);
    expect(screen.getByText('What are we watching today?')).toBeInTheDocument();
  });

  it('renders result tiles linking to the details page', async () => {
    const http = new FakeHttpClient().on('GET', '/shows', {
      items: [DARK_RESULT, { id: '2', title: 'Dark Matter', year: null, posterUrl: null }],
    });
    renderWithProviders(<SearchResults query="dark" />, { http });

    expect(await screen.findByText('2 series found for “dark”')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dark poster' })).toHaveAttribute('src', DARK_RESULT.posterUrl);
    expect(screen.getByRole('link', { name: /Dark 2017/ })).toHaveAttribute('href', '/shows/17861');
    expect(screen.getByText('Year unknown')).toBeInTheDocument();
  });

  it('explains when nothing matches', async () => {
    const http = new FakeHttpClient().on('GET', '/shows', { items: [] });
    renderWithProviders(<SearchResults query="zzz" />, { http });
    expect(await screen.findByText('No series found for “zzz”')).toBeInTheDocument();
    expect(screen.getByText('Our bees searched every flower')).toBeInTheDocument();
  });

  it('shows a friendly outage state with retry', async () => {
    let calls = 0;
    const http = new FakeHttpClient().on('GET', '/shows', () => (++calls === 1 ? unavailable() : { items: [DARK_RESULT] }));
    const { user } = renderWithProviders(<SearchResults query="dark" />, { http });

    expect(await screen.findByText('Our bees are taking a short nap')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('1 series found for “dark”')).toBeInTheDocument();
  });
});
