# 13 — Coding Standards (all TypeScript)

Load when: writing or reviewing code of any kind.

## TypeScript
- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- No `any`. Use `unknown` + narrowing. `as` casts only with a comment explaining why they're safe.
- No non-null assertions (`!`) except in tests.
- Prefer `type` for data shapes, `interface` for implementable contracts (e.g., `FileStorage`).
- Exhaustive `switch` on unions/enums with a `never` check.
- Public functions have explicit return types.

## Naming
| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `record-payment.service.ts`, `project-card.tsx` |
| React components | PascalCase | `ProjectCard` |
| Hooks | `use` + camelCase | `useProjects` |
| Constants | UPPER_SNAKE | `MAX_PAGE_SIZE` |
| Booleans | `is/has/can/should` | `isArchived` |
| Money variables | suffix meaningfully | `netAmount`, `dailyRate` (never `price1`) |
| Dates | `…Date` for business dates, `…At` for timestamps | `workDate`, `approvedAt` |
Domain language comes from `02-business-domain.md` glossary. Don't invent synonyms (no "customer" for Party
with CLIENT role, no "worker" in code for Employee, no "bill" when you mean obligation).

## Structure
- Functions do one thing; > 40 lines is a smell; > 3 levels of nesting → extract.
- Early returns over nested else.
- No duplicated business logic — one source (e.g., wage calculation exists only in `payroll/domain`).
- No dead code, commented-out code, or unused exports. Delete, git remembers.
- Comments explain **why**, not what. Public domain functions get a short doc comment with formula/rule refs.
- `TODO` must include a ticket/issue reference or be resolved before merge.

## Money & time
- `Decimal` for all money/rates/quantities in backend; strings on the wire; format only at the UI edge.
- Rounding: round to 2 dp **at line level**, `ROUND_HALF_UP`, via shared `roundMoney()` helper; totals are sums of
  rounded lines.
- Never `new Date()` inside domain logic; inject a `Clock`. Business dates in tenant timezone (`today(tenantTz)`).

## Errors
Throw typed errors (12/20). Never swallow errors; never `catch {}` without handling/logging. No error-code strings
inline — use constants from `@repo/contracts/errors`.

## Imports
Absolute aliases (`@/core/...`, `@repo/contracts`). No deep imports into other modules. No circular imports.
Order: node → external → internal → relative (enforced by ESLint).

## Formatting & linting
Prettier (default + 100 cols), ESLint must pass with zero warnings in CI. Don't disable rules inline without
a justification comment.

## Dependencies
Check 04 first. Justify any new dependency in the PR: purpose, maintenance status, size, license (MIT/Apache/BSD
preferred; no AGPL in the app bundle), alternatives considered.

## Git
- Branches: `feat/<module>-<short>`, `fix/…`, `chore/…`, `docs/…`.
- Conventional Commits: `feat(payroll): calculate overtime from attendance`.
- Small PRs (< ~400 changed lines excluding generated/migrations) focused on one concern.
- PR description: what, why, context files consulted, migrations, permissions added, tests, screenshots (UI,
  mobile + desktop).
- Never commit secrets, `.env`, generated build output, or unrelated formatting changes.

## Documentation
Update the module context file and registry in the same PR when behaviour, entities, permissions, endpoints or
events change. ADR for architectural decisions (18/19).
