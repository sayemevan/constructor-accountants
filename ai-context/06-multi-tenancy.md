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
- **Jobs:** every job payload includes `tenantId`; the job runner validates the tenant is ACTIVE and runs the
  handler inside `TenantContext.run(...)`. Jobs that iterate tenants (reminder scans) enqueue **one job per tenant**.
- **Outbox events:** carry `tenantId`; handlers run in that tenant's context.
- **Platform operations** (SaaS operator: create/suspend tenant, usage stats) run in the `platform` module using a
  separate Prisma client/role with BYPASSRLS, are audited, and never expose tenant business data in bulk.

## RLS implementation
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
```
- The tenant-scoped Prisma client (a Prisma client extension) runs each operation inside a transaction that first
  executes `SELECT set_config('app.tenant_id', $1, true)` (transaction-local — safe with PgBouncer transaction
  pooling). Interactive transactions opened by application services set it once at the start.
- If `app.tenant_id` is not set, `current_setting(..., true)` is NULL → policy matches no rows (fail closed).
- Roles: `app_owner` (runs migrations, owns tables), `app_user` (API/worker; DML only; no BYPASSRLS),
  `app_platform` (platform module only; BYPASSRLS), read-only `app_report` optional later.
- Global tables without tenant_id (users, sessions, auth_tokens, permissions) have no RLS; access is guarded in
  their modules and they must never be exposed via tenant-scoped list endpoints.
- Phase 1 includes a spike to validate the Prisma extension + RLS approach and measure overhead. If RLS proves
  impractical, layers 1–2 remain mandatory and the fallback is recorded in ADR-0005 — no silent removal.

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
A DB-level test asserts that every table with a `tenant_id` column has RLS enabled + forced and a policy.

## Tenant lifecycle
`ACTIVE → SUSPENDED` (login blocked for members, data retained, platform admin only) `→ ACTIVE` or
`→ CLOSED` (export offered, data retained per retention policy, then purged by a documented runbook).
Tenant data export (all business data + files) is a platform capability for portability and self-hosted migration.
