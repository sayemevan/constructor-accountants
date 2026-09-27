import { randomUUID } from 'node:crypto';

import type { TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError } from '../../../core/errors/index.js';
import {
  AppTenantDatabase,
  TenantContext,
  TenantContextMissingError,
} from '../../../core/tenancy/index.js';
import { compileWithDatabase } from '../../../testing/nest.js';
import { startTestDatabase, type TestDatabase } from '../../../testing/postgres.js';
import { makeTenantInput } from '../../../testing/tenant-factory.js';
import { SettingsService, type Tenant, TenantModule, TenantService } from '../index.js';

/** The tenant module against real PostgreSQL with migrations applied, always with two tenants (06 rule 12). */
describe('tenant module against PostgreSQL', () => {
  let database: TestDatabase;
  let moduleRef: TestingModule;
  let context: TenantContext;
  let tenants: TenantService;
  let settings: SettingsService;
  let tenantA: Tenant;
  let tenantB: Tenant;

  const as = <T>(tenant: Tenant, fn: () => Promise<T>) => context.run(tenant.id, fn);

  beforeAll(async () => {
    database = await startTestDatabase();
    moduleRef = await compileWithDatabase(database, [TenantModule]);
    context = moduleRef.get(TenantContext);
    tenants = moduleRef.get(TenantService);
    settings = moduleRef.get(SettingsService);

    tenantA = await tenants.create(makeTenantInput({ name: 'Alpha Builders' }));
    tenantB = await tenants.create(makeTenantInput({ name: 'Beta Construction' }));
  });

  afterAll(async () => {
    await moduleRef.close();
    await database.stop();
  });

  describe('create', () => {
    it('provisions an ACTIVE tenant with a UUIDv7 id and default settings', async () => {
      expect(tenantA).toMatchObject({ name: 'Alpha Builders', status: 'ACTIVE', version: 1 });
      expect(tenantA.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
      const snapshot = await as(tenantA, () => settings.get());
      expect(snapshot.version).toBe(1);
      expect(snapshot.settings.payroll.prorationBasis).toBe('CALENDAR_DAYS');
    });

    it('rejects a duplicate slug with DUPLICATE_VALUE and leaves nothing half-created', async () => {
      const before = await countRows();
      const error = await tenants
        .create(makeTenantInput({ slug: tenantA.slug }))
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error).toMatchObject({ code: 'DUPLICATE_VALUE' });
      expect(await countRows()).toEqual(before);
    });

    it('validates input before touching the database', async () => {
      await expect(tenants.create(makeTenantInput({ baseCurrency: 'XXX' }))).rejects.toMatchObject({
        name: 'ZodError',
      });
    });

    it('works even when called from inside another tenant context', async () => {
      const created = await as(tenantA, () => tenants.create(makeTenantInput({ name: 'Gamma' })));
      expect(await as(created, () => tenants.getCurrent())).toMatchObject({ name: 'Gamma' });
      expect(await as(tenantA, () => tenants.getCurrent())).toMatchObject({ id: tenantA.id });
    });
  });

  describe('getCurrent', () => {
    it("returns the context's tenant only", async () => {
      expect((await as(tenantA, () => tenants.getCurrent())).id).toBe(tenantA.id);
      expect((await as(tenantB, () => tenants.getCurrent())).id).toBe(tenantB.id);
    });

    it('is 404 for a tenant id that does not exist', async () => {
      await expect(context.run(randomUUID(), () => tenants.getCurrent())).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('fails closed without a tenant context', async () => {
      await expect(tenants.getCurrent()).rejects.toBeInstanceOf(TenantContextMissingError);
      await expect(settings.get()).rejects.toBeInstanceOf(TenantContextMissingError);
    });
  });

  describe('updateProfile', () => {
    it("updates the context's tenant and bumps its version", async () => {
      const tenant = await tenants.create(makeTenantInput());
      const updated = await as(tenant, () =>
        tenants.updateProfile({ name: 'Renamed Ltd', city: 'Dhaka', email: null }, 1),
      );
      expect(updated).toMatchObject({ name: 'Renamed Ltd', city: 'Dhaka', version: 2 });
      expect(updated.slug).toBe(tenant.slug);
      expect((await as(tenantB, () => tenants.getCurrent())).name).toBe('Beta Construction');
    });

    it('rejects a stale version with VERSION_CONFLICT', async () => {
      const tenant = await tenants.create(makeTenantInput());
      await as(tenant, () => tenants.updateProfile({ name: 'First' }, 1));
      await expect(
        as(tenant, () => tenants.updateProfile({ name: 'Second' }, 1)),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
      expect((await as(tenant, () => tenants.getCurrent())).name).toBe('First');
    });

    it('does not accept slug or base currency changes', async () => {
      await expect(
        as(tenantA, () => tenants.updateProfile({ slug: 'new-slug' } as never, 1)),
      ).rejects.toMatchObject({ name: 'ZodError' });
      await expect(
        as(tenantA, () => tenants.updateProfile({ baseCurrency: 'USD' } as never, 1)),
      ).rejects.toMatchObject({ name: 'ZodError' });
    });
  });

  describe('settings', () => {
    it('updates one tenant without affecting the other', async () => {
      const updated = await as(tenantA, () =>
        settings.update({ approval: { paymentThreshold: '25000.00' } }, 1),
      );
      expect(updated.version).toBe(2);
      expect(updated.settings.approval.paymentThreshold).toBe('25000.00');
      expect((await as(tenantB, () => settings.get())).settings.approval.paymentThreshold).toBe(
        null,
      );
    });

    it('rejects a stale version with VERSION_CONFLICT', async () => {
      const tenant = await tenants.create(makeTenantInput());
      await as(tenant, () => settings.update({ payroll: { overtimeMultiplier: '2' } }, 1));
      await expect(
        as(tenant, () => settings.update({ payroll: { overtimeMultiplier: '3' } }, 1)),
      ).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
      expect((await as(tenant, () => settings.get())).settings.payroll.overtimeMultiplier).toBe(
        '2',
      );
    });

    it('lets exactly one of two concurrent updates at the same version win', async () => {
      const tenant = await tenants.create(makeTenantInput());
      const results = await Promise.allSettled([
        as(tenant, () => settings.update({ reminders: { dueReminderDays: [7] } }, 1)),
        as(tenant, () => settings.update({ reminders: { dueReminderDays: [14] } }, 1)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected')).toMatchObject({
        reason: { code: 'VERSION_CONFLICT' },
      });
      expect((await as(tenant, () => settings.get())).version).toBe(2);
    });

    it('writes nothing for a patch that changes nothing', async () => {
      const tenant = await tenants.create(makeTenantInput());
      const same = await as(tenant, () =>
        settings.update({ approval: { allowSelfApproval: false } }, 1),
      );
      expect(same.version).toBe(1);
    });
  });

  describe('database isolation (RLS on tenant_settings, grants on both tables)', () => {
    const settingsTenantIds = async () =>
      (
        await moduleRef.get(AppTenantDatabase).client.$queryRaw<
          { tenant_id: string }[]
        >`SELECT tenant_id::text FROM tenant_settings`
      ).map((row) => row.tenant_id);

    it('shows a tenant only its own settings row, even to raw SQL', async () => {
      expect(await as(tenantB, settingsTenantIds)).toEqual([tenantB.id]);
    });

    it("cannot update another tenant's settings row", async () => {
      const affected = await as(
        tenantB,
        () =>
          moduleRef.get(AppTenantDatabase).client.$executeRaw`
          UPDATE tenant_settings SET version = version + 100 WHERE tenant_id = ${tenantA.id}::uuid`,
      );
      expect(affected).toBe(0);
    });

    it('cannot insert a settings row for another tenant (WITH CHECK)', async () => {
      await expect(
        as(
          tenantB,
          () =>
            moduleRef.get(AppTenantDatabase).client.$executeRaw`
            INSERT INTO tenant_settings (tenant_id, settings, schema_version, updated_at)
            VALUES (${tenantA.id}::uuid, '{}'::jsonb, 1, now())`,
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it('denies DELETE on tenants and tenant_settings to app_user', async () => {
      await expect(database.exec('app_user', 'DELETE FROM tenants')).rejects.toThrow(
        /permission denied/,
      );
      await expect(database.exec('app_user', 'DELETE FROM tenant_settings')).rejects.toThrow(
        /permission denied/,
      );
    });

    it('enforces the slug format in the database too', async () => {
      await expect(
        database.exec(
          'app_owner',
          `INSERT INTO tenants (id, name, slug, base_currency, timezone, locale, updated_at)
           VALUES (gen_random_uuid(), 'X', 'Upper-Case', 'BDT', 'UTC', 'en', now())`,
        ),
      ).rejects.toThrow(/tenants_slug_format_check/);
    });
  });

  async function countRows() {
    const [row] = await database.query<{ tenants: number; settings: number }>(
      'app_owner',
      'SELECT (SELECT count(*)::int FROM tenants) AS tenants, (SELECT count(*)::int FROM tenant_settings) AS settings',
    );
    return row;
  }
});
