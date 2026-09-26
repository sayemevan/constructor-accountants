import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { APP_CONFIG, type AppConfig } from './core/config/index.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get<AppConfig>(APP_CONFIG);
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  // Single origin behind the reverse proxy: /api/* → this process (17). Resources live under /api/v1.
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  await app.listen(config.port);
  app
    .get(Logger)
    .log(`API listening on port ${String(config.port)} (${config.deploymentMode})`, 'Bootstrap');
}

void bootstrap();
