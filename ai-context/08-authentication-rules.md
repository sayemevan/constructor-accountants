# 08 — Authentication Rules

Load when: working on login, sessions, passwords, invitations, signup, or anything reading the current user.
Module implementation details: `modules/authentication.md`.

## Model (ADR-0009)
First-party authentication inside the API — no external identity provider is required (self-hosting).
Sessions are **opaque random tokens stored hashed in PostgreSQL**, which gives instant revocation (logout,
deactivation, password reset) without JWT blacklists. Social login / SSO / OIDC can be added later as extra
login methods producing the same session.

## Sessions
- Token: 32 random bytes (base64url). DB stores `sha256(token)` only.
- Web: cookie `__Host-session` — HttpOnly, Secure, SameSite=Lax, Path=/. Future mobile: `Authorization: Bearer`.
- Lifetimes (tenant/platform configurable): idle timeout 7 days (sliding, `last_seen_at` updated at most every
  5 min), absolute lifetime 30 days. Expired/revoked sessions → 401 `SESSION_EXPIRED`.
- New session on login (never reuse); rotate on privilege-sensitive events (password change, MFA verification).
- Revoke all of a user's sessions on: password reset/change (except current on change), user DISABLED,
  admin "sign out everywhere". Membership deactivation blocks that tenant immediately (TenantGuard checks per request).
- `GET /auth/session` returns user, memberships (tenant list), active tenant, effective permissions — used by
  the web app to render navigation.
- Users may list and revoke their own sessions (device list).

## Passwords
- argon2id (≈ OWASP baseline: m=19 MiB, t=2, p=1; tune on target hardware, record params in hash string).
- Policy: min length 10 (tenant/platform configurable, never below 8), max 128, no composition rules,
  reject if equals email/name; optional breached-password check (disabled when offline/self-hosted).
- Rehash on login if parameters changed.
- Change password requires current password.

## Login
- `POST /auth/login { email, password }` → sets cookie; response contains session info (never the token in JSON
  for web). Same response time/message for unknown email and wrong password: `INVALID_CREDENTIALS`.
- Throttling: per IP and per account; after 5 failures in 15 min, exponential delay; after 20, temporary lock
  (15 min) + audit event + optional owner notification. Never permanently lock without admin path.
- DISABLED user → `INVALID_CREDENTIALS` (no status disclosure).
- If user has several ACTIVE memberships, the last-used tenant becomes active; the client can switch.
- Audit: `auth.login.succeeded`, `auth.login.failed` (with email hash, IP), `auth.logout`.

## Password reset
- `POST /auth/password/forgot { email }` always returns 202 (no account enumeration).
- Token: 32 random bytes, hashed, single use, 30 min expiry, invalidates older reset tokens.
- `POST /auth/password/reset { token, newPassword }` → sets password, revokes all sessions, audit.
- Self-hosted without SMTP: an admin can generate a one-time reset link for a member (audited).

## Onboarding
- **SaaS signup** (`DEPLOYMENT_MODE=saas`, `SIGNUP_ENABLED=true`): `POST /auth/signup` creates user + tenant +
  owner membership + default roles + settings in one transaction; email verification required before
  financial features (configurable).
- **Self-hosted:** signup disabled; first-run setup wizard (only when no tenant exists) or CLI command creates
  the tenant and owner. The wizard endpoint is disabled once a tenant exists.
- **Invitations:** admins invite by email + roles → membership INVITED + INVITATION token (7-day expiry). Accept
  flow: new user sets name/password; existing user just accepts. No admin-chosen passwords.

## Email verification
Required for changing email (verify new address before switching). Tokens as above (24 h expiry).

## MFA (future-ready)
Session has `mfa_verified_at`; permission guard can require recent MFA for high-risk permissions
(e.g., `authorization.role.manage`, `finance.transaction.void`) once TOTP is implemented.

## Rules for code
- Get the current user only from `TenantContext`/`@CurrentUser()`; never from request body.
- Never return `password_hash`, token hashes, or session tokens in any API response or log.
- Auth endpoints are the only `@Public()` endpoints besides health checks and the invitation/reset landing APIs.
- All auth flows have integration tests: login success/failure, throttling, reset token reuse, expired session,
  deactivated member blocked, revoked session blocked.
