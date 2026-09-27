import { Global, Module } from '@nestjs/common';

import { NumberSequenceService } from './number-sequence.service.js';

/** Provides {@link NumberSequenceService}. Needs `DatabaseModule` (global). */
@Global()
@Module({
  providers: [NumberSequenceService],
  exports: [NumberSequenceService],
})
export class SequencesModule {}
