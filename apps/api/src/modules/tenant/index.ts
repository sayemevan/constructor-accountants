// Public API of the tenant module (23): services other modules may inject, and their types.
export { SettingsService } from './application/settings.service.js';
export { TenantService } from './application/tenant.service.js';
export type { Tenant } from './domain/tenant.js';
export type { TenantSettingsSnapshot } from './domain/tenant-settings.js';
export { TenantModule } from './tenant.module.js';
