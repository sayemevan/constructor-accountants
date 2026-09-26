# Module: User Management (`user`)

## Purpose
Manage people who can log in (global users) and their membership in tenants.

## Responsibilities
Invite users to the tenant (with roles), list/view members, activate/deactivate memberships, update own profile
(name, phone, avatar), admin updates of member display info, resend/revoke invitations, link an employee record
to a user (optional), expose `MembershipQueryService` for recipient resolution and pickers.

## Entities
`users` (global), `tenant_memberships` (tenant-owned).

## Relationships
`auth` authenticates users; `authorization` assigns roles to memberships; `project` references memberships in
`project_members`; `employee.user_id` optional link; `notification` resolves recipients from memberships.

## Business rules
- Email is globally unique (citext). A user can have memberships in multiple tenants.
- Invite existing email → new membership INVITED for this tenant (no duplicate user).
- Deactivated membership: immediate loss of access to that tenant; sessions stay valid for other tenants.
- Cannot deactivate yourself; cannot deactivate the last active Owner.
- User DISABLED (platform-level) blocks all tenants — platform admin only.
- Removing a member never deletes their historical records; created_by references remain.
- Changing email requires verification of the new address.

## APIs
- `GET /api/v1/users` (members of current tenant; filters: status, roleId, q) · `GET /api/v1/users/{membershipId}`
- `POST /api/v1/users/invitations` `{ email, name?, roleIds[], projectIds? }` · `POST /users/invitations/{id}/resend` · `POST /users/invitations/{id}/revoke`
- `POST /api/v1/users/{membershipId}/deactivate` · `POST /api/v1/users/{membershipId}/activate`
- `PATCH /api/v1/users/{membershipId}` (display fields) · `PUT /api/v1/users/{membershipId}/roles` `{ roleIds, version }`
- `GET /api/v1/me` · `PATCH /api/v1/me` · `POST /api/v1/me/email-change`
(The spec's `DELETE /users/{id}` is replaced by deactivate.)

## Permissions
`user.view`, `user.invite`, `user.update`, `user.deactivate`, `user.roles.assign`, `user.sessions.revoke`.
Default: Owner all; Administrator all; others `user.view` (for pickers, limited fields).

## Events
`UserInvited`, `MembershipActivated`, `MembershipDeactivated`, `MemberRolesChanged`.

## Validation
Email format; role ids belong to tenant; project ids belong to tenant; no privilege escalation (inviter must hold
every permission contained in the roles they grant, or hold `authorization.role.manage`).

## Financial impact
None directly.

## Audit
Invitations, activation/deactivation, role assignments (before/after), profile/email changes.

## Future extension
External user types (client portal users with restricted membership type), SCIM provisioning, user groups/teams,
worker self-service accounts.

## Must NOT
Handle passwords/sessions (auth); define permissions (authorization); hard-delete users with history; expose
other tenants' memberships; store employee HR data (employee module).
