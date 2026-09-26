# ADR-0007: Financial model — transactions, obligations, allocations

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 24-financial-model.md, modules/finance.md

## Context
The spec used one `Transaction` table plus a duplicate `Expense` table. Requirements include outstanding balances
for parties, payroll, subcontracts, rentals and clients; advances and their recovery; partial payments; void
instead of delete; and future accounting expansion.

## Decision
AP/AR-lite sub-ledger: immutable `financial_transactions` (cash movements), `finance_obligations` + lines
(payables/receivables with category/project allocation), `payment_allocations` (settlement links). Advances are
unallocated payments recovered by allocation. Void = reversal entry. All balances and profit are derived.
Project profit (MVP) = income received − cost incurred (obligation lines), clearly labelled as a management metric.
No double-entry GL in MVP; model maps 1:1 onto journal entries later.

## Alternatives considered
| Option | Why not |
|---|---|
| Single transactions table | Cannot represent dues, partials, advances; double counting risk |
| Full double-entry GL now | Heavier UX and implementation than MVP needs; users are not accountants |
| Stored running balances | Drift, concurrency bugs, non-auditable |

## Consequences
+ Correct dues/advances; auditable; extensible. − More concepts for developers (documented in 24);
UI must hide complexity (e.g., "Expense paid now" creates obligation + payment + allocation in one action).
