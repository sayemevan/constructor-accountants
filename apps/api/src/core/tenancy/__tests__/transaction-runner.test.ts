import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { AppTenantDatabase } from '../app-tenant-database.js';
import { TenantContext, TenantContextMissingError } from '../tenant-context.js';
import { TransactionRunner } from '../transaction-runner.js';

/**
 * A stand-in PrismaClient with just the members TenantDatabase calls: `$transaction(fn)` hands `fn` a fresh tx
 * object. Unit scope only — the real transaction behaviour is covered by the integration tests.
 */
function fakePrisma() {
  const executeRaw = vi.fn<(...args: unknown[]) => Promise<number>>(() => Promise.resolve(1));
  const transactions: object[] = [];
  const client = {
    $extends: () => ({}),
    $executeRaw: executeRaw,
    $transaction: async (fn: (tx: object) => Promise<unknown>) => {
      const tx = { $executeRaw: executeRaw };
      transactions.push(tx);
      return fn(tx);
    },
  };
  return { client, executeRaw, transactions };
}

function setup() {
  const prisma = fakePrisma();
  const context = new TenantContext();
  const database = new AppTenantDatabase(prisma.client as never, context);
  return { ...prisma, context, runner: new TransactionRunner(database) };
}

describe('TransactionRunner', () => {
  it("opens one transaction, sets the context's tenant first, and returns the result", async () => {
    const { context, runner, executeRaw, transactions } = setup();
    const tenantId = randomUUID();

    const result = await context.run(tenantId, () => runner.run((tx) => Promise.resolve(tx)));

    expect(transactions).toHaveLength(1);
    expect(result).toBe(transactions[0]);
    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(executeRaw.mock.calls[0]?.slice(1)).toEqual([tenantId]);
  });

  it('joins the open transaction when nested (e.g. another module service called inside a use case)', async () => {
    const { context, runner, transactions } = setup();

    await context.run(randomUUID(), () =>
      runner.run(async (outer) => {
        const inner = await runner.run((tx) => Promise.resolve(tx));
        expect(inner).toBe(outer);
      }),
    );

    expect(transactions).toHaveLength(1);
  });

  it('refuses to run without a tenant context', async () => {
    const { runner, transactions } = setup();
    await expect(runner.run(() => Promise.resolve())).rejects.toBeInstanceOf(
      TenantContextMissingError,
    );
    expect(transactions).toHaveLength(0);
  });
});
