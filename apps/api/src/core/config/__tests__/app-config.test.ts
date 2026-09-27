import { describe, expect, it } from 'vitest';

import { makeTestConfig } from '../../../testing/test-config.js';
import { ConfigValidationError } from '../app-config.js';

describe('loadConfig — database URLs', () => {
  it('leaves the platform URL unset when DATABASE_PLATFORM_URL is absent', () => {
    expect(makeTestConfig().database.platformUrl).toBeUndefined();
  });

  it('reads DATABASE_PLATFORM_URL', () => {
    const url = 'postgresql://app_platform:secret@db:5432/construction_erp';
    expect(makeTestConfig({ DATABASE_PLATFORM_URL: url }).database.platformUrl).toBe(url);
  });

  it('rejects a DATABASE_PLATFORM_URL that is not a postgres URL, without echoing the value', () => {
    const load = () => makeTestConfig({ DATABASE_PLATFORM_URL: 'mysql://root:hunter2@db/x' });
    expect(load).toThrow(ConfigValidationError);
    expect(load).toThrow(/DATABASE_PLATFORM_URL/);
    expect(load).not.toThrow(/hunter2/);
  });
});
