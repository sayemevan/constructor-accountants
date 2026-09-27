import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import { PgBoss } from 'pg-boss';

import { APP_CONFIG, type AppConfig } from '../config/index.js';
import { JOB_SCHEMA } from './job-schema.js';

const POOL_SIZE = 4;
const STOP_TIMEOUT_MS = 30_000;

/**
 * The worker's pg-boss instance (ADR-0013), connected as the runtime role. Starts with `migrate: false`: the schema is
 * installed by `cli.js migrate` (`installJobSchema`), so a worker on an un-migrated database fails on boot.
 * Stopped after every module's `onModuleDestroy`, i.e. after the workers have drained.
 */
@Injectable()
export class JobQueue implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(JobQueue.name);
  readonly boss: PgBoss;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.boss = new PgBoss({
      connectionString: config.database.url,
      schema: JOB_SCHEMA,
      max: POOL_SIZE,
      migrate: false,
      // Queues created with `notify: true` wake their workers on insert; polling remains the fallback.
      useListenNotify: true,
      application_name: 'construction-erp-worker',
    });
    this.boss.on('error', (error) => {
      this.logger.error({ err: error }, 'pg-boss error');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
  }
}
