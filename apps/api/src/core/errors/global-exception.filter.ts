import { type ArgumentsHost, Catch, type ExceptionFilter, Inject } from '@nestjs/common';
import type { ApiErrorResponse } from '@repo/contracts';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { APP_CONFIG, type AppConfig } from '../config/index.js';
import { REQUEST_ID_HEADER, resolveRequestId } from '../logging/index.js';
import { type MappedError, mapException } from './map-exception.js';

/**
 * Turns every error escaping a controller, guard, pipe or interceptor into the standard error envelope
 * (20-error-handling.md). Registered globally via APP_FILTER. Controllers never catch errors themselves.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Worker/CLI contexts handle their own failures; nothing to answer here.
      throw exception;
    }
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: unknown }>();
    const res = http.getResponse<Response>();

    const mapped = mapException(exception);
    const assignedId = typeof req.id === 'string' && req.id !== '' ? req.id : undefined;
    const requestId = assignedId ?? this.assignRequestId(res);
    // Request-scoped log lines already carry pino-http's `requestId`; add it only when this filter made one up.
    this.log(mapped, exception, assignedId === undefined ? { requestId } : {});

    if (res.headersSent) {
      // Streaming responses can fail midway; the status is already on the wire.
      res.end();
      return;
    }

    const details = this.responseDetails(mapped, exception);
    const body: ApiErrorResponse = {
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(details !== undefined && details.length > 0 ? { details: [...details] } : {}),
        requestId,
      },
    };
    res.status(mapped.status).json(body);
  }

  /** Errors raised before pino-http ran (e.g. body parsing) have no id yet. */
  private assignRequestId(res: Response): string {
    const id = resolveRequestId(undefined, false);
    if (!res.headersSent) res.setHeader(REQUEST_ID_HEADER, id);
    return id;
  }

  private responseDetails(mapped: MappedError, exception: unknown): MappedError['details'] {
    if (mapped.status !== 500 || !this.config.exposeErrorDetails || !(exception instanceof Error)) {
      return mapped.details;
    }
    // Local development only (config forbids it elsewhere).
    return [{ code: 'DEBUG', message: `${exception.name}: ${exception.message}` }];
  }

  private log(mapped: MappedError, exception: unknown, extra: { requestId?: string }): void {
    const context = { ...extra, status: mapped.status, code: mapped.code };
    if (mapped.unexpected) {
      this.logger.error({ ...context, err: exception }, 'request failed');
    } else if (mapped.status === 401 || mapped.status === 403) {
      this.logger.warn({ ...context, security: true }, 'request rejected');
    } else {
      this.logger.info(context, 'request rejected');
    }
  }
}
