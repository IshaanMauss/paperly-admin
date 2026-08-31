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

type AdminPageParams = {
  limit?: number;
  offset?: number;
  search?: string;
  segment?: string;
  role?: string;
  plan?: string;
  activity?: string;
  status?: string;
  ticket_type?: string;
  gateway?: string;
  event_type?: string;
  severity?: string;
  sort?: string;
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
};
