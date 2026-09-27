import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ClockModule } from './core/clock/index.js';
import { ConfigModule } from './core/config/index.js';
import { DatabaseModule } from './core/database/index.js';
import { GlobalExceptionFilter } from './core/errors/index.js';
import { HealthModule } from './core/health/health.module.js';
import { LoggingModule } from './core/logging/index.js';
import { OutboxModule } from './core/outbox/index.js';
import { SequencesModule } from './core/sequences/index.js';
import { TenantModule } from './modules/tenant/index.js';

@Module({
  imports: [
    ConfigModule,
    LoggingModule,
    ClockModule,
    DatabaseModule,
    SequencesModule,
    OutboxModule,
    HealthModule,
    TenantModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
export class AppModule {}
