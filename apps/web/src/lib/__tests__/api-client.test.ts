import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiClient, buildUrl } from '../api-client';
import { ApiError, ClientErrorCode } from '../api-error';

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

function lastRequest(): { url: string; init: RequestInit; headers: Headers } {
  const [url, init] = fetchMock.mock.lastCall ?? [];
  if (typeof url !== 'string' || !init) throw new Error('fetch was not called');
  return { url, init, headers: new Headers(init.headers) };
}

describe('buildUrl', () => {
  it('prefixes the versioned API base and encodes query params', () => {
    expect(buildUrl('/projects')).toBe('/api/v1/projects');
    expect(buildUrl('/projects', { q: 'a&b', page: 2, archived: false })).toBe(
      '/api/v1/projects?q=a%26b&page=2&archived=false',
    );
  });

  it('repeats array params and drops null/undefined', () => {
    expect(buildUrl('/x', { status: ['active', 'closed'], a: undefined, b: null })).toBe(
      '/api/v1/x?status=active&status=closed',
    );
  });

  it('rejects relative paths', () => {
    expect(() => buildUrl('projects')).toThrow();
  });
});

describe('apiClient requests', () => {
  it('sends same-origin credentials, CSRF header and JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: '1' }));

    await apiClient.post('/parties', { body: { name: 'Acme' }, idempotencyKey: 'key-1' });

    const { url, init, headers } = lastRequest();
    expect(url).toBe('/api/v1/parties');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.body).toBe('{"name":"Acme"}');
    expect(headers.get('X-Requested-With')).toBe('fetch');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Idempotency-Key')).toBe('key-1');
  });

  it('omits body and content type on reads', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await apiClient.get('/projects');

    const { init, headers } = lastRequest();
    expect(init.body).toBeNull();
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.has('Idempotency-Key')).toBe(false);
  });

  it('returns the parsed body, validated when a schema is given', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { amount: '10.50', extra: true }));

    const data = await apiClient.get('/x', { schema: z.object({ amount: z.string() }) });

    expect(data).toEqual({ amount: '10.50' });
  });

  it('resolves undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiClient.delete('/x/1')).resolves.toBeUndefined();
  });
});

describe('apiClient errors', () => {
  it('parses the error envelope into ApiError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: 'ALLOCATION_EXCEEDS_BALANCE',
          message: 'Allocation exceeds the remaining amount of the bill.',
          details: [{ path: 'allocations[0].amount', code: 'max', message: 'Maximum is 4500.00' }],
          requestId: 'req-1',
        },
      }),
    );

    const error = await captureError(apiClient.post('/payments', { body: {} }));

    expect(error).toMatchObject({
      status: 422,
      code: 'ALLOCATION_EXCEEDS_BALANCE',
      message: 'Allocation exceeds the remaining amount of the bill.',
      requestId: 'req-1',
      isRetryable: false,
    });
    expect(error.details).toEqual([
      { path: 'allocations[0].amount', code: 'max', message: 'Maximum is 4500.00' },
    ]);
  });

  it('defaults details to an empty list', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, {
        error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'req-2' },
      }),
    );

    const error = await captureError(apiClient.get('/projects/1'));

    expect(error.details).toEqual([]);
  });

  it('never exposes a non-envelope body (e.g. proxy HTML) and keeps the request id header', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Bad Gateway</html>', {
        status: 502,
        headers: { 'X-Request-Id': 'req-3' },
      }),
    );

    const error = await captureError(apiClient.get('/projects'));

    expect(error).toMatchObject({
      status: 502,
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'req-3',
      isRetryable: true,
    });
    expect(error.message).not.toContain('html');
  });

  it.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'PERMISSION_DENIED'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [400, 'BAD_REQUEST'],
  ])('maps a bare %i to %s', async (status, code) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));

    const error = await captureError(apiClient.get('/x'));

    expect(error.code).toBe(code);
    expect(error.requestId).toBeNull();
  });

  it('wraps network failures as a retryable NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await captureError(apiClient.get('/x'));

    expect(error).toMatchObject({
      status: 0,
      code: ClientErrorCode.NETWORK_ERROR,
      isRetryable: true,
    });
  });

  it('rethrows the abort error untouched when the caller cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValue(abortError);

    await expect(apiClient.get('/x', { signal: controller.signal })).rejects.toBe(abortError);
  });

  it('reports a body that fails the schema as INVALID_RESPONSE', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { amount: 10.5 }, { 'X-Request-Id': 'req-4' }));

    const error = await captureError(
      apiClient.get('/x', { schema: z.object({ amount: z.string() }) }),
    );

    expect(error).toMatchObject({
      code: ClientErrorCode.INVALID_RESPONSE,
      requestId: 'req-4',
      isRetryable: false,
    });
  });
});
