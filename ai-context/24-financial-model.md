# 24 — Financial Model

Load for anything involving money: finance, payroll, subcontractor, contract/client bills, equipment rental,
machinery costs, reports. Decisions: ADR-0007 (model), ADR-0008 (synchronous posting).

## 1. Why not "one transactions table"
The source spec stored every money fact in a single `Transaction` table (plus a duplicate `Expense` table).
That cannot represent: amounts **owed but not yet paid** (unpaid wages, subcontractor bills, rental charges,
client bills), **partial payments**, **advances** and their recovery, or a payment that settles several bills.
It also invites double counting (expense row + transaction row for the same cost).

A full double-entry general ledger would solve it but is more than the MVP needs and harder for users.
**Chosen: an AP/AR-lite sub-ledger** — three core concepts that map cleanly onto double-entry later.

## 2. Core concepts

| Concept | Table | Meaning | Mutability |
|---|---|---|---|
| Money account | `money_accounts` | Where money sits: cash box, bank, mobile wallet | Editable metadata; archived not deleted |
| Category | `finance_categories` | Income / expense / capex / non-operating classification | Tenant-editable, system categories locked |
| **Transaction** | `financial_transactions` | An actual movement of money in/out of a money account | Immutable once POSTED; void = reversal |
| **Obligation** | `finance_obligations` + `_lines` | An amount owed: PAYABLE (we owe) or RECEIVABLE (owed to us); lines carry category + project (+ machine) | Immutable amounts once created; void = status VOIDED (only if unsettled, else reverse allocations first) |
| **Allocation** | `payment_allocations` | Part of a transaction applied to an obligation | Immutable; reversal sets `reversed_at` |

Counterparty on transactions/obligations: `party_id` **or** `employee_id` (never both; may be neither for
misc cash expenses/income or transfers).

### Transaction kinds
| kind | direction | Examples | Counts as |
|---|---|---|---|
| RECEIPT | IN | client payment, other income, deposit refund | income (unless purpose = DEPOSIT_REFUND) |
| PAYMENT | OUT | wages, subcontractor, supplier, rent, advances, deposits | cash out (cost is recognized via obligations) |
| TRANSFER | OUT + IN pair (`transfer_group_id`) | bank → cash box | neither income nor expense |
| OPENING_BALANCE | IN/OUT | account opening balance | neither |
| ADJUSTMENT | IN/OUT | bank charges correction, cash count difference (with category) | per category |
Reversal rows reuse the original kind with opposite direction and `reversal_of_id`.

`purpose`: SETTLEMENT (allocated to obligations), ADVANCE (intentionally unallocated, to be recovered),
DEPOSIT / DEPOSIT_REFUND (refundable, never cost/income), OTHER.
`context_type/context_id` records what an advance/deposit relates to (e.g., SUBCONTRACT, EQUIPMENT_RENTAL,
EMPLOYEE) so it can be recovered from the right future obligation.

### Obligation sources (all created only through `FinancePostingService`)
| Source module | source_type | Direction | Created when | Category (system_key) |
|---|---|---|---|---|
| payroll | PAYROLL_ITEM | PAYABLE (employee) | payroll run approved | LABOR (lines per project; deductions negative) |
| subcontractor | SUBCONTRACT_BILL | PAYABLE (party) | bill approved | SUBCONTRACT |
| equipment-rental | RENTAL_CHARGE | PAYABLE (party) | charge approved | EQUIPMENT_RENTAL (+ TRANSPORT etc.) |
| machinery | MACHINE_MAINTENANCE | PAYABLE (vendor) | maintenance cost recorded | MACHINERY_REPAIR (machine_id on line) |
| finance | MANUAL_EXPENSE | PAYABLE (supplier or none) | expense recorded | any EXPENSE/CAPEX category |
| contract | CLIENT_BILL | RECEIVABLE (client) | client bill approved | CONTRACT_REVENUE / EXTRA_WORK |
`UNIQUE (tenant_id, source_type, source_id)` makes posting idempotent.

## 3. Posting rules (the only ways money data is written)

`FinancePostingService` methods (all run inside the caller's DB transaction):
- `createObligation({ direction, counterparty, issueDate, dueDate, lines[], source, projectId })`
- `recordTransaction({ kind, direction, accountId, amount, date, counterparty, projectId, categoryId, purpose, context, allocations[] })`
- `allocate(transactionId, [{ obligationId, amount }])` — also used to recover advances (no new cash).
- `voidTransaction(id, reason, voidDate)` / `voidObligation(id, reason)`
- `recordTransfer(fromAccountId, toAccountId, amount, date)`

Invariants enforced (with `SELECT … FOR UPDATE` on affected obligations/transactions):
1. Amounts > 0; Σ obligation lines = obligation total; lines may be negative but total > 0.
2. Allocation direction match: PAYMENT(OUT) ↔ PAYABLE; RECEIPT(IN) ↔ RECEIVABLE.
3. Allocation counterparty match (same party/employee).
4. Σ active allocations of a transaction ≤ transaction amount; of an obligation ≤ obligation total.
5. Obligation `settled_amount`/`status` recomputed in the same transaction (OPEN → PARTIALLY_SETTLED → SETTLED).
6. Dates > tenant `booksLockedUntil` for any posting, allocation or void.
7. Project must not be COMPLETED/CANCELLED unless caller has `project.modify_closed`.
8. Currency = tenant base currency (MVP).
9. Transactions over tenant approval threshold → `PENDING_APPROVAL` (not counted anywhere until POSTED).
   Approver ≠ creator unless `allowSelfApproval`.

### Common flows
| Business action | Posting |
|---|---|
| Client payment received | RECEIPT (party=client, project) + optional allocations to client-bill receivables; unallocated = client advance |
| Other income | RECEIPT with income category, no allocation |
| Expense paid now | Obligation(MANUAL_EXPENSE, lines) + PAYMENT + allocation — one transaction |
| Expense on credit (supplier bill) | Obligation only; later PAYMENT + allocation |
| Employee advance | PAYMENT(employee, purpose ADVANCE, context EMPLOYEE) — unallocated |
| Payroll approved | Obligation per payroll item; allocate existing employee advances up to approved recovery amount |
| Salary paid (full/partial) | PAYMENT(employee) + allocations to payroll obligations (oldest first by default) |
| Subcontract advance | PAYMENT(party, purpose ADVANCE, context SUBCONTRACT id) |
| Subcontract bill approved | Obligation; recover advance per bill's `advanceRecovery` via allocation |
| Rental deposit / refund | PAYMENT purpose DEPOSIT / RECEIPT purpose DEPOSIT_REFUND (context rental) |
| Machine purchase | Obligation with CAPEX category (+ payment); machine record links it; excluded from project P&L |
| Void payment | Reversal row (opposite direction, same amount, `reversal_of_id`), original gets `voided_at`; its allocations reversed; obligations reopen |

## 4. Derived figures (never stored as editable fields)

Let "active" = status POSTED (transactions) / not VOIDED (obligations) / `reversed_at IS NULL` (allocations).
Reversal rows are POSTED rows, so sums over POSTED transactions net voids automatically.

- **Money account balance** = opening_balance + Σ IN − Σ OUT (POSTED, up to date).
- **Obligation outstanding** = total − Σ active allocations.
- **Party balance (receivable side)** = Σ RECEIVABLE obligations − Σ allocations to them − unallocated receipts
  (negative → client advance). **Payable side** = Σ PAYABLE obligations − allocations − unallocated advances paid.
- **Project cost incurred** = Σ obligation lines (EXPENSE categories, project = P, active obligations).
  Excludes CAPEX and NON_OPERATING categories and deposits.
- **Project income received** = Σ RECEIPT amounts (project = P, income purposes) net of reversals.
- **Project billed** = Σ RECEIVABLE obligation lines for project.
- **Project profit (MVP, management view)** = income received − cost incurred.
- **Project cash position** = Σ receipts − Σ payments (project-tagged).
- **Contract value** = original amount + Σ approved variations; **remaining contract** = contract value − income received.
- **Overhead** = cost lines with no project.
Reports must label the basis ("profit = received income − incurred cost"). This is a management metric, not a
statutory P&L. Alternative bases (billed revenue − incurred cost) are a report option later.

## 5. Void / cancel / adjust
- **Cancel**: records never posted (DRAFT/PENDING_APPROVAL) → CANCELLED. No financial effect.
- **Void (transaction)**: permission `finance.transaction.void`, reason required, date > lock date. Creates reversal,
  reverses allocations, recomputes obligations, audits. Originals remain visible, marked "Voided".
- **Void (obligation/source document)**: only if no active allocations (UI offers to reverse allocations first).
  Source module status → VOIDED (e.g., subcontract bill, payroll run).
- **Adjustment**: a new obligation (positive) or credit-type line (negative line on a new obligation, total > 0) or
  ADJUSTMENT transaction — never modify originals. Payroll corrections go into the next run as ADJUSTMENT lines.

## 6. Approvals
Tenant settings: `approval.paymentThreshold`, `approval.expenseThreshold`, `approval.allowSelfApproval`.
Status flow: `PENDING_APPROVAL → POSTED | REJECTED | CANCELLED`. Approval emits `ApprovalRequired`/`…Approved`
events for notifications. Payroll runs and bills have their own approve step (which posts obligations).

## 7. Reconciliation & integrity jobs
Nightly per tenant: recompute obligation settled amounts from allocations, verify Σ lines = totals, verify
transfer pairs balance, verify no POSTED row dated ≤ lock date was created after the lock was set. Drift → error
log + alert + notification to owners; never auto-"fix" silently.

## 8. MVP vs future accounting expansion
| MVP (now) | Future (by ADR) |
|---|---|
| Single base currency per tenant | Multi-currency with exchange rates per transaction |
| AP/AR-lite sub-ledger | Double-entry GL: each posting generates journal lines (Obligation PAYABLE → Dr Expense / Cr AP; PAYMENT → Dr AP / Cr Cash; RECEIPT → Dr Cash / Cr AR or Income). Categories map to GL accounts. The sub-ledger stays as source documents |
| Received-income − incurred-cost profit | Revenue recognition options, WIP, percentage-of-completion |
| Retention not modeled | Retention on client & subcontract bills (withheld amounts as separate obligations) |
| No tax engine | VAT/withholding tax lines on obligations, tax reports per jurisdiction |
| Machine purchase = CAPEX, no depreciation | Fixed asset register with depreciation posting to projects via usage rates |
| Manual bank entries | Bank statement import & reconciliation |
| Books lock date | Accounting periods open/close, year-end |

Design constraints that keep the future open: immutable postings with source references, categories as data,
line-level project/category allocation, counterparty on every posting, and no stored running balances.

## 9. Money handling rules
`Decimal` everywhere in backend; `numeric(18,2)`; line-level rounding `ROUND_HALF_UP` via `roundMoney()`; strings
in JSON; formatting only in UI with tenant locale/currency. No arithmetic on money in the frontend except clearly
labelled previews.
