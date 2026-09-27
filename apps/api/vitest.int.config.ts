import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests (14): real PostgreSQL via Testcontainers, so Docker must be running.
 * `--mode perf` runs the measurement scripts (`*.perf.ts`) instead; they are never part of CI.
 */
export default defineConfig(({ mode }) => ({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include:
      mode === 'perf' ? ['src/**/__tests__/**/*.perf.ts'] : ['src/**/__tests__/**/*.int.test.ts'],
    environment: 'node',
    // Container start + migrations happen in beforeAll.
    hookTimeout: 120_000,
    testTimeout: mode === 'perf' ? 600_000 : 30_000,
  },
}));
