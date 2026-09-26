import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type { ApiErrorResponse } from '@repo/contracts';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { type AppConfig, loadConfig } from '../../config/index.js';
import { BusinessRuleError } from '../business-rule.error.js';
import { ConflictError } from '../conflict.error.js';
import { ForbiddenError } from '../forbidden.error.js';
import { GlobalExceptionFilter } from '../global-exception.filter.js';
import { NotFoundError } from '../not-found.error.js';

const REQUEST_ID = '01JB0000000000000000000000';

function makeConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'development',
    DEPLOYMENT_MODE: 'saas',
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://app_user:app_user@localhost:5432/construction_erp',
    ...overrides,
  });
}

function makeLogger() {
  return { setContext: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() };
}

/** Runs the filter against a fake Express request/response and returns what was sent. */
function run(
  exception: unknown,
  options: { config?: AppConfig; requestId?: string | undefined } = {},
) {
  const logger = makeLogger();
  const filter = new GlobalExceptionFilter(
    options.config ?? makeConfig(),
    logger as unknown as PinoLogger,
  );
  const headers = new Map<string, string>();
  const sent: { status?: number; body?: ApiErrorResponse } = {};
  const res = {
    headersSent: false,
    setHeader: (name: string, value: string) => headers.set(name, value),
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: ApiErrorResponse) {
      sent.body = body;
      return this;
    },
  };
  const req = { id: 'requestId' in options ? options.requestId : REQUEST_ID };
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;

  filter.catch(exception, host);
  return { status: sent.status, body: sent.body, headers, logger };
}

describe('GlobalExceptionFilter', () => {
  it('maps typed application errors to their status with the standard envelope', () => {
    const cases = [
      { error: new ForbiddenError(), status: 403, code: 'PERMISSION_DENIED' },
      { error: new NotFoundError(), status: 404, code: 'NOT_FOUND' },
      {
        error: new ConflictError('VERSION_CONFLICT', 'This record changed.'),
        status: 409,
        code: 'VERSION_CONFLICT',
      },
      { error: new BusinessRuleError('CONFLICT', 'Rule violated.'), status: 422, code: 'CONFLICT' },
    ];
    for (const { error, status, code } of cases) {
      const result = run(error);
      expect(result.status).toBe(status);
      expect(result.body).toEqual({
        error: { code, message: error.message, requestId: REQUEST_ID },
      });
    }
  });

  it('includes rule details for business rule errors', () => {
    const details = [{ path: 'allocations[0].amount', code: 'max', message: 'Maximum is 4500.00' }];
    const { body } = run(
      new BusinessRuleError('CONFLICT', 'Allocation exceeds the remaining amount.', details),
    );
    expect(body?.error.details).toEqual(details);
  });

  it('maps Zod errors to 400 VALIDATION_FAILED with API field paths', () => {
    const schema = z.object({ allocations: z.array(z.object({ amount: z.string().min(1) })) });
    const parsed = schema.safeParse({ allocations: [{ amount: '' }] });
    if (parsed.success) throw new Error('expected validation to fail');

    const { status, body } = run(parsed.error);

    expect(status).toBe(400);
    expect(body?.error.code).toBe('VALIDATION_FAILED');
    expect(body?.error.details).toEqual([
      { path: 'allocations[0].amount', code: 'too_small', message: expect.any(String) as string },
    ]);
  });

  it('hides internals of unexpected errors and logs them at error level', () => {
    const bug = new Error('column "secret_col" does not exist at /app/dist/x.js');

    const { status, body, logger } = run(bug);

    expect(status).toBe(500);
    expect(body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        requestId: REQUEST_ID,
      },
    });
    expect(JSON.stringify(body)).not.toContain('secret_col');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: bug, status: 500, code: 'INTERNAL_ERROR' }),
      'request failed',
    );
  });

  it('exposes the internal message only when EXPOSE_ERROR_DETAILS is enabled in development', () => {
    const config = makeConfig({ EXPOSE_ERROR_DETAILS: 'true' });

    const { body } = run(new TypeError('boom'), { config });

    expect(body?.error.details).toEqual([{ code: 'DEBUG', message: 'TypeError: boom' }]);
  });

  it('maps Prisma unique violations to 409 DUPLICATE_VALUE without leaking tenant columns or constraint names', () => {
    const byFields = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: ['tenant_id', 'code'] },
    });
    const byConstraint = Object.assign(new Error('Unique constraint failed'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
      meta: { target: 'parties_tenant_id_code_key' },
    });

    const fields = run(byFields);
    const constraint = run(byConstraint);

    expect(fields.status).toBe(409);
    expect(fields.body?.error.code).toBe('DUPLICATE_VALUE');
    expect(fields.body?.error.details).toEqual([
      { path: 'code', code: 'duplicate', message: 'This value is already in use.' },
    ]);
    expect(JSON.stringify(constraint.body)).not.toContain('parties_tenant_id_code_key');
  });

  it('maps framework HTTP exceptions (unknown route) to a generic code', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /api/nope'));

    expect(status).toBe(404);
    expect(body?.error).toEqual({
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
      requestId: REQUEST_ID,
    });
  });

  it('generates a request id and header when none was assigned', () => {
    const { body, headers } = run(new NotFoundError(), { requestId: undefined });

    expect(body?.error.requestId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(headers.get('X-Request-Id')).toBe(body?.error.requestId);
  });
});
