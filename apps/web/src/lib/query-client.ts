import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isApiError } from './api-error';

const MAX_QUERY_RETRIES = 2;

/** Retry only transient failures; a 4xx will not change on retry. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && !error.isRetryable) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/** Login URL that brings the user back to where the session expired. */
export function loginUrl(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function handleGlobalError(error: unknown): void {
  if (!isApiError(error) || error.status !== 401) return;
  const { pathname, search } = window.location;
  if (pathname === '/login') return;
  window.location.assign(loginUrl(`${pathname}${search}`));
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleGlobalError }),
    mutationCache: new MutationCache({ onError: handleGlobalError }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetryQuery },
      // Mutations are retried explicitly by the user (with the same idempotency key), never automatically.
      mutations: { retry: false },
    },
  });
}
