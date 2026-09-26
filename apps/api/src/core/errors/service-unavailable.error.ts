import type { ApiErrorDetail } from '@repo/contracts';

import { AppError } from './app-error.js';

/** 503 — a dependency (database, storage, SMTP) is down. Retryable. */
export class ServiceUnavailableError extends AppError {
  constructor(
    message = 'The service is temporarily unavailable. Please try again.',
    details?: readonly ApiErrorDetail[],
  ) {
    super('SERVICE_UNAVAILABLE', message, details);
  }
}
