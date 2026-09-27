import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import { AppTenantDatabase, TenantContext } from '../../../core/tenancy/index.js';

/** A `tenant_settings` row as stored: the blob is validated and upgraded by the domain, not here. */
export interface StoredTenantSettings {
  readonly settings: unknown;
  readonly schemaVersion: number;
  readonly version: number;
}

const COLUMNS = { settings: true, schemaVersion: true, version: true } as const;

/** `tenant_settings` is tenant-owned: RLS scopes it, and every query also names the context's tenant (06 rule 3). */
@Injectable()
export class TenantSettingsRepository {
  constructor(
    private readonly database: AppTenantDatabase,
    private readonly context: TenantContext,
  ) {}

  /** Creates the context tenant's row; `tenant_id` comes from the transaction's tenant (DB default). */
  async insert(settings: Prisma.InputJsonObject, schemaVersion: number): Promise<void> {
    await this.database.client.tenantSettings.create({ data: { settings, schemaVersion } });
  }

  findCurrent(): Promise<StoredTenantSettings | null> {
    return this.database.client.tenantSettings.findUnique({
      where: { tenantId: this.context.requireTenantId() },
      select: COLUMNS,
    });
  }

  /** Replaces the blob if the row is still at `expectedVersion`; `null` when it is not. */
  async updateCurrent(
    settings: Prisma.InputJsonObject,
    schemaVersion: number,
    expectedVersion: number,
  ): Promise<StoredTenantSettings | null> {
    const tenantId = this.context.requireTenantId();
    const { count } = await this.database.client.tenantSettings.updateMany({
      where: { tenantId, version: expectedVersion },
      data: { settings, schemaVersion, version: { increment: 1 } },
    });
    if (count === 0) return null;
    return this.database.client.tenantSettings.findUnique({
      where: { tenantId },
      select: COLUMNS,
    });
  }
}
