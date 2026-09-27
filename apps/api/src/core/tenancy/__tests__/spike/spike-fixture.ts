import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';

import {
  createPlatformRole,
  startTestDatabase,
  type TestDatabase,
} from '../../../../testing/postgres.js';
import { TenantContext } from '../../tenant-context.js';
import { TenantDatabase } from '../../tenant-database.js';
import { PrismaClient as SpikePrismaClient } from './generated/client.js';

export { SpikePrismaClient };

/** Everything a spike test or measurement needs: real roles, real migrations, spike tables, two tenants. */
export interface SpikeFixture {
  readonly database: TestDatabase;
  readonly context: TenantContext;
  /** app_user, through the tenant-scoped layer — what repositories will use. */
  readonly tenantDb: TenantDatabase<SpikePrismaClient>;
  /** app_user, raw client with no tenant handling — proves the database fails closed on its own. */
  readonly rawAppUser: SpikePrismaClient;
  /** app_platform (BYPASSRLS) — baseline for measurements and for the composite-FK proof. */
  readonly platform: SpikePrismaClient;
  readonly tenantA: string;
  readonly tenantB: string;
  close(): Promise<void>;
}

export async function startSpike(poolSize = 10): Promise<SpikeFixture> {
  const database = await startTestDatabase();
  await database.exec('app_owner', await readFile(join(import.meta.dirname, 'spike.sql'), 'utf8'));
  await createPlatformRole(database);

  const client = (role: 'app_user' | 'app_platform') =>
    new SpikePrismaClient({
      adapter: new PrismaPg({ connectionString: database.url(role), max: poolSize }),
    });
  const rawAppUser = client('app_user');
  const platform = client('app_platform');
  const context = new TenantContext();
  const scopedBase = client('app_user');
  const tenantDb = new TenantDatabase(scopedBase, context);

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  await platform.spikeTenant.createMany({
    data: [
      { id: tenantA, name: 'Tenant A' },
      { id: tenantB, name: 'Tenant B' },
    ],
  });

  return {
    database,
    context,
    tenantDb,
    rawAppUser,
    platform,
    tenantA,
    tenantB,
    close: async () => {
      await Promise.all([scopedBase, rawAppUser, platform].map((c) => c.$disconnect()));
      await database.stop();
    },
  };
}
