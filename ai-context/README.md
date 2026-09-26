# AI Development Context System

The single source of truth for AI-assisted development of the Construction Project Management & Accounting
SaaS. The PDF in `docs/reference/` is the original requirements input; where they differ, these files win (the
differences are justified in `docs/architecture/design-review.md` and `docs/adr/`).

## Structure

```text
ai-context/
  00-master-context.md        ALWAYS loaded (imported by CLAUDE.md) — identity, stack, non-negotiables
  01-project-overview.md      product, users, MVP vs future scope
  02-business-domain.md       domain model, relationships, cross-cutting rules, glossary
  03-system-architecture.md   modular monolith, layers, communication, request pipeline
  04-technology-stack.md      libraries & tools with justification
  05-database-architecture.md conventions, entity catalog, constraints, indexes, deletion policy, migrations
  06-multi-tenancy.md         tenant isolation design and rules
  07-security-rules.md        security rules (all layers)
  08-authentication-rules.md  sessions, passwords, onboarding
  09-authorization-rules.md   RBAC + project scope, permission codes, default roles
  10-api-standards.md         REST conventions, envelopes, pagination, idempotency, uploads
  11-frontend-standards.md    Next.js structure, data fetching, forms, mobile-first, components
  12-backend-standards.md     NestJS layers, services, repositories, jobs
  13-coding-standards.md      TypeScript, naming, money/time, git
  14-testing-standards.md     tools, mandatory test categories, CI gates
  15-file-storage.md          storage abstraction, upload/download flows
  16-notification-system.md   channels, rules, catalog
  17-deployment-architecture.md  images, envs, migrations, backups, monitoring, CI/CD, self-hosted
  18-ai-development-rules.md  never/always rules for agents, decision authority
  19-development-workflow.md  standard and large-task workflows, Definition of Done
  20-error-handling.md        error classes, codes, mapping
  21-logging-and-auditing.md  app logs vs audit logs, what to audit
  22-performance-rules.md     budgets, query/report/image/frontend rules
  23-module-registry.md       module ownership, public services, allowed dependencies
  24-financial-model.md       transactions / obligations / allocations, posting rules, derived figures
  25-domain-events.md         when to use events, outbox, event catalog
  26-implementation-roadmap.md phases and exact build order
  modules/*.md                one file per module (purpose … must-not)
  prompts/*.md                reusable task templates
```

### Changes from the requested structure (and why)
- **Added `24-financial-model.md`** — the financial design is the riskiest part of the system and is referenced
  by six modules; keeping it in one file avoids contradictory copies in finance/payroll/subcontractor/etc.
- **Added `25-domain-events.md`** — one catalog of events and the sync-vs-async rule, instead of repeating the
  mechanism in every module file (modules list only their own events).
- **Added `26-implementation-roadmap.md`** — agents need to know what is in scope *now*.
- **Added `prompts/`** — one file per template so only the needed template is loaded.
- **Kept 08/09 and modules/authentication.md + authorization.md** but split responsibilities: 08/09 are
  cross-cutting *rules* every module follows; the module files describe the auth modules' own entities/APIs.
- **Company Settings and Platform ops folded into `modules/tenant-management.md`**; **Audit Log module** is fully
  specified in `21-logging-and-auditing.md`; **Expense/Income management** are part of `modules/finance.md` (they
  are not separate modules — see 24); **site progress updates** are part of `modules/project.md`.
- **ADRs live in `docs/adr/`**, not in ai-context — they are history/rationale, loaded only when needed.

## Loading strategy (token budget)

| Tier | Files | When |
|---|---|---|
| **Always** | `CLAUDE.md` → `00-master-context.md` | Every session (~2k tokens) |
| **Per module** | `modules/<m>.md` + `23-module-registry.md` (+ `24` for money modules: finance, payroll, subcontractor, contract, equipment-rental, machinery, reporting) | Any task in that module |
| **Per layer** | `05`+`06` (schema), `10` (API), `11` (web), `12`+`20` (backend), `14` (tests), `15` (files), `16`+`25` (notifications/events) | When touching that layer |
| **On demand** | `01`, `02`, `03`, `04`, `07`, `08`, `09`, `13`, `17`, `18`, `19`, `21`, `22`, `26`, `docs/adr/*`, prompts | Planning, reviews, security work, infra, new modules |

Typical task loads: payroll bug fix → 00 + modules/payroll.md + 24 + 12 + 14 (≈ 10–12k tokens) instead of the
whole 165-page spec.

## Mapping to tools

**Claude Code**
- `CLAUDE.md` (root): imports `00-master-context.md`, holds repository status, routing table and commands.
- Optional later: nested `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md` that `@import` 12/10/20 and 11
  respectively, so layer rules auto-load when working in those folders.
- Prompt templates can be turned into slash commands (`.claude/commands/<name>.md`) by copying the template body.

**Cursor** (`.cursor/rules/*.mdc`)
| Rule file | Type | Content |
|---|---|---|
| `00-core.mdc` | `alwaysApply: true` | Points to 00 + 18 (created) |
| `api.mdc` | globs `apps/api/**` | Reference 12, 10, 20, 06, 21 |
| `web.mdc` | globs `apps/web/**` | Reference 11, 10 |
| `prisma.mdc` | globs `apps/api/prisma/**` | Reference 05, 06 |
| `tests.mdc` | globs `**/*.test.ts, tests/**` | Reference 14 |
| `finance.mdc` | globs `apps/api/src/modules/{finance,payroll,subcontractor,contract,equipment-rental,machinery}/**` | Reference 24 |
| `module-<m>.mdc` | globs for that module | Reference modules/<m>.md |
Create the non-core rule files when the corresponding folders exist (Phase 0 scaffold).

**Other agents / IDEs**: an `AGENTS.md` can be a copy of CLAUDE.md's routing table pointing to the same files.

## Maintenance
- Update module files, registry and CLAUDE.md status in the same PR as behaviour changes (template:
  `prompts/documentation-update.md`).
- Keep `00` short; move detail to the tier where it is needed.
- Never duplicate a rule in two files — link to the owner file instead.
