import { ulid } from 'ulid';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Accept forwarded ids only in a conservative shape: they end up in logs and response headers.
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

/**
 * Correlation id for a request (21-logging-and-auditing.md): reuse the `X-Request-Id` set by a trusted proxy,
 * otherwise generate a ULID.
 */
export function resolveRequestId(
  incoming: string | string[] | undefined,
  trustIncoming: boolean,
): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  if (trustIncoming && candidate !== undefined && SAFE_REQUEST_ID.test(candidate)) {
    return candidate;
  }
  return ulid();
}
