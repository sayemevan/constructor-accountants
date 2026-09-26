# Module: Subcontractor Management (`subcontractor`)

Read with `24-financial-model.md`.

## Purpose
Manage outsourced work packages on projects: agreements, progress, bills, advances, payments and outstanding
balances. The subcontractor itself is a Party with role SUBCONTRACTOR (no separate master).

## Responsibilities
Subcontracts (per project), progress tracking, subcontract bills (progress/final claims) with approval →
payables, advance recovery on bills, subcontract summary (contract amount, billed, paid, advance outstanding,
balance) via finance query service, attachment resolver (SUBCONTRACT, SUBCONTRACT_BILL).

## Entities
`subcontracts`, `subcontract_bills` (see 05). Optional later 1:1 `subcontractor_profiles` on party.

## Relationships
Party (SUBCONTRACTOR role), project, finance (obligations for bills; advances/payments are finance transactions
with `context_type = SUBCONTRACT`).

## Business rules
- Subcontract requires: project (not closed), party with SUBCONTRACTOR role, scope of work, contract amount > 0.
- Status: `DRAFT → ACTIVE → COMPLETED`; `DRAFT → CANCELLED`; `ACTIVE → TERMINATED` (reason). Bills only on ACTIVE
  (final bill may complete it).
- Payment types mapped to finance:
  - **Advance** → finance PAYMENT, purpose ADVANCE, context subcontract (unallocated).
  - **Progress bill** → bill approved → PAYABLE obligation (category SUBCONTRACT, project line) → payment allocation.
  - **Final bill** → bill flagged `isFinal`; approval sets subcontract COMPLETED (unless outstanding checks fail).
- On bill approval, `advanceRecoveryAmount` (≤ outstanding advance for this subcontract, ≤ bill net) is recovered
  by allocating the advance payment(s) to the new obligation.
- Σ approved bills (net) ≤ contract amount — exceeding requires `subcontract.bill.override_value` and reason
  (variations for subcontracts are future).
- `cumulative_progress_percent` on bills must be non-decreasing; subcontract `progress_percent` = latest approved.
- Approved bills are voided, not edited (only when no allocations).

## APIs
- `GET /api/v1/subcontracts` (projectId, partyId, status) · `POST /api/v1/subcontracts`
- `GET/PATCH /api/v1/subcontracts/{id}` · `POST /api/v1/subcontracts/{id}/activate|complete|terminate|cancel`
- `GET /api/v1/subcontracts/{id}/summary` (contract, billed, paid, advance outstanding, payable balance)
- `GET|POST /api/v1/subcontracts/{id}/bills` · `PATCH /api/v1/subcontract-bills/{billId}` (draft)
- `POST /api/v1/subcontract-bills/{billId}/submit|approve|cancel|void` (`Idempotency-Key` on approve/void)
- Advances and payments: finance endpoints with `context: { type: 'SUBCONTRACT', id }` (UI shortcuts on the
  subcontract page call finance APIs).

## Permissions
`subcontract.view`, `subcontract.create`, `subcontract.update`, `subcontract.bill.create`,
`subcontract.bill.approve`, `subcontract.bill.void`, `subcontract.bill.override_value`.
Defaults: Owner all; PM (ASSIGNED) view/create/update/bill.create; Accountant view + approve/void.

## Events
`SubcontractActivated`, `SubcontractBillApproved`, `ApprovalRequired` (bill submitted), `SubcontractCompleted`.
(`SubcontractorPaymentMade` is emitted by finance.)

## Validation
Amounts > 0; dates end ≥ start; bill net = gross − deductions ≥ 0; recovery ≤ min(outstanding advance, net);
progress 0–100 non-decreasing.

## Financial impact
Creates SUBCONTRACT payables per project; recovers advances; payments via finance. Cost recognized on bill approval.

## Audit
Subcontract lifecycle and edits, bill lifecycle with amounts, recovery amounts, overrides with reasons.

## Future extension
Retention (withheld % released at completion), subcontract variations, measured unit-rate BOQ bills, work orders,
performance ratings, compliance documents with expiry, subcontractor portal for bill submission.

## Must NOT
Create separate subcontractor master records; write finance tables directly; store paid/outstanding amounts;
compute project profit; allow editing approved bills.
