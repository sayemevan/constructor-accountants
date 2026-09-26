# 03 — System Architecture

Load when: creating a module, adding cross-module interaction, adding infrastructure, or reviewing structure.

## Style: modular monolith (ADR-0001)
One deployable backend with strict internal module boundaries, so a module can be extracted later if a real
need appears (e.g., reporting read replica, notification service). We do **not** start with microservices:
the team is small, consistency across finance is critical (single DB transaction), and self-hosted customers
need a simple install.

## Runtime components

```text
Browser / mobile browser (PWA later)
        │ HTTPS (single origin: https://app.example.com)
        ▼
Reverse proxy (Caddy / Nginx / cloud LB) ── TLS, compression, body-size limits
   ├── /api/*  ──► api      (NestJS HTTP, stateless, N instances)
   └── /*      ──► web      (Next.js server, stateless, N instances)
api ──► PostgreSQL (all business data, sessions, jobs via pg-boss, outbox)
api ──► Object storage (S3-compatible) or local volume   (via FileStorage abstraction)
worker (same image as api, `node dist/worker.js`) ──► PostgreSQL, storage, SMTP (optional)
```

- Single origin means session cookies are first-party and CORS is not needed.
- **Redis is optional** (SaaS rate-limit store / cache later). Nothing may *require* Redis.
- Web never talks to the database. The API is the only system of record access.

## Monorepo layout (ADR-0002)

```text
/apps
  /web                    Next.js App Router (UI only)
  /api                    NestJS (HTTP main.ts + worker.ts), Prisma schema & migrations
/packages
  /contracts              Zod schemas, enums, API request/response types, permission codes, error codes
  /config                 shared tsconfig, eslint, prettier presets
/ai-context               AI development context (this folder)
/docs                     ADRs, architecture review, reference spec, runbooks
/infrastructure           docker/, compose files, Caddyfile, backup scripts
/tests                    cross-app E2E (Playwright) and shared fixtures
/legacy                   frozen Google-Sheets prototype (reference only)
```

## Backend module anatomy (NestJS)

```text
apps/api/src/modules/<module>/
  <module>.module.ts        Nest module wiring; exports ONLY the public services
  index.ts                  public API: service interfaces, DTO types, event types — nothing else
  <module>.permissions.ts   permission codes owned by this module
  api/                      controllers + request/response mapping (thin)
  application/              use-case services: orchestrate, open DB transaction, call domain, call other modules
  domain/                   pure TypeScript: calculations, invariants, state machines, domain errors
  infrastructure/           Prisma repositories / query services for this module's tables only
  events/                   event payload types + handlers (side effects only)
  __tests__/                unit (domain), integration (application+DB), api (controller) tests
apps/api/src/core/          cross-cutting: tenancy, auth guards, config, prisma, errors, logging, audit, outbox, jobs, storage
apps/api/prisma/schema/     multi-file Prisma schema: one <module>.prisma per module
```

Layer rules (enforced by dependency-cruiser in CI):
- `api → application → domain`; `application → infrastructure`; `domain` imports nothing framework-specific
  (no Nest, no Prisma client, no HTTP). Domain uses `Decimal` and plain types.
- Controllers contain **no business logic**: parse (Zod) → call one application service → map response.
- A module may import another module **only via its `index.ts`**. Never import another module's
  `infrastructure/` or query its tables. Exception: `reporting` reads across tables via read-only SQL.
- No dependency cycles between modules. Direction is fixed in `23-module-registry.md`.

## Request pipeline (every protected request)

```text
request → requestId + logger context
        → AuthGuard        (session cookie/bearer → user, session; 401 if invalid)
        → TenantGuard      (active tenant from session; membership ACTIVE; tenant ACTIVE; sets TenantContext)
        → PermissionGuard  (@RequirePermission code; resolves scope; 403 if missing)
        → ZodValidationPipe(body/query/params; 400 on failure)
        → Controller → ApplicationService
              → resource scope check (project access for ASSIGNED_PROJECTS scope; 404 if outside)
              → business validation (domain; 422 on rule violation)
              → DB transaction (tenant-scoped Prisma; RLS set) → audit log → outbox events
        → response envelope / exception filter (20-error-handling)
```

`TenantContext` (AsyncLocalStorage) holds `{ tenantId, userId, membershipId, permissions, requestId }`.
Repositories read the tenant from it — callers cannot pass a different tenant.

## Cross-module communication — three mechanisms, each with a purpose

| Need | Mechanism | Example |
|---|---|---|
| Read data owned by another module | Call its public query service | Payroll asks Employee for pay rate on a date |
| Change that must be atomic with mine (esp. money) | Call its public command service **inside my DB transaction** | Payroll approval → `FinancePostingService.createObligation()` |
| Side effect that may happen later / may fail independently | Domain event → outbox → worker handler | `PayrollRunApproved` → notify accountant |

The source spec proposed events for finance postings ("Employee payment created → finance transaction
created"). That is **rejected** for financial data: async posting can leave payroll approved with no payable.
Financial postings are synchronous and transactional (ADR-0008). Details: `25-domain-events.md`.

## Background processing (ADR-0013)
pg-boss (PostgreSQL-backed queue + cron) in the `worker` process:
- outbox dispatcher (domain events → handlers), notification delivery, scheduled reminders (dues, salary,
  deadlines, equipment returns), report exports, image thumbnails, file scanning, cleanup (expired sessions,
  idempotency keys, orphan uploads).
- Every job payload carries `tenantId`; the job runner establishes TenantContext before touching data.
- Jobs are idempotent (safe to retry) and have bounded retries with backoff.

## Configuration & modes
`DEPLOYMENT_MODE=saas|self_hosted`. Self-hosted: signup disabled, one tenant bootstrapped via setup wizard/CLI,
platform-admin endpoints disabled, entitlements all enabled. All differences are driven by config, never by
forked code paths scattered in modules — use `DeploymentModeService` / `EntitlementService`.

## Extension points (how future modules plug in)
New module = new folder with the anatomy above + Prisma schema file + permissions file + module context doc +
registry entry. It reuses auth, tenancy, permissions, audit, files, notifications, finance posting and
reporting. Examples: Inventory posts material purchases as payables through Finance; Client Portal is a new
app/route group using a new external-user membership type; Double-entry GL consumes finance postings.

## What we deliberately do not do
Microservices, event sourcing, CQRS read stores, GraphQL, Kubernetes, service mesh, per-tenant databases
inside one deployment, generic "entity framework" metadata engines, plugin marketplaces. Revisit only via ADR
with evidence.
