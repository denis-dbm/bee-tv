import { ApiError, classifyError, isRetryable, NetworkError } from './errors';
import { FetchHttpClient } from './httpClient';
import { MAX_QUERY_RETRIES, shouldRetryQuery } from './queryClient';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('classifyError', () => {
  it.each([
    [new NetworkError(), 'offline'],
    [new ApiError(404, 'x', 'x'), 'not-found'],
    [new ApiError(503, 'x', 'x'), 'unavailable'],
    [new ApiError(500, 'x', 'x'), 'unavailable'],
    [new ApiError(429, 'x', 'x'), 'unavailable'],
    [new ApiError(422, 'x', 'x'), 'invalid'],
    [new Error('boom'), 'unknown'],
    ['weird', 'unknown'],
  ])('%s -> %s', (error, kind) => {
    expect(classifyError(error)).toBe(kind);
  });

  it('only outages and network failures are retryable', () => {
    expect(isRetryable(new NetworkError())).toBe(true);
    expect(isRetryable(new ApiError(503, 'x', 'x'))).toBe(true);
    expect(isRetryable(new ApiError(404, 'x', 'x'))).toBe(false);
  });
});

describe('shouldRetryQuery', () => {
  it('retries transient errors a bounded number of times', () => {
    const outage = new ApiError(503, 'x', 'x');
    expect(shouldRetryQuery(0, outage)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, outage)).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, 'x', 'x'))).toBe(false);
  });
});

describe('FetchHttpClient', () => {
  it('builds URLs with encoded query params and skips undefined ones', () => {
    const client = new FetchHttpClient('/api/v1/');
    expect(client.buildUrl('/shows', { q: 'dark matter', page: undefined, flag: true })).toBe(
      '/api/v1/shows?q=dark+matter&flag=true',
    );
    expect(client.buildUrl('/shows')).toBe('/api/v1/shows');
  });

  it('performs JSON requests', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ id: 1 }, 201));
    const client = new FetchHttpClient('/api', fetchFn);

    await expect(client.post('/comments', { body: 'hi' })).resolves.toEqual({ id: 1 });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/comments');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"body":"hi"}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('omits the body and content type when there is no payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ ok: true }));
    await new FetchHttpClient('/api', fetchFn).get('/x');
    const init = fetchFn.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('handles 204 No Content', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = new FetchHttpClient('/api', fetchFn);
    await expect(client.delete('/x')).resolves.toBeUndefined();
    await expect(client.put('/y')).resolves.toBeUndefined();
  });

  it('maps problem details to ApiError', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(json({ title: 'Not found', status: 404, detail: 'No show 1', code: 'show_not_found' }, 404));
    const error = await new FetchHttpClient('/api', fetchFn).get('/shows/1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'show_not_found', message: 'No show 1' });
  });

  it('maps non-JSON error bodies to ApiError', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>', { status: 502, statusText: 'Bad Gateway' }));
    const error = await new FetchHttpClient('/api', fetchFn).get('/x').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'http_error', message: 'Bad Gateway' });
  });

  it('maps transport failures to NetworkError', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(new FetchHttpClient('/api', fetchFn).get('/x')).rejects.toBeInstanceOf(NetworkError);
  });

  it('propagates aborts untouched', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    const fetchFn = vi.fn().mockRejectedValue(abort);
    await expect(new FetchHttpClient('/api', fetchFn).get('/x')).rejects.toBe(abort);
  });

  it('uses the global fetch by default', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ items: [] }));
    await expect(new FetchHttpClient().get('/shows')).resolves.toEqual({ items: [] });
    expect(spy).toHaveBeenCalledWith('/api/v1/shows', expect.anything());
    spy.mockRestore();
  });
});
