import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

import { APP_CONFIG, type AppConfig } from '../config/index.js';
import type { OutboxEventData, OutboxEventEnvelope } from '../outbox/index.js';
import { JobQueue } from './job-queue.js';
import { outboxQueueName } from './outbox-event-handler.js';
import { OutboxHandlerRegistry } from './outbox-handler-registry.js';

/** After this many failed enqueue attempts an event is left for an operator (logged as an error). */
export const OUTBOX_MAX_DISPATCH_ATTEMPTS = 10;
const POOL_SIZE = 2;
const MAX_ERROR_LENGTH = 2_000;

interface PendingEventRow {
  id: string;
  tenant_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: OutboxEventData;
  schema_version: number;
  correlation_id: string | null;
  actor_user_id: string | null;
  occurred_at: Date;
  attempts: number;
}

/**
 * Moves committed outbox events to pg-boss (25 "Mechanism" step 2). One transaction per batch:
 *   1. set the transaction-local `app.outbox_dispatcher` flag — the only way to see every tenant's pending events
 *      (the dispatcher RLS policies, ADR-0005 "Outbox dispatcher");
 *   2. claim pending events with `FOR UPDATE SKIP LOCKED`, so concurrent dispatchers never claim the same event;
 *   3. insert one pg-boss job per handler through the same connection, and mark the event processed.
 * Enqueueing and marking commit together, so each handler gets each event exactly once; handler runs are
 * at-least-once (pg-boss retries). A failed enqueue rolls back to a per-event savepoint and counts an attempt.
 */
@Injectable()
export class OutboxDispatcher implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private readonly pool: pg.Pool;

  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly queue: JobQueue,
    private readonly registry: OutboxHandlerRegistry,
  ) {
    this.pool = new pg.Pool({
      connectionString: config.database.url,
      max: POOL_SIZE,
      application_name: 'construction-erp-outbox',
    });
  }

  /** Dispatches up to `limit` pending events; returns how many were claimed. */
  async dispatchBatch(limit: number): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT set_config('app.outbox_dispatcher', 'on', true)`);
      const { rows } = await client.query<PendingEventRow>(
        `SELECT id, tenant_id, event_type, aggregate_type, aggregate_id, payload, schema_version,
                correlation_id, actor_user_id, occurred_at, attempts
         FROM outbox_events
         WHERE processed_at IS NULL AND attempts < $2
         ORDER BY occurred_at, id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [limit, OUTBOX_MAX_DISPATCH_ATTEMPTS],
      );
      for (const row of rows) await this.dispatchOne(client, row);
      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async dispatchOne(client: pg.PoolClient, row: PendingEventRow): Promise<void> {
    const envelope = toEnvelope(row);
    const db = { executeSql: (text: string, values?: unknown[]) => client.query(text, values) };
    await client.query('SAVEPOINT outbox_event');
    try {
      for (const handler of this.registry.handlerNamesFor(row.event_type)) {
        await this.queue.boss.insert(outboxQueueName(handler), [{ data: envelope }], { db });
      }
      await client.query(`UPDATE outbox_events SET processed_at = now() WHERE id = $1`, [row.id]);
      await client.query('RELEASE SAVEPOINT outbox_event');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT outbox_event');
      const message = error instanceof Error ? error.message : String(error);
      await client.query(
        `UPDATE outbox_events SET attempts = attempts + 1, last_error = $2 WHERE id = $1`,
        [row.id, message.slice(0, MAX_ERROR_LENGTH)],
      );
      const exhausted = row.attempts + 1 >= OUTBOX_MAX_DISPATCH_ATTEMPTS;
      this.logger[exhausted ? 'error' : 'warn'](
        { eventId: row.id, tenantId: row.tenant_id, eventType: row.event_type, err: error },
        exhausted ? 'outbox event dispatch gave up' : 'outbox event dispatch failed',
      );
    }
  }
}

function toEnvelope(row: PendingEventRow): OutboxEventEnvelope {
  return {
    eventId: row.id,
    tenantId: row.tenant_id,
    type: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    occurredAt: row.occurred_at.toISOString(),
    actorUserId: row.actor_user_id,
    correlationId: row.correlation_id,
    schemaVersion: row.schema_version,
    data: row.payload,
  };
}
