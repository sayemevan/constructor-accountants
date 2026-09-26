import { Controller, Get } from '@nestjs/common';
import type { ApiErrorDetail, HealthResponse } from '@repo/contracts';

import { DatabaseHealthService } from '../database/index.js';
import { ServiceUnavailableError } from '../errors/index.js';
import { Public } from '../security/public.decorator.js';

/** Unversioned probes for orchestrators and the reverse proxy (17). No tenant data, no auth. */
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly database: DatabaseHealthService) {}

  /** The process is up and serving HTTP. Never touches dependencies (a DB outage must not restart the pod). */
  @Get('live')
  live(): HealthResponse {
    return { status: 'ok' };
  }

  /** Ready for traffic: database reachable and migrations current. 503 otherwise. */
  @Get('ready')
  async ready(): Promise<HealthResponse> {
    if (!(await this.database.isReachable())) {
      throw notReady({ path: 'database', code: 'DOWN', message: 'The database is unreachable.' });
    }
    const pending = await this.database.pendingMigrations();
    if (pending.length > 0) {
      throw notReady({
        path: 'migrations',
        code: 'PENDING',
        message: `${String(pending.length)} database migration(s) have not been applied.`,
      });
    }
    return { status: 'ok', checks: { database: 'up', migrations: 'up' } };
  }
}

function notReady(detail: ApiErrorDetail): ServiceUnavailableError {
  return new ServiceUnavailableError('The service is not ready.', [detail]);
}
