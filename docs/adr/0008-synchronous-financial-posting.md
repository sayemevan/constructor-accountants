# ADR-0008: Synchronous financial posting; events only for side effects

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 03, 25

## Context
The spec proposed event-driven flows such as "Employee payment created → Finance transaction created → Project cost
updated". Asynchronous posting can leave business documents approved without their financial effect (or vice versa)
after a crash or handler bug.

## Decision
Modules create financial effects by calling `FinancePostingService` inside their own DB transaction. Domain events
are written to a transactional outbox and processed asynchronously only for side effects (notifications, summary
refresh, integrations). Derived figures (project cost, party balance) are computed from source tables, so "X updated"
events are unnecessary for correctness.

## Alternatives considered
Async event posting with sagas/compensation (complex, eventual inconsistency in money); in-process synchronous event
bus for postings (hidden coupling, same transaction but implicit — harder to reason about).

## Consequences
+ Atomic, consistent money. + Clear, explicit dependencies (registry). − Finance is a hard dependency of posting
modules (acceptable; finance never depends back).
