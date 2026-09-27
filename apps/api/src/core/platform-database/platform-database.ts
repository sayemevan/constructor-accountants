import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { APP_CONFIG, type AppConfig } from '../config/index.js';

const CONNECTION_TIMEOUT_MS = 5_000;
/** Platform operations are rare, operator-initiated requests; a small pool is enough. */
const POOL_SIZE = 2;

/** Thrown when platform code runs in a deployment without `DATABASE_PLATFORM_URL` (e.g. self-hosted). */
export class PlatformDatabaseNotConfiguredError extends Error {
  override readonly name = 'PlatformDatabaseNotConfiguredError';

  constructor() {
    super('DATABASE_PLATFORM_URL is not configured: platform operations are unavailable');
  }
}

/**
 * The `app_platform` (BYPASSRLS) client for SaaS operator operations — create/suspend tenants, usage stats (06
 * "Platform operations"). Sees every tenant's rows, so only the `platform` module may use it (dependency-cruiser
 * rule `platform-database-only-in-platform`), and every operation it performs is audited.
 *
 * Optional: the client is created on first use of {@link client}, which throws when the URL is not configured.
 */
@Injectable()
export class PlatformDatabase implements OnModuleDestroy {
  private instance: PrismaClient | undefined;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get isConfigured(): boolean {
    return this.config.database.platformUrl !== undefined;
  }

  get client(): PrismaClient {
    const url = this.config.database.platformUrl;
    if (url === undefined) throw new PlatformDatabaseNotConfiguredError();
    this.instance ??= new PrismaClient({
      adapter: new PrismaPg({
        connectionString: url,
        max: POOL_SIZE,
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      }),
    });
    return this.instance;
  }

  async onModuleDestroy(): Promise<void> {
    await this.instance?.$disconnect();
  }
}
