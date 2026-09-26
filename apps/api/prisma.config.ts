import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

// Prisma CLI configuration (generate, migrate). The running API never reads this file.
// Local convenience: load apps/api/.env when present. Real environments inject variables directly.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    // Migrations run as the owner role (app_owner), never as the runtime app_user role (06).
    // `prisma generate` needs no database, so a missing URL is only fatal for commands that connect.
    url: process.env.DATABASE_MIGRATION_URL ?? '',
  },
});
