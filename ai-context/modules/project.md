# Module: Project Management (`project`)

## Purpose
Manage construction projects — the central business object that links clients, contracts, workforce,
subcontractors, costs, income, documents and access control.

## Responsibilities
Project CRUD, code generation, status lifecycle with history, client link, additional stakeholders
(`project_parties`), project members (user access for ASSIGNED_PROJECTS scope), project updates (site progress
notes with photos), deadline scan, `ProjectQueryService` (`getById`, `assertWritable`, `assignedProjectIds`),
attachment resolver registration for PROJECT and PROJECT_UPDATE.

## Entities
`projects`, `project_status_history`, `project_parties`, `project_members`, `project_updates` (see 05).

## Relationships
Client = Party with CLIENT role (required). 0..1 active contract (contract module). Referenced by attendance,
assignments, payroll lines, subcontracts, finance lines/transactions, machinery, rentals, documents.
Project summary figures come from finance/reporting — never stored here.

## Business rules
- Minimum to create: name, client party, status (default PLANNING). Code auto-generated (`PRJ-{YYYY}-{seq}`),
  editable only while PLANNING, unique per tenant.
- Contract info is optional at creation (created via contract module, same screen allowed).
- Status machine: `PLANNING → ACTIVE | CANCELLED`; `ACTIVE → ON_HOLD | COMPLETED | CANCELLED`;
  `ON_HOLD → ACTIVE | CANCELLED`; `COMPLETED → ACTIVE` (reopen, requires `project.modify_closed` + reason);
  `CANCELLED` terminal (reopen = new project). Every change writes `project_status_history` with reason (required
  for ON_HOLD, CANCELLED, reopen).
- COMPLETED requires `actual_end_date` (default today). Warn (not block) if payables/receivables are outstanding.
- COMPLETED/CANCELLED projects are closed: new financial postings, attendance, assignments require
  `project.modify_closed` (enforced via `assertWritable` by calling modules).
- Creator is added as project member automatically if their scope is ASSIGNED_PROJECTS.
- Archive only CANCELLED or COMPLETED projects; archived projects hidden from pickers.
- Project updates are editable by their author for 24 h, then immutable (audit trail for site reports).

## APIs
- `GET /api/v1/projects` (q, status, clientPartyId, dateFrom/To, includeArchived) · `POST /api/v1/projects`
- `GET /api/v1/projects/{id}` · `PATCH /api/v1/projects/{id}`
- `POST /api/v1/projects/{id}/change-status` `{ toStatus, reason?, actualEndDate?, version }`
- `GET /api/v1/projects/{id}/status-history`
- `GET|POST /api/v1/projects/{id}/members` · `DELETE /api/v1/projects/{id}/members/{membershipId}`
- `GET|POST /api/v1/projects/{id}/parties` · `DELETE /api/v1/projects/{id}/parties/{projectPartyId}`
- `GET|POST /api/v1/projects/{id}/updates` · `PATCH /api/v1/projects/{id}/updates/{updateId}`
- `POST /api/v1/projects/{id}/archive|restore`
- Financial summary: `GET /api/v1/projects/{id}/financial-summary` (served by finance query service; requires `project.financials.view`)
(The spec's `DELETE /projects/{id}` is replaced by cancel/archive.)

## Permissions
`project.view`, `project.create`, `project.update`, `project.status.change`, `project.archive`,
`project.modify_closed`, `project.members.manage`, `project.updates.create`, `project.financials.view`.
Defaults: Owner all; PM (ASSIGNED) view/update/status/members/updates/financials + create (TENANT);
Accountant view + financials (TENANT); Supervisor (ASSIGNED) view + updates.create.

## Events
`ProjectCreated`, `ProjectStatusChanged`, `ProjectDeadlineApproaching` (daily scan: ACTIVE projects with
expected_end_date in 7 days or overdue), `ProjectMemberAdded`.

## Validation
Name 2–200; dates: expected_end ≥ start; client party exists with CLIENT role; progress_percent 0–100; member
membership ACTIVE in tenant; coordinates valid ranges.

## Financial impact
Dimension for all costs/income; closed-project guard protects financial history.

## Audit
Create/update (diff), status changes, member changes, project party changes, archive/restore, update edits.

## Future extension
Budgets & budget vs actual, phases/milestones, tasks/Gantt, BOQ link, site diary with weather/labour counts,
geo-fenced attendance, client portal visibility flags, project templates.

## Must NOT
Store income/expense/profit totals or contract value; compute payroll or finance; embed contract fields
(contract module); allow hard delete; let supervisors see financial summaries without `project.financials.view`.
