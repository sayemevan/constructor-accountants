# Phase 1 — Session Guide

Phase 1 of `ai-context/26-implementation-roadmap.md` (steps 8–14), split into sessions small enough for one
Claude Code conversation each. Exit criteria (26): two tenants fully isolated, permission-matrix tests, security
review of auth.

## How to run a session
1. Start a **new** session (clean context). CLAUDE.md loads automatically.
2. Work directly on `main` — no per-session branches.
3. Paste the session's prompt below. Every prompt ends with "plan first": review the plan, then say go.
4. Before ending, the agent must run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:int && pnpm build`,
   update docs (module file, 23 registry, ADR if a decision was made, CLAUDE.md status), and summarise.
5. Commit on `main`, push, and wait for CI to pass before starting the next session. Tick the session off here.

Order matters: tables reference `tenants` and `users`, guards need sessions, and audit needs an actor. The order
below differs from 26 in one way: `audit` moves up (session 5) so later sessions audit as they go instead of
retrofitting.

## Before session 1 (one-time)
- [ ] Commit the Phase 0 work (steps 5–7 are still uncommitted) and push. Confirm the new **Integration tests** CI
      step passes on GitHub.
- [ ] **Decide the email question** (needed by session 7): auth emails must go through the notification module's
      email channel (`modules/authentication.md` "Must NOT", 16), but the channel is Phase 7. Recommended: pull a
      minimal SMTP email channel + outbox handler into Phase 1 (Mailpit in dev), and record it in 26.

---

## Session 1 — Core wiring: tenant database, transactions, clock (step 8a)
- [x] Done

```text
Phase 1 step 8a: wire the tenancy spike into Nest. No new tables.
Read: docs/adr/0005 "Spike outcome", ai-context/06, 12, 03, 14, apps/api/src/core/tenancy/, core/database/.
Scope:
- DatabaseModule provides TenantContext and TenantDatabase<PrismaClient> over PrismaService.
- TransactionRunner = thin injectable over TenantDatabase.transaction() (12 "Application services").
- A separate platform Prisma client (app_platform, BYPASSRLS) behind its own provider, only for the future platform module;
  add DATABASE_PLATFORM_URL to config (optional) + .env.example + the dev role bootstrap.
- Clock abstraction (core) with a fixed-clock test helper.
- Lint/dependency-cruiser rule: modules may not import PrismaService or the generated client directly
  (ADR-0005 Compliance), only core/tenancy.
Out of scope: guards, tables, HTTP endpoints.
Acceptance: unit tests for the wiring; integration test that a provider-resolved TenantDatabase is isolated;
the dependency rule fails on a deliberate violation (then remove it). Plan first.
```

## Session 2 — `tenant` module schema + first real tenant-owned table (step 9a)
- [x] Done

```text
Phase 1 step 9a: tenant module data layer.
Read: ai-context/modules/tenant-management.md, 05 (tenants, tenant_settings), 06, 23, 12, 14, docs/adr/0005.
Scope:
- prisma/schema/tenant.prisma + migration: tenants (global, no RLS), tenant_settings (tenant_id PK, RLS per the 06
  template incl. NULLIF policy, DB default for tenant_id).
- Settings Zod schema (versioned) in packages/contracts; TenantService/SettingsService application services and
  repositories via TenantDatabase (no HTTP yet).
- Integration tests with two tenants; RLS meta-test (RLS_GAPS_SQL) over the real migrated schema as a permanent test.
- Register tenant files in 23 and .dependency-cruiser MODULE_DEPS if needed.
Out of scope: endpoints, signup, setup wizard, platform ops. Plan first.
```

## Session 3 — Core tables: number sequences, outbox, worker (step 8b)
- [x] Done

```text
Phase 1 step 8b: core number_sequences + outbox_events + pg-boss worker process.
Read: ai-context/05 (§3 Core, §5), 06, 12 (Background jobs), 25, ADR-0013, 17, 14.
Scope:
- core.prisma + migration: number_sequences, outbox_events (tenant-owned: RLS + composite keys per 06).
- NumberSequenceService (UPDATE … RETURNING inside the caller's transaction).
- Outbox writer (same transaction as the change) + dispatcher running in a worker entrypoint (src/worker.ts) with
  pg-boss; job handlers run inside TenantContext.run (06 "Jobs").
- Integration tests: sequence concurrency (parallel increments never collide), outbox written atomically and
  dispatched once, per-tenant handler context.
Out of scope: idempotency keys (needs users — session 6), scheduled scans. Plan first.
```

## Session 4 — `user` + `auth` core: users, memberships, sessions, login (steps 10a/11a)
- [ ] Done

```text
Phase 1 steps 10a/11a: users, tenant_memberships, sessions; login/logout/session; AuthGuard + TenantGuard.
Read: ai-context/modules/authentication.md, modules/user-management.md, 07, 08, 06, 10, 20, 23, ADR-0009, 14.
Scope:
- user.prisma + auth.prisma + migration: users (global, citext email), tenant_memberships (tenant-owned, RLS),
  sessions (global).
- argon2id hashing (08), __Host-session cookie, session table with idle/absolute expiry, login throttling.
- Endpoints: POST /auth/login, POST /auth/logout, GET /auth/session, POST /auth/switch-tenant.
- Global guards in order AuthGuard → TenantGuard (sets TenantContext from session.active_tenant_id after checking
  ACTIVE membership + ACTIVE tenant). @Public() for login.
- API tests (Supertest + Testcontainers): 401s, wrong password, suspended tenant, switch to a non-member tenant → 404.
Out of scope: password reset, invitations, signup, permissions (session 6). Plan first.
```

## Session 5 — `audit` module (step 13, moved up)
- [ ] Done

```text
Phase 1 step 13: audit_logs + AuditService + viewer API.
Read: ai-context/21, 05 (audit_logs), 06, 07, 23, 10, 14.
Scope:
- audit.prisma + migration: audit_logs (tenant-owned, RLS, append-only: REVOKE UPDATE/DELETE from app_user).
- AuditService.record(...) joining the caller's transaction; actor/requestId from context.
- Audit the actions built so far: login success/failure, logout, tenant switch, settings changes.
- GET /api/v1/audit-logs with filters + cursor pagination (22); permission check added in session 6 — leave a TODO
  test that fails closed until then (deny by default).
- Tests: rows written in the same transaction (rollback → no audit row), app_user cannot UPDATE/DELETE audit rows.
Plan first.
```

## Session 6 — `authorization`: permissions, roles, guards, idempotency (step 12)
- [ ] Done

```text
Phase 1 step 12 (+ idempotency from step 8).
Read: ai-context/modules/authorization.md, 09, 07, 10, 06, 23, ADR-0010, 14; core idempotency in 10/12.
Scope:
- authorization.prisma + migration: permissions (global catalog synced from code), roles, role_permissions,
  membership_roles (tenant-owned, composite FKs, RLS). Default roles seeded per tenant.
- PermissionService.can() + project-scope resolution; PermissionGuard + @RequirePermission; every existing endpoint
  declares a permission or @Public (deny by default); GET /auth/session returns effective permissions.
- Roles CRUD endpoints, permission catalog endpoint; audit role/permission changes.
- idempotency_keys table + @IdempotencyRequired middleware.
- Delete the tenancy spike tables/schema (core/tenancy/__tests__/spike) now that real composite-FK tables have
  isolation tests; keep the perf script only if it's ported to a real table, otherwise remove perf:tenancy and note
  it in ADR-0005.
- Tests: permission matrix per endpoint (401/403/404/success), tenant isolation for roles.
Plan first.
```

## Session 7 — Auth flows: invitations, password reset, session management (steps 10b/11b)
- [ ] Done — requires the email decision above

```text
Phase 1 steps 10b/11b: invitations, password reset/change, email verification, session list/revoke, user admin.
Read: ai-context/modules/authentication.md, modules/user-management.md, 08, 16, 25, 07, 14.
Scope:
- auth_tokens table (hashed tokens, expiry, single use).
- Endpoints per the module files: invitations (create/resend/revoke/preview/accept), password forgot/reset/change,
  email verify, sessions list/revoke/revoke-others, users list/detail/activate/deactivate, /me.
- Emails via events → the minimal email channel agreed before session 1 (Mailpit in dev/tests).
- No user enumeration; constant-time token comparison; audit everything.
- Tests: token expiry/reuse, privilege escalation on invite blocked, emails captured in tests.
Plan first.
```

## Session 8 — Tenant lifecycle: setup, signup, settings API, platform ops (step 9b)
- [ ] Done

```text
Phase 1 step 9b: tenant HTTP + provisioning.
Read: ai-context/modules/tenant-management.md, 17, 06 ("Platform operations", "Tenant lifecycle"), 08, 10, 14.
Scope:
- GET/PATCH /tenant, GET/PATCH /tenant/settings (version-checked), books-lock endpoint.
- Self-hosted: POST /setup (first run only) + `cli.js setup` and `cli.js seed` (dev data with two tenants).
- SaaS: POST /auth/signup (flag-gated) creating tenant + owner membership + default roles in one transaction.
- platform module using the BYPASSRLS client: list/create/suspend/reactivate tenants, audited.
- Tests: setup disabled after first tenant, signup disabled in self_hosted, suspended tenant blocks login.
Plan first.
```

## Session 9 — Web: auth screens + tenant switcher (step 14a)
- [ ] Done

```text
Phase 1 step 14a: web login, logout, invite accept, forgot/reset password, setup wizard, tenant switcher.
Read: ai-context/11, 10, 08, apps/web (existing shell, api-client), packages/contracts.
Scope: pages under apps/web with React Hook Form + Zod from contracts, TanStack Query, session bootstrap,
route protection, 360px-first layouts, loading/empty/error states. Component tests (RTL + MSW).
Plan first.
```

## Session 10 — Web: users & roles, company settings, audit viewer (step 14b)
- [ ] Done

```text
Phase 1 step 14b: web users & invitations, roles & permissions editor, company settings, audit log viewer.
Read: ai-context/11, 09, 21, modules/user-management.md, modules/authorization.md, modules/tenant-management.md.
Scope: screens hidden/disabled by effective permissions from GET /auth/session (UI hint only — API enforces);
TanStack Table lists with cursor pagination; mobile layouts. Component tests. Plan first.
```

## Session 11 — Phase 1 exit: isolation sweep, permission matrix, auth security review
- [ ] Done

```text
Phase 1 exit review.
Read: ai-context/26 (Phase 1 exit), 14, 07, prompts/security-review.md, prompts/code-review.md.
Do: (1) tenant-isolation sweep — every tenant-owned endpoint has B-gets-404 / list / reference tests; RLS meta-test green;
(2) permission matrix complete for every endpoint; (3) security review of auth using the template, fix findings;
(4) first Playwright E2E journey #1 (setup/signup → invite → accept → login) on desktop + mobile viewport;
(5) update CLAUDE.md status to "Phase 1 done", 26, module files. Report findings before fixing anything large.
```

---

After Phase 1: Phase 2 (party, project, contract, files/document) — write the next guide the same way from 26.
