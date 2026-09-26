# Template: Backend Development

```text
Task: Implement <use case/service/job> in apps/api module <module>.

Read: 12-backend-standards.md, 03-system-architecture.md (layers), 13-coding-standards.md, 20-error-handling.md,
21-logging-and-auditing.md, ai-context/modules/<module>.md, 24 if money, 25 if events/jobs.
Inspect the module's application/, domain/, infrastructure/ and similar existing use cases.

Requirements:
- Business rules in domain/ as pure functions with Decimal; inject Clock; typed domain errors
- Application service: tenant-scoped repositories, one TransactionRunner transaction, row locks where balances
  change, calls to other modules only via their index.ts, FinancePostingService for money, AuditService.record,
  outbox events for side effects
- Jobs: payload Zod schema with tenantId, idempotent handler, TenantContext established, chunked work
- No Prisma outside infrastructure/, no HttpException outside api/, no process.env outside core/config

Tests: domain unit tests (edge cases), integration test with Testcontainers (happy path, rule violations,
tenant isolation, concurrency if balances involved), audit row assertion.
Report commands run and results.
```
