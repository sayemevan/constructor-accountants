# Module: Equipment Rental (`equipment-rental`) — Phase 8

## Purpose
Track equipment hired from external providers for projects: rental terms, on-site period, return status,
charges owed, deposits, and payments. Rented equipment is never a company asset.

## Responsibilities
Rentals (book, mark on-site, return, cancel), rental charges (rent periods, transport, damage) with approval →
payables through finance, charge proposal on return / period end, deposits via finance, return-due scan,
rental summary (charged, paid, outstanding, deposit held) via finance query, attachment resolver (RENTAL:
agreements, delivery challans, return notes).

## Entities
`equipment_rentals`, `rental_charges` (see 05).

## Relationships
Provider = Party with EQUIPMENT_PROVIDER (or SUPPLIER) role; project; finance (charges → PAYABLE obligations,
category EQUIPMENT_RENTAL/TRANSPORT; deposits/refunds as DEPOSIT transactions with context rental).

## Business rules
- Status: `BOOKED → ON_SITE → RETURNED`; `BOOKED → CANCELLED`; ON_SITE cannot be cancelled (return it).
- `actual_return_date ≥ start_date`; RETURNED requires actual_return_date.
- Charge proposal (domain): billable units between period_from and period_to by `rate_unit`
  (DAY: inclusive days; WEEK/MONTH: ceil or prorate per setting `rental.partialPeriod = PRORATE|ROUND_UP`;
  HOUR: from entered hours; FIXED: once) × rate × quantity. User may edit before approval (audited difference).
- Charges must not overlap in period for RENT type on the same rental (`RENTAL_CHARGE_OVERLAP`).
- Approved charges create payables; voided, not edited.
- Deposits are refundable balances, never costs; outstanding deposit shown on rental summary.
- Rental "payment status" is **derived** (charges vs allocations) — not a column.
- Return reminder: day before expected return and daily while overdue (scan).

## APIs
- `GET|POST /api/v1/equipment-rentals` (projectId, providerPartyId, status, overdue) · `GET|PATCH /…/{id}`
- `POST /api/v1/equipment-rentals/{id}/mark-on-site|return|cancel` (`{ actualReturnDate }` on return)
- `GET /api/v1/equipment-rentals/{id}/charge-proposal?periodTo=`
- `GET|POST /api/v1/equipment-rentals/{id}/charges` · `POST /api/v1/rental-charges/{id}/approve|cancel|void`
- `GET /api/v1/equipment-rentals/{id}/summary`

## Permissions
`rental.view`, `rental.create`, `rental.update`, `rental.return`, `rental.charge.create`, `rental.charge.approve`,
`rental.charge.void`. Defaults: Owner all; PM (ASSIGNED) view/create/update/return/charge.create; Accountant view +
approve/void; Supervisor (ASSIGNED) view + return.

## Events
`EquipmentRentalCreated`, `EquipmentReturned`, `EquipmentReturnDue` (scan), `RentalChargeApproved`.

## Validation
Rate > 0; quantity ≥ 1; dates consistent; provider has provider/supplier role; project not closed for new rentals.

## Financial impact
Rental cost recognized when charges are approved (project cost, EQUIPMENT_RENTAL). Payments/deposits via finance.

## Audit
Rental lifecycle, charge proposals vs approved amounts, approvals/voids.

## Future extension
Recurring automatic monthly charges, rental purchase orders (procurement), damage claims workflow, provider rate
cards, utilization comparison rent-vs-own.

## Must NOT
Register rented equipment as machines/assets; write finance tables directly; store payment status or balances;
treat deposits as expenses.
