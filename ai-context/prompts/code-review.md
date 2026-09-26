# Template: Code Review

```text
Review the changes in <branch/PR/diff> against this project's rules.

Load: 18-ai-development-rules.md, 03, 12 or 11 (by layer), 10, 20, 14, the touched modules' files, 24 if money,
06/07/09 if endpoints or queries changed.

Check and report findings by severity (blocker / major / minor / nit) with file:line and a concrete fix:
1. Architecture: correct module & layer; imports only via index.ts; no cycles; no logic in controllers/components
2. Tenancy: tenant from context; tenant-scoped client; composite FKs & RLS for new tables; 404 cross-tenant
3. Authorization: @RequirePermission on every route; scope checks; sensitive fields gated; no role-name checks
4. Validation & errors: strict Zod; standard error codes; no leaked internals
5. Financial: postings via FinancePostingService; immutability; void/reversal; idempotency; locks; Decimal only;
   audit entries; formulas match 24
6. Data: migration safety (expand/contract), indexes for new queries, no N+1/unbounded queries
7. Tests: mandatory categories from 14 present and meaningful; no weakened assertions
8. Frontend: mobile 360px, states, accessibility, shared components reused, no authoritative calc
9. Code quality: naming per glossary, duplication, dead code, dependency justification
10. Docs: module file/registry/ADR updated
Finish with a verdict: approve / approve with nits / request changes.
```
