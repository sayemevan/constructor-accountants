// The outbox writer, usable by every module. Delivery (dispatcher, handlers) lives in core/jobs, worker only.
export { Outbox } from './outbox.js';
export {
  assertEventType,
  type NewOutboxEvent,
  type OutboxEventData,
  type OutboxEventEnvelope,
  type OutboxJsonValue,
} from './outbox-event.js';
export { OutboxModule } from './outbox.module.js';
