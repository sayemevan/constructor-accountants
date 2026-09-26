import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const DEFAULT_PORT = 3001;
const DEFAULT_DB_POOL_SIZE = 10;

/**
 * Express `trust proxy`: `true`/`false`, a hop count, or a comma-separated list of addresses/subnets.
 * Must be set behind a reverse proxy so client IPs and forwarded request ids are trusted (17).
 */
const trustProxy = z
  .string()
  .trim()
  .default('false')
  .transform((value): boolean | number | string => {
    if (value === 'true') return true;
    if (value === 'false' || value === '') return false;
    if (/^\d+$/.test(value)) return Number(value);
    return value;
  });

const postgresUrl = z
  .url({ protocol: /^postgres(ql)?$/ })
  .describe('postgresql://user:password@host:port/database');

/** Environment variables read by the API, worker and CLI. Extend as features need more (17 lists the full set). */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DEPLOYMENT_MODE: z.enum(['saas', 'self_hosted']),
    APP_BASE_URL: z.url({ protocol: /^https?$/ }),
    PORT: z.coerce.number().int().min(1).max(65_535).default(DEFAULT_PORT),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
    TRUST_PROXY: trustProxy,
    EXPOSE_ERROR_DETAILS: z.stringbool().default(false),
    DATABASE_URL: postgresUrl,
    DATABASE_MIGRATION_URL: postgresUrl.optional(),
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(DEFAULT_DB_POOL_SIZE),
  })
  .refine((env) => !(env.EXPOSE_ERROR_DETAILS && env.NODE_ENV !== 'development'), {
    path: ['EXPOSE_ERROR_DETAILS'],
    message: 'may only be enabled when NODE_ENV=development',
  });

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly deploymentMode: 'saas' | 'self_hosted';
  readonly appBaseUrl: string;
  readonly port: number;
  readonly logLevel: LogLevel;
  readonly trustProxy: boolean | number | string;
  /** Local development only: include internal error messages in 500 responses. */
  readonly exposeErrorDetails: boolean;
  readonly database: {
    /** Runtime role (`app_user`): DML only, subject to RLS. */
    readonly url: string;
    /** Owner role (`app_owner`): migrations only. Required by `cli.js migrate`, unused by the API. */
    readonly migrationUrl: string | undefined;
    readonly poolSize: number;
  };
}

/** Injection token for {@link AppConfig}. */
export const APP_CONFIG = Symbol('APP_CONFIG');

export class ConfigValidationError extends Error {
  override readonly name = 'ConfigValidationError';
}

/**
 * Validates the environment and returns a typed, frozen config. Throws on the first boot with a list of every
 * invalid variable (names and reasons only — values are never echoed, they may be secrets).
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`,
    );
    throw new ConfigValidationError(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  const e = result.data;
  return Object.freeze({
    nodeEnv: e.NODE_ENV,
    deploymentMode: e.DEPLOYMENT_MODE,
    appBaseUrl: e.APP_BASE_URL,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    trustProxy: e.TRUST_PROXY,
    exposeErrorDetails: e.EXPOSE_ERROR_DETAILS,
    database: Object.freeze({
      url: e.DATABASE_URL,
      migrationUrl: e.DATABASE_MIGRATION_URL,
      poolSize: e.DATABASE_POOL_SIZE,
    }),
  });
}
