# 20 — Error Handling

Load when: throwing, catching, or mapping errors (backend) or displaying errors (frontend).

## Error classes (`apps/api/src/core/errors`)
| Class | HTTP | Default code | When |
|---|---|---|---|
| (Zod pipe) | 400 | `VALIDATION_FAILED` | Shape/format of body, query, params invalid |
| (framework) | 400 | `BAD_REQUEST` | Malformed request (e.g. invalid JSON body) or unmapped 4xx |
| `UnauthenticatedError` | 401 | `UNAUTHENTICATED` / `SESSION_EXPIRED` / `INVALID_CREDENTIALS` | No/invalid/expired session; bad login |
| `ForbiddenError` | 403 | `PERMISSION_DENIED` | Authenticated, lacks permission code |
| `NotFoundError` | 404 | `NOT_FOUND` (`PROJECT_NOT_FOUND` etc. optional) | Missing, other tenant, or outside assigned scope |
| `ConflictError` | 409 | `CONFLICT`, `VERSION_CONFLICT`, `DUPLICATE_VALUE`, `IDEMPOTENCY_KEY_REUSED`, `REQUEST_IN_PROGRESS` | Uniqueness, optimistic lock, idempotency |
| `BusinessRuleError` | 422 | specific, e.g. `PROJECT_INVALID_STATUS_TRANSITION`, `ALLOCATION_EXCEEDS_BALANCE`, `BOOKS_LOCKED`, `PAYROLL_PERIOD_OVERLAP`, `ATTENDANCE_LOCKED`, `SELF_APPROVAL_NOT_ALLOWED`, `PARTY_ROLE_REQUIRED`, `PROJECT_CLOSED` | Valid request that violates a domain rule |
| (body parser) | 413 | `PAYLOAD_TOO_LARGE` | JSON body over the parser limit |
| (upload) | 413 / 415 | `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` | Upload limits |
| (throttler) | 429 | `RATE_LIMITED` | Too many requests (`Retry-After` header) |
| `ServiceUnavailableError` | 503 | `SERVICE_UNAVAILABLE` | Dependency down (DB, storage) — retryable |
| anything else | 500 | `INTERNAL_ERROR` | Bugs/unexpected — generic message |

All codes are constants in `packages/contracts/src/errors.ts` (shared with the web app). Adding a code = add it
there + document in the module file.

## Response shape
```json
{ "error": { "code": "ALLOCATION_EXCEEDS_BALANCE",
  "message": "Allocation exceeds the remaining amount of the bill.",
  "details": [ { "path": "allocations[0].amount", "code": "max", "message": "Maximum is 4500.00" } ],
  "requestId": "01JB…" } }
```
- `message`: safe, human readable, no internals. `details`: optional, field-level or rule context (no data from
  other tenants, no SQL, no stack).
- `requestId` always present (also in `X-Request-Id` response header).

## Global exception filter
Code: `apps/api/src/core/errors/` (`global-exception.filter.ts` + `map-exception.ts`). RLS-violation → 404 mapping
is added with the tenancy spike (roadmap step 7); until then `P2003` always maps to 409 `CONFLICT`.
Maps: our error classes → table above; Zod errors → 400 with details; Prisma errors: `P2002` → 409
`DUPLICATE_VALUE` (field names mapped to API paths, constraint names never exposed), `P2025` → 404, `P2003` →
409/422 depending on context, `P2034` (serialization/deadlock) → retry once in TransactionRunner then 409
`CONFLICT`, connection errors → 503. RLS violation → 404 and a **security log** entry (it indicates a bug).
Unknown → 500 `INTERNAL_ERROR`, full error logged with stack and requestId at `error` level.

## Rules
- Domain/application code throws typed errors; never `HttpException`, never plain `Error` for expected cases.
- Don't catch errors just to rethrow them generically; catch only to add context or recover.
- Never expose stack traces, SQL, file paths, env names, or third-party error text to clients (any environment
  except local dev with `EXPOSE_ERROR_DETAILS=true`).
- Never differentiate "exists but forbidden" from "not found" for tenant/scope reasons (404 for both).
- Login/reset errors never reveal whether an account exists.
- Log 4xx at `info`/`warn` (401/403 bursts matter for security monitoring), 5xx at `error`.
- Background jobs: throw to trigger retry for transient errors; mark permanent failures (validation) as failed
  without retry and alert.
- External calls (SMTP, storage): timeouts always set; wrap failures as `ServiceUnavailableError` or retryable job errors.

## Frontend handling
`ApiError` from the API client. Map by status: 400 → field errors; 401 → redirect to login (return URL);
403 → access denied state; 404 → not found state; 409 `VERSION_CONFLICT` → "This record changed, reload?"
dialog; 409 duplicate → field error; 422 → form-level alert with message; 429 → retry later toast; 5xx/network →
error state with retry + requestId. Never show raw JSON. Error boundaries per route segment (`error.tsx`).
