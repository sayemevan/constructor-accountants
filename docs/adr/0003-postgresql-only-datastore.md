# ADR-0003: PostgreSQL as the only required datastore

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 04, 05, ADR-0013

## Context
Financial data needs ACID transactions and strong constraints; self-hosted installs should need as few services
as possible.

## Decision
PostgreSQL 17+ holds business data, sessions, audit logs, the outbox and the job queue (pg-boss). Redis, search
engines and message brokers are optional and must never be required for correctness.

## Alternatives considered
MySQL (weaker constraint features: no exclusion constraints, weaker RLS story); MongoDB (no relational integrity
for finance); adding Redis/RabbitMQ now (extra ops for self-hosting with no current need).

## Consequences
+ Simple install/backup (one DB + files). + RLS, partial/exclusion constraints, numeric, JSONB available.
− Queue throughput bounded by PG — ample for expected load; revisit at high scale.
