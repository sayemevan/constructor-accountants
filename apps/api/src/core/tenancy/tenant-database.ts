import { AsyncLocalStorage } from 'node:async_hooks';

import { Prisma } from '@prisma/client/extension';
import type { ITXClientDenyList } from '@prisma/client/runtime/client';

import type { TenantContext } from './tenant-context.js';

/**
 * Any generated PrismaClient. Generic so the same code serves the application client and the spike's test-only
 * client; the members actually used are typed by {@link RuntimeClient}.
 */
export interface PrismaClientLike {
  $transaction: (...args: never[]) => Promise<unknown>;
  $executeRaw: (...args: never[]) => Prisma.PrismaPromise<number>;
  $extends: (...args: never[]) => unknown;
}

/** The members of a PrismaClient (or extension client) this module calls. */
interface RuntimeClient {
  $transaction<R>(fn: (tx: RuntimeClient) => Promise<R>): Promise<R>;
  $transaction(batch: Prisma.PrismaPromise<unknown>[]): Promise<unknown[]>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Prisma.PrismaPromise<number>;
  $extends(extension: unknown): unknown;
}

/**
 * What repositories see: models and raw queries, but no `$transaction`/`$extends`/`$connect`. Transactions go
 * through {@link TenantDatabase.transaction} so the tenant is set on the transaction's connection.
 */
export type TenantClient<C> = Omit<C, ITXClientDenyList | '$transaction'>;

/** Thrown when tenant-scoped code is used in a way that would escape the tenant or the open transaction. */
export class TenantDatabaseMisuseError extends Error {
  override readonly name = 'TenantDatabaseMisuseError';
}

interface OpenTransaction {
  readonly tx: unknown;
  readonly tenantId: string;
}

/**
 * Layer 3 of 06 (database RLS), seen from the application: every statement runs in a transaction whose first
 * statement is `set_config('app.tenant_id', <TenantContext tenant>, true)`. Transaction-local, so a pooled
 * connection never carries a tenant into the next checkout (safe with PgBouncer transaction pooling too).
 *
 * - `client` outside {@link transaction}: each operation is wrapped as `$transaction([set_config, operation])`.
 * - `client` inside {@link transaction}: the interactive transaction client (tenant set once at BEGIN); nested
 *   `transaction()` calls join it.
 * - No tenant context → {@link TenantContextMissingError} before any SQL runs. If the check were bypassed, RLS
 *   still matches no rows (fail closed).
 */
export class TenantDatabase<C extends PrismaClientLike> {
  private readonly openTransaction = new AsyncLocalStorage<OpenTransaction>();
  private readonly autoClient: TenantClient<C>;

  constructor(
    private readonly base: C,
    private readonly context: TenantContext,
  ) {
    this.autoClient = (base as unknown as RuntimeClient).$extends(
      this.autoTransactionExtension(),
    ) as TenantClient<C>;
  }

  /** The client for the current tenant: the open transaction's client, or the auto-wrapping client. */
  get client(): TenantClient<C> {
    const open = this.openTransaction.getStore();
    if (open === undefined) return this.autoClient;
    this.assertSameTenant(open);
    return open.tx as TenantClient<C>;
  }

  /** Runs `fn` in one interactive transaction for the current tenant; joins the open one when nested. */
  async transaction<R>(fn: (tx: TenantClient<C>) => Promise<R>): Promise<R> {
    const open = this.openTransaction.getStore();
    if (open !== undefined) {
      this.assertSameTenant(open);
      return fn(open.tx as TenantClient<C>);
    }
    const tenantId = this.context.requireTenantId();
    const base = this.base as unknown as RuntimeClient;
    return base.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return this.openTransaction.run({ tx, tenantId }, () => fn(tx as unknown as TenantClient<C>));
    });
  }

  private autoTransactionExtension() {
    const context = this.context;
    const openTransaction = this.openTransaction;
    return Prisma.defineExtension((extensible) => {
      const client = extensible as unknown as RuntimeClient;
      return extensible.$extends({
        name: 'tenant-auto-transaction',
        query: {
          async $allOperations({ args, query }) {
            const tenantId = context.requireTenantId();
            if (openTransaction.getStore() !== undefined) {
              // A client captured before transaction() started would silently run outside the transaction.
              throw new TenantDatabaseMisuseError(
                'Auto-transaction client used inside TenantDatabase.transaction(); use the tx client',
              );
            }
            const [, result] = await client.$transaction([
              client.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
              // `query` returns a PrismaPromise at runtime; that is what lets it join the batch transaction.
              query(args) as Prisma.PrismaPromise<unknown>,
            ]);
            return result;
          },
        },
      });
    });
  }

  private assertSameTenant(open: OpenTransaction): void {
    if (this.context.requireTenantId() !== open.tenantId) {
      throw new TenantDatabaseMisuseError(
        'Tenant context changed inside an open tenant transaction',
      );
    }
  }
}
