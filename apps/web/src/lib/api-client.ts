import { ApiError, ClientErrorCode, toApiError } from './api-error';

/** Same-origin API root. The reverse proxy (or the dev rewrite in next.config.ts) routes `/api/*` to the API. */
export const API_BASE_PATH = '/api/v1';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

/** Anything with `parse` — Zod schemas from `@repo/contracts` satisfy this. */
export interface ResponseSchema<T> {
  parse(data: unknown): T;
}

export interface RequestOptions<T> {
  query?: QueryParams;
  /** Serialized as JSON. */
  body?: unknown;
  /** Validates the success body; without it the body is returned unchecked. */
  schema?: ResponseSchema<T>;
  /** Required for financial mutations; reuse the same key when retrying one submission. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export type ReadOptions<T> = Omit<RequestOptions<T>, 'body' | 'idempotencyKey'>;

/**
 * The only way the web app talks to the API (ai-context/11-frontend-standards.md).
 * Resolves with the (optionally validated) body; rejects with `ApiError` — or the original `AbortError` when the
 * caller cancelled, so TanStack Query can treat it as a cancellation.
 */
export async function apiRequest<T = unknown>(
  method: HttpMethod,
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { query, body, schema, idempotencyKey, signal } = options;
  const headers = new Headers({ Accept: 'application/json', 'X-Requested-With': 'fetch' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (idempotencyKey !== undefined) headers.set('Idempotency-Key', idempotencyKey);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError({
      status: 0,
      code: ClientErrorCode.NETWORK_ERROR,
      message: 'Could not reach the server. Check your connection and try again.',
      requestId: null,
      cause: error,
    });
  }

  if (!response.ok) throw await toApiError(response);
  return parseSuccess(response, schema);
}

async function parseSuccess<T>(
  response: Response,
  schema: ResponseSchema<T> | undefined,
): Promise<T> {
  const text = await response.text();
  try {
    const data: unknown = text === '' ? undefined : JSON.parse(text);
    return schema ? schema.parse(data) : (data as T);
  } catch (error) {
    throw new ApiError({
      status: response.status,
      code: ClientErrorCode.INVALID_RESPONSE,
      message: 'The server sent an unexpected response.',
      requestId: response.headers.get('x-request-id'),
      cause: error,
    });
  }
}

export function buildUrl(path: string, query?: QueryParams): string {
  if (!path.startsWith('/')) throw new Error(`API path must start with "/": ${path}`);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    const values: readonly QueryValue[] = Array.isArray(value) ? value : [value as QueryValue];
    for (const item of values) {
      if (item !== undefined && item !== null) params.append(key, String(item));
    }
  }
  const search = params.toString();
  return `${API_BASE_PATH}${path}${search === '' ? '' : `?${search}`}`;
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: ReadOptions<T>): Promise<T> =>
    apiRequest('GET', path, options),
  post: <T = unknown>(path: string, options?: RequestOptions<T>): Promise<T> =>
    apiRequest('POST', path, options),
  put: <T = unknown>(path: string, options?: RequestOptions<T>): Promise<T> =>
    apiRequest('PUT', path, options),
  patch: <T = unknown>(path: string, options?: RequestOptions<T>): Promise<T> =>
    apiRequest('PATCH', path, options),
  delete: <T = unknown>(path: string, options?: RequestOptions<T>): Promise<T> =>
    apiRequest('DELETE', path, options),
};
