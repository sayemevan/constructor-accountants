import pg from 'pg';
import { PgBoss } from 'pg-boss';

/** The PostgreSQL schema pg-boss owns (its queue, job and schedule tables). No tenant data, no RLS. */
export const JOB_SCHEMA = 'pgboss';

const BAM_POLL_MS = 200;

/**
 * Installs or upgrades the pg-boss schema as the owner role, then grants the runtime role what pg-boss needs at run
 * time (DML + EXECUTE, no DDL). Part of `cli.js migrate` (17 "Database migrations"): the worker starts pg-boss with
 * `migrate: false` and fails fast when this step was skipped. Idempotent.
 */
export async function installJobSchema(options: {
  readonly ownerUrl: string;
  /** The role of DATABASE_URL (`app_user`). */
  readonly runtimeRole: string;
}): Promise<void> {
  const boss = new PgBoss({
    connectionString: options.ownerUrl,
    schema: JOB_SCHEMA,
    max: 2,
    migrate: true,
    supervise: false,
    schedule: false,
  });
  await boss.start();
  try {
    // Upgrades may leave index builds to pg-boss's background migrator; let them finish before exiting.
    await new Promise((resolve) => setTimeout(resolve, BAM_POLL_MS));
    while (boss.isBamWorking()) await new Promise((resolve) => setTimeout(resolve, BAM_POLL_MS));
  } finally {
    await boss.stop({ graceful: false });
  }

  const client = new pg.Client({ connectionString: options.ownerUrl });
  await client.connect();
  try {
    const schema = client.escapeIdentifier(JOB_SCHEMA);
    const role = client.escapeIdentifier(options.runtimeRole);
    await client.query(`
      GRANT USAGE ON SCHEMA ${schema} TO ${role};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role};
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${schema} TO ${role};`);
  } finally {
    await client.end();
  }
}

/** The user name of a PostgreSQL connection URL. */
export function roleOf(connectionUrl: string): string {
  const user = decodeURIComponent(new URL(connectionUrl).username);
  if (user === '') throw new TypeError('The connection URL has no user name');
  return user;
}
