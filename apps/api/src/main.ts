import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

// Validated config, logging and health endpoints arrive with the API skeleton (roadmap step 4).
const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  await app.listen(Number(process.env.PORT ?? DEFAULT_PORT));
}

void bootstrap();
