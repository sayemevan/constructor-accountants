# 10 — API Standards

Load when: adding or changing any HTTP endpoint, DTO, or API client code. Endpoint lists per module live in
`modules/*.md`; this file defines conventions only.

## Style
REST over JSON, versioned by URL prefix: `/api/v1/...`. Breaking changes → new version for the affected
resources (`/api/v2/...`) while v1 keeps working for a deprecation period. Additive changes (new optional
fields, new endpoints) are non-breaking. Clients must ignore unknown response fields.

## URLs
- Plural kebab-case nouns: `/api/v1/parties`, `/api/v1/money-accounts`, `/api/v1/payroll/runs`.
- Module prefix when it clarifies ownership: `/finance/transactions`, `/payroll/runs`, `/reports/...`.
- IDs are UUIDs in path: `/projects/{projectId}`.
- Sub-resources for strict ownership: `/projects/{projectId}/updates`, `/subcontracts/{id}/bills`.
  Max nesting depth 2. Top-level filtered lists are preferred for cross-cutting lists
  (`/attendance?projectId=...`).
- **Domain actions** (state transitions) use `POST /{resource}/{id}/{action}` with verbs from a fixed set:
  `approve`, `reject`, `submit`, `void`, `cancel`, `archive`, `restore`, `calculate`, `complete`,
  `change-status`, `return`, `allocate`. Actions take a body (e.g., `{ reason }`).
- No tenant id in URLs. Current tenant = session's active tenant (06).

## Methods
| Method | Use |
|---|---|
| GET | Read; never changes state |
| POST | Create, or domain action |
| PATCH | Partial update of mutable fields (JSON merge semantics; only listed fields) |
| PUT | Full replacement of a set-like sub-resource only: `PUT /roles/{id}/permissions`, `PUT /users/{id}/roles`, `PUT /attendance/sheet` (bulk upsert), `PUT /notifications/preferences`. Never for partial updates of entities |
| DELETE | Only for non-financial, unreferenced records (e.g., a draft attendance row, a document attachment). Never for financial records, projects, parties, employees, users (use archive/deactivate) |

## Request validation
- Every body/query/params validated by a Zod schema from `packages/contracts`, strict (unknown keys → 400).
- Money: string decimal `"12500.00"` (regex `^-?\d{1,15}(\.\d{1,2})?$`), converted to `Decimal` server-side.
- Dates: business dates `YYYY-MM-DD`; timestamps ISO 8601 UTC with `Z`.
- Enums: `UPPER_SNAKE_CASE` strings.
- IDs: UUID strings.
- Field names: `camelCase` in JSON.

## Response format
Success (single):
```json
{ "data": { "id": "…", "name": "…" } }
```
Success (list):
```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 25, "total": 312 } }
```
Cursor feeds (audit logs, notifications, activity): `"meta": { "nextCursor": "…" | null }`.
Created → `201` with the resource in `data`; action → `200` with updated resource; no body → `204`.
Error (see 20):
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Request validation failed.",
  "details": [ { "path": "amount", "code": "too_small", "message": "Must be greater than 0" } ],
  "requestId": "01J…" } }
```
The spec's `{ status: true/false }` envelope is replaced: HTTP status conveys success; errors need stable
machine-readable codes and a request id.

Response DTOs are explicit mappers — never return Prisma entities directly (prevents leaking columns like
`password_hash`, `tenant_id`, internal flags).

## Pagination, filtering, sorting, search
- Offset pagination: `?page=1&pageSize=25` (default 25, max 100). `meta.total` included unless
  `includeTotal=false`.
- Cursor pagination for append-only feeds: `?cursor=…&limit=50`.
- Filters: flat, explicit, documented query params: `status=ACTIVE`, `projectId=…`, `partyId=…`,
  `dateFrom=2026-01-01&dateTo=2026-01-31` (inclusive), multi-value as repeated params `status=A&status=B`.
- Sorting: `sort=-txnDate,createdAt` — whitelist per endpoint; default sort always deterministic (tie-break on id).
- Search: `q=` for free-text on whitelisted columns (trigram); min length 2.
- Archived records excluded unless `includeArchived=true` (requires view permission).

## Authentication & authorization
All endpoints authenticated unless `@Public()` (auth flows, health). Order: auth → tenant → permission →
validation → scope → business rules (03). Permission required per endpoint is documented in the module file.

## Idempotency
- Required header `Idempotency-Key` (UUID) on POST endpoints that create money or post documents:
  receipts, payments, transfers, expenses, allocations, payroll approve, bill approve, void.
  Recommended for all other creates from mobile.
- Server stores (tenant, user, key) → request hash + response for 24 h. Same key + same body → replay stored
  response. Same key + different body → 409 `IDEMPOTENCY_KEY_REUSED`. Concurrent duplicate → 409 `REQUEST_IN_PROGRESS`.

## Concurrency
Mutable resources expose `version`. PATCH and actions must send `version` (body) → mismatch returns
409 `VERSION_CONFLICT`; the client refetches and retries with user confirmation.

## File upload APIs (see 15)
1. `POST /api/v1/files/upload-intents` `{ fileName, contentType, sizeBytes, purpose }` → `{ fileId, uploadUrl,
   method, headers, expiresAt }` (presigned PUT for S3-compatible, or API upload URL for local driver).
2. Client uploads bytes to `uploadUrl`.
3. `POST /api/v1/files/{fileId}/complete` → server verifies size/type/checksum → status READY.
4. `POST /api/v1/documents` `{ fileId, entityType, entityId, documentType, title }` attaches it.
5. `GET /api/v1/documents/{id}/download-url` → short-lived signed URL after authorization.

## Long-running operations
Exports and heavy reports: `POST /api/v1/reports/exports` → 202 `{ data: { id, status: "QUEUED" } }`;
poll `GET /reports/exports/{id}`; download via signed URL when READY.

## Documentation
OpenAPI generated from contracts, served at `/api/docs` outside production (or behind auth). Each endpoint's
permission, idempotency requirement and error codes are declared in its route metadata.

## Compatibility checklist before changing an existing endpoint
Removing/renaming fields, changing types/enums/semantics, tightening validation, or changing default
sort/filters is **breaking**. Search the web app and E2E tests for usages; prefer additive change or a new version.
