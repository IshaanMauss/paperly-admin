import type { Diagram } from "../types";

// Data flow diagrams, level 0 to level 3. Levels 0 to 2 follow paperly-mvp/docs/dfd; level 3 and the newer level 2 views were written from the code.

export const dfdDiagrams: Diagram[] = [
  {
    id: "dfd-0-context",
    title: "Level 0: system context",
    repo: "system",
    family: "dfd",
    level: 0,
    summary: "The whole product as one box: who talks to it and which outside services it depends on. Start here.",
    source: String.raw`flowchart LR
  teacher["Teacher or student-facing user (teacher module)"]
  member["Institute member (teacher with an organization seat)"]
  admin["Admin or owner (admin panel)"]
  author["Template author (internal dashboard, owner's computer)"]

  system(("Paperly-NT backend (FastAPI)"))

  supabase[("Supabase: Postgres database and private PDF Storage bucket")]
  razorpay["Razorpay: orders, webhooks, refunds"]
  llm["Gemini / LLM provider"]
  sms["SMS provider (MSG91 or mock)"]
  resend["Resend email"]
  google["Google sign-in"]
  turnstile["Cloudflare Turnstile"]
  redis[("Redis: shared rate limits")]

  teacher <-->|"in: sign-in, generate, export, check, buy. out: worksheets, PDFs, billing status, answers"| system
  member <-->|"in: join with code. out: seat and plan state"| system
  admin <-->|"in: moderate, support, billing, refunds, backups. out: overview, audit log, exports"| system
  author <-->|"in: upload screenshots, approve. out: drafts and checks"| system

  system <-->|"rows, RLS context, PDF copies"| supabase
  system <-->|"create order, verify, webhook, refund"| razorpay
  system -->|"typed-answer and scan marking, OCR"| llm
  system -->|"phone sign-in codes"| sms
  system -->|"email codes and notices"| resend
  system -->|"verify ID token"| google
  system -->|"verify human check"| turnstile
  system <-->|"limit counters"| redis`,
    children: ["dfd-1-processes"],
    related: ["c4-1-context", "c4-2-containers"],
    notes: ["Paperly-NT is one FastAPI backend with three clients: the teacher module (public), the admin panel and the template dashboard (internal).", "Supabase holds both the Postgres database and the private PDF bucket. Redis only holds rate-limit counters and is optional.", "Nothing in either frontend talks to Supabase directly: there is no supabase-js and no anon key. Everything goes through the backend."],
    files: ["paperly-mvp/docs/dfd/dfd-level0-context.mmd", "paperly-mvp/backend/app/main.py"],
  },
  {
    id: "dfd-1-processes",
    title: "Level 1: the eight main processes",
    repo: "system",
    family: "dfd",
    level: 1,
    summary: "The system split into its eight processes and the data stores and outside services each one touches. Open any process to go to level 2.",
    source: String.raw`flowchart TD
  teacher["Teacher or institute member"]
  admin["Admin or owner"]

  p1["P1 Authentication: email, Google, phone code, admin login, lockout"]
  p2["P2 Build and generate worksheets from approved templates"]
  p3["P3 Export, preview and PDF storage"]
  p4["P4 AI checking of typed or scanned answers"]
  p5["P5 Billing: plans, promo and offers, ad gate, refunds"]
  p6["P6 Institutes: join codes, seats, entitlements"]
  p7["P7 Admin control plane: RBAC, audit, backups, database console, status, security events"]
  p8["P8 Template authoring and approval: extract, review, verify, approve"]
  author["Template author (dashboard)"]

  db[("Postgres (Supabase)")]
  bucket[("Private PDF Storage bucket")]
  rz["Razorpay"]
  llm["Gemini / LLM"]
  sms["SMS provider"]
  resend["Resend"]
  gsi["Google sign-in and Turnstile"]
  redis[("Redis")]

  teacher --> p1
  p1 --> db
  p1 --> sms
  p1 --> resend
  p1 --> gsi
  p1 --> redis
  admin --> p1

  teacher --> p2
  p2 -->|"claim idempotency, reserve quota"| p5
  p2 --> db
  p2 --> p3
  p3 --> db
  p3 -->|"upload, restore, remove"| bucket

  teacher --> p4
  p4 -->|"reserve AI check"| p5
  p4 --> llm
  p4 --> db

  teacher --> p5
  p5 --> rz
  p5 --> db

  teacher --> p6
  p6 --> db
  p6 -->|"plan and seats"| p5

  admin --> p7
  author --> p8
  p8 --> db
  p8 --> llm
  p8 -->|"approved bank feeds"| p2
  p7 --> db
  p7 -->|"refund"| p5
  p7 -->|"manage"| p6
  p7 -->|"status and backups"| redis
  p7 -->|"disk and bucket status"| bucket`,
    children: ["dfd-2-auth", "dfd-2-generation", "dfd-2-checking", "dfd-2-billing", "dfd-2-ad-gate", "dfd-2-institutes", "dfd-2-admin-audit", "dfd-2-backup-restore", "dfd-2-database-console", "dfd-2-retention", "dfd-2-template-authoring"],
    related: ["c4-3-backend-components"],
    notes: ["P2 never charges quota itself: it asks P5 (billing) to reserve it atomically, and gives it back on a confirmed failure.", "P3 (export) writes PDFs to the backend's local disk first, then optionally copies them to the private bucket so a redeploy cannot lose them.", "P8 produces the approved template bank that P2 draws from; P2 only ever uses templates that are approved and safe to generate."],
    files: ["paperly-mvp/docs/dfd/dfd-level1-processes.mmd"],
  },
  {
    id: "dfd-2-auth",
    title: "Level 2: sign-in, codes and lockout (P1)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "Every way a person can sign in or recover access, and where the failure counter and lockout fit.",
    source: String.raw`flowchart TD
  user["Person signing in"]
  choose{"Method"}

  login["POST /teacher/auth/login (10 per minute)"]
  placeholder{"Placeholder phone email?"}
  find["Find account by email"]
  locked{"locked_until in the future?"}
  refuse429["429 with Retry-After, password not checked"]
  pw{"Password correct?"}
  fail["register_failure: count a miss, lock after the limit"]
  err401["401 Email or password is incorrect"]
  verified{"Email verified?"}
  sendotp["Issue email OTP, 403"]
  ok["register_success: clear counter"]
  suspended{"Account suspended?"}
  deny403["403 suspended"]
  issue["Issue access token and HttpOnly refresh cookie"]

  otpreq["POST /teacher/auth/phone/request-otp (8 per hour)"]
  ts["Turnstile check"]
  issueotp["issue_phone_otp: row in teacher_phone_otps, same response for known and new numbers"]
  smsout["send_otp_sms: daily cap, MSG91 or mock, row in auth_message_outbox (masked, code redacted)"]
  otpver["POST /teacher/auth/phone/verify (20 per hour)"]
  vcode["verify_phone_otp"]
  newacct["Existing profile or create phone account"]

  google["POST /teacher/auth/google"]
  reset["POST /teacher/auth/reset-password with email code"]

  adminlogin["POST /admin/auth/login: same lockout with the admin limit"]
  adminclear["Admin clears lock or resets sessions in User 360"]
  db[("Postgres")]

  user --> choose
  choose -->|"email and password"| login
  choose -->|"phone code"| otpreq
  choose -->|"Google"| google
  choose -->|"forgot password"| reset

  login --> placeholder
  placeholder -->|yes| err401
  placeholder -->|no| find
  find --> locked
  locked -->|yes| refuse429
  locked -->|no| pw
  pw -->|no| fail
  fail --> err401
  pw -->|yes| verified
  verified -->|no| sendotp
  verified -->|yes| ok
  ok --> suspended
  suspended -->|yes| deny403
  suspended -->|no| issue

  otpreq --> ts
  ts --> issueotp
  issueotp --> smsout
  smsout --> otpver
  otpver --> vcode
  vcode --> newacct
  newacct --> suspended

  google --> suspended
  reset -->|"clears lockout"| ok

  fail --> db
  ok --> db
  issueotp --> db
  smsout --> db
  adminlogin --> locked
  adminclear -->|"clear lock"| db`,
    children: ["dfd-3-token-and-rls", "dfd-3-phone-otp"],
    related: ["seq-teacher-email-signin", "seq-phone-otp-signin", "state-auth-session-client", "sec-token-lifecycle"],
    notes: ["A locked account is refused before the password is even checked, so a lock cannot be used to guess passwords.", "Teachers lock after 8 failures and admins after 5, for 15 minutes. Password reset, Google sign-in and phone codes still work while locked.", "Turnstile is on register, forgot-password, phone-code request and guest support, but not on the password login itself."],
    files: ["backend/app/api/routes/teacher_auth_routes.py", "backend/app/api/routes/teacher_phone.py", "backend/app/services/login_lockout.py", "backend/app/services/teacher_account_auth.py"],
  },
  {
    id: "dfd-2-generation",
    title: "Level 2: building and exporting a paper (P2 and P3)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "From the teacher's request to a stored worksheet and its PDFs, including the idempotency claim, the quota reservation and the retention rules.",
    source: String.raw`flowchart TD
  teacher["Teacher"]
  req["POST /worksheets, /worksheets/topical or /worksheets/full-portion"]
  token["Verify signed teacher token and token_version"]
  idem["Claim idempotency key (required for teachers)"]
  replay{"Same key already done?"}
  returnold["Return stored worksheet, no new quota"]
  gate{"Plan gates: paper filter, full-portion subtopic cap"}
  b402["402 upgrade required"]
  quota["Atomic quota reserve (day, month, builder; ad credit if used)"]
  gen["Pick approved templates, sample variables, verify, render question and mark scheme"]
  fail{"Confirmed hard failure?"}
  release["Release quota once, mark idempotency failed"]
  store[("Postgres: worksheet and template snapshots")]

  exp["POST /worksheets/{id}/export (30 per minute, optional Idempotency-Key)"]
  owner["Owner check against signed teacher_id, RLS context set"]
  ready{"PDF paths ready and files present?"}
  restore["pdf_storage.ensure_local: restore a wiped file from the bucket"]
  render["Render worksheet PDF and answer-key PDF plus first-page PNGs"]
  upload["pdf_storage.store_export_files: upload PDF and PNG (only when PDF_STORAGE_URL, KEY, BUCKET are set)"]
  bucket[("Private Supabase Storage bucket")]
  serve["GET worksheet.pdf, answer-key.pdf, png, html (answer visibility by plan)"]
  retention["Retention cleanup: 7 days never exported, 30 days exported, local files and bucket copies removed"]

  teacher --> req
  req --> token --> idem --> replay
  replay -->|yes| returnold
  replay -->|no| gate
  gate -->|blocked| b402
  gate -->|allowed| quota
  quota --> gen --> fail
  fail -->|yes| release
  fail -->|no| store

  teacher --> exp
  exp --> owner --> ready
  ready -->|"yes"| serve
  ready -->|"no"| render
  render --> upload
  upload --> bucket
  render --> store
  store --> serve
  serve -->|"file missing locally"| restore
  restore --> bucket
  retention --> store
  retention --> bucket`,
    children: ["dfd-3-quota-idempotency", "dfd-3-variant-engine", "dfd-3-pdf-render-store"],
    related: ["seq-topical-generation", "seq-pdf-export", "dfd-2-retention"],
    notes: ["Teachers must send an idempotency key; the same key returns the stored paper and never charges twice.", "A generation slot (MAX_CONCURRENT_GENERATIONS, default 4 per process) limits how many papers one backend process builds at once; the rest wait up to GENERATION_WAIT_SECONDS then get a friendly 503 with nothing charged.", "The database connection is released before the slow generation work so the pooler is not held while a paper is built."],
    files: ["backend/app/api/routes/worksheet_topical.py", "backend/app/api/routes/worksheet_common.py", "backend/app/api/routes/worksheet_exports.py"],
  },
  {
    id: "dfd-2-checking",
    title: "Level 2: AI checking of scanned or typed answers (P4)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "How an uploaded scan or typed working turns into marks and feedback, and where the check is reserved and given back.",
    source: String.raw`flowchart TD
  teacher["Teacher"]
  up["POST /worksheets/check-upload: scans or photos as multipart, 15 per minute per teacher"]
  typed["POST /worksheets/{id}/ai-mark: typed working from the screen"]
  who["Resolve teacher from the signed token and set the RLS context"]
  reserve["billing_service.reserve_ai_check: plan includes checking and checks are left"]
  refuse["Refused: plan or limit, nothing reserved"]
  qr["paper_qr.find_worksheet_id_in_upload: read the QR code printed on the paper"]
  found{"Paper found and owned by this teacher?"}
  notyours["Refused: unknown or not this teacher's paper"]
  pages["upload_to_page_images: split the PDF or photos into page images"]
  read["extract_part_workings_from_images: read each written answer"]
  mark["ai_marking.mark_question and mark_question_by_parts against the stored mark scheme"]
  llm["LLM provider through llm_client (Gemini by default)"]
  hard{"Confirmed failure?"}
  release["billing_service.release_ai_check: give the check back"]
  results["Per question marks, feedback and a list of unmatched questions"]
  event[("teacher_analytics_events: paper_checked")]
  db[("Postgres: worksheet, questions, mark scheme")]
  report["POST /worksheets/{id}/check-report.pdf: render the report PDF"]
  admin["Admin AI Checking page: totals over 7 and 30 days"]

  teacher --> up
  teacher --> typed
  up --> who
  typed --> who
  who --> reserve
  reserve -->|no| refuse
  reserve -->|yes| qr
  qr --> found
  found -->|no| notyours
  found -->|yes| pages
  pages --> read
  typed --> mark
  read --> mark
  mark <--> llm
  db --> mark
  mark --> hard
  hard -->|yes| release
  hard -->|no| results
  results --> event
  results --> teacher
  teacher --> report
  event --> admin`,
    children: ["dfd-3-ai-marking"],
    related: ["seq-ai-check-upload"],
    notes: ["The scan route is rate limited per teacher in the database (15 a minute), separate from the per-IP limiter.", "The LLM provider and model are environment settings (LLM_PROVIDER, LLM_MODEL and per-task variants), so the provider can change without code.", "Only the ownership check decides whether a paper can be marked: the QR code finds the paper, the signed token proves it is the teacher's."],
    files: ["backend/app/api/routes/worksheet_checking.py", "backend/app/services/ai_marking.py", "backend/app/services/paper_qr.py", "backend/app/services/llm_client.py"],
  },
  {
    id: "dfd-2-billing",
    title: "Level 2: checkout, payment and refunds (P5)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "From the checkout page to an activated plan, and the admin refund path back out.",
    source: String.raw`flowchart TD
  buyer["Person on checkout"]
  order["POST /billing/razorpay/order"]
  disc{"Promo code or live offer?"}
  validate["Server validates audience, expiry, single use, plan; discount applied before 18% GST"]
  zero{"Amount zero (100% off)?"}
  grant["Grant plan without Razorpay"]
  keys{"Razorpay keys configured?"}
  n503["503 card payments not available"]
  rzorder["Create Razorpay order with notes: teacher_id, plan_code, promo or offer"]
  pay["Razorpay Checkout"]
  verify["POST /billing/razorpay/verify: HMAC signature, fetch order, match notes"]
  hook["POST /billing/razorpay/webhook: signed, same checks"]
  dup{"Payment already processed?"}
  nochange["Change nothing"]
  activate["Activate plan, mark promo or offer redeemed"]
  pe[("payment events: razorpay.payment.verified")]

  admin["Admin with billing.refund permission"]
  refund["POST /admin/teachers/{id}/billing/refund (amount optional, reason required)"]
  find["find_refundable_payment: latest verified Razorpay payment"]
  none{"Payment found and not already refunded?"}
  r404["404 or 409, nothing sent"]
  rzrefund["Razorpay POST /payments/{id}/refund"]
  rzfail{"Razorpay accepted?"}
  rerr["400 or 502, no event written"]
  rec["Record razorpay.refund.created event, admin action log, commit"]
  cancel["Optionally cancel the plan"]
  audit["Automatic admin audit row (see admin audit diagram)"]

  buyer --> order --> disc
  disc -->|yes| validate --> zero
  disc -->|no| zero
  zero -->|yes| grant
  zero -->|no| keys
  keys -->|no| n503
  keys -->|yes| rzorder --> pay
  pay --> verify
  pay --> hook
  verify --> dup
  hook --> dup
  dup -->|yes| nochange
  dup -->|no| activate --> pe

  admin --> refund --> find --> none
  none -->|no| r404
  none -->|yes| rzrefund --> rzfail
  rzfail -->|no| rerr
  rzfail -->|yes| rec --> cancel
  pe --> find
  refund --> audit`,
    children: ["dfd-3-price-and-order", "dfd-3-razorpay-activation"],
    related: ["seq-checkout-razorpay", "state-subscription", "dfd-2-ad-gate", "teacher-billing-client-flow"],
    notes: ["A plan is activated only from a verified payment: the signed browser callback and the signed webhook both lead to the same activation, and a payment id is processed once.", "Discounts (promo or live offer) come off the price before the 18 percent GST, which is included in the price shown.", "A 100 percent discount grants the plan directly and does not need Razorpay keys."],
    files: ["backend/app/api/routes/billing.py", "backend/app/services/billing_service.py", "backend/app/services/refund_service.py"],
  },
  {
    id: "dfd-2-ad-gate",
    title: "Level 2: free-plan ad gate and answer visibility (P5)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "How a Free account earns one extra paper by watching an ad, and why mark schemes are shown at different depths per plan.",
    source: String.raw`flowchart TD
  free[Free person hits the DAILY paper limit]
  status[Billing status: ad_unlock available?]
  monthly{Monthly cap also reached?}
  start["POST /billing/ad/start (Free only, max 6 a day)"]
  consent{Marketing cookies allowed?}
  card[30 second preview card, ad only if allowed]
  complete["POST /billing/ad/complete: signed token, person, purpose, one use, 28s to 15 min on server clock"]
  credit[One ad credit stored as a daily counter]
  reserve[Generate reserves day, month and builder counters plus one credit]
  paper[One extra paper]
  block[Upgrade or wait: an ad never lifts monthly limits]

  free --> status
  status --> monthly
  monthly -->|yes| block
  monthly -->|no| start
  start --> consent
  consent -->|no| block
  consent -->|yes| card
  card --> complete
  complete --> credit
  credit --> reserve
  reserve --> paper

  view[Mark scheme view for a paper]
  yearly{Plan is Yearly?}
  full[Full answers, working and mark scheme: screen and PDF]
  final["Final answers only page: watermark, no print, no select, no-store"]
  msad[Free needs one ad per paper first]
  view --> yearly
  yearly -->|yes| full
  yearly -->|no| msad
  msad --> final`,
    children: ["dfd-3-ad-credit"],
    related: ["seq-ad-unlock", "dfd-2-billing"],
    notes: ["An ad never lifts the monthly limit: when the month is used up the only options are to wait or upgrade.", "Marketing cookie consent is required before any ad is shown; without consent nothing is unlocked.", "Free accounts see a final-answers-only page; Yearly sees full working and the downloadable mark scheme."],
    files: ["backend/app/services/ad_gate_service.py", "teacher-module/src/lib/adGate.tsx"],
  },
  {
    id: "dfd-2-institutes",
    title: "Level 2: institutes, join codes and seats (P6)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "How a school becomes an organization, how teachers join it, and where seats and roles are checked.",
    source: String.raw`flowchart TD
  visitor["Visitor or existing teacher"]
  req["POST /teacher/organization-requests: institute name, contact, wanted features"]
  pending[("organization_requests: status pending")]
  admin["Admin in Organizations or Institute setup"]
  decide{"Approve?"}
  reject["Status rejected, with a reason"]
  approve["Create organization: type institute, status active; issue an activation token; status approved"]
  org[("organizations and organization_members")]
  deliver["Activation link or join code is given to the institute owner"]
  redeem["Owner redeems the token: status delivered, owner becomes institute_owner"]
  join["POST /teacher/organization/join with the code"]
  seatcheck{"Seat available and code valid?"}
  nojoin["Refused: no seat or bad code"]
  member["organization_members row: role institute_teacher, status active"]
  use["Teacher uses the institute plan and features"]
  rbac["organization_rbac: billing actions need a billing manager role"]
  manage["Admin sets a member active, suspended or removed: organization_seats.admin_set_member"]
  teacher["Teacher"]

  visitor --> req --> pending --> admin --> decide
  decide -->|no| reject
  decide -->|yes| approve --> org
  approve --> deliver --> redeem --> org
  teacher --> join --> seatcheck
  seatcheck -->|no| nojoin
  seatcheck -->|yes| member --> org
  member --> use
  use --> rbac
  admin --> manage --> org`,
    children: ["dfd-3-seats-and-roles"],
    related: ["state-org-request", "er-organizations"],
    notes: ["Every teacher also gets a personal organization (organization_key personal:<teacher_id>) with the role individual_owner.", "Roles in code: individual_owner, institute_owner, institute_teacher, institute_manager. Member status is active, suspended or removed.", "Request status moves pending, then approved, then delivered, or pending, then rejected."],
    files: ["backend/app/services/organization_requests.py", "backend/app/services/organization_seats.py", "backend/app/services/organization_rbac.py", "backend/app/api/routes/admin_organizations.py"],
  },
  {
    id: "dfd-2-admin-audit",
    title: "Level 2: admin control plane and audit trail (P7)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "Every admin request from the browser to the database, with the gateway check, permission check and automatic audit row.",
    source: String.raw`flowchart TD
  admin["Admin or owner in the admin panel"]
  proxy["Same-site proxy adds gateway secret header"]
  gate{"Gateway secret matches on /api/admin?"}
  d403["403 refused"]
  route["Admin route with permission dependency (for example billing.refund, backups.write)"]
  perm{"Permission allowed?"}
  deny["Refused and logged as a security event"]
  work["Route does the work and commits"]
  mw["Request middleware finishes: write server log row"]
  should{"should_audit: POST, PUT, PATCH or DELETE under /api/admin, not login, refresh or logout?"}
  rec["record_admin_write: actor, action label, route template, target ids, status, outcome, ip, duration"]
  ev[("teacher_analytics_events: event_type admin_audit.write")]
  best["Best effort: a failed log write never breaks the response"]

  view["GET /api/admin/audit-log (security.read), filter by actor, days, failed only"]
  evidence["POST /api/admin/security-events/export-evidence (security.read): account, security events, admin actions, server logs as JSON"]
  status["GET /api/admin/system-status (admin.read): database, Redis, config, traffic, disk, backup, PDF storage"]
  hist["GET /api/admin/backups/history (backups.read): last export and restore, read from the audit rows"]
  exp["POST /api/admin/backups/export (backups.read) and restore (backups.write)"]

  admin --> proxy --> gate
  gate -->|no| d403
  gate -->|yes| route --> perm
  perm -->|no| deny --> mw
  perm -->|yes| work --> mw --> should
  should -->|yes| rec --> ev
  should -->|no| best
  rec --> best
  ev --> view
  ev --> evidence
  ev --> hist
  admin --> view
  admin --> evidence
  admin --> status
  admin --> hist
  admin --> exp`,
    children: ["dfd-3-audit-write"],
    related: ["admin-gateway-flow", "sec-admin-rbac", "seq-admin-login"],
    notes: ["Every admin write (POST, PUT, PATCH, DELETE under /api/admin, except login, refresh and logout) is audited automatically; a failed audit write never breaks the response.", "A refused permission is logged as a security event (admin_permission_denied)."],
    files: ["backend/app/services/admin_audit.py", "backend/app/main.py", "backend/app/api/routes/admin_common.py"],
  },
  {
    id: "dfd-2-backup-restore",
    title: "Level 2: export, backup and restore (P7)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "How an admin takes a readable business export or a restorable backup, and the guards around restoring.",
    source: String.raw`flowchart TD
  owner["Admin or owner"]
  page["Export & Backup page"]
  xl["POST /api/admin/backups/export?format=xlsx (backups.read)"]
  js["POST /api/admin/backups/export?format=json (backups.read)"]
  ranges["Optional date ranges in India time: admin_export_ranges"]
  tables[("Postgres tables")]
  wb["Business workbook: Read Me plus Users, Orgs, Subscriptions, Promo, Payments, Papers, Template Usage, Tickets, Templates, Admin Activity, Security, Offers, Plan Config History"]
  bk["Backup file: schema admin-backup-v1, 20 tables"]
  excl["Never included: password hashes, refresh sessions, OTP tables, outbox, admin accounts"]
  restore["POST /api/admin/backups/restore (backups.write, owner by default)"]
  dry{"dry run?"}
  report["Report what would be inserted, change nothing"]
  phrase{"Typed confirmation RESTORE PAPERLY-NT DATABASE FROM BACKUP?"}
  refuse["Refused"]
  insert["Insert only: ON CONFLICT DO NOTHING, existing rows are never overwritten"]
  audit["Automatic audit row, history read from the audit rows"]
  provider["Provider snapshots and point in time recovery: set up by the owner in Supabase, not by the app"]

  owner --> page
  page --> xl --> ranges --> tables --> wb --> owner
  page --> js --> tables --> bk --> owner
  tables -.-> excl
  page --> restore --> dry
  dry -->|yes, the default| report
  dry -->|no| phrase
  phrase -->|no| refuse
  phrase -->|yes| insert --> tables
  restore --> audit
  provider -.-> tables`,
    children: ["dfd-3-backup-internals"],
    related: ["ops-backup-recovery"],
    notes: ["Restore never deletes or overwrites anything: it only adds rows that are missing.", "Backups are taken on request. Nothing in the app schedules them, and off-site scheduled backups are still an open item."],
    files: ["backend/app/services/admin_backup_export.py", "backend/app/services/admin_export_ranges.py", "backend/app/api/routes/admin_backups_maintenance.py", "docs/backup-and-restore.md"],
  },
  {
    id: "dfd-2-database-console",
    title: "Level 2: owner database console (P7)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "The owner-only Database area: browsing, reading, and changing data with a review step, typed phrases and password re-entry.",
    source: String.raw`flowchart TD
  owner["Owner in the admin panel Database page"]
  pick{"Production or Test?"}
  status["GET /api/admin/database/targets: is it connected, does it carry the test marker?"]
  locked["Locked: not connected or marker mismatch"]
  browse["Overview, Tables and schema, row browser: read only, credential tables hidden, sensitive columns masked"]
  sql["SQL console"]
  review["POST /{target}/sql/review: scrub, classify risk, dry run in a rolled back transaction, sign a review token"]
  refuse["Blocked: more than one statement, forbidden verb, restricted table or protected table"]
  readrun["Reads: read only transaction, 15 second timeout, 500 row cap"]
  confirm["Typed phrase RUN ON PRODUCTION or RUN ON TEST, a second phrase for high and critical, and password re-entry"]
  run["POST /{target}/sql/run: verify the token matches this admin, target and statement within 5 minutes"]
  rows{"Row count equals the dry run?"}
  rollback["Rolled back, nothing changed"]
  commit["Committed"]
  log["Event admin_sql_run with the statement, risk and row count"]
  hist["History tab: SQL files already applied, migrations and console runs"]
  db[("Postgres: Supabase production or the Test database")]

  owner --> pick --> status
  status -->|no| locked
  status -->|yes| browse
  status -->|yes| sql
  browse --> db
  sql --> review
  review -->|blocked| refuse
  review -->|read| readrun --> db
  review -->|write| confirm --> run --> rows
  rows -->|no| rollback
  rows -->|yes| commit --> db
  commit --> log
  log --> hist`,
    children: ["dfd-3-sql-console"],
    related: ["seq-admin-sql-run", "admin-database-ui-flow"],
    notes: ["Only the owner role can open this area, checked by the backend, not just hidden in the menu.", "Credential tables (admin and teacher accounts, refresh sessions, OTP tables) can never be read or changed here.", "The Test button needs a backend that can reach TEST_DATABASE_URL, so it is normally used from a local backend."],
    files: ["backend/app/api/routes/admin_database.py", "backend/app/services/admin_db_console.py", "backend/app/services/sql_console_guard.py", "docs/admin-database-console.md"],
  },
  {
    id: "dfd-2-retention",
    title: "Level 2: worksheet retention and cleanup (P3)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "How old worksheets and their files are removed, and what is deliberately kept forever.",
    source: String.raw`flowchart TD
  trigger1[Admin: POST /admin/worksheets/cleanup dry_run=true/false] --> svc[cleanup_stale_worksheets]
  trigger2[CLI: py -m app.scripts.cleanup_worksheets, add --execute to delete] --> svc

  svc --> q1[Query worksheets: no PDF/MS path AND older than 7 days]
  svc --> q2[Query worksheets: has PDF/MS path AND older than 30 days]
  q1 --> decide{dry_run?}
  q2 --> decide
  decide -->|true| report[Return counts only, delete nothing]
  decide -->|false| del[Delete worksheet rows]
  del --> files[Remove matching PDF/PNG files from local disk]
  files --> commit[(Commit)]

  usage[TeacherTemplateUsage] -.not touched by cleanup, stays permanent.-> keep[(kept forever)]
  events[TeacherAnalyticsEvent] -.not touched by cleanup, stays permanent.-> keep
  note1["CLI is a dry run unless --execute is passed (the older --dry-run default bug is fixed)"] -.-> trigger2
  del --> remote["Remove bucket copies via pdf_storage.remove_remote (only when durable storage is set)"]`,
    related: ["dfd-3-pdf-render-store", "ops-backup-recovery"],
    notes: ["Never-exported papers are removed after 7 days, exported papers after 30 days, including their bucket copies.", "Nothing runs this on a schedule. It runs only from the admin Maintenance page or the command line, and the command line is a dry run unless --execute is passed."],
    files: ["backend/app/services/data_retention.py", "backend/app/scripts/cleanup_worksheets.py"],
  },
  {
    id: "dfd-2-template-authoring",
    title: "Level 2: template authoring and approval (P8)",
    repo: "backend",
    family: "dfd",
    level: 2,
    summary: "How a question and mark scheme become an approved template: upload, extraction, review, verification and approval.",
    source: String.raw`flowchart TD
  author["Template author"]
  upload["Dashboard /upload: screenshots of the question and mark scheme, single or chained"]
  extract["POST /api/extract/template-draft: OCR plus LLM structure plan, then draft, validation and up to 4 repair rounds"]
  llm["LLM provider (Gemini)"]
  review["Dashboard /review: edit the JSON, preview 5 variants"]
  preview["POST /api/preview: sample variants and check them with SymPy"]
  save["POST /api/templates: status draft, safe_to_generate false"]
  approve["POST /api/templates/{id}/approve"]
  checks["Schema check, draft check, math guard audit and multi-sample verification, under a row lock"]
  approved["status approved, safe_to_generate true, capacity stats stored, approval logged"]
  bank[("templates and template_approval_log")]
  manage["Dashboard /manage: admin state draft, approved, deprecated or deleted (soft delete)"]
  qa["Dashboard /worksheets: QA preview of generated papers"]
  scripts["Batch ingest scripts: backend/scripts/ingest_*_q*.py and per-paper folders"]
  health["Admin Variant Health: capacity and answers per template"]
  teachers["Teacher module picks from approved and safe templates only"]

  author --> upload --> extract
  extract <--> llm
  extract --> review --> preview --> review
  review --> save --> bank
  bank --> approve --> checks
  checks -->|pass| approved --> bank
  checks -->|fail| review
  author --> manage --> bank
  bank --> qa
  scripts --> bank
  bank --> health
  bank --> teachers`,
    children: ["dfd-3-template-approval"],
    related: ["state-template", "er-templates-worksheets", "seq-template-ingestion"],
    notes: ["Approval is the gate: a template is generated from only when status is approved and safe_to_generate is true.", "An approved template is treated as immutable; a change replaces it with a PUT, which sends it back to draft.", "The dashboard is an internal tool that runs on the owner's computer; it is not the customer product."],
    files: ["backend/app/api/routes/templates.py", "backend/app/services/template_generator/", "dashboard/src/pages/", "docs/admin-upload-flow.md"],
  },
  {
    id: "dfd-3-token-and-rls",
    title: "Level 3: teacher token check and database isolation",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "What happens to a teacher's token on every request, step by step, and how the database is told whose rows are visible.",
    source: String.raw`flowchart TD
  req["Incoming request with bearer token or refresh cookie"]
  read["teacher_session_token_from_request"]
  has{"Token present?"}
  claimed{"Request names a teacher id?"}
  e401a["401 plus security event"]
  verify["verify_teacher_session_token: HS256 signature, audience teacher-module, expiry"]
  bad{"Valid?"}
  e401b["401"]
  rls["set_teacher_rls_context: set_config app.teacher_id local, then SET LOCAL ROLE paperly_teacher_runtime"]
  cache["teacher_auth_cache.get_confirmed_version"]
  hit{"Cache says token_version matches?"}
  acct[("teacher_auth_accounts.token_version")]
  same{"Same version?"}
  e401c["401: signed out everywhere"]
  spoof{"Claimed id differs from the token?"}
  e403["403 plus security event teacher_id_spoof_blocked"]
  ok["Route runs with the id from the token"]
  recommit["After every commit the route re-runs set_teacher_rls_context, because the setting is transaction local"]

  req --> read --> has
  has -->|no| claimed
  claimed -->|yes| e401a
  claimed -->|no| ok
  has -->|yes| verify --> bad
  bad -->|no| e401b
  bad -->|yes| rls --> cache --> hit
  hit -->|yes| spoof
  hit -->|no| acct --> same
  same -->|no| e401c
  same -->|yes| spoof
  spoof -->|yes| e403
  spoof -->|no| ok --> recommit`,
    related: ["sec-rls-enforcement", "sec-token-lifecycle"],
    notes: ["The teacher id always comes from the signed token, never from the request body or query.", "The backend connects as the postgres role, then switches to the restricted paperly_teacher_runtime role for the rest of the transaction so row level security applies."],
    files: ["backend/app/services/teacher_auth.py", "backend/app/services/teacher_auth_cache.py", "backend/alembic/versions/"],
  },
  {
    id: "dfd-3-phone-otp",
    title: "Level 3: phone sign-in code lifecycle",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "Issuing, sending, checking and consuming a phone code, with every limit and what is stored.",
    source: String.raw`flowchart TD
  req["POST /teacher/auth/phone/request-otp: 8 per hour, Turnstile checked"]
  norm["Normalise the number to E.164"]
  issue["issue_phone_otp: random code, only a hash stored in teacher_phone_otps with attempts, max_attempts, expires_at"]
  same["Same response whether the number is known or new, so numbers cannot be probed"]
  cap{"SMS daily cap reached?"}
  capblock["Refused for today"]
  send["send_otp_sms: provider msg91 or mock"]
  outbox[("auth_message_outbox: masked recipient, code redacted, status mock sent or failed")]
  verify["POST /teacher/auth/phone/verify: 20 per hour"]
  check{"Row exists, not expired, not consumed, attempts left, hash matches?"}
  count["Count the attempt; stop at max_attempts"]
  consume["Mark consumed_at so the code works once"]
  acct{"Profile with this number?"}
  existing["Use the existing profile"]
  create["Create a phone account"]
  suspended{"Suspended?"}
  deny["403"]
  tokens["Issue access token and rotating HttpOnly refresh cookie"]

  req --> norm --> issue --> same
  issue --> cap
  cap -->|yes| capblock
  cap -->|no| send --> outbox
  verify --> check
  check -->|no| count
  check -->|yes| consume --> acct
  acct -->|yes| existing --> suspended
  acct -->|no| create --> suspended
  suspended -->|yes| deny
  suspended -->|no| tokens`,
    related: ["seq-phone-otp-signin"],
    notes: ["The outbox keeps a masked record so support can see that a code was sent without ever storing the code itself.", "Outside production the provider defaults to mock; the real provider needs a DLT-approved template in India."],
    files: ["backend/app/api/routes/teacher_phone.py", "backend/app/services/sms_provider.py", "backend/app/services/auth_outbox.py", "backend/alembic/versions/0030_phone_otp_and_auth_outbox.py"],
  },
  {
    id: "dfd-3-quota-idempotency",
    title: "Level 3: idempotency key and quota reservation",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "How the system guarantees one charge per paper even with retries, double taps and failures.",
    source: String.raw`flowchart TD
  start["Generation request with an idempotency key"]
  claim["_claim_teacher_idempotency: unique teacher, key and scope"]
  state{"Existing record?"}
  fresh["Insert record: status in_progress"]
  done["Completed: return the stored response, no new quota"]
  live["In progress and under 15 minutes old: 409 try again shortly"]
  stale["Failed, or in progress over 15 minutes: take it over as in_progress"]
  reserve["reserve_generation_quota: INSERT ON CONFLICT UPDATE count plus one WHERE count is below the limit"]
  counters[("teacher_quota_counters: day, month, builder and ad credit counters")]
  limit{"Limit reached?"}
  e402["402 or 429: nothing reserved"]
  mark["Mark the record quota_reserved"]
  work["Generate and store the worksheet"]
  fail{"Confirmed failure?"}
  release["release_generation_quota: decrement the counters and set quota_released once"]
  failed["Record status failed"]
  complete["Record status completed with the response payload"]

  start --> claim --> state
  state -->|none| fresh --> reserve
  state -->|completed| done
  state -->|in progress| live
  state -->|failed or stale| stale --> reserve
  reserve --> counters
  reserve --> limit
  limit -->|yes| e402
  limit -->|no| mark --> work --> fail
  fail -->|yes| release --> failed
  fail -->|no| complete`,
    related: ["state-idempotency", "seq-topical-generation"],
    notes: ["The reservation is a single atomic statement, so two taps at the same moment can never both pass a limit of one.", "quota_released can be set only once, so a retry cannot refund twice.", "Scopes in use: topical_generation and worksheet_export."],
    files: ["backend/app/api/routes/worksheet_common.py", "backend/app/services/billing_service.py", "backend/app/models/billing.py"],
  },
  {
    id: "dfd-3-variant-engine",
    title: "Level 3: from template to a verified question",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "The engine that turns one approved template into a fresh, checked question and mark scheme.",
    source: String.raw`flowchart TD
  pool["Approved templates that match topic, paper, subtopic, diagram filter and plan"]
  safe["retire_unsafe_templates and the safe_to_generate filter"]
  pick["_pick_spread_template: spread the choice, avoid the teacher's recent signatures and wordings"]
  recent[("teacher_template_usage: recent_variant_signatures, recent_wording_choices")]
  sample["variant_generator.sampler: draw each variable from its range or choices"]
  derive["Evaluate derived variables with the safe expression evaluator"]
  cons{"Every constraint expression true?"}
  retry["Draw again, up to the retry limit"]
  verify["verify_template_variant: SymPy checks the answer formula and mark scheme"]
  multi["Chained question: multipart_generator samples shared variables and verify_multipart_template_variant checks every part"]
  ok{"Verified?"}
  guard["math_guard.repair_generated_item and math_presentation: clean notation"]
  wording["Choose a wording variant"]
  render["Question text, working and mark scheme filled in"]
  out["Generated item for the worksheet"]
  fail["Hard failure: caller releases the quota"]

  pool --> safe --> pick
  recent --> pick
  pick --> sample --> derive --> cons
  cons -->|no| retry --> sample
  cons -->|yes| verify
  pick -.chained.-> multi --> verify
  verify --> ok
  ok -->|no| retry
  ok -->|yes| guard --> wording --> render --> out
  retry -.too many tries.-> fail`,
    related: ["er-templates-worksheets", "state-template"],
    notes: ["Constraints are written as objects with an expr field, and placeholders never contain arithmetic: derived variables do the sums first.", "The same verification runs at approval time and again when a variant is generated, so a bad variant is caught before a teacher sees it."],
    files: ["backend/app/services/worksheet_generator.py", "backend/app/services/variant_generator/", "backend/app/services/verification/", "backend/app/services/multipart_generator.py", "backend/app/services/math_guard.py"],
  },
  {
    id: "dfd-3-pdf-render-store",
    title: "Level 3: PDF render, storage and restore",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "How a worksheet becomes PDFs and previews, where the files live, and how a lost file comes back.",
    source: String.raw`flowchart TD
  exp["POST /worksheets/{id}/export, 30 per minute"]
  lookup["Look up the worksheet and check ownership"]
  idem["Optional Idempotency-Key, scope worksheet_export"]
  ready{"is_current_render and files present after pdf_storage.ensure_local?"}
  cached["Return the existing paths"]
  html["html_builder: worksheet and answer key HTML with maths and figures"]
  qp["render_worksheet_pdf"]
  ms["render_answer_key_pdf"]
  png["render_pdf_first_page_image for each PDF"]
  disk[("Backend local disk: generated_pdfs, wiped on redeploy")]
  store["pdf_storage.store_export_files: up to 4 files, 20 second timeout, failures swallowed"]
  bucket[("Private Supabase Storage bucket")]
  paths["Save PDF paths on the worksheet and commit"]
  get["GET worksheet.pdf, answer-key.pdf, png or html"]
  missing{"File missing locally?"}
  restore["ensure_local: download it from the bucket"]
  vis["Answer visibility by plan: full for Yearly, final answers page otherwise"]

  exp --> lookup --> idem --> ready
  ready -->|yes| cached
  ready -->|no| html --> qp --> disk
  html --> ms --> disk
  qp --> png --> disk
  disk --> store --> bucket
  disk --> paths
  get --> missing
  missing -->|yes| restore --> bucket
  missing -->|no| vis
  restore --> vis`,
    related: ["seq-pdf-export", "dfd-2-retention"],
    notes: ["The bucket is optional: it is used only when PDF_STORAGE_URL, PDF_STORAGE_KEY and PDF_STORAGE_BUCKET are all set.", "A render_version stamp decides whether an old PDF is still current after a layout change."],
    files: ["backend/app/api/routes/worksheet_exports.py", "backend/app/services/pdf_export/", "backend/app/services/pdf_storage.py"],
  },
  {
    id: "dfd-3-price-and-order",
    title: "Level 3: price, discount and order creation",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "How the amount to pay is worked out and how the Razorpay order is created.",
    source: String.raw`flowchart TD
  orderCall["POST /billing/razorpay/order: plan, optional promo code, optional offer"]
  who["resolve_teacher_id and require_billing_manager"]
  plan["Plan price from the published plan config version: plan_config_service"]
  offer{"Offer sent?"}
  voffer["validate_offer_for_checkout: live, audience, plan"]
  promo{"Promo code sent?"}
  vpromo["preview_promo_code: audience, expiry, uses left, plan"]
  disc["Discount comes off the price"]
  gst["GST 18 percent is included in the total shown and split out on the bill"]
  zero{"Total is zero?"}
  grant["Grant the plan directly and finish the promo"]
  keys{"Razorpay keys set?"}
  e503["503 card payments not available"]
  create["Create the Razorpay order with notes teacher_id, plan_code, promo or offer"]
  ev[("payment_events: razorpay.order.created, event_id order:id")]
  back["Order id and amount returned to the checkout"]

  orderCall --> who --> plan --> offer
  offer -->|yes| voffer --> promo
  offer -->|no| promo
  promo -->|yes| vpromo --> disc
  promo -->|no| disc
  disc --> gst --> zero
  zero -->|yes| grant
  zero -->|no| keys
  keys -->|no| e503
  keys -->|yes| create --> ev
  create --> back`,
    related: ["state-subscription"],
    notes: ["The browser never sends a price: the server works it out from the plan config, so a changed price in the browser has no effect.", "Plan prices live in versioned plan config (draft, published, archived) that an admin can publish or roll back."],
    files: ["backend/app/api/routes/billing.py", "backend/app/services/plan_config_service.py", "backend/app/services/promo_service.py", "backend/app/services/offer_service.py"],
  },
  {
    id: "dfd-3-razorpay-activation",
    title: "Level 3: verified payment to active plan",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "The two routes a payment can arrive by, the checks each makes, and why activation happens exactly once.",
    source: String.raw`flowchart TD
  browser["Checkout success handler: POST /billing/razorpay/verify"]
  hook["Razorpay webhook: POST /billing/razorpay/webhook"]
  sig1{"Checkout signature valid?"}
  sig2{"Webhook signature valid with the webhook secret?"}
  e400["400 refused"]
  order["Fetch the order from Razorpay and compare its notes: teacher_id and plan_code"]
  match{"Notes match?"}
  mismatch["Refused"]
  event{"payment_events already has this payment id?"}
  nochange["Change nothing and return current status"]
  activate["activate_gateway_subscription: upsert teacher_subscriptions, status active, period by plan: 30, 90 or 365 days"]
  rec[("payment_events: razorpay.payment.verified, event_id is the payment id")]
  promo["finalize_promo_redemption_after_payment"]
  offer["mark_offer_redeemed"]
  status["get_billing_status returned to the browser"]
  raw["Webhook also stores the raw event once, unique by event id"]

  browser --> sig1
  sig1 -->|no| e400
  sig1 -->|yes| order --> match
  match -->|no| mismatch
  match -->|yes| event
  hook --> sig2
  sig2 -->|no| e400
  sig2 -->|yes| event
  hook --> raw
  event -->|yes| nochange
  event -->|no| activate --> rec
  activate --> promo --> offer --> status`,
    related: ["seq-checkout-razorpay", "state-subscription", "dfd-2-billing"],
    notes: ["If the browser callback and the webhook arrive together, a unique event id means only one of them activates the plan; the other changes nothing.", "A subscription whose period ends is moved to cancelled the next time its status is read."],
    files: ["backend/app/api/routes/billing.py", "backend/app/services/billing_service.py", "backend/app/models/billing.py"],
  },
  {
    id: "dfd-3-ad-credit",
    title: "Level 3: ad credit lifecycle",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "How a watched ad becomes a single-use credit, and how a credit or mark scheme unlock is stored and spent.",
    source: String.raw`flowchart TD
  start["POST /billing/ad/start: Free plan only, at most 6 a day"]
  consent{"Marketing cookies allowed?"}
  none["No ad shown, nothing unlocked"]
  token["Signed token: teacher, purpose, issued time"]
  show["Browser shows the ad or the 30 second card"]
  complete["POST /billing/ad/complete with the token"]
  check{"Token valid, this teacher and purpose, unused, 28 seconds to 15 minutes on the server clock?"}
  reject["Rejected"]
  credit[("teacher_quota_counters: ad_credit_purpose, daily")]
  msv[("teacher_quota_counters: msv_worksheetid, one mark scheme view")]
  generate["Next generate: reserve day, month and builder counters plus one credit"]
  view["Mark scheme view for that paper"]

  start --> consent
  consent -->|no| none
  consent -->|yes| token --> show --> complete --> check
  check -->|no| reject
  check -->|yes, topical or full portion| credit --> generate
  check -->|yes, ms_view| msv --> view`,
    related: ["seq-ad-unlock"],
    notes: ["Purposes are topical, full_portion and ms_view. The timing is judged on the server's clock, never the browser's.", "Credits and unlocks are stored in the same counters table as quotas, so one atomic statement spends them."],
    files: ["backend/app/services/ad_gate_service.py", "teacher-module/src/lib/adGate.tsx"],
  },
  {
    id: "dfd-3-ai-marking",
    title: "Level 3: marking one question with the LLM",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "How a page image becomes marks for a single question or part.",
    source: String.raw`flowchart TD
  pages["Page images from the upload"]
  match["Match each page region to a question using the paper layout and QR"]
  unmatched["Anything that cannot be matched goes to unmatched_questions"]
  ctx[("Worksheet, question text and mark scheme")]
  parts{"Question has parts?"}
  one["mark_question: send the question, scheme and the student's answer"]
  many["mark_question_by_parts: one request per part"]
  work["extract_part_workings_from_images: the model reads the handwriting into text"]
  prompt["Build the marking prompt from the mark scheme points"]
  llmCall["llm_client.complete_text: provider and model from settings"]
  parse["Parse marks per scheme point and a short feedback line"]
  cap["Clamp marks to the question total"]
  out["Result per question"]

  pages --> match --> work
  match --> unmatched
  ctx --> parts
  work --> parts
  parts -->|no| one --> prompt
  parts -->|yes| many --> prompt
  prompt --> llmCall --> parse --> cap --> out`,
    related: ["seq-ai-check-upload"],
    notes: ["Marks are given against the stored mark scheme points, so the same scheme drives the paper, the mark scheme page and the AI marking.", "The provider can be switched through environment settings; Gemini is the default."],
    files: ["backend/app/services/ai_marking.py", "backend/app/services/llm_client.py", "backend/app/services/paper_qr.py"],
  },
  {
    id: "dfd-3-seats-and-roles",
    title: "Level 3: seat, role and billing manager checks",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "How membership status and role decide what a person in an institute can do.",
    source: String.raw`flowchart TD
  action["A teacher action that touches the institute"]
  member{"organization_members row for this teacher, status active?"}
  deny["Refused: not a member, suspended or removed"]
  role["Read the role: individual_owner, institute_owner, institute_manager or institute_teacher"]
  billing{"Is it a billing action: buy, cancel, view institute bills?"}
  mgr{"require_billing_manager: owner or manager role?"}
  e403["403 refused"]
  ent["organization_entitlements: which features and limits the institute plan allows"]
  go["Allowed"]
  admin["Admin sets a member active, suspended or removed"]
  seats[("organization_members")]

  action --> member
  member -->|no| deny
  member -->|yes| role --> billing
  billing -->|yes| mgr
  mgr -->|no| e403
  mgr -->|yes| ent
  billing -->|no| ent
  ent --> go
  admin --> seats
  seats --> member`,
    related: ["er-organizations", "state-org-request"],
    notes: ["A person who joins an institute keeps their personal organization too.", "Seat counts are enforced when joining; pooled institute quotas are not built yet and are listed as an open item."],
    files: ["backend/app/services/organization_rbac.py", "backend/app/services/organization_seats.py", "backend/app/services/organization_entitlements.py"],
  },
  {
    id: "dfd-3-audit-write",
    title: "Level 3: one audited admin write",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "What the middleware records after an admin write, and how the audit row is read back.",
    source: String.raw`flowchart TD
  done["Route finished and committed"]
  mw["log_server_activity middleware, after the response"]
  bg["BackgroundTask so the response is never delayed"]
  should{"should_audit: POST, PUT, PATCH or DELETE under /api/admin, not login, refresh or logout?"}
  skip["Only the ordinary server log row is written"]
  rec["record_admin_write: actor, action label, route template, target ids, status code, outcome, ip, duration"]
  ev[("teacher_analytics_events: event_type admin_audit.write")]
  best["Best effort: any failure here is swallowed"]
  denied["Permission refused earlier: security event admin_permission_denied"]
  view["Audit Log page: GET /api/admin/audit-log, filter by actor, days, failed only"]
  evidence["Export evidence: account, security events, admin actions, server logs as JSON"]
  hist["Backups page history: last export and restore read from these rows"]

  done --> mw --> bg --> should
  should -->|no| skip
  should -->|yes| rec --> ev
  rec -.-> best
  denied --> ev
  ev --> view
  ev --> evidence
  ev --> hist`,
    related: ["sec-admin-rbac"],
    notes: ["Audit rows share the teacher_analytics_events table with analytics and security events, told apart by event_type.", "The audit trail needs no per-route code: any new admin write route is covered automatically."],
    files: ["backend/app/services/admin_audit.py", "backend/app/main.py", "docs/admin-audit-trail.md"],
  },
  {
    id: "dfd-3-backup-internals",
    title: "Level 3: what a backup contains and how restore is guarded",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "The backup format, what is left out on purpose and the steps a restore goes through.",
    source: String.raw`flowchart TD
  exportreq["Export request: format json or xlsx"]
  read["Read the tables in a read only transaction"]
  strip["Drop credential columns and tables: password hashes, refresh sessions, OTP tables, auth_message_outbox, admin accounts"]
  js["JSON file: schema admin-backup-v1, 20 tables, row lists"]
  xl["Workbook: Read Me sheet plus business sheets, India time ranges"]
  restore["Restore request with an uploaded backup file"]
  validate["Check the schema name and table list"]
  dry["Dry run: count rows per table that would be added"]
  typed{"Typed phrase matches?"}
  refuse["Refused"]
  tx["One transaction: for each table INSERT ... ON CONFLICT DO NOTHING"]
  summary["Rows added per table and rows skipped because they already existed"]
  audit["Audit row: who, when, counts"]

  exportreq --> read --> strip
  strip --> js
  strip --> xl
  restore --> validate --> dry
  dry -->|dry run only| summary
  dry -->|run| typed
  typed -->|no| refuse
  typed -->|yes| tx --> summary --> audit`,
    related: ["ops-backup-recovery"],
    notes: ["Because restore only inserts, it can recover deleted rows but cannot undo a wrong edit; that is what provider snapshots are for.", "Login credentials are never in a backup, so a restored system needs people to reset their passwords or use Google or phone sign-in."],
    files: ["backend/app/services/admin_backup_export.py", "docs/backup-and-restore.md"],
  },
  {
    id: "dfd-3-sql-console",
    title: "Level 3: one SQL statement through the console",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "Every check a statement passes before it can change data.",
    source: String.raw`flowchart TD
  text["Statement typed by the owner"]
  scrub["Scrub comments and string literals so they cannot hide a second statement"]
  single{"Exactly one statement?"}
  verbs{"Blocked verb or pattern: DROP, TRUNCATE, GRANT, COPY PROGRAM, functions that read files ...?"}
  restricted{"Touches a credential table or writes alembic_version?"}
  block["Blocked with the reason, never run"]
  risk["Classify: read, write, high or critical"]
  readp["Read: read only transaction, 15 second timeout, 500 row cap, sensitive columns masked"]
  dry["Write: run it in a transaction that is always rolled back, record the row count"]
  sign["Sign a review token with HMAC: admin, target and statement, valid 5 minutes"]
  ui["Review screen shows the statement, risk, row count, RLS and guard status"]
  phrase["Owner types RUN ON PRODUCTION or RUN ON TEST; a second phrase for high and critical"]
  pw["Owner re-enters the password: verify_password and lockout"]
  verify["Run route verifies the token matches this admin, target and statement"]
  run["Execute for real"]
  same{"Row count matches the dry run?"}
  rb["Roll back and report the difference"]
  ok["Commit and write admin_sql_run"]

  text --> scrub --> single
  single -->|no| block
  single -->|yes| verbs
  verbs -->|yes| block
  verbs -->|no| restricted
  restricted -->|yes| block
  restricted -->|no| risk
  risk -->|read| readp
  risk -->|write| dry --> sign --> ui --> phrase --> pw --> verify --> run --> same
  same -->|no| rb
  same -->|yes| ok`,
    related: ["seq-admin-sql-run"],
    notes: ["The review token is bound to the exact statement, so editing the SQL after review makes the token useless.", "An optional mode runs the statement as the restricted teacher role, to see what row level security would allow."],
    files: ["backend/app/services/sql_console_guard.py", "backend/app/services/admin_db_console.py", "backend/tests/test_admin_db_console.py"],
  },
  {
    id: "dfd-3-template-approval",
    title: "Level 3: approving a template",
    repo: "backend",
    family: "dfd",
    level: 3,
    summary: "The checks an approval runs under a row lock, and what it writes.",
    source: String.raw`flowchart TD
  approveClick["POST /api/templates/{id}/approve"]
  lock["SELECT FOR UPDATE on the template row"]
  status{"Status is draft?"}
  e409["Refused: already approved or not approvable"]
  schema["validate_template_schema"]
  draft["validate_template_draft: structure, variables, constraints, working and mark scheme"]
  guard["math_guard.audit_template: no leaking notation across sampled variants"]
  samples["Multi-sample verification with SymPy"]
  fail["Refused with the reasons; stays draft"]
  stats["store_template_stats: capacity, answers, wordings, combinations"]
  set["status approved, safe_to_generate true"]
  log[("template_approval_log: action approved, reviewer, notes, sample variants, verification summary")]
  bank["Template is now in the teacher bank"]

  approveClick --> lock --> status
  status -->|no| e409
  status -->|yes| schema --> draft --> guard --> samples
  schema -->|fail| fail
  draft -->|fail| fail
  guard -->|fail| fail
  samples -->|fail| fail
  samples -->|pass| stats --> set --> log --> bank`,
    related: ["state-template", "dfd-3-variant-engine"],
    notes: ["Admin state can later set a template to deprecated or deleted, which also forces safe_to_generate off.", "A separate safety pass can switch safe_to_generate off for an approved template at generation time without changing its status."],
    files: ["backend/app/api/routes/templates.py", "backend/app/services/template_schema_guard.py", "backend/app/services/template_stats.py", "backend/app/models/approval_log.py"],
  },
];
