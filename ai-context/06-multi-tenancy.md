# 06 — Multi-Tenancy

Load when: touching any query, repository, endpoint, job, file access, export, report, or notification.

## Decision (ADR-0005)
**Shared database, shared schema, `tenant_id` on every tenant-owned row**, protected by three layers:
1. **Application layer** — `TenantContext` (AsyncLocalStorage) set by `TenantGuard`; repositories derive the
   tenant from it; no repository method accepts a tenantId argument from callers.
2. **Relational layer** — composite foreign keys `(tenant_id, x_id) → x(tenant_id, id)` make cross-tenant
   references impossible.
3. **Database layer** — PostgreSQL **Row-Level Security** on every tenant-owned table, with the API connecting
   as a non-owner role without `BYPASSRLS`.

Customers needing physical isolation get a **dedicated instance** (same images, own DB) — the application never
routes between databases. "Separate database per tenant inside one deployment" is rejected: it multiplies
migrations, pooling and ops cost with no benefit a dedicated instance doesn't give.

Self-hosted = the same code with exactly one tenant (bootstrapped on first run). Tenancy code is never
disabled in self-hosted mode.

## Tenant context lifecycle
- **HTTP:** session → `active_tenant_id` → membership must be ACTIVE, tenant must be ACTIVE → `TenantContext`.
  The client never supplies tenantId (body, query, header, or URL). Switching tenant = `POST /auth/switch-tenant`,
  which re-validates membership and updates the session.
- **Jobs:** every job payload includes `tenantId`; the job runner (`TenantJobRunner`, `core/jobs`) validates the
  tenant is ACTIVE and runs the handler inside `TenantContext.run(...)` — inactive or missing tenant → skipped, logged. Jobs that iterate tenants (reminder scans) enqueue **one job per tenant**.
- **Outbox events:** carry `tenantId`; handlers run in that tenant's context.
- **Platform operations** (SaaS operator: create/suspend tenant, usage stats) run in the `platform` module using a
  separate Prisma client/role with BYPASSRLS, are audited, and never expose tenant business data in bulk.

## RLS implementation
Template for every tenant-owned table's migration (validated by the spike — ADR-0005 "Spike outcome"; working
example: `apps/api/src/core/tenancy/__tests__/spike/spike.sql`):
```sql
-- tenant_id defaults to the transaction's tenant, so repositories never pass it (Prisma: @default(dbgenerated(...)))
tenant_id uuid NOT NULL DEFAULT (NULLIF(current_setting('app.tenant_id', true), ''))::uuid REFERENCES tenants (id),
CONSTRAINT projects_tenant_id_id_key UNIQUE (tenant_id, id),

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid)
  WITH CHECK (tenant_id = (NULLIF(current_setting('app.tenant_id', true), ''))::uuid);
```
- **`NULLIF(…, '')` is mandatory.** After a transaction-local `set_config` commits, a pooled session holds `''`
  (not NULL); a bare `::uuid` cast then raises on every later query without a tenant.
- `TenantDatabase` (`core/tenancy`) wraps the Prisma client: `db.client` outside a transaction runs each operation
  as `$transaction([set_config('app.tenant_id', $1, true), op])` (transaction-local — safe with PgBouncer
  transaction pooling); `db.transaction(fn)` sets it once for an interactive transaction and nested calls join it.
  Never call `$transaction` on a Prisma client directly (the tenant client type omits it).
- Cost: ~0.4 ms of round trips per transaction; RLS evaluation itself is negligible. Multi-query use cases
  (including list + count) run in one `transaction()`.
- Prisma queries are lazy: always `await` them inside the code that runs under `TenantContext.run`; never return an
  un-awaited query past the context boundary (it fails closed with `TenantContextMissingError`).
- If `app.tenant_id` is not set, the policy compares with NULL → matches no rows, inserts fail (fail closed).
- Roles: `app_owner` (runs migrations, owns tables), `app_user` (API/worker; DML only; no BYPASSRLS),
  `app_platform` (platform module only; BYPASSRLS; `DATABASE_PLATFORM_URL`, optional), read-only `app_report`
  optional later. Dev/test roles come from `infrastructure/compose/postgres-init/01-roles-and-database.sql`.
  `app_platform` is optional, so a migration that grants/revokes for it wraps that in a `DO` block checking
  `pg_roles` (example: the `…_tenant` migration).
- Nest wiring: repositories inject `AppTenantDatabase` (`core/tenancy`) and query `db.client`; application services
  use `TransactionRunner.run(fn)`. `PlatformDatabase` (`core/platform-database`) is importable only by the
  `platform` module. Both enforced by dependency-cruiser (`modules-no-base-prisma`,
  `modules-no-prisma-client-runtime`, `platform-database-only-in-platform`).
- **The one cross-tenant exception: the outbox dispatcher.** `outbox_events` also has `outbox_dispatcher_read`
  (SELECT) and `outbox_dispatcher_mark` (UPDATE) policies, open when the transaction-local
  `app.outbox_dispatcher = 'on'`. Only `core/jobs/outbox-dispatcher.ts` sets it; never INSERT; UPDATE is limited to
  the dispatch columns by grants (ADR-0005 "Outbox dispatcher"). Never add such a flag to another table without an ADR.
- Global tables without tenant_id (tenants, users, sessions, auth_tokens, permissions) have no RLS; access is guarded in
  their modules and they must never be exposed via tenant-scoped list endpoints.

## Rules for code
1. Never use the raw/base Prisma client in modules. Use the injected tenant-scoped client via repositories.
2. Never write `where: { tenantId: dto.tenantId }` from input; tenant comes from context automatically.
3. Lookups by id are always `(tenant_id, id)` — `findUnique({ where: { tenantId_id: {...} } })` style.
4. Not found **or** other tenant → `404 NOT_FOUND`. Never 403 (don't reveal existence).
5. Raw SQL (`Prisma.sql`) must include `tenant_id = ${ctx.tenantId}` explicitly in addition to RLS.
6. Unique constraints for business keys are per tenant: `UNIQUE (tenant_id, code)` — never global.
7. Caches (if added) must include tenantId in the key.
8. Files: storage keys are prefixed `tenants/{tenantId}/…`; download authorization checks the DB record under
   tenant context — never trust a key from the client.
9. Exports/reports: generated inside tenant context; export files belong to the tenant and requesting user.
10. Notifications: recipients are resolved from memberships of the event's tenant only.
11. Logs include tenantId; never log another tenant's data in a shared context.
12. Seeds/fixtures for tests always create **two tenants** so isolation bugs surface.

## Mandatory tests (see 14)
For every tenant-owned resource: a user of tenant B receives 404 for tenant A's record on GET/PATCH/action
endpoints, list endpoints never include A's rows, and creating a record that references A's id from B fails.
A DB-level test asserts that every table with a `tenant_id` column has RLS enabled + forced and a policy
(`RLS_GAPS_SQL` from `core/tenancy` must return no rows after migrations).

## Tenant lifecycle
`ACTIVE → SUSPENDED` (login blocked for members, data retained, platform admin only) `→ ACTIVE` or
`→ CLOSED` (export offered, data retained per retention policy, then purged by a documented runbook).
Tenant data export (all business data + files) is a platform capability for portability and self-hosted migration.
