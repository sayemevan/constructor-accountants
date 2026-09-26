# ADR-0001: Modular monolith on NestJS

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 03-system-architecture.md, 23-module-registry.md

## Context
The platform has ~17 modules with tight financial interactions (payroll, subcontracts, rentals and client bills
all create money obligations). It must run as multi-tenant SaaS and as a simple self-hosted install. The team is
small and development is AI-assisted. The spec proposed NestJS or Laravel.

## Decision
One NestJS application (HTTP + worker entrypoints) with strict internal module boundaries (public `index.ts`,
layered folders, dependency-cruiser rules, no cross-module table access). TypeScript end to end.

## Alternatives considered
| Option | Why not |
|---|---|
| Microservices | Distributed transactions for money, ops cost, harder self-hosting; no scaling need yet |
| Laravel | Two languages (PHP + TS frontend), no shared validation contracts with the web app |
| Unstructured monolith | Coupling grows; AI agents drift without enforced boundaries |

## Consequences
+ Single DB transaction for financial consistency; one deployable; easy self-host.
+ Modules extractable later (reporting, notifications) because they communicate through interfaces/events.
− Requires discipline: boundary lint rules and reviews are mandatory.
Revisit if one module needs independent scaling or release cadence that the monolith blocks.

## Compliance
dependency-cruiser in CI; code-review checklist; registry kept current.
