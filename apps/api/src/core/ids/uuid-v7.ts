import { randomBytes } from 'node:crypto';

/**
 * A UUIDv7 (RFC 9562): 48-bit Unix milliseconds, then random bits — time-ordered for index locality (05 §1).
 * Prisma's `@default(uuid(7))` covers ordinary inserts; use this only when the id is needed before the insert
 * (e.g. provisioning a tenant, whose context must exist before its first row is written).
 */
export function uuidv7(unixMillis: number = Date.now()): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(unixMillis, 0, 6);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x70, 6); // version 7
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8); // variant 10
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
