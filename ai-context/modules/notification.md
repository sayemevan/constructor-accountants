# Module: Notification (`notification`)

Architecture and catalog are in `16-notification-system.md`; this file covers module shape.

## Purpose
Deliver the right alerts to the right members through in-app and optional external channels, reacting to
domain events and scheduled scans, without business modules knowing about channels or providers.

## Responsibilities
Event handlers → notification rules (recipient resolution by permission/scope/project membership at send time),
in-app notification storage, delivery jobs per channel with retry, templates, preferences, dedupe, unread count,
admin test-send for email configuration.

## Entities
`notifications`, `notification_preferences`, `notification_deliveries` (16).

## Relationships
Consumes events from all modules (25). Uses `user` (memberships, emails), `authorization` (who holds permission X
with scope covering project P), `project` (members). No business module depends on it (except tests).

## Business rules
- Recipients resolved at processing time; users who lost access receive nothing.
- Creator/actor of an action is excluded from notifications about their own action (except security alerts).
- Dedupe via `dedupe_key` per user; scans can rerun safely.
- External channels: generic text + link only. In-app body may name project code and counts, never amounts.
- Preferences: per type × channel override; SECURITY_ALERT cannot be disabled; email disabled if SMTP not configured.
- Retention: read notifications purged after 180 days; unread after 365 (job).

## APIs
- `GET /api/v1/notifications?cursor=&unreadOnly=` · `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/{id}/read` · `POST /api/v1/notifications/read-all`
- `GET /api/v1/notifications/preferences` · `PUT /api/v1/notifications/preferences` `{ items: [{ type, channel, enabled }] }`
- `POST /api/v1/notifications/test-email` (settings.manage)

## Permissions
Own notifications: authentication only. `settings.manage` for test email and tenant defaults.

## Events
Consumes (see 25). Emits none.

## Validation
Preference types/channels from catalog; cursor format.

## Financial impact
None (must never block or alter financial operations).

## Audit
Preference changes (lightweight), tenant notification default changes.

## Future extension
Web Push (PWA), SMS & WhatsApp providers, daily digests, escalation (unapproved after N days), SSE/WebSocket
real-time, per-project subscription, webhooks for integrations.

## Must NOT
Be called by business modules to "send an email" directly; contain business due-date logic (modules scan and
emit); include sensitive data in external messages; send inside DB transactions.
