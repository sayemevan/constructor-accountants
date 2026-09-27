import { Global, Module } from '@nestjs/common';

import { AppTenantDatabase, TenantContext, TransactionRunner } from '../tenancy/index.js';
import { DatabaseHealthService } from './database-health.service.js';
import { PrismaService } from './prisma.service.js';

/**
 * The runtime database (`app_user`). Modules use only the tenancy providers (06 rule 1, ADR-0005 Compliance):
 * `AppTenantDatabase` in repositories and `TransactionRunner` in application services. `PrismaService` is exported
 * for core infrastructure (health checks) only; dependency-cruiser forbids it in modules.
 */
@Global()
@Module({
  providers: [
    PrismaService,
    DatabaseHealthService,
    { provide: TenantContext, useValue: new TenantContext() },
    {
      provide: AppTenantDatabase,
      useFactory: (prisma: PrismaService, context: TenantContext) =>
        new AppTenantDatabase(prisma, context),
      inject: [PrismaService, TenantContext],
    },
    TransactionRunner,
  ],
  exports: [
    PrismaService,
    DatabaseHealthService,
    TenantContext,
    AppTenantDatabase,
    TransactionRunner,
  ],
})
export class DatabaseModule {}
