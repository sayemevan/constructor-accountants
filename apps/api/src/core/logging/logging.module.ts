import type { IncomingMessage, ServerResponse } from 'node:http';

import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import type { Options } from 'pino-http';

import { APP_CONFIG, type AppConfig } from '../config/index.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './request-id.js';

/**
 * Never logged in clear (21-logging-and-auditing.md). Request/response bodies are not logged at all; these paths
 * protect explicit context objects passed to the logger.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'token',
  'smtpPassword',
  'nationalId',
  '*.password',
  '*.newPassword',
  '*.token',
  '*.smtpPassword',
  '*.nationalId',
  '*.accountNumber',
];

const HEALTH_PATH_PREFIX = '/api/health';

function levelFor(res: ServerResponse, err: Error | undefined): 'error' | 'warn' | 'info' {
  if (err !== undefined || res.statusCode >= 500) return 'error';
  // 401/403/429 bursts matter for security monitoring.
  if (res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 429) return 'warn';
  return 'info';
}

/** Path without query string: query strings may carry tokens. */
function pathOf(url: string | undefined): string | undefined {
  return url?.split('?', 1)[0];
}

export function buildPinoHttpOptions(config: AppConfig): Options {
  const trustIncomingRequestId = config.trustProxy !== false;
  return {
    level: config.logLevel,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const id = resolveRequestId(req.headers['x-request-id'], trustIncomingRequestId);
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    // Every request-scoped line (access log and `PinoLogger` calls) carries a top-level `requestId`.
    customAttributeKeys: { reqId: 'requestId' },
    quietReqLogger: true,
    customLogLevel: (_req, res, err) => levelFor(res, err),
    // One access line per request: method, path, status, duration. No headers, no bodies.
    serializers: {
      req: (req: { method?: string; url?: string }) => ({
        method: req.method,
        path: pathOf(req.url),
      }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    },
    // Probes would drown the access log; failures are still visible through the probe itself.
    autoLogging: { ignore: (req) => pathOf(req.url)?.startsWith(HEALTH_PATH_PREFIX) === true },
    ...(config.nodeEnv === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
        }
      : {}),
  };
}

/** pino (JSON to stdout) with a per-request child logger carrying `requestId`. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({ pinoHttp: buildPinoHttpOptions(config) }),
    }),
  ],
})
export class LoggingModule {}
