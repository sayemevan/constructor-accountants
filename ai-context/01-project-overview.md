# 01 — Project Overview

Load when: planning scope, prioritizing features, writing user-facing copy, or deciding MVP vs future.

## Problem
Small and medium construction businesses run many projects at once using spreadsheets, paper registers and
disconnected tools. They cannot reliably answer: *What has each project cost so far? What do clients still
owe us? What do we owe workers, subcontractors and rental providers? Is this project profitable?*
Wage calculation by hand causes disputes; documents (agreements, drawings, site photos) are scattered.

## Product goal
A single platform where a construction company manages the full project lifecycle, workforce, payments,
documents and reports — built as a **Construction ERP foundation** that can grow (inventory, procurement,
BOQ, client portal…) without re-architecture.

## Target users and their primary jobs
| User | Primary jobs | Typical device |
|---|---|---|
| Company Owner | Overview of all projects, profitability, cash position, dues; approve large payments | Mobile + desktop |
| Administrator | Users, roles, company settings | Desktop |
| Accountant | Receipts, payments, expenses, payroll payments, party ledgers, financial reports | Desktop |
| Project Manager | Projects, contracts, employee assignment, subcontracts, documents, project reports (assigned projects) | Mobile + desktop |
| Site Supervisor | Daily attendance, site photos, progress updates for assigned projects | Mobile (poor connectivity) |

Roles are **defaults**, not hard-coded — tenants can edit them (see 09).

## Scope — MVP (first release)
- **Platform:** authentication, tenant/company profile & settings, users & invitations, roles & permissions, audit log.
- **Master data:** parties (with roles), projects (status lifecycle, members, updates), optional contracts
  (lump sum, square-feet, running bill, custom) with variations.
- **Documents:** upload and attach files/photos to projects and records; mobile photo upload.
- **Finance:** money accounts (cash/bank/wallet), categories, receipts, payments, transfers, expenses
  (payables), client bills (receivables), allocations, void/reversal, approvals, party ledger, project summary.
- **Workforce:** employees, effective-dated pay rates, project assignments, attendance (bulk, mobile),
  payroll (daily / monthly / contract-based), advances, deductions, partial payments.
- **Subcontractors:** subcontracts, progress bills, advances, payments, outstanding balances.
- **Reports:** project profitability, income/expense, cost by category, party ledger, cash flow,
  attendance & wage reports, dashboard; CSV/XLSX export.
- **Notifications:** in-app + email; due reminders, salary reminders, project deadline alerts.

## Scope — after MVP (planned, architecture must allow)
Machinery (owned assets, usage, maintenance, fuel) and equipment rental (providers, periods, charges, returns)
are **Phase 8** — until then, rental and machine costs are recorded as ordinary expenses with the right
category. Later: PWA/offline attendance, PDF exports, advanced analytics, subscriptions & self-hosted
licensing, double-entry general ledger, inventory/materials, procurement, BOQ, client portal, tasks,
quality, safety, native mobile apps.

## Explicitly out of scope (until an ADR says otherwise)
- Statutory accounting (tax filing, VAT/withholding returns, audited financial statements).
- Multi-currency within one tenant (each tenant has one base currency; currency code is stored for later).
- Bank feeds / payment gateway integrations.
- Worker self-service logins.

## Deployment models
- **SaaS:** many tenants share one deployment; strict isolation (06).
- **Self-hosted:** customer runs the same Docker images with their own DB, storage and domain;
  runs as a single tenant; must work with **no external SaaS dependency** (email/SMS optional).
- **Dedicated (enterprise):** a separate SaaS-operated instance per customer — same artifacts as self-hosted.

## Success criteria
A company can: create a project in < 1 minute; record a day's attendance for a 30-person crew on a phone
in < 2 minutes; generate and pay payroll with no manual arithmetic; see each project's income, cost,
profit and outstanding dues accurately at any time; find any agreement or site photo in seconds; and trust
that no financial history can silently disappear.
