# 00 — Master Context (always loaded)

## Identity
- **Product:** Construction Project Management & Accounting SaaS — a modular **Construction ERP foundation**
  for construction companies: projects, parties, contracts, workforce, payroll, subcontractors,
  finance, machinery, equipment rental, documents, notifications, reports.
- **Users:** company owners, administrators, accountants, project managers, site supervisors (often on mobile).
- **Deployment:** one codebase, two modes — multi-tenant **SaaS** and single-tenant **self-hosted**
  (customer's server/cloud/domain). No hard dependency on any single cloud vendor.

## Architecture (see 03, ADR-0001)
- **Modular monolith.** One NestJS API process (+ a worker process from the same codebase), one Next.js web
  app, one PostgreSQL database. No microservices, no event sourcing, no CQRS, no Kubernetes.
- Monorepo (pnpm workspaces): `apps/web` (Next.js), `apps/api` (NestJS: HTTP + worker entrypoints),
  `packages/contracts` (shared Zod schemas + API types), `packages/config` (tsconfig/eslint presets).
- Every backend module has layers: `api/` (controllers) → `application/` (use-case services, transactions)
  → `domain/` (pure rules & calculations, no framework imports) → `infrastructure/` (Prisma repositories).
- Modules talk through each other's **public service interface** (`index.ts` exports) — never by
  querying another module's tables. Only `reporting` may read across modules (read-only SQL).

## Stack (see 04)
Node 24 LTS · TypeScript (strict) · NestJS · Prisma · PostgreSQL 17+ · pg-boss (jobs, no Redis required) ·
Next.js App Router · React · Tailwind CSS · shadcn/ui · TanStack Query / Table · React Hook Form + Zod ·
Vitest · Testcontainers · Supertest · Playwright · pino · Docker.

## Core business concepts (see 02, 24)
- **Tenant** = one construction company. All business data belongs to exactly one tenant.
- **User** = global login identity; joins tenants via **Membership**; permissions via tenant-scoped **Roles**.
- **Party** = any external business entity (client/owner, supplier, subcontractor, consultant, equipment
  provider). One Party, many **roles**. Never create separate Client/Supplier master tables.
- **Project** = central business object. Most records reference a project. Contract is **optional**.
- **Employee** = internal worker (not a Party). Pay terms are effective-dated; attendance feeds payroll.
- **Money model:** `financial_transactions` (immutable cash movements) + `finance_obligations`
  (payables/receivables: payroll, subcontract bills, rental charges, supplier expenses, client bills) +
  `payment_allocations` (which payment settled which obligation). Advances = unallocated payments.
- **Profit** is always **derived** from obligations and transactions — never stored or hand-edited.

## Non-negotiable rules
1. **Tenant isolation:** tenant comes from the authenticated session only (never from request body/URL).
   Every tenant-owned table has `tenant_id`; every query is tenant-scoped (repository layer + Postgres RLS).
   Cross-tenant access returns **404**, not 403.
2. **Deny by default:** every endpoint declares `@RequirePermission(...)` or `@Public()`. Check permission
   **and** project scope. Never skip checks "for now".
3. **Financial records are never hard-deleted or edited after posting.** Use void (reversal entry),
   cancel (before posting), or adjustment. Every financial change is audited.
4. **Financial side effects are synchronous and atomic:** a module posts to Finance through
   `FinancePostingService` inside the same DB transaction. Domain events are only for side effects
   (notifications, cache refresh) and go through the outbox.
5. **Money** = `Decimal` (`numeric(18,2)`), serialized as strings in JSON. Never JS `number`/float for money.
   Business dates = `date` (`YYYY-MM-DD`); instants = `timestamptz` (UTC).
6. **Business logic lives in backend `domain/` + `application/`.** Never in controllers, never in React
   components. Frontend may format and pre-validate, never calculate authoritative amounts.
7. **No secrets in code.** Config comes from validated env vars (fail fast on boot).
8. **Validate all input** with Zod schemas from `packages/contracts`. Never build SQL by string concat.
9. **Mobile-first UI:** every screen works at 360px width; field workflows (attendance, photos,
   payments, notifications) must be comfortable one-handed.
10. **Audit** every create/update/void/approve of business-significant records, permission and settings changes.

## Coding philosophy
- Simplest design that satisfies security, auditability and modularity. No speculative abstractions.
- Follow existing patterns before inventing new ones. Search before creating (helpers, components, entities).
- Small focused files; no god services, no giant page components.
- Every change ships with tests proportional to risk (money, permissions, tenancy = always tested).
- Explain architectural changes **before** implementing them; record significant ones as ADRs.

## Module map (owner of each table is listed in 23-module-registry.md)
Core: `tenant` · `auth` · `user` · `authorization` · `audit` · `files` · `notification` · `settings`
Business: `party` · `project` · `contract` · `employee` · `attendance` · `payroll` · `subcontractor` ·
`finance` · `machinery` · `equipment-rental` · `document` · `reporting`
Future (do not build unless asked): inventory/materials, procurement, BOQ, client portal, tasks,
quality, safety, subscriptions/licensing, double-entry general ledger.
