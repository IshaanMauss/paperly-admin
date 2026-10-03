# Paperly Admin Panel System Architecture

Date: 2026-10-03

This record describes the admin frontend as it exists in code. It is a control-plane map: how the panel is structured, how it reaches the backend, what operational workflows it exposes, and which risks matter before changing it.

## Architectural Style

The admin panel is a Next.js Pages Router application. It is separate from the teacher product surface and acts as an operational control plane for the same backend.

The architecture is a protected frontend control plane:

- Pages under `src/pages` expose each admin function.
- `src/components/AppShell.tsx` gates all private pages through admin session state and renders the sidebar/navigation shell.
- `src/lib/apiClient.ts` centralizes typed backend calls.
- `src/pages/api/gateway/[...path].ts` is the same-origin server-side gateway to the backend.
- `src/lib/server/gatewayProxy.ts` forwards requests while adding the backend gateway secret server-side.
- `src/lib/adminAuth.tsx` and `src/lib/adminToken.ts` manage admin access/refresh state.

The admin panel should never be treated as only a dashboard. It can mutate plan configuration, users, billing, organizations, offers, promo codes, support status, maintenance mode, backups, template state, and test-center execution.

## Runtime Entry Points

- `src/pages/_app.tsx` wraps the app with global providers.
- `src/pages/login.tsx` performs admin sign-in.
- `src/components/AppShell.tsx` enforces signed-in admin state, renders the sidebar, and redirects unsigned access to `/login`.
- `src/pages/api/gateway/[...path].ts` is the backend access boundary used by browser calls.
- `src/pages/index.tsx` is the admin overview.

## Module Map

### Gateway Boundary

`src/pages/api/gateway/[...path].ts`

This route is the permanent backend access pattern for the admin panel. The browser talks to the admin site only. The Next.js server route forwards the request to the backend and adds the gateway secret header.

`src/lib/server/gatewayProxy.ts`

Responsibilities:

- Build target backend URL from path segments and query string.
- Forward safe request headers.
- Add the configured gateway secret header.
- Rewrite `Set-Cookie` headers for the admin frontend.
- Skip response headers that should not be forwarded.

`src/lib/server/cfAccess.ts`

Provides Cloudflare Access JWT verification helpers where that hosting layer is used.

### Admin Auth

`src/lib/adminAuth.tsx`

Responsibilities:

- Login, refresh, logout, and current-admin loading.
- Admin session provider.
- Permission helper exposed to pages.
- Safe error-message parsing.

`src/lib/adminToken.ts`

Responsibilities:

- Store access token.
- Decode expiry.
- Refresh token when close to expiry.
- Clear token on sign-out.

### API Client

`src/lib/apiClient.ts`

This is the main typed interface to the backend. It covers:

- Template list/create/approve/replace/archive/preview/extract.
- Worksheet generation/export URLs.
- Maintenance, overview, system status, audit log, backup history.
- Users, user 360, account actions, quota reset, export/delete on behalf, suspend/unsuspend.
- Organizations, institute entitlements, join codes, member management, organization requests.
- Billing subscriptions, payment events, cancellation, refund.
- Plan configuration drafts, publish, rollback, preview.
- Offers and promo codes.
- Full portion builder overview and subtopic caps.
- Checking overview and checking submissions.
- Variant health and recalculation.
- Security events, server logs, incident evidence.
- Test-center runs, coverage, custom tests, auth outbox/probe, test database seed/wipe.

### App Shell and Navigation

`src/components/AppShell.tsx`

Navigation groups:

- Overview.
- People: Users, User 360, Organizations, Admin Team.
- Revenue: Billing, Plans & Features, Offers, Promo Codes.
- Product: Paper Builders, AI Checking, Variant Health.
- Operations: Support, Maintenance, Backups, Health, Server Logs, Run Tests, Security, Audit Log.

The shell uses admin session readiness to show a splash, redirect unsigned access, and keep private pages behind auth.

### Admin Pages

`src/pages`

- `index.tsx`: overview metrics and entry cards.
- `teachers.tsx`: user list, segments, test flag, account visibility.
- `user-360.tsx`: single-user operational actions, including plan grants, promo force redeem, session reset, quota reset, unsticking generation, email verification, suspend/unsuspend, export/delete on behalf, billing cancel/refund, and export regeneration.
- `users.tsx`: admin team and permission management.
- `organizations.tsx`: organization list, branding, feature flags, institute requests.
- `billing.tsx`: subscriptions and payment events.
- `plans.tsx`: plan config editing, draft, publish, rollback.
- `offers.tsx`: timed offers.
- `promo-codes.tsx`: promo creation, activation, redemptions, export.
- `paper-builders.tsx`: full-portion usage overview and subtopic cap settings.
- `checking.tsx`: AI checking overview/submissions.
- `variant-health.tsx`: template capacity/health recalculation and deprecation actions.
- `support.tsx`: support tickets and admin replies.
- `maintenance.tsx`: maintenance mode and worksheet cleanup.
- `backups.tsx`: backup export/restore dry-run/apply.
- `health.tsx`: product health checks and readiness observations.
- `logs.tsx`: server logs, problem grouping, acknowledge/delete/reset.
- `security.tsx`: security events, RLS status, incident evidence export.
- `audit-log.tsx`: admin action audit trail.
- `run-tests.tsx`: test-center overview, run control, coverage gaps, custom tests, test database seed/wipe, auth probe/outbox.

### Review and Preview Components

`src/components/review/*`, `src/components/preview/*`, `src/components/templates/*`, `src/components/upload/*`

These components support template review, sample display, math-rich preview, upload/extraction, and template-list surfaces. They are shared admin primitives for ingestion and validation work.

## Main Workflows

### Admin Login and Access

1. Admin opens a protected page.
2. `AppShell` checks `useAdminSession`.
3. Unsigned access redirects to `/login?next=...`.
4. Login calls backend admin auth.
5. Access token is stored client-side; refresh cookie is handled by the backend/browser.
6. API calls refresh if the access token is close to expiry or after a 401.

### Gateway API Request

1. Page calls `api.*` from `src/lib/apiClient.ts`.
2. API base defaults to `/api/gateway`.
3. Next.js gateway route receives the browser request.
4. Gateway forwards to `ADMIN_BACKEND_URL`.
5. Gateway secret is added server-side.
6. Backend applies gateway check, admin token check, and permission check.
7. Response cookies and headers are adapted before returning to the browser.

### Plan Configuration

1. Plans page loads current live/draft config.
2. Admin edits sparse plan fields.
3. Draft is saved through `/admin/plan-config/draft`.
4. Preview shows changes against live/default values.
5. Publish requires confirmation phrases.
6. Backend versions the config and locks entitlement snapshots for existing subscribers.
7. Rollback follows the same explicit-confirmation path.

### User 360 Operations

1. Admin resolves or opens a user.
2. Page loads account, subscription, worksheets, usage, support, and events.
3. Each sensitive action requires a reason and calls a dedicated backend endpoint.
4. Backend audit log is the source of accountability.
5. Page reloads or updates local state after action.

### Run Tests

1. Run Tests page loads test-center overview and coverage.
2. Admin can run one test, selected tests, a section, or all tests.
3. Backend creates a test run and returns a run id.
4. Frontend polls run status.
5. Failures show expected/actual values, file/function context, and plain-language impact where available.
6. Custom route/function checks can be added and removed.
7. Test database seed/wipe actions are separated from production data through backend guard logic.

### Backup and Restore

1. Backup page can export JSON/XLSX backup files.
2. Restore requires uploading a backup file.
3. Dry-run runs first and returns table-level would-insert/skipped counts.
4. Apply restore requires confirmation and backend validation.

## Frontend Data Model

The admin panel owns typed frontend contracts, not durable storage:

- `AdminAuthAccountRow`, admin metadata, permissions, and session state.
- `AdminTeacherRow`, user resolve hits, and User 360 aggregate data.
- `OrganizationRow`, organization requests, institute config, members, join code, branding, and feature flags.
- `AdminSubscriptionRow`, `AdminPaymentEventRow`, offers, promo codes, redemptions, and plan config versions.
- `TemplateSummary`, `PreviewResponse`, draft/extraction response, variant health rows.
- `AdminServerLogRow`, security events, audit rows, RLS status, system status.
- `TestCenterOverview`, `TestCoverage`, `TestRunRecord`, auth outbox/probe, and test database status.

The backend remains the source of truth for permissions, action authorization, data writes, audit logs, and destructive-action enforcement.

## Integration Boundaries

- Browser to admin frontend: same-origin.
- Admin frontend to backend: server-side gateway route.
- Backend gateway secret: never sent from browser code.
- Backend admin RBAC: final enforcement layer.
- Cloudflare Access or equivalent perimeter: optional hosting layer, not proven by frontend code alone.
- Test database and production database separation is enforced by backend/database guard checks, not by the frontend.

## Known Risks

### Control-Plane Blast Radius

The admin panel can change production-critical state. A visually small page change can expose or trigger high-impact actions. Permission checks and backend confirmations must stay intact.

### Gateway Misconfiguration Risk

If `NEXT_PUBLIC_API_BASE_URL`, `ADMIN_BACKEND_URL`, or the gateway secret are wrong, login and admin API calls can fail or bypass the intended same-origin path. Browser code must not receive the gateway secret.

### Permission Drift Risk

Navigation visibility and page buttons are helpful, but backend permissions must be authoritative. Every new admin action needs a backend permission dependency and audit entry.

### Restore/Backup Risk

Backup restore is inherently dangerous. Dry-run evidence, confirmation wording, row-level summaries, and audit logs must remain clear and mandatory.

### Test-Center Data Risk

Test-center seed/wipe and auth probe actions must remain scoped to the proper test environment. The panel can initiate them, but database guards and backend checks must prevent real/test data mixing.

### Plan Editing Risk

Plan edits affect revenue, access, and entitlement promises. The sparse-draft model is powerful but must keep previews, changes, price confirmation, publish, rollback, and subscriber lock-in visible.

### Math/Template Review Risk

Admin previews are useful but cannot replace generated QP/MS/PDF verification. Template approval should be blocked by backend validation, leak scans, capacity checks, and anchor tests where possible.

## Change Standard

For admin-panel changes:

- Keep backend calls centralized in `apiClient.ts`.
- Keep browser traffic behind `/api/gateway`.
- Never expose secrets or backend-only URLs in client-visible code.
- Add permission-aware UI only after confirming backend enforcement exists.
- Treat destructive operations as confirmation-plus-audit workflows.
- Verify mobile/tablet layouts only after preserving control-plane safety.
- When adding a new backend operation, update the sidebar/page map only after the backend route, permission, audit behavior, and error wording are clear.
