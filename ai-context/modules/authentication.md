# Module: Authentication (`auth`)

Rules live in `08-authentication-rules.md`; this file covers the module's shape.

## Purpose
Verify identity and manage sessions for all users; provide the current user/session to the rest of the system.

## Responsibilities
Login/logout, session creation/validation/revocation, password change/reset, invitation acceptance (setting
password for new users), email verification, SaaS signup orchestration (with tenant module), login throttling,
session listing, `AuthGuard`, `@CurrentUser()`.

## Entities
`sessions`, `auth_tokens` (global, no tenant_id — sessions carry `active_tenant_id`).

## Relationships
Depends on `user` (users, memberships) and `tenant` (signup). Used by every module through guards/context.

## Business rules
See 08: opaque hashed tokens, cookie flags, idle/absolute expiry, rotation, revoke-all on password reset,
generic errors, throttling/lockout, invitation token 7 days, reset token 30 min single use.
Switching tenant validates ACTIVE membership in an ACTIVE tenant.

## APIs
- `POST /api/v1/auth/login` · `POST /api/v1/auth/logout` · `GET /api/v1/auth/session`
- `POST /api/v1/auth/switch-tenant` `{ tenantId }` (only tenants in the user's memberships)
- `POST /api/v1/auth/password/change` · `POST /api/v1/auth/password/forgot` · `POST /api/v1/auth/password/reset`
- `GET /api/v1/auth/invitations/{token}` (preview: tenant name, email) · `POST /api/v1/auth/invitations/{token}/accept`
- `POST /api/v1/auth/signup` (SaaS, flag-gated) · `POST /api/v1/auth/email/verify`
- `GET /api/v1/auth/sessions` · `DELETE /api/v1/auth/sessions/{id}` · `POST /api/v1/auth/sessions/revoke-others`
Public: login, forgot, reset, invitation preview/accept, signup, verify.

## Permissions
Self-service endpoints require only authentication. Admin actions on other users' sessions:
`user.sessions.revoke` (Owner, Administrator).

## Events
`UserLoggedIn` (audit only, not outbox), `PasswordChanged` → notification SECURITY_ALERT, `AccountLocked` →
notification.

## Validation
Email format (lowercased, trimmed), password policy, token format; constant-time comparisons for tokens.

## Financial impact
None.

## Audit
Login success/failure, logout, password change/reset, lockout, session revocations, invitation acceptance.

## Future extension
TOTP MFA + recovery codes, WebAuthn/passkeys, OIDC/SAML SSO for enterprise, phone OTP login, mobile app
bearer tokens with device binding, "remember this device".

## Must NOT
Decide permissions (authorization module); store tokens in plain text; expose whether an email exists; issue
long-lived JWTs; accept tenantId for data access from anywhere but the session; send emails directly (emit
events / use notification service for auth emails through the email channel).
