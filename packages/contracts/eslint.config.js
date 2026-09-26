import { baseConfig } from '@repo/config/eslint/base';

export default [
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // ADR-0002: contracts is bundled for the browser, so it may import only zod and itself.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^(?!zod$|\\.{1,2}/)', message: 'contracts may import only zod.' }] },
      ],
    },
  },
];
