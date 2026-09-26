# ADR-0014: Frontend — Next.js App Router, TanStack Query, shadcn/ui

- **Status:** Accepted · **Date:** 2026-09-26 · **Related:** 11

## Context
Authenticated, data-heavy business app used heavily on mobile; SEO irrelevant; needs consistent forms/tables.

## Decision
Next.js App Router for routing/layouts (server components for shells and session check); business data fetched in
client components via TanStack Query through a same-origin API client; forms with React Hook Form + shared Zod
schemas; shadcn/ui + Tailwind; TanStack Table with server-side pagination; Recharts lazy-loaded. No global store
for server data.

## Alternatives considered
Server Components/Server Actions for all data (two data paths, harder caching of interactive tables, couples web
tier to API auth details); SPA with Vite (loses layouts/route conventions; fine but no advantage); MUI/Ant
(heavy, harder mobile customization).

## Consequences
+ One data path, predictable cache/invalidation, PWA-friendly. − Initial data loads client-side (skeletons required).
