# ADR-0013: pg-boss for background jobs and scheduling

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 03, 25, ADR-0003

## Context
Needs: outbox dispatch, notifications, reminders (cron), exports, thumbnails, cleanup. Self-hosted should avoid Redis.

## Decision
pg-boss (PostgreSQL-backed) in a separate `worker` process from the API image. Jobs carry tenantId, are idempotent,
retried with backoff, dead-lettered with alerts. Cron schedules registered centrally; per-tenant fan-out jobs.

## Alternatives considered
BullMQ (requires Redis); cloud queues (vendor lock-in); NestJS in-process cron only (no durability/retries,
duplicates across replicas).

## Consequences
+ No extra infrastructure; transactional proximity to data. − Throughput limits at very high scale → revisit with metrics.
