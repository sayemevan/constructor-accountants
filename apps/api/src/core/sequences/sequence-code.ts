const SEQUENCE_KEY = /^[a-z][a-z0-9_.:-]{0,62}$/;
const MAX_WIDTH = 12;

/** Throws a TypeError unless `key` is a valid sequence key (same rule as the DB CHECK constraint). */
export function assertSequenceKey(key: string): void {
  if (!SEQUENCE_KEY.test(key)) {
    throw new TypeError(
      `Invalid sequence key "${key}": lowercase letters, digits, _ . : - (max 63)`,
    );
  }
}

/**
 * The human number for `value`: the prefix plus the value zero-padded to `width` digits. Values wider than `width`
 * are never truncated. `formatSequenceCode('PRJ-2026-', 7n)` → `PRJ-2026-0007`.
 */
export function formatSequenceCode(prefix: string, value: bigint, width = 4): string {
  if (!Number.isInteger(width) || width < 1 || width > MAX_WIDTH) {
    throw new RangeError(`Sequence code width must be an integer from 1 to ${String(MAX_WIDTH)}`);
  }
  if (value < 1n) throw new RangeError('Sequence values start at 1');
  return `${prefix}${value.toString().padStart(width, '0')}`;
}
