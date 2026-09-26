# Template: New Feature

```text
Task: Implement <feature name> in the <module> module.

Goal / user story:
As a <role>, I want <capability> so that <outcome>.

Acceptance criteria:
1. <observable behaviour>
2. <…>

Business rules: see ai-context/modules/<module>.md §<section> (and 24-financial-model.md §<x> if money is involved).
Additional rules/clarifications: <only what is NOT already documented>.
Out of scope: <explicit exclusions>.

Before coding:
1. Read ai-context/modules/<module>.md, 23-module-registry.md, and the standards for layers you will touch
   (10 API, 11 frontend, 12 backend, 05 database, 24 financial model, 14 testing).
2. Inspect apps/api/src/modules/<module>/, apps/api/prisma/schema/<module>.prisma,
   packages/contracts/src/<module>/, apps/web/src/features/<module>/ and their tests.
3. Search for existing helpers/components/services you can reuse.
4. Produce a short plan: files to change, schema changes, endpoints (method, path, permission, idempotency),
   events, permissions + default role grants, tests. Wait for my approval if the plan changes schema of
   another module, the financial model, permissions semantics, or adds a dependency.

Implementation order: domain (+unit tests) → repository → application service (transaction, audit, outbox) →
controller + contracts → web feature (mobile-first, loading/empty/error states) → integration/API tests
(incl. tenant isolation + permission matrix) → docs update.

Finish with: summary of changes, commands run and results (lint, typecheck, tests), open questions.
```
