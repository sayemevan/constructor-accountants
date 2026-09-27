import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { makeTestConfig } from '../../../testing/test-config.js';
import { APP_CONFIG, ConfigModule } from '../../config/index.js';
import { PlatformDatabase, PlatformDatabaseModule } from '../../platform-database/index.js';
import {
  AppTenantDatabase,
  TenantContext,
  TenantContextMissingError,
  TransactionRunner,
} from '../../tenancy/index.js';
import { DatabaseModule } from '../database.module.js';

/** The spike's tenant-owned sample tables (RLS + default tenant_id); real tables arrive in session 2. */
const SPIKE_SQL = join(
  import.meta.dirname,
  '..',
  '..',
  'tenancy',
  '__tests__',
  'spike',
  'spike.sql',
);

/**
 * Step 8a wiring against real PostgreSQL: the providers Nest resolves (app_user through AppTenantDatabase,
 * app_platform through PlatformDatabase) keep the isolation proven by the tenancy spike.
 */
describe('DatabaseModule + PlatformDatabaseModule against PostgreSQL', () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let context: TenantContext;
  let tenantDb: AppTenantDatabase;
  let runner: TransactionRunner;
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  const asTenant = <T>(tenantId: string, fn: () => Promise<T>) => context.run(tenantId, fn);
  const projectNames = async () =>
    (
      await tenantDb.client.$queryRaw<
        { name: string }[]
      >`SELECT name FROM spike_projects ORDER BY name`
    ).map((row) => row.name);
  const insertProject = (name: string) =>
    tenantDb.client
      .$executeRaw`INSERT INTO spike_projects (id, name) VALUES (${randomUUID()}::uuid, ${name})`;

  beforeAll(async () => {
    database = await startTestDatabase();
    await database.exec('app_owner', await readFile(SPIKE_SQL, 'utf8'));
    await database.query(
      'app_platform',
      `INSERT INTO spike_tenants (id, name) VALUES ($1, 'Tenant A'), ($2, 'Tenant B')`,
      [tenantA, tenantB],
    );

    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, PlatformDatabaseModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(
        makeTestConfig({
          DATABASE_URL: database.url('app_user'),
          DATABASE_PLATFORM_URL: database.url('app_platform'),
          DATABASE_POOL_SIZE: '4',
        }),
      )
      .compile();
    context = moduleRef.get(TenantContext);
    tenantDb = moduleRef.get(AppTenantDatabase);
    runner = moduleRef.get(TransactionRunner);

    await asTenant(tenantA, () => insertProject('A tower'));
    await asTenant(tenantB, () => insertProject('B villa'));
  });

  afterAll(async () => {
    await moduleRef.close();
    await database.stop();
  });

  it("scopes the provider-resolved client to the context's tenant", async () => {
    expect(await asTenant(tenantA, projectNames)).toEqual(['A tower']);
    expect(await asTenant(tenantB, projectNames)).toEqual(['B villa']);
  });

  it('refuses to query without a tenant context', async () => {
    await expect(projectNames()).rejects.toBeInstanceOf(TenantContextMissingError);
    await expect(runner.run(() => Promise.resolve())).rejects.toBeInstanceOf(
      TenantContextMissingError,
    );
  });

  it('runs a use case in one transaction; nested runs join it and see its writes', async () => {
    const seen = await asTenant(tenantA, () =>
      runner.run(async (tx) => {
        await tx.$executeRaw`INSERT INTO spike_projects (id, name) VALUES (${randomUUID()}::uuid, 'A depot')`;
        const [outer] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
        return runner.run(async () => {
          const [inner] = await tenantDb.client.$queryRaw<
            { pid: number }[]
          >`SELECT pg_backend_pid() AS pid`;
          return { samePid: inner?.pid === outer?.pid, names: await projectNames() };
        });
      }),
    );
    expect(seen).toEqual({ samePid: true, names: ['A depot', 'A tower'] });
    expect(await asTenant(tenantB, projectNames)).toEqual(['B villa']);
  });

  it('rolls the whole use case back when it fails', async () => {
    const failure = new Error('business rule failed');
    await expect(
      asTenant(tenantB, () =>
        runner.run(async () => {
          await insertProject('B annex');
          throw failure;
        }),
      ),
    ).rejects.toBe(failure);
    expect(await asTenant(tenantB, projectNames)).toEqual(['B villa']);
  });

  it('gives the platform client (BYPASSRLS) every tenant, without a tenant context', async () => {
    const platform = moduleRef.get(PlatformDatabase);
    const rows = await platform.client.$queryRaw<{ tenant_id: string; name: string }[]>`
      SELECT tenant_id::text, name FROM spike_projects ORDER BY name`;
    expect(rows).toEqual([
      { tenant_id: tenantA, name: 'A depot' },
      { tenant_id: tenantA, name: 'A tower' },
      { tenant_id: tenantB, name: 'B villa' },
    ]);
  });
});
