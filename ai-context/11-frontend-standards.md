# 11 — Frontend Standards (apps/web)

Load when: writing any UI code.

## Architecture
```text
apps/web/src/
  app/
    (auth)/login, (auth)/invite/[token], (auth)/reset-password …     public auth pages
    (app)/layout.tsx                  authenticated shell: session bootstrap, sidebar, header, tenant switcher
    (app)/dashboard, (app)/projects, (app)/projects/[projectId]/(tabs)…, (app)/parties, (app)/employees,
    (app)/attendance, (app)/payroll, (app)/finance/…, (app)/reports/…, (app)/settings/…
  features/<module>/                  module UI: components/, hooks/ (TanStack Query), api.ts, forms/, columns.tsx
  components/ui/                      shadcn/ui primitives (owned code)
  components/common/                  app-wide composites: DataTable, PageHeader, MoneyText, StatusBadge, EmptyState,
                                      ErrorState, ConfirmDialog, FilterBar, DateRangePicker, FileUploader, PermissionGate
  lib/                                api client, query client, formatters (money/date/number), permissions `can()`
  hooks/                              generic hooks (useListParams, useMediaQuery, useDebounce)
```
- Route files (`page.tsx`) are thin: compose feature components; no data logic, target < 80 lines.
- `features/<module>` mirrors backend modules. Features import from `components/*`, `lib/*`, and
  `@repo/contracts`; one feature must not import another feature's internals (share via `components/common`).

## Server vs client components
- Server Components: layouts, static page shells, metadata. The `(app)` layout validates the session server-side
  (forwarding the cookie to `GET /api/v1/auth/session`) and redirects to login if absent.
- **Business data is fetched in client components via TanStack Query hooks** (`features/<m>/hooks`). Server
  components do not call business endpoints (keeps one data path, one cache, one error model).
- Mark `"use client"` at the lowest component that needs it.

## Data fetching & state
- API client (`lib/api-client.ts`): same-origin `fetch('/api/v1/…')`, `credentials: 'include'`, adds
  `X-Requested-With`, parses the error envelope into a typed `ApiError { code, message, details, requestId }`.
- Query keys: `[module, resource, params]` from a per-feature key factory. Mutations invalidate precise keys.
- Server state lives in TanStack Query only. URL search params hold list filters/sort/page (shareable, back-button
  safe) via `useListParams`. Local UI state via `useState`. A global store (Zustand) only if a real cross-page
  client state appears — not for server data.
- Money arrives as strings; display via `formatMoney(value, currency)`; never do arithmetic for authoritative
  totals in the browser. Previews (e.g., "estimated total" while typing) are allowed if labelled and the server
  recalculates.
- Financial mutations send an `Idempotency-Key` generated once per form submission attempt (kept across retries).

## Forms
- React Hook Form + zodResolver using schemas from `@repo/contracts` (extend for UI-only fields).
- Every field: visible label, helper/error text below, correct `inputMode` (`decimal` for money, `numeric`,
  `tel`, `email`), autocomplete attributes.
- Map API `VALIDATION_FAILED.details[].path` back to fields; show business errors (422) in a form-level alert.
- Disable submit while pending; prevent double submission; confirm destructive/irreversible actions
  (void, approve) with a dialog stating consequences; void requires a reason.
- Long forms: sections + sticky submit bar on mobile. Draft autosave only where specified (e.g., attendance sheet).

## Loading, empty, error states (every data view has all four)
- Loading: skeletons matching layout (no spinners-only full pages).
- Empty: explanation + primary action if the user has permission.
- Error: `ErrorState` with message, retry, and requestId (for support). 403 → "You don't have access"; 404 →
  not found page; 401 → redirect to login preserving return URL.
- Success feedback via toast; don't navigate away silently.

## Responsive & mobile-first
- Design at 360px first, enhance at `sm 640 / md 768 / lg 1024 / xl 1280`.
- Touch targets ≥ 44×44px; primary actions reachable at the bottom on mobile (sticky action bar / FAB).
- Tables: on < md render as stacked cards (`DataTable` supports `mobileCard` renderer) — no horizontal scroll for
  primary lists. Keep ≤ 3–4 key fields per card.
- Navigation: sidebar on desktop; bottom nav / sheet menu on mobile with the field actions first
  (Attendance, Photo, Payment, Notifications).
- Field workflows must be fast on slow networks: optimistic UI where safe, compressed image uploads (client-side
  resize to ≤ 2560px, JPEG/WebP ~0.8), retry with same idempotency key.
- PWA (manifest + service worker) and offline attendance queue are planned — don't block them: keep attendance
  submission idempotent and serializable.

## Accessibility (WCAG 2.2 AA)
Semantic HTML; Radix/shadcn primitives for dialogs/menus; keyboard navigable; visible focus; color contrast
≥ 4.5:1; status never by color alone (icon/text too); `aria-live` for async results; form errors linked with
`aria-describedby`; charts have a table/text alternative.

## Reusable components — when to create one
Create a shared component when: (a) the same UI pattern appears in 2+ features, or (b) it encodes a rule that
must be consistent (money display, status badge colors, permission gating, date range semantics, file upload).
Otherwise keep it inside the feature. Before creating, search `components/` for an existing one.
Mandatory shared components: `DataTable`, `FilterBar`, `MoneyText`, `DateText`, `StatusBadge`, `PageHeader`,
`EmptyState`, `ErrorState`, `ConfirmDialog`, `FileUploader`, `PermissionGate`, `PartyPicker`, `ProjectPicker`,
`EmployeePicker`, `MoneyAccountPicker`, `CategoryPicker`.

## Tables, filters, dashboards, charts
- `DataTable` = TanStack Table with **server-side** pagination/sorting/filtering bound to URL params; column
  definitions in `features/<m>/columns.tsx`; row actions permission-gated.
- `FilterBar`: search box (debounced 300ms), common filters inline, "More filters" sheet on mobile; active filter chips.
- Dashboards: KPI cards (MoneyText + delta), lists of dues/alerts, charts lazy-loaded (`next/dynamic`).
- Charts (Recharts): only for trends/comparisons; always show values on hover and a tabular fallback; consistent
  palette tokens; currency axis formatting via `formatMoney` compact.

## Styling
Tailwind with design tokens (CSS variables) for colors, radius, spacing; dark mode via class. No inline style
objects except dynamic values. `cn()` helper for class merging. No component library other than shadcn/ui.

## Size limits (guideline)
Component files ≤ 200 lines; split when exceeding or when a component has more than one responsibility.
No page-level "god components" holding all dialogs, tables and forms.

## Frontend must NOT
Calculate payroll, profit, balances or allocations authoritatively; call the database or storage directly;
store tokens in localStorage; hardcode role names; bypass the API client; import from `legacy/`.
