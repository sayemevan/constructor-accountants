import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { makeTestConfig } from '../../../testing/test-config.js';
import { APP_CONFIG, ConfigModule } from '../../config/index.js';
import {
  AppTenantDatabase,
  TenantContext,
  TenantContextMissingError,
  TransactionRunner,
} from '../../tenancy/index.js';
import { DatabaseModule } from '../database.module.js';
import { PrismaService } from '../prisma.service.js';

async function compile() {
  // PrismaService connects lazily, so resolving providers needs no database.
  return Test.createTestingModule({ imports: [ConfigModule, DatabaseModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(makeTestConfig())
    .compile();
}

describe('DatabaseModule wiring', () => {
  it('provides the tenancy layer over the one PrismaService', async () => {
    const moduleRef = await compile();

    expect(moduleRef.get(TenantContext) instanceof TenantContext).toBe(true);
    expect(moduleRef.get(AppTenantDatabase) instanceof AppTenantDatabase).toBe(true);
    expect(moduleRef.get(TransactionRunner) instanceof TransactionRunner).toBe(true);
    // PrismaClient's constructor returns a proxy, so `instanceof PrismaService` is false; check the shape.
    expect(typeof moduleRef.get(PrismaService).$transaction).toBe('function');

    await moduleRef.close();
  });

  it('fails closed before any SQL when no tenant context is set', async () => {
    const moduleRef = await compile();
    const runner = moduleRef.get(TransactionRunner);

    await expect(runner.run(() => Promise.resolve())).rejects.toBeInstanceOf(
      TenantContextMissingError,
    );
    await expect(
      moduleRef.get(AppTenantDatabase).client.$queryRaw`SELECT 1`,
    ).rejects.toBeInstanceOf(TenantContextMissingError);

    await moduleRef.close();
  });
});
