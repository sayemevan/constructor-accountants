# 09 — Authorization Rules (RBAC + project scope)

Load when: adding an endpoint, a permission, a role default, or any data visibility rule.
Module implementation details: `modules/authorization.md`.

## Model (ADR-0010)
- **Permissions are defined in code** by each module in `<module>.permissions.ts` and exported through
  `packages/contracts` (the web app uses the same codes). On deploy, a sync step upserts them into the
  `permissions` catalog. Permissions are never created from the UI.
- **Roles are tenant data.** Every tenant gets copies of the default roles; tenants may edit them (except the
  locked Owner role) or create new ones.
- A role grants a permission with a **scope**:
  - `TENANT` — all records of the tenant.
  - `ASSIGNED_PROJECTS` — only records belonging to projects where the member is in `project_members`
    (plus records with no project only if the permission explicitly allows it — default: no).
- A member's effective permissions = union of their roles; broader scope wins.

## Permission code format
`<module>.<resource>.<action>` in lowercase snake case. When a module has one main resource, `<module>.<action>`.
Standard actions: `view`, `create`, `update`, `archive` (instead of delete for master data), `delete`
(only for non-financial, non-referenced data), `approve`, `void`, `export`, `manage`.
Examples: `project.view`, `project.create`, `project.update`, `project.archive`, `project.status.change`,
`project.financials.view`, `project.modify_closed`, `finance.transaction.create`, `finance.transaction.approve`,
`finance.transaction.void`, `finance.expense.create`, `payroll.run.approve`, `employee.compensation.view`,
`report.financial.view`, `report.export`, `authorization.role.manage`, `user.invite`, `settings.manage`.

## Enforcement layers
1. **Route:** `@RequirePermission('project.update')` (global `PermissionGuard`; routes without a decorator
   fail a CI check unless `@Public()`).
2. **Resource scope (application service):** load the record under tenant context; if the caller's grant is
   `ASSIGNED_PROJECTS`, verify the record's project is in their assigned set → otherwise **404**.
   List queries apply the scope as a `WHERE project_id IN (…)` filter — never post-filter in memory.
3. **Field visibility (response mapping):** strip fields guarded by view permissions
   (`employee.compensation.view`, `employee.personal.view`, `project.financials.view`).
4. **Business rules (domain):** e.g., maker-checker, closed-project restriction, books lock.
5. **UI:** hide/disable controls using `can(code)` from the session payload — convenience only.

Use `PermissionService.can(ctx, code, { projectId })` for programmatic checks; never compare role names
(`if (role === 'Accountant')` is forbidden — roles are editable data).

## Default roles (copied per tenant; editable except Owner)
| Role | Grants (scope) |
|---|---|
| **Owner** (locked) | All permissions (TENANT). Cannot be removed from the last owner. |
| **Administrator** | Users, invitations, roles, settings, audit log view; view-only on business data (TENANT) |
| **Accountant** | Parties; finance (create, approve per settings, void, export); payroll (calculate, approve, pay); client bills; subcontract bills; financial & party reports; projects view (TENANT) |
| **Project Manager** | Projects (view/update/status), contracts, members of their projects, employees view, assignments, attendance, subcontracts (create, submit bills), documents, project reports incl. financials (ASSIGNED_PROJECTS) |
| **Site Supervisor** | Project view, project updates, attendance record/update, documents & photo upload/view (non-sensitive), employees view without compensation (ASSIGNED_PROJECTS) |
The spec also mentions an **HR Manager**; provide it as an optional template (employees, pay rates, attendance,
payroll calculate) — not created by default.

## Rules
- Least privilege: new permissions are granted to Owner only by default; add to other defaults deliberately
  and document it in the module file.
- Changing role permissions, member roles, or project membership is audited with before/after and takes effect
  on the next request (no caching beyond the request, or cache invalidated on change).
- A user cannot grant permissions they don't hold, and cannot remove their own last `authorization.role.manage`.
- The last active Owner cannot be deactivated or demoted.
- Approval permissions never imply create permissions and vice versa.
- Platform admins (SaaS operator) are not tenant members by default and have no implicit access to tenant data.

## Testing requirements
Per endpoint: 401 without session; 403 without permission; 404 for records outside assigned projects;
200 with permission; field stripping verified for sensitive fields. Default-role matrix snapshot test.
