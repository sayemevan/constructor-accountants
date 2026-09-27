import { Module } from '@nestjs/common';

import { SettingsService } from './application/settings.service.js';
import { TenantService } from './application/tenant.service.js';
import { TenantSettingsRepository } from './infrastructure/tenant-settings.repository.js';
import { TenantRepository } from './infrastructure/tenant.repository.js';

/** Module `tenant` (tenant-management.md). Data layer only so far; HTTP arrives in Phase 1 session 8. */
@Module({
  providers: [TenantRepository, TenantSettingsRepository, TenantService, SettingsService],
  exports: [TenantService, SettingsService],
})
export class TenantModule {}
