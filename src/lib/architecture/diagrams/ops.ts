import type { Diagram } from "../types";

// Deployment, operations and security diagrams.
export const opsDiagrams: Diagram[] = [
  {
    id: "ops-deployment-map",
    title: "Deployment map: where each part runs",
    repo: "system",
    family: "deployment",
    summary: "Hosting for each piece, and which pieces are public and which only run on the owner's computer.",
    source: String.raw`flowchart TD
  subgraph Public[Public internet]
    T[Teacher module on Vercel - www.paperly-nt.com]
    API[Backend on Railway - Docker, uvicorn with 2 workers]
  end
  subgraph Managed[Managed services]
    DB[(Supabase Postgres)]
    ST[(Supabase private bucket - PDFs)]
    RZ[Razorpay]
    LLM[LLM provider]
    EM[Email provider]
    SMS[SMS provider]
    RD[(Redis - optional)]
  end
  subgraph Local[Owner computer only]
    AD[Admin panel]
    DH[Ingestion dashboard]
    TD[Local test database]
  end
  T -->|/api proxy| API
  AD -->|gateway, secret header| API
  DH --> API
  API --> DB
  API --> ST
  API --> RZ
  API --> LLM
  API --> EM
  API --> SMS
  API -.-> RD
  RZ -->|webhook| API
  AD -.-> TD`,
    children: ["ops-request-path", "ops-ci-test-pipeline", "ops-backup-recovery", "ops-config-switches", "ops-generation-scaling"],
    related: ["c4-2-containers", "sec-trust-boundaries"],
    notes: ["The admin panel and the dashboard are not hosted anywhere public. They run on the owner's computer and talk to the live backend through the gateway.", "Redis is optional. Without it, rate limits are counted per server instance instead of across both workers and any future instances.", "The Dockerfile assumes Railway's root directory is the backend folder; Railway injects the port."],
    files: ["backend/Dockerfile", "backend/Procfile", "docs/system-architecture.md", "docs/security-and-deployment.md"],
  },
  {
    id: "ops-request-path",
    title: "Deployment: the path of one request",
    repo: "system",
    family: "deployment",
    summary: "From a teacher's click to a database row and back, with the layers that can stop it.",
    source: String.raw`flowchart TD
  B[Browser] --> V[Vercel serves the page and runs the /api proxy]
  V --> MW[Backend middleware: rate limit, CORS, security headers, request log]
  MW --> GS{Admin path?}
  GS -->|yes| GK[Gateway secret header must match]
  GS -->|no| AU
  GK --> AU[Route dependency: verify the access token, load the account]
  AU --> RLS[Teacher routes: switch the transaction to the RLS role and set app.teacher_id]
  RLS --> ENT[Plan and quota checks, idempotency key]
  ENT --> SV[Service code]
  SV --> DBQ[(Postgres)]
  SV --> AUD[Admin writes: audit hook records the call]
  SV --> R[JSON response]
  R --> B`,
    related: ["sec-rls-enforcement", "sec-token-lifecycle", "sec-rate-limits", "dfd-3-token-and-rls"],
    notes: ["The middleware list is what main.py registers: SlowAPI rate limiting, CORS, a timing log, the gateway-secret check for /api/admin paths, security headers (CSP) and the server activity log.", "The identity is known before the database is touched, and the database then enforces teacher-level isolation by itself.", "Generation is slot limited so one slow paper cannot starve every other request (see the scaling diagram)."],
    files: ["backend/app/main.py", "backend/app/core/rate_limit.py", "backend/app/services/teacher_auth.py", "backend/app/services/admin_audit.py"],
  },
  {
    id: "ops-ci-test-pipeline",
    title: "Deployment: tests and checks before and after a change",
    repo: "system",
    family: "deployment",
    summary: "Automatic checks on every push, and the owner-run checks in the admin panel.",
    source: String.raw`flowchart TD
  C[Commit and push] --> GH[GitHub Actions]
  GH --> T1[tests.yml: pytest on the backend, Python 3.11]
  GH --> T2[security.yml: pip-audit, gitleaks, npm audit]
  C --> V[Vercel builds the teacher module]
  C --> RW[Railway builds the Docker image]
  RW --> LIVE[Live backend]
  LIVE --> RT[Admin panel Run Tests: read checks on production]
  LOCAL[Local test database] --> WT[Write checks only here]
  RT --> HIST[Results history]
  WT --> HIST`,
    related: ["ops-deployment-map", "ops-backup-recovery"],
    notes: ["Write tests are refused unless the database host is local, and database triggers reject test fingerprints on production, so test data cannot reach the live database.", "Known limit: the guards inspect identity columns only; test data hidden inside JSON or free text is not detected."],
    files: ["paperly-mvp/.github/workflows/tests.yml", "paperly-mvp/.github/workflows/security.yml", "backend/app/services/test_center.py", "backend/app/services/test_guard.py"],
  },
  {
    id: "ops-backup-recovery",
    title: "Operations: backup and restore",
    repo: "backend",
    family: "deployment",
    summary: "What an export contains, what it deliberately leaves out, and how a restore is checked before it changes anything.",
    source: String.raw`flowchart TD
  A[Owner: Export and Backup] --> B[POST backups/export]
  B --> C[Read every table except the excluded ones]
  C --> D[JSON file download, audited]
  E[Restore] --> F[Upload the file]
  F --> G[Dry run: count what would change]
  G --> H{Looks right?}
  H -->|no| X[Stop]
  H -->|yes| I[Restore for real, audited]
  subgraph Never exported
    N1[Password hashes] --- N2[Refresh sessions] --- N3[Sign-in codes] --- N4[Message outbox]
  end`,
    related: ["dfd-2-backup-restore", "dfd-3-backup-internals", "dfd-2-retention"],
    notes: ["Excluded on purpose: teacher and admin auth accounts, both refresh-session tables, email and phone codes, and the message outbox.", "A leaked backup still contains personal data such as names and emails, so the file must be handled like production data.", "Restore has a dry-run mode that reports without writing."],
    files: ["backend/app/services/admin_backup_export.py", "backend/app/api/routes/admin_operations.py", "admin-panel/src/pages/backups.tsx"],
  },
  {
    id: "ops-config-switches",
    title: "Operations: switches that change behaviour",
    repo: "backend",
    family: "deployment",
    summary: "The settings that decide which features and protections are live, grouped by where they are changed.",
    source: String.raw`flowchart LR
  subgraph Env[Environment variables on Railway or Vercel]
    E1[DATABASE_URL, PDF_STORAGE_*]
    E2[ZTNA_GATEWAY_SECRET - gateway secret]
    E3[REDIS_URL - shared rate limits]
    E4[SMS_PROVIDER - mock or msg91]
    E5[CSP_MODE - report or enforce]
    E6[CORS list]
    E7[BACKEND_PROXY_TARGET on Vercel]
    E8[ADMIN_BACKEND_URL, CF_ACCESS_* on the admin panel]
  end
  subgraph Admin[Changed live in the admin panel]
    A1[Maintenance mode - platform_settings]
    A2[Plan config version - prices and limits]
    A3[Offers and promo codes]
    A4[Per-account permissions]
  end
  Env --> RESTART[Needs a redeploy or restart]
  Admin --> NOW[Takes effect on the next request]`,
    related: ["state-plan-config", "ops-deployment-map", "er-admin-platform"],
    notes: ["Anything in the admin group is stored in the database, so it needs no deploy and leaves an audit entry.", "System status in the admin panel reports whether each setting is set as yes or no only, never the secret itself."],
    files: ["backend/app/core/config.py", "backend/.env.example", "backend/app/services/system_status.py", "admin-panel/docs/admin-gateway-setup.md"],
  },
  {
    id: "ops-generation-scaling",
    title: "Operations: how generation stays fast under load",
    repo: "backend",
    family: "deployment",
    summary: "Capacity limits that protect the server when many teachers press Generate at the same time.",
    source: String.raw`flowchart TD
  A[Generate requests arrive] --> B[Rate limit per IP and route]
  B --> C[Idempotency: a repeated key returns the first result]
  C --> Q[Quota reserved]
  Q --> D{Free generation slot after a short wait?}
  D -->|yes| E[Variant engine builds the paper]
  D -->|no| F[503 busy message, reserved quota given back]
  E --> H[Response with the paper]
  H --> I[PDF rendered when the file is asked for]`,
    related: ["ops-deployment-map", "dfd-3-variant-engine", "dfd-3-quota-idempotency", "sec-rate-limits"],
    notes: ["Two uvicorn workers run the app. Each worker has its own generation slots, and its own pool of 100 threads for ordinary routes (sync_threadpool_size).", "When no slot frees up in time the teacher sees a plain busy message, nothing is taken from their quota, and they can try again.", "The load check in Run Tests sends 8 parallel requests and expects the slowest 5 percent under 2 seconds; a quota race test sends 20 at once for one account and must not exceed the allowance."],
    files: ["backend/app/core/config.py", "backend/app/api/routes/worksheet_common.py", "backend/app/main.py", "backend/app/services/test_center_phase3.py"],
  },
  {
    id: "sec-trust-boundaries",
    title: "Security: trust boundaries",
    repo: "system",
    family: "security",
    summary: "Where untrusted input enters, and the control placed at each boundary.",
    source: String.raw`flowchart LR
  subgraph Untrusted
    U1[Teacher browser]
    U2[Student answer uploads]
    U3[Payment webhooks]
    U4[Screenshots from template authors]
  end
  subgraph Edge[Edge controls]
    C1[CSP, CORS, rate limits]
    C2[Turnstile on sign-up, forgot password, phone code]
    C3[Razorpay signature check]
    C4[Gateway secret and Cloudflare Access]
  end
  subgraph Core[Backend]
    K1[Access token check]
    K2[RLS role per teacher]
    K3[Plan and quota checks]
    K4[Admin permission check]
  end
  subgraph Data
    D1[(Postgres with guard triggers)]
    D2[(Private bucket)]
  end
  U1 --> C1 --> K1
  U1 --> C2
  U2 --> C1
  U3 --> C3 --> K3
  U4 --> C4 --> K4
  K1 --> K2 --> D1
  K3 --> D1
  K4 --> D1
  K1 --> D2`,
    children: ["sec-token-lifecycle", "sec-rls-enforcement", "sec-admin-rbac", "sec-rate-limits"],
    related: ["ops-deployment-map", "c4-1-context"],
    notes: ["Open in code today, from the project notes: two-factor sign-in, step-up prompts, a complete review of request size and upload limits, and moving the frontend CSP from report-only to enforce.", "Owner hosting tasks: a WAF in front of the API, Cloudflare Access for the admin panel, a production CORS list and REDIS_URL."],
    files: ["docs/security-and-deployment.md", "backend/app/main.py"],
  },
  {
    id: "sec-token-lifecycle",
    title: "Security: sign-in tokens from issue to revoke",
    repo: "backend",
    family: "security",
    summary: "Access and refresh tokens for teachers and admins, how long each lives, and every way a session can end.",
    source: String.raw`flowchart TD
  L[Sign in succeeds] --> A[Access token: 15 minutes, in browser memory or tab storage]
  L --> R[Refresh token: cookie, hashed in the database]
  A -->|expires or 401| RF[Refresh call with the cookie]
  RF --> V{Hash found, not revoked, not expired, token_version matches?}
  V -->|yes| ROT[Rotate: new refresh token, old one marked rotated]
  ROT --> A
  V -->|no| DEAD[Reject: signed out]
  R -.->|teacher 7 days, admin 14 days| EXP[Expires]
  OUT[Sign out] --> REV[Revoke the session row]
  ALL[Sign out everywhere or password reset] --> BUMP[token_version + 1: every token and session invalid]
  LOCK[Failed attempts: teacher 8, admin 5 in 15 minutes] --> LK[Account locked before the password is checked]`,
    related: ["seq-token-refresh", "state-auth-session-client", "admin-session-lifecycle", "er-teachers-auth", "dfd-3-token-and-rls"],
    notes: ["The refresh token is stored only as a hash, and each use rotates it; rotated_from_id links the chain so reuse can be traced.", "Teachers keep the access token in memory only. The admin panel keeps it in sessionStorage for the tab.", "The lock is checked before the password, so a locked account cannot be used to guess passwords."],
    files: ["backend/app/services/auth_tokens.py", "backend/app/services/teacher_auth.py", "backend/app/services/admin_auth.py", "backend/app/services/login_lockout.py"],
  },
  {
    id: "sec-rls-enforcement",
    title: "Security: row level security for teachers",
    repo: "backend",
    family: "security",
    summary: "How the database itself stops one teacher from reading another's rows, even if the application code had a bug.",
    source: String.raw`flowchart TD
  A[Request with a valid teacher token] --> B[Open a transaction]
  B --> C[set_config app.teacher_id = this teacher, local to the transaction]
  C --> D[SET LOCAL ROLE paperly_teacher_runtime]
  D --> E[Queries run]
  E --> F{Table has a policy for this role?}
  F -->|yes| G[Only rows where teacher_id = app.teacher_id are visible and writable]
  F -->|no policy| H[No rows: server-side tables such as OTP and outbox]
  G --> I[Commit: role and setting reset automatically]
  H --> I`,
    related: ["er-overview", "dfd-3-token-and-rls", "ops-request-path"],
    notes: ["SET LOCAL lasts only for the transaction, so the role cannot leak to the next request on a pooled connection.", "Server-only tables like the one-time-code and outbox tables have RLS on and no policy for the teacher role.", "The Database area of the admin panel shows whether its own role bypasses RLS and how many tables force RLS for owners."],
    files: ["backend/app/services/teacher_auth.py", "backend/app/services/billing_service.py", "backend/app/services/admin_db_console.py", "docs/project-records/"],
  },
  {
    id: "sec-admin-rbac",
    title: "Security: admin roles and permissions",
    repo: "backend",
    family: "security",
    summary: "How the backend decides whether an admin may do a thing: role defaults, per-account overrides, and the owner exception.",
    source: String.raw`flowchart TD
  A[Admin request with a signed token] --> B[Load the admin account, check active and token_version]
  B --> C{Role is owner?}
  C -->|yes| ALLOW[Allowed: owner has every permission]
  C -->|no| D{Account has its own permission list?}
  D -->|yes| E[Use exactly that list]
  D -->|no| F[Use the role default]
  E --> G{Route's permission in the list?}
  F --> G
  G -->|yes| ALLOW
  G -->|no| DENY[403 and a denied attempt is logged]
  ALLOW --> W{Write request?}
  W -->|yes| AUD[Audit hook records who, what, target, IP, result]
  W -->|no| DONE[Respond]
  AUD --> DONE`,
    related: ["admin-page-map", "dfd-3-audit-write", "dfd-2-admin-audit", "er-admin-platform"],
    notes: ["Roles are owner, admin, security, finance, support, template_manager, reviewer, uploader and viewer; 25 permission keys are checked by real routes.", "Refunds need billing.refund, which no role preset includes except owner. Managing other admin accounts needs accounts.read and accounts.write, also owner only by default.", "The Database area is stricter than permissions: it requires the owner role itself."],
    files: ["backend/app/services/admin_auth.py", "backend/app/api/routes/admin_database.py", "backend/app/services/admin_audit.py", "admin-panel/docs/admin-pages-and-permissions.md"],
  },
  {
    id: "sec-rate-limits",
    title: "Security: rate limits and lockouts",
    repo: "backend",
    family: "security",
    summary: "The numbers that slow down abuse, per route and per account.",
    source: String.raw`flowchart TD
  R[Incoming request] --> K{Route family}
  K -->|topical generate| L1[20 per minute]
  K -->|export| L2[30 per minute]
  K -->|AI check| L3[15 per minute]
  K -->|phone code request| L4[8 per hour]
  K -->|phone code verify| L5[20 per hour]
  K -->|sign in| L6[Account lock: teacher 8, admin 5 failures in 15 minutes]
  L1 --> S{Redis set?}
  L2 --> S
  L3 --> S
  L4 --> S
  L5 --> S
  S -->|yes| SH[Counted across all instances]
  S -->|no| PI[Counted inside each worker only]
  SH --> X[Over the limit: 429 with Retry-After]
  PI --> X`,
    related: ["sec-trust-boundaries", "ops-generation-scaling", "dfd-3-phone-otp"],
    notes: ["Phone code requests answer identically for known and unknown numbers, so the route cannot reveal which numbers have accounts.", "Without Redis each of the two workers counts separately, so the real limit is roughly doubled."],
    files: ["backend/app/core/rate_limit.py", "backend/app/services/login_lockout.py"],
  },
];
