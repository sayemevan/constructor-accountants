import { Global, Module } from '@nestjs/common';

import { APP_CONFIG, loadConfig } from './app-config.js';

/** Provides the validated {@link AppConfig}. Validation runs once when the module is created (fail fast on boot). */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
