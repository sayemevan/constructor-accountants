import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import type { Tenant, TenantService } from '../../../modules/tenant/index.js';
import { NotFoundError } from '../../errors/index.js';
import { TenantContext } from '../../tenancy/index.js';
import { TenantJobRunner } from '../tenant-job-runner.js';

function setup(getCurrent: () => Promise<Pick<Tenant, 'status'>>) {
  const context = new TenantContext();
  const tenants = { getCurrent: vi.fn(getCurrent) } as unknown as TenantService;
  return { context, runner: new TenantJobRunner(context, tenants) };
}

describe('TenantJobRunner', () => {
  it("runs the work inside the tenant's context when the tenant is ACTIVE", async () => {
    const { context, runner } = setup(() => Promise.resolve({ status: 'ACTIVE' }));
    const tenantId = randomUUID();
    const result = await runner.run(tenantId, () => Promise.resolve(context.requireTenantId()));
    expect(result).toEqual({ status: 'done', value: tenantId });
  });

  it.each(['SUSPENDED', 'CLOSED'] as const)('skips the work for a %s tenant', async (status) => {
    const { runner } = setup(() => Promise.resolve({ status }));
    const work = vi.fn(() => Promise.resolve());
    expect(await runner.run(randomUUID(), work)).toEqual({
      status: 'skipped',
      reason: 'TENANT_INACTIVE',
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('skips the work for a tenant that does not exist', async () => {
    const { runner } = setup(() => Promise.reject(new NotFoundError()));
    const work = vi.fn(() => Promise.resolve());
    expect(await runner.run(randomUUID(), work)).toEqual({
      status: 'skipped',
      reason: 'TENANT_NOT_FOUND',
    });
    expect(work).not.toHaveBeenCalled();
  });

  it('propagates unexpected errors (so the job is retried)', async () => {
    const failure = new Error('database down');
    const { runner } = setup(() => Promise.reject(failure));
    await expect(runner.run(randomUUID(), () => Promise.resolve())).rejects.toBe(failure);
  });

  it('rejects a tenant id that is not a UUID before any work', async () => {
    const { runner } = setup(() => Promise.resolve({ status: 'ACTIVE' }));
    await expect(runner.run('tenant-1', () => Promise.resolve())).rejects.toBeInstanceOf(TypeError);
  });
});
