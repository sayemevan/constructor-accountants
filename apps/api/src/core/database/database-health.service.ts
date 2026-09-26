import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { PrismaService } from './prisma.service.js';

/** `apps/api/prisma/migrations`, from both `src/core/database` and `dist/core/database`. Shipped in the api image. */
const MIGRATIONS_DIR = join(import.meta.dirname, '..', '..', '..', 'prisma', 'migrations');

/** Readiness probes for `/api/health/ready` (17): database reachable and every bundled migration applied. */
@Injectable()
export class DatabaseHealthService {
  private bundledMigrations: Promise<string[]> | undefined;

  constructor(private readonly prisma: PrismaService) {}

  async isReachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /** Names of migrations bundled with this build that the database has not applied successfully. */
  async pendingMigrations(): Promise<string[]> {
    const [bundled, applied] = await Promise.all([
      this.listBundledMigrations(),
      this.listAppliedMigrations(),
    ]);
    return bundled.filter((name) => !applied.has(name));
  }

  private listBundledMigrations(): Promise<string[]> {
    this.bundledMigrations ??= readdir(MIGRATIONS_DIR, { withFileTypes: true }).then((entries) =>
      entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    );
    return this.bundledMigrations;
  }

  private async listAppliedMigrations(): Promise<Set<string>> {
    const table = await this.prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS "exists"`;
    if (table[0]?.exists !== true) return new Set();
    const rows = await this.prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    return new Set(rows.map((row) => row.migration_name));
  }
}
