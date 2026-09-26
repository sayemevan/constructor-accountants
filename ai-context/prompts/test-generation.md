# Template: Test Generation

```text
Task: Add tests for <code path/feature> in <module>.

Load: 14-testing-standards.md, the module file (business rules are the test oracle), 24 if money.
Inspect existing tests and factories in the module; follow their style.

Cover (as applicable):
- Domain: every rule and formula in the module file, boundaries (zero, max, rounding, month lengths, rate change
  mid-period, split days), invalid inputs → domain errors
- Application/integration (Testcontainers, two tenants): happy path, rule violations (422 codes), audit rows,
  outbox events, transaction rollback on failure, concurrency (parallel allocations/approvals)
- API: 400/401/403/404 (cross-tenant and out-of-scope)/409/422, response shape and hidden fields
- Frontend: form validation, API error mapping, permission-gated UI, mobile rendering of key states
- E2E: only for core journeys (14)
Do not change production code unless a test reveals a bug — then report it separately.
Report: tests added, what they cover, commands + results, any bugs found.
```
