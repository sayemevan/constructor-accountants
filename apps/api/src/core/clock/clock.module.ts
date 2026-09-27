import { Global, Module } from '@nestjs/common';

import { Clock, SystemClock } from './clock.js';

/** Provides {@link Clock}. Tests override it with `FixedClock` from `src/testing/fixed-clock.ts`. */
@Global()
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }],
  exports: [Clock],
})
export class ClockModule {}
