# Admin Panel Launch Checklist

Purpose: List the actions and conditions that must hold before the admin panel is relied on.

Last updated: 2026-10-24.

This repo is the owner/admin monitoring and response panel. The panel must not duplicate the template ingestion dashboard. Dated history is in `project-history.md`; current behaviour is in `README.md`; page-by-page routes and permission keys are in `admin-pages-and-permissions.md`.

Status key: DONE = in code; PARTLY = built, gap named; OPEN = not built; OWNER = hosting or account setting only the owner can do; NOT CHECKABLE = needs a live service or browser.

## P0

- Admin RBAC: DONE. Admin accounts, roles, signed sessions, refresh cookies, admin-panel login, per-route permission guards, denied attempts logged as security events. Fallback shared token: DONE (off by default, refused in production). Per-account login lockout on the backend: DONE.
- Step-up re-authentication for backup, restore and maintenance: OPEN.
- Admin and user two-factor sign-in: OPEN.
- Hosted admin behind ZTNA (Cloudflare Access or Tailscale): the code side is DONE (gateway secret check, startup warning in production, gateway proxy in this panel, Health shows whether the secret is set). The hosting setting is OWNER and NOT CHECKABLE from code. Without that setting the panel must not be exposed publicly.
- Backend CORS allowlist limited to deployed origins: the rule is DONE (wildcards rejected, explicit list required); the production origin list, including this panel's origin once the panel has a real address, is OWNER.
- Every admin action tied to a real admin identity: DONE. One hook records every admin write (POST, PUT, PATCH, DELETE under `/api/admin`) with who, what, which record, IP and result, so a new route is covered automatically; shown on the Audit Log page. Per-user actions also keep a typed reason in the User 360 timeline. Sign-in is covered by the security log.
- Security event statuses (planned, implemented, active, mitigated, resolved, false_positive): DONE as display and filter. A way to set an event to resolved or false positive from the panel: OPEN (no such backend route found).
- Incident response: suspend and unsuspend, force sign-out and delete are DONE (User 360); Export evidence per event is DONE (one JSON file for the last 72 hours of that account, download audited). Automatic response rules: OPEN.
- Refunds: DONE as an explicit action (User 360 Refund card, `billing.refund` permission, once per payment). Cancelling a plan alone does not move money.
- Webhook and checkout verification: DONE in the backend (webhook signature over the raw body, order and payment verified before a plan is granted).
- Rate limits: DONE in the backend (global per-IP default plus tighter limits on admin login, sign-in codes, generation and export). Limits are shared across servers only when `REDIS_URL` is set; Health shows whether the variable is set.
- Route access kept separate from teacher routes and the ingestion dashboard: DONE.
- Content-Security-Policy and security headers on this Next.js app: DONE in report-only mode; OPEN: watch the `[csp]` logs, then set `CSP_MODE=enforce`. The backend sets a separate one.
- Dependency audit: PARTLY. CI runs `npm audit` non-blocking; findings on next, postcss and sharp are open.

## P1

- Backups: PARTLY. Last backup time, recent downloads, a stale warning after 7 days, a restore dry run (insert-only, typed confirmation) and readable names are DONE. Scheduled daily backup, an off-site encrypted copy and a recorded restore drill: OPEN.
- Users view (Individual / Tutor and Institute tabs, search, sort, plan status, activity): DONE.
- Billing view (subscriptions, payments, failed webhooks, renewal state): DONE.
- Custom institute and campaign controls: DONE (organizations, seats and join code, entitlements, quotas, delivery checklist, requests inbox). Usage report export per institute: NOT CHECKED.
- Plan configuration (draft, preview, publish, rollback) and Offers: DONE.
- Support: reply history and resolve are DONE. Priority, owner and callback fields: OPEN.

## P2

- Monitoring: PARTLY. Health shows live system status and problems right now. Automatic alerts that message the owner (uptime or error-burst alert) are a hosting task: OPEN.
- Cloud backup history and scheduled backup status: OPEN.
- Role-specific admin home pages: OPEN.
- Automated browser tests for this panel: OPEN.

## Before launch (owner steps)

- Run Tests, "Security and access": confirm `sec.db_guard_installed` passes (mode production, current version) and `sec.db_guard_audit` passes. After any guard version bump, re-run `db-guard-production.sql` in Supabase. Limit: guards check identity columns only, not JSON or free text, so never copy production dumps into the test database (`paperly-mvp/docs/security-and-deployment.md`).
- Phone sign-in: run `paperly-mvp/docs/project-records/phone-otp-migration.sql` in Supabase first, then deploy; set `SMS_PROVIDER=msg91` and the provider keys only after the DLT template is approved (the template wording must equal the text shown by the Run Tests check "The SMS text carries the code and fits the DLT template"). Then open Run Tests, "Sign-in codes (email and phone)", press "Send test code" with the owner's own number and confirm the text arrives. Until SMTP exists, email codes (sign-up verification, forgot password) cannot be delivered in production; the same panel shows "recorded only (no mail server)".
- Device-lock migration (2026-10-13): deploy order is migration first, then backend, then teacher module and admin panel. `paperly-mvp/docs/project-records/device-lock-migration.sql` (idempotent; single-statement and step-by-step variants sit beside the file) was applied to production on 2026-10-13 through the Supabase SQL editor. The new User 360 Sign-in and Fix tab actions and the "Paused and banned accounts" card read the new tables, so this panel must not be released before the backend that serves the data. DONE.
- Messaging (2026-10-13): push migration applied and push keys set; send a test message to one user (bell, push and email) and check the history and email log. The Messaging page has been typechecked and linted but not yet seen in a browser. Open: the abuse-signals migration for the "Needs review" card.
- Maintenance and restore confirmation phrases use the Paperly-NT wording; release this panel and the backend together if either changes.

## ZTNA setup runbook (before the panel is exposed publicly)

1. Put the admin backend host behind Cloudflare Access (or a Tailscale-fronted reverse proxy): an Access application scoped to the admin hostname, with a policy limited to specific staff emails or a group.
2. Generate a long random value for `ZTNA_GATEWAY_SECRET` in the backend's production environment (header name `ZTNA_GATEWAY_HEADER`, default `X-Ztna-Gateway-Secret`).
3. In the Access policy, add a rule that injects that header on every forwarded request. The panel's own gateway proxy does this when `ADMIN_GATEWAY_SECRET` is set (`admin-gateway-setup.md`). For a Tailscale setup, make the reverse proxy inject the header.
4. Redeploy the backend and confirm the startup warning about `ZTNA_GATEWAY_SECRET` is gone.
5. From a machine outside the Access policy confirm `/api/admin/*` returns 403 ("Admin API not reachable outside the configured gateway.") and that the panel, through Access, still works end to end.
6. Add the panel's deployed origin to the backend `CORS_ORIGINS` and set `NEXT_PUBLIC_API_BASE_URL` in the panel's production environment.

## Data archive and pre-production reset (specification, OPEN: not built)

Archive hides one user, organization, support record, payment trail or worksheet group from normal views without destroying restore evidence (record id, export pointer, actor, reason, timestamp), searchable from a protected recovery view. Archive is not a production-wide cleanup tool.

Reset is a launch-cleanup action on a separate owner-only page (not beside user actions). Guardrails: owner role; rejected server-side when `APP_ENV=production`; typed phrase `RESET PAPERLY PREPRODUCTION DATA`; a second confirmation screen with affected tables and counts; JSON and Excel backup first; audit entries before and after. Default scope: test accounts, demo sessions and refresh tokens, generated worksheets and exports, usage analytics, test support tickets, manual or test billing rows, onboarding test answers. Preserved: approved templates and question bank, admin accounts, security configuration, public content and settings, migration history.

## Current truth

The panel has the right boundary (monitoring and business control, not ingestion). Remaining launch risk: the ZTNA hosting layer (OWNER), admin two-factor and step-up prompts, scheduled and off-site backups, and switching this app's Content-Security-Policy from report-only to enforce. The teacher module's sign-in does not secure this panel.

The admin panel now also sends a Permissions-Policy header (camera, microphone, geolocation and similar off) next to the report-only CSP. The panel runs on the owner's local machine only, so there is nothing to scan yet: scan the hosted panel with Security Headers and CSP Evaluator once hosted, and again after `CSP_MODE=enforce`; results for the teacher site are in `paperly-teacher-module/docs/launch-checklist.md` ("Security scans").

## Launch day status - 2026-10-24

- The panel talks to the backend on Vercel (`ADMIN_BACKEND_URL` points to the Vercel backend's `/api` address; the old host is gone). Set it in `.env.local` when running locally.
- Maintenance page: the "include super admin" option can be saved while maintenance is already on.
- Promo codes and Offers accept decimal percentages (two decimals).
- Refunds: User 360 is the only place to send a refund (the Payments page has no button yet). A refund sent from there also tells the person (inbox notice and email) and shows on their Payment history; a refund done in the payment gateway's own dashboard does not.
- OWNER: change the admin password that appeared in a screenshot; keep the admin panel behind the gateway secret; run the Referrals page check after the referral switch is turned on.
