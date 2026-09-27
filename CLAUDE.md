# CLAUDE.md — Construction Project Management & Accounting SaaS

This file is always loaded. Keep it short. Detailed rules live in `ai-context/`.

@ai-context/00-master-context.md

## Repository status (update as phases complete)

- **Current phase:** Phase 0 — done (steps 1–7) (prototype in `legacy/`; pnpm monorepo; dev compose
  `infrastructure/compose/dev.yml`; API skeleton in `apps/api/src/core/`: `config` (Zod env), `logging` (pino +
  requestId), `errors` (typed errors + global filter/envelope), `database` (Prisma 7 + pg adapter), `health`;
  multi-file schema in `apps/api/prisma/schema/`; `cli.ts migrate`. Web skeleton in `apps/web`: Tailwind v4,
  shadcn/ui (radix-nova, `components.json`), `lib/api-client.ts` + `ApiError`, TanStack Query provider,
  `(app)` shell with sidebar/header/mobile bottom nav; `next dev` rewrites `/api/*` to the API). CI in
  `.github/workflows/ci.yml` (format, lint + dependency-cruiser, typecheck, unit, build); boundary rules in
  `.dependency-cruiser.cjs` (`MODULE_DEPS` mirrors `23-module-registry.md`). Step 7 tenancy spike done
  (ADR-0005 "Spike outcome"): `apps/api/src/core/tenancy/` (`TenantContext`, `TenantDatabase`, `RLS_GAPS_SQL`),
  Testcontainers harness `src/testing/postgres.ts`, test-only spike tables in `core/tenancy/__tests__/spike/`.
  Not yet wired into Nest. No features yet. Next: Phase 1 step 8.
- `legacy/`: **frozen Google-Sheets prototype ("BuildLedger")**, outside the pnpm workspace, excluded from
  build/lint/format. UX/domain reference only. Do NOT extend it, do NOT copy its data layer, do NOT treat its
  types as the schema. See `docs/adr/0016-legacy-prototype.md`.
- Source requirements: `docs/reference/construction-accounting-architecture.pdf` (Chapters 1–19).
  Where it conflicts with `ai-context/`, **`ai-context/` wins** (corrections are listed in
  `docs/architecture/design-review.md`).

## Context routing — load only what the task needs

| Task touches…                                   | Also read                                                              |
|-------------------------------------------------|------------------------------------------------------------------------|
| A specific business module                      | `ai-context/modules/<module>.md` + `ai-context/23-module-registry.md`  |
| Anything with money (payments, payroll, bills)  | `ai-context/24-financial-model.md`                                     |
| Database schema / migrations / Prisma           | `ai-context/05-database-architecture.md`, `06-multi-tenancy.md`        |
| Backend (NestJS) code                           | `ai-context/12-backend-standards.md`, `20-error-handling.md`           |
| API endpoints / DTOs                            | `ai-context/10-api-standards.md`                                       |
| Frontend (Next.js) code                         | `ai-context/11-frontend-standards.md`                                  |
| Auth, sessions, roles, permissions              | `ai-context/08-…`, `09-…`, `07-security-rules.md`                      |
| Files / uploads / photos                        | `ai-context/15-file-storage.md`                                        |
| Notifications, reminders, domain events         | `ai-context/16-notification-system.md`, `25-domain-events.md`          |
| Tests                                           | `ai-context/14-testing-standards.md`                                   |
| Logging, audit trail                            | `ai-context/21-logging-and-auditing.md`                                |
| Performance, reports, large lists               | `ai-context/22-performance-rules.md`                                   |
| Docker, env vars, CI, deployment                | `ai-context/17-deployment-architecture.md`                             |
| Deciding what to build next                     | `ai-context/26-implementation-roadmap.md`                              |
| Any non-trivial task                            | `ai-context/18-ai-development-rules.md`, `19-development-workflow.md`  |
| Using a task template                           | `ai-context/prompts/<template>.md`                                     |
| Why something was decided                       | `docs/adr/`                                                            |

## Commands

Node 24 (`.nvmrc`), pnpm (version pinned in root `package.json` → `packageManager`). Run from the repo root.

| Task | Command |
|---|---|
| Install | `pnpm install` |
| Dev (contracts watch + api :3001 + web :3000) | `pnpm dev` |
| Lint (zero warnings; includes module boundaries) | `pnpm lint` |
| Module boundaries only (dependency-cruiser) | `pnpm lint:deps` |
| Typecheck | `pnpm typecheck` |
| Format / check formatting | `pnpm format` / `pnpm format:check` |
| Build all | `pnpm build` |
| One package | `pnpm --filter @repo/api <script>` (also `@repo/web`, `@repo/contracts`) |

| Dev services (Postgres, RustFS S3, Mailpit) | `docker compose -f infrastructure/compose/dev.yml up -d` |
| API env (first time) | `cp apps/api/.env.example apps/api/.env` |
| Unit tests | `pnpm test` |
| Integration tests (Docker; `*.int.test.ts`) | `pnpm test:int` |
| Tenancy overhead measurement (not in CI) | `pnpm --filter @repo/api perf:tenancy` |
| Add a shadcn/ui primitive | `cd apps/web && pnpm dlx shadcn@4.21.0 add <component>` |
| Create a migration (dev) | `pnpm --filter @repo/api db:migrate:dev --name <name>` |
| Apply migrations (built CLI) | `pnpm --filter @repo/api build && pnpm --filter @repo/api cli migrate` |

Prisma client is generated into `apps/api/src/generated/` (gitignored) by build/lint/typecheck/dev.
Not yet available: e2e tests, `cli seed` — added in later steps. If Testcontainers hangs pulling
`testcontainers/ryuk` locally (Docker credential helper), set `TESTCONTAINERS_RYUK_DISABLED=true`.
