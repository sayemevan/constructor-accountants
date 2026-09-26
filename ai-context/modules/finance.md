# Module: Finance (`finance`)

The model and posting rules are defined in `24-financial-model.md` — this file covers module shape, APIs and
permissions. Read both.

## Purpose
The financial backbone: every money movement and every amount owed is recorded here, immutably and auditably;
all balances, dues and profitability figures derive from it.

## Responsibilities
- Money accounts, finance categories (system seed + tenant categories).
- Transactions: receipts, payments, transfers, opening balances, adjustments; approvals; voids (reversal).
- Obligations: manual expenses (supplier bills; paid-now or on-credit) and postings from other modules.
- Allocations: settle obligations, recover advances, reverse allocations.
- `FinancePostingService` (the only write API for money, used by payroll, subcontractor, contract, rental,
  machinery) and `FinanceQueryService` (balances, outstanding, party ledger, project financial summary,
  due obligations for scans).
- Scans: `PaymentDue`, `ReceivableDue`. Nightly reconciliation job. Books lock enforcement.
- Attachment resolver for TRANSACTION and OBLIGATION (receipts, invoices).

## Entities
`money_accounts`, `finance_categories`, `financial_transactions`, `finance_obligations`,
`finance_obligation_lines`, `payment_allocations`.

## Relationships
Counterparties: party or employee. Dimensions: project, category, machine (on lines). Sources: payroll items,
subcontract bills, client bills, rental charges, machine maintenance, manual expenses (stored as
source_module/type/id — finance never imports those modules).

## Business rules
All invariants in 24 §3 plus:
- System categories (by `system_key`) cannot be archived/renamed-in-meaning; tenant categories can be archived
  when unused or kept for history.
- Money account cannot be archived with non-zero derived balance; opening balance entered once as OPENING_BALANCE
  transaction (editable only via void + re-entry).
- Transfers must use two different active accounts; both legs in one DB transaction.
- Receipts from a CLIENT on a project: party must be the project client or have CLIENT role (warn otherwise).
- Payment to employee without allocation requires purpose ADVANCE (explicit) — prevents accidental unallocated wages.
- Deposits (purpose DEPOSIT/DEPOSIT_REFUND) excluded from income/cost reports.
- CAPEX category costs excluded from project profit.

## APIs
- Money accounts: `GET|POST /api/v1/finance/money-accounts` · `GET|PATCH /…/{id}` · `POST /…/{id}/archive`
  · `GET /…/{id}/statement?dateFrom&dateTo`
- Categories: `GET|POST /api/v1/finance/categories` · `PATCH /…/{id}` · `POST /…/{id}/archive`
- Transactions: `GET /api/v1/finance/transactions` (filters: kind, direction, status, projectId, partyId,
  employeeId, accountId, categoryId, dateFrom/To, q) · `GET /…/{id}` (with allocations)
- `POST /api/v1/finance/receipts` · `POST /api/v1/finance/payments` · `POST /api/v1/finance/transfers`
  · `POST /api/v1/finance/adjustments` — all with optional `allocations[]`, `Idempotency-Key` required
- `POST /api/v1/finance/transactions/{id}/approve|reject|cancel|void` (`{ reason }` for reject/void)
- Obligations: `GET /api/v1/finance/obligations` (direction, status, partyId, employeeId, projectId, dueBefore,
  sourceType) · `GET /…/{id}` · `POST /api/v1/finance/expenses` (`{ paidNow, payment?: {...}, lines[] }`)
  · `POST /api/v1/finance/obligations/{id}/void`
- Allocations: `POST /api/v1/finance/allocations` `{ transactionId, items: [{ obligationId, amount }] }` ·
  `POST /api/v1/finance/allocations/{id}/reverse`
- Summaries: `GET /api/v1/finance/parties/{partyId}/ledger` · `GET /api/v1/finance/employees/{employeeId}/ledger`
  · `GET /api/v1/projects/{projectId}/financial-summary` · `GET /api/v1/finance/dues?direction=&bucket=`
- (Spec's `GET /ledger` → party/employee/account ledgers above; spec's `POST /transactions` → typed endpoints.)

## Permissions
`finance.account.view`, `finance.account.manage`, `finance.category.manage`, `finance.transaction.view`,
`finance.transaction.create` (receipts/payments/transfers/adjustments), `finance.transaction.approve`,
`finance.transaction.void`, `finance.expense.create`, `finance.obligation.view`, `finance.obligation.void`,
`finance.allocation.manage`, `finance.ledger.view`.
Defaults: Owner all; Accountant all (TENANT); PM (ASSIGNED) transaction.view, expense.create (site expenses,
subject to approval threshold), obligation.view, ledger.view for their projects; Supervisor none (optional
expense.create for petty cash via tenant customization).

## Events
`ClientPaymentReceived`, `PaymentRecorded`, `EmployeePaymentMade`, `SubcontractorPaymentMade`,
`TransactionVoided`, `ApprovalRequired`, `TransactionApproved`, `PaymentDue`, `ReceivableDue`,
`ReconciliationDriftDetected`.

## Validation
Money format and > 0; date > lock date and ≤ today + 1 (future-dated postings not allowed in MVP); account active
and currency match; counterparty exists in tenant; allocation sums; category kind matches direction (EXPENSE/CAPEX
for payables, INCOME for receivables/other income).

## Financial impact
This module *is* the financial record. All reports read its tables.

## Audit
Every create/approve/reject/cancel/void of transactions, obligation create/void, allocation create/reverse,
account and category changes, with amounts and reasons.

## Future extension
Double-entry GL (journal generated from postings), multi-currency, bank import/reconciliation, cheque
management, tax lines, retention, budgets, cost codes, accounting periods, payment gateway integration.

## Must NOT
Import or call payroll/subcontractor/contract/rental/machinery modules; allow UPDATE/DELETE of posted rows;
store running balances; accept tenantId or source records from clients without validation; skip locks on
allocation; post asynchronously via events.
