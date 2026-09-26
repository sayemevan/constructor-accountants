import { AppError } from './app-error.js';

/**
 * 422 — a well-formed request that violates a domain rule. Use a specific code, e.g. `BOOKS_LOCKED`:
 * `new BusinessRuleError('BOOKS_LOCKED', 'Books are locked until 2026-06-30.')`.
 */
export class BusinessRuleError extends AppError {}
