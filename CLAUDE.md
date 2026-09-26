# CLAUDE.md — Construction Project Management & Accounting SaaS

This file is always loaded. Keep it short. Detailed rules live in `ai-context/`.

@ai-context/00-master-context.md

## Repository status (update as phases complete)

- **Current phase:** Phase 0 — architecture and AI context prepared; application not yet scaffolded.
- `src/`, `public/`, root `package.json`: **legacy Google-Sheets prototype ("BuildLedger")**. It is a
  UX/domain reference only. Do NOT extend it, do NOT copy its data layer, do NOT treat its types as the
  schema. See `docs/adr/0016-legacy-prototype.md`. It will move to `legacy/` when the monorepo is scaffolded.
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

Not yet available — the monorepo has not been scaffolded (Phase 0). When it is, list here:
install, dev, lint, typecheck, test (unit / integration / e2e), prisma migrate, build.
