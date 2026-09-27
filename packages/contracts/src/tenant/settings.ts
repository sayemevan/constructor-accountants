import { z } from 'zod';

import { IsoDate, MoneyAmount } from '../common/primitives.js';

/**
 * Tenant settings (tenant-management.md, 05 `tenant_settings`): one typed, versioned JSON document per tenant.
 *
 * Versioning: every field has a default, so adding a field is backwards compatible — blobs stored before it existed
 * parse with the default and no version bump is needed. Bump {@link TENANT_SETTINGS_SCHEMA_VERSION} only for a
 * breaking reshape (rename, move, meaning change), and add the upgrade step in the tenant module's domain.
 */
export const TENANT_SETTINGS_SCHEMA_VERSION = 1;

/** How monthly salaries are prorated for partial periods (payroll.md). */
export const PayrollProrationBasis = z.enum(['CALENDAR_DAYS', 'WORKING_DAYS', 'FIXED_30_DAYS']);
export type PayrollProrationBasis = z.infer<typeof PayrollProrationBasis>;

/** Overtime rate multiplier, `1`–`9.99`, as a decimal string (`"1.5"`, `"2.00"`). */
export const OvertimeMultiplier = z
  .string()
  .regex(/^[1-9](\.\d{1,2})?$/, 'Must be a multiplier between 1 and 9.99 with up to 2 decimals.');

const DueReminderDays = z
  .array(z.int().min(0).max(90))
  .max(5)
  .refine((days) => new Set(days).size === days.length, 'Reminder days must be unique.');

/** Field schemas without defaults: the full settings add defaults, the patch makes each optional. */
const fields = {
  approval: {
    /** Maker-checker: may the creator of a record approve it? (07, 24 §6) */
    allowSelfApproval: z.boolean(),
    /** Payments above this need approval (`PENDING_APPROVAL`); `null` = no approval step (24 §6). */
    paymentThreshold: MoneyAmount.nullable(),
    expenseThreshold: MoneyAmount.nullable(),
  },
  payroll: {
    prorationBasis: PayrollProrationBasis,
    overtimeMultiplier: OvertimeMultiplier,
  },
  books: {
    /** No posting, voiding or back-dating on or before this date (02 rule 9). Changed only via books-lock. */
    lockedUntil: IsoDate.nullable(),
  },
  reminders: {
    /** Days before a due date on which due reminders are sent. */
    dueReminderDays: DueReminderDays,
  },
};

export const TenantSettings = z.strictObject({
  approval: z
    .strictObject({
      allowSelfApproval: fields.approval.allowSelfApproval.default(false),
      paymentThreshold: fields.approval.paymentThreshold.default(null),
      expenseThreshold: fields.approval.expenseThreshold.default(null),
    })
    .prefault({}),
  payroll: z
    .strictObject({
      prorationBasis: fields.payroll.prorationBasis.default('CALENDAR_DAYS'),
      overtimeMultiplier: fields.payroll.overtimeMultiplier.default('1.50'),
    })
    .prefault({}),
  books: z
    .strictObject({
      lockedUntil: fields.books.lockedUntil.default(null),
    })
    .prefault({}),
  reminders: z
    .strictObject({
      dueReminderDays: fields.reminders.dueReminderDays.default([3, 1]),
    })
    .prefault({}),
});
/** The settings as the application sees them: every field present. */
export type TenantSettings = z.output<typeof TenantSettings>;

/**
 * Partial update, merged section by section. `books` is not patchable here: the lock date moves only through the
 * books-lock action, which has its own permission and audit reason (tenant-management.md).
 */
export const TenantSettingsPatch = z.strictObject({
  approval: z
    .strictObject({
      allowSelfApproval: fields.approval.allowSelfApproval.optional(),
      paymentThreshold: fields.approval.paymentThreshold.optional(),
      expenseThreshold: fields.approval.expenseThreshold.optional(),
    })
    .optional(),
  payroll: z
    .strictObject({
      prorationBasis: fields.payroll.prorationBasis.optional(),
      overtimeMultiplier: fields.payroll.overtimeMultiplier.optional(),
    })
    .optional(),
  reminders: z
    .strictObject({
      dueReminderDays: fields.reminders.dueReminderDays.optional(),
    })
    .optional(),
});
export type TenantSettingsPatch = z.infer<typeof TenantSettingsPatch>;
