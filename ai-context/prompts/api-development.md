# Template: API Development

```text
Task: <add/change> endpoint(s) <METHOD /api/v1/...> for <purpose> in module <module>.

Read: 10-api-standards.md, 20-error-handling.md, 09-authorization-rules.md, 06-multi-tenancy.md,
ai-context/modules/<module>.md. Inspect existing controllers/contracts in the module for conventions.

Define before coding:
- Path & method (REST conventions, action endpoints for state transitions)
- Permission code + scope behaviour (TENANT / ASSIGNED_PROJECTS → 404 outside)
- Request schema (Zod, strict; money as decimal strings; dates YYYY-MM-DD) in packages/contracts
- Response schema (explicit mapper; sensitive fields gated by view permissions)
- Pagination/filter/sort whitelist (lists), idempotency (financial creates/actions), version (updates/actions)
- Error codes (existing constants first) and HTTP statuses
- Compatibility: is this breaking for existing clients? (search apps/web and tests)

Implement: contracts → controller (thin) → application service call → tests:
API test for 201/200, 400 validation, 401, 403, 404 cross-tenant, 404 out-of-scope, 409 version/idempotency,
422 business rule. Update the module file's API section.
```
