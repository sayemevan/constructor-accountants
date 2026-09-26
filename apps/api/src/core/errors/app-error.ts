import type { ApiErrorDetail, ErrorCode } from '@repo/contracts';

/**
 * Base class for every expected error thrown by domain/application code. Carries no HTTP concepts: the global
 * exception filter maps each subclass to a status (20-error-handling.md).
 * `message` must be safe to show to end users: no internals, no data from other tenants.
 */
export abstract class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: readonly ApiErrorDetail[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}
