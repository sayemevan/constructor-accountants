import { randomUUID } from 'node:crypto';

import { Injectable, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TenantModule, TenantService, type Tenant } from '../../../modules/tenant/index.js';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { makeTenantInput } from '../../../testing/tenant-factory.js';
import { makeTestConfig } from '../../../testing/test-config.js';
import { ClockModule } from '../../clock/index.js';
import { APP_CONFIG, ConfigModule } from '../../config/index.js';
import { DatabaseModule } from '../../database/index.js';
import { Outbox, OutboxModule, type OutboxEventEnvelope } from '../../outbox/index.js';
import { TenantContext } from '../../tenancy/index.js';
import {
  JobsModule,
  OUTBOX_DEAD_LETTER_QUEUE,
  OUTBOX_WORKER_OPTIONS,
  OutboxDispatcher,
  OutboxEventHandler,
  type OutboxEventHandlerInstance,
  type OutboxWorkerOptions,
} from '../index.js';

interface Handled {
  readonly handler: string;
  readonly eventId: string;
  readonly eventTenantId: string;
  readonly contextTenantId: string;
}
const handled: Handled[] = [];

@Injectable()
class RecordingHandler {
  constructor(private readonly context: TenantContext) {}

  protected record(handler: string, event: OutboxEventEnvelope): Promise<void> {
    handled.push({
      handler,
      eventId: event.eventId,
      eventTenantId: event.tenantId,
      contextTenantId: this.context.requireTenantId(),
    });
    return Promise.resolve();
  }
}

@Injectable()
@OutboxEventHandler({ name: 'notify-project', events: ['ProjectCreated', 'ProjectArchived'] })
class NotifyProjectHandler extends RecordingHandler implements OutboxEventHandlerInstance {
  handle(event: OutboxEventEnvelope) {
    return this.record('notify-project', event);
  }
}

@Injectable()
@OutboxEventHandler({ name: 'refresh-summary', events: ['ProjectCreated'] })
class RefreshSummaryHandler extends RecordingHandler implements OutboxEventHandlerInstance {
  handle(event: OutboxEventEnvelope) {
    return this.record('refresh-summary', event);
  }
}

@Injectable()
@OutboxEventHandler({ name: 'always-fails', events: ['ReportRequested'] })
class AlwaysFailsHandler implements OutboxEventHandlerInstance {
  handle(): Promise<void> {
    return Promise.reject(new Error('handler is broken'));
  }
}

@Module({ providers: [NotifyProjectHandler, RefreshSummaryHandler, AlwaysFailsHandler] })
class TestHandlersModule {}

const OPTIONS: OutboxWorkerOptions = {
  pollIntervalMs: 200,
  batchSize: 5,
  handlerConcurrency: 2,
  handlerBatchSize: 10,
  handlerPollingSeconds: 0.5,
  handlerNotifyPollingSeconds: 0.5,
  retryLimit: 1,
  retryDelaySeconds: 1,
};

/**
 * The worker side against real PostgreSQL + pg-boss: commit → dispatch → handler jobs in the event's tenant
 * context, exactly one job per (event, handler) even with concurrent dispatchers.
 */
describe('Outbox worker against PostgreSQL', () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let context: TenantContext;
  let outbox: Outbox;
  let tenants: TenantService;
  let tenantA: Tenant;
  let tenantB: Tenant;

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
  const handledFor = (eventId: string) => handled.filter((h) => h.eventId === eventId);
  const jobsFor = async (eventId: string) =>
    database.query<{ name: string; state: string }>(
      'app_owner',
      `SELECT name, state FROM pgboss.job WHERE data->>'eventId' = $1 ORDER BY name`,
      [eventId],
    );

  beforeAll(async () => {
    database = await startTestDatabase();
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ClockModule,
        DatabaseModule,
        OutboxModule,
        TenantModule,
        JobsModule,
        TestHandlersModule,
      ],
    })
      .overrideProvider(APP_CONFIG)
      .useValue(makeTestConfig({ DATABASE_URL: database.url('app_user') }))
      .overrideProvider(OUTBOX_WORKER_OPTIONS)
      .useValue(OPTIONS)
      .compile();
    await moduleRef.init();
    context = moduleRef.get(TenantContext);
    outbox = moduleRef.get(Outbox);
    tenants = moduleRef.get(TenantService);
    tenantA = await tenants.create(makeTenantInput());
    tenantB = await tenants.create(makeTenantInput());
  });

  afterAll(async () => {
    await moduleRef.close();
    await database.stop();
  });

  it("delivers a committed event to each of its handlers, inside the event's tenant context", async () => {
    const eventId = await emit(tenantA);
    await waitFor(() => handledFor(eventId).length === 2);
    expect(
      handledFor(eventId)
        .map((h) => h.handler)
        .sort(),
    ).toEqual(['notify-project', 'refresh-summary']);
    for (const h of handledFor(eventId)) {
      expect(h).toMatchObject({ eventTenantId: tenantA.id, contextTenantId: tenantA.id });
    }
    await waitFor(async () => (await processedAt(eventId)) !== null);
  });

  it('routes by event type and keeps tenants apart', async () => {
    const archived = await emit(tenantB, 'ProjectArchived');
    await waitFor(() => handledFor(archived).length === 1);
    expect(handledFor(archived)[0]).toMatchObject({
      handler: 'notify-project',
      contextTenantId: tenantB.id,
    });
  });

  it('marks events without handlers processed without creating jobs', async () => {
    const eventId = await emit(tenantA, 'NobodyListens');
    await waitFor(async () => (await processedAt(eventId)) !== null);
    expect(await jobsFor(eventId)).toEqual([]);
  });

  it('enqueues exactly one job per (event, handler) with concurrent dispatchers', async () => {
    const eventIds = await Promise.all(Array.from({ length: 20 }, () => emit(tenantA)));
    const dispatcher = moduleRef.get(OutboxDispatcher);
    await Promise.all([dispatcher.dispatchBatch(20), dispatcher.dispatchBatch(20)]);
    await waitFor(async () => {
      const pending = await database.query(
        'postgres',
        `SELECT 1 FROM outbox_events WHERE id = ANY($1::uuid[]) AND processed_at IS NULL`,
        [eventIds],
      );
      return pending.length === 0;
    });
    const counts = await database.query<{ event_id: string; jobs: number }>(
      'app_owner',
      `SELECT data->>'eventId' AS event_id, count(*)::int AS jobs FROM pgboss.job
       WHERE data->>'eventId' = ANY($1) GROUP BY 1`,
      [eventIds],
    );
    expect(counts).toHaveLength(20);
    expect(counts.every((c) => c.jobs === 2)).toBe(true);
  });

  it('skips handler work for a suspended tenant', async () => {
    const suspended = await tenants.create(makeTenantInput());
    await database.query('app_owner', `UPDATE tenants SET status = 'SUSPENDED' WHERE id = $1`, [
      suspended.id,
    ]);
    const eventId = await emit(suspended);
    await waitFor(async () => {
      const jobs = await jobsFor(eventId);
      return jobs.length === 2 && jobs.every((j) => j.state === 'completed');
    });
    expect(handledFor(eventId)).toEqual([]);
  });

  it('retries a failing handler, then moves the job to the dead-letter queue', async () => {
    const eventId = await emit(tenantA, 'ReportRequested');
    await waitFor(
      async () => (await jobsFor(eventId)).some((j) => j.name === OUTBOX_DEAD_LETTER_QUEUE),
      20_000,
    );
    const [failed] = await database.query<{ state: string; retry_count: number }>(
      'app_owner',
      `SELECT state, retry_count FROM pgboss.job WHERE name = 'outbox.always-fails' AND data->>'eventId' = $1`,
      [eventId],
    );
    expect(failed).toEqual({ state: 'failed', retry_count: OPTIONS.retryLimit });
  }, 30_000);

  async function processedAt(eventId: string): Promise<Date | null> {
    const [row] = await database.query<{ processed_at: Date | null }>(
      'postgres',
      'SELECT processed_at FROM outbox_events WHERE id = $1',
      [eventId],
    );
    return row?.processed_at ?? null;
  }
});

async function waitFor(condition: () => boolean | Promise<boolean>, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
