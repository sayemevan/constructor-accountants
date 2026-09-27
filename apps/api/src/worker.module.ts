import { Module } from '@nestjs/common';

import { ClockModule } from './core/clock/index.js';
import { ConfigModule } from './core/config/index.js';
import { DatabaseModule } from './core/database/index.js';
import { JobsModule } from './core/jobs/index.js';
import { LoggingModule } from './core/logging/index.js';
import { OutboxModule } from './core/outbox/index.js';
import { SequencesModule } from './core/sequences/index.js';
import { TenantModule } from './modules/tenant/index.js';

/**
 * The worker process (`node dist/worker.js`, 17): the same modules as the API minus HTTP, plus JobsModule. Modules
 * with `@OutboxEventHandler` providers are imported here so the handler registry discovers them.
 */
@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ClockModule,
    DatabaseModule,
    SequencesModule,
    OutboxModule,
    TenantModule,
    JobsModule,
  ],
})
export class WorkerModule {}
