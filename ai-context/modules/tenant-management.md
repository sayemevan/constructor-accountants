# Module: Tenant Management (`tenant`) — includes Company Settings and Platform ops

## Purpose
Represents each construction company (tenant): its profile, configuration, lifecycle and deployment-mode
behaviour. Owns company settings that other modules read.

## Responsibilities
- Tenant creation (SaaS signup, self-hosted setup wizard/CLI, platform admin) in one transaction: tenant,
  settings defaults, default roles (via authorization), system finance categories (via finance seed hook),
  number sequences, owner membership.
- Company profile: name, legal name, logo, address, contacts, tax id, base currency, timezone, locale, country.
- Tenant settings (typed, versioned JSON): payroll proration basis, default overtime multiplier, approval
  thresholds, `allowSelfApproval`, `booksLockedUntil`, numbering prefixes, due-reminder days, file limits.
- Tenant status lifecycle (ACTIVE, SUSPENDED, CLOSED) — platform operations.
- `DeploymentModeService` (saas vs self_hosted) and `EntitlementService` (all features enabled until subscriptions exist).

## Entities
`tenants`, `tenant_settings` (see 05).

## Relationships
Parent of all tenant-owned data. Uses `authorization` (seed roles), `user` (owner membership), `finance`
(system category seed via a registered `TenantProvisioningHook` — tenant does not import finance; finance
registers the hook), `files` (logo).

## Business rules
- Base currency is set at creation and **cannot be changed** once any financial transaction exists.
- Timezone change affects future business-date defaults only; historical dates are unchanged.
- `booksLockedUntil` can move forward by `settings.books.lock`; moving it backward requires Owner and is audited
  with reason.
- Self-hosted: exactly one tenant; setup endpoint disabled once it exists; signup disabled.
- SUSPENDED tenant: members cannot log into it (TenantGuard → 403 `TENANT_SUSPENDED`); data untouched.
- Slug is unique platform-wide, lowercase, immutable after creation (future subdomain use).

## APIs
- `POST /api/v1/auth/signup` (SaaS; creates tenant) — implemented with auth module.
- `POST /api/v1/setup` (self-hosted first run only, `@Public`, disabled after first tenant).
- `GET /api/v1/tenant` · `PATCH /api/v1/tenant` (profile).
- `GET /api/v1/tenant/settings` · `PATCH /api/v1/tenant/settings` (partial, version-checked).
- `POST /api/v1/tenant/settings/books-lock` `{ lockedUntil, reason }`.
- Platform (SaaS only, platform admin): `GET/POST /api/v1/platform/tenants`, `POST /platform/tenants/{id}/suspend|reactivate`.

## Permissions
`tenant.view` (all members), `tenant.update`, `settings.view`, `settings.manage`, `settings.books.lock`.
Default: Owner all; Administrator `tenant.update`, `settings.*` except `settings.books.lock`; Accountant
`settings.books.lock`.

## Events
`TenantCreated`, `TenantSettingsChanged` (for cache invalidation), `TenantSuspended`.

## Validation
Currency ISO 4217 from allowlist; timezone valid IANA; locale BCP 47; thresholds ≥ 0 decimals; lock date not in
the future beyond today; settings validated by versioned Zod schema (unknown keys rejected).

## Financial impact
Indirect: currency, approval thresholds, lock date, proration basis drive finance/payroll behaviour.

## Audit
Profile and settings changes (diff), lock date changes (with reason), tenant lifecycle changes.

## Future extension
Subscriptions/plans (`plan_code`, limits for users/storage/features via EntitlementService), self-hosted
license file (offline-verifiable signed file; no mandatory phone-home), tenant custom domains/branding,
tenant data export/import, fiscal year settings, multi-currency enablement.

## Implementation status (Phase 1)
Session 2 (step 9a) — data layer, no HTTP:
- Schema `apps/api/prisma/schema/tenant.prisma`, migration `…_tenant`: `tenants` (global, no RLS; slug/currency/
  country CHECKs), `tenant_settings` (RLS per 06, `tenant_id` DB default). `DELETE` revoked from `app_user` and
  `app_platform` on both (tenants are closed, never deleted).
- Contracts (`packages/contracts/src/tenant/`): `CreateTenantInput`, `TenantProfilePatch` (no slug, no base
  currency), `TenantSettings` (strict; every field defaulted), `TenantSettingsPatch` (no `books`),
  `TENANT_SETTINGS_SCHEMA_VERSION` = 1. Shared primitives in `common/primitives.ts`.
- Settings keys (v1): `approval.{allowSelfApproval=false, paymentThreshold=null, expenseThreshold=null}`,
  `payroll.{prorationBasis=CALENDAR_DAYS|WORKING_DAYS|FIXED_30_DAYS, overtimeMultiplier="1.50"}`,
  `books.lockedUntil=null`, `reminders.dueReminderDays=[3,1]`. Numbering prefixes arrive with `number_sequences`
  (session 3), file limits with `files` (Phase 2) — additive, no version bump. A breaking reshape bumps the schema
  version and adds a step to `upgradeTenantSettings` (domain).
- `TenantService.create` generates a UUIDv7 id and, inside that tenant's context, inserts the tenant + default
  settings in one transaction (the provisioning primitive for setup/signup/platform). `getCurrent`,
  `updateProfile(patch, expectedVersion)`. `SettingsService.get()` / `update(patch, expectedVersion)` (merge per
  section; no-op patches don't bump the version).
- Errors: duplicate slug → 409 `DUPLICATE_VALUE` (`slug`); stale version → 409 `VERSION_CONFLICT`; no tenant row →
  404.
- Not yet: HTTP endpoints, setup/signup, books-lock action, platform ops, `DeploymentModeService`,
  `EntitlementService` (session 8); `TenantCreated`/`TenantSettingsChanged` events (outbox, session 3); audit
  (session 5); `created_by_id`/`updated_by_id` (after `users`, session 4 — audit records the actor meanwhile).

## Must NOT
Contain business logic of other modules; read other modules' tables; store per-user preferences (user
module); implement authorization checks beyond its own endpoints; allow changing tenant from request input.
