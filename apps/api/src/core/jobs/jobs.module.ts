import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { TenantModule } from '../../modules/tenant/index.js';
import { JobQueue } from './job-queue.js';
import { OutboxDispatcher } from './outbox-dispatcher.js';
import { OutboxHandlerRegistry } from './outbox-handler-registry.js';
import {
  DEFAULT_OUTBOX_WORKER_OPTIONS,
  OUTBOX_WORKER_OPTIONS,
  OutboxWorker,
} from './outbox-worker.js';
import { TenantJobRunner } from './tenant-job-runner.js';

/**
 * Background processing (ADR-0013), imported by the worker process only (`src/worker.ts`): pg-boss, the outbox
 * dispatcher and the outbox handler workers. The API process only writes events (`OutboxModule`).
 */
@Module({
  imports: [DiscoveryModule, TenantModule],
  providers: [
    JobQueue,
    OutboxHandlerRegistry,
    OutboxDispatcher,
    OutboxWorker,
    TenantJobRunner,
    { provide: OUTBOX_WORKER_OPTIONS, useValue: DEFAULT_OUTBOX_WORKER_OPTIONS },
  ],
  exports: [JobQueue, TenantJobRunner],
})
export class JobsModule {}
