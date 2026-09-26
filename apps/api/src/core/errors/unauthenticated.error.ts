import type { ErrorCode } from '@repo/contracts';

import { AppError } from './app-error.js';

type UnauthenticatedCode = Extract<
  ErrorCode,
  'UNAUTHENTICATED' | 'SESSION_EXPIRED' | 'INVALID_CREDENTIALS'
>;

/** 401 — no/invalid/expired session, or bad login. Never reveal whether an account exists. */
export class UnauthenticatedError extends AppError {
  constructor(
    code: UnauthenticatedCode = 'UNAUTHENTICATED',
    message = 'Authentication is required.',
  ) {
    super(code, message);
  }
}
