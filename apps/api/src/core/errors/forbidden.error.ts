import { AppError } from './app-error.js';

/** 403 — authenticated but lacks the permission code. Scope/tenant misses are {@link NotFoundError}, not this. */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super('PERMISSION_DENIED', message);
  }
}
