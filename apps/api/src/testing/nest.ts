import type { ModuleMetadata } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { APP_CONFIG, ConfigModule } from '../core/config/index.js';
import { DatabaseModule } from '../core/database/index.js';
import type { TestDatabase } from './postgres.js';
import { makeTestConfig } from './test-config.js';

/**
 * Compiles a Nest testing module for integration tests: config + the runtime database (`app_user`) of the given test
 * PostgreSQL, plus the modules under test. Lives here so module tests never import `core/database` themselves
 * (dependency-cruiser `modules-no-base-prisma`). Test-only.
 */
export function compileWithDatabase(
  database: TestDatabase,
  imports: NonNullable<ModuleMetadata['imports']>,
  config: Record<string, string> = {},
): Promise<TestingModule> {
  return Test.createTestingModule({ imports: [ConfigModule, DatabaseModule, ...imports] })
    .overrideProvider(APP_CONFIG)
    .useValue(makeTestConfig({ DATABASE_URL: database.url('app_user'), ...config }))
    .compile();
}
