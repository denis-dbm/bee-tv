/** RFC 9457 problem details, as returned by the Bee TV API. */
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: ProblemDetails | undefined;

  constructor(status: number, code: string, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

/** The request never reached the API (offline, DNS, CORS, aborted proxy...). */
export class NetworkError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export type ErrorKind = 'offline' | 'unavailable' | 'not-found' | 'invalid' | 'unknown';

export function classifyError(error: unknown): ErrorKind {
  if (error instanceof NetworkError) return 'offline';
  if (error instanceof ApiError) {
    if (error.status === 404) return 'not-found';
    if (error.status === 429 || error.status >= 500) return 'unavailable';
    if (error.status >= 400) return 'invalid';
  }
  return 'unknown';
}

export function isRetryable(error: unknown): boolean {
  const kind = classifyError(error);
  return kind === 'offline' || kind === 'unavailable';
}
