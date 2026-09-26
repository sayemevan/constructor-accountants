# Template: Frontend Development

```text
Task: Build <page/component/form> for <feature> in apps/web (feature folder: features/<module>).

Read: 11-frontend-standards.md, 10-api-standards.md (error envelope, pagination), ai-context/modules/<module>.md
(APIs, permissions). Inspect apps/web/src/components/common, components/ui, and features/<module>.

Requirements:
- Thin route file; logic in features/<module> (hooks with TanStack Query, forms with RHF + contracts schemas)
- Mobile-first: works at 360px; tables become cards < md; touch targets ≥ 44px; sticky primary action on mobile
- All states: loading skeleton, empty (with permitted CTA), error (retry + requestId), success toast
- Permission gating with can(code) (UX only); sensitive fields absent when API omits them
- Money via MoneyText/formatMoney; no authoritative calculations in the browser
- Financial submits send an Idempotency-Key reused on retry; confirm dialogs for approve/void (reason for void)
- Accessibility: labels, keyboard, focus, aria-live for async results
- Reuse shared components; create a new shared one only per 11's rule

Tests: component tests (RTL + MSW) for form validation & error mapping; E2E step if it's a core journey.
Provide screenshots/description for mobile and desktop.
```
