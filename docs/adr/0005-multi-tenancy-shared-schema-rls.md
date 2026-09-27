# ADR-0005: Multi-tenancy — shared schema, tenant_id, composite FKs, RLS

- **Status:** Accepted — validated by the Phase 0 spike (2026-09-27) · **Date:** 2026-09-26 · **Related:** 06, 05, 14

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
− Every query runs in a transaction with `set_config` (~0.4 ms per transaction, measured — see Spike outcome).
− Platform-wide operations need a separate BYPASSRLS role confined to the platform module.
If the spike shows RLS is impractical with Prisma, layers 1–2 remain mandatory and this ADR is superseded with the
measured reasons — never silently dropped.

## Compliance
DB meta-test (every tenant_id table has RLS enabled+forced and a policy); cross-tenant API tests per endpoint;
lint rule forbidding the base Prisma client in modules.

## Spike outcome (roadmap step 7, 2026-09-27)
**Verdict: RLS with Prisma is practical. The decision stands; no fallback needed.**

What was built (kept, production code in `apps/api/src/core/tenancy/`):
- `TenantContext` — AsyncLocalStorage carrier; `run(tenantId, fn)` awaits `fn` inside the context.
- `TenantDatabase` — wraps a PrismaClient. `client` outside a transaction is a client extension that runs every
  model/raw operation as `$transaction([set_config('app.tenant_id', $1, true), op])`; `transaction(fn)` opens one
  interactive transaction, sets the tenant once, and nested calls join it. Throws before any SQL without a tenant,
  when the auto client is used inside an open transaction, or when the tenant changes mid-transaction.
- `RLS_GAPS_SQL` — the DB meta-check (tenant_id tables lacking RLS enabled + forced + policy).
- `src/testing/postgres.ts` — Testcontainers harness: postgres:17, the dev role bootstrap
  (`infrastructure/compose/postgres-init`), real migrations via `prisma migrate deploy` as app_owner (~3 s).

Test-only: two sample tables (`spike_projects`, `spike_project_notes` + global `spike_tenants`) in
`core/tenancy/__tests__/spike/` (own Prisma schema + SQL; never in `prisma/migrations`).
`tenant-isolation.int.test.ts` (17 tests, in CI) proves: fail-closed for a raw app_user client (reads nothing,
inserts rejected); tenant B cannot list/find/update/delete/raw-query A's rows (`findUnique` → null → 404);
WITH CHECK rejects writing another tenant's `tenant_id`; the composite FK rejects cross-tenant references even for a
BYPASSRLS role; interactive transactions + nesting + rollback; no tenant leaks to the next user of a pooled
connection; 40 interleaved concurrent requests stay isolated; the meta-check passes and detects a missing FORCE.

### Findings that change the rules (applied to 06 and 05)
1. **Policies must use `NULLIF(current_setting('app.tenant_id', true), '')::uuid`.** After a transaction-local
   `set_config` commits, the session's value is `''`, not NULL, so the original `current_setting(...)::uuid` raises
   `invalid input syntax for type uuid` on every reused pooled connection without a tenant (fail-closed, but a 500).
2. **`tenant_id` gets a DB default from the same expression.** Inserts take the tenant from the transaction, so
   repositories never pass `tenantId` (Prisma makes the field optional), and WITH CHECK still rejects a mismatch.
3. **Prisma queries are lazy** (they execute on `.then`). A query created inside a tenant context but awaited
   outside it would run without the tenant; hence `TenantContext.run` awaits inside the context. This fails closed
   (TenantContextMissingError), never open.
4. **The planner uses RLS as an index condition** (`current_setting` is STABLE): a query without an explicit
   `tenant_id` predicate still uses the `(tenant_id, …)` index. Repositories still add explicit tenant predicates
   (06 rules 3 and 5) — defence in depth and composite-key lookups.
5. Interactive `$transaction` on an extended client does not compose with the auto-wrapping extension (each inner
   operation would open its own transaction), so transactions go through `TenantDatabase.transaction()` only and the
   exposed client type omits `$transaction`.

### Measured overhead (`pnpm --filter @repo/api perf:tenancy`)
Apple Silicon, Docker Desktop 28.5 (VM networking inflates round trips), postgres:17, 2 tenants × 10 000 rows,
pool of 10, 3 000 sequential iterations after warm-up; ms:

| Operation | A baseline (BYPASSRLS, no tx) | B tx + set_config, no RLS | C tenant auto-tx (RLS) | D inside `transaction()` |
|---|---|---|---|---|
| findUnique (tenant_id, id) p50 / p95 | 0.166 / 0.214 | 0.568 / 0.673 | 0.571 / 0.640 | 0.562 / 0.645 |
| findMany page of 50 p50 / p95 | 0.270 / 0.355 | 0.675 / 0.783 | 0.725 / 0.853 | 0.694 / 0.809 |
| unit of work, 5 reads p50 | 0.787 | — | 2.794 (5 auto-tx) | 1.209 (1 tx) |
| throughput, 50 concurrent callers | 40 689 ops/s | — | 6 547 ops/s | 6 853 ops/s |

- RLS policy evaluation is ~free (C ≈ B). The cost is transaction round trips (BEGIN, set_config, COMMIT):
  ~+0.4 ms per transaction, paid once per `transaction()`, not per query.
- Consequence: application services run multi-query use cases (including list + count) in one `transaction()`
  (already required by 12); standalone auto-transactions are for single reads.
- Throughput drops ~6× on a hot single-row read; 6.5k ops/s per API process is two orders of magnitude above the
  expected load (22). Revisit only if profiling shows DB round trips dominate real endpoints.

### Left for Phase 1 step 8
Nest wiring (TenantDatabase provider over PrismaService, TenantGuard sets TenantContext, TransactionRunner =
`TenantDatabase.transaction`), the `app_platform` BYPASSRLS client, and the lint rule forbidding the base Prisma
client in modules. The spike tables are deleted once the first real tenant-owned tables and their isolation tests
exist (Phase 1).

### Step 8a done (Phase 1 session 1)
- `DatabaseModule` provides `TenantContext` (one per process), `AppTenantDatabase` (`TenantDatabase<PrismaClient>`
  over `PrismaService` — a subclass, because Nest resolves constructor parameters by runtime class) and
  `TransactionRunner` (`run(fn)` = `AppTenantDatabase.transaction(fn)`). Modules import only `core/tenancy`.
- `core/platform-database`: `PlatformDatabase` (+ non-global `PlatformDatabaseModule`), a lazily created
  `app_platform` client from the optional `DATABASE_PLATFORM_URL`; throws `PlatformDatabaseNotConfiguredError` when
  unset (self-hosted). The dev role bootstrap now creates `app_platform` with the same default DML grants as
  `app_user`.
- Compliance rules in `.dependency-cruiser.cjs`: `modules-no-base-prisma` (no `core/database`),
  `modules-no-prisma-client-runtime` (generated Prisma *types* and enums allowed, the `PrismaClient` class and
  `@prisma/client`/`@prisma/adapter-pg` runtime not), `platform-database-only-in-platform`.
- Remaining for later sessions: `TenantGuard` sets the context (session 4). The job runner does since session 3 (below).

### Outbox dispatcher (Phase 1 session 3, 2026-09-27)
The worker's `OutboxDispatcher` must find pending events of **every** tenant, but it connects as `app_user` (17), so
the `tenant_isolation` policy hides everything. Decision: `outbox_events` gets two extra permissive policies,
`outbox_dispatcher_read` (FOR SELECT) and `outbox_dispatcher_mark` (FOR UPDATE), that apply when the
transaction-local setting `app.outbox_dispatcher = 'on'`. Only the dispatcher's claim transaction sets it
(`core/jobs/outbox-dispatcher.ts`).
- **Bounded:** only `outbox_events`; never INSERT (an event without a tenant still fails); UPDATE is limited by
  column grants to `processed_at`, `attempts`, `last_error`. Event payloads carry ids and small facts only (25).
- **Same threat model as the tenant setting:** RLS here catches missing tenant filters, not hostile code running as
  `app_user`, which could already call `set_config('app.tenant_id', …)`. Setting the dispatcher flag is just as
  explicit and greppable.
- **Rejected:** the `app_platform` BYPASSRLS client (optional, reserved for the platform module); iterating tenants
  on every poll (cost grows with the tenant count); a SECURITY DEFINER claim function (FORCE RLS applies to the
  owner too, so it would need a policy for the owner role name, and more moving parts than a flag).
- **Tested:** `core/outbox/__tests__/outbox.int.test.ts` (no flag → no rows; flag → every tenant for SELECT, INSERT
  still rejected; app_user cannot UPDATE the payload or DELETE) and `core/jobs/__tests__/*.int.test.ts`.

The job runner side is done too: `TenantJobRunner` (`core/jobs`) runs every handler inside
`TenantContext.run(event.tenantId)` after checking the tenant is ACTIVE (06 "Jobs").
