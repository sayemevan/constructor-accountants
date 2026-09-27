import { describe, expect, it } from 'vitest';

import { ApiError, ClientErrorCode } from '../api-error';
import { describeError } from '../describe-error';

describe('describeError', () => {
  it('shows access denied for 403 without retry', () => {
    const error = new ApiError({
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'm',
      requestId: 'r1',
    });
    expect(describeError(error)).toMatchObject({
      title: "You don't have access",
      retryable: false,
      reference: 'r1',
    });
  });

  it('shows not found for 404 without retry', () => {
    const error = new ApiError({ status: 404, code: 'NOT_FOUND', message: 'm', requestId: 'r2' });
    expect(describeError(error)).toMatchObject({ title: 'Not found', retryable: false });
  });

  it('uses the API message and request id for server errors', () => {
    const error = new ApiError({
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Down.',
      requestId: 'r3',
    });
    expect(describeError(error)).toEqual({
      title: 'Something went wrong',
      message: 'Down.',
      reference: 'r3',
      retryable: true,
    });
  });

  it('describes network failures as offline', () => {
    const error = new ApiError({
      status: 0,
      code: ClientErrorCode.NETWORK_ERROR,
      message: 'm',
      requestId: null,
    });
    expect(describeError(error)).toMatchObject({ title: "You're offline", retryable: true });
  });

  it('never exposes the message of unknown errors, but keeps the Next.js digest', () => {
    const error = Object.assign(new Error('SELECT * FROM secrets'), { digest: 'abc123' });
    const description = describeError(error);
    expect(description.message).not.toContain('SELECT');
    expect(description.reference).toBe('abc123');
  });
});
