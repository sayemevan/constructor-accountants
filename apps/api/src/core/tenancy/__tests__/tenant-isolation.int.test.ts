import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RLS_GAPS_SQL, type RlsGap } from '../rls-coverage.js';
import { TenantContextMissingError } from '../tenant-context.js';
import { TenantDatabase, TenantDatabaseMisuseError } from '../tenant-database.js';
import { type SpikeFixture, SpikePrismaClient, startSpike } from './spike/spike-fixture.js';

/**
 * Tenancy spike (roadmap step 7, ADR-0005): the three isolation layers of 06 against real PostgreSQL, with the
 * production role model (app_owner migrates, app_user runs the app, app_platform bypasses RLS).
 */
describe('tenant isolation (Prisma extension + RLS + composite FKs)', () => {
  let spike: SpikeFixture;
  let projectA: string;
  let projectB: string;

  const asTenant = <T>(tenantId: string, fn: () => Promise<T>) => spike.context.run(tenantId, fn);
  const db = () => spike.tenantDb.client;

  beforeAll(async () => {
    spike = await startSpike();
    projectA = await asTenant(spike.tenantA, async () => {
      const project = await db().spikeProject.create({ data: { name: 'A tower' } });
      await db().spikeProjectNote.create({ data: { projectId: project.id, body: 'A note' } });
      return project.id;
    });
    projectB = await asTenant(spike.tenantB, async () => {
      const project = await db().spikeProject.create({ data: { name: 'B villa' } });
      return project.id;
    });
  });

  afterAll(async () => {
    await spike.close();
  });

  describe('application layer (TenantContext)', () => {
    it('refuses to query without a tenant context, before any SQL runs', async () => {
      await expect(db().spikeProject.findMany()).rejects.toBeInstanceOf(TenantContextMissingError);
      await expect(spike.tenantDb.transaction(() => Promise.resolve())).rejects.toBeInstanceOf(
        TenantContextMissingError,
      );
    });

    it('fills tenant_id from the transaction setting, so callers never pass it', async () => {
      const rows = await spike.platform.spikeProject.findMany({
        select: { id: true, tenantId: true },
      });
      expect(rows).toEqual(
        expect.arrayContaining([
          { id: projectA, tenantId: spike.tenantA },
          { id: projectB, tenantId: spike.tenantB },
        ]),
      );
    });
  });

  describe('database layer (RLS, FORCE, app_user without BYPASSRLS)', () => {
    it('fails closed for a raw app_user client: reads nothing, inserts nothing', async () => {
      expect(await spike.rawAppUser.spikeProject.findMany()).toEqual([]);
      expect(await spike.rawAppUser.spikeProjectNote.count()).toBe(0);
      await expect(
        spike.rawAppUser.spikeProject.create({ data: { tenantId: spike.tenantA, name: 'sneaky' } }),
      ).rejects.toThrow(/row-level security/);
    });

    it("lists only the current tenant's rows", async () => {
      const names = await asTenant(spike.tenantB, () =>
        db().spikeProject.findMany({ select: { name: true } }),
      );
      expect(names).toEqual([{ name: 'B villa' }]);
      const notes = await asTenant(spike.tenantB, () => db().spikeProjectNote.findMany());
      expect(notes).toEqual([]);
    });

    it("returns null for another tenant's id (→ 404, never 403)", async () => {
      const found = await asTenant(spike.tenantB, () =>
        db().spikeProject.findUnique({
          where: { tenantId_id: { tenantId: spike.tenantB, id: projectA } },
        }),
      );
      expect(found).toBeNull();
      const byIdOnly = await asTenant(spike.tenantB, () =>
        db().spikeProject.findFirst({ where: { id: projectA } }),
      );
      expect(byIdOnly).toBeNull();
    });

    it("cannot update or delete another tenant's row", async () => {
      await asTenant(spike.tenantB, async () => {
        expect(
          await db().spikeProject.updateMany({
            where: { id: projectA },
            data: { name: 'hijacked' },
          }),
        ).toEqual({ count: 0 });
        await expect(
          db().spikeProject.update({ where: { id: projectA }, data: { name: 'hijacked' } }),
        ).rejects.toMatchObject({ code: 'P2025' });
        expect(await db().spikeProjectNote.deleteMany({ where: { projectId: projectA } })).toEqual({
          count: 0,
        });
      });
      const a = await spike.platform.spikeProject.findUniqueOrThrow({ where: { id: projectA } });
      expect(a.name).toBe('A tower');
      expect(await spike.platform.spikeProjectNote.count({ where: { projectId: projectA } })).toBe(
        1,
      );
    });

    it("rejects a row written with another tenant's tenant_id (WITH CHECK)", async () => {
      await expect(
        asTenant(spike.tenantB, () =>
          db().spikeProject.create({ data: { tenantId: spike.tenantA, name: 'planted in A' } }),
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        asTenant(spike.tenantB, () =>
          db().spikeProject.updateMany({
            where: { id: projectB },
            data: { tenantId: spike.tenantA },
          }),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('scopes raw queries through the tenant client too', async () => {
      const rows = await asTenant(
        spike.tenantB,
        () => db().$queryRaw<{ id: string }[]>`SELECT id FROM spike_projects`,
      );
      expect(rows).toEqual([{ id: projectB }]);
    });
  });

  describe('relational layer (composite FKs)', () => {
    it("rejects a reference to another tenant's row, even for a BYPASSRLS role", async () => {
      await expect(
        spike.platform.spikeProjectNote.create({
          data: { tenantId: spike.tenantB, projectId: projectA, body: 'cross-tenant' },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it("rejects a reference to another tenant's row from tenant context", async () => {
      await expect(
        asTenant(spike.tenantB, () =>
          db().spikeProjectNote.create({ data: { projectId: projectA, body: 'cross-tenant' } }),
        ),
      ).rejects.toMatchObject({ code: 'P2003' });
    });
  });

  describe('transactions and pooled connections', () => {
    it('runs an interactive transaction for one tenant; nested calls join it', async () => {
      const result = await asTenant(spike.tenantA, () =>
        spike.tenantDb.transaction(async (tx) => {
          const project = await tx.spikeProject.create({ data: { name: 'A tx project' } });
          const joined = await spike.tenantDb.transaction(async (inner) => {
            expect(inner).toBe(tx);
            return inner.spikeProjectNote.create({
              data: { projectId: project.id, body: 'inner' },
            });
          });
          const setting = await spike.tenantDb.client.$queryRaw<{ tenant: string }[]>`
            SELECT current_setting('app.tenant_id') AS tenant`;
          return {
            note: joined,
            tenant: setting[0]?.tenant,
            visible: await tx.spikeProject.count(),
          };
        }),
      );
      expect(result.note.tenantId).toBe(spike.tenantA);
      expect(result.tenant).toBe(spike.tenantA);
      expect(result.visible).toBe(2);
    });

    it('rolls back everything when the transaction fails', async () => {
      await expect(
        asTenant(spike.tenantA, () =>
          spike.tenantDb.transaction(async (tx) => {
            await tx.spikeProject.create({ data: { name: 'rolled back' } });
            throw new Error('boom');
          }),
        ),
      ).rejects.toThrow('boom');
      expect(await spike.platform.spikeProject.count({ where: { name: 'rolled back' } })).toBe(0);
    });

    it('refuses the auto-transaction client inside an open transaction and a tenant switch mid-transaction', async () => {
      const auto = spike.tenantDb.client;
      await asTenant(spike.tenantA, () =>
        spike.tenantDb.transaction(async () => {
          await expect(auto.spikeProject.count()).rejects.toBeInstanceOf(TenantDatabaseMisuseError);
          await expect(
            spike.context.run(spike.tenantB, () =>
              spike.tenantDb.transaction(() => Promise.resolve()),
            ),
          ).rejects.toBeInstanceOf(TenantDatabaseMisuseError);
        }),
      );
    });

    it('never leaks the tenant setting to the next user of a pooled connection', async () => {
      // Pool of 1: the raw client's next query reuses the connection a tenant transaction just used.
      const single = startSinglePoolPair(spike);
      try {
        await asTenant(spike.tenantA, () => single.scoped.client.spikeProject.count());
        const after = await single.raw.$queryRaw<{ tenant: string | null }[]>`
          SELECT current_setting('app.tenant_id', true) AS tenant`;
        // '' (not NULL) once a session has set it — the reason the policies use NULLIF(…, '').
        expect(after).toEqual([{ tenant: '' }]);
        expect(await single.raw.spikeProject.count()).toBe(0);
      } finally {
        await single.close();
      }
    });

    it('keeps tenants isolated under concurrent interleaved requests', async () => {
      const results = await Promise.all(
        Array.from({ length: 40 }, (_, i) => {
          const tenantId = i % 2 === 0 ? spike.tenantA : spike.tenantB;
          return asTenant(tenantId, async () => {
            const rows = await db().spikeProject.findMany({ select: { tenantId: true } });
            return { tenantId, seen: new Set(rows.map((row) => row.tenantId)) };
          });
        }),
      );
      for (const { tenantId, seen } of results) expect([...seen]).toEqual([tenantId]);
    });
  });

  describe('DB meta-check (every tenant_id table has RLS enabled + forced + a policy)', () => {
    it('passes for the migrated schema and the spike tables', async () => {
      expect(await spike.database.query<RlsGap>('app_user', RLS_GAPS_SQL)).toEqual([]);
    });

    it('reports a tenant-owned table that is missing FORCE or a policy', async () => {
      const table = `spike_unprotected_${randomUUID().slice(0, 8)}`;
      await spike.database.exec(
        'app_owner',
        `CREATE TABLE ${table} (id uuid PRIMARY KEY, tenant_id uuid NOT NULL);
         ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
      );
      try {
        expect(await spike.database.query<RlsGap>('app_user', RLS_GAPS_SQL)).toEqual([
          { table, rlsEnabled: true, rlsForced: false, policyCount: 0 },
        ]);
      } finally {
        await spike.database.exec('app_owner', `DROP TABLE ${table}`);
      }
    });
  });
});

/** A tenant-scoped and a raw view over ONE app_user client with a single-connection pool. */
function startSinglePoolPair(spike: SpikeFixture) {
  const shared = new SpikePrismaClient({
    adapter: new PrismaPg({ connectionString: spike.database.url('app_user'), max: 1 }),
  });
  return {
    scoped: new TenantDatabase(shared, spike.context),
    raw: shared,
    close: () => shared.$disconnect(),
  };
}
