import { Injectable } from '@nestjs/common';

import { AppTenantDatabase, type AppTenantClient } from './app-tenant-database.js';

/**
 * Runs a use case in one tenant-scoped transaction (12 "Application services"). Repositories called inside `fn`
 * see the same transaction through `AppTenantDatabase.client`, and nested `run` calls — including other modules'
 * services — join it instead of opening a new one.
 */
@Injectable()
export class TransactionRunner {
  constructor(private readonly database: AppTenantDatabase) {}

  run<R>(fn: (tx: AppTenantClient) => Promise<R>): Promise<R> {
    return this.database.transaction(fn);
  }
}
