import { describe, expect, it } from 'vitest';

import { makeTestConfig } from '../../../testing/test-config.js';
import { PlatformDatabase, PlatformDatabaseNotConfiguredError } from '../platform-database.js';

describe('PlatformDatabase', () => {
  it('is unavailable when DATABASE_PLATFORM_URL is not configured (e.g. self-hosted)', () => {
    const platform = new PlatformDatabase(makeTestConfig());
    expect(platform.isConfigured).toBe(false);
    expect(() => platform.client).toThrow(PlatformDatabaseNotConfiguredError);
  });

  it('creates one client lazily when configured', async () => {
    const platform = new PlatformDatabase(
      makeTestConfig({
        DATABASE_PLATFORM_URL:
          'postgresql://app_platform:app_platform@localhost:5432/construction_erp',
      }),
    );
    expect(platform.isConfigured).toBe(true);
    expect(platform.client).toBe(platform.client);
    await platform.onModuleDestroy();
  });

  it('shuts down cleanly when the client was never used', async () => {
    await expect(new PlatformDatabase(makeTestConfig()).onModuleDestroy()).resolves.toBeUndefined();
  });
});
