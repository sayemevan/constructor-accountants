import { Injectable } from '@nestjs/common';
import { TENANT_SETTINGS_SCHEMA_VERSION, TenantSettingsPatch } from '@repo/contracts';

import { ConflictError, NotFoundError } from '../../../core/errors/index.js';
import { TransactionRunner } from '../../../core/tenancy/index.js';
import {
  applyTenantSettingsPatch,
  sameTenantSettings,
  type TenantSettingsSnapshot,
  upgradeTenantSettings,
} from '../domain/tenant-settings.js';
import {
  type StoredTenantSettings,
  TenantSettingsRepository,
} from '../infrastructure/tenant-settings.repository.js';

/** The current tenant's settings (tenant-management.md); other modules read them through {@link get}. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly settings: TenantSettingsRepository,
  ) {}

  async get(): Promise<TenantSettingsSnapshot> {
    return toSnapshot(await this.findOrThrow());
  }

  /**
   * Merges `patch` into the settings if they are still at `expectedVersion` (409 `VERSION_CONFLICT` otherwise).
   * A patch that changes nothing writes nothing and keeps the version.
   */
  async update(
    patch: TenantSettingsPatch,
    expectedVersion: number,
  ): Promise<TenantSettingsSnapshot> {
    const changes = TenantSettingsPatch.parse(patch);
    return this.transactions.run(async () => {
      const current = toSnapshot(await this.findOrThrow());
      if (current.version !== expectedVersion) throw versionConflict();
      const next = applyTenantSettingsPatch(current.settings, changes);
      if (sameTenantSettings(current.settings, next)) return current;
      const saved = await this.settings.updateCurrent(
        next,
        TENANT_SETTINGS_SCHEMA_VERSION,
        expectedVersion,
      );
      if (saved === null) throw versionConflict();
      return toSnapshot(saved);
    });
  }

  private async findOrThrow(): Promise<StoredTenantSettings> {
    const stored = await this.settings.findCurrent();
    if (stored === null) throw new NotFoundError();
    return stored;
  }
}

function toSnapshot(stored: StoredTenantSettings): TenantSettingsSnapshot {
  return {
    settings: upgradeTenantSettings(stored.schemaVersion, stored.settings),
    version: stored.version,
  };
}

function versionConflict(): ConflictError {
  return new ConflictError(
    'VERSION_CONFLICT',
    'The settings were changed by someone else. Reload and try again.',
  );
}
