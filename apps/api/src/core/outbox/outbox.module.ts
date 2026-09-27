import { Global, Module } from '@nestjs/common';

import { Outbox } from './outbox.js';

/** Provides the {@link Outbox} writer to every module. Needs `DatabaseModule` and `ClockModule` (global). */
@Global()
@Module({
  providers: [Outbox],
  exports: [Outbox],
})
export class OutboxModule {}
