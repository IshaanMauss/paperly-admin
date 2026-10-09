# Project History

Last updated: 2026-10-08.

This file is the month-level product history for the admin panel. It keeps the panel's role clear: monitoring, support, billing, plans, safety and operations. It should not drift into template ingestion, which remains outside this panel.

## Documentation Standard

- Active docs should use project-owned wording and should not mention outside tools, reviewers, or handoff agents.
- Current behaviour belongs in `README.md`, `docs/admin-pages-and-permissions.md`, `docs/launch-checklist.md` and `docs/admin-gateway-setup.md`. This file holds dated history only.
- The launch checklist remains the operational source of truth; this file records history and intent.

## August 2026

Reconstructed from surviving README/launch-checklist/DFD notes and the August git history. Early August admin work was mostly planning and boundary documentation, so this section records the product decisions and the confirmed implementation movement.

### 2026-08-08 to 2026-08-21: Admin-panel boundary and P0 security alignment

- Defined the admin panel as the owner/admin monitoring and response panel, not the ingestion dashboard and not the user-facing product.
- Set the product boundary: backend owns data, billing, exports and admin APIs; MVP dashboard owns template ingestion/review; teacher module owns paper-building; admin panel owns operations.
- Captured P0 launch requirements: admin RBAC, separate admin sessions, route-level permission checks, denied-attempt security logging, production ZTNA, restricted CORS, and actor-traced admin actions.
- Recorded that template upload/review/approve/QA preview must remain in the MVP dashboard.

### 2026-08-26 to 2026-08-27: Launch checks and RBAC truth

- Updated launch checks for independent admin sessions, admin-only routes, backup/export identity evidence, billing outage display and separation from teacher sessions.
- Recorded the admin RBAC security check: valid admin session plus route-specific permissions, denied attempts logged as security events, fallback-token removal as a deployment risk, and ZTNA as a hosted-production requirement.
- Updated DFD documentation for the admin panel and backend/admin boundary.

### 2026-08-31: Access hardening

- Hardened admin access and documentation.
- Established the path toward exposing the panel only after ZTNA, step-up auth for backup/maintenance and full success-path audit coverage are ready.

## September 2026

### 2026-09-02 to 2026-09-10: Admin visibility and organisation operations

- Improved mobile maintenance controls.
- Added Full Portion, AI Checking, and RLS status visibility.
- Added DFD documentation for the admin-panel gap-closing pass.
- Added server-log troubleshoot diagnostics and status-code breakdown UI.
- Added Organisations page for per-institute white-label theming and feature flags.
- Added Requests inbox to the Organisations page.

### 2026-09-15 to 2026-09-17: Promo, User 360 and security checklist correction

- Added Promo Codes tab with creation, live redemption tracking, toggles, redeemer name/email, CSV export, and clearer expiry/duration wording.
- Added User 360 with full per-user history and remediation actions.
- Fixed Users filter layout and hardened shared inputs.
- Sanitised raw backend error bodies and fixed clipped Users table.
- Re-verified the launch checklist so stale claims about webhook verification and route-level rate limits were corrected.

### 2026-09-28 to 2026-09-30: Admin tests, API split and rename

- Added missing taxonomy value support for admin-facing views.
- Added Vitest, first unit tests, and CI.
- Added admin UI coverage for support resolution, log acknowledgement/deletion, suspend, export/delete on behalf, billing cancellation, backup restore, checking drill-down and worksheet drill-down.
- Split `apiClient.ts` into request helpers and response/payload types.
- Added variant health page and API type updates.
- Completed user-facing product rename in the admin panel without changing package names, API paths, or environment variable names.

## October 2026

### 2026-10-01 to 2026-10-02: Gateway, offers, plans and Run Tests

- Added Railway backend setup notes for admin login.
- Added server-side gateway proxy so the panel can call protected backend admin routes without exposing the gateway secret to the browser.
- Redesigned the admin panel, added Offers page, and added the Plans & Features admin screen.
- Added names beside IDs, Paper Builders view, institute setup support, and clearer log/health transparency.
- Added status-code guide explaining the statuses Paperly returns.
- Added Run Tests page with grouped sections, run buttons, progress, search, failure details and "Not tested yet" scanning.
- Added test-database panel, write-test labels and blocked-for-safety states.
- Documented Run Tests, database guards, and test database behaviour.

### 2026-10-03: Sign-in codes operations

- Added Run Tests sign-in-code panel showing status, outbox, and send-test-code controls.

### 2026-10-03 (later): Audit Log, backups, evidence, live status

- Added the Audit Log page (every admin write, filter by admin and failures).
- Backups page now shows last export, who ran it and a stale warning; downloads use readable file names.
- Security page can export incident evidence for an account.
- Health page now shows a live system-status panel.
- User 360 gained a Refund card (real Razorpay refund, once per payment, behind the separate `billing.refund` permission).
- Backend gained a Content-Security-Policy and a per-account admin login lockout; CI gained `security.yml` (non-blocking `npm audit`, secret scan, weekly run).
- Wrote `docs/admin-pages-and-permissions.md` from the code: every page, its backend routes and permission keys.

## Current Open Threads

- Keep this panel as the product operations console, not an ingestion dashboard.
- Finish remaining P0 hardening before public exposure: production ZTNA (OWNER), admin two-factor sign-in, step-up re-authentication for backup, restore and maintenance, and a Content-Security-Policy on this app. Admin audit coverage is complete.
- Add a way to mark a security event resolved or false positive from the panel (no backend route exists yet).
- Keep Run Tests read/write safety clearly separated: production read-only checks, write tests on the locked test database.
- Keep launch checklist wording current after every security or deployment change.

## 2026-10-03 - Variant Health tab redesigned

- The tab now lists each template with when it was added, updated and approved, and its exhaustion. Show more opens possible number combinations, possible different answers and wordings, labelled exact, estimate or very large.
- A Calculate missing numbers button fills the sizes for templates that have none, in small batches until none remain. It must be pressed once after deploy for the 125 approved templates.
- Still open: changes are uncommitted and not deployed.

## 2026-10-08 (night) - Export data, plans apply bar, Variant Health, User 360 tabs

- Backups page: the Excel action is now **Export data** with Everything, Last 7 days, Last month and a custom range (Indian time, both days included); the JSON action is **Download backup**. The workbook gained Billing Summary, Payments and Customer Contacts sheets.
- Features & Plans: sections open and close, a top overview shows what changed, and an apply bar is the one place to publish a draft. A backend test proves each toggle and limit reaches the product through the same computed status the app reads.
- Variant Health: the page shows why a size calculation stopped and no longer times out on large templates.
- User 360 is split into Summary, Payments, Papers, Sign-in, Messages & tickets, Timeline and Fix account. Summary has a refund and dispute checklist; Payments shows every attempt in full; messages never show the text of a sign-in code.
- Still open: nothing here is committed or deployed; the panel has not been built on the Windows machine.
