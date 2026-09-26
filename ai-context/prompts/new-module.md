# Template: New Module

```text
Task: Design (and after approval, scaffold) a new module: <module-name>.

Purpose: <one paragraph>
Primary users & workflows: <…>
Known requirements: <bullets or link to spec section>
Phase: <from 26-implementation-roadmap.md>

Step 1 — Design only (no code). Read: 00, 02, 03, 05, 06, 09, 10, 23, 24 (if money), 25, and the module files of
modules it will depend on. Then write ai-context/modules/<module-name>.md with ALL sections:
  Purpose · Responsibilities · Entities (tables, key columns, constraints, indexes) · Relationships ·
  Business rules · APIs (method, path, permission, idempotency) · Permissions (+ default role grants) ·
  Events (emitted/consumed) · Validation · Financial impact (posting rules via FinancePostingService) ·
  Audit requirements · Future extension · Must NOT
Also propose: registry row + dependency line (no cycles), ADR if new infrastructure or financial-model change,
attachment resolver / notification types / reports it contributes.
Stop and wait for approval.

Step 2 — Scaffold after approval: folder anatomy per 03, Prisma schema file with tenant_id + composite FKs +
RLS migration, permissions file, contracts, empty controller/service/repository with one vertical slice
(create + get) fully tested including tenant isolation, web feature skeleton. Update registry + CLAUDE.md routing if needed.
```
