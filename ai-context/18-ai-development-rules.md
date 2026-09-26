# 18 — AI Development Rules

Load for any non-trivial task. These rules bind Claude Code, Cursor, and any other coding agent.

## Absolute rules (never)
1. Never ignore the existing architecture (03) or invent a parallel structure.
2. Never create a database entity/column without first checking `apps/api/prisma/schema/`, 05, and the module
   file. Never duplicate a concept that exists (Party, obligations, documents, categories…).
3. Never duplicate existing functionality — search for helpers, services, components, hooks before writing new ones.
4. Never bypass or weaken authentication.
5. Never bypass or weaken authorization (no missing `@RequirePermission`, no role-name checks, no scope skipping).
6. Never bypass tenant isolation (no base Prisma client, no tenantId from input, no raw SQL without tenant filter).
7. Never hardcode secrets, credentials, URLs of environments, or tenant-specific values.
8. Never modify unrelated modules or files "while you're there". Note it instead.
9. Never add a dependency without checking 04 and justifying it.
10. Never change a public API (endpoint, contract schema, event payload, permission code) without checking
    consumers and compatibility (10).
11. Never hard-delete or edit posted financial records; never store derived financial totals as editable fields.
12. Never put business logic in controllers or React components.
13. Never use floating point for money.
14. Never delete, skip, or weaken tests to make a build pass.
15. Never run destructive commands against shared databases (`migrate reset`, `db push`, `DROP`) or push to
    protected branches; never commit `.env` files.
16. Never touch `legacy/` (or the current root `src/` prototype) except to move/archive it when explicitly asked.
17. Never fabricate results: if tests weren't run or failed, say so.

## Always
1. Follow existing conventions in the surrounding code (naming, structure, error style, test style).
2. Load the relevant context files (routing table in `CLAUDE.md`) before planning.
3. Consider tests for every change; write them with the code (14).
4. Consider mobile responsiveness for every frontend change (360px first).
5. Preserve financial auditability: reversal over edit, audit every significant change.
6. Explain architectural changes **before** implementing them and wait for approval when they affect more than one
   module, the schema of another module, security, tenancy, or the financial model.
7. Keep changes small and focused; one concern per PR.
8. Update docs in the same change: module context file, registry, ADR when a decision is made.
9. State assumptions explicitly. If a requirement is ambiguous and affects money, security, or data model — ask.
10. Use domain vocabulary from 02; use existing error codes, permission codes, and events.
11. Prefer boring, explicit code over clever abstractions; no speculative generality.
12. Validate every input at the boundary; map every output explicitly.
13. Run lint, typecheck, and the relevant tests before declaring done; report what was run.

## Decision authority
| AI may decide | AI must propose and wait |
|---|---|
| Internal structure within a module following standards | New module, new cross-module dependency |
| Private helper names, component composition | New table or change to another module's table |
| Test cases, refactors inside one module w/o behaviour change | Changes to financial model, posting rules, tenancy, auth, permissions catalog semantics |
| Adding indexes for a demonstrated query | New dependency / infrastructure component |
| UI layout following 11 | Breaking API change, new API version |

## Red flags — stop and re-check context
You are about to: create `clients`/`suppliers`/`expenses`/`payments` tables · add `tenantId` to a DTO · write
`prisma.` in a service · compute wages in a component · add `DELETE` for a financial resource · catch and ignore
an error · add `@Public()` · store a running balance column · call an HTTP endpoint of our own API from the backend ·
add Redis/Kafka/microservice · copy code from `legacy/`.

## Context hygiene (token efficiency)
Load 00 always (via CLAUDE.md), then only the module file(s) and standards relevant to the task. Don't paste whole
specs into prompts; reference file paths. Summarize findings instead of re-reading large files repeatedly.
