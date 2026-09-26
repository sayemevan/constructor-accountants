import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { APP_CONFIG, type AppConfig } from '../config/index.js';

const CONNECTION_TIMEOUT_MS = 5_000;

/**
 * The single Prisma client of the process, connected as the runtime role (`app_user`) through the `pg` driver
 * adapter. Repositories will receive the tenant-scoped extension of this client (roadmap step 7), never this raw
 * instance. Connects lazily on the first query.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({
      adapter: new PrismaPg({
        connectionString: config.database.url,
        max: config.database.poolSize,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
