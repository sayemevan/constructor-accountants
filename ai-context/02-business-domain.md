# 02 — Business Domain

Load when: implementing or reasoning about any business behaviour. Detailed per-module rules are in
`modules/*.md`; the money model is in `24-financial-model.md`.

## Domain map

```text
Tenant (company)
 ├── Membership ── User (global identity) ── Roles ── Permissions (+ project scope)
 ├── Settings (currency, timezone, payroll basis, approval thresholds, books lock date, numbering)
 ├── Party ──< PartyRole (CLIENT | SUPPLIER | SUBCONTRACTOR | CONSULTANT | EQUIPMENT_PROVIDER | OTHER)
 ├── Project ── client: Party (CLIENT role)
 │    ├── ProjectMember (users who may access an assigned-scope project)
 │    ├── ProjectParty (extra stakeholders: architect, consultant, owner representative)
 │    ├── ProjectUpdate (site progress notes + photos)
 │    ├── Contract (0..1 active) ──< ContractVariation
 │    ├── ClientBill (running bills / invoices → receivable obligations)
 │    ├── EmployeeAssignment >── Employee
 │    ├── AttendanceRecord >── Employee
 │    ├── Subcontract >── Party (SUBCONTRACTOR) ──< SubcontractBill
 │    ├── MachineAssignment / MachineUsageLog >── Machine            (Phase 8)
 │    ├── EquipmentRental >── Party (EQUIPMENT_PROVIDER) ──< RentalCharge (Phase 8)
 │    └── Documents (attachments on the project or any of its records)
 ├── Employee ──< EmployeePayRate (effective-dated) ; PayrollRun ──< PayrollItem ──< PayrollItemLine
 ├── Finance: MoneyAccount, FinanceCategory, FinancialTransaction, FinanceObligation(+Lines), PaymentAllocation
 ├── Notifications, AuditLog, Files
```

## Entities and their meaning

**Tenant** — a construction company using the platform. Owns all business data, has its own users,
settings, roles, numbering and base currency. In self-hosted mode there is exactly one tenant.

**User / Membership** — a User is a person who can log in (global identity, unique email). A Membership
links a User to a Tenant with a status (INVITED, ACTIVE, DEACTIVATED) and roles. Deactivated members cannot
access that tenant. One user may belong to several tenants (e.g., an external accountant) and picks the
active tenant per session.

**Role / Permission** — Permissions are defined in code (`module.resource.action`) and seeded into a
catalog. Roles are tenant-owned bundles of permissions, each granted with a **scope**: `TENANT` (all
records) or `ASSIGNED_PROJECTS` (only projects where the user is a Project Member). Default roles (Owner,
Administrator, Accountant, Project Manager, Site Supervisor) are copied into every new tenant.

**Party** — any external business entity: a person or organization the company deals with. A party has one
or more roles. "Client" and "Owner" are the **same concept** (role `CLIENT`). The same party may be a client
on one project and a supplier on another. Party balances (what they owe us / we owe them) come from the
finance ledger, never from fields on the party.

**Project** — a construction job for a client. Has code, name, client, location, dates, status and optional
contract. Lifecycle: `PLANNING → ACTIVE ⇄ ON_HOLD → COMPLETED`, and `CANCELLED` from PLANNING/ACTIVE/ON_HOLD.
Completed/cancelled projects are read-mostly: financial changes need `project.modify_closed`.
Costs not tied to a project (office rent, office staff) are recorded with no project = company overhead.

**Contract** — optional agreement between the company and the project's client. Types:
- `LUMP_SUM` — fixed total amount.
- `SQUARE_FEET` — area × rate (stored inputs; amount derived and snapshotted).
- `RUNNING_BILL` — paid by measured progress; value grows through client bills.
- `CUSTOM` — free-form terms and amount.
Contract value = original amount + approved **variations** (extra work / change orders, may be negative).
New contract types are added as enum values + a calculation strategy, not new tables.

**Client Bill** — a bill/invoice to the client (running bill, milestone, or extra work). When approved it
creates a **receivable** obligation. Client payments can be allocated to bills or held as client advance.

**Employee** — an internal worker (daily-wage labourer, salaried staff, or contract-based worker). Not a
Party. Has **effective-dated pay rates** (pay type, daily rate / monthly salary, overtime rate). An employee
may work on many projects over time; **assignments** record that history.

**Attendance** — one record per employee per work date per project, with status (PRESENT, ABSENT, HALF_DAY,
PAID_LEAVE, UNPAID_LEAVE, HOLIDAY), day fraction, hours and overtime hours. A worker may split a day across
projects (fractions sum ≤ 1). Attendance included in an approved payroll run is **locked**.

**Payroll** — a payroll run covers a period (e.g., a week for daily workers, a month for salaried staff).
Calculation produces one payroll item per employee with lines (base pay, overtime, allowances, deductions,
adjustments) split by project. Approving the run creates a **payable obligation** per item and recovers
outstanding advances. Paying salaries = finance payments allocated to those obligations (partial allowed).

**Subcontractor / Subcontract** — a Party with role SUBCONTRACTOR engaged on one project for a scope of
work and a contract amount. Progress is billed through **subcontract bills**; approved bills become payables.
Payments are: advance (unallocated, recovered from later bills), progress (against a bill), final.

**Finance** — the financial backbone. Key objects:
- **Money account** — where money sits: cash box, bank account, mobile wallet.
- **Financial transaction** — an actual movement of money (receipt, payment, transfer, opening balance).
  Immutable; voiding creates a reversal entry.
- **Obligation** — something owed: payable (we owe) or receivable (they owe). Created by payroll, subcontract
  bills, rental charges, client bills, or manual expenses (supplier bills). Lines carry category + project.
- **Allocation** — links a transaction to the obligation(s) it settles. Unallocated payments are advances.
- **Category** — income/expense classification (system categories + tenant-defined ones).
Project profit, party balances, account balances and outstanding dues are all **derived** from these.

**Machinery (owned)** — company assets: purchase info, status, assignments to projects, usage logs,
maintenance/repair records. Purchase is **capital expenditure**, not a project expense. Fuel/repair costs are
expenses tagged to the machine (and project when applicable).

**Equipment Rental** — equipment hired from a provider (Party) for a project: rate, period, expected and
actual return. Rental charges become payables. Rented equipment is **never** an asset. Deposits are
refundable and not a cost.

**Document / File** — a File is a stored binary (metadata in DB, bytes in storage). A Document attaches a
file to a business record (project, contract, transaction, obligation, employee, party, machine, rental…)
with a type (CONTRACT, AGREEMENT, DRAWING, DESIGN, SITE_PHOTO, PROGRESS_PHOTO, RECEIPT, APPROVAL, OTHER).

**Notification** — a message to a user generated from a business event or schedule (payment due, salary due,
project deadline, equipment return, approval needed). Delivered in-app and optionally by email; SMS, push,
WhatsApp later. External channels never carry sensitive amounts.

**Report** — a read-only, tenant-scoped, permission-filtered view computed from source data
(project P&L, cost breakdown, party ledger, cash flow, attendance, wages).

## Cross-cutting business rules
1. Every business record belongs to exactly one tenant; references across tenants are impossible (DB-enforced).
2. The project is the primary dimension for cost, income, documents and access control.
3. Money moves only through Finance. Other modules create obligations/transactions via Finance's API.
4. Posted financial data is corrected by reversal/adjustment, never by edit or delete.
5. Master data (parties, employees, projects, machines) is **archived**, not deleted, once referenced.
6. Anything that changes money, permissions or settings is audited with before/after values.
7. Sensitive operations can require approval (maker-checker): creator cannot approve their own record
   unless tenant setting allows it.
8. Date-effective data (pay rates, contract values) is never overwritten retroactively — add a new version.
9. Books lock date: no posting, voiding or back-dating on/before the tenant's `booksLockedUntil`.

## Key workflows
- **Client payment:** record receipt (party, project, account, amount) → optionally allocate to client bills
  → party ledger, project income, account balance and reports reflect it (derived).
- **Daily wage payroll:** attendance recorded daily → payroll run for period → calculate (days × rate on each
  day + overtime ± adjustments) → review → approve (creates payables, recovers advances, locks attendance)
  → pay (full/partial) → wage & project cost reports.
- **Monthly salary:** run for month → base salary prorated for unpaid days (tenant basis) + overtime −
  deductions − advance recovery → approve → pay.
- **Subcontract:** create subcontract → pay advance (optional) → bill progress → approve bill (payable,
  recover advance) → pay → final bill → close.
- **Expense:** record expense (supplier optional, category, project lines) paid now (payable + payment +
  allocation in one step) or on credit (payable only, paid later).
- **Void:** authorized user voids a posted transaction with a reason → reversal entry dated today (or chosen
  date after the lock date) → allocations reversed → obligations reopen → audit entry.

## Glossary
| Term | Meaning |
|---|---|
| Party | External business entity with one or more roles |
| Client / Owner | Party role `CLIENT` — the customer of a project |
| Obligation | Payable or receivable amount owed; has lines (category, project) |
| Allocation | Portion of a transaction applied to an obligation |
| Advance | Payment/receipt not (yet) allocated to any obligation |
| Void | Cancel a posted transaction by creating a reversal entry |
| Cancel | Discard a record that was never posted (draft/pending) |
| Adjustment | A new entry that corrects an amount without touching the original |
| Running bill | Progress-based bill against a contract (client or subcontractor) |
| Variation | Change to contract value (extra work or omission) |
| Books lock date | Date on/before which financial data is frozen |
| Overhead | Cost with no project |
| Capex | Asset purchase (machinery); excluded from project profit |
