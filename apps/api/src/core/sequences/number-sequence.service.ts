import { Injectable } from '@nestjs/common';

import { TenantContext, TransactionRunner } from '../tenancy/index.js';
import { assertSequenceKey, formatSequenceCode } from './sequence-code.js';

export interface NextNumberOptions {
  /** Prefix of the code, fixed when the sequence is first used (e.g. `PRJ-2026-`). Later calls keep the stored one. */
  readonly prefix: string;
  /** Minimum digits of the numeric part (zero-padded). Default 4. */
  readonly width?: number;
}

export interface AllocatedNumber {
  readonly value: bigint;
  /** The human number, e.g. `PRJ-2026-0007`. Store it in the row's `code`/`*_no` column. */
  readonly code: string;
}

/**
 * Per-tenant human numbers (05 §1 "Human numbers", `number_sequences`). Call it inside the use case's transaction,
 * together with the insert that uses the number (05 §5): the row lock taken by the increment serialises concurrent
 * allocations until commit, and a rollback releases the number — so numbers are sequential but not gapless.
 */
@Injectable()
export class NumberSequenceService {
  constructor(
    private readonly context: TenantContext,
    private readonly transactions: TransactionRunner,
  ) {}

  /** Allocates the next number of `sequenceKey` for the context's tenant, creating the sequence on first use. */
  async next(sequenceKey: string, options: NextNumberOptions): Promise<AllocatedNumber> {
    assertSequenceKey(sequenceKey);
    const tenantId = this.context.requireTenantId();
    return this.transactions.run(async (tx) => {
      // One statement: create at 1 or increment; ON CONFLICT takes the row lock (UPDATE … RETURNING semantics).
      const [row] = await tx.$queryRaw<{ value: bigint; prefix: string }[]>`
        INSERT INTO number_sequences (tenant_id, sequence_key, prefix, next_value)
        VALUES (${tenantId}::uuid, ${sequenceKey}, ${options.prefix}, 2)
        ON CONFLICT (tenant_id, sequence_key)
        DO UPDATE SET next_value = number_sequences.next_value + 1, updated_at = now()
        WHERE number_sequences.tenant_id = ${tenantId}::uuid
        RETURNING next_value - 1 AS value, prefix`;
      if (row === undefined) throw new Error(`Sequence "${sequenceKey}" returned no row`);
      return { value: row.value, code: formatSequenceCode(row.prefix, row.value, options.width) };
    });
  }
}
