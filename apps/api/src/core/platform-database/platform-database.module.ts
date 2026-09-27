import { Module } from '@nestjs/common';

import { PlatformDatabase } from './platform-database.js';

/** Not global: imported only by the `platform` module (06 "Platform operations"). */
@Module({
  providers: [PlatformDatabase],
  exports: [PlatformDatabase],
})
export class PlatformDatabaseModule {}
