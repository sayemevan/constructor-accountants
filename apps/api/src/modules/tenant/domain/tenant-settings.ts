import {
  TENANT_SETTINGS_SCHEMA_VERSION,
  TenantSettings,
  type TenantSettingsPatch,
} from '@repo/contracts';

import { omitUndefined } from '../../../core/utils/index.js';

/** The stored settings blob cannot be read as any known schema version — data corruption or a newer writer. */
export class TenantSettingsUnreadableError extends Error {
  override readonly name = 'TenantSettingsUnreadableError';
}

/** A tenant's settings plus the row version to send back with an update. */
export interface TenantSettingsSnapshot {
  readonly settings: TenantSettings;
  readonly version: number;
}

/** Settings for a new tenant: every field at its default. */
export function defaultTenantSettings(): TenantSettings {
  return TenantSettings.parse({});
}

/**
 * Reads a stored blob written with `schemaVersion` as the current {@link TenantSettings}. Breaking schema changes
 * add an upgrade step here (v1 → v2 → …); additive fields need none, their defaults fill in.
 */
export function upgradeTenantSettings(schemaVersion: number, stored: unknown): TenantSettings {
  if (schemaVersion !== TENANT_SETTINGS_SCHEMA_VERSION) {
    throw new TenantSettingsUnreadableError(
      `Unsupported tenant settings schema version ${String(schemaVersion)} ` +
        `(current: ${String(TENANT_SETTINGS_SCHEMA_VERSION)})`,
    );
  }
  const parsed = TenantSettings.safeParse(stored);
  if (!parsed.success) {
    throw new TenantSettingsUnreadableError(
      `Stored tenant settings are invalid: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

/**
 * Merges a patch into the current settings section by section and re-validates the result as a whole. Fields absent
 * from the patch — or present as `undefined` — keep their value (never fall back to the default); `null` clears a
 * nullable field.
 */
export function applyTenantSettingsPatch(
  current: TenantSettings,
  patch: TenantSettingsPatch,
): TenantSettings {
  return TenantSettings.parse({
    approval: { ...current.approval, ...definedOnly(patch.approval) },
    payroll: { ...current.payroll, ...definedOnly(patch.payroll) },
    books: current.books,
    reminders: { ...current.reminders, ...definedOnly(patch.reminders) },
  });
}

function definedOnly(section: object | undefined) {
  return section === undefined ? {} : omitUndefined(section);
}

/** True when two parsed settings documents hold the same values (parsing fixes the key order). */
export function sameTenantSettings(a: TenantSettings, b: TenantSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
