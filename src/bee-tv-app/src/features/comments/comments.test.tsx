import { screen, waitFor, within } from '@testing-library/react';
import { FakeHttpClient } from '@/test/fakeHttpClient';
import { comment, unavailable } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { commentsPath, createCommentsApi, MAX_COMMENT_LENGTH } from './api';
import { CommentsSection } from './components/CommentsSection';
import { EpisodeCommentsButton } from './components/EpisodeComments';

const SERIES = '/shows/1/comments';
const EPISODE = '/shows/1/episodes/e1/comments';
const COUNTS = '/shows/1/episodes/comment-counts';

describe('comments api', () => {
  it('resolves series and episode paths', () => {
    expect(commentsPath({ showId: '1' })).toBe(SERIES);
    expect(commentsPath({ showId: '1', episodeId: 'e1' })).toBe(EPISODE);
  });

  it('lists, creates and counts', async () => {
    const http = new FakeHttpClient()
      .on('GET', SERIES, { items: [comment()] })
      .on('POST', SERIES, comment({ id: 2 }))
      .on('GET', COUNTS, { items: [{ episodeId: 'e1', count: 3 }] });
    const api = createCommentsApi(http);
    await expect(api.list({ showId: '1' })).resolves.toHaveLength(1);
    await expect(api.create({ showId: '1' }, 'hi')).resolves.toMatchObject({ id: 2 });
    expect(http.requestsTo('POST', SERIES)[0]?.body).toEqual({ body: 'hi' });
    await expect(api.countByEpisode('1')).resolves.toEqual([{ episodeId: 'e1', count: 3 }]);
  });
});

describe('CommentsSection', () => {
  it('lists comments and posts new ones at the top', async () => {
    const http = new FakeHttpClient()
      .on('GET', SERIES, { items: [comment({ body: 'Old one' })] })
      .on('POST', SERIES, (req) => comment({ id: 2, body: (req.body as { body: string }).body }));
    const { user } = renderWithProviders(<CommentsSection target={{ showId: '1' }} heading="Comments" />, { http });

    expect(await screen.findByText('Old one')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Comment' });
    expect(button).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Share your thoughts' }), '  So good!  ');
    expect(screen.getByText(`12/${MAX_COMMENT_LENGTH}`)).toBeInTheDocument();
    await user.click(button);

    const items = await screen.findAllByRole('listitem');
    expect(items[0]).toHaveTextContent('So good!');
    expect(http.requestsTo('POST', SERIES)[0]?.body).toEqual({ body: 'So good!' });
    expect(screen.getByRole('textbox', { name: 'Share your thoughts' })).toHaveValue('');
    expect(await screen.findByText(/Comment posted/)).toBeInTheDocument();
  });

  it('submits with Ctrl+Enter', async () => {
    const http = new FakeHttpClient().on('GET', SERIES, { items: [] }).on('POST', SERIES, comment({ body: 'Quick' }));
    const { user } = renderWithProviders(<CommentsSection target={{ showId: '1' }} />, { http });
    await screen.findByText('No buzz yet');
    await user.type(screen.getByRole('textbox'), 'Quick{Control>}{Enter}{/Control}');
    await waitFor(() => expect(http.requestsTo('POST', SERIES)).toHaveLength(1));
  });

  it('keeps the draft and notifies when posting fails', async () => {
    const http = new FakeHttpClient().on('GET', SERIES, { items: [] }).on('POST', SERIES, unavailable);
    const { user } = renderWithProviders(<CommentsSection target={{ showId: '1' }} />, { http });
    await screen.findByText('No buzz yet');

    await user.type(screen.getByRole('textbox'), 'Draft');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    expect(await screen.findByText(/Couldn't post your comment/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Draft');
  });

  it('shows an inline error when comments cannot load', async () => {
    const http = new FakeHttpClient().on('GET', SERIES, unavailable);
    renderWithProviders(<CommentsSection target={{ showId: '1' }} />, { http });
    expect(await screen.findByText('Comments are out buzzing')).toBeInTheDocument();
  });
});

describe('EpisodeCommentsButton', () => {
  it('shows the count and opens an episode-scoped pop-up', async () => {
    const http = new FakeHttpClient()
      .on('GET', COUNTS, { items: [{ episodeId: 'e1', count: 1 }] })
      .on('GET', EPISODE, { items: [comment({ episodeId: 'e1', body: 'Episode talk' })] })
      .on('POST', EPISODE, comment({ id: 9, episodeId: 'e1', body: 'Another' }));
    const { user } = renderWithProviders(<EpisodeCommentsButton showId="1" episodeId="e1" episodeTitle="Pilot" />, {
      http,
    });

    const button = await screen.findByRole('button', { name: '1 comment on Pilot. Open comments' });
    expect(button).toHaveTextContent('1');
    await user.click(button);

    const dialog = await screen.findByRole('dialog', { name: 'Comments · Pilot' });
    expect(await within(dialog).findByText('Episode talk')).toBeInTheDocument();

    http.on('GET', COUNTS, { items: [{ episodeId: 'e1', count: 2 }] });
    await user.type(within(dialog).getByRole('textbox'), 'Another');
    await user.click(within(dialog).getByRole('button', { name: 'Comment' }));
    expect(await within(dialog).findByText('Another')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('button', { name: '2 comments on Pilot. Open comments' })).toBeInTheDocument();
  });

  it('defaults to zero comments', async () => {
    const http = new FakeHttpClient().on('GET', COUNTS, { items: [] });
    renderWithProviders(<EpisodeCommentsButton showId="1" episodeId="e1" episodeTitle="Pilot" />, { http });
    expect(await screen.findByRole('button', { name: '0 comments on Pilot. Open comments' })).toBeInTheDocument();
  });
});
