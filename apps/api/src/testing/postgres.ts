import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

/**
 * Integration-test PostgreSQL (14): a throwaway postgres:17 container with the production role model and every
 * migration applied. Test-only code — excluded from the build.
 */

const API_ROOT = join(import.meta.dirname, '..', '..');
/** The same role bootstrap as local dev, so tests run against app_owner / app_user exactly as deployed (06). */
const ROLES_SQL = join(
  API_ROOT,
  '..',
  '..',
  'infrastructure',
  'compose',
  'postgres-init',
  '01-roles-and-database.sql',
);
const DATABASE = 'construction_erp';
const POSTGRES_IMAGE = 'postgres:17';

export type DatabaseRole = 'postgres' | 'app_owner' | 'app_user' | 'app_platform';

export interface TestDatabase {
  /** Connection URL for a role. `app_platform` (BYPASSRLS) exists only after {@link createPlatformRole}. */
  url(role: DatabaseRole): string;
  /** Runs SQL (multi-statement allowed, no parameters) as the given role. */
  exec(role: DatabaseRole, sql: string): Promise<void>;
  /** Runs one parameterised query as the given role. */
  query<R extends pg.QueryResultRow>(
    role: DatabaseRole,
    sql: string,
    values?: unknown[],
  ): Promise<R[]>;
  stop(): Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withUsername('postgres')
    .withPassword('postgres')
    .withDatabase('postgres')
    .withCopyFilesToContainer([
      { source: ROLES_SQL, target: '/docker-entrypoint-initdb.d/01-roles-and-database.sql' },
    ])
    .start();
  const database = testDatabase(container);
  await applyMigrations(database.url('app_owner'));
  return database;
}

/** The platform role of 06 (BYPASSRLS), with DML on every current table. Call after creating test tables. */
export async function createPlatformRole(database: TestDatabase): Promise<void> {
  await database.exec(
    'postgres',
    `CREATE ROLE app_platform LOGIN PASSWORD 'app_platform' NOSUPERUSER BYPASSRLS;
     GRANT CONNECT ON DATABASE ${DATABASE} TO app_platform;`,
  );
  await database.exec(
    'app_owner',
    `GRANT USAGE ON SCHEMA public TO app_platform;
     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_platform;`,
  );
}

function testDatabase(container: StartedPostgreSqlContainer): TestDatabase {
  const url = (role: DatabaseRole): string => {
    const target = new URL(container.getConnectionUri());
    target.username = role;
    target.password = role;
    target.pathname = `/${DATABASE}`;
    return target.toString();
  };
  const withClient = async <T>(role: DatabaseRole, fn: (client: pg.Client) => Promise<T>) => {
    const client = new pg.Client({ connectionString: url(role) });
    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.end();
    }
  };
  return {
    url,
    exec: (role, sql) =>
      withClient(role, async (client) => {
        await client.query(sql);
      }),
    query: <R extends pg.QueryResultRow>(role: DatabaseRole, sql: string, values?: unknown[]) =>
      withClient(role, async (client) => (await client.query<R>(sql, values)).rows),
    stop: async () => {
      await container.stop();
    },
  };
}

/** `prisma migrate deploy` as the owner role — the same path as `cli.js migrate` in production. */
async function applyMigrations(migrationUrl: string): Promise<void> {
  const require = createRequire(import.meta.url);
  const prismaBin = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
  await promisify(execFile)(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env: { ...process.env, DATABASE_MIGRATION_URL: migrationUrl },
  });
}
