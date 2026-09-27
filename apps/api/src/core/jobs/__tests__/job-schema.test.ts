import { describe, expect, it } from 'vitest';

import { roleOf } from '../job-schema.js';

describe('roleOf', () => {
  it('returns the (decoded) user of a connection URL', () => {
    expect(roleOf('postgresql://app_user:secret@db:5432/construction_erp')).toBe('app_user');
    expect(roleOf('postgres://my%2Duser:x@db/erp')).toBe('my-user');
  });

  it('rejects a URL without a user', () => {
    expect(() => roleOf('postgresql://db:5432/erp')).toThrow(TypeError);
  });
});
