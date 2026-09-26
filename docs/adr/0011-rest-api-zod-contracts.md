# ADR-0011: REST /api/v1 with shared Zod contracts and a standard error envelope

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 10, 20

## Context
Spec requires REST and versioning; its response format `{status, data}` / `{status, message, errors}` lacks
machine-readable codes and request ids, and it used PUT/DELETE where they conflict with auditability.

## Decision
REST under `/api/v1`, Zod schemas in `packages/contracts` for request/response (used by web forms and API pipe),
OpenAPI generated from them. Success `{ data, meta? }`; errors `{ error: { code, message, details, requestId } }`.
PATCH for partial updates, POST action endpoints for state transitions, no DELETE for financial/master data,
Idempotency-Key for financial creates, optimistic `version`.

## Alternatives considered
GraphQL (authorization per field/tenant harder, caching complexity, less useful for mobile offline sync); tRPC
(couples clients to TS, weaker for third-party/mobile integrations); class-validator DTOs (can't share with frontend).

## Consequences
+ One schema source, typed clients, predictable errors. − Must keep contracts browser-safe.
