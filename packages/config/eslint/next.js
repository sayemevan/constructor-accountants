import nextVitals from 'eslint-config-next/core-web-vitals';

import { baseConfig } from './base.js';

/**
 * Base preset plus Next.js (core web vitals) rules for apps/web.
 * @param {{ tsconfigRootDir: string }} options
 */
export function nextConfig({ tsconfigRootDir }) {
  return [...nextVitals, ...baseConfig({ tsconfigRootDir })];
}
