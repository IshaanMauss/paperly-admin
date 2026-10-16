# Admin pages, backend routes and permission keys

Last updated: 2026-10-13. Verified from `src/pages`, `src/lib/apiClient.ts` and `src/components/AppShell.tsx` in this repo, and from the route modules `admin*.py` under `paperly-mvp/backend/app/api/routes` (guards written as `_require_admin_permission("<key>")`). All routes are under `/api/admin` except where stated; the browser reaches the routes through `/api/gateway`.

## How permissions work

- Roles and the default permission sets of each are in `paperly-mvp/backend/app/services/admin_auth.py` (`ROLE_PERMISSIONS`). `owner` has `*` (everything) and cannot be limited. A non-owner account with a custom permission list uses exactly that list; otherwise the account gets the defaults of the role. Changes apply to new checks immediately.
- Defaults: admin = read keys (admin, users, billing, organizations, support, logs, security, maintenance, backups, promo, templates); security = admin.read, security.read/write, maintenance.read/write, users.read, logs.read/write, organizations.read/write; finance = admin.read, billing.read/write, backups.read, promo.read/write; support = admin.read, support.read/write, users.read, organizations.read/write; viewer = admin.read, health.read; template_manager, reviewer and uploader are template roles (not enforced on the ingestion dashboard yet). Keys that no role default includes, so owner-only unless ticked per account: `plans.read`, `plans.write`, `backups.write`, `accounts.read`, `accounts.write`, `users.write`, `billing.refund`.
- Roles an owner can assign from Admin Team: owner, admin, reviewer, uploader, viewer; permissions can be ticked per account from the list of 25 keys the backend enforces.
- `security.write` (needed to run Run Tests write checks and manage the test database) is not in the tickable list: the key comes only from the `security` role defaults or the owner role.
- The sidebar shows every page to every signed-in admin. A page the account cannot read gets a 403 from the backend; only Users, Organizations, Paper Builders and Admin Team also hide or disable controls in the UI with `hasPermission(...)`. The backend check is the real gate. Denied attempts are logged as security events.
- Every write (POST, PUT, PATCH, DELETE) is recorded in the Audit Log automatically.

## Pages

| Page (nav label, file) | Backend routes used | Permission key |
|---|---|---|
| Sign in (`login.tsx`) | `POST /admin/auth/login`, `/refresh`, `/logout`, `GET /me`, `POST /change-password` | none (the sign-in route); lockout after repeated failures |
| Overview (`index.tsx`) | `GET /overview` | `admin.read` |
| Users (`teachers.tsx`, includes the "Paused and banned accounts" and "Needs review" cards, `DeviceFlagsCard`) | `GET /teachers`; `GET /users/flags` (accounts paused for device changes, accounts with an active ban, and open review signals); `POST /users/signals/{id}/dismiss`; `PATCH /teachers/{id}/test-flag` | `users.read`; `users.write` |
| User 360 (`user-360.tsx`, tabs: Summary with dispute checklist, Payments, Papers, Sign-in, Messages & tickets, Timeline, Fix account; the Sign-in tab shows device_state, devices (with accounts_on_device), bans and device_events; panels in `components/user360/EvidencePanels.tsx`) | `GET /users/resolve`, `GET /users/{id}/three-sixty`, `GET /teachers/{id}/export` | `users.read` |
| | `POST /users/{id}/grant-plan`, `/session/reset`, `/verify-email`; `POST /teachers/{id}/suspend`, `/unsuspend`, `/delete` | `users.write` |
| | Fix-tab device and ban actions: `POST /users/{id}/devices/unpause` (restarts the device-change count), `POST /users/{id}/devices/reset` (clears registered devices), `POST /teachers/{id}/ban` and `/unban` (reason of at least 8 characters, written to the admin action log) | `users.write` |
| | `POST /users/{id}/quota/reset`, `/generation/unstick`; `POST /worksheets/{id}/regenerate-export` | `maintenance.write` |
| Messaging (`messaging.tsx`, tabs: Send, History, Emails, Templates; reach estimate before sending; send now or schedule; audiences all, plans, new or old users, particular users, an institute; `?user=<email or id>` prefills a single-user audience, linked from User 360 as "Message this user"; History has a sent and an automatic scope and a cancel for scheduled messages) | `GET /notifications` (history, `scope` sent or automatic), `GET /notifications/{id}`, `POST /notifications/estimate`, `POST /notifications` (create), `POST /notifications/{id}/cancel`, `GET /notifications/emails/log` (`source` admin or system), `GET/POST/PUT/DELETE /notifications/templates` | `users.read` for reads, `users.write` for send, cancel and template changes |
| | `POST /notifications` (send now or schedule), `POST /notifications/{id}/cancel`, `POST/PUT/DELETE /notifications/templates` | `users.write` |
| | `POST /users/{id}/promo/force-redeem`; `GET /promo-codes` (code picker) | `promo.write`; `promo.read` |
| | `POST /teachers/{id}/billing/cancel` | `billing.write` |
| | `POST /teachers/{id}/billing/refund` (Refund card; real money, once per payment) | `billing.refund` |
| | `POST /teachers/{id}/billing/simulate` (test accounts only) | owner role checked in the handler, no permission key |
| Organizations (`organizations.tsx`, `InstituteSetup.tsx`) | `GET /organizations/meta`, `GET /organizations`, `GET /organizations/{id}/entitlements`, `GET /organization-requests` | `organizations.read` |
| | `PATCH /organizations/{id}`, `PUT /organizations/{id}/entitlements`, `POST /organizations/{id}/join-code`, `POST` and `PATCH` `/organizations/{id}/members`, `POST /organization-requests/{id}/approve`, `/reject`, `/deliver` | `organizations.write` |
| Admin Team (`users.tsx`) | `GET /auth/accounts`, `GET /auth/accounts/meta` | `accounts.read` |
| | `POST /auth/accounts`, `PATCH /auth/accounts/{id}` | `accounts.write` |
| Billing (`billing.tsx`) | `GET /billing/subscriptions`, `GET /billing/payment-events` | `billing.read` |
| Payments (`payments.tsx`) | `GET /payments` (status all, paid, not completed, failed; search; summary) | `billing.read` |
| Plans & Features (`plans.tsx`) | `GET /plan-config`, `GET /plan-config/preview` | `plans.read` |
| | `PUT` and `DELETE /plan-config/draft`, `POST /plan-config/publish`, `POST /plan-config/rollback` | `plans.write` |
| Offers (`offers.tsx`) | `GET /offers` | `promo.read` |
| | `POST /offers`, `PATCH /offers/{id}/active` | `promo.write` |
| Promo Codes (`promo-codes.tsx`) | `GET /promo-codes`, `/promo-codes/{id}/redemptions`, `/promo-codes/export` | `promo.read` |
| | `POST /promo-codes`, `PATCH /promo-codes/{id}/active` | `promo.write` |
| Paper Builders (`paper-builders.tsx`; `/full-portion` redirects here) | `GET /full-portion/overview` | `admin.read` |
| | `GET /full-portion/subtopic-cap-settings`; `POST` the same path | `billing.read`; `billing.write` |
| AI Checking (`checking.tsx`) | `GET /checking/overview`, `/checking/submissions`, `/checking/submissions/{id}`, `GET /worksheets/{id}` | `admin.read` |
| Variant Health (`variant-health.tsx`) | `GET /templates/variant-health` | `admin.read` |
| Question Memory (`question-memory.tsx`) | `GET /admin/memory/overview`, `/templates`, `/supply`, `/events`, `/users/{id}`; `POST /users/{id}/reset`, `PUT /users/{id}/settings` | `memory.read`; writes need `memory.write` |
| | `PATCH /api/templates/{id}/admin-state` (templates router, not under `/admin`) | `templates.write` |
| Support (`support.tsx`) | `GET /support-tickets` | `support.read` |
| | `PATCH /support-tickets/{id}/resolve` | `support.write` |
| Maintenance (`maintenance.tsx`) | `GET /maintenance` | `maintenance.read` |
| | `POST /maintenance`, `POST /worksheets/cleanup` | `maintenance.write` |
| Backups (`backups.tsx`): Export data (xlsx, optional `date_from` and `date_to`) and Download backup (json) | `POST /backups/export?format=xlsx\|json`, `GET /backups/history` | `backups.read` |
| Database (`database.tsx`, owner only; menu item hidden for other roles): Production / Test buttons; Overview, Tables and schema, SQL console, History | `GET /admin/database/targets`, `/history`, `/{target}/overview`, `/{target}/tables`, `/{target}/tables/{table}`, `/{target}/tables/{table}/rows`; `POST /admin/database/{target}/sql/review` and `/sql/run` | `owner` role (checked on the server), password re-entry for any change |
| Architecture (`architecture.tsx`, owner only; menu item hidden for other roles): 88 diagrams (data flow levels 0 to 3, C4, sequences, database, state machines, flows, deployment, security) for all three repositories | none (diagrams are bundled with the panel, no backend route) | `owner` role checked in the page |
| | `POST /backups/restore` (dry run and real) | `backups.write` |
| Health (`health.tsx`, `SystemStatusPanel.tsx`) | `GET /system-status` | `admin.read` |
| | `GET /server-logs/summary`; `GET /api/templates` (catalog stats only) | `logs.read`; public templates list |
| Server Logs (`logs.tsx`) | `GET /server-logs` | `logs.read` |
| | `POST /server-logs/{id}/acknowledge`, `DELETE /server-logs/{id}`, `DELETE /server-logs` | `logs.write` |
| Run Tests (`run-tests.tsx`, `SignInCodesPanel.tsx`) | `GET /test-center`, `/coverage`, `/run/{id}`, `/test-db`, `/auth-status`, `/auth-outbox` (all under `/admin/test-center`) | `security.read` |
| | `POST /test-center/run`, `/custom`, `/test-db/seed`, `/test-db/wipe`, `/auth-probe`; `DELETE /test-center/custom/{id}` | `security.write` |
| Security (`security.tsx`) | `GET /security-events`, `POST /security-events/export-evidence`, `GET /security/rls-status` | `security.read` |
| Audit Log (`audit-log.tsx`) | `GET /audit-log` | `security.read` |

## Not found in code

- No route that sets a security event's status (resolved, false positive); the Security page only filters on statuses the events already carry.
- No admin route for support priority, owner or callback fields.
- Roles `reviewer` and `uploader` are defined but not enforced anywhere yet.
