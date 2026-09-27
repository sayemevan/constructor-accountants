import { randomUUID } from 'node:crypto';

import type { CreateTenantInput } from '@repo/contracts';

/**
 * A valid {@link CreateTenantInput} with a unique slug, so tests never collide on the platform-wide slug and never
 * depend on each other (14 "Conventions"). Test-only.
 */
export function makeTenantInput(overrides: Partial<CreateTenantInput> = {}): CreateTenantInput {
  return {
    name: 'Test Construction Ltd',
    slug: `test-${randomUUID().slice(0, 8)}`,
    baseCurrency: 'BDT',
    timezone: 'Asia/Dhaka',
    locale: 'en-US',
    ...overrides,
  };
}
