# Paperly Admin Panel DFDs

## Current state (2026-10-03)

Status: DONE for Levels 0, 1 and 2 below; checked against `src/pages`, `src/lib`, `src/components` and `src/pages/api/gateway/[...path].ts`. Permission decisions, automatic audit of write routes, login lockout and the strict API CSP are backend behaviour in `paperly-mvp` and are NOT CHECKABLE from this repo; the diagrams show them as the boundary this panel calls.

Rule: admin sessions and actions stay isolated from teacher sessions (admin tokens carry audience `paperly-admin`). The panel monitors and controls the platform; it does not own template ingestion or teacher paper building.

### Level 0 - context

```mermaid
flowchart LR
  admin["Owner or admin staff"]
  cf["Cloudflare Access - optional login wall"]
  app(("Paperly admin panel - Next.js app plus gateway proxy"))
  be["Paperly backend - FastAPI /api/admin/*"]
  rz["Razorpay - refunds, via backend"]
  fs["Local files - backup JSON, evidence download"]

  admin -->|"sign in, review, act"| cf
  cf -->|"Cf-Access-Jwt-Assertion"| app
  app -->|"dashboards, audit, status"| admin
  app -->|"/api/gateway/* with gateway secret added server-side"| be
  be -->|"admin data and results"| app
  be -.->|"refund request"| rz
  admin <-->|"save export, choose file to restore"| fs
```

- The browser only talks to the admin site. The server route `src/pages/api/gateway/[...path].ts` verifies the Cloudflare Access token when `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are set, adds the gateway secret header from a server-only variable, strips client-sent `x-ztna-*`, `cf-*` and forwarded headers, and forwards to `ADMIN_BACKEND_URL`. Setup is in `docs/admin-gateway-setup.md`.
- Refunds reach Razorpay through the backend only; this panel never talks to Razorpay (the backend side is NOT CHECKABLE here).

### Level 1 - processes and data stores

```mermaid
flowchart TD
  admin["Admin"] --> P1["P1 Sign-in and session - login.tsx, adminAuth, adminToken"]
  admin --> P2["P2 People - teachers, users, user-360, organizations, admin team"]
  admin --> P3["P3 Money and plans - billing, plans, offers, promo-codes, paper-builders"]
  admin --> P4["P4 Product health - checking, full-portion, variant-health"]
  admin --> P5["P5 Operations - support, maintenance, backups, logs, run-tests"]
  admin --> P6["P6 Safety and status - security, audit-log, health"]

  P1 <--> D1[("D1 Access token - memory plus tab sessionStorage")]
  P1 <--> D2[("D2 Refresh cookie - HttpOnly, set by backend")]
  P2 & P3 & P4 & P5 & P6 --> CL["apiClient - bearer token, refresh on 401"]
  CL --> GW["Gateway proxy /api/gateway/*"]
  GW --> BE["Backend admin routes"]
  BE --> DB[("Paperly database")]
  BE --> AUD[("Admin audit log and security events")]
```

Pages in `src/pages` and the sections in the sidebar (`AppShell.tsx`): Overview, Users, User 360, Organizations, Admin Team, Billing, Plans and Features, Offers, Promo Codes, Paper Builders, AI Checking, Variant Health, Support, Maintenance, Backups, Health, Server Logs, Run Tests, Security, Audit Log. Write controls are hidden or disabled by `hasPermission(...)` where the page checks it (for example `organizations.write`, `billing.write`, `users.write`); the backend remains the authority.

### Level 2 - key flows

#### 2.1 Gateway sign-in, session and permissions

```mermaid
sequenceDiagram
  participant A as Admin
  participant B as Browser app
  participant G as Gateway proxy
  participant API as Backend /admin
  A->>B: open admin site
  B->>G: request with Cloudflare Access cookie
  G->>G: verify Cf-Access-Jwt-Assertion if configured, else refuse
  B->>G: POST /admin/auth/login with email and password
  G->>API: forward with gateway secret header
  API->>API: gateway secret, credentials, role, lockout check
  API-->>B: access token plus admin role and permissions, refresh cookie
  B->>B: keep token in memory and tab sessionStorage
  Note over B,API: on page load - reuse token if not expiring and GET /admin/auth/me, else POST /admin/auth/refresh
  B->>API: later calls with Bearer token
  API-->>B: 403 and security event when permission is missing
  B->>API: on 401 one shared refresh, then retry once
```

The login form shows backend error text only when it is plain text; HTML or traceback bodies fall back to a generic message.

#### 2.2 Audited admin writes

```mermaid
flowchart TD
  UI["Admin action - suspend, grant plan, cancel, refund, offer, plan publish, promo, org edit, maintenance, restore"] --> C["Confirm in UI - typed text or reason where required"]
  C --> API["Backend admin write route"]
  API --> Z{"Permission present?"}
  Z -- no --> D["403 plus admin_permission_denied security event"]
  Z -- yes --> W["Apply change in database"]
  W --> AU[("Audit log entry written by the backend")]
  AU --> V["Audit Log page - GET /admin/audit-log by days, admin, failed only"]
```

The panel reads the audit trail (`audit-log.tsx`); that every write route is audited automatically is backend behaviour and NOT CHECKABLE from this repo.

#### 2.3 Refund

```mermaid
flowchart TD
  U["User 360 page - Refund card"] --> F["Reason, optional amount in rupees, cancel plan toggle"]
  F --> R["POST /admin/teachers/{id}/billing/refund"]
  R --> B{"Backend: permission and payment found"}
  B -- no --> E["Error shown on the card"]
  B -- yes --> P["Refund created with the payment provider"]
  P --> S["Response - refund id, amount, status, plan_cancelled"]
  S --> UI["Success message on the card"]
  P --> AU[("Audit entry")]
```

#### 2.4 Backup and restore

```mermaid
flowchart TD
  H["Backups page loads GET /admin/backups/history"] --> W{"stale flag"}
  W -- stale --> WARN["Stale backup warning"]
  W -- fresh --> OKB["Last export time and count"]
  X["Export backup"] --> DL["JSON file saved on the admin computer"]
  RF["Choose backup JSON file"] --> DRY["POST /admin/backups/restore with dry_run true"]
  DRY --> PV["Per-table preview - in backup, would insert, skipped"]
  PV --> T["Type RESTORE PAPERLY-NT DATABASE FROM BACKUP exactly"]
  T --> REAL["POST /admin/backups/restore with dry_run false and confirmation"]
  REAL --> RES["Per-table inserted counts"]
```

Not built, as stated on `health.tsx`: two-factor sign-in and re-asking for the password before backups, restores and maintenance. Maintenance writes use a typed confirmation as well.

#### 2.5 Security events and evidence

```mermaid
flowchart TD
  S["security.tsx - GET /admin/security-events"] --> L["Event list"]
  S --> RLS["GET /admin/security/rls-status - live database row-level-security status"]
  L --> EV["Export evidence button on an event"]
  EV --> X["POST /admin/security-events/export-evidence for that user, 72 hour window"]
  X --> F["Evidence file downloaded by the browser"]
```

#### 2.6 System status

```mermaid
flowchart TD
  H["health.tsx and SystemStatusPanel"] --> Q["GET /admin/system-status"]
  Q --> G["Groups of items - state ok, warn, down or unknown, detail, suggested action"]
  G --> UI["Live status cards"]
  H --> T["Static launch-readiness notes on the same page"]
  RT["run-tests.tsx"] --> TC["/admin/test-center - run checks, test database seed and wipe, sign-in code outbox"]
```

### Diagram files

The inline diagrams above are the current reference. Files kept in this folder:

- `admin-control-panel-level1-flow.mmd` - OLDER Level 1 view (2026-08): lists seven sections only and predates audit log, health, run tests, plans, offers, organizations and the gateway proxy. Superseded by Level 1 above.
- `admin-security-rbac-level2-flow.mmd` - still accurate for token validation, role permission gating and denied-attempt logging; the "step-up auth recommended" branch is not built. See 2.1.
- `admin-panel-feature-coverage-gap-2026-09-05.mmd` - HISTORICAL and obsolete: every gap it listed is closed except template-lifecycle write routes (edit, replace, delete), which still have no caller in this repo (OPEN).

## History

Dated update entries that used to live here are in `docs/project-history.md`.

## Lesson: shared endpoints and per-row work

`health.tsx` calls `GET /templates`, which once ran the full question generator per template on every call (15-38 s for 36 templates, about 1 s after the work became opt-in in the backend). If a list endpoint's time grows with row count, look for hidden per-row work and make expensive expansions opt-in.

## Open items

- OPEN: template-lifecycle write routes (edit, replace, delete) have no caller in this repo.
- OPEN: a Full Portion plan control, if added, must use `max_full_portion_topics` (the subtopic cap was removed).
