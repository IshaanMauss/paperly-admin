import { getAdminAccessToken } from "@/lib/adminToken";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

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
export type AdminSupportTicketRow = {
  id: string;
  teacher_id: string;
  ticket_type?: string;
  type?: string;
  message: string;
  status: string;
  created_at: string;
};
export type AdminSubscriptionRow = {
  id: string;
  teacher_id: string;
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
  source?: string;
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

export type VariantHealthRow = {
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
};

export type AdminServerLogSummary = {
  scanned: number;
  classes: Record<string, number>;
  top_codes: { status_code: number; count: number }[];
  source: string;
};

export type OrganizationTheme = {
  mode: string;
  background: string;
  primary: string;
  accent: string;
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

type AdminPageParams = {
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
  gateway?: string;
  event_type?: string;
  severity?: string;
  sort?: string;
  outcome?: string;
  method?: string;
  status_code?: number;
  status_class?: string;
};

function adminQuery(params?: AdminPageParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAdminAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function formRequest<T>(path: string, formData: FormData): Promise<T> {
  const token = getAdminAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

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
  plan_code_granted: string;
  redeemed_at: string | null;
};

export const api = {
  listTemplates(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    return request<TemplateListResponse>(`/templates${query ? `?${query}` : ""}`);
  },
  createTemplate(payload: unknown) {
    return request<TemplateSummary>("/templates", { method: "POST", body: JSON.stringify(payload) });
  },
  approveTemplate(templateId: string, payload: unknown) {
    return request<TemplateSummary>(`/templates/${templateId}/approve`, { method: "POST", body: JSON.stringify(payload) });
  },
  updateTemplateAdminState(templateId: string, payload: unknown) {
    return request<TemplateSummary>(`/templates/${templateId}/admin-state`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  replaceTemplateJson(templateId: string, payload: unknown) {
    return request<TemplateSummary>(`/templates/${templateId}/replace`, { method: "PUT", body: JSON.stringify(payload) });
  },
  archiveTemplate(templateId: string) {
    return request<TemplateSummary>(`/templates/${templateId}`, { method: "DELETE" });
  },
  previewTemplate(payload: unknown) {
    return request<PreviewResponse>("/preview", { method: "POST", body: JSON.stringify(payload) });
  },
  createTemplateDraft(formData: FormData) {
    return formRequest<TemplateDraftResponse>("/extract/template-draft", formData);
  },
  generateWorksheet(payload: WorksheetGeneratePayload) {
    return request<Worksheet>("/worksheets", { method: "POST", body: JSON.stringify(payload) });
  },
  generateTopicalPaper(payload: TopicalPaperGeneratePayload) {
    return request<Worksheet>("/worksheets/topical", { method: "POST", body: JSON.stringify(payload) });
  },
  exportWorksheet(worksheetId: string) {
    return request<Worksheet>(`/worksheets/${worksheetId}/export`, { method: "POST" });
  },
  pdfUrl(worksheetId: string, kind: "worksheet" | "answer-key") {
    return `${API_BASE_URL}/worksheets/${worksheetId}/${kind === "worksheet" ? "worksheet.pdf" : "answer-key.pdf"}`;
  },
  htmlUrl(worksheetId: string, kind: "worksheet" | "answer-key") {
    return `${API_BASE_URL}/worksheets/${worksheetId}/${kind === "worksheet" ? "worksheet.html" : "answer-key.html"}`;
  },
  imageUrl(worksheetId: string, kind: "worksheet" | "answer-key") {
    return `${API_BASE_URL}/worksheets/${worksheetId}/${kind === "worksheet" ? "worksheet.png" : "answer-key.png"}`;
  },
  getMaintenanceStatus() {
    return request<MaintenanceStatus>("/admin/maintenance");
  },
  updateMaintenanceStatus(payload: { maintenance_active: boolean; confirmation: string; title: string; message: string; reason?: string; updated_by?: string }) {
    return request<MaintenanceStatus>("/admin/maintenance", { method: "POST", body: JSON.stringify(payload) });
  },
  getAdminOverview() {
    return request<AdminOverview>("/admin/overview");
  },
  listAdminTeachers(params?: AdminPageParams) {
    return request<AdminListResponse<AdminTeacherRow>>(`/admin/teachers${adminQuery(params)}`);
  },
  updateTeacherTestFlag(teacherId: string, isTestAccount: boolean) {
    return request<{ teacher_id: string; is_test_account: boolean }>(`/admin/teachers/${encodeURIComponent(teacherId)}/test-flag`, {
      method: "PATCH",
      body: JSON.stringify({ is_test_account: isTestAccount }),
    });
  },
  simulateTeacherBilling(teacherId: string, planCode: string) {
    return request<Record<string, unknown>>(`/admin/teachers/${encodeURIComponent(teacherId)}/billing/simulate`, {
      method: "POST",
      body: JSON.stringify({ plan_code: planCode }),
    });
  },
  listAdminSupportTickets(params?: AdminPageParams) {
    return request<AdminListResponse<AdminSupportTicketRow>>(`/admin/support-tickets${adminQuery(params)}`);
  },
  listAdminSubscriptions(params?: AdminPageParams) {
    return request<AdminListResponse<AdminSubscriptionRow>>(`/admin/billing/subscriptions${adminQuery(params)}`);
  },
  listAdminPaymentEvents(params?: AdminPageParams) {
    return request<AdminListResponse<AdminPaymentEventRow>>(`/admin/billing/payment-events${adminQuery(params)}`);
  },
  listAdminSecurityEvents(params?: AdminPageParams) {
    return request<AdminListResponse<AdminSecurityEventRow>>(`/admin/security-events${adminQuery(params)}`);
  },
  listAdminServerLogs(params?: AdminPageParams) {
    return request<AdminListResponse<AdminServerLogRow>>(`/admin/server-logs${adminQuery(params)}`);
  },
  resetAdminServerLogs() {
    return request<{ removed: number }>("/admin/server-logs", { method: "DELETE" });
  },
  getAdminServerLogsSummary(params?: { search?: string; method?: string }) {
    return request<AdminServerLogSummary>(`/admin/server-logs/summary${adminQuery(params)}`);
  },
  getOrganizationsMeta() {
    return request<OrganizationsMeta>('/admin/organizations/meta');
  },
  listOrganizations(params?: { search?: string; organization_type?: string; limit?: number; offset?: number }) {
    return request<AdminListResponse<OrganizationRow>>(`/admin/organizations${adminQuery(params)}`);
  },
  updateOrganization(organizationId: string, payload: { branding?: { mode: string; background?: string; primary?: string; accent?: string }; feature_flags?: Record<string, boolean>; updated_by?: string }) {
    return request<OrganizationRow>(`/admin/organizations/${organizationId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  listOrganizationRequests(params?: { status?: string; limit?: number; offset?: number }) {
    return request<AdminListResponse<OrganizationRequestRow>>(`/admin/organization-requests${adminQuery(params)}`);
  },
  approveOrganizationRequest(requestId: string, payload?: { decided_by?: string }) {
    return request<OrganizationRequestRow>(`/admin/organization-requests/${requestId}/approve`, { method: 'POST', body: JSON.stringify(payload || {}) });
  },
  rejectOrganizationRequest(requestId: string, payload?: { decided_by?: string; reason?: string }) {
    return request<OrganizationRequestRow>(`/admin/organization-requests/${requestId}/reject`, { method: 'POST', body: JSON.stringify(payload || {}) });
  },
  deliverOrganizationRequest(requestId: string) {
    return request<OrganizationRequestRow>(`/admin/organization-requests/${requestId}/deliver`, { method: 'POST' });
  },
  getFullPortionOverview() {
    return request<FullPortionOverview>("/admin/full-portion/overview");
  },
  getSubtopicCapSettings() {
    return request<SubtopicCapSettings>("/admin/full-portion/subtopic-cap-settings");
  },
  updateSubtopicCapSetting(payload: { plan_code: string; max_subtopics_per_topic: number | null; updated_by?: string }) {
    return request<SubtopicCapSettings>("/admin/full-portion/subtopic-cap-settings", { method: "POST", body: JSON.stringify(payload) });
  },
  getCheckingOverview() {
    return request<CheckingOverview>("/admin/checking/overview");
  },
  getVariantHealth() {
    return request<VariantHealthOverview>("/admin/templates/variant-health");
  },
  getPromoCodes() {
    return request<PromoCodeListResponse>("/admin/promo-codes");
  },
  getPromoCodeRedemptions(promoId: string) {
    return request<{ redemptions: PromoCodeRedemptionRow[] }>(`/admin/promo-codes/${promoId}/redemptions`);
  },
  createPromoCode(payload: {
    code: string;
    plan_code: string;
    label?: string | null;
    discount_percent?: number;
    max_redemptions?: number | null;
    expires_at?: string | null;
  }) {
    return request<PromoCode>("/admin/promo-codes", { method: "POST", body: JSON.stringify(payload) });
  },
  setPromoCodeActive(promoId: string, isActive: boolean) {
    return request<PromoCode>(`/admin/promo-codes/${promoId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  },
  getRlsStatus() {
    return request<RlsStatus>("/admin/security/rls-status");
  },
  runWorksheetCleanup(dryRun: boolean) {
    return request<WorksheetCleanupResult>(`/admin/worksheets/cleanup?dry_run=${dryRun ? "true" : "false"}`, { method: "POST" });
  },
  getAdminAccountsMeta() {
    return request<AdminAccountsMeta>("/admin/auth/accounts/meta");
  },
  listAdminAccounts() {
    return request<AdminListResponse<AdminAuthAccountRow>>("/admin/auth/accounts");
  },
  createAdminAccount(payload: CreateAdminAccountPayload) {
    return request<{ admin: AdminAuthAccountRow; temporary_password: string }>("/admin/auth/accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  updateAdminAccount(accountId: string, payload: UpdateAdminAccountPayload) {
    return request<{ admin: AdminAuthAccountRow }>(`/admin/auth/accounts/${accountId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};
