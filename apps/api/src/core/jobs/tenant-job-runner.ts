import { Injectable, Logger } from '@nestjs/common';

import { NotFoundError } from '../errors/index.js';
import { TenantContext } from '../tenancy/index.js';
import { TenantService } from '../../modules/tenant/index.js';

export type TenantJobResult<T> =
  | { readonly status: 'done'; readonly value: T }
  | { readonly status: 'skipped'; readonly reason: 'TENANT_NOT_FOUND' | 'TENANT_INACTIVE' };

/**
 * Runs job work for one tenant (06 "Jobs"): inside `TenantContext.run(tenantId)`, and only while the tenant exists
 * and is ACTIVE — work for a suspended or closed tenant is skipped (logged), not retried.
 */
@Injectable()
export class TenantJobRunner {
  private readonly logger = new Logger(TenantJobRunner.name);

  constructor(
    private readonly context: TenantContext,
    private readonly tenants: TenantService,
  ) {}

  run<T>(tenantId: string, fn: () => Promise<T>): Promise<TenantJobResult<T>> {
    return this.context.run(tenantId, async (): Promise<TenantJobResult<T>> => {
      const tenant = await this.tenants.getCurrent().catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      });
      if (tenant?.status !== 'ACTIVE') {
        const reason = tenant === null ? 'TENANT_NOT_FOUND' : 'TENANT_INACTIVE';
        this.logger.warn({ tenantId, reason }, 'tenant job skipped');
        return { status: 'skipped', reason };
      }
      return { status: 'done', value: await fn() };
    });
  }
}
