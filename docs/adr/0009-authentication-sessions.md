# ADR-0009: First-party authentication with DB-backed opaque sessions

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 08, modules/authentication.md

## Context
Self-hosted deployments cannot depend on hosted identity providers. Requirements: logout invalidation, immediate
deactivation, password reset revoking sessions, future mobile apps.

## Decision
Auth implemented in the API: argon2id passwords; 32-byte random session tokens stored as SHA-256 hashes;
`__Host-` HttpOnly Secure SameSite=Lax cookie for web, Bearer for future mobile; idle + absolute expiry; CSRF defence
via SameSite + custom header + Origin check. Invitations for user creation. SSO/OIDC/MFA added later as additional
methods issuing the same sessions.

## Alternatives considered
JWT access/refresh (revocation needs blacklist/short TTL complexity); Auth0/Clerk/Cognito (external dependency,
cost, breaks self-hosting); Auth.js in Next.js (auth would live in the web tier while the API is the system of record).

## Consequences
+ Instant revocation, simple mental model, self-host friendly. − Session lookup per request (indexed; cache later
if needed). − We own security-sensitive code → mandatory tests + security review.
