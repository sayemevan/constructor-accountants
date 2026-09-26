# 26 — Implementation Roadmap

Load when: choosing the next task, or checking whether a feature is in scope for the current phase.
Order differs from the spec (Chapter 10) in one important way: **Finance core comes before Payroll and
Subcontractors**, because those modules post into Finance (ADR-0008). Machinery and equipment rental stay
after MVP; until then their costs are ordinary expenses with the right category.

Each phase ends with: tests green, docs updated, CLAUDE.md status updated, demo on mobile + desktop.

## Phase 0 — Repository foundation
1. Move the Google-Sheets prototype to `legacy/` (or a `legacy-prototype` branch/tag) — ADR-0016.
2. Scaffold pnpm monorepo: `apps/web`, `apps/api`, `packages/contracts`, `packages/config`; strict TS, ESLint,
   Prettier, dependency-cruiser, Husky.
3. `infrastructure/compose/dev.yml`: PostgreSQL, MinIO-compatible storage, Mailpit.
4. API skeleton: config validation, pino logging, requestId, error filter + envelope, health endpoints,
   Prisma multi-file schema, `cli.ts` (migrate, seed).
5. Web skeleton: App Router, Tailwind, shadcn/ui, API client, error model, layout shell (no data).
6. CI pipeline (lint, typecheck, unit, Testcontainers integration, build).
7. **Spike:** tenant-scoped Prisma extension + RLS + composite FKs; tenant-isolation test harness; measure overhead.
   Record outcome in ADR-0005.

## Phase 1 — Platform core
8. `core`: TenantContext, TransactionRunner, NumberSequenceService, Clock, idempotency middleware, outbox table +
   dispatcher, pg-boss worker process.
9. `tenant`: tenants, settings (Zod-validated), deployment mode, self-hosted setup wizard/CLI, SaaS signup.
10. `auth`: sessions, login/logout, throttling, password reset, invitations accept, session list/revoke.
11. `user`: memberships, invite, activate/deactivate, profile.
12. `authorization`: permission catalog sync, roles CRUD, default roles, guards, `can()`, project scope plumbing.
13. `audit`: AuditService + audit log viewer API.
14. Web: login, invite accept, reset, tenant switcher, users & roles screens, company settings, audit viewer.
Exit: two tenants fully isolated, permission matrix tests, security review of auth.

## Phase 2 — Master data & documents
15. `party` (roles, search, duplicate warnings).
16. `project` (status machine + history, members, project parties, project updates).
17. `contract` (types, variations; client bills deferred to Phase 5).
18. `files` (storage abstraction: local + S3; intents, complete, variants job) and `document` (attachments,
    resolvers, sensitivity, mobile photo upload).
19. In-app notification basics (table + bell, no scheduler yet) — optional here, required by Phase 7.
Exit: create client → project with square-feet contract → upload site photos from phone.

## Phase 3 — Finance core
20. Money accounts, categories (system seed), transactions (receipt/payment/transfer/opening/adjustment).
21. Obligations + lines (manual expenses: paid now / on credit), allocations, advances.
22. Void/reversal, approvals (thresholds, maker-checker), books lock date.
23. Party ledger, account balances, project financial summary (query services + endpoints).
24. Reconciliation job. Web: finance screens (mobile quick "record payment/receipt/expense").
Exit: financial integrity test suite green (idempotency, concurrency, void, lock).

## Phase 4 — Workforce & payroll
25. `employee` (profiles, effective-dated pay rates, assignments, sensitive-field permissions).
26. `attendance` (bulk crew entry on mobile, split days, locking).
27. `payroll` (runs, calculation engine in domain with exhaustive tests, approval → obligations + advance recovery +
    attendance lock, payment via finance allocations, payslip view).
Exit: E2E journey #3 (attendance → payroll → partial payment) on mobile viewport.

## Phase 5 — Subcontractors & client billing
28. `subcontractor` (subcontracts, bills, approval, advance recovery, outstanding).
29. `contract` client bills (running bills, extra work) → receivables; receipt allocation UI.

## Phase 6 — Reporting MVP
30. Project profitability, cost by category, income/expense, party ledger & statements, cash flow by account,
    attendance and wage reports, payroll summaries, dues (aging buckets).
31. Owner dashboard (KPIs, dues, alerts), project dashboard tab.
32. CSV + XLSX exports (async jobs), export audit.

## Phase 7 — Notifications
33. Channel abstraction, email (SMTP), preferences, templates.
34. Scheduled scans (payment/receivable due, salary due, project deadline) + approval-required notifications.

## MVP release hardening
35. Security review (prompts/security-review.md) + dependency audit + pen-test style checks on tenancy.
36. Performance dataset and budgets (22); Lighthouse mobile.
37. Self-hosted package (compose, Caddy, backup/restore scripts, upgrade guide); restore drill.
38. SaaS staging → production pipeline, monitoring & alerts, runbooks.

## Phase 8 — Assets & equipment
39. `machinery` (register, assignments, usage logs, maintenance/fuel expenses via finance, service reminders).
40. `equipment-rental` (rentals, charges → payables, deposits, return tracking, reminders).

## Phase 9 — Mobile experience
41. PWA (manifest, service worker, install), offline attendance queue with idempotent sync, Web Push channel.

## Phase 10+ — Growth (each needs an ADR first)
PDF exports · subscriptions/entitlements & self-hosted license files · retention on bills · tax lines ·
double-entry general ledger · inventory/materials · procurement · BOQ & estimation · client portal ·
tasks/quality/safety · advanced analytics · native apps (React Native) if PWA proves insufficient.
