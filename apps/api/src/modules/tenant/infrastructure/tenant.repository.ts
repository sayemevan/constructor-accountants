import { Injectable } from '@nestjs/common';
import type { CreateTenantInput, TenantProfilePatch } from '@repo/contracts';

import { ConflictError } from '../../../core/errors/index.js';
import { AppTenantDatabase, TenantContext } from '../../../core/tenancy/index.js';
import { omitUndefined } from '../../../core/utils/index.js';
import type { Tenant } from '../domain/tenant.js';

/**
 * `tenants` is a global table (no RLS), so this repository is its only guard: every read and write is filtered by
 * the tenant in {@link TenantContext} — never by an id from a caller (06 rules 1–2).
 */
@Injectable()
export class TenantRepository {
  constructor(
    private readonly database: AppTenantDatabase,
    private readonly context: TenantContext,
  ) {}

  /** Inserts the context's tenant (provisioning runs inside the new tenant's context). */
  async insertCurrent(input: CreateTenantInput): Promise<Tenant> {
    try {
      return await this.database.client.tenant.create({
        data: { ...omitUndefined(input), id: this.context.requireTenantId() },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('DUPLICATE_VALUE', 'This company address is already taken.', [
          { path: 'slug', code: 'duplicate', message: 'This value is already in use.' },
        ]);
      }
      throw error;
    }
  }

  findCurrent(): Promise<Tenant | null> {
    return this.database.client.tenant.findUnique({
      where: { id: this.context.requireTenantId() },
    });
  }

  /** Applies the patch if the row is still at `expectedVersion`; `null` when it is not (or is missing). */
  async updateCurrent(patch: TenantProfilePatch, expectedVersion: number): Promise<Tenant | null> {
    const id = this.context.requireTenantId();
    const { count } = await this.database.client.tenant.updateMany({
      where: { id, version: expectedVersion },
      data: { ...omitUndefined(patch), version: { increment: 1 } },
    });
    if (count === 0) return null;
    return this.database.client.tenant.findUnique({ where: { id } });
  }
}

/** Prisma P2002, recognised by shape (the generated client owns the error classes). */
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
