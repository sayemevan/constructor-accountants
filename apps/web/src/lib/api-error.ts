import { ApiErrorResponse, ErrorCode, type ApiErrorDetail } from '@repo/contracts';

/** Codes for failures that never produced an API error envelope (browser-side only). */
export const ClientErrorCode = {
  /** No response: offline, DNS, connection reset, CORS. */
  NETWORK_ERROR: 'NETWORK_ERROR',
  /** A 2xx response whose body is not JSON or does not match the expected schema (a contract bug). */
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

export interface ApiErrorInit {
  /** HTTP status; `0` when no response was received. */
  status: number;
  code: string;
  message: string;
  details?: readonly ApiErrorDetail[];
  requestId: string | null;
  cause?: unknown;
}

/** Typed error thrown by the API client for every failed request (ai-context/20-error-handling.md). */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  readonly code: string;
  readonly details: readonly ApiErrorDetail[];
  readonly requestId: string | null;

  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause });
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId;
  }

  /** Transient failures worth retrying automatically: no response, or a server/dependency error. */
  get isRetryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Builds an `ApiError` from a non-2xx response, preferring the API's error envelope. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  const parsed = ApiErrorResponse.safeParse(body);
  if (parsed.success) {
    const { code, message, details, requestId } = parsed.data.error;
    return new ApiError({
      status: response.status,
      code,
      message,
      details: details ?? [],
      requestId,
    });
  }
  // No envelope: the response came from the reverse proxy or the dev server, not the API. Never surface its body.
  return new ApiError({
    status: response.status,
    code: fallbackCode(response.status),
    message: fallbackMessage(response.status),
    requestId: response.headers.get('x-request-id'),
  });
}

function fallbackCode(status: number): string {
  if (status === 401) return ErrorCode.UNAUTHENTICATED;
  if (status === 403) return ErrorCode.PERMISSION_DENIED;
  if (status === 404) return ErrorCode.NOT_FOUND;
  if (status === 413) return ErrorCode.PAYLOAD_TOO_LARGE;
  if (status === 429) return ErrorCode.RATE_LIMITED;
  if (status === 502 || status === 503 || status === 504) return ErrorCode.SERVICE_UNAVAILABLE;
  if (status >= 500) return ErrorCode.INTERNAL_ERROR;
  return ErrorCode.BAD_REQUEST;
}

function fallbackMessage(status: number): string {
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server is temporarily unavailable. Please try again.';
  return 'The request could not be completed.';
}
