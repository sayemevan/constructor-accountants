/** JSON-compatible event data: ids and small facts only, no PII, no full entities (25 "Event conventions"). */
export type OutboxEventData = Readonly<Record<string, OutboxJsonValue>>;
export type OutboxJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly OutboxJsonValue[]
  | Readonly<{ [key: string]: OutboxJsonValue }>;

/** What a module passes to `Outbox.add`. Tenant, time, actor and correlation come from context, never the caller. */
export interface NewOutboxEvent<D extends OutboxEventData = OutboxEventData> {
  /** PascalCase past tense, e.g. `ProjectCreated`. Export the payload type from the emitting module's index.ts. */
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly data: D;
  /** Bump for breaking payload changes; handlers support both during the transition. Default 1. */
  readonly schemaVersion?: number;
}

/** The envelope a handler receives (25 "Event conventions"). */
export interface OutboxEventEnvelope<D extends OutboxEventData = OutboxEventData> {
  readonly eventId: string;
  readonly tenantId: string;
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  /** ISO 8601 instant (UTC). */
  readonly occurredAt: string;
  readonly actorUserId: string | null;
  readonly correlationId: string | null;
  readonly schemaVersion: number;
  readonly data: D;
}

const EVENT_TYPE = /^[A-Z][A-Za-z0-9]{1,99}$/;

/** Throws a TypeError unless `type` is PascalCase (same rule as the DB CHECK constraint). */
export function assertEventType(type: string): void {
  if (!EVENT_TYPE.test(type)) {
    throw new TypeError(`Invalid event type "${type}": PascalCase past tense, e.g. ProjectCreated`);
  }
}
