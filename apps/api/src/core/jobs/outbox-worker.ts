import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import pg from 'pg';
import type { Job, JobResult } from 'pg-boss';
import { z } from 'zod';

import { APP_CONFIG, type AppConfig } from '../config/index.js';
import type { OutboxEventEnvelope } from '../outbox/index.js';
import { JobQueue } from './job-queue.js';
import { OUTBOX_DEAD_LETTER_QUEUE, outboxQueueName } from './outbox-event-handler.js';
import { OutboxDispatcher } from './outbox-dispatcher.js';
import { OutboxHandlerRegistry, type RegisteredOutboxHandler } from './outbox-handler-registry.js';
import { TenantJobRunner } from './tenant-job-runner.js';

export interface OutboxWorkerOptions {
  /** Fallback polling interval; commits also wake the dispatcher through NOTIFY. */
  readonly pollIntervalMs: number;
  readonly batchSize: number;
  /** Parallel fetch loops per handler queue in this process. */
  readonly handlerConcurrency: number;
  /** Handler jobs fetched per round; each job still succeeds or fails on its own. */
  readonly handlerBatchSize: number;
  /** pg-boss polling of handler queues when NOTIFY is not (yet) active for them. Minimum 0.5. */
  readonly handlerPollingSeconds: number;
  /**
   * Backstop polling while NOTIFY is active. New jobs wake workers immediately, but retries become due without a
   * NOTIFY, so this bounds how late a retry starts. Minimum 0.5.
   */
  readonly handlerNotifyPollingSeconds: number;
  /** Handler retries after the first failure, with exponential backoff, before the dead-letter queue. */
  readonly retryLimit: number;
  readonly retryDelaySeconds: number;
}

export const OUTBOX_WORKER_OPTIONS = Symbol('OUTBOX_WORKER_OPTIONS');

export const DEFAULT_OUTBOX_WORKER_OPTIONS: OutboxWorkerOptions = {
  pollIntervalMs: 1_000,
  batchSize: 100,
  handlerConcurrency: 2,
  handlerBatchSize: 10,
  handlerPollingSeconds: 2,
  handlerNotifyPollingSeconds: 10,
  retryLimit: 5,
  retryDelaySeconds: 5,
};

const MAX_RETRY_DELAY_SECONDS = 600;
const NOTIFY_CHANNEL = 'outbox_events';

/** What a handler job carries; validated before any tenant work (12 "Background jobs"). */
const EnvelopeSchema = z.object({
  eventId: z.uuid(),
  tenantId: z.uuid(),
  type: z.string(),
  aggregateType: z.string(),
  aggregateId: z.uuid(),
  occurredAt: z.iso.datetime({ offset: true }),
  actorUserId: z.uuid().nullable(),
  correlationId: z.string().nullable(),
  schemaVersion: z.number().int().positive(),
  data: z.record(z.string(), z.json()),
});

/**
 * The worker side of the outbox (25): one pg-boss queue + worker per `@OutboxEventHandler`, a dead-letter queue, and
 * the dispatch loop (LISTEN wake-up + polling fallback). Handler jobs run through {@link TenantJobRunner}, so they
 * execute in the event's tenant context and are skipped for inactive tenants.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private listener: pg.Client | undefined;
  private running: Promise<void> | undefined;
  private rerun = false;
  private stopped = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(OUTBOX_WORKER_OPTIONS) private readonly options: OutboxWorkerOptions,
    private readonly queue: JobQueue,
    private readonly registry: OutboxHandlerRegistry,
    private readonly dispatcher: OutboxDispatcher,
    private readonly runner: TenantJobRunner,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const { boss } = this.queue;
    await boss.createQueue(OUTBOX_DEAD_LETTER_QUEUE, { notify: true });
    await boss.work<OutboxEventEnvelope>(OUTBOX_DEAD_LETTER_QUEUE, (jobs) => {
      for (const job of jobs) {
        this.logger.error(
          { jobId: job.id, eventId: job.data.eventId, tenantId: job.data.tenantId },
          'outbox handler job dead-lettered',
        );
      }
      return Promise.resolve();
    });
    for (const handler of this.registry.all()) {
      const name = outboxQueueName(handler.name);
      await boss.createQueue(name, {
        retryLimit: this.options.retryLimit,
        retryDelay: this.options.retryDelaySeconds,
        retryBackoff: true,
        retryDelayMax: MAX_RETRY_DELAY_SECONDS,
        deadLetter: OUTBOX_DEAD_LETTER_QUEUE,
        notify: true,
      });
      await boss.work<unknown>(
        name,
        {
          batchSize: this.options.handlerBatchSize,
          localConcurrency: this.options.handlerConcurrency,
          pollingIntervalSeconds: this.options.handlerPollingSeconds,
          notifyPollingIntervalSeconds: this.options.handlerNotifyPollingSeconds,
          // Keep fetching while batches come back full; settle every job on its own.
          burstWhenBatchFull: true,
          perJobResults: true,
        },
        async (jobs) => {
          const results: JobResult[] = [];
          for (const job of jobs) results.push(await this.runHandler(handler, job));
          return results;
        },
      );
    }
    this.logger.log({ handlers: this.registry.all().map((h) => h.name) }, 'outbox worker started');
    await this.listen();
    this.timer = setInterval(() => {
      this.wake();
    }, this.options.pollIntervalMs);
    this.wake();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    clearInterval(this.timer);
    await this.listener?.end().catch(() => undefined);
    await this.running;
    const { boss } = this.queue;
    for (const handler of this.registry.all()) {
      await boss.offWork(outboxQueueName(handler.name), { wait: true });
    }
    await boss.offWork(OUTBOX_DEAD_LETTER_QUEUE, { wait: true });
  }

  /** Runs the dispatcher until no pending events remain; concurrent wake-ups coalesce into one more pass. */
  wake(): void {
    if (this.stopped) return;
    if (this.running !== undefined) {
      this.rerun = true;
      return;
    }
    this.running = this.drain().finally(() => {
      this.running = undefined;
      if (this.rerun) {
        this.rerun = false;
        this.wake();
      }
    });
  }

  private async drain(): Promise<void> {
    try {
      while (!this.stopped) {
        const claimed = await this.dispatcher.dispatchBatch(this.options.batchSize);
        if (claimed < this.options.batchSize) return;
      }
    } catch (error) {
      this.logger.error({ err: error }, 'outbox dispatch failed');
    }
  }

  /** Runs one handler job; a failure fails only this job (pg-boss retries it, then dead-letters it). */
  private async runHandler(
    handler: RegisteredOutboxHandler,
    job: Job<unknown>,
  ): Promise<JobResult> {
    const parsed = EnvelopeSchema.safeParse(job.data);
    if (!parsed.success) {
      // A malformed payload will never succeed: straight to the dead-letter queue.
      this.logger.error({ handler: handler.name, jobId: job.id }, 'invalid outbox job payload');
      return { id: job.id, status: 'deadletter', output: { error: 'INVALID_PAYLOAD' } };
    }
    const event = parsed.data as OutboxEventEnvelope;
    const context = {
      handler: handler.name,
      eventId: event.eventId,
      eventType: event.type,
      tenantId: event.tenantId,
      correlationId: event.correlationId,
      attempt: job.retryCount,
    };
    try {
      const result = await this.runner.run(event.tenantId, () => handler.instance.handle(event));
      if (result.status === 'done') this.logger.debug(context, 'outbox handler done');
      return { id: job.id, status: 'completed' };
    } catch (error) {
      this.logger.warn({ ...context, err: error }, 'outbox handler failed');
      const message = error instanceof Error ? error.message : String(error);
      return { id: job.id, status: 'failed', output: { error: message } };
    }
  }

  /** A dedicated connection LISTENing for commits; polling covers the gaps while it reconnects. */
  private async listen(): Promise<void> {
    if (this.stopped) return;
    const client = new pg.Client({
      connectionString: this.config.database.url,
      application_name: 'construction-erp-outbox-listen',
    });
    client.on('notification', () => {
      this.wake();
    });
    client.on('error', (error) => {
      this.logger.warn(
        { err: error },
        'outbox listener lost; relying on polling until it reconnects',
      );
      this.listener = undefined;
      void client.end().catch(() => undefined);
      setTimeout(() => void this.listen().catch(() => undefined), this.options.pollIntervalMs);
    });
    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
      this.listener = client;
    } catch (error) {
      this.logger.warn({ err: error }, 'outbox listener could not connect; polling only');
      await client.end().catch(() => undefined);
    }
  }
}
