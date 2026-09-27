import { describe, expect, it } from 'vitest';

import { uuidv7 } from '../uuid-v7.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('has the version 7 and RFC 9562 variant bits', () => {
    for (let i = 0; i < 100; i += 1) expect(uuidv7()).toMatch(UUID_V7);
  });

  it('encodes the timestamp in the first 48 bits', () => {
    const millis = Date.UTC(2026, 8, 27, 12, 0, 0);
    const id = uuidv7(millis);
    expect(parseInt(id.slice(0, 8) + id.slice(9, 13), 16)).toBe(millis);
  });

  it('sorts by creation time', () => {
    const ids = [3, 1, 2].map((offset) => uuidv7(Date.UTC(2026, 0, 1) + offset));
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('is unique within the same millisecond', () => {
    const millis = Date.now();
    expect(new Set(Array.from({ length: 1000 }, () => uuidv7(millis))).size).toBe(1000);
  });
});
