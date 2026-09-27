import type { PrismaClient } from '../../generated/prisma/client.js';
import { TenantDatabase, type TenantClient } from './tenant-database.js';

/**
 * The application's {@link TenantDatabase} over the generated PrismaClient (`app_user`), provided by
 * `DatabaseModule`. Repositories inject this and use `client`; application services use {@link TransactionRunner}.
 * A subclass rather than a type alias because Nest resolves constructor parameters by their runtime class.
 */
export class AppTenantDatabase extends TenantDatabase<PrismaClient> {}

/** The tenant-scoped client repositories query through: models and raw queries, no `$transaction`. */
export type AppTenantClient = TenantClient<PrismaClient>;
