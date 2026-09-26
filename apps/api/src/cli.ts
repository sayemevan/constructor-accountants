import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { ConfigValidationError, loadConfig } from './core/config/index.js';

/**
 * Operational one-off commands, shipped in the api image (17):
 *   node dist/cli.js migrate   — apply pending migrations as the owner role. Run before rolling out new containers;
 *                                app processes never migrate on startup.
 * `seed` and `setup` are added with the tenant module (roadmap steps 9+).
 */
type Command = (args: readonly string[]) => Promise<number>;

const APP_ROOT = join(import.meta.dirname, '..');

const commands: Record<string, Command> = {
  migrate: migrate,
};

async function migrate(): Promise<number> {
  const config = loadConfig();
  if (config.database.migrationUrl === undefined) {
    throw new ConfigValidationError(
      'Invalid environment configuration:\n  - DATABASE_MIGRATION_URL: required for migrate',
    );
  }
  return runPrisma(['migrate', 'deploy'], { DATABASE_MIGRATION_URL: config.database.migrationUrl });
}

/** Runs the Prisma CLI bundled with the app (no npx, no network) from the app root, where prisma.config.ts lives. */
function runPrisma(args: readonly string[], env: Record<string, string>): Promise<number> {
  const require = createRequire(import.meta.url);
  const prismaBin = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prismaBin, ...args], {
      cwd: APP_ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      resolve(code ?? 1);
    });
  });
}

async function main(argv: readonly string[]): Promise<number> {
  const [name, ...rest] = argv;
  const command = name === undefined ? undefined : commands[name];
  if (command === undefined) {
    process.stderr.write(
      `Usage: cli.js <command>\nCommands: ${Object.keys(commands).join(', ')}\n`,
    );
    return 64; // EX_USAGE
  }
  return command(rest);
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    // Config errors are user-facing; anything else is a bug and needs its stack.
    const output =
      error instanceof ConfigValidationError
        ? error.message
        : error instanceof Error
          ? (error.stack ?? error.message)
          : String(error);
    process.stderr.write(`${output}\n`);
    process.exitCode = 1;
  },
);
