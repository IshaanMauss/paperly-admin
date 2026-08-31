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

Remaining launch risk is completing admin RBAC, traceability, safe custom-plan controls, ZTNA, production-only CORS origins, route-level rate limits, and Razorpay webhook verification. Without those, the panel should not be exposed publicly.


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
