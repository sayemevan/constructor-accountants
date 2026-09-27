import type { TenantStatus } from '@repo/contracts';

/** A tenant (construction company) as the application sees it. */
export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly slug: string;
  readonly status: TenantStatus;
  readonly baseCurrency: string;
  readonly timezone: string;
  readonly locale: string;
  readonly countryCode: string | null;
  readonly taxId: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly logoFileId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Optimistic-locking version; pass it back to update. */
  readonly version: number;
}
