# ADR-0006: Unified Party model with roles

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** modules/party.md

## Context
Clients, owners, suppliers, subcontractors, consultants and equipment providers overlap (one company can be
several). Separate masters duplicate contact data and split ledgers.

## Decision
One `parties` table + `party_roles` (CLIENT, SUPPLIER, SUBCONTRACTOR, CONSULTANT, EQUIPMENT_PROVIDER, OTHER).
"Owner" = CLIENT. Role-specific data goes in 1:1 extension tables only when needed (e.g., subcontractor_profiles).
Project-specific stakeholder roles use `project_parties`. Employees are not parties.

## Alternatives considered
Separate tables per type (duplication, merged ledgers impossible); single table with a single type column
(cannot express multiple roles).

## Consequences
+ One ledger per counterparty, no duplicates. − Modules must validate required roles (`assertHasRole`).
