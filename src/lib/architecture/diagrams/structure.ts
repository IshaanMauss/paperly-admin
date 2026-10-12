import type { Diagram } from "../types";

// System structure (C4 style): context, containers and components.

export const structureDiagrams: Diagram[] = [
  {
    id: "c4-1-context",
    title: "C4 level 1: people and systems",
    repo: "system",
    family: "c4",
    level: 1,
    summary: "Paperly-NT as one system, the people who use it and the outside services it relies on. The same story as DFD level 0, drawn in the C4 style.",
    source: String.raw`flowchart LR
  teacher(["Teacher<br/>builds papers, downloads PDFs, checks answers, buys a plan"])
  member(["Institute teacher<br/>uses a school's plan"])
  owner(["Owner and admins<br/>run the business, support and billing"])
  author(["Template author<br/>adds and approves questions"])

  paperly["Paperly-NT<br/>generates exam-style papers and mark schemes from approved templates"]

  razorpay["Razorpay<br/>payments, webhooks, refunds"]
  llm["Gemini or other LLM<br/>reads and marks answers"]
  supa["Supabase<br/>Postgres and private file storage"]
  resend["Resend<br/>email codes and receipts"]
  msg91["MSG91<br/>SMS codes"]
  google["Google<br/>sign-in and ads"]
  cf["Cloudflare Turnstile<br/>human check"]

  teacher --> paperly
  member --> paperly
  owner --> paperly
  author --> paperly
  paperly --> razorpay
  paperly --> llm
  paperly --> supa
  paperly --> resend
  paperly --> msg91
  paperly --> google
  paperly --> cf`,
    children: ["c4-2-containers"],
    related: ["dfd-0-context"],
    notes: ["Four kinds of person: customers (teachers and institute members) use the public site; the owner and admins use the admin panel; the template author uses the internal dashboard."],
    files: ["docs/system-architecture.md", "docs/architecture.md"],
  },
  {
    id: "c4-2-containers",
    title: "C4 level 2: containers (what runs where)",
    repo: "system",
    family: "c4",
    level: 2,
    summary: "The separately running pieces: three web apps, one API, the database and storage, and which technology each uses.",
    source: String.raw`flowchart TD
  subgraph users["People"]
    t(["Teacher"])
    o(["Owner or admin"])
    a(["Template author"])
  end

  subgraph vercel["Vercel: www.paperly-nt.com"]
    tm["Teacher module<br/>Next.js pages router, React 19, Tailwind<br/>API route proxy /api to the backend"]
  end

  subgraph local["Owner's computer, run with npm"]
    ap["Admin panel<br/>Next.js, port 3002<br/>proxy /api/gateway adds the gateway secret"]
    dash["Template dashboard<br/>Next.js, port 3000<br/>upload, review, approve"]
  end

  subgraph railway["Railway"]
    be["Backend API<br/>FastAPI on uvicorn, 2 workers, Docker python 3.11<br/>SQLAlchemy, Alembic, SymPy, xhtml2pdf"]
    disk[("Local disk generated_pdfs<br/>wiped on redeploy")]
  end

  subgraph supabase["Supabase"]
    pg[("Postgres<br/>row level security, pooler")]
    bucket[("Private Storage bucket<br/>PDF and PNG copies")]
  end

  redis[("Redis, optional<br/>shared rate limit counters")]

  subgraph ext["Outside services"]
    rz["Razorpay"]
    llm["Gemini LLM"]
    rs["Resend"]
    sms["MSG91"]
    gs["Google sign-in and ads"]
    ts["Turnstile"]
  end

  t --> tm
  o --> ap
  a --> dash
  tm -->|"HTTPS JSON, bearer token, refresh cookie"| be
  ap -->|"HTTPS JSON via gateway proxy"| be
  dash -->|"HTTPS JSON via gateway proxy"| be
  be --> pg
  be --> bucket
  be --> disk
  be --> redis
  be --> rz
  be --> llm
  be --> rs
  be --> sms
  be --> gs
  be --> ts
  tm -.->|"loads checkout script, Turnstile, Google"| ext`,
    children: ["c4-3-backend-components", "c4-3-teacher-components", "c4-3-admin-components", "c4-3-engine-components", "c4-3-billing-components", "c4-3-auth-components"],
    related: ["ops-deployment-map", "ops-request-path", "dfd-1-processes"],
    notes: ["Only the teacher module is deployed publicly (Vercel). The admin panel and dashboard currently run on the owner's computer; hosting the admin panel behind Cloudflare Access is a documented option that is not set up.", "The backend runs as a Docker image on Railway with the root directory set to backend. Redis is optional: without REDIS_URL, rate limits fall back to per-process memory.", "Neither frontend talks to Supabase: all data goes through the backend."],
    files: ["backend/Dockerfile", "backend/Procfile", "paperly-mvp/docker-compose.yml", "docs/security-and-deployment.md"],
  },
  {
    id: "c4-3-backend-components",
    title: "C4 level 3: backend layers and modules",
    repo: "backend",
    family: "c4",
    level: 3,
    summary: "Inside the FastAPI backend: the route groups, the service groups behind them, and the shared core and data layer.",
    source: String.raw`flowchart TD
  subgraph edge["Request pipeline in app/main.py"]
    rl["SlowAPI rate limiter: per IP, Redis or memory"]
    cors["CORS allow list"]
    gw["Gateway secret check on /api/admin"]
    sec["Security headers and CSP"]
    log["Server log and admin audit after the response"]
  end

  subgraph routes["api/routes"]
    r1["teacher auth, phone, profile, support"]
    r2["worksheets: topical, single, full portion, exports, checking"]
    r3["billing"]
    r4["templates, preview, extract"]
    r5["admin_*: overview, users, billing, plans, offers, organizations, backups, database, test center, usage"]
  end

  subgraph services["services"]
    s1["Auth: teacher_account_auth, teacher_auth, auth_tokens, login_lockout, sms_provider, email_sender"]
    s2["Generation: worksheet_generator, multipart_generator, full_portion_mix, template_safety, math_guard"]
    s3["Export: pdf_export, pdf_storage, paper_qr"]
    s4["Checking: ai_marking, llm_client, ocr"]
    s5["Billing: billing_service, entitlements, plan_config_service, promo, offers, refunds, ad_gate, invoices"]
    s6["Organizations: organization_requests, seats, rbac, entitlements"]
    s7["Admin: admin_auth, admin_audit, admin_db_console, sql_console_guard, backups, retention, system_status"]
  end

  subgraph core["core and data"]
    cfg["core/config: settings and production checks"]
    sch["schemas: pydantic request and response models"]
    db["db/session: engine, pool, get_db"]
    mod["models: SQLAlchemy tables"]
    mig["alembic: migrations"]
  end

  edge --> routes
  r1 --> s1
  r2 --> s2
  r2 --> s3
  r2 --> s4
  r2 --> s5
  r3 --> s5
  r3 --> s6
  r4 --> s2
  r5 --> s5
  r5 --> s6
  r5 --> s7
  s1 --> mod
  s2 --> mod
  s3 --> mod
  s4 --> mod
  s5 --> mod
  s6 --> mod
  s7 --> mod
  mod --> db
  routes --> sch
  mig -.-> mod
  cfg -.-> services`,
    children: ["c4-3-engine-components", "c4-3-billing-components", "c4-3-auth-components", "c4-3-admin-api-components"],
    related: ["c4-2-containers", "er-overview"],
    notes: ["Routes stay thin: they check who is calling, then call services. Services hold the rules and talk to the models.", "The three generation routes share worksheet_common.py for idempotency, the generation slot and the connection release.", "Production refuses to start without a 32 character session secret, with debug on, with shared admin token fallback on, with dev OTP echo on, or without the gateway secret."],
    files: ["backend/app/main.py", "backend/app/api/routes/", "backend/app/services/", "backend/app/core/config.py"],
  },
  {
    id: "c4-3-engine-components",
    title: "C4 level 3: template and generation engine",
    repo: "backend",
    family: "c4",
    level: 3,
    summary: "The modules that turn a template into a verified variant, and the guards that keep bad ones out.",
    source: String.raw`flowchart LR
  subgraph author["At approval"]
    tg["template_generator: validate_template_draft"]
    tsg["template_schema_guard"]
    ts["template_stats: capacity"]
    mg1["math_guard.audit_template"]
  end
  subgraph gen["At generation"]
    wg["worksheet_generator.generate_question_from_template"]
    vg["variant_generator: sampler and constraint_engine"]
    ver["verification: verify_template_variant and sympy_verifier"]
    mp["multipart_generator"]
    mg2["math_guard.repair_generated_item"]
    mpres["math_presentation"]
    tsafe["template_safety: retire_unsafe_templates"]
    fpm["full_portion_mix: plan_auto_mix"]
    tut["template usage tracking: recent signatures and wordings"]
  end
  rt["Routes: worksheet_topical, worksheet_single, worksheet_full_portion"]
  tpl[("templates table")]

  tg --> tpl
  tsg --> tpl
  mg1 --> tpl
  ts --> tpl
  rt --> tsafe --> tpl
  rt --> fpm
  rt --> wg
  wg --> vg
  wg --> ver
  wg --> mp
  wg --> mg2 --> mpres
  rt --> tut`,
    related: ["dfd-3-variant-engine", "dfd-3-template-approval"],
    notes: ["Approval-time modules and generation-time modules deliberately share the same math guard and verification, so a template cannot pass one and fail the other for the same reason."],
    files: ["backend/app/services/worksheet_generator.py", "backend/app/services/math_guard.py", "backend/app/services/multipart_generator.py", "backend/app/services/full_portion_mix.py"],
  },
  {
    id: "c4-3-billing-components",
    title: "C4 level 3: billing and entitlement modules",
    repo: "backend",
    family: "c4",
    level: 3,
    summary: "Which module decides what a person may do, what it costs and what they have used.",
    source: String.raw`flowchart LR
  route["routes/billing.py"]
  bs["billing_service: status, quota reserve and release, activate subscription, cancel"]
  ent["entitlements: filter templates for the plan, require generation allowed"]
  pcs["plan_config_service and plan_config_registry: versioned plan prices and limits"]
  promo["promo_service"]
  offer["offer_service"]
  refund["refund_service"]
  ad["ad_gate_service"]
  inv["billing_invoice: bill and receipt PDF, email"]
  rbac["organization_rbac: require_billing_manager"]
  gen["generation routes"]
  chk["checking route"]
  admin["admin_support_billing, admin_promos_offers_plans"]
  tables[("teacher_subscriptions, payment_events, teacher_quota_counters, plan_config_versions, promo_codes, plan_offers")]
  rz["Razorpay"]

  route --> bs
  route --> pcs
  route --> promo
  route --> offer
  route --> ad
  route --> inv
  route --> rbac
  gen --> ent --> bs
  chk --> bs
  admin --> pcs
  admin --> promo
  admin --> offer
  admin --> refund
  refund --> rz
  route --> rz
  bs --> tables
  pcs --> tables
  promo --> tables
  offer --> tables
  ad --> tables`,
    related: ["dfd-2-billing", "er-billing", "state-subscription"],
    notes: ["Plan codes in code: free, teacher_monthly, teacher_quarterly, teacher_yearly, trial and demo.", "The plan entitlement snapshot column exists in the database but is read through SQL in plan_config_service, not through the ORM model."],
    files: ["backend/app/services/billing_service.py", "backend/app/services/entitlements.py", "backend/app/services/plan_config_service.py"],
  },
  {
    id: "c4-3-auth-components",
    title: "C4 level 3: authentication modules",
    repo: "backend",
    family: "c4",
    level: 3,
    summary: "The modules behind sign-in, sessions and lockout for teachers and admins.",
    source: String.raw`flowchart LR
  tr["routes: teacher_auth_routes, teacher_phone, teacher_profile_routes"]
  ar["routes: admin_auth"]
  tca["teacher_account_auth: passwords, email codes, refresh sessions"]
  ta["teacher_auth: token check and RLS context"]
  cache["teacher_auth_cache: confirmed token versions"]
  tok["auth_tokens: HS256 sign and decode"]
  lock["login_lockout"]
  sms["sms_provider: msg91 or mock"]
  mail["email_sender: Resend"]
  box["auth_outbox"]
  aa["admin_auth: roles, permissions, admin tokens"]
  turn["Turnstile check"]
  goog["Google ID token check"]
  db[("teacher_auth_accounts, teacher_refresh_sessions, teacher_*_otps, admin_auth_accounts, admin_refresh_sessions")]

  tr --> tca
  tr --> ta
  tr --> sms
  tr --> mail
  tr --> turn
  tr --> goog
  tca --> tok
  tca --> lock
  ta --> tok
  ta --> cache
  sms --> box
  mail --> box
  ar --> aa
  aa --> tok
  aa --> lock
  tca --> db
  aa --> db
  ta --> db`,
    related: ["dfd-2-auth", "sec-token-lifecycle", "er-teachers-auth"],
    notes: ["Teacher and admin tokens share the signing code but have different audiences (teacher-module and paperly-admin), so one cannot be used as the other.", "Both session kinds use a short access token and a rotating refresh session with reuse detection."],
    files: ["backend/app/services/teacher_account_auth.py", "backend/app/services/teacher_auth.py", "backend/app/services/auth_tokens.py", "backend/app/services/admin_auth.py"],
  },
  {
    id: "c4-3-admin-api-components",
    title: "C4 level 3: admin API modules",
    repo: "backend",
    family: "c4",
    level: 3,
    summary: "The admin route modules, the permission check they share, and the services behind each.",
    source: String.raw`flowchart LR
  common["admin_common: _require_admin_permission and require_permission"]
  ov["admin_overview, admin_usage"]
  us["admin_users, admin_user_actions, admin_organizations"]
  bill["admin_support_billing: refunds, payments, support"]
  plans["admin_promos_offers_plans"]
  ops["admin_backups_maintenance"]
  dbr["admin_database (owner only)"]
  tc["admin_test_center"]
  auth["admin_auth: login, refresh, logout"]
  svc["services: admin_auth, admin_audit, admin_user_evidence, admin_backup_export, admin_db_console, sql_console_guard, system_status, server_logs, security_events, data_retention"]
  mw["Gateway secret and audit middleware"]

  mw --> common
  common --> ov
  common --> us
  common --> bill
  common --> plans
  common --> ops
  common --> dbr
  common --> tc
  auth --> svc
  ov --> svc
  us --> svc
  bill --> svc
  plans --> svc
  ops --> svc
  dbr --> svc
  tc --> svc`,
    related: ["sec-admin-rbac", "dfd-2-admin-audit"],
    notes: ["Every admin route declares the permission it needs; a refusal is logged as a security event.", "The Database routes also check the owner role inside the handler, not only through a permission key."],
    files: ["backend/app/api/routes/admin.py", "backend/app/api/routes/admin_common.py", "backend/app/api/routes/admin_database.py"],
  },
];
