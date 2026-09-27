import { performance } from 'node:perf_hooks';

import { afterAll, beforeAll, it } from 'vitest';

import { type SpikeFixture, startSpike } from './spike-fixture.js';

/**
 * Tenancy spike overhead measurement (ADR-0005). Not a test: run with `pnpm --filter @repo/api perf:tenancy`.
 *
 *   A  baseline   — app_platform (BYPASSRLS), plain query with an explicit tenant_id predicate, no transaction
 *   B  tx only    — app_platform, `$transaction([set_config, query])`: the wrapping cost without RLS
 *   C  tenant     — app_user through TenantDatabase (auto-transaction + RLS): what repositories will run
 *   D  tenant tx  — app_user, one TenantDatabase.transaction() running the query (tenant set once per tx)
 *
 * B − A = transaction round trips; C − B = RLS policy evaluation.
 */

const ROWS_PER_TENANT = 10_000;
const WARMUP = 300;
const ITERATIONS = 3_000;
const CONCURRENCY = 50;
const CONCURRENT_OPS = 10_000;

let spike: SpikeFixture;
let sampleIds: string[];

beforeAll(async () => {
  spike = await startSpike(10);
  for (const tenantId of [spike.tenantA, spike.tenantB]) {
    for (let offset = 0; offset < ROWS_PER_TENANT; offset += 1_000) {
      await spike.platform.spikeProject.createMany({
        data: Array.from({ length: 1_000 }, (_, i) => ({
          tenantId,
          name: `Project ${String(offset + i).padStart(5, '0')}`,
        })),
      });
    }
  }
  await spike.database.exec('app_owner', 'ANALYZE spike_projects');
  const rows = await spike.platform.spikeProject.findMany({
    where: { tenantId: spike.tenantA },
    select: { id: true },
    take: 500,
  });
  sampleIds = rows.map((row) => row.id);
});

afterAll(async () => {
  await spike.close();
});

it('measures tenancy overhead', async () => {
  const tenantId = spike.tenantA;
  const idAt = (i: number): string => {
    const id = sampleIds[i % sampleIds.length];
    if (id === undefined) throw new Error('no sample ids');
    return id;
  };
  const inTenant = <T>(fn: () => Promise<T>) => spike.context.run(tenantId, fn);
  const platform = spike.platform;
  const tenantDb = spike.tenantDb;

  const byId = {
    'A baseline': (i: number) =>
      platform.spikeProject.findUnique({ where: { tenantId_id: { tenantId, id: idAt(i) } } }),
    'B tx only': (i: number) =>
      platform.$transaction([
        platform.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
        platform.spikeProject.findUnique({ where: { tenantId_id: { tenantId, id: idAt(i) } } }),
      ]),
    'C tenant': (i: number) =>
      inTenant(() =>
        tenantDb.client.spikeProject.findUnique({
          where: { tenantId_id: { tenantId, id: idAt(i) } },
        }),
      ),
    'D tenant tx': (i: number) =>
      inTenant(() =>
        tenantDb.transaction((tx) =>
          tx.spikeProject.findUnique({ where: { tenantId_id: { tenantId, id: idAt(i) } } }),
        ),
      ),
  };
  const page = { orderBy: { name: 'asc' as const }, take: 50, skip: 0 };
  const list = {
    'A baseline': (i: number) =>
      platform.spikeProject.findMany({ where: { tenantId }, ...page, skip: (i * 50) % 5_000 }),
    'B tx only': (i: number) =>
      platform.$transaction([
        platform.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`,
        platform.spikeProject.findMany({ where: { tenantId }, ...page, skip: (i * 50) % 5_000 }),
      ]),
    'C tenant': (i: number) =>
      inTenant(() =>
        tenantDb.client.spikeProject.findMany({
          where: { tenantId },
          ...page,
          skip: (i * 50) % 5_000,
        }),
      ),
    'D tenant tx': (i: number) =>
      inTenant(() =>
        tenantDb.transaction((tx) =>
          tx.spikeProject.findMany({ where: { tenantId }, ...page, skip: (i * 50) % 5_000 }),
        ),
      ),
  };
  // A unit of work of 5 reads: plain vs one tenant transaction (set_config once) vs 5 auto-transactions.
  const fiveReads = {
    'A baseline ×5': async (i: number) => {
      for (let k = 0; k < 5; k += 1) await byId['A baseline'](i + k);
    },
    'C tenant ×5 (auto)': (i: number) =>
      inTenant(async () => {
        for (let k = 0; k < 5; k += 1)
          await tenantDb.client.spikeProject.findUnique({
            where: { tenantId_id: { tenantId, id: idAt(i + k) } },
          });
      }),
    'D tenant tx ×5': (i: number) =>
      inTenant(() =>
        tenantDb.transaction(async (tx) => {
          for (let k = 0; k < 5; k += 1)
            await tx.spikeProject.findUnique({
              where: { tenantId_id: { tenantId, id: idAt(i + k) } },
            });
        }),
      ),
  };

  console.log(
    `\nDataset: 2 tenants × ${String(ROWS_PER_TENANT)} rows; ${String(ITERATIONS)} sequential iterations each.`,
  );
  for (const [title, cases] of Object.entries({
    'findUnique by (tenant_id, id)': byId,
    'findMany page of 50 ordered by name': list,
    'unit of work: 5 reads': fiveReads,
  })) {
    console.log(`\n${title}`);
    console.table(await measureSequential(cases));
  }

  console.log(
    `\nThroughput: ${String(CONCURRENT_OPS)} findUnique, ${String(CONCURRENCY)} concurrent callers, pool of 10`,
  );
  console.table({
    'A baseline': await measureThroughput(byId['A baseline']),
    'C tenant': await measureThroughput(byId['C tenant']),
    'D tenant tx': await measureThroughput(byId['D tenant tx']),
  });

  console.log('\nPlans as app_user (RLS applied):');
  for (const sql of [
    `SELECT id, name FROM spike_projects WHERE tenant_id = '${tenantId}' AND id = '${idAt(0)}'`,
    `SELECT id, name FROM spike_projects WHERE tenant_id = '${tenantId}' ORDER BY name LIMIT 50`,
    `SELECT id, name FROM spike_projects ORDER BY name LIMIT 50`,
  ]) {
    const plan = await inTenant(() =>
      tenantDb.transaction((tx) =>
        tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN ${sql}`),
      ),
    );
    console.log(`\n${sql}\n${plan.map((row) => `  ${row['QUERY PLAN']}`).join('\n')}`);
  }
});

type Case = (i: number) => Promise<unknown>;

async function measureSequential(cases: Record<string, Case>) {
  const results: Record<string, { p50_ms: string; p95_ms: string; mean_ms: string }> = {};
  for (const [name, run] of Object.entries(cases)) {
    for (let i = 0; i < WARMUP; i += 1) await run(i);
    const samples: number[] = [];
    for (let i = 0; i < ITERATIONS; i += 1) {
      const start = performance.now();
      await run(i);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const at = (q: number) => (samples[Math.floor(q * (samples.length - 1))] ?? 0).toFixed(3);
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    results[name] = { p50_ms: at(0.5), p95_ms: at(0.95), mean_ms: mean.toFixed(3) };
  }
  return results;
}

async function measureThroughput(run: Case) {
  let next = 0;
  const worker = async () => {
    while (next < CONCURRENT_OPS) await run(next++);
  };
  const start = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const seconds = (performance.now() - start) / 1_000;
  return { ops_per_s: Math.round(CONCURRENT_OPS / seconds) };
}
