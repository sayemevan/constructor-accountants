# Module: Party Management (`party`)

## Purpose
Single master record for every external business entity — clients/owners, suppliers, subcontractors,
consultants, equipment providers — with multiple roles per party.

## Responsibilities
Party CRUD, roles, contact details, search and pickers (filtered by role), duplicate detection warnings,
archive/restore, party profile page aggregating (via other modules' query services / reporting) related projects,
subcontracts, and ledger balance.

## Entities
`parties`, `party_roles` (see 05). Optional later: `party_contacts` (multiple contact persons),
`subcontractor_profiles` (trade, license) as 1:1 extensions — not separate masters.

## Relationships
Referenced by: project (client, project_parties), contract (client via project), subcontractor (subcontracts),
finance (transactions/obligations counterparty), machinery (supplier/vendor), equipment-rental (provider).
Depends on nothing but core.

## Business rules
- One party, many roles (CLIENT, SUPPLIER, SUBCONTRACTOR, CONSULTANT, EQUIPMENT_PROVIDER, OTHER). "Owner" is
  CLIENT (spec's Owner = Client).
- Modules requiring a role call `PartyQueryService.assertHasRole(partyId, role)`; UI may add the role inline with
  `party.update` permission (audited).
- A role cannot be removed while active records require it (e.g., CLIENT with active projects, SUBCONTRACTOR
  with active subcontracts) → 422 `PARTY_ROLE_IN_USE`.
- Duplicates: warn (not block) when name similarity > threshold or same phone/email exists; merge is future.
- Archive (not delete) once referenced; archived parties hidden from pickers, still shown in history.
- Balances/transaction history are **derived** from finance — no balance columns on party.

## APIs
- `GET /api/v1/parties` (q, role, status, includeArchived, sort) · `POST /api/v1/parties`
- `GET /api/v1/parties/{id}` · `PATCH /api/v1/parties/{id}` · `POST /api/v1/parties/{id}/archive|restore`
- `POST /api/v1/parties/duplicate-check` `{ name, phone, email }`
- `GET /api/v1/parties/{id}/ledger` and `/summary` are served by finance/reporting (routes documented there).

## Permissions
`party.view`, `party.create`, `party.update`, `party.archive`. Default: Owner, Accountant all; Project Manager
view/create/update; Site Supervisor view (limited fields).

## Events
`PartyCreated`, `PartyArchived` (no consumers required in MVP).

## Validation
display_name required (2–200 chars); at least one role; phone E.164-normalized when possible; email valid;
tax_id free text; kind ORGANIZATION requires company name or display name.

## Financial impact
None directly; counterparty for finance postings.

## Audit
Create, update (diff), role add/remove, archive/restore.

## Future extension
Contacts list, bank details (encrypted) for payments, party merge tool, credit limits/terms, KYC documents,
client portal access, supplier catalogs (procurement).

## Must NOT
Store balances, payment history, or project data; create role-specific master tables; hard-delete referenced
parties; contain subcontract or finance logic.
