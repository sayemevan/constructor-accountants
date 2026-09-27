import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { RLS_GAPS_SQL, type RlsGap } from '../rls-coverage.js';

/**
 * The permanent DB meta-test (06 "Mandatory tests", ADR-0005 Compliance): on the real migrated schema, every table
 * with a `tenant_id` column has RLS enabled AND forced AND a policy. A new tenant-owned table whose migration forgets
 * any of the three fails here.
 */
describe('RLS coverage of the migrated schema', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await startTestDatabase();
  });

  afterAll(async () => {
    await database.stop();
  });

  it('checks the real tenant-owned tables (the test is not vacuous)', async () => {
    const tables = await database.query<{ table: string }>(
      'app_owner',
      `SELECT DISTINCT c.relname AS "table"
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
         AND a.attname = 'tenant_id' AND NOT a.attisdropped`,
    );
    expect(tables.map((t) => t.table)).toContain('tenant_settings');
  });

  it('finds no tenant-owned table without RLS enabled, forced and a policy', async () => {
    expect(
      await database.query<RlsGap & Record<string, unknown>>('app_owner', RLS_GAPS_SQL),
    ).toEqual([]);
  });
});
