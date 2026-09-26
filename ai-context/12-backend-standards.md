# 12 — Backend Standards (apps/api, NestJS)

Load when: writing any backend code. Module anatomy and layer rules are in 03.

## Controllers (`api/`)
- One controller per resource. Responsibilities: route, `@RequirePermission`, validation pipe binding,
  `@IdempotencyRequired` where needed, call **one** application service method, map result to response DTO.
- No Prisma, no business `if`s, no loops over domain data, no try/catch for business errors (the global filter
  maps errors).
```ts
@Post(':id/approve')
@RequirePermission('payroll.run.approve')
@IdempotencyRequired()
approve(@Param('id', ParseUuid) id: string, @Body(zod(ApproveRunBody)) body: ApproveRunBody) {
  return this.approvePayrollRun.execute(id, body).then(toPayrollRunResponse);
}
```

## Application services (`application/`)
- Use-case oriented (`ApprovePayrollRunService.execute()` or grouped `PayrollRunService.approve()` — follow
  the module's existing pattern). They: load aggregates via repositories, check resource scope, call domain
  functions, persist, call other modules' public services, write audit + outbox, all inside one transaction.
- Transactions via `TransactionRunner.run(async (tx) => …)` which provides the tenant-scoped transaction client
  to repositories (propagated through AsyncLocalStorage so nested module calls join the same transaction).
- No HTTP concepts (Request/Response, status codes) in services.

## Domain (`domain/`)
- Pure functions and small classes: calculations (`calculateDailyWage`), state machines
  (`assertProjectTransition(from, to)`), invariants, domain errors (`PayrollPeriodOverlapError`).
- Input/outputs are plain typed objects with `Decimal`. No I/O, no Date.now() (pass `today` in), no Nest, no Prisma.
- 100% of money calculations and status transitions live here and are unit tested.

## Repositories / data access (`infrastructure/`)
- Only place that touches Prisma. Tenant-scoped client only. Methods named for intent:
  `findByIdOrThrow(id)`, `listForProject(projectId, filter, page)`, `lockForUpdate(ids)`.
- Always `select` needed fields for lists; avoid N+1 (batch `in` queries, `include` with care).
- Map Prisma models to domain/read models; don't leak Prisma types beyond the module.
- Row locks via `$queryRaw\`SELECT … FOR UPDATE\`` (tenant predicate included).
- Read-heavy cross-table listings use a dedicated `*QueryService` in the same module.

## DTOs & validation
- Schemas in `packages/contracts/src/<module>/*.ts` (Zod): `CreateProjectBody`, `ProjectResponse`,
  `ListProjectsQuery`. Types inferred with `z.infer`.
- Global `ZodValidationPipe`; strict objects; transform strings to `Decimal`/dates in the pipe layer of the module.
- Business validation (e.g., "party must have CLIENT role") belongs to application/domain, not to Zod.

## Guards & decorators (core)
`AuthGuard`, `TenantGuard`, `PermissionGuard` registered globally (APP_GUARD) in that order.
Decorators: `@Public()`, `@RequirePermission(code | codes[], { anyOf })`, `@CurrentUser()`, `@Tenant()`,
`@IdempotencyRequired()`, `@AuditAction('project.created')` (optional helper; explicit `auditLog.record` is fine).

## Errors
Throw typed errors from `core/errors` (`NotFoundError`, `BusinessRuleError(code, message, details)`,
`ConflictError`, `ForbiddenError`). Never throw Nest `HttpException` from domain/application. Mapping: 20.

## Cross-module calls
- Import only from `modules/<other>/index.ts`. Inject the other module's exported service.
- Finance posting API (`FinancePostingService`) is the only way other modules create transactions/obligations.
- Never call another module's controller or HTTP endpoint internally.

## Events
- Record events with `outbox.add(event)` inside the transaction. Handlers live in `events/` of the consuming
  module, are idempotent, and run in the worker. See 25.

## Background jobs
- Define job name constants + payload Zod schema in the owning module (`<module>/jobs/*.job.ts`).
- Handlers: validate payload → establish TenantContext → do work in small transactions → idempotent.
- Scheduled jobs registered centrally in `core/jobs/schedules.ts` with cron + timezone handling (per-tenant
  timezone computed in handler).

## Configuration
`core/config` exposes a typed, Zod-validated config object. No `process.env` outside `core/config`.

## Logging
Inject the pino logger; log events with context objects (`logger.info({ runId }, 'payroll run approved')`).
No `console.log`. Never log PII, money details with party names, tokens, or request bodies of auth endpoints.

## Naming
Files kebab-case: `approve-payroll-run.service.ts`, `payroll-run.repository.ts`, `payroll.controller.ts`.
Classes PascalCase; methods camelCase verbs. Enum values UPPER_SNAKE. One exported class per file.

## Module checklist (before a module is "done")
Schema + migration (tenant_id, composite FK, RLS, indexes) · permissions file + default role grants ·
contracts (schemas) · controllers with permissions · services with transactions, audit, events · domain tests ·
integration tests (incl. tenant isolation & permission matrix) · module context doc updated · registry updated.
