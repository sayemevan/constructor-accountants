import { AsyncLocalStorage } from 'node:async_hooks';

/** Thrown when tenant-scoped code runs outside {@link TenantContext.run}. A programming error, never a user error. */
export class TenantContextMissingError extends Error {
  override readonly name = 'TenantContextMissingError';

  constructor() {
    super('No tenant context: tenant-scoped data access must run inside TenantContext.run()');
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tenant of the current request or job (06 "Tenant context lifecycle"), propagated through async calls with
 * AsyncLocalStorage. Set only by TenantGuard (HTTP) and the job runner — never from client input.
 */
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<{ readonly tenantId: string }>();

  /**
   * Runs `fn` for `tenantId`. The result is awaited INSIDE the context on purpose: Prisma queries are lazy
   * (they execute on `.then`), so `run(t, () => db.x.findMany())` would otherwise execute outside the context.
   */
  async run<T>(tenantId: string, fn: () => T | PromiseLike<T>): Promise<T> {
    if (!UUID.test(tenantId)) throw new TypeError('TenantContext.run: tenantId must be a UUID');
    return this.storage.run({ tenantId }, async () => await fn());
  }

  /** The current tenant id, or throws {@link TenantContextMissingError}. */
  requireTenantId(): string {
    const store = this.storage.getStore();
    if (store === undefined) throw new TenantContextMissingError();
    return store.tenantId;
  }
}
