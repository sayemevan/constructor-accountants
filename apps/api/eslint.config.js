import { baseConfig } from '@repo/config/eslint/base';

export default [
  { ignores: ['src/generated/**', 'src/**/__tests__/**/generated/**'] },
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['**/*.ts'],
    // Tool configs live outside src/ (and outside tsconfig.json) but are still linted with type information.
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['prisma.config.ts', 'vitest.config.ts', 'vitest.int.config.ts'],
        },
      },
    },
  },
];
