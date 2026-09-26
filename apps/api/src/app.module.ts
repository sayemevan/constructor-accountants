import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { ConfigModule } from './core/config/index.js';
import { DatabaseModule } from './core/database/index.js';
import { GlobalExceptionFilter } from './core/errors/index.js';
import { HealthModule } from './core/health/health.module.js';
import { LoggingModule } from './core/logging/index.js';

@Module({
  imports: [ConfigModule, LoggingModule, DatabaseModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: GlobalExceptionFilter }],
})
export class AppModule {}
