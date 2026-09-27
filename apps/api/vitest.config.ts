import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // esbuild cannot emit decorator metadata, which Nest DI relies on (ADR-0018).
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    // Integration tests need Docker (Testcontainers) and run separately: vitest.int.config.ts.
    exclude: ['**/node_modules/**', 'src/**/*.int.test.ts'],
    environment: 'node',
  },
});
