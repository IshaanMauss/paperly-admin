export type TemplateSummary = {
  id: string;
  template_code: string;
  template_type: string;
  status: string;
  syllabus_code: string;
  tier: string;
  topic: string;
  subtopic?: string | null;
  difficulty: string;
  marks?: number | null;
  question_text: string;
  marking_scheme_text?: string | null;
  question_template: string;
  answer_formula: string;
  variables: Record<string, unknown>;
  constraints: Array<Record<string, unknown>>;
  working_template: string[];
  verification: Record<string, unknown>;
  parts: Array<Record<string, unknown>>;
  metadata_json?: Record<string, unknown>;
  source_reference?: string | null;
  safe_to_generate: boolean;
  created_at: string;
  updated_at: string;
};

export type TemplateListResponse = { total: number; items: TemplateSummary[] };

export type AdminListResponse<T> = { total: number; items: T[]; source?: string };

export type AdminTeacherRow = {
  teacher_id: string;
  name?: string | null;
  email?: string | null;
  school?: string | null;
  phone?: string | null;
  email_verified?: boolean;
  phone_verified?: boolean;
  is_test_account?: boolean;
  account_role?: string | null;
  account_segment?: "individual" | "institute" | string | null;
  onboarding_completed?: boolean;
  onboarding_source?: string | null;
  onboarding_goal?: string | null;
  profile_completion?: number;
  profile_updated_at?: string | null;
  plan_code: string;
  subscription_status: string;
  templates_used: number;
  total_template_uses: number;
  analytics_events: number;
  last_activity_at?: string | null;
};

export type MaintenanceStatus = {
  maintenance_active: boolean;
  title: string;
  message: string;
  reason?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
  source?: string;
  required_confirmation_to_enable: string;
  required_confirmation_to_disable: string;
};

export type AdminQuestionReportContext = {
  kind?: string;
  reason?: string;
  note?: string;
  mode?: string;
  template_code?: string;
  syllabus_code?: string;
  paper_code?: string | null;
  tier?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  variables?: Record<string, unknown>;
  question_text?: string;
  answer_text?: string;
  worksheet_id?: string | null;
};

export type AdminSupportTicketRow = {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  guest_matches_teacher_id?: string;
  guest_matches_teacher_name?: string;
  ticket_type?: string;
  type?: string;
  message: string;
  status: string;
  created_at: string;
  // "customer" = a signed-in teacher's ticket (real teacher_id). "guest" = the
  // signed-out "Ask us anything" widget, whose ticket carries a synthetic
  // "guest:<token>" teacher_id since there's no account to attach it to.
  requester_type?: "customer" | "guest";
  // Added 2026-09-28: previously there was nothing to resolve/reply into -
  // only GET /support-tickets existed. See api.resolveSupportTicket.
  admin_reply?: string | null;
  // Only on "question_report" tickets (the teacher's "This looks wrong" button).
  context_json?: AdminQuestionReportContext | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
};

export type AdminSubscriptionRow = {
  id: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  plan_code: string;
  status: string;
  gateway: string;
  current_period_end?: string | null;
  updated_at?: string | null;
};

export type AdminPaymentEventRow = {
  id: string;
  gateway: string;
  event_id?: string | null;
  event_type: string;
  teacher_id?: string | null;
  processed_at?: string | null;
  created_at: string;
  teacher_name?: string;
  teacher_email?: string;
};

export type AdminOverview = {
  users_tracked: number;
  active_trial_plans: number;
  payment_events: number;
  template_uses: number;
  open_support_tickets: number;
  generated_at?: string | null;
  source?: string;
};

export type FullPortionOverview = {
  full_portion_worksheets: number;
  topical_worksheets: number;
  full_portion_with_required_subtopics: number;
  average_required_subtopics: number;
  usage?: {
    full_portion?: BuilderUsage;
    topical?: BuilderUsage;
    ai_checking?: { checks_total: number; checks_30d: number; unique_users_total: number; unique_users_30d: number };
  };
  plan_limits?: {
    plans: BuilderPlanLimits[];
    hidden_plans: { plan_code: string; reason: string }[];
  };
  source?: string;
};

export type BuilderUsage = {
  papers_total: number;
  papers_7d: number;
  papers_30d: number;
  unique_users_total: number;
  unique_users_30d: number;
};

export type BuilderPlanLimits = {
  plan_code: string;
  plan_label: string;
  paper_limit: number | null;
  paper_limit_window: string | null;
  max_questions_per_paper: number | null;
  full_portion_topics_per_paper: number | null;
  full_portion_papers_per_day: number | null;
  full_portion_papers_per_month: number | null;
  ai_checks_per_month: number | null;
  can_view_mark_scheme: boolean;
  can_use_popular_filter: boolean;
};

export type SubtopicCapPlanRow = {
  plan_code: string;
  plan_label: string;
  default_max_subtopics_per_topic: number | null;
  effective_max_subtopics_per_topic: number | null;
  is_overridden: boolean;
};

export type SubtopicCapSettings = {
  plans: Record<string, SubtopicCapPlanRow>;
  source?: string;
};

export type CheckingOverview = {
  total_checks: number;
  checks_last_7_days: number;
  checks_last_30_days: number;
  distinct_teachers: number;
  source?: string;
};

export type VariantHealthRisk = "exhausted" | "watch" | "healthy" | "unknown";

export type TemplateStatKind = "exact" | "estimate" | "very_large" | "unknown";

export type TemplateStats = {
  combinations: number | null;
  combinations_kind: TemplateStatKind;
  answers: number | null;
  answers_kind: TemplateStatKind;
  wordings: number;
  part_wordings_max: number | null;
  draws?: number;
  note?: string;
  computed_at?: string;
};

export type VariantHealthRow = {
  created_at: string | null;
  updated_at: string | null;
  approved_at: string | null;
  stats: TemplateStats | null;
  template_id: string;
  template_code: string;
  template_type: string;
  topic: string;
  subtopic?: string | null;
  difficulty: string;
  paper_code?: string | null;
  popular_igcse: boolean;
  capacity: number | null;
  capacity_uncertain: boolean;
  capacity_capped: boolean;
  capacity_exact?: boolean;
  total_usage_count: number;
  distinct_teachers_used: number;
  mean_usage_per_teacher: number | null;
  median_usage_per_teacher: number | null;
  stdev_usage_per_teacher: number | null;
  min_usage_per_teacher: number | null;
  max_usage_per_teacher: number | null;
  usage_ratio: number | null;
  risk: VariantHealthRisk;
  sibling_count_subtopic: number;
  sibling_count_topic: number;
  total_worksheets_included: number;
  exported_worksheets_included: number;
  never_exported_worksheets_included: number;
  excluded_anonymous_worksheets: number;
  excluded_test_worksheets: number;
  excluded_test_usage: number;
};

export type VariantHealthOverview = {
  rows: VariantHealthRow[];
  summary: { exhausted: number; watch: number; healthy: number; unknown: number; total: number };
  generated_at: string;
};

export type RlsTableRow = {
  table_name: string;
  rls_enabled: boolean;
};

export type RlsStatus = {
  tables: RlsTableRow[];
  source?: string;
};

export type WorksheetCleanupResult = {
  dry_run: boolean;
  unexported_worksheets_deleted: number;
  exported_worksheets_deleted: number;
  files_removed_from_disk: number;
  unexported_retention_days: number;
  exported_retention_days: number;
};

export type AdminSecurityEventRow = {
  id: string;
  teacher_id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  account_type?: string | null;
  plan_code?: string | null;
  subscription_status?: string | null;
  event_type: string;
  status?: string;
  status_meaning?: string;
  severity: string;
  reason: string;
  payload?: Record<string, unknown>;
  occurred_at?: string | null;
  created_at?: string | null;
};

export type AdminServerLogRow = {
  id: string;
  actor: string;
  outcome: "success" | "error";
  method?: string | null;
  path?: string | null;
  status_code?: number | null;
  duration_ms?: number | null;
  ip?: string | null;
  user_agent?: string | null;
  error_detail?: string | null;
  occurred_at?: string | null;
  // Added 2026-09-28: per-row acknowledge, alongside the existing
  // all-or-nothing DELETE /server-logs reset.
  acknowledged?: boolean;
  acknowledged_by?: string | null;
  acknowledged_at?: string | null;
  // Added by the backend's name enrichment when the actor is a known user.
  actor_name?: string;
  actor_email?: string;
};

export type ServerLogProblemGroup = {
  method: string;
  path: string;
  status_code: number;
  count: number;
  unique_users: number;
  anonymous_requests: number;
  sample_users: string[];
  last_seen: string | null;
  acknowledged: number;
  sample_error: string | null;
  meaning: string;
  action: string;
};

export type AdminServerLogSummary = {
  scanned: number;
  classes: Record<string, number>;
  top_codes: { status_code: number; count: number }[];
  problem_groups?: ServerLogProblemGroup[];
  source: string;
};

export type OrganizationTheme = {
  mode: string;
  background: string;
  primary: string;
  accent: string;
  display_name?: string;
  tagline?: string;
  logo_url?: string;
};

export type InstituteConfig = {
  enabled: boolean;
  base_plan: string;
  valid_until: string | null;
  limits: Record<string, number | null>;
  seats: { max: number | null; join_code: string | null; allowed_email_domains: string[]; require_domain: boolean };
  notes: string;
};

export type InstituteLimitRow = {
  key: string;
  label: string;
  help: string;
  base_value: number | null;
  effective_value: number | null;
  mode: "default" | "custom" | "unlimited";
  value: number | null;
};

export type InstituteMember = {
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  role: string;
  status: string;
  joined_at: string | null;
  last_login_at: string | null;
  papers_30d: number;
  ai_checks_30d: number;
};

export type InstituteOverview = {
  organization: OrganizationRow;
  config: InstituteConfig;
  base_plan: { code: string; label: string; choices: { code: string; label: string }[] };
  limits: InstituteLimitRow[];
  seats: { used: number; max: number | null; join_code: string | null; join_link: string | null; allowed_email_domains: string[]; require_domain: boolean };
  members: InstituteMember[];
  checklist: { key: string; label: string; done: boolean; detail: string | null }[];
  expired: boolean;
  ready: boolean;
};

export type OrganizationRow = {
  id: string;
  organization_key: string;
  name: string;
  organization_type: string;
  status: string;
  theme: OrganizationTheme;
  feature_flags: Record<string, boolean>;
  created_at: string | null;
  updated_at: string | null;
};

export type OrganizationsMeta = {
  theme_presets: Record<string, OrganizationTheme>;
  feature_flags: Record<string, { label: string; description: string }>;
};

export type OrganizationRequestRow = {
  id: string;
  source: string;
  teacher_id: string | null;
  teacher_name?: string;
  teacher_email?: string;
  institute_name: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  requested_features: string[];
  notes: string | null;
  estimated_monthly_rupees: number | null;
  status: string;
  organization_id: string | null;
  activation_link: string | null;
  activated_teacher_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminAuthAccountRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  active: boolean;
  last_login_at?: string | null;
};

export type AdminAccountsMeta = {
  roles: string[];
  permission_keys: string[];
};

export type CreateAdminAccountPayload = {
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export type UpdateAdminAccountPayload = {
  name?: string;
  role?: string;
  permissions?: string[];
  active?: boolean;
};

export type AdminPageParams = {
  limit?: number;
  offset?: number;
  search?: string;
  segment?: string;
  role?: string;
  plan?: string;
  activity?: string;
  test_account?: string;
  status?: string;
  ticket_type?: string;
  requester_type?: string;
  syllabus?: string;
  mode?: string;
  gateway?: string;
  event_type?: string;
  severity?: string;
  sort?: string;
  outcome?: string;
  method?: string;
  status_code?: number;
  status_class?: string;
};

export type TemplateDraftResponse = { extraction: Record<string, unknown>; draft_template: Record<string, unknown>; draft_validation: Record<string, unknown> };

export type PreviewSample = {
  variables: Record<string, unknown>;
  passed: boolean;
  answer?: string | null;
  expected_answer?: string | null;
  reason: string;
  checks: Array<Record<string, unknown>>;
  rejection_reasons: string[];
  parts: Array<Record<string, unknown>>;
};

export type PreviewResponse = { passed: boolean; summary: string; samples: PreviewSample[] };

export type WorksheetQuestion = {
  question_number: number;
  template_id: string;
  template_code: string;
  template_type?: string;
  question_text: string;
  answer?: string | null;
  answer_display?: string | null;
  marks?: number | null;
  mark_scheme?: Record<string, unknown>;
  parts?: Array<Record<string, unknown>>;
};

export type WorksheetGeneratePayload = {
  title: string;
  syllabus_code: string;
  topic: string;
  subtopic?: string | null;
  difficulty?: string | null;
  question_form?: string | null;
  template_code?: string | null;
  count: number;
};

export type TopicalPaperGeneratePayload = {
  title: string;
  syllabus_code: string;
  paper_code: string;
  topic: string;
  subtopics: string[];
  count: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  require_figure: boolean;
  selected_template_codes?: string[];
  diagram_filter?: "all" | "with_figure" | "without_figure";
};

export type Worksheet = {
  id: string;
  title: string;
  syllabus_code: string;
  topic: string;
  difficulty?: string | null;
  question_form?: string | null;
  question_count: number;
  questions: WorksheetQuestion[];
  worksheet_pdf_path?: string | null;
  answer_key_pdf_path?: string | null;
  worksheet_image_path?: string | null;
  answer_key_image_path?: string | null;
};

export type PromoCode = {
  id: string;
  code: string;
  label: string | null;
  plan_code: string;
  plan_label: string;
  discount_percent: number;
  max_redemptions: number | null;
  redemption_count: number;
  redemptions_remaining: number | null;
  expires_at: string | null;
  is_active: boolean;
  is_expired: boolean;
  is_exhausted: boolean;
  is_redeemable: boolean;
  created_by: string | null;
  created_at: string | null;
};

export type PromoCodeListResponse = {
  codes: PromoCode[];
  plan_options: Record<string, string>;
};

export type PromoCodeRedemptionRow = {
  teacher_id: string;
  teacher_name: string | null;
  teacher_email: string | null;
  plan_code_granted: string;
  redeemed_at: string | null;
};

export type UserResolveHit = {
  teacher_id: string;
  name: string;
  email: string;
  is_test_account: boolean;
};

export type UserThreeSixtyTimelineItem = {
  kind: "account" | "payment" | "promo" | "support" | "usage" | "security" | "activity" | "request" | "admin_action";
  status: "success" | "warning" | "error";
  at: string | null;
  title: string;
  detail: string | null;
};

export type UserPaymentDetail = {
  id: string;
  at: string | null;
  processed_at: string | null;
  gateway: string;
  event_type: string;
  event_id: string | null;
  outcome: "paid" | "failed" | "started" | "other";
  amount_paise: number | null;
  taxable_value_paise: number | null;
  gst_amount_paise: number | null;
  gst_rate_percent: number | null;
  currency: string | null;
  plan_code: string | null;
  order_id: string | null;
  payment_id: string | null;
  promo_code: string | null;
  discount_percent: number | null;
  offer_id: string | null;
  gateway_details: Record<string, string | number | boolean | null>;
  customer_at_payment: Record<string, string | null>;
  client: Record<string, string | null>;
  plan_period: Record<string, string | null>;
  billable: boolean;
  bill_number: string | null;
  amount_saved: boolean;
};
export type UserDisputeCheck = { label: string; result: "yes" | "no" | "unknown" | "info"; evidence: string };
export type UserMessageRow = { at: string | null; channel: string; recipient: string; purpose: string; provider: string; status: string; error: string | null };
export type UserTicketRow = {
  id: string;
  type: string;
  status: string;
  message: string;
  created_at: string | null;
  admin_reply: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
};
export type UserSignInBlock = {
  email: string;
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  has_password: boolean;
  created_at: string | null;
  last_login_at: string | null;
  distinct_ips: string[];
  session_count: number;
};

export type UserUsageEntry = { used: number; limit: number | null; window?: string };
export type UserThreeSixty = {
  payments_detail?: UserPaymentDetail[];
  dispute_checks?: UserDisputeCheck[];
  messages?: UserMessageRow[];
  tickets?: UserTicketRow[];
  sign_in?: UserSignInBlock;
  usage_summary?: {
    usage: Record<string, UserUsageEntry> | null;
    resets: { day: string; month: string } | null;
    plan_label: string;
  } | null;
  worksheets: {
    worksheet_id: string;
    title: string;
    created_at: string | null;
    pdf_ready: boolean;
  }[];
  profile: {
    teacher_id: string;
    name: string;
    email: string;
    school: string | null;
    phone: string | null;
    email_verified: boolean;
    phone_verified: boolean;
    is_test_account: boolean;
    is_suspended?: boolean;
    suspended_at?: string | null;
    suspended_by?: string | null;
    suspended_reason?: string | null;
    created_at: string | null;
    last_login_at: string | null;
  };
  subscription: {
    plan_code: string;
    status: string;
    gateway: string;
    current_period_start: string | null;
    current_period_end: string | null;
  } | null;
  auth: {
    email_verified_at: string | null;
    failed_login_count: number;
    locked_until: string | null;
    token_version: number;
  } | null;
  active_sessions: {
    created_at: string | null;
    last_seen_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
    ip_address: string | null;
    user_agent: string | null;
  }[];
  counts: {
    payments: number;
    promo_redemptions: number;
    support_tickets: number;
    open_support_tickets: number;
    worksheets_generated: number;
    failed_payments_30d: number;
    request_errors_recorded: number;
  };
  red_flags: string[];
  promo_redemptions: {
    id: string;
    code: string;
    label: string | null;
    plan_code_granted: string;
    redeemed_at: string | null;
  }[];
  timeline: UserThreeSixtyTimelineItem[];
};

export type PlanOffer = {
  id: string;
  label: string;
  plan_code: string;
  plan_label: string;
  discount_percent: number;
  duration_hours: number;
  audience_plans: string[];
  style: "shiny" | "starry" | "plain";
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  is_live: boolean;
  shown_count: number | null;
  redeemed_count: number | null;
  created_by: string | null;
  created_at: string | null;
};

export type PlanOfferListResponse = {
  offers: PlanOffer[];
  options: { plans: Record<string, string>; audience: Record<string, string>; styles: string[] };
};

// Admin-editable plans (2026-10-02). See backend app/services/plan_config_service.py.
export type PlanRowValue = { label: string; value: string; included: boolean; info?: string };
export type PlanFieldKind = "int" | "bool" | "enum" | "text" | "lines" | "rows";
export type PlanField = {
  key: string;
  group: string;
  label: string;
  kind: PlanFieldKind;
  help: string;
  enforced: boolean;
  editable: boolean;
  snapshot: boolean;
  plans: string[];
  min?: number;
  max?: number;
  nullable?: boolean;
  unit?: string;
  options?: string[];
  max_len?: number;
  max_items?: number;
};
export type PlanFieldValue = number | boolean | string | string[] | PlanRowValue[] | null;
export type PlanValues = Record<string, PlanFieldValue>;
export type PlanConfigSparse = { plans: Record<string, PlanValues> };
export type PlanConfigChange = {
  plan_code: string;
  plan_label: string;
  key: string;
  label: string;
  group: string;
  before: PlanFieldValue;
  after: PlanFieldValue;
  grandfathered: boolean;
};
export type PlanConfigVersionMeta = {
  id: string;
  status: "draft" | "published" | "archived";
  version: number | null;
  note?: string | null;
  created_by?: string | null;
  published_by?: string | null;
  rolled_back_from?: number | null;
  created_at?: string | null;
  published_at?: string | null;
  change_summary: PlanConfigChange[];
};
export type PlanConfigState = {
  schema: { groups: { key: string; label: string; help: string }[]; fields: PlanField[]; plan_codes: string[]; paid_plan_codes: string[] };
  defaults: Record<string, PlanValues>;
  published: { version: number | null; config: PlanConfigSparse; plans: Record<string, PlanValues> };
  draft: (PlanConfigVersionMeta & { config: PlanConfigSparse }) | null;
  working_plans: Record<string, PlanValues>;
  history: PlanConfigVersionMeta[];
  subscribers: Record<string, number>;
};
export type PlanConfigPreview = {
  has_draft: boolean;
  changes: PlanConfigChange[];
  warnings: string[];
  price_changed?: boolean;
  plans: Record<string, PlanValues>;
  subscribers?: Record<string, number>;
  note?: string | null;
};

export type TestFailureInfo = {
  error_type: string;
  technical: string;
  plain: string;
  fix: string;
  file: string | null;
  line: number | null;
  function: string | null;
  code: { n: number; text: string; hit: boolean }[];
};

export type TestCheckResult = {
  status: "pass" | "fail" | "warn" | "skipped" | "blocked";
  detail?: string | null;
  fix?: string | null;
  ms?: number | null;
  at?: string | null;
  error?: TestFailureInfo | null;
};

export type TestCheckRow = {
  id: string;
  section: string;
  title: string;
  what: string;
  mode: string;
  last: TestCheckResult | null;
  flaky: boolean;
  durations: number[];
  removable: boolean;
};

export type TestRunRecord = {
  id: string;
  status: "running" | "finished" | "crashed";
  started_at: string;
  finished_at: string | null;
  total: number;
  done: number;
  current: string | null;
  ids: string[];
  results: Record<string, TestCheckResult>;
};

export type TestCenterOverview = {
  environment: { environment: string; production_like?: boolean; production?: boolean; razorpay_mode: string; database_host: string; test_database?: TestDatabaseReport };
  sections: string[];
  checks: TestCheckRow[];
  active_run: TestRunRecord | null;
};

export type TestCoverage = {
  routes_total: number;
  functions_total: number;
  admin_routes_guarded: number;
  routes_untested: { method: string; path: string; name: string; target: string }[];
  functions_untested: { module: string; name: string; file: string; line: number; target: string }[];
};

export type TestDatabaseReport = {
  safe: boolean;
  reasons: string[];
  host: string;
  is_local: boolean;
  has_marker: boolean;
  counts?: { users: number; institutes: number; promo_codes: number } | null;
  sample_password?: string | null;
  join_code?: string | null;
};

export type AuthStatus = {
  environment: string;
  email: { mode: "smtp" | "mock"; configured: boolean };
  sms: { provider: string; configured: boolean; phone_login_enabled: boolean; daily_cap: number };
  otp: { minutes: number; max_attempts: number };
  /** True when the server stores the readable text of each code (mock mode, never in production). */
  shows_code_text: boolean;
};

export type AuthOutboxMessage = {
  id: string;
  channel: "email" | "sms";
  recipient: string;
  purpose: string;
  provider: string;
  status: "mock" | "sent" | "failed";
  body: string | null;
  error: string | null;
  teacher_id: string | null;
  created_at: string | null;
};

export type AuthProbeResult = {
  ok: boolean;
  error: string | null;
  code_visible: boolean;
  message: AuthOutboxMessage | null;
};
