import type { ApiErrorDetail, ErrorCode } from '@repo/contracts';

import { AppError } from './app-error.js';

type ConflictCode = Extract<
  ErrorCode,
  | 'CONFLICT'
  | 'VERSION_CONFLICT'
  | 'DUPLICATE_VALUE'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'REQUEST_IN_PROGRESS'
>;

/** 409 — uniqueness, optimistic locking, idempotency. */
export class ConflictError extends AppError {
  constructor(
    code: ConflictCode,
    message = 'The request conflicts with the current state of the resource.',
    details?: readonly ApiErrorDetail[],
  ) {
    super(code, message, details);
  }
}
