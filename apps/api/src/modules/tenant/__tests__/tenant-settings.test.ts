import {
  CreateTenantInput,
  TENANT_SETTINGS_SCHEMA_VERSION,
  TenantSettings,
  TenantSettingsPatch,
} from '@repo/contracts';
import { describe, expect, it } from 'vitest';

import {
  applyTenantSettingsPatch,
  defaultTenantSettings,
  sameTenantSettings,
  TenantSettingsUnreadableError,
  upgradeTenantSettings,
} from '../domain/tenant-settings.js';

describe('TenantSettings schema', () => {
  it('fills every field with its default', () => {
    expect(defaultTenantSettings()).toEqual({
      approval: { allowSelfApproval: false, paymentThreshold: null, expenseThreshold: null },
      payroll: { prorationBasis: 'CALENDAR_DAYS', overtimeMultiplier: '1.50' },
      books: { lockedUntil: null },
      reminders: { dueReminderDays: [3, 1] },
    });
  });

  it('fills fields missing from a partial section (additive fields need no version bump)', () => {
    const parsed = TenantSettings.parse({ payroll: { prorationBasis: 'WORKING_DAYS' } });
    expect(parsed.payroll).toEqual({ prorationBasis: 'WORKING_DAYS', overtimeMultiplier: '1.50' });
  });

  it('rejects unknown keys at the top level and inside sections', () => {
    expect(TenantSettings.safeParse({ theme: 'dark' }).success).toBe(false);
    expect(TenantSettings.safeParse({ payroll: { roundTo: 5 } }).success).toBe(false);
  });

  it.each(['-1', '1.234', '1e5', '01', ' 5', ''])('rejects the threshold %j', (amount) => {
    expect(TenantSettings.safeParse({ approval: { paymentThreshold: amount } }).success).toBe(
      false,
    );
  });

  it.each(['0', '0.5', '25000', '25000.50', '9999999999999999.99'])(
    'accepts the threshold %j',
    (amount) => {
      expect(TenantSettings.safeParse({ approval: { paymentThreshold: amount } }).success).toBe(
        true,
      );
    },
  );

  it.each(['0.99', '10', '1.555', 'abc'])('rejects the overtime multiplier %j', (multiplier) => {
    expect(TenantSettings.safeParse({ payroll: { overtimeMultiplier: multiplier } }).success).toBe(
      false,
    );
  });

  it('rejects duplicate or out-of-range reminder days', () => {
    expect(TenantSettings.safeParse({ reminders: { dueReminderDays: [1, 1] } }).success).toBe(
      false,
    );
    expect(TenantSettings.safeParse({ reminders: { dueReminderDays: [91] } }).success).toBe(false);
  });

  it('rejects an invalid lock date', () => {
    expect(TenantSettings.safeParse({ books: { lockedUntil: '2026-02-30' } }).success).toBe(false);
  });
});

describe('TenantSettingsPatch schema', () => {
  it('does not fill defaults (absent means "keep")', () => {
    expect(TenantSettingsPatch.parse({ approval: {} })).toEqual({ approval: {} });
  });

  it('does not allow patching the books lock date', () => {
    expect(TenantSettingsPatch.safeParse({ books: { lockedUntil: '2026-01-31' } }).success).toBe(
      false,
    );
  });
});

describe('applyTenantSettingsPatch', () => {
  const current = TenantSettings.parse({
    approval: { allowSelfApproval: true, paymentThreshold: '50000.00' },
    books: { lockedUntil: '2026-06-30' },
  });

  it('changes only the patched fields', () => {
    const next = applyTenantSettingsPatch(current, { approval: { expenseThreshold: '1000' } });
    expect(next.approval).toEqual({
      allowSelfApproval: true,
      paymentThreshold: '50000.00',
      expenseThreshold: '1000',
    });
    expect(next.payroll).toEqual(current.payroll);
    expect(next.books).toEqual({ lockedUntil: '2026-06-30' });
  });

  it('keeps the current value for an explicit undefined, never the default', () => {
    const next = applyTenantSettingsPatch(current, {
      approval: { allowSelfApproval: undefined },
    });
    expect(next.approval.allowSelfApproval).toBe(true);
  });

  it('clears a nullable field with null', () => {
    const next = applyTenantSettingsPatch(current, { approval: { paymentThreshold: null } });
    expect(next.approval.paymentThreshold).toBeNull();
  });

  it('keeps the books lock date even if a patch smuggles one in', () => {
    const smuggled = { books: { lockedUntil: null } } as unknown as TenantSettingsPatch;
    expect(applyTenantSettingsPatch(current, smuggled).books.lockedUntil).toBe('2026-06-30');
  });

  it('re-validates the merged result', () => {
    const invalid = { payroll: { overtimeMultiplier: '0.5' } } as TenantSettingsPatch;
    expect(() => applyTenantSettingsPatch(current, invalid)).toThrow();
  });
});

describe('upgradeTenantSettings', () => {
  it('reads a current-version blob, filling fields added since it was written', () => {
    const stored = { approval: { allowSelfApproval: true } };
    const settings = upgradeTenantSettings(TENANT_SETTINGS_SCHEMA_VERSION, stored);
    expect(settings.approval.allowSelfApproval).toBe(true);
    expect(settings.reminders.dueReminderDays).toEqual([3, 1]);
  });

  it('refuses an unknown schema version', () => {
    expect(() => upgradeTenantSettings(TENANT_SETTINGS_SCHEMA_VERSION + 1, {})).toThrow(
      TenantSettingsUnreadableError,
    );
  });

  it('refuses an invalid blob', () => {
    expect(() => upgradeTenantSettings(TENANT_SETTINGS_SCHEMA_VERSION, { x: 1 })).toThrow(
      TenantSettingsUnreadableError,
    );
    expect(() => upgradeTenantSettings(TENANT_SETTINGS_SCHEMA_VERSION, null)).toThrow(
      TenantSettingsUnreadableError,
    );
  });
});

describe('sameTenantSettings', () => {
  it('compares values regardless of the input key order', () => {
    const a = TenantSettings.parse({
      approval: { expenseThreshold: '5', allowSelfApproval: true },
    });
    const b = TenantSettings.parse({
      approval: { allowSelfApproval: true, expenseThreshold: '5' },
    });
    expect(sameTenantSettings(a, b)).toBe(true);
    expect(sameTenantSettings(a, defaultTenantSettings())).toBe(false);
  });
});

describe('CreateTenantInput schema', () => {
  const valid = {
    name: 'Rahman Builders',
    slug: 'rahman-builders',
    baseCurrency: 'BDT',
    timezone: 'Asia/Dhaka',
    locale: 'bn-BD',
  };

  it('accepts the minimum profile', () => {
    expect(CreateTenantInput.safeParse(valid).success).toBe(true);
  });

  it.each(['Rahman', 'ab', '-rahman', 'rahman-', 'rahman_builders', 'a'.repeat(64)])(
    'rejects the slug %j',
    (slug) => {
      expect(CreateTenantInput.safeParse({ ...valid, slug }).success).toBe(false);
    },
  );

  it.each([
    ['baseCurrency', 'XYZ'],
    ['baseCurrency', 'bdt'],
    ['timezone', 'Asia/Atlantis'],
    ['locale', 'bn_bd'],
    ['countryCode', 'bd'],
    ['email', 'not-an-email'],
  ])('rejects %s = %j', (field, value) => {
    expect(CreateTenantInput.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it('rejects a tenant id or unknown fields from input', () => {
    expect(CreateTenantInput.safeParse({ ...valid, id: crypto.randomUUID() }).success).toBe(false);
  });
});
