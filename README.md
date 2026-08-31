# Paperly Admin Control Panel

Last updated: 2026-08-21.

This folder is the owner/admin monitoring panel for Paperly. It is not the template ingestion dashboard and it is not the sellable teacher product.

## Product Boundary

- `paperly-mvp/backend`: FastAPI backend, database, template engine, worksheet/export engine, billing routes, backup routes, and admin APIs.
- `paperly-mvp/dashboard`: internal backoffice for Upload -> Review -> Approve -> QA Preview.
- `paperly-teacher-module`: sellable paper-building product for users.
- `paperly-admin-panel`: owner/admin control plane for monitoring, users, billing, support, backups, health, maintenance, and future roles.

This panel must not duplicate screenshot upload, JSON drafting, template approval, or QA preview. Those remain in `paperly-mvp/dashboard`.

## Main Sections

- Overview: platform health, business summary, active risks, and key actions.
- Users: split Individual / Tutor and Institute views, with search, sorting, plan state, activity, and usage.
- Billing: subscriptions, plan states, renewal dates, and payment/webhook evidence.
- Support: feedback, complaints, callback requests, and unresolved customer issues.
- Backups: manual JSON/XLSX exports now; daily cloud backup target later.
- Health: backend reachability, database readiness, production checks, and route status.
- Maintenance: put the teacher module into maintenance mode and restore service after approval.
- Admin Users: future role-based access for owner, admin, reviewer, uploader, support, and finance roles.

## Maintenance Rule

When maintenance is restored, active teacher-module sessions should be invalidated with a session-version or session-epoch check. Users must log in again, but their saved papers, profile, usage, and billing data must remain safe.

## Backup Rule

- Excel/XLSX backup is for humans: sales review, auditing, customer support, and business interpretation.
- JSON backup is for disaster recovery: restore data if the database is damaged or lost.
- SQL dump is the future strongest full restore format for production databases.

Current state: manual backup can download locally. Target state: daily cloud backups plus admin-visible backup history and restore dry-run.

## Production Checks

Current health-page truth as of 2026-08-20:

- Current: Backend-only plan gates are active for teacher-side protected access, but must keep regression tests.
- Partial: Audit/security event logging exists for risk events, but not every admin action is actor-traced yet.
- Partial: Manual JSON/XLSX backup export exists, but scheduled cloud backup and restore dry-run are pending.
- Stale as of 2026-08-21: Health previously used backend pagination limits, but full server-side pagination/filtering was not complete across all admin datasets.
- Partial: Upload type and size limits belong mostly to MVP/backoffice upload routes and must remain server-enforced.
- Partial: Session revoke/ban workflow exists conceptually through session expiry/maintenance, but admin response actions are not fully wired.
- Partial: Role-based admin auth now has backend admin users, signed sessions, refresh cookies, and admin-panel gating; permission-specific route enforcement and fallback removal are still pending.
- Pending: ZTNA for hosted admin/backoffice access.
- Pending: Razorpay webhook verification and idempotent payment processing.
- Pending: Route-level rate limits, WAF/CDN rules, and production CORS origin lock-down.

## Local Run

```powershell
cd C:\Users\ishaa\OneDrive\Desktop\paperly-admin-panel
npm install
npm run dev
```

The app expects:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

## Backend Routes Used

- `GET /api/admin/teachers`
- `GET /api/admin/support-tickets`
- `GET /api/admin/billing/subscriptions`
- `GET /api/admin/billing/payment-events`
- `POST /api/admin/backups/export?format=json`
- `POST /api/admin/backups/export?format=xlsx`
- `GET /api/admin/platform-status`
- `POST /api/admin/platform-status`
- `GET /api/templates` for health/risk summary only, not ingestion.

## Security Notes

- Current admin protection uses `ADMIN_API_TOKEN` when configured.
- This is an MVP stopgap, not final production auth.
- Before hosted deployment, add real admin login, RBAC, signed sessions, audit logs, and per-role permissions.

## Zero-Trust Network Access

Admin and backoffice URLs should not be fully public.

Recommended setup:

- Use Cloudflare Access for hosted admin/backoffice domains.
- Use Tailscale for private/internal development access or team-only private services.
- Protect `paperly-admin-panel`, `paperly-mvp/dashboard`, and mutating backend admin routes.
- Do not put the public teacher module behind ZTNA; users must be able to reach it normally.
- Keep app-level admin login/RBAC even after ZTNA. ZTNA is the first gate, not the only gate.

Production rule: a person should pass identity/device/network access first, then Paperly admin login/role checks second.
## Security Event Monitoring

The Security page now reads `GET /api/admin/security-events`.

Events currently logged by the backend:

- blocked worksheet/topical generation caused by plan or quota limits
- selected-template access mismatch, usually stale UI state or request tampering

This is the first practical slice of the larger security architecture. It does not replace Cloudflare WAF, ZTNA, admin RBAC, atomic quotas, webhook verification, or encrypted backups; it gives the owner panel a real audit stream while those layers are added.


## Business-readable QA signals

The admin panel should make production risk understandable without opening code:

- Export leak detected: browser header/footer, localhost URL, or API path visible in a customer-facing PDF.
- Diagram missing: template says diagram is required but export rendered an empty diagram box.
- Topic tag mismatch: template appears under the wrong topic or is missing a required cross-topic tag.
- Plan-gate mismatch: frontend state claims access but backend billing/subscription state disagrees.
- Security event status should use clear states: `planned`, `implemented`, `active`, `mitigated`, `resolved`, and `false_positive`.
## P0 Security Alignment - 2026-08-08

The Admin Control Panel is the monitoring and response surface, not the ingestion dashboard. The current shared P0 architecture plan is documented in `C:\Users\ishaa\OneDrive\Desktop\paperly-mvp\docs\p0-security-architecture-plan.md`.

Admin-panel P0s still to complete:

- Add real admin auth and RBAC before hosted deployment.
- Keep ZTNA as the first gate for admin/backoffice URLs, then Paperly admin login as the second gate.
- Show server-side audit and security events with clear statuses: `planned`, `implemented`, `active`, `mitigated`, `resolved`, `false_positive`.
- Make user, billing, backup, support, maintenance, and risk actions traceable to a real admin identity.
- Do not duplicate Upload -> Review -> Approve -> QA Preview; that remains in `paperly-mvp/dashboard`.


## Launch Checklist

See `docs/launch-checklist.md` for the Admin Panel P0/P1/P2 launch-readiness list. The shared three-repo August launch map is in `C:\Users\ishaa\OneDrive\Desktop\paperly-mvp\docs\august-launch-readiness.md`.



## Data Archive and Pre-production Reset

The admin panel must support two different data-control actions. They are intentionally separate because their risk levels are different.

### Archive user/data

Archive means remove selected records from normal admin views without destroying restore evidence.

- Use for one user, one organization, one support record, one payment trail, or one generated worksheet group.
- Archived data should be hidden from normal tables by default.
- Archive must keep a compressed restore pointer or export reference so the record can be investigated later.
- Archive must log who performed the action, when it happened, what was archived, and why.
- Archive is reversible only through an owner/admin restore path or direct database restore procedure.
- Archive must not be used as a production-wide cleanup tool.

### Reset pre-production data

Reset is a launch-cleanup action, not a normal admin operation. It should clear test/demo business data before production launch while preserving product configuration that should survive launch.

Required reset guardrails:

- Allowed only for owner admins.
- Disabled when `APP_ENV=production`.
- Requires typed confirmation: `RESET PAPERLY PREPRODUCTION DATA`.
- Requires a second confirmation screen showing affected tables and estimated record counts.
- Must export backup first in both JSON and human-readable Excel format.
- Must write an audit log before and after the reset.
- Must never silently delete approved template/product configuration unless owner explicitly selects that scope.

Default reset scope before launch:

- Test teacher/user accounts.
- Demo sessions and refresh tokens.
- Generated worksheets and worksheet exports.
- Usage analytics and template-use counters.
- Support tickets created during testing.
- Manual/test billing rows and payment-event test data.
- Onboarding/profile test answers.

Default preserved scope:

- Approved templates and verified question bank.
- Admin accounts and owner access.
- Security configuration.
- Public landing-page content and product settings.
- Migration history.


### Current Update - 2026-08-21

- Current: Admin Users, Support, Billing Subscriptions, Payment Events, and Security Events now use server-side `limit`, `offset`, `search`, filters, and sort contracts.
- Current: Admin UI pages now request one page at a time instead of loading full large datasets into the browser.
- Scale rule: for 50k+ users, every new admin dataset must follow this backend-paged pattern; client-only filtering is no longer acceptable for growing tables.
- Verification: backend admin route syntax/import checks passed and the admin production build completed successfully.

## Current truth - 2026-08-26

Status: Current. Earlier notes remain for history; this section is the active launch reading.

- The admin panel is the owner control plane for monitoring, billing, support, backups, health, maintenance, security events, and admin users.
- It must not duplicate MVP/backoffice template ingestion, Manage JSON, approval, or QA preview. Those remain in `paperly-mvp/dashboard`.
- Admin-panel authentication is separate from teacher authentication and separate from MVP/backoffice template-management sessions. It should use admin-purpose sessions, admin roles, and admin audit events.
- Admin actions must be traceable to a real admin identity, especially maintenance, backup/export, support status changes, billing review, user suspension, and future archive/reset actions.
- The panel should explain platform state without corrupting product state. A health or billing outage must not silently change teacher plan state or selected-paper workflow.
- Level 1 admin flow is documented in `docs/dfd/admin-control-panel-level1-flow.mmd`.
