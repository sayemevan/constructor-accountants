# 19 — Development Workflow

Load for any task beyond a one-line fix.

## Standard workflow (small/medium tasks)
```text
Understand → Inspect existing code → Identify relevant context → Plan → Implement → Test → Review → Document
```
1. **Understand** — restate the goal, acceptance criteria, affected module(s). Ask if money/security/data-model
   ambiguity exists.
2. **Inspect** — read the module folder, its schema file, its contracts, related tests, similar features.
   Search before creating anything.
3. **Context** — load module file(s) + the standards the task touches (routing table in CLAUDE.md).
4. **Plan** — list files to change, schema/API changes, permissions, events, tests. For medium tasks share the plan
   before coding.
5. **Implement** — domain first (pure logic + unit tests) → infrastructure → application → API → UI.
6. **Test** — run lint, typecheck, unit, relevant integration/API tests; add tenant-isolation and permission tests
   for new endpoints; check UI at 360px and desktop.
7. **Review** — self-review with the checklist below; fix before presenting.
8. **Document** — update module file, registry, ADR (if a decision was made), CLAUDE.md status if a phase changes.

## Large tasks (new module, cross-module feature, financial change)
```text
Requirement → Architecture review → Database review → API design → Implementation → Testing → Security review → Code review
```
- **Requirement:** user stories + acceptance criteria + business rules (cite module file / 24).
- **Architecture review:** module ownership, dependencies (registry direction), events, sync vs async, ADR need.
- **Database review:** entities, keys, composite FKs, constraints, indexes, RLS, migration plan (expand/contract).
- **API design:** endpoints, permissions, schemas in contracts, error codes, idempotency, pagination.
- **Implementation:** in vertical slices (one use case end-to-end at a time), each slice tested.
- **Testing:** domain, integration, API, tenant isolation, permission matrix, E2E journey update.
- **Security review:** prompts/security-review.md checklist.
- **Code review:** prompts/code-review.md checklist.
Get human approval after the architecture/database/API design step before large implementation.

## Definition of Done
- [ ] Acceptance criteria met; business rules match module file / 24
- [ ] Tenant isolation: repository scoped, composite FKs, RLS on new tables, isolation tests
- [ ] Permissions declared, default role grants decided, permission tests
- [ ] Validation strict; errors use standard codes
- [ ] Financial changes: posted via FinancePostingService, reversible, audited, idempotent endpoint
- [ ] Audit entries for significant actions
- [ ] Tests added/updated and passing (unit/integration/API/E2E as applicable)
- [ ] UI: loading/empty/error states, mobile 360px checked, accessible labels
- [ ] No new dependency without justification; no unrelated changes
- [ ] Docs updated (module file, registry, ADR if needed)
- [ ] Lint, typecheck, build pass

## Self-review checklist
Correct module placement? Layer rules respected? Any duplicated logic? Any N+1 / unbounded query? Any `number`
used for money? Any missing `await`/transaction boundary? Error paths tested? Response mapping hides internal
fields? Does the migration work on a non-empty database?

## Session hygiene for AI agents
- Start: read CLAUDE.md status; confirm the phase and module.
- Work in a feature branch; commit in logical steps with conventional messages when the user asks you to commit.
- End: summarize what changed, what was tested (commands + results), open questions, and follow-ups.
