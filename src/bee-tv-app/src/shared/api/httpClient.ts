import { ApiError, NetworkError, type ProblemDetails } from './errors';

export type QueryParams = Record<string, string | number | boolean | undefined>;

export interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
}

/** Transport abstraction: features depend on this interface, never on `fetch` directly. */
export interface HttpClient {
  get<T>(path: string, options?: RequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete(path: string, options?: RequestOptions): Promise<void>;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchFn;

  constructor(baseUrl = '/api/v1', fetchFn: FetchFn = (input, init) => fetch(input, init)) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchFn = fetchFn;
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete(path: string, options?: RequestOptions): Promise<void> {
    await this.request<unknown>('DELETE', path, undefined, options);
  }

  buildUrl(path: string, query?: QueryParams): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) params.set(key, String(value));
    }
    const search = params.toString();
    return `${this.baseUrl}${path}${search ? `?${search}` : ''}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await this.fetchFn(this.buildUrl(path, options.query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: options.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new NetworkError(error instanceof Error ? error.message : undefined);
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let problem: ProblemDetails | undefined;
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    problem = undefined;
  }
  const message = problem?.detail ?? problem?.title ?? response.statusText ?? 'Request failed';
  return new ApiError(response.status, problem?.code ?? 'http_error', message, problem);
}
