# Architecture Decision Records

Each significant, hard-to-reverse decision gets an ADR (template: `0000-template.md`). ADRs are immutable once
Accepted; changing a decision = a new ADR that supersedes the old one. Agents must propose an ADR (status
Proposed) before implementing changes to anything listed here.

| # | Decision | Status |
|---|---|---|
| [0001](0001-modular-monolith.md) | Modular monolith on NestJS (not microservices; not Laravel) | Accepted |
| [0002](0002-monorepo-pnpm.md) | pnpm monorepo: apps/web, apps/api, packages/contracts, packages/config | Accepted |
| [0003](0003-postgresql-only-datastore.md) | PostgreSQL as the only required datastore | Accepted |
| [0004](0004-prisma-orm.md) | Prisma ORM with multi-file schema; raw SQL for reports | Accepted |
| [0005](0005-multi-tenancy-shared-schema-rls.md) | Shared schema + tenant_id + composite FKs + RLS; dedicated instances for isolation | Accepted (RLS spike pending) |
| [0006](0006-unified-party-model.md) | Unified Party with roles | Accepted |
| [0007](0007-financial-model.md) | Transactions + obligations + allocations; void by reversal; no GL in MVP | Accepted |
| [0008](0008-synchronous-financial-posting.md) | Financial postings synchronous; events only for side effects via outbox | Accepted |
| [0009](0009-authentication-sessions.md) | First-party DB-backed opaque sessions, argon2id | Accepted |
| [0010](0010-rbac-with-project-scope.md) | Code-defined permissions, tenant roles, project scope | Accepted |
| [0011](0011-rest-api-zod-contracts.md) | REST /api/v1, shared Zod contracts, error envelope | Accepted |
| [0012](0012-file-storage-abstraction.md) | FileStorage abstraction: S3-compatible + local, presigned uploads | Accepted |
| [0013](0013-background-jobs-pg-boss.md) | pg-boss for jobs and cron | Accepted |
| [0014](0014-frontend-architecture.md) | Next.js App Router, client data via TanStack Query, shadcn/ui | Accepted |
| [0015](0015-deployment-docker-single-origin.md) | Docker images, single-origin proxy, same artifacts for SaaS & self-hosted | Accepted |
| [0016](0016-legacy-prototype.md) | Freeze Google-Sheets prototype as reference only | Accepted |
| [0017](0017-money-time-identifiers.md) | Decimal money, date vs timestamptz, UUIDv7 | Accepted |
| [0018](0018-testing-stack.md) | Vitest, Testcontainers, Supertest, Playwright | Accepted |

Candidate future ADRs: i18n/localization approach · PDF generation library · subscription & licensing model ·
double-entry general ledger · retention on bills · offline sync (PWA) · Redis introduction · read replica for reporting.
