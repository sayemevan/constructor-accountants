import { describe, expect, it } from 'vitest';

import { assertSequenceKey, formatSequenceCode } from '../sequence-code.js';

describe('formatSequenceCode', () => {
  it('zero-pads the value to the width after the prefix', () => {
    expect(formatSequenceCode('PRJ-2026-', 7n)).toBe('PRJ-2026-0007');
    expect(formatSequenceCode('INV-', 42n, 6)).toBe('INV-000042');
  });

  it('never truncates a value wider than the width', () => {
    expect(formatSequenceCode('PRJ-', 123456n)).toBe('PRJ-123456');
  });

  it('allows an empty prefix', () => {
    expect(formatSequenceCode('', 1n, 3)).toBe('001');
  });

  it('rejects values below 1 and invalid widths', () => {
    expect(() => formatSequenceCode('X-', 0n)).toThrow(RangeError);
    expect(() => formatSequenceCode('X-', 1n, 0)).toThrow(RangeError);
    expect(() => formatSequenceCode('X-', 1n, 1.5)).toThrow(RangeError);
    expect(() => formatSequenceCode('X-', 1n, 13)).toThrow(RangeError);
  });
});

describe('assertSequenceKey', () => {
  it.each(['project', 'payroll_run:2026', 'client-bill.2026'])('accepts %s', (key) => {
    expect(() => {
      assertSequenceKey(key);
    }).not.toThrow();
  });

  it.each(['', 'Project', '1project', 'project 2026', 'a'.repeat(64)])('rejects "%s"', (key) => {
    expect(() => {
      assertSequenceKey(key);
    }).toThrow(TypeError);
  });
});
