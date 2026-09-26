# ADR-0018: Testing stack

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 14

## Decision
Vitest for unit/component tests in both apps (API via `unplugin-swc` for decorator metadata), React Testing Library
+ MSW for UI, Testcontainers PostgreSQL for integration tests (real RLS, constraints), Supertest for HTTP API tests,
Playwright for E2E with desktop and mobile projects, optional fast-check for money invariants.

## Alternatives considered
Jest (Nest default; slower, separate config from web); SQLite/in-memory DB for tests (misses RLS, numeric,
constraint behaviour); Cypress (Playwright has better multi-browser/mobile emulation and parallelism).

## Consequences
+ Tests exercise real PostgreSQL behaviour, catching tenancy bugs. − Integration tests need Docker in CI/dev.
