import type { Diagram } from "../types";

// Database (ER) and state-machine diagrams. Checked against backend/app/models and the services named in each entry.
export const dataDiagrams: Diagram[] = [
  {
    id: "er-overview",
    title: "Database overview: every table and how they connect",
    repo: "backend",
    family: "er",
    summary: "All tables grouped by what they hold. Solid lines are real foreign keys; dotted lines are logical links through teacher_id that the database does not enforce.",
    source: String.raw`erDiagram
  templates ||--o{ template_approval_log : "FK template_id"
  organizations ||--o{ organization_members : "FK organization_id"
  organizations ||--o{ organization_requests : "FK organization_id, set null"
  teacher_profiles ||..o{ teacher_subscriptions : "teacher_id"
  teacher_profiles ||..o{ teacher_worksheet_drafts : "teacher_id"
  teacher_profiles ||..o{ teacher_quota_counters : "teacher_id"
  teacher_profiles ||..o{ teacher_template_usage : "teacher_id"
  teacher_profiles ||..o{ teacher_idempotency_records : "teacher_id"
  teacher_profiles ||..o{ teacher_analytics_events : "teacher_id"
  teacher_profiles ||..o{ organization_members : "teacher_id"
  teacher_profiles ||..|| teacher_auth_accounts : "teacher_id"
  teacher_profiles ||..o{ promo_code_redemptions : "teacher_id"
  promo_codes ||..o{ promo_code_redemptions : "promo_code_id"
  plan_offers ||..o{ teacher_offer_timers : "offer_id"
  templates ||..o{ worksheets : "template_ids"
  teacher_subscriptions ||..o{ payment_events : "teacher_id"
  admin_auth_accounts ||..o{ admin_refresh_sessions : "admin_id"
  teacher_auth_accounts ||..o{ teacher_refresh_sessions : "teacher_id"`,
    children: ["er-templates-worksheets", "er-teachers-auth", "er-billing", "er-organizations", "er-admin-platform"],
    related: ["dfd-2-retention", "sec-rls-enforcement"],
    notes: ["Only three real foreign keys exist in schema.sql: template_approval_log to templates, organization_members to organizations and organization_requests to organizations. Everything that points at a teacher uses the teacher_id text value and is not enforced by the database.", "Row level security keys on teacher_id, which is why the teacher tables all carry that column (see the RLS diagram).", "Admin audit rows are not a table of their own: they are teacher_analytics_events rows with event_type admin_audit.write."],
    files: ["backend/app/models/", "database/schema.sql", "backend/alembic/versions/"],
  },
  {
    id: "er-templates-worksheets",
    title: "Database: templates, approvals, worksheets and usage",
    repo: "backend",
    family: "er",
    summary: "The question bank and the paper-level records built from it.",
    source: String.raw`erDiagram
  templates {
    uuid id PK
    string template_code "unique, e.g. 0607_p2_geometry_cuboid_001"
    string status "draft, approved, deprecated, deleted"
    string syllabus_code
    string tier
    string topic
    string subtopic
    string difficulty
    int marks
    text question_template
    text answer_formula
    json variables
    json working_template
    json verification
    json metadata_json
    bool safe_to_generate
  }
  template_approval_log {
    uuid id PK
    uuid template_id FK
    string action
    string reviewer_name
    text notes
    json sample_variants
    json verification_summary
  }
  worksheets {
    uuid id PK
    string title
    string syllabus_code
    string topic
    int question_count
    json request_payload
    json generated_variants
    json template_ids
    string worksheet_pdf_path
    string answer_key_pdf_path
  }
  teacher_template_usage {
    uuid id PK
    string teacher_id
    string template_code
    int usage_count
    datetime last_used_at
  }
  teacher_worksheet_drafts {
    uuid id PK
    string teacher_id
    json draft_payload
    datetime updated_at
  }
  templates ||--o{ template_approval_log : "reviewed in"
  templates ||..o{ worksheets : "template_ids"
  templates ||..o{ teacher_template_usage : "template_code"`,
    related: ["state-template", "dfd-2-template-authoring", "dfd-3-template-approval", "dfd-2-generation"],
    notes: ["A template is never edited into a different question. Duplicates with identical wording inflate the capacity count, so extra copies are soft deleted by setting status to deleted.", "teacher_template_usage counts how many times a teacher has used a template code. It is what makes the Fresh version hint and the least-used-first selection possible.", "A plain SQL update does not move updated_at; the application code is what bumps it."],
    files: ["backend/app/models/template.py", "backend/app/models/approval_log.py", "backend/app/models/worksheet.py", "backend/app/models/teacher_usage.py", "backend/app/models/draft.py"],
  },
  {
    id: "er-teachers-auth",
    title: "Database: teacher profile and sign-in tables",
    repo: "backend",
    family: "er",
    summary: "Who a teacher is, how they sign in, and the short-lived codes and sessions around that.",
    source: String.raw`erDiagram
  teacher_profiles {
    uuid id PK
    string teacher_id "the shared key"
    string name
    string email
    string phone_e164
    bool email_verified
    bool phone_verified
    bool is_suspended
    bool is_test_account
    datetime last_login_at
  }
  teacher_auth_accounts {
    uuid id PK
    string teacher_id
    string email
    string password_hash
    datetime email_verified_at
    int token_version
    int failed_login_count
    datetime locked_until
  }
  teacher_refresh_sessions {
    uuid id PK
    string teacher_id
    string refresh_token_hash
    int token_version
    string user_agent
    string ip_address
    datetime expires_at
    datetime revoked_at
    uuid rotated_from_id
  }
  teacher_email_otps {
    uuid id PK
    string email
    string purpose
    string otp_hash
    int attempts
    int max_attempts
    datetime expires_at
    datetime consumed_at
  }
  teacher_phone_otps {
    uuid id PK
    string teacher_id
    string phone_e164
    string purpose
    string otp_hash
    int attempts
    int max_attempts
    datetime expires_at
    datetime consumed_at
  }
  auth_message_outbox {
    uuid id PK
    string channel "email or sms"
    string recipient
    string purpose
    string provider
    string status "mock, sent, failed"
    string teacher_id
  }
  teacher_profiles ||..|| teacher_auth_accounts : "teacher_id"
  teacher_auth_accounts ||..o{ teacher_refresh_sessions : "teacher_id"
  teacher_auth_accounts ||..o{ teacher_email_otps : "email"`,
    related: ["seq-teacher-email-signin", "seq-phone-otp-signin", "dfd-3-phone-otp", "sec-token-lifecycle", "state-auth-session-client"],
    notes: ["Only hashes are stored: the password, the refresh token and each one-time code are all hashed. The raw refresh token exists only in the cookie.", "token_version is a counter. Raising it makes every older access token and refresh session invalid at once, which is how Sign out everywhere works.", "The outbox table holds messages waiting to be sent so that a slow email or SMS provider never blocks the request."],
    files: ["backend/app/models/platform.py", "backend/app/services/teacher_account_auth.py", "backend/app/services/teacher_phone_auth.py", "backend/app/services/auth_outbox.py", "backend/app/services/auth_tokens.py"],
  },
  {
    id: "er-billing",
    title: "Database: plans, subscriptions, payments, quotas, promos and offers",
    repo: "backend",
    family: "er",
    summary: "Everything money or entitlement related, and the rows that stop one action from being counted twice.",
    source: String.raw`erDiagram
  plan_config_versions {
    uuid id PK
    string status "draft, published, archived"
    int version "unique once published"
    json config
    json change_summary
    string created_by
    string published_by
    int rolled_back_from
  }
  teacher_subscriptions {
    uuid id PK
    string teacher_id
    string gateway
    string plan_code
    string status "trial, active, cancelled"
    datetime current_period_start
    datetime current_period_end
  }
  payment_events {
    uuid id PK
    string gateway
    string event_id "unique per gateway"
    string event_type
    string teacher_id
    json payload
    datetime processed_at
  }
  teacher_quota_counters {
    uuid id PK
    string teacher_id
    string period_key
    string quota_name
    string plan_code
    int count
  }
  teacher_idempotency_records {
    uuid id PK
    string teacher_id
    string idempotency_key
    string scope
    string status "in_progress, completed, failed"
    json response_payload
  }
  promo_codes {
    uuid id PK
    string code
    string plan_code
    int discount_percent
    int max_redemptions
    int redemption_count
    datetime expires_at
    bool is_active
  }
  promo_code_redemptions {
    uuid id PK
    uuid promo_code_id
    string teacher_id
    string plan_code_granted
    datetime redeemed_at
  }
  plan_offers {
    uuid id PK
    string label
    string plan_code
    int discount_percent
    int duration_hours
    bool is_active
  }
  teacher_offer_timers {
    uuid id PK
    uuid offer_id
    string teacher_id
    datetime expires_at
    datetime redeemed_at
  }
  promo_codes ||..o{ promo_code_redemptions : "redeemed as"
  plan_offers ||..o{ teacher_offer_timers : "timer per teacher"
  teacher_subscriptions ||..o{ payment_events : "teacher_id"
  teacher_subscriptions ||..o{ teacher_quota_counters : "teacher_id"`,
    related: ["state-subscription", "state-idempotency", "dfd-2-billing", "dfd-3-quota-idempotency", "dfd-3-razorpay-activation", "dfd-3-price-and-order"],
    notes: ["payment_events has a unique key on gateway plus event_id, so a payment webhook delivered twice cannot activate a plan twice.", "teacher_quota_counters is keyed by teacher, period and quota name. The period key is what makes a monthly allowance reset without any scheduled job.", "plan_config_versions is the single source for prices and limits. Publishing assigns the next version number and archives the previous live one; a rollback copies an old config back into the draft and records rolled_back_from when published."],
    files: ["backend/app/models/billing.py", "backend/app/models/plan_config.py", "backend/app/models/promo.py", "backend/app/models/offer.py", "backend/app/services/billing_service.py", "backend/app/services/plan_config_service.py"],
  },
  {
    id: "er-organizations",
    title: "Database: institutes, members and requests",
    repo: "backend",
    family: "er",
    summary: "How a school or tuition centre is represented, who belongs to it, and how a request becomes a live organisation.",
    source: String.raw`erDiagram
  organizations {
    uuid id PK
    string organization_key
    string name
    string organization_type
    string status
    string created_by_teacher_id
    json feature_flags
  }
  organization_members {
    uuid id PK
    uuid organization_id FK
    string teacher_id
    string role
    string status
    bool is_default
    json permissions
    string invited_by_teacher_id
  }
  organization_requests {
    uuid id PK
    string source
    string teacher_id
    string institute_name
    string contact_email
    json requested_features
    int estimated_monthly_rupees
    string status "pending, approved, delivered, rejected"
    uuid organization_id FK
    string activation_token
    string activated_teacher_id
    string decided_by
    string rejection_reason
  }
  organizations ||--o{ organization_members : "has members"
  organizations ||--o{ organization_requests : "created from"`,
    related: ["state-org-request", "dfd-2-institutes", "dfd-3-seats-and-roles", "seq-institute-join"],
    notes: ["organization_requests.organization_id is set null on delete, so removing an organisation never deletes the history of the request.", "A member row carries a role and a permissions object, which is how an owner limits what a co-teacher can do inside the institute."],
    files: ["backend/app/models/organization.py", "backend/app/models/organization_request.py", "backend/app/services/organization_rbac.py", "backend/app/services/organization_seats.py", "backend/app/services/organization_requests.py"],
  },
  {
    id: "er-admin-platform",
    title: "Database: admin accounts, settings and the audit trail",
    repo: "backend",
    family: "er",
    summary: "The tables behind the admin panel: staff accounts, their sessions, platform switches, support tickets and the event log used for audit.",
    source: String.raw`erDiagram
  admin_auth_accounts {
    uuid id PK
    string email
    string name
    string role
    string password_hash
    bool active
    int token_version
    int failed_login_count
    datetime locked_until
  }
  admin_refresh_sessions {
    uuid id PK
    uuid admin_id
    string refresh_token_hash
    int token_version
    string ip_address
    datetime expires_at
    datetime revoked_at
    uuid rotated_from_id
  }
  platform_settings {
    uuid id PK
    string key
    json value
    string updated_by
    text reason
  }
  teacher_analytics_events {
    uuid id PK
    string teacher_id
    string event_type "includes admin_audit.write"
    json payload
    datetime occurred_at
  }
  teacher_support_tickets {
    uuid id PK
    string teacher_id
    string ticket_type
    text message
    string status
  }
  admin_auth_accounts ||..o{ admin_refresh_sessions : "admin_id"`,
    related: ["sec-admin-rbac", "dfd-2-admin-audit", "dfd-3-audit-write", "seq-admin-login"],
    notes: ["There is no separate audit table. Every admin write request is recorded by one hook as a teacher_analytics_events row with event_type admin_audit.write, and request bodies are never stored.", "platform_settings holds things like maintenance mode as key and JSON value, with who changed it and why."],
    files: ["backend/app/models/platform.py", "backend/app/services/admin_audit.py", "backend/app/services/admin_auth.py"],
  },
  {
    id: "state-template",
    title: "State machine: a question template",
    repo: "backend",
    family: "state",
    summary: "The four statuses a template can have and what moves it between them.",
    source: String.raw`stateDiagram-v2
  [*] --> draft : uploaded from the dashboard
  draft --> approved : approve route, after schema and sample checks pass
  approved --> draft : full JSON replaced, review needed again
  draft --> deprecated : admin state change
  approved --> deprecated : retired
  approved --> deleted : soft delete, for example a duplicate
  draft --> deleted
  deprecated --> deleted
  deprecated --> approved : admin state change
  deleted --> draft : admin state change
  note right of approved
    Only approved templates with safe_to_generate
    are offered to teachers
  end note`,
    related: ["er-templates-worksheets", "dfd-3-template-approval", "seq-template-ingestion"],
    notes: ["The admin state route accepts any of draft, approved, deprecated and deleted, so every move between them is possible; the arrows above are the ones used in practice. Setting deprecated or deleted also turns safe_to_generate off.", "safe_to_generate can be switched on only while the status is approved.", "Replacing a template's JSON always returns it to draft with safe_to_generate off, and writes a json_replaced entry to the approval log.", "Deleting is soft: the row stays so old worksheets that used it still make sense."],
    files: ["backend/app/api/routes/templates.py", "backend/app/services/template_safety.py"],
  },
  {
    id: "state-subscription",
    title: "State machine: a teacher subscription",
    repo: "backend",
    family: "state",
    summary: "Trial, active and cancelled, and what moves a teacher between them.",
    source: String.raw`stateDiagram-v2
  [*] --> trial : trial plan assigned
  [*] --> active : free, paid, promo or admin grant
  trial --> active : payment verified, promo or admin grant
  active --> active : renewal or plan change
  active --> cancelled : cancelled, or current period ended
  trial --> cancelled : cancelled, or trial period ended
  cancelled --> active : new payment, promo or grant
  note right of active
    trial and active can generate papers.
    cancelled can not.
  end note`,
    related: ["er-billing", "dfd-2-billing", "dfd-3-razorpay-activation", "seq-checkout-razorpay", "seq-admin-refund"],
    notes: ["GENERATING_STATUSES in the billing service is trial and active: only those two allow paper generation.", "Expiry is checked when the subscription is read: if current_period_end has passed, the status is set to cancelled. Older code had a separate expired status; it was folded into cancelled on 2026-09-21.", "The plan code (free, trial, teacher_monthly, teacher_quarterly, teacher_yearly, and institute or custom) is separate from the status.", "A demo fallback source gives full access in local development when billing tables are not set up."],
    files: ["backend/app/services/billing_service.py", "backend/app/models/billing.py"],
  },
  {
    id: "state-idempotency",
    title: "State machine: an idempotency record",
    repo: "backend",
    family: "state",
    summary: "How a repeated request with the same key is answered instead of being done twice.",
    source: String.raw`stateDiagram-v2
  [*] --> in_progress : first request claims the key
  in_progress --> completed : work finished, response stored
  in_progress --> failed : work failed
  in_progress --> in_progress : same key arrives while running, caller told to wait
  in_progress --> failed : stale after 15 minutes, taken over
  completed --> completed : same key returns the stored response
  failed --> in_progress : retry claims the key again`,
    related: ["er-billing", "dfd-3-quota-idempotency"],
    notes: ["A record that stays in progress for more than 15 minutes is treated as stale, so a crashed worker cannot block a teacher forever.", "The point is that a double click or a retried network call never spends a second unit of the teacher's quota."],
    files: ["backend/app/models/billing.py", "backend/app/services/billing_service.py"],
  },
  {
    id: "state-org-request",
    title: "State machine: an institute request",
    repo: "backend",
    family: "state",
    summary: "From a teacher or website enquiry to a delivered institute account.",
    source: String.raw`stateDiagram-v2
  [*] --> pending : request submitted
  pending --> approved : admin approves, organisation created
  pending --> rejected : admin rejects with a reason
  approved --> delivered : activation token used, owner account linked
  rejected --> [*]
  delivered --> [*]`,
    related: ["er-organizations", "dfd-2-institutes", "seq-institute-join"],
    notes: ["Approval creates the organisation and the activation token; delivery happens when the owner uses that token.", "Who decided and when is stored on the request (decided_by, decided_at)."],
    files: ["backend/app/services/organization_requests.py", "backend/app/models/organization_request.py"],
  },
  {
    id: "state-plan-config",
    title: "State machine: a plan configuration version",
    repo: "backend",
    family: "state",
    summary: "How a pricing and limits change goes from draft to live, and how a rollback works.",
    source: String.raw`stateDiagram-v2
  [*] --> draft : admin edits the draft
  draft --> published : publish, next version number, becomes live
  draft --> [*] : discarded
  published --> archived : a newer version is published
  archived --> draft : rollback copies an old config into the draft
  note right of published
    Exactly one version is live.
    Changes take effect without a deploy.
  end note`,
    related: ["er-billing", "dfd-3-price-and-order"],
    notes: ["The status column holds draft, published or archived. Drafts have no version number; publishing assigns 1, 2, 3 and so on.", "Rollback does not rewind history: it puts an old config back as a draft and, once published, records rolled_back_from."],
    files: ["backend/app/services/plan_config_service.py", "backend/app/services/plan_config_registry.py", "backend/app/models/plan_config.py"],
  },
  {
    id: "state-auth-session-client",
    title: "State machine: the browser sign-in session",
    repo: "teacher",
    family: "state",
    summary: "What the teacher module is doing at each moment of a sign-in, from the first page load to sign-out.",
    source: String.raw`stateDiagram-v2
  [*] --> restoring : page loads, no token in memory
  restoring --> signedIn : refresh cookie valid, new access token
  restoring --> signedOut : no cookie or refresh rejected
  signedOut --> signingIn : form submitted
  signingIn --> signedIn : 200 with token
  signingIn --> signedOut : 401, 403 or 429 shown to the user
  signedIn --> refreshing : access token near expiry or a 401 came back
  refreshing --> signedIn : refresh rotated
  refreshing --> signedOut : refresh rejected
  signedIn --> signedOut : sign out or sign out everywhere`,
    related: ["seq-teacher-email-signin", "seq-token-refresh", "sec-token-lifecycle", "er-teachers-auth"],
    notes: ["The access token is kept in memory only; on every full page load the module goes through restoring using the refresh cookie.", "Entering signedOut clears the builder drafts so the next person on a shared computer does not see them."],
    files: ["teacher-module/src/lib/", "teacher-module/src/pages/_app.tsx"],
  },
  {
    id: "state-worksheet-flow",
    title: "State machine: the topical paper builder stages",
    repo: "teacher",
    family: "state",
    summary: "The five stages of the builder (choices, easy, medium, hard, preview) and the draft that lets a teacher come back to where they stopped.",
    source: String.raw`stateDiagram-v2
  [*] --> choices : open Build a topical paper
  choices --> easy : topics and filters chosen
  easy --> medium : easy bucket filled, Continue or auto advance
  medium --> hard : medium bucket filled
  hard --> preview : hard bucket filled
  preview --> easy : change questions
  preview --> medium
  preview --> hard
  preview --> generating : Generate
  generating --> result : paper ready
  generating --> blocked : quota or plan gate
  blocked --> preview : Back to paper, draft restored
  result --> [*]`,
    related: ["teacher-builder-flow", "teacher-preview-modal-flow", "teacher-billing-client-flow", "dfd-2-generation", "seq-topical-generation"],
    notes: ["Stage ids in the code are choices, easy, medium, hard and preview (StageId in workspaceBuilder.ts).", "The draft is restored before any automatic navigation runs. If the order were reversed, an empty selection would send the teacher back to Easy.", "The Continue button shows as soon as a bucket is full, so a teacher is never forced to wait for an automatic advance."],
    files: ["teacher-module/src/lib/workspaceBuilder.ts", "teacher-module/src/pages/workspace.tsx", "teacher-module/src/hooks/workspace/useLocalDraft.ts", "teacher-module/src/hooks/workspace/useWorkspaceStageNavigation.ts", "teacher-module/src/components/workspace/SelectionStages.tsx"],
  },
];
