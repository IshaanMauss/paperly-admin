# Paperly-NT Admin Control Panel

Last updated: 2026-10-03.

The owner/admin control plane for Paperly-NT: Next.js (pages router) app for monitoring, users, billing, plans, support, backups, health, maintenance, security and admin accounts. It is not the template-ingestion dashboard and not the sellable teacher product.

Status words used in these docs: DONE (in code), PARTLY (built, gap named), OPEN (not built), OWNER (hosting/account step only the owner can do), NOT CHECKABLE (needs a live service or browser).

Related docs: `docs/admin-pages-and-permissions.md` (every page, its backend routes and permission keys), `docs/admin-gateway-setup.md`, `docs/launch-checklist.md`, `docs/project-history.md`, `docs/dfd/`.

## Product boundary

- `paperly-mvp/backend`: FastAPI backend, database, template engine, worksheet/export engine, billing, backups and the admin APIs.
- `paperly-mvp/dashboard`: internal backoffice for Upload, Review, Approve, QA Preview. This panel never duplicates screenshot upload, JSON drafting, approval or QA preview.
- `paperly-teacher-module`: the sellable paper-building product.
- `paperly-admin-panel` (this repo): monitoring, users, billing, support, backups, health, maintenance, security and admin team.

Admin sign-in is separate from teacher sign-in and from the backoffice. A health or billing outage shown here is informational and must never rewrite a teacher's plan or workspace.

## Quick start

```powershell
npm install
npm run dev          # http://localhost:3002 (next dev --webpack -p 3002)
```

Scripts: `npm run lint` (`next lint`), `npm test` (vitest), `npm run build`, `npm start`.

## Environment variables

Set in `.env.local` (git-ignored). Never put real API keys in frontend env files.

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Where the browser sends API calls. `/api/gateway` (the proxy, normal setup), or `http://127.0.0.1:8003/api` for a purely local backend with no gateway secret. |
| `ADMIN_BACKEND_URL` | Server-side only. Backend API root the gateway proxy forwards to (for example `https://<railway-host>/api`). Required for the proxy. |
| `ADMIN_GATEWAY_SECRET` | Server-side only. Same value as the backend's `ZTNA_GATEWAY_SECRET` (at least 40 random characters). |
| `ADMIN_GATEWAY_HEADER` | Optional. Defaults to `X-Ztna-Gateway-Secret`. |
| `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` | Optional. Set both to require a valid Cloudflare Access login at the proxy. |

Backend variables the panel depends on: `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD`, `ADMIN_BOOTSTRAP_NAME` (first owner account), `ZTNA_GATEWAY_SECRET`, `CORS_ORIGINS` (this panel's origin, no wildcards), `ALLOW_ADMIN_TOKEN_FALLBACK=false` in production. Full setup: `docs/admin-gateway-setup.md`.

## Pages

Navigation groups in `src/components/AppShell.tsx`. Backend routes and permission keys for each page are in `docs/admin-pages-and-permissions.md`.

- Overview: platform health, business summary, active risks, key actions.
- People: Users (Individual / Tutor and Institute tabs, search, sort, plan state, activity, test-account flag), User 360 (full per-user history with remediation actions and a Refund card), Organizations (institute theming, flags, seats and join code, entitlements, delivery checklist, Requests inbox), Admin Team (admin accounts, roles, per-account permissions).
- Money: Billing (subscriptions, payment events), Plans & Features (draft, preview, publish, rollback of plan words and prices; versions are kept), Offers (time-limited offers), Promo Codes (create, toggle, redemptions, CSV export).
- Product: Paper Builders (Full Portion, Topical and AI-checking usage and subtopic caps; `/full-portion` redirects here), AI Checking (overview and submissions), Variant Health.
- Operations: Support (tickets, reply and resolve), Maintenance (maintenance mode with typed confirmation, worksheet cleanup), Backups, Health, Server Logs (with a status-code guide), Run Tests, Security, Audit Log.

Notes on individual pages:

- Backups: manual downloads, an Excel business workbook and a restorable JSON, both with readable names (`paperly-nt_backup_business-workbook_<date>_<time>-UTC.xlsx`, `paperly-nt_backup_restorable-data_<date>_<time>-UTC.json`); last-backup time and recent download history with a warning after 7 days; an insert-only restore with a dry run and typed confirmation. The workbook has a Read Me sheet and plain column headings. The backup covers users, subscriptions, payments, papers, templates, organizations and members, institute requests, offers, plan configuration history, quota counters and drafts. Passwords, sign-in tokens and sign-in codes are never included. The download itself is audited.
- Health: live system status (database speed and version, shared rate-limit store, disk, last-hour requests, server errors and refused requests, key settings, last backup) plus problems right now and the readiness notes. A value that cannot be checked says so.
- Security: security events with a status filter (statuses read from each event; the filter offers resolved and false positive), a row-level-security status panel, and an Export evidence button per event (one JSON file with the last 72 hours of that account; the download is audited). Suspend, unsuspend, force sign-out and delete are done from User 360. No admin route that sets an event's status to resolved or false positive exists in the backend (OPEN), so those two statuses appear only if an event already carries them.
- Audit Log: every admin write (POST, PUT, PATCH, DELETE under `/api/admin`, sign-in excluded) is recorded automatically with who, what, which record, IP and result; request bodies and passwords are never stored. A new route is covered without extra code.
- Run Tests: read checks are safe on production; write checks run only against the locked local test database (the backend answers "Blocked for safety" otherwise). Sections include Security and access, Payments, PDF look, AI checking (`ai.live` is off unless `TEST_CENTER_AI_LIVE=1` on the server), Load and speed, a test-database panel (seed and wipe) and "Sign-in codes (email and phone)" with status, outbox and a send-test-code control. To use write tests, run the local test backend (`python scripts/local_test_db.py backend` in `paperly-mvp/backend`, port 8100) and a second panel instance pointed at it. Detail: `paperly-mvp/docs/security-and-deployment.md`.
- Maintenance: restoring service must invalidate active teacher sessions through the session-epoch check; saved papers, profiles, usage and billing stay safe. The confirmation phrases (`PUT PAPERLY-NT TEACHER MODULE IN MAINTENANCE`, `RESTORE PAPERLY-NT TEACHER MODULE`, `RESTORE PAPERLY-NT DATABASE FROM BACKUP`) must match the backend text in `app/api/routes/admin_backups_maintenance.py`; release panel and backend together if either changes.

## Auth, permissions and security

- Real admin accounts with roles (owner, admin, security, finance, support, template_manager, reviewer, uploader, viewer), signed short-lived tokens and a refresh cookie. Every admin route checks a permission key through the backend; denied attempts are logged as security events. The access token lives in memory only (`src/lib/adminToken.ts`); this panel writes nothing to browser storage. The older shared `ADMIN_API_TOKEN` fallback is off by default and refused in production.
- Backend per-account login lockout (5 failed admin sign-ins, 15 minutes by default) and a Content-Security-Policy on the backend's responses are in place. DONE.
- Gateway proxy `src/pages/api/gateway/[...path].ts`: the browser calls `/api/gateway/...`; the server route optionally checks the Cloudflare Access token, adds the gateway secret header and forwards to the backend, so the secret never reaches browser code. Vercel-style limits (about 4.5 MB bodies, 60 s) apply if hosted there; large backups or restores should run from a local session.
- Zero-trust: DONE in code (gateway secret check, startup warning in production, Health shows whether the secret is set). Whether Cloudflare Access or Tailscale actually sits in front of a hosted admin is OWNER and not checkable from code. Do not put the public teacher module behind it. App-level admin login and roles stay on even with ZTNA.
- OPEN: admin two-factor sign-in; step-up password prompt before backups, restores and maintenance; Content-Security-Policy and other security headers on this Next.js app (`next.config.ts` sets none).
- Pagination: users, support tickets, subscriptions, payment events and security events are paged and filtered on the backend (`limit`, `offset`, `search`, filters, sort). Every new large dataset must do the same.

## Backup rules

- Excel is for humans (sales review, audit, support); JSON is for recovery; a SQL dump is the future full-restore format.
- OPEN: scheduled daily backup, an off-site encrypted copy, a recorded restore drill, and cloud backup history.

## Testing

- Unit tests (vitest): `adminAuth`, `apiClient`, `taxonomy`, `templatePresentation`, `troubleshoot`. Last recorded run (2026-09-30, on a clean Linux install): 47 of 47 passed and `next build` succeeded for all 19 routes at that time; not re-run for this update.
- CI: `.github/workflows/tests.yml` (lint, tests) and `.github/workflows/security.yml` (`npm audit --omit=dev --audit-level=high`, non-blocking while findings on next, postcss and sharp are open; gitleaks secret scan; weekly schedule).
- OPEN: automated browser tests for this panel. Backend tests for the audit hook, system status and evidence export are in `paperly-mvp/backend/tests`.

## Deployment

Currently run locally by the admin against the Railway backend through the proxy (`docs/admin-gateway-setup.md`). If hosted, set the same three server variables in the hosting project, add this panel's origin to the backend `CORS_ORIGINS`, and put an access wall in front of it.

## Known limitations

- OPEN: admin 2FA and step-up; scheduled and off-site backups; support priority, owner and callback fields; role-specific home pages; automated alerts that message the owner (uptime or error-burst alert is a hosting task); automated browser tests; Content-Security-Policy on this app; archive and pre-production reset controls (specified in `docs/launch-checklist.md`, not built).
- OPEN: dependency advisories (next, postcss, sharp).
- OWNER: WAF or CDN rules, production CORS origin list, live Razorpay keys, SMTP and SMS providers, secret rotation, the ZTNA hosting setting.
- Route naming (`/users` is the Admin Team page, `/teachers` is Users) is cosmetic debt.
