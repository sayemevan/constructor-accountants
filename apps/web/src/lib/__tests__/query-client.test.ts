import { describe, expect, it } from 'vitest';

import { ApiError } from '../api-error';
import { loginUrl, shouldRetryQuery } from '../query-client';

function apiError(status: number): ApiError {
  return new ApiError({ status, code: 'X', message: 'x', requestId: null });
}

describe('shouldRetryQuery', () => {
  it('never retries client errors', () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(shouldRetryQuery(0, apiError(status))).toBe(false);
    }
  });

  it('retries network and server errors a bounded number of times', () => {
    expect(shouldRetryQuery(0, apiError(0))).toBe(true);
    expect(shouldRetryQuery(1, apiError(503))).toBe(true);
    expect(shouldRetryQuery(2, apiError(503))).toBe(false);
  });
});

describe('loginUrl', () => {
  it('preserves the return URL', () => {
    expect(loginUrl('/projects?status=active')).toBe(
      '/login?returnTo=%2Fprojects%3Fstatus%3Dactive',
    );
  });
});
