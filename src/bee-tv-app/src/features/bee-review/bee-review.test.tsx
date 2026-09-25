import { screen, waitFor, within } from '@testing-library/react';
import { FakeHttpClient } from '@/test/fakeHttpClient';
import { notFound, review } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { createBeeReviewApi, reviewPath } from './api';
import { BeeReviewButton } from './components/BeeReviewButton';
import { SOURCE_COPY } from './reviewCopy';

const SERIES = '/shows/1/review';
const EPISODE = '/shows/1/episodes/e1/review';

describe('bee-review api', () => {
  it('targets series or episode reviews and forwards the comments flag', async () => {
    expect(reviewPath({ showId: '1' })).toBe(SERIES);
    expect(reviewPath({ showId: '1', episodeId: 'e1' })).toBe(EPISODE);

    const http = new FakeHttpClient().on('GET', SERIES, review());
    await createBeeReviewApi(http).getReview({ showId: '1' }, true);
    expect(http.requests[0]?.query).toEqual({ includeComments: true });
  });
});

describe('BeeReviewButton', () => {
  it('opens the review pop-up and regenerates when viewers opinions are toggled', async () => {
    const http = new FakeHttpClient().on('GET', SERIES, (req) =>
      req.query?.includeComments ? review({ text: 'With viewers.', commentsConsidered: 3 }) : review(),
    );
    const { user } = renderWithProviders(<BeeReviewButton target={{ showId: '1' }} subjectTitle="Dark" />, { http });

    await user.click(screen.getByRole('button', { name: 'Bee Review for Dark' }));
    const dialog = await screen.findByRole('dialog', { name: /Bee Review · Dark/ });
    expect(await within(dialog).findByText(review().text)).toBeInTheDocument();
    expect(within(dialog).getByText(SOURCE_COPY.ai.label)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('switch', { name: "Consider viewers' opinions" }));
    expect(await within(dialog).findByText('With viewers.')).toBeInTheDocument();
    expect(within(dialog).getByText('Based on 3 viewer comments')).toBeInTheDocument();
    expect(http.requests.map((r) => r.query?.includeComments)).toEqual([false, true]);

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('is transparent about fallback insights', async () => {
    const http = new FakeHttpClient().on('GET', EPISODE, review({ source: 'fallback', generator: 'bee-rules-v1' }));
    const { user } = renderWithProviders(
      <BeeReviewButton variant="compact" target={{ showId: '1', episodeId: 'e1' }} subjectTitle="Pilot" />,
      { http },
    );

    await user.click(screen.getByRole('button', { name: 'Bee Review for Pilot' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(SOURCE_COPY.fallback.label)).toBeInTheDocument();
    expect(within(dialog).getByText(SOURCE_COPY.fallback.hint)).toBeInTheDocument();
  });

  it('shows a friendly error', async () => {
    const http = new FakeHttpClient().on('GET', SERIES, notFound);
    const { user } = renderWithProviders(<BeeReviewButton target={{ showId: '1' }} subjectTitle="Dark" />, { http });
    await user.click(screen.getByRole('button', { name: 'Bee Review for Dark' }));
    expect(await screen.findByText("Bee couldn't review this one")).toBeInTheDocument();
  });
});
