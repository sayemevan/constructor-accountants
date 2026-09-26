import type { ErrorCode } from '@repo/contracts';

import { AppError } from './app-error.js';

/** 404 — missing, owned by another tenant, or outside the caller's assigned projects (indistinguishable on purpose). */
export class NotFoundError extends AppError {
  constructor(message = 'The requested resource was not found.', code: ErrorCode = 'NOT_FOUND') {
    super(code, message);
  }
}
