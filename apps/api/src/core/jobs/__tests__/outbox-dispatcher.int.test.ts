import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { TenantModule, TenantService, type Tenant } from '../../../modules/tenant/index.js';
import { compileWithDatabase } from '../../../testing/nest.js';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { makeTenantInput } from '../../../testing/tenant-factory.js';
import { APP_CONFIG, type AppConfig } from '../../config/index.js';
import { ClockModule } from '../../clock/index.js';
import { Outbox, OutboxModule } from '../../outbox/index.js';
import { TenantContext } from '../../tenancy/index.js';
import type { JobQueue } from '../job-queue.js';
import { OUTBOX_MAX_DISPATCH_ATTEMPTS, OutboxDispatcher } from '../outbox-dispatcher.js';
import type { OutboxHandlerRegistry } from '../outbox-handler-registry.js';

/** The dispatcher alone (no worker loop racing it), with a stand-in pg-boss whose inserts are recorded or fail. */
describe('OutboxDispatcher against PostgreSQL', () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let context: TenantContext;
  let outbox: Outbox;
  let tenantA: Tenant;
  let tenantB: Tenant;
  let dispatchers: OutboxDispatcher[] = [];

  const emit = (tenant: Tenant, type = 'ProjectCreated') =>
    context.run(tenant.id, () => {
      const id = randomUUID();
      return outbox.add({
        type,
        aggregateType: 'project',
        aggregateId: id,
        data: { projectId: id },
      });
    });
  const registry = (handlers: Record<string, string[]>) =>
    ({
      handlerNamesFor: (type: string) => handlers[type] ?? [],
    }) as unknown as OutboxHandlerRegistry;
  const dispatcher = (insert: (queue: string, jobs: { data: unknown }[]) => Promise<unknown>) => {
    const queue = { boss: { insert } } as unknown as JobQueue;
    const created = new OutboxDispatcher(
      moduleRef.get<AppConfig>(APP_CONFIG),
      queue,
      registry({ ProjectCreated: ['notify-project'] }),
    );
    dispatchers.push(created);
    return created;
  };
  const eventRow = async (id: string) =>
    (
      await database.query<{ attempts: number; last_error: string | null; processed: boolean }>(
        'postgres',
        'SELECT attempts, last_error, processed_at IS NOT NULL AS processed FROM outbox_events WHERE id = $1',
        [id],
      )
    )[0];

  beforeAll(async () => {
    database = await startTestDatabase();
    moduleRef = await compileWithDatabase(database, [ClockModule, OutboxModule, TenantModule]);
    context = moduleRef.get(TenantContext);
    outbox = moduleRef.get(Outbox);
    const tenants = moduleRef.get(TenantService);
    tenantA = await tenants.create(makeTenantInput());
    tenantB = await tenants.create(makeTenantInput());
  });

  afterEach(async () => {
    await Promise.all(dispatchers.map((d) => d.onModuleDestroy()));
    dispatchers = [];
    // Leave no pending events for the next test.
    await database.exec(
      'postgres',
      'UPDATE outbox_events SET processed_at = now() WHERE processed_at IS NULL',
    );
  });

  afterAll(async () => {
    await moduleRef.close();
    await database.stop();
  });

  it("claims every tenant's pending events and builds the envelope", async () => {
    const a = await emit(tenantA);
    const b = await emit(tenantB);
    const inserted: { queue: string; data: unknown }[] = [];
    const claimed = await dispatcher((queue, jobs) => {
      inserted.push(...jobs.map((j) => ({ queue, data: j.data })));
      return Promise.resolve([]);
    }).dispatchBatch(10);

    expect(claimed).toBe(2);
    expect(inserted.map((i) => i.queue)).toEqual([
      'outbox.notify-project',
      'outbox.notify-project',
    ]);
    expect(inserted[0]?.data).toMatchObject({
      eventId: a,
      tenantId: tenantA.id,
      type: 'ProjectCreated',
      aggregateType: 'project',
      schemaVersion: 1,
      actorUserId: null,
      correlationId: null,
    });
    expect(inserted[1]?.data).toMatchObject({ eventId: b, tenantId: tenantB.id });
    expect((await eventRow(a))?.processed).toBe(true);
    expect((await eventRow(b))?.processed).toBe(true);
  });

  it('marks events without handlers processed without enqueueing', async () => {
    const eventId = await emit(tenantA, 'NobodyListens');
    let inserts = 0;
    await dispatcher(() => Promise.resolve(++inserts)).dispatchBatch(10);
    expect(inserts).toBe(0);
    expect((await eventRow(eventId))?.processed).toBe(true);
  });

  it('records a failed enqueue as an attempt, keeps the event pending, and still dispatches the rest', async () => {
    const failing = await emit(tenantA);
    const fine = await emit(tenantB);
    const claimed = await dispatcher((_queue, jobs) => {
      const data = jobs[0]?.data as { eventId: string };
      return data.eventId === failing
        ? Promise.reject(new Error('queue unavailable'))
        : Promise.resolve([]);
    }).dispatchBatch(10);

    expect(claimed).toBe(2);
    expect(await eventRow(failing)).toEqual({
      attempts: 1,
      last_error: 'queue unavailable',
      processed: false,
    });
    expect(await eventRow(fine)).toMatchObject({ attempts: 0, processed: true });
  });

  it(`stops retrying an event after ${String(OUTBOX_MAX_DISPATCH_ATTEMPTS)} failed attempts`, async () => {
    const eventId = await emit(tenantA);
    await database.query('postgres', 'UPDATE outbox_events SET attempts = $2 WHERE id = $1', [
      eventId,
      OUTBOX_MAX_DISPATCH_ATTEMPTS - 1,
    ]);
    const failing = dispatcher(() => Promise.reject(new Error('still broken')));
    expect(await failing.dispatchBatch(10)).toBe(1);
    expect(await failing.dispatchBatch(10)).toBe(0);
    expect(await eventRow(eventId)).toMatchObject({
      attempts: OUTBOX_MAX_DISPATCH_ATTEMPTS,
      processed: false,
    });
  });

  it('never lets two dispatchers claim the same event', async () => {
    const ids = await Promise.all(Array.from({ length: 30 }, () => emit(tenantA)));
    const seen: string[] = [];
    const record = (_queue: string, jobs: { data: unknown }[]) => {
      seen.push(...jobs.map((j) => (j.data as { eventId: string }).eventId));
      return new Promise((resolve) => setTimeout(resolve, 5));
    };
    const [first, second] = await Promise.all([
      dispatcher(record).dispatchBatch(30),
      dispatcher(record).dispatchBatch(30),
    ]);
    expect(first + second).toBe(30);
    expect(seen.sort()).toEqual([...ids].sort());
  });
});
