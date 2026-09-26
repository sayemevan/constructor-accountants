# ADR-0017: Money, time and identifier representation

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 05, 13, 24

## Decision
- Money `numeric(18,2)`, rates/quantities `numeric(18,4)`; backend `Decimal`; JSON as decimal strings; line-level
  rounding HALF_UP to 2 dp; single base currency per tenant (currency code stored on money rows for future).
- Business dates as `date` interpreted in the tenant timezone; instants as `timestamptz` UTC; domain receives
  `today` from an injected Clock.
- Primary keys UUIDv7 (time-ordered); human-readable numbers from per-tenant sequences (not gapless on rollback).

## Alternatives considered
Integer minor units (safe but awkward for rates/3-decimal currencies and SQL reporting); floats (incorrect);
timestamps for business dates (timezone off-by-one bugs); auto-increment ids (enumeration, merge/export issues).

## Consequences
+ Correct arithmetic and dates. − Must enforce conversion at boundaries (contracts + pipes).
