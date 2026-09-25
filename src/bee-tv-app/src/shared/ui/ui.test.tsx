import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, NetworkError } from '@/shared/api';
import { EmptyState } from './EmptyState';
import { ERROR_COPY } from './errorCopy';
import { ErrorState } from './ErrorState';
import { friendlyErrorMessage } from './friendlyErrorMessage';
import { NotificationProvider } from './NotificationProvider';
import { useNotify } from './notificationContext';
import { PosterPlaceholder } from './PosterPlaceholder';

describe('ErrorState', () => {
  it('shows creative copy and a retry for outages', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError(503, 'x', 'x')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_COPY.unavailable.title);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not offer retry for not-found errors', () => {
    render(<ErrorState error={new ApiError(404, 'x', 'x')} onRetry={vi.fn()} />);
    expect(screen.getByText(ERROR_COPY['not-found'].title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
  });

  it('renders a compact alert with a custom title and extra action', () => {
    render(<ErrorState compact error={new NetworkError()} title="Custom" action={<button>Extra</button>} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Custom');
    expect(screen.getByRole('alert')).toHaveTextContent(ERROR_COPY.offline.description);
    expect(screen.getByRole('button', { name: 'Extra' })).toBeInTheDocument();
  });

  it('renders the full variant with an extra action', () => {
    render(<ErrorState error={new Error('x')} action={<button>Back</button>} />);
    expect(screen.getByText(ERROR_COPY.unknown.title)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState mood="sleepy" title="Nothing" description="here" />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.getByText('here')).toBeInTheDocument();
  });

  it.each(['happy', 'sleepy', 'lost', 'dizzy'] as const)('renders the %s mascot decoratively', (mood) => {
    const { container } = render(<EmptyState mood={mood} title="t" />);
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('friendlyErrorMessage', () => {
  it('builds actionable one-liners', () => {
    expect(friendlyErrorMessage('post', new ApiError(503, 'x', 'x'))).toBe(
      `Couldn't post. ${ERROR_COPY.unavailable.title}, please try again.`,
    );
    expect(friendlyErrorMessage('post', new ApiError(404, 'x', 'x'))).toMatch(/^Couldn't post: this one flew away/);
  });
});

describe('notifications', () => {
  function Trigger() {
    const notify = useNotify();
    return <button onClick={() => notify('Saved!', 'success')}>Notify</button>;
  }

  it('shows and dismisses a toast', async () => {
    render(
      <NotificationProvider>
        <Trigger />
      </NotificationProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    await vi.waitFor(() => expect(screen.queryByText('Saved!')).not.toBeInTheDocument());
  });

  it('requires a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow(/NotificationProvider/);
  });
});

it('PosterPlaceholder is decorative', () => {
  const { container } = render(<PosterPlaceholder />);
  expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
});
