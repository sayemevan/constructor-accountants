import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module.js';

/** Background worker (ADR-0013): pg-boss jobs and the outbox dispatcher. No HTTP. Scaled separately from the API. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  // SIGTERM/SIGINT → stop dispatching, drain handler jobs, stop pg-boss, close pools.
  app.enableShutdownHooks();
  await app.init();
  app.get(Logger).log('Worker started', 'Bootstrap');
}

void bootstrap();
