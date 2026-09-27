import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TenantModule, TenantService, type Tenant } from '../../../modules/tenant/index.js';
import { compileWithDatabase } from '../../../testing/nest.js';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { makeTenantInput } from '../../../testing/tenant-factory.js';
import {
  AppTenantDatabase,
  TenantContext,
  TenantContextMissingError,
  TransactionRunner,
} from '../../tenancy/index.js';
import { NumberSequenceService, SequencesModule } from '../index.js';

/** number_sequences against real PostgreSQL, with two tenants (06 rule 12). */
describe('NumberSequenceService against PostgreSQL', () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let context: TenantContext;
  let sequences: NumberSequenceService;
  let runner: TransactionRunner;
  let tenantA: Tenant;
  let tenantB: Tenant;

  const as = <T>(tenant: Tenant, fn: () => Promise<T>) => context.run(tenant.id, fn);
  const next = (tenant: Tenant, key: string, prefix = 'PRJ-') =>
    as(tenant, () => sequences.next(key, { prefix }));

  beforeAll(async () => {
    database = await startTestDatabase();
    moduleRef = await compileWithDatabase(database, [SequencesModule, TenantModule], {
      DATABASE_POOL_SIZE: '20',
    });
    context = moduleRef.get(TenantContext);
    sequences = moduleRef.get(NumberSequenceService);
    runner = moduleRef.get(TransactionRunner);
    const tenants = moduleRef.get(TenantService);
    tenantA = await tenants.create(makeTenantInput());
    tenantB = await tenants.create(makeTenantInput());
  });

  afterAll(async () => {
    await moduleRef.close();
    await database.stop();
  });

  it('starts at 1 and increments, formatting the code with the prefix', async () => {
    expect(await next(tenantA, 'project')).toEqual({ value: 1n, code: 'PRJ-0001' });
    expect(await next(tenantA, 'project')).toEqual({ value: 2n, code: 'PRJ-0002' });
  });

  it('keeps the prefix stored when the sequence was created', async () => {
    await next(tenantA, 'invoice', 'INV-');
    expect((await next(tenantA, 'invoice', 'OTHER-')).code).toBe('INV-0002');
  });

  it('numbers each tenant independently', async () => {
    await next(tenantA, 'bill');
    await next(tenantA, 'bill');
    expect((await next(tenantB, 'bill')).value).toBe(1n);
    expect((await next(tenantA, 'bill')).value).toBe(3n);
  });

  it('never hands out the same number to parallel allocations', async () => {
    const results = await Promise.all(Array.from({ length: 50 }, () => next(tenantA, 'parallel')));
    const values = results.map((r) => Number(r.value)).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it("joins the caller's transaction: a rollback releases the number", async () => {
    await next(tenantB, 'rollback');
    await expect(
      as(tenantB, () =>
        runner.run(async () => {
          expect((await sequences.next('rollback', { prefix: 'R-' })).value).toBe(2n);
          throw new Error('use case failed');
        }),
      ),
    ).rejects.toThrow('use case failed');
    expect((await next(tenantB, 'rollback')).value).toBe(2n);
  });

  it('rejects invalid keys and runs only inside a tenant context', async () => {
    await expect(next(tenantA, 'Bad Key')).rejects.toBeInstanceOf(TypeError);
    await expect(sequences.next('project', { prefix: 'P-' })).rejects.toBeInstanceOf(
      TenantContextMissingError,
    );
  });

  it('shows a tenant only its own sequences (RLS), and denies DELETE to app_user', async () => {
    const keys = await as(tenantB, async () =>
      (
        await moduleRef.get(AppTenantDatabase).client.$queryRaw<
          { tenant_id: string }[]
        >`SELECT DISTINCT tenant_id::text FROM number_sequences`
      ).map((r) => r.tenant_id),
    );
    expect(keys).toEqual([tenantB.id]);
    await expect(database.exec('app_user', 'DELETE FROM number_sequences')).rejects.toThrow(
      /permission denied/,
    );
  });
});
