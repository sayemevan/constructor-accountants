// Worker-side background processing. Modules use only the handler decorator/types and TenantJobRunner.
export { JobQueue } from './job-queue.js';
export { installJobSchema, JOB_SCHEMA, roleOf } from './job-schema.js';
export { JobsModule } from './jobs.module.js';
export {
  OUTBOX_DEAD_LETTER_QUEUE,
  OutboxEventHandler,
  type OutboxEventHandlerInstance,
  type OutboxEventHandlerOptions,
  outboxQueueName,
} from './outbox-event-handler.js';
export { OUTBOX_MAX_DISPATCH_ATTEMPTS, OutboxDispatcher } from './outbox-dispatcher.js';
export {
  DEFAULT_OUTBOX_WORKER_OPTIONS,
  OUTBOX_WORKER_OPTIONS,
  OutboxWorker,
  type OutboxWorkerOptions,
} from './outbox-worker.js';
export { type TenantJobResult, TenantJobRunner } from './tenant-job-runner.js';
