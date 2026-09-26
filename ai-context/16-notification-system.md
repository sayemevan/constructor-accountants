# 16 — Notification System

Load when: adding a notification, reminder, channel, or preference. Module details: `modules/notification.md`.

## Principles
- Business modules **never** send emails/SMS or write notification rows directly. They emit domain events
  (outbox) or the scheduler detects due conditions; the notification module decides who gets what, where.
- Channels are pluggable providers behind one interface. In-app always exists; others are optional per deployment.
- External channels carry no sensitive details (07 §12).
- Delivery is asynchronous, retried, idempotent, and tracked.

## Flow
```text
Business event (outbox) ─┐
Scheduled scan (cron)  ──┼─► NotificationRules (type → recipients by permission/role/project membership)
                         │        │ filters by user preferences + channel availability + dedupe key
                         │        ▼
                         │   notifications row (in-app)  +  notification_deliveries rows (EMAIL/SMS/PUSH/WHATSAPP)
                         │        ▼
                         └── pg-boss job per delivery → ChannelProvider.send() → status SENT/FAILED (retry w/ backoff)
```

## Channel interface
```ts
interface NotificationChannel {
  readonly channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';
  isEnabled(tenantId: string): Promise<boolean>;
  send(msg: RenderedMessage, recipient: RecipientAddress): Promise<{ providerMessageId?: string }>;
}
```
MVP: `InAppChannel`, `EmailChannel` (nodemailer SMTP). Later: `WebPushChannel` (VAPID, self-host friendly),
`SmsChannel` (provider adapters), `WhatsAppChannel` (Business API adapter). Adding a channel = new provider class
+ config + preference option; no business module changes.

## Notification types (initial catalog)
| Type | Trigger | Default recipients |
|---|---|---|
| `PAYMENT_DUE` | Scheduler: payable obligation due in N days (tenant setting, default 3) or overdue | members with `finance.transaction.create` (TENANT) |
| `RECEIVABLE_DUE` | Scheduler: client bill due/overdue | accountant role holders; project managers of the project |
| `SALARY_DUE` | Scheduler: payroll period end reached without approved run; approved run unpaid after N days | `payroll.run.approve` holders |
| `APPROVAL_REQUIRED` | Event: transaction/expense/bill entered PENDING_APPROVAL | holders of the matching approve permission (excluding creator) |
| `PROJECT_DEADLINE` | Scheduler: expected_end_date in 7 days / passed while ACTIVE | project members with `project.update` |
| `PROJECT_STATUS_CHANGED` | Event `ProjectStatusChanged` | project members |
| `EQUIPMENT_RETURN_DUE` | Scheduler: rental expected_return_date tomorrow/overdue | project managers of the project |
| `MACHINE_SERVICE_DUE` | Scheduler: next_service_due_date reached | machinery managers |
| `USER_INVITED` | Event | invitee (email only) |
| `SECURITY_ALERT` | Event: account locked, password changed | the user (email + in-app) |

## Data model
- `notifications`: tenant_id, user_id, type, title, body (safe text), entity_type, entity_id, link_path,
  severity (INFO|WARNING|ACTION), dedupe_key, read_at, created_at. UNIQUE (tenant_id, user_id, dedupe_key).
- `notification_preferences`: tenant_id, user_id, type, channel, enabled. Defaults come from code catalog;
  rows store only overrides. Security alerts cannot be disabled.
- `notification_deliveries`: tenant_id, notification_id, channel, address (masked in logs), status
  (QUEUED|SENT|FAILED|SKIPPED), attempts, last_error, provider_message_id, sent_at.
- Dedupe key example: `PAYMENT_DUE:{obligationId}:{dueDate}:{daysBefore}` — scheduler reruns never duplicate.

## Scheduler
Daily per-tenant jobs at 08:00 tenant local time (configurable). One job per tenant per scan type. Scans read
through module query services (e.g., `FinanceQueryService.findObligationsDueBetween`).

## Content & templates
Templates per type/channel/locale in the notification module (`templates/<type>.<channel>.ts`), rendered with
safe variables only. In-app body may include non-sensitive context (project code, "3 payments due"); email/SMS:
generic text + deep link. Details load after login with current permissions.

## User features
Bell with unread count (polling every 60 s, SSE later), list with cursor pagination, mark read / mark all read,
preferences page per type × channel, digest option (future).

## Must not
Block business transactions on notification failure; send from inside a DB transaction; include amounts/party
names in external channels; notify users who lost permission since the event (recipient resolution happens at
send time).
