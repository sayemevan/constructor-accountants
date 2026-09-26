# Module: Authorization (`authorization`) — Roles & Permissions

Rules live in `09-authorization-rules.md`; this file covers the module's shape.

## Purpose
Decide whether the current member may perform an action on a resource, and on which projects.

## Responsibilities
Permission catalog sync from code, roles CRUD, role-permission grants with scope, member-role assignment
(API owned here, invoked from user screens), default role templates and seeding per tenant, `PermissionGuard`,
`PermissionService.can()` and `resolveProjectScope()`, effective permission payload for `GET /auth/session`.

## Entities
`permissions` (global catalog), `roles`, `role_permissions`, `membership_roles`. Project membership
(`project_members`) is owned by `project` but read here through `ProjectQueryService.assignedProjectIds`.

## Relationships
Used by every module (guards + service). Depends on `user` (memberships) and `project` (assigned projects).

## Business rules
- Permission codes defined in `<module>.permissions.ts`; unknown codes cannot be granted.
- Owner role: locked (not editable/deletable), has every permission with TENANT scope, including new ones.
- System roles (Administrator, Accountant, Project Manager, Site Supervisor) are editable copies; "reset to default" available.
- Role delete only when no memberships use it.
- No privilege escalation: to grant a permission you must hold it (or be Owner).
- Effective permission = union; TENANT scope beats ASSIGNED_PROJECTS.
- Permission changes effective on next request.

## APIs
- `GET /api/v1/permissions` (catalog grouped by module, with descriptions and scope support)
- `GET /api/v1/roles` · `POST /api/v1/roles` · `GET /api/v1/roles/{id}` · `PATCH /api/v1/roles/{id}` · `POST /api/v1/roles/{id}/archive`
- `PUT /api/v1/roles/{id}/permissions` `{ grants: [{ code, scope }], version }`
- `POST /api/v1/roles/{id}/reset-to-default`

## Permissions
`authorization.role.view`, `authorization.role.manage`. Default: Owner, Administrator.

## Events
`RolePermissionsChanged`, `RoleArchived`.

## Validation
Codes exist in catalog; scope allowed for that permission (`supports_project_scope`); role name unique per tenant.

## Financial impact
Controls who may create/approve/void financial records; maker-checker is enforced by finance, not here.

## Audit
All role and grant changes with before/after; member role changes.

## Future extension
Record-level ACLs for sensitive documents, time-bound grants (support access), approval limits per role
(amount caps), attribute-based conditions (e.g., only own-created drafts), MFA-required permissions.

## Must NOT
Contain business rules of other modules; check role names anywhere; cache permissions across requests without
invalidation; grant cross-tenant access; let the UI be the enforcement point.
