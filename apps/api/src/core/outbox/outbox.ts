import { Injectable } from '@nestjs/common';

import { Clock } from '../clock/index.js';
import { TransactionRunner } from '../tenancy/index.js';
import { assertEventType, type NewOutboxEvent, type OutboxEventData } from './outbox-event.js';

/**
 * The transactional outbox writer (25 "Mechanism"). Call it inside the use case's transaction: the event is
 * committed or rolled back together with the change that raised it, and the worker delivers it after commit.
 */
@Injectable()
export class Outbox {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly clock: Clock,
  ) {}

  /** Records `event` for the context's tenant; returns its eventId. */
  async add<D extends OutboxEventData>(event: NewOutboxEvent<D>): Promise<string> {
    assertEventType(event.type);
    const schemaVersion = event.schemaVersion ?? 1;
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
      throw new RangeError('schemaVersion must be a positive integer');
    }
    return this.transactions.run(async (tx) => {
      // tenant_id comes from the transaction's tenant (DB default). Actor and correlation id are filled from the
      // request/session context once auth exists (Phase 1 sessions 4–5).
      const row = await tx.outboxEvent.create({
        data: {
          eventType: event.type,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          payload: event.data,
          schemaVersion,
          occurredAt: this.clock.now(),
        },
        select: { id: true },
      });
      return row.id;
    });
  }
}
