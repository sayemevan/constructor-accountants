# Module: Contract Management (`contract`) — includes Client Billing

## Purpose
Record the (optional) agreement between the company and a project's client, its value changes (variations),
and bills raised to the client (running bills, milestones, extra work) which become receivables.

## Responsibilities
Contract create/update/activate/complete/terminate, type-specific value calculation, variations
(extra work/omissions), client bills (draft → submit → approve → receivable obligation via finance), current
contract value query, attachment resolver (CONTRACT, CLIENT_BILL) for agreement documents.

## Entities
`contracts`, `contract_variations`, `client_bills` (see 05).

## Relationships
Belongs to project (client = project's client party). Posts receivables through `FinancePostingService`.
Documents (agreements) attached via document module.

## Business rules
- Optional: a project may have no contract. At most one non-cancelled contract per project (MVP).
- Types & value:
  - LUMP_SUM: `original_amount` entered.
  - SQUARE_FEET: `measurement_area × rate_per_unit` computed in domain, rounded to 2 dp, snapshotted into
    `original_amount`; unit SQFT or SQM (tenant default).
  - RUNNING_BILL: `original_amount` optional (estimate); receivables come from client bills.
  - CUSTOM: amount entered + `custom_terms` (structured JSON: label/value pairs) + payment terms text.
- New contract types: add enum + domain calculation strategy + validation schema; never a new table.
- DRAFT contracts editable; ACTIVE contracts: amount-related fields changed only via **variations**
  (approved variation changes current value); non-financial fields editable with audit.
- Current contract value = original + Σ APPROVED variations (derived).
- Client bill approval creates a RECEIVABLE obligation (category CONTRACT_REVENUE or EXTRA_WORK). Approved bills are
  voided (not edited) — only if no receipts allocated.
- Warn when Σ approved bills > current contract value (block for LUMP_SUM/SQUARE_FEET unless
  `contract.bill.override_value`).
- Client bill `bill_no` sequential per tenant; `due_date` default from payment terms days (setting).

## APIs
- `GET /api/v1/contracts?projectId=` · `POST /api/v1/contracts` · `GET/PATCH /api/v1/contracts/{id}`
- `POST /api/v1/contracts/{id}/activate|complete|terminate|cancel`
- `GET|POST /api/v1/contracts/{id}/variations` · `POST /api/v1/contracts/{id}/variations/{vid}/approve|reject|cancel`
- `GET /api/v1/client-bills?projectId=&status=` · `POST /api/v1/client-bills` · `PATCH /api/v1/client-bills/{id}` (draft)
- `POST /api/v1/client-bills/{id}/submit|approve|cancel|void` (approve & void require `Idempotency-Key`)

## Permissions
`contract.view`, `contract.create`, `contract.update`, `contract.variation.approve`, `contract.bill.create`,
`contract.bill.approve`, `contract.bill.void`, `contract.bill.override_value`.
Defaults: Owner all; PM (ASSIGNED) view/create/update/bill.create; Accountant view + bill approve/void + variation approve.

## Events
`ContractActivated`, `ContractVariationApproved`, `ClientBillApproved`, `ApprovalRequired` (bill submitted).

## Validation
Amounts > 0 (variations ≠ 0); area/rate > 0 for SQUARE_FEET; contract_date required on activation; bill period
within project dates (warn); bill net = gross − deductions ≥ 0.

## Financial impact
Creates receivables (client bills). Contract value is informational (remaining contract, % billed) — not income.

## Audit
Contract create/update/status, variations lifecycle, bills lifecycle with amounts.

## Future extension
Multiple contracts per project (phases), payment milestones schedule with due reminders, retention on client
bills, BOQ-based measured bills, tax on bills, contract templates & e-signature, client portal bill view.

## Must NOT
Record receipts or allocations (finance); store "amount received" or balances; compute project profit; allow
editing amounts on ACTIVE contracts or approved bills; duplicate party data.
