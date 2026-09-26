import { z } from 'zod';

/**
 * Stable, machine-readable API error codes (ai-context/20-error-handling.md).
 * Adding a code = add it here + document it in the owning module's context file.
 */
export const ErrorCode = {
  // 400
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  BAD_REQUEST: 'BAD_REQUEST',
  // 401
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // 403
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  // 404
  NOT_FOUND: 'NOT_FOUND',
  // 409
  CONFLICT: 'CONFLICT',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  DUPLICATE_VALUE: 'DUPLICATE_VALUE',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  REQUEST_IN_PROGRESS: 'REQUEST_IN_PROGRESS',
  // 413 / 415
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  // 429
  RATE_LIMITED: 'RATE_LIMITED',
  // 5xx
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ApiErrorDetail = z.object({
  /** API path of the offending field, e.g. `allocations[0].amount`. */
  path: z.string().optional(),
  code: z.string(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetail>;

/** Body of every non-2xx API response. */
export const ApiErrorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(ApiErrorDetail).optional(),
    requestId: z.string(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>;
