# Admin Panel Launch Checklist

Last updated: 2026-08-27.

This repo is the owner/admin monitoring and response panel. It must not duplicate the template ingestion dashboard.

## P0

- Complete admin RBAC rollout. Backend admin users, signed sessions, refresh cookies, admin-panel login, route-level read/write permission guards, and denied-attempt security logging now exist; fallback-token removal and step-up auth for backup/maintenance remain pending.
- Protect hosted admin/backoffice URLs behind mandatory production ZTNA such as Cloudflare Access or Tailscale; local development may bypass this only outside hosted production.
- Keep backend CORS allowlist restricted to final deployed admin/backoffice origins; local origins are development-only.
- Every admin action must be tied to a real admin identity: backup export, maintenance, billing view/change, support status, user suspension, security review.
- Show security events with clear statuses: planned, implemented, active, mitigated, resolved, false_positive.
- Add incident response actions: force logout, suspend account, mark resolved, mark false positive, export evidence.
- Keep route access separate from teacher product routes and ingestion dashboard routes.

## P1

- Improve backup visibility: last backup time, JSON/XLSX export status, future cloud backup target, restore dry-run status.
- Improve Users view: Individual / Tutor and Institute tabs, search, sort, plan status, activity, purchase frequency.
- Improve Billing view: subscriptions, payments, failed webhooks, renewal state, manual review notes.
- Add custom institute/campaign controls: create organization, assign seats, set start/end date, toggle entitlements, set quotas, pause/expire plan, and export usage report.
- Improve Support view: ticket status, priority, owner, callback request, response history.

## P2

- Add monitoring dashboard for API health, DB status, export failures, diagram failures, generation failures, and unusual usage.
- Add cloud backup history and scheduled backup status.
- Add role-specific admin home pages for owner, support, finance, reviewer, and uploader.

## Current truth

The admin panel has the right product boundary now: monitoring and business control, not ingestion. The Teacher Module auth upgrade does not secure this panel.

Current/partial items reflected in `/health`:

- Current: backend-only plan gates for teacher product access.
- Partial: security event stream exists and denied admin permission attempts are actor-traced; response actions and full success-path admin audit coverage are still incomplete.
- Partial: manual JSON/XLSX backup exports exist, but scheduled cloud backup, encryption, restore dry-run, and history are pending.
- Stale as of 2026-08-21: some backend list limits existed, but admin-scale server-side pagination/filtering was not complete everywhere.
- Partial: session revoke/ban workflow is not fully wired into admin actions.

Remaining launch risk is completing admin RBAC traceability, safe custom-plan controls, and ZTNA. Without those, the panel should not be exposed publicly.

**2026-09-17 re-verification (Toyaj asked for a thorough pass across teacher-module, backend, and this panel):**
- Razorpay webhook verification: DONE, not a risk. `POST /billing/razorpay/webhook` verifies `X-Razorpay-Signature` (HMAC over the raw body against `RAZORPAY_WEBHOOK_SECRET`) before parsing anything, and `/billing/razorpay/verify` separately verifies `order_id|payment_id` server-side before granting any plan. This checklist line was stale.
- Route-level rate limits: DONE, not a risk. `backend/app/core/rate_limit.py` applies a blanket `120/minute` per-IP default to every route (so nothing is silently unlimited), with tighter explicit limits on admin login/OTP/generation/export.
- Production-only CORS origins: the code-side guard is solid (wildcard origins are rejected outright; `CORS_ORIGINS` must be set explicitly). Still genuinely pending: this admin panel has no production `NEXT_PUBLIC_API_BASE_URL` or deployed origin configured anywhere in the repo yet, and its own origin is not yet in the backend's `CORS_ORIGINS` - because it hasn't been deployed. Add it the same day this panel gets a real hosting URL, in the same change that requests ZTNA below.
- Fallback-token removal: `ALLOW_ADMIN_TOKEN_FALLBACK` now defaults to `false` in code (was `true`) - a deploy that forgets to set `ENVIRONMENT=production` no longer silently leaves the legacy `X-Admin-Token` bypass live. The mechanism itself is still in the codebase (older backoffice tooling may still depend on it) but is now opt-in, not opt-out, everywhere.
- ZTNA: still genuinely pending, and it has to be done outside this repo (Cloudflare Access application / Tailscale ingress in front of this panel's backend host) - see the runbook below. As a stopgap belt, the backend now supports `ZTNA_GATEWAY_SECRET` (see `backend/.env.example`): once set, it requires every `/api/admin*` request to carry a matching header, and the backend prints a loud startup warning in production/staging if it's still unset. This is defense-in-depth, not a substitute for the real network-level gate.
- Step-up auth for backup/maintenance: still genuinely pending, unchanged.

### ZTNA setup runbook (do this before the panel is exposed publicly)

1. Put the admin panel's backend host behind Cloudflare Access (or a Tailscale-fronted reverse proxy) - an Access "Application" scoped to the admin backend's hostname, with a policy limited to the specific staff emails/group who should reach it.
2. Generate a long random value for `ZTNA_GATEWAY_SECRET` and set it in the backend's production env, alongside `ZTNA_GATEWAY_HEADER` (defaults to `X-Ztna-Gateway-Secret`) if you want a different header name.
3. In the Access policy, add a "Add request headers" rule that injects `ZTNA_GATEWAY_HEADER: ZTNA_GATEWAY_SECRET` on every request it forwards. (Tailscale-fronted setups: configure the reverse proxy in front of the backend to inject the same header instead.)
4. Redeploy the backend and confirm the startup warning about `ZTNA_GATEWAY_SECRET` is gone.
5. Confirm from a machine NOT behind the Access policy that `/api/admin/*` returns 403 with "Admin API not reachable outside the configured gateway." - and confirm the actual admin panel, going through Access, still works end to end.
6. Set the admin panel's real deployed origin in the backend's `CORS_ORIGINS`, and set `NEXT_PUBLIC_API_BASE_URL` in the admin panel's own production env to the backend's real URL.


## Data Archive / Reset Flow

This is a P0 admin-safety requirement before exposing reset controls in the UI.

### Archive button

- Place archive actions near user, organization, support, billing, and generated-work records.
- Archive must hide records from normal views, not permanently delete them.
- Archive must create restore evidence: record id, compressed/export pointer, actor, reason, and timestamp.
- Archive must be searchable from a protected audit/recovery view.

### Reset pre-production data button

- Place global reset on a separate owner-only Data Control or Launch Cleanup page.
- Do not place it beside normal user-management actions.
- Require owner role, typed phrase, second confirmation, backup export, and audit log.
- Disable reset completely in production by checking `APP_ENV=production` server-side.
- UI hiding is not enough; backend must reject reset in production.

### Reset sequence

1. Owner opens Data Control / Launch Cleanup.
2. Backend checks owner admin role and `APP_ENV !== production`.
3. System shows affected tables and counts.
4. Owner types `RESET PAPERLY PREPRODUCTION DATA`.
5. System shows second confirmation.
6. Backend exports JSON backup and Excel backup.
7. Backend writes pre-reset audit log.
8. Backend clears only allowed pre-production data scopes.
9. Backend writes post-reset audit log with counts.
10. Admin panel shows reset result and backup location.


## Current Update - 2026-08-21

Server-side pagination/filtering is now marked current, not P1 partial.

- Backend admin endpoints now support paged contracts for users, support tickets, subscriptions, payment events, and security events.
- Admin pages now use `limit=25`, `offset`, search, filters, and sort instead of full-list browser filtering.
- This is the production pattern for 50k-user readiness: database filters first, browser renders only the current page.
- Any future large admin dataset must ship with backend pagination from day one.

## Current launch checks - 2026-08-27

Status: Current.

- Admin panel login/session must be independent from MVP/backoffice and teacher sessions.
- Health, Users, Billing, Support, Backups, Maintenance, Security Events, and Admin Users must call admin routes only.
- Template upload/review/approve/QA preview must remain linked to MVP/backoffice, not duplicated here.
- Backup/export and maintenance actions must require admin identity and produce audit evidence.
- Billing outage display must be informational only; it must not rewrite a teacher's actual subscription or workspace state.

## Current update - 2026-08-27 - Admin RBAC security check

Status: Current with explicit deferred infra items.

- Admin-panel and MVP/backoffice sign-in must stay separate from teacher authentication. Admin tokens must never satisfy teacher-session checks.
- Admin endpoints now require both a valid admin session and route-specific permissions; handlers for users, billing, support, backups, maintenance, security events, and overview should not rely on generic is-admin checks.
- Denied admin permission attempts are security events, not silent 403s, so abuse or mis-scoped accounts leave an audit trail.
- ZTNA remains a hosted-production infrastructure requirement and must be enforced before public exposure; local development may bypass it.
- True step-up authentication for backup export and maintenance mode is still a pre-GA hardening item, separate from typed confirmation.

## Backfilled history - 2026-08-31 through 2026-09-15 (real commit dates)

**Note (2026-09-16): this file had gone stale since 2026-08-27. Entries below reconstructed from real git commit timestamps (`git log --since=2026-08-01 --date=short`), not from memory.**

### 2026-08-31 - Access hardening
- Hardened admin access and documentation.

### 2026-09-02 - Mobile maintenance
- Improved mobile maintenance controls.

### 2026-09-06 - Full Portion/AI Checking/RLS visibility, DFDs
- Added Full Portion, AI Checking, and RLS status admin visibility.
- Added logo asset and DFD docs for the admin-panel gap-closing pass.

### 2026-09-08 - Organizations page, server-log diagnostics
- Added Organizations page for per-institute white-label theming/features.
- Added server-log troubleshoot diagnostics and status-code breakdown UI.

### 2026-09-09 - Requests inbox
- Added Requests inbox to the Organizations page, ahead of the org editor.

### 2026-09-10
- Docs commit cross-referencing the template-loading perf fix and the new Full Portion billing field.

### 2026-09-15 - Promo Codes tab, User 360
- Added Promo Codes admin tab: create, live redemption tracking, toggle; shows redeemer name/email, CSV export, clarifies code-expiry vs plan-duration.
- Added User 360 tab: full per-user history in one page, wired to remediation actions (quota reset, unstick-generation, verify-email).
- Fixed crushed search box on the Users filter bar; hardened shared inputs.

Going forward this file should be updated same-day as work lands, not batched across weeks.
