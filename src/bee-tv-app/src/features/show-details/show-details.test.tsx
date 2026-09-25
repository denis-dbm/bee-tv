import { screen, within } from '@testing-library/react';
import { FakeHttpClient } from '@/test/fakeHttpClient';
import { DARK, SEASONS, unavailable } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { createShowDetailsApi, type Season } from './api';
import { SeasonsSection } from './components/SeasonsSection';
import { ShowHeader, ShowHeaderSkeleton } from './components/ShowHeader';
import { defaultSeasonIndex, episodeCode, seasonLabel, showMeta } from './format';

describe('show-details api', () => {
  it('fetches show and seasons', async () => {
    const http = new FakeHttpClient().on('GET', '/shows/17861', DARK).on('GET', '/shows/17861/seasons', { items: SEASONS });
    const api = createShowDetailsApi(http);
    await expect(api.getShow('17861')).resolves.toEqual(DARK);
    await expect(api.getSeasons('17861')).resolves.toEqual(SEASONS);
  });
});

describe('format', () => {
  it('builds episode codes', () => {
    expect(episodeCode({ season: 1, number: 2 })).toBe('S01E02');
    expect(episodeCode({ season: 0, number: null })).toBe('S00 · Special');
  });

  it('labels seasons', () => {
    expect(seasonLabel({ number: 0 })).toBe('Specials');
    expect(seasonLabel({ number: 3 })).toBe('Season 3');
  });

  it('prefers the first regular season', () => {
    const specials: Season = { number: 0, episodes: [] };
    expect(defaultSeasonIndex([specials, ...SEASONS])).toBe(1);
    expect(defaultSeasonIndex([specials])).toBe(0);
    expect(defaultSeasonIndex([])).toBe(0);
  });

  it('summarizes show metadata', () => {
    expect(showMeta(DARK)).toEqual(['2017–2020', 'Netflix', 'Ended', 'German']);
    expect(showMeta({ ...DARK, ended: '2017-12-30' })[0]).toBe('2017');
    expect(showMeta({ ...DARK, year: null, network: null, status: null, language: null })).toEqual([]);
  });
});

describe('ShowHeader', () => {
  it('renders poster, summary, genres and the poster slot', () => {
    renderWithProviders(<ShowHeader show={DARK} posterActions={<button>Slot</button>} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dark poster' })).toBeInTheDocument();
    expect(screen.getByText(DARK.summary)).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Genres' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByLabelText('Rated 8.2 out of 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Slot' })).toBeInTheDocument();
  });

  it('handles missing poster, summary, genres and rating', () => {
    renderWithProviders(<ShowHeader show={{ ...DARK, posterUrl: null, summary: '', genres: [], rating: null }} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('No summary available yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Genres' })).not.toBeInTheDocument();
  });

  it('has a loading skeleton', () => {
    renderWithProviders(<ShowHeaderSkeleton />);
    expect(screen.getByLabelText('Loading series')).toBeInTheDocument();
  });
});

describe('SeasonsSection', () => {
  const http = () => new FakeHttpClient().on('GET', '/shows/17861/seasons', { items: SEASONS });

  it('groups episodes in season tabs and renders the slots', async () => {
    const { user } = renderWithProviders(
      <SeasonsSection
        showId="17861"
        renderTitleAdornment={(episode) => <span>watched-{episode.id}</span>}
        renderActions={(episode) => <button>actions-{episode.id}</button>}
      />,
      { http: http() },
    );

    expect(await screen.findByRole('tab', { name: 'Season 1 (2)', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Secrets' })).toBeInTheDocument();
    expect(screen.getByText('watched-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'actions-2' })).toBeInTheDocument();
    expect(screen.getByText(/S01E01 · .*2017 · 52 min/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Season 2 (1)' }));
    expect(screen.getByRole('heading', { name: 'Beginnings and Endings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Secrets' })).not.toBeInTheDocument();
  });

  it('renders without slots', async () => {
    renderWithProviders(<SeasonsSection showId="17861" />, { http: http() });
    expect(await screen.findByRole('heading', { name: 'Lies' })).toBeInTheDocument();
  });

  it('explains when there are no episodes', async () => {
    const empty = new FakeHttpClient().on('GET', '/shows/1/seasons', { items: [] });
    renderWithProviders(<SeasonsSection showId="1" />, { http: empty });
    expect(await screen.findByText('No episodes announced yet')).toBeInTheDocument();
  });

  it('shows an inline outage state', async () => {
    const failing = new FakeHttpClient().on('GET', '/shows/1/seasons', unavailable);
    renderWithProviders(<SeasonsSection showId="1" />, { http: failing });
    expect(await screen.findByText('Episodes are buzzing off-schedule')).toBeInTheDocument();
  });
});
