import { type AppConfig, loadConfig } from '../core/config/index.js';

/** A valid {@link AppConfig} for tests; `overrides` are raw environment variables. Test-only. */
export function makeTestConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DEPLOYMENT_MODE: 'saas',
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: 'postgresql://app_user:app_user@localhost:5432/construction_erp',
    ...overrides,
  });
}
