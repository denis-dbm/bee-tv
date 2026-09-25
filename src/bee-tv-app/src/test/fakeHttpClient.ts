import { ApiError, type HttpClient, type RequestOptions } from '@/shared/api';

export interface RecordedRequest {
  method: string;
  path: string;
  query: RequestOptions['query'];
  body: unknown;
}

type Responder = ((request: RecordedRequest) => unknown) | object | undefined;

/** Route-table HTTP fake: responds with values, factories, or throws `Error`s. */
export class FakeHttpClient implements HttpClient {
  readonly requests: RecordedRequest[] = [];
  private readonly routes = new Map<string, Responder>();

  on(method: string, path: string, responder: Responder): this {
    this.routes.set(`${method} ${path}`, responder);
    return this;
  }

  requestsTo(method: string, path: string): RecordedRequest[] {
    return this.requests.filter((r) => r.method === method && r.path === path);
  }

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.handle<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    return this.handle<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.handle<T>('PUT', path, body, options);
  }

  async delete(path: string, options?: RequestOptions): Promise<void> {
    await this.handle<unknown>('DELETE', path, undefined, options);
  }

  private async handle<T>(method: string, path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const request: RecordedRequest = { method, path, query: options?.query, body };
    this.requests.push(request);
    const key = `${method} ${path}`;
    if (!this.routes.has(key)) throw new ApiError(404, 'not_found', `No fake route for ${key}`);
    const responder = this.routes.get(key);
    const result = typeof responder === 'function' ? await (responder as (r: RecordedRequest) => unknown)(request) : responder;
    if (result instanceof Error) throw result;
    return result as T;
  }
}
