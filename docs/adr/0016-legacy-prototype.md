# ADR-0016: Freeze the Google-Sheets prototype as reference only

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** docs/architecture/design-review.md (issue 1)

## Context
The repository contains "BuildLedger", a client-only Next.js app storing data in the user's Google Drive/Sheets
via browser OAuth. It has no backend, no tenant isolation, mutates account balances directly, stores names in
financial rows, and cannot enforce permissions or auditability. The target architecture is server-side,
multi-tenant, PostgreSQL-based.

## Decision
The prototype is not extended or migrated as code. In Phase 0 it moves to `legacy/` (or is preserved on a tag/branch)
and is excluded from builds, lint and AI context except as a UX/domain reference (screens, per-sq-ft fee idea,
money accounts, receive-payment flow, material tracking idea for future inventory, read-only client sharing idea
for future client portal). Data import from existing Sheets, if customers need it, will be a separate one-off
import tool (future ADR).

## Consequences
+ Clean foundation. − Existing prototype users (if any) need an import path — to be confirmed with the product owner.
