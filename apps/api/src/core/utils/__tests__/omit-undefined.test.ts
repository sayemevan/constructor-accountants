import { describe, expect, it } from 'vitest';

import { omitUndefined } from '../omit-undefined.js';

describe('omitUndefined', () => {
  it('drops undefined values but keeps null, false, 0 and empty strings', () => {
    const result = omitUndefined({ a: undefined, b: null, c: false, d: 0, e: '' });
    expect(result).toEqual({ b: null, c: false, d: 0, e: '' });
    expect('a' in result).toBe(false);
  });

  it('returns a new object', () => {
    const input = { a: 1 };
    expect(omitUndefined(input)).not.toBe(input);
  });
});
