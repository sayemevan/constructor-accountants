import { Injectable } from '@nestjs/common';
import {
  CreateTenantInput,
  TENANT_SETTINGS_SCHEMA_VERSION,
  TenantProfilePatch,
} from '@repo/contracts';

import { ConflictError, NotFoundError } from '../../../core/errors/index.js';
import { uuidv7 } from '../../../core/ids/index.js';
import { TenantContext, TransactionRunner } from '../../../core/tenancy/index.js';
import type { Tenant } from '../domain/tenant.js';
import { defaultTenantSettings } from '../domain/tenant-settings.js';
import { TenantRepository } from '../infrastructure/tenant.repository.js';
import { TenantSettingsRepository } from '../infrastructure/tenant-settings.repository.js';

/** The company profile and its provisioning (tenant-management.md). */
@Injectable()
export class TenantService {
  constructor(
    private readonly context: TenantContext,
    private readonly transactions: TransactionRunner,
    private readonly tenants: TenantRepository,
    private readonly settings: TenantSettingsRepository,
  ) {}

  /**
   * Provisions a tenant: the tenant row and its default settings, in one transaction inside the new tenant's
   * context (so RLS and the `tenant_id` defaults apply from the first row). Callers — setup, signup, platform
   * (session 8) — add the owner membership and default roles in the same step as those modules arrive.
   */
  async create(input: CreateTenantInput): Promise<Tenant> {
    const data = CreateTenantInput.parse(input);
    return this.context.run(uuidv7(), () =>
      this.transactions.run(async () => {
        const tenant = await this.tenants.insertCurrent(data);
        await this.settings.insert(defaultTenantSettings(), TENANT_SETTINGS_SCHEMA_VERSION);
        return tenant;
      }),
    );
  }

  /** The tenant of the current context. */
  async getCurrent(): Promise<Tenant> {
    const tenant = await this.tenants.findCurrent();
    if (tenant === null) throw new NotFoundError();
    return tenant;
  }

  /** Updates the company profile; slug and base currency are not editable here. */
  async updateProfile(patch: TenantProfilePatch, expectedVersion: number): Promise<Tenant> {
    const changes = TenantProfilePatch.parse(patch);
    return this.transactions.run(async () => {
      const updated = await this.tenants.updateCurrent(changes, expectedVersion);
      if (updated !== null) return updated;
      await this.getCurrent(); // missing → 404; otherwise the version was stale
      throw new ConflictError(
        'VERSION_CONFLICT',
        'The company profile was changed by someone else. Reload and try again.',
      );
    });
  }
}
