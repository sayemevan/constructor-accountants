import { HttpException } from '@nestjs/common';
import type { ApiErrorDetail, ErrorCode } from '@repo/contracts';
import { ZodError } from 'zod';

import { AppError } from './app-error.js';
import { BusinessRuleError } from './business-rule.error.js';
import { ConflictError } from './conflict.error.js';
import { ForbiddenError } from './forbidden.error.js';
import { NotFoundError } from './not-found.error.js';
import { ServiceUnavailableError } from './service-unavailable.error.js';
import { UnauthenticatedError } from './unauthenticated.error.js';

/** Everything the filter needs to answer and log one failed request. */
export interface MappedError {
  readonly status: number;
  readonly code: ErrorCode | (string & {});
  readonly message: string;
  readonly details?: readonly ApiErrorDetail[] | undefined;
  /** True when the error is a bug or an outage (5xx): logged at `error` with its stack. */
  readonly unexpected: boolean;
}

const INTERNAL_MESSAGE = 'An unexpected error occurred.';
const UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable. Please try again.';

/** Prisma connection-level error codes: the database is unreachable or dropped the connection. */
const PRISMA_CONNECTION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

/** Fields never reported back in duplicate-value details: they are internal, not user input. */
const HIDDEN_FIELDS = new Set(['tenant_id', 'tenantId', 'id']);

export function mapException(exception: unknown): MappedError {
  if (exception instanceof AppError) return fromAppError(exception);
  if (exception instanceof ZodError) return fromZodError(exception);

  const prisma = asPrismaError(exception);
  if (prisma !== undefined) return fromPrismaError(prisma);

  if (exception instanceof HttpException) return fromStatus(exception.getStatus());

  const bodyParserStatus = bodyParserErrorStatus(exception);
  if (bodyParserStatus !== undefined) return fromStatus(bodyParserStatus);

  return internal();
}

function fromAppError(error: AppError): MappedError {
  const base = {
    code: error.code,
    message: error.message,
    details: error.details,
    unexpected: false,
  };
  if (error instanceof UnauthenticatedError) return { ...base, status: 401 };
  if (error instanceof ForbiddenError) return { ...base, status: 403 };
  if (error instanceof NotFoundError) return { ...base, status: 404 };
  if (error instanceof ConflictError) return { ...base, status: 409 };
  if (error instanceof BusinessRuleError) return { ...base, status: 422 };
  if (error instanceof ServiceUnavailableError) return { ...base, status: 503, unexpected: true };
  // A new AppError subclass without a mapping is a bug: fail closed.
  return internal();
}

function fromZodError(error: ZodError): MappedError {
  return {
    status: 400,
    code: 'VALIDATION_FAILED',
    message: 'The request is invalid.',
    details: error.issues.map((issue) => ({
      path: formatPath(issue.path),
      code: issue.code,
      message: issue.message,
    })),
    unexpected: false,
  };
}

/** `['allocations', 0, 'amount']` → `allocations[0].amount` */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${String(key)}]`;
    const name = String(key);
    return acc === '' ? name : `${acc}.${name}`;
  }, '');
}

interface PrismaLikeError {
  readonly name: string;
  readonly code?: string | undefined;
  readonly meta?: Record<string, unknown> | undefined;
}

/**
 * Prisma errors are recognised by shape rather than `instanceof`: the generated client owns the classes, and
 * this keeps the filter independent of it.
 */
function asPrismaError(exception: unknown): PrismaLikeError | undefined {
  if (!(exception instanceof Error) || !exception.name.startsWith('PrismaClient')) return undefined;
  const candidate = exception as Error & { code?: unknown; meta?: unknown };
  return {
    name: candidate.name,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    meta: isRecord(candidate.meta) ? candidate.meta : undefined,
  };
}

function fromPrismaError(error: PrismaLikeError): MappedError {
  if (
    error.name === 'PrismaClientInitializationError' ||
    PRISMA_CONNECTION_CODES.has(error.code ?? '')
  ) {
    return {
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: UNAVAILABLE_MESSAGE,
      unexpected: true,
    };
  }
  switch (error.code) {
    case 'P2002':
      return {
        status: 409,
        code: 'DUPLICATE_VALUE',
        message: 'A record with the same value already exists.',
        details: duplicateFields(error.meta).map((path) => ({
          path,
          code: 'duplicate',
          message: 'This value is already in use.',
        })),
        unexpected: false,
      };
    case 'P2025':
      return {
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        unexpected: false,
      };
    case 'P2003':
      return {
        status: 409,
        code: 'CONFLICT',
        message: 'The record references, or is referenced by, another record.',
        unexpected: false,
      };
    case 'P2034':
      // TransactionRunner retries serialization failures once before this surfaces.
      return {
        status: 409,
        code: 'CONFLICT',
        message: 'The record was changed by another request. Please try again.',
        unexpected: false,
      };
    default:
      return internal();
  }
}

/**
 * Field names from a unique violation. Only arrays of field names are used; a string `target` is a constraint
 * name, which is never exposed.
 */
function duplicateFields(meta: Record<string, unknown> | undefined): string[] {
  const target = meta?.target;
  if (!Array.isArray(target)) return [];
  return target.filter(
    (field): field is string => typeof field === 'string' && !HIDDEN_FIELDS.has(field),
  );
}

/**
 * Status of an Express body-parser error (e.g. body too large) that reaches the filter unwrapped.
 * Nest itself converts malformed JSON into a `BadRequestException`.
 */
function bodyParserErrorStatus(exception: unknown): number | undefined {
  if (!(exception instanceof Error)) return undefined;
  const candidate = exception as Error & { status?: unknown; type?: unknown };
  if (typeof candidate.status !== 'number' || typeof candidate.type !== 'string') return undefined;
  return candidate.status >= 400 && candidate.status < 500 ? candidate.status : undefined;
}

/** Framework-level errors (unknown route, bad JSON, …) carry only a status; answer with a generic code. */
function fromStatus(status: number): MappedError {
  const generic = (code: ErrorCode, message: string): MappedError => ({
    status,
    code,
    message,
    unexpected: false,
  });
  switch (status) {
    case 400:
      return generic('BAD_REQUEST', 'The request is malformed.');
    case 401:
      return generic('UNAUTHENTICATED', 'Authentication is required.');
    case 403:
      return generic('PERMISSION_DENIED', 'You do not have permission to perform this action.');
    case 404:
    case 405:
      return { ...generic('NOT_FOUND', 'The requested resource was not found.'), status: 404 };
    case 409:
      return generic('CONFLICT', 'The request conflicts with the current state of the resource.');
    case 413:
      return generic('PAYLOAD_TOO_LARGE', 'The request body is too large.');
    case 429:
      return generic('RATE_LIMITED', 'Too many requests. Please try again later.');
    case 503:
      return { ...generic('SERVICE_UNAVAILABLE', UNAVAILABLE_MESSAGE), unexpected: true };
    default:
      return status >= 400 && status < 500
        ? generic('BAD_REQUEST', 'The request could not be processed.')
        : internal();
  }
}

function internal(): MappedError {
  return { status: 500, code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE, unexpected: true };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
