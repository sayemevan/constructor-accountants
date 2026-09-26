# ADR-0005: Multi-tenancy — shared schema, tenant_id, composite FKs, RLS

- **Status:** Accepted (implementation spike pending in Phase 0) · **Date:** 2026-09-26 · **Related:** 06

## Context
The spec left open "shared database vs separate database per tenant". Tenant leakage is the most severe possible
defect for a SaaS holding company finances and employee data. Self-hosted must use the same code.

## Decision
Shared DB + shared schema with `tenant_id` on every tenant-owned table, enforced by (1) TenantContext-scoped
repositories, (2) composite foreign keys `(tenant_id, x_id)`, (3) PostgreSQL RLS (FORCE) with transaction-local
`app.tenant_id`, API connecting as a non-owner role. Customers needing physical isolation get a dedicated instance.
The app never routes between databases.

## Alternatives considered
| Option | Why not |
|---|---|
| DB per tenant in one deployment | N× migrations/pools/backups; complex routing; no benefit over dedicated instance |
| Schema per tenant | Same migration fan-out problem; Prisma support awkward |
| App-level filtering only | One missed `where` leaks data; no defence in depth |

## Consequences
+ Defence in depth; cheap SaaS operations; identical code for self-hosted.
− Every query runs in a transaction with `set_config` (small overhead, to be measured in the spike).
− Platform-wide operations need a separate BYPASSRLS role confined to the platform module.
If the spike shows RLS is impractical with Prisma, layers 1–2 remain mandatory and this ADR is superseded with the
measured reasons — never silently dropped.

## Compliance
DB meta-test (every tenant_id table has RLS enabled+forced and a policy); cross-tenant API tests per endpoint;
lint rule forbidding the base Prisma client in modules.
