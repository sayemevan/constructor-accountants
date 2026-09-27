import { randomUUID } from 'node:crypto';

import { Test, type TestingModule } from '@nestjs/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TenantModule, TenantService, type Tenant } from '../../../modules/tenant/index.js';
import { FixedClock } from '../../../testing/fixed-clock.js';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { makeTenantInput } from '../../../testing/tenant-factory.js';
import { makeTestConfig } from '../../../testing/test-config.js';
import { Clock, ClockModule } from '../../clock/index.js';
import { APP_CONFIG, ConfigModule } from '../../config/index.js';
import { DatabaseModule } from '../../database/index.js';
import {
  AppTenantDatabase,
  TenantContext,
  TenantContextMissingError,
  TransactionRunner,
} from '../../tenancy/index.js';
import { Outbox, OutboxModule } from '../index.js';

/** The outbox writer and the outbox_events table's protections, against real PostgreSQL. */
describe('Outbox against PostgreSQL', () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let context: TenantContext;
  let outbox: Outbox;
  let runner: TransactionRunner;
  let tenantA: Tenant;
  let tenantB: Tenant;
  const clock = new FixedClock('2026-03-01T10:00:00.000Z');

  const as = <T>(tenant: Tenant, fn: () => Promise<T>) => context.run(tenant.id, fn);
  const event = (aggregateId = randomUUID()) => ({
    type: 'ProjectCreated',
    aggregateType: 'project',
    aggregateId,
    data: { projectId: aggregateId },
  });
  const visibleEventIds = (tenant: Tenant) =>
    as(tenant, async () =>
      (
        await moduleRef.get(AppTenantDatabase).client.$queryRaw<
          { id: string }[]
        >`SELECT id::text FROM outbox_events`
      ).map((r) => r.id),
    );

  beforeAll(async () => {
    database = await startTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ClockModule, DatabaseModule, OutboxModule, TenantModule],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(makeTestConfig({ DATABASE_URL: database.url('app_user') }))
      .overrideProvider(Clock)
      .useValue(clock)
      .compile();
    context = moduleRef.get(TenantContext);
    outbox = moduleRef.get(Outbox);
    runner = moduleRef.get(TransactionRunner);
    const tenants = moduleRef.get(TenantService);
    tenantA = await tenants.create(makeTenantInput());
    tenantB = await tenants.create(makeTenantInput());
  });

  afterAll(async () => {
    await moduleRef.close();
    await database.stop();
  });

  it('writes the event with tenant, time and version from context', async () => {
    const aggregateId = randomUUID();
    const eventId = await as(tenantA, () => outbox.add(event(aggregateId)));
    const [row] = await database.query(
      'postgres', // FORCE RLS applies to the table owner too; the superuser inspects
      `SELECT tenant_id::text, event_type, aggregate_id::text, payload, schema_version, occurred_at,
              processed_at, attempts FROM outbox_events WHERE id = $1`,
      [eventId],
    );
    expect(row).toEqual({
      tenant_id: tenantA.id,
      event_type: 'ProjectCreated',
      aggregate_id: aggregateId,
      payload: { projectId: aggregateId },
      schema_version: 1,
      occurred_at: new Date('2026-03-01T10:00:00.000Z'),
      processed_at: null,
      attempts: 0,
    });
    expect(eventId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('commits the event with the use case, and rolls it back with it', async () => {
    const committed = await as(tenantB, () => runner.run(async () => outbox.add(event())));
    let rolledBack = '';
    await expect(
      as(tenantB, () =>
        runner.run(async () => {
          rolledBack = await outbox.add(event());
          throw new Error('use case failed');
        }),
      ),
    ).rejects.toThrow('use case failed');
    const ids = await visibleEventIds(tenantB);
    expect(ids).toContain(committed);
    expect(ids).not.toContain(rolledBack);
  });

  it('validates the event before writing and needs a tenant context', async () => {
    await expect(
      as(tenantA, () => outbox.add({ ...event(), type: 'project.created' })),
    ).rejects.toBeInstanceOf(TypeError);
    await expect(outbox.add(event())).rejects.toBeInstanceOf(TenantContextMissingError);
  });

  describe('database protections', () => {
    it('shows a tenant only its own events', async () => {
      const a = await as(tenantA, () => outbox.add(event()));
      expect(await visibleEventIds(tenantB)).not.toContain(a);
      expect(await visibleEventIds(tenantA)).toContain(a);
    });

    it('lets app_user change only the dispatch columns, never delete', async () => {
      await expect(
        database.exec('app_user', `UPDATE outbox_events SET payload = '{}'::jsonb`),
      ).rejects.toThrow(/permission denied/);
      await expect(database.exec('app_user', 'DELETE FROM outbox_events')).rejects.toThrow(
        /permission denied/,
      );
    });

    it('opens every tenant to the dispatcher flag for SELECT, but never for INSERT', async () => {
      const a = await as(tenantA, () => outbox.add(event()));
      const b = await as(tenantB, () => outbox.add(event()));
      expect(await database.query('app_user', 'SELECT id FROM outbox_events')).toEqual([]);
      const rows = await withDispatcherFlag(`SELECT id::text FROM outbox_events`);
      expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([a, b]));
      await expect(
        withDispatcherFlag(
          `INSERT INTO outbox_events (id, tenant_id, event_type, aggregate_type, aggregate_id, payload)
           VALUES (gen_random_uuid(), '${tenantA.id}', 'ProjectCreated', 'project', gen_random_uuid(), '{}')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  /** Runs `sql` as app_user in a transaction with the dispatcher flag set, like OutboxDispatcher. */
  async function withDispatcherFlag(sql: string): Promise<{ id: string }[]> {
    const client = new pg.Client({ connectionString: database.url('app_user') });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.outbox_dispatcher', 'on', true)`);
      const { rows } = await client.query<{ id: string }>(sql);
      await client.query('ROLLBACK');
      return rows;
    } finally {
      await client.end();
    }
  }
});
