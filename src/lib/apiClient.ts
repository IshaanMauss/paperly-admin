import { getAdminAccessToken, isAdminAccessTokenExpiring, refreshAdminAccessToken } from "@/lib/adminToken";
import type {
  TestDatabaseReport,
  AuthOutboxMessage,
  AuthProbeResult,
  AuthStatus,
  TestCenterOverview,
  TestCoverage,
  TestRunRecord,
  PlanConfigState,
  PlanConfigSparse,
  PlanConfigPreview,
  PlanConfigChange,
  TemplateSummary,
  TemplateListResponse,
  AdminListResponse,
  AdminTeacherRow,
  MaintenanceStatus,
  AdminSupportTicketRow,
  AdminSubscriptionRow,
  AdminPaymentEventRow,
  AdminOverview,
  FullPortionOverview,
  InstituteConfig,
  InstituteOverview,
  SubtopicCapSettings,
  CheckingOverview,
  VariantHealthOverview,
  RlsStatus,
  WorksheetCleanupResult,
  AdminSecurityEventRow,
  AdminServerLogRow,
  AdminServerLogSummary,
  OrganizationRow,
  OrganizationsMeta,
  OrganizationRequestRow,
  AdminAuthAccountRow,
  AdminAccountsMeta,
  CreateAdminAccountPayload,
  UpdateAdminAccountPayload,
  AdminPageParams,
  TemplateDraftResponse,
  PreviewResponse,
  WorksheetGeneratePayload,
  TopicalPaperGeneratePayload,
  Worksheet,
  PlanOffer,
  PlanOfferListResponse,
  PromoCode,
  PromoCodeListResponse,
  PromoCodeRedemptionRow,
  UserResolveHit,
  UserThreeSixty,
} from "@/lib/apiTypes";

// Every response/payload type lives in apiTypes.ts; re-exported here so existing
// imports from "@/lib/apiClient" keep working unchanged.
export * from "@/lib/apiTypes";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8003/api";

export function adminQuery(params?: AdminPageParams) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

// A non-OK response body is sometimes a FastAPI JSON {detail}, but can also
// be a raw Python traceback, or an HTML error page from a proxy in front of
// the backend (a 502/504/ngrok-style interstitial) - none of those should
// ever be shown verbatim to admin staff (info disclosure, and just
// confusing). Mirrors apiErrorMessage() in the teacher app's apiClient.ts.
export function adminApiErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    const detail = parsed.detail ?? parsed.message;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object" && Array.isArray((detail as { errors?: unknown }).errors)) {
      const lines = ((detail as { errors: unknown[] }).errors).filter((item): item is string => typeof item === "string");
      if (lines.length) return lines.join(" ");
    }
    if (Array.isArray(detail)) {
      const joined = detail
        .map((item) => {
          if (item && typeof item === "object") {
            const entry = item as { loc?: unknown[]; msg?: string };
            const field = Array.isArray(entry.loc) ? entry.loc.join(".") : "request";
            return entry.msg ? `${field}: ${entry.msg}` : "";
          }
          return typeof item === "string" ? item : "";
        })
        .filter(Boolean)
        .join("; ");
      if (joined) return joined;
    }
  } catch {
    const looksLikeMarkup = /<\s*(!doctype|html|head|body|script)\b/i.test(text);
    if (!looksLikeMarkup && text.length <= 300) return text;
  }
  return fallback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const send = () => {
    const token = getAdminAccessToken();
    return fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers || {}),
      },
    });
  };

  if (isAdminAccessTokenExpiring()) {
    await refreshAdminAccessToken();
  }
  let response = await send();
  if (response.status === 401 && (await refreshAdminAccessToken())) {
    response = await send();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(adminApiErrorMessage(text, `Request failed with status ${response.status}`));
  }
  return response.json() as Promise<T>;
}

/** POST that returns a file. The server's Content-Disposition name is used so downloads keep their readable business names. */
export async function downloadRequest(path: string, body?: unknown): Promise<{ blob: Blob; filename: string }> {
  const send = () => {
    const token = getAdminAccessToken();
    return fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };
  if (isAdminAccessTokenExpiring()) await refreshAdminAccessToken();
  let response = await send();
  if (response.status === 401 && (await refreshAdminAccessToken())) response = await send();
  if (!response.ok) {
    const text = await response.text();
    throw new Error(adminApiErrorMessage(text, `Request failed with status ${response.status}`));
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  return { blob: await response.blob(), filename: match ? match[1] : "paperly-nt-download" };
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type AuditLogItem = {
  id: string;
  at: string | null;
  admin: string;
  action: string | null;
  target: Record<string, string>;
  outcome: "ok" | "failed" | "error" | null;
  status_code: number | null;
  ip: string | null;
  route: string | null;
  method: string | null;
};

export type SystemStatusItem = { key: string; label: string; state: "ok" | "warn" | "down" | "unknown"; detail: string; action: string | null };
export type SystemStatus = {
  checked_at: string;
  environment: string;
  overall: "ok" | "warn" | "down";
  counts: { ok: number; warn: number; down: number; unknown: number };
  groups: { title: string; items: SystemStatusItem[] }[];
};

export type BackupHistory = {
  last_export_at: string | null;
  last_export_by: string | null;
  last_export_age_days: number | null;
  stale: boolean;
  export_count_365d: number;
  recent: AuditLogItem[];
  last_restore_attempt_at: string | null;
  note: string;
};

async function formRequest<T>(path: string, formData: FormData): Promise<T> {
  const send = () => {
    const token = getAdminAccessToken();
    return fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      body: formData,
      credentials: "include",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  if (isAdminAccessTokenExpiring()) {
    await refreshAdminAccessToken();
  }
  let response = await send();
  if (response.status === 401 && (await refreshAdminAccessToken())) {
    response = await send();
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(adminApiErrorMessage(text, `Request failed with status ${response.status}`));
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
  resolveSupportTicket(ticketId: string, adminReply: string, status: "resolved" | "open" = "resolved") {
    return request<AdminSupportTicketRow>(`/admin/support-tickets/${encodeURIComponent(ticketId)}/resolve`, {
      method: "PATCH",
      body: JSON.stringify({ admin_reply: adminReply, status }),
    });
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
  acknowledgeAdminServerLog(logId: string) {
    return request<{ id: string; acknowledged: boolean }>(`/admin/server-logs/${encodeURIComponent(logId)}/acknowledge`, { method: "POST" });
  },
  deleteAdminServerLog(logId: string) {
    return request<{ id: string; removed: boolean }>(`/admin/server-logs/${encodeURIComponent(logId)}`, { method: "DELETE" });
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
  updateOrganization(organizationId: string, payload: { branding?: { mode: string; background?: string; primary?: string; accent?: string; display_name?: string; tagline?: string; logo_url?: string }; feature_flags?: Record<string, boolean>; updated_by?: string }) {
    return request<OrganizationRow>(`/admin/organizations/${organizationId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  getInstituteOverview(organizationId: string) {
    return request<InstituteOverview>(`/admin/organizations/${organizationId}/entitlements`);
  },
  saveInstituteConfig(organizationId: string, config: InstituteConfig, updatedBy?: string) {
    return request<InstituteOverview>(`/admin/organizations/${organizationId}/entitlements`, { method: 'PUT', body: JSON.stringify({ config, updated_by: updatedBy }) });
  },
  changeInstituteJoinCode(organizationId: string, action: 'generate' | 'clear') {
    return request<InstituteOverview>(`/admin/organizations/${organizationId}/join-code`, { method: 'POST', body: JSON.stringify({ action }) });
  },
  addInstituteMember(organizationId: string, payload: { email: string; role: string }) {
    return request<InstituteOverview>(`/admin/organizations/${organizationId}/members`, { method: 'POST', body: JSON.stringify(payload) });
  },
  updateInstituteMember(organizationId: string, memberId: string, payload: { role?: string; status?: string }) {
    return request<InstituteOverview>(`/admin/organizations/${organizationId}/members/${encodeURIComponent(memberId)}`, { method: 'PATCH', body: JSON.stringify(payload) });
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
  listCheckingSubmissions(params?: AdminPageParams) {
    return request<AdminListResponse<{ id: string; teacher_id: string; event_type: string; payload: Record<string, unknown>; occurred_at: string }>>(
      `/admin/checking/submissions${adminQuery(params)}`
    );
  },
  getVariantHealth() {
    return request<VariantHealthOverview>("/admin/templates/variant-health");
  },
  recalculateTemplateStats() {
    return request<{ calculated: number; remaining: number; total: number; stale_total?: number; skipped?: { template_code: string; error: string }[]; skipped_before?: number; failed?: { template_code: string; error: string }[] }>("/admin/templates/variant-health/recalculate?batch=1", { method: "POST" });
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
  getOffers() {
    return request<PlanOfferListResponse>("/admin/offers");
  },
  createOffer(payload: {
    label: string;
    plan_code: string;
    discount_percent: number;
    duration_hours: number;
    audience_plans: string[];
    style: string;
    starts_at?: string | null;
    ends_at?: string | null;
  }) {
    return request<PlanOffer>("/admin/offers", { method: "POST", body: JSON.stringify(payload) });
  },
  setOfferActive(offerId: string, isActive: boolean) {
    return request<PlanOffer>(`/admin/offers/${offerId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  },
  getPlanConfig() {
    return request<PlanConfigState>("/admin/plan-config");
  },
  savePlanConfigDraft(config: PlanConfigSparse, note?: string) {
    return request<PlanConfigPreview>("/admin/plan-config/draft", { method: "PUT", body: JSON.stringify({ config, note: note || null }) });
  },
  discardPlanConfigDraft() {
    return request<{ discarded: boolean }>("/admin/plan-config/draft", { method: "DELETE" });
  },
  previewPlanConfig() {
    return request<PlanConfigPreview>("/admin/plan-config/preview");
  },
  publishPlanConfig(confirmation: string, priceConfirmation?: string) {
    return request<{ version: number; changes: PlanConfigChange[]; subscribers_locked_in: number }>("/admin/plan-config/publish", {
      method: "POST",
      body: JSON.stringify({ confirmation, price_confirmation: priceConfirmation || null }),
    });
  },
  rollbackPlanConfig(version: number, confirmation: string, priceConfirmation?: string) {
    return request<{ version: number; changes: PlanConfigChange[]; subscribers_locked_in: number }>("/admin/plan-config/rollback", {
      method: "POST",
      body: JSON.stringify({ version, confirmation, price_confirmation: priceConfirmation || null }),
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
  resolveUsers(query: string) {
    return request<{ items: UserResolveHit[] }>(`/admin/users/resolve?query=${encodeURIComponent(query)}`);
  },
  getUserThreeSixty(teacherId: string) {
    return request<UserThreeSixty>(`/admin/users/${encodeURIComponent(teacherId)}/three-sixty`);
  },
  grantUserPlan(teacherId: string, payload: { plan_code: string; reason: string }) {
    return request<{ status: string; plan_code: string }>(`/admin/users/${encodeURIComponent(teacherId)}/grant-plan`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  forceRedeemPromoForUser(teacherId: string, payload: { code: string; reason: string }) {
    return request<{ billing_status: unknown; promo: PromoCode }>(`/admin/users/${encodeURIComponent(teacherId)}/promo/force-redeem`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  resetUserSession(teacherId: string, payload: { reason: string }) {
    return request<{ teacher_id: string; sessions_revoked: boolean; lockout_cleared: boolean }>(`/admin/users/${encodeURIComponent(teacherId)}/session/reset`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  regenerateWorksheetExport(worksheetId: string, payload: { reason: string }) {
    return request<{ worksheet_id: string; worksheet_pdf_path: string | null; answer_key_pdf_path: string | null }>(`/admin/worksheets/${encodeURIComponent(worksheetId)}/regenerate-export`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  resetUserQuota(teacherId: string, payload: { reason: string }) {
    return request<{ teacher_id: string; counters_reset: number }>(`/admin/users/${encodeURIComponent(teacherId)}/quota/reset`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  unstickUserGeneration(teacherId: string, payload: { reason: string }) {
    return request<{ teacher_id: string; requests_cleared: number }>(`/admin/users/${encodeURIComponent(teacherId)}/generation/unstick`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  verifyUserEmail(teacherId: string, payload: { reason: string }) {
    return request<{ teacher_id: string; email_verified: boolean }>(`/admin/users/${encodeURIComponent(teacherId)}/verify-email`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  // Added 2026-09-28: previously there was no way to suspend/ban, export-on-
  // behalf, or delete a teacher's account from the admin panel at all.
  suspendTeacherAccount(teacherId: string, payload: { reason: string }) {
    return request<{ teacher_id: string; is_suspended: boolean; suspended_at: string }>(`/admin/teachers/${encodeURIComponent(teacherId)}/suspend`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  unsuspendTeacherAccount(teacherId: string, payload: { reason: string }) {
    return request<{ teacher_id: string; is_suspended: boolean }>(`/admin/teachers/${encodeURIComponent(teacherId)}/unsuspend`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  exportTeacherDataOnBehalf(teacherId: string) {
    return request<Record<string, unknown>>(`/admin/teachers/${encodeURIComponent(teacherId)}/export`);
  },
  deleteTeacherAccountOnBehalf(teacherId: string, payload: { reason: string; confirm_teacher_id: string }) {
    return request<Record<string, unknown>>(`/admin/teachers/${encodeURIComponent(teacherId)}/delete`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  cancelTeacherBilling(teacherId: string, payload: { reason: string }) {
    return request<Record<string, unknown>>(`/admin/teachers/${encodeURIComponent(teacherId)}/billing/cancel`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  refundTeacherPayment(teacherId: string, payload: { reason: string; amount_rupees?: number; cancel_plan: boolean }) {
    return request<{ refund: { refund_id: string; amount_paise: number | null; status: string | null }; plan_cancelled: boolean }>(
      `/admin/teachers/${encodeURIComponent(teacherId)}/billing/refund`,
      { method: "POST", body: JSON.stringify(payload) }
    );
  },
  restoreBackup(backup: Record<string, unknown>, dryRun: boolean, confirmation?: string) {
    return request<{ dry_run: boolean; tables: Record<string, { in_backup: number; would_insert: number; inserted: number; skipped_rows: number; note?: string }> }>(
      "/admin/backups/restore",
      { method: "POST", body: JSON.stringify({ backup, dry_run: dryRun, confirmation }) }
    );
  },
  getAuditLog(params: { days?: number; admin?: string; onlyFailed?: boolean; limit?: number } = {}) {
    const query = new URLSearchParams({ days: String(params.days ?? 30), limit: String(params.limit ?? 200) });
    if (params.admin) query.set("admin", params.admin);
    if (params.onlyFailed) query.set("only_failed", "true");
    return request<{ items: AuditLogItem[]; total: number; window_days: number }>(`/admin/audit-log?${query.toString()}`);
  },
  getSystemStatus() {
    return request<SystemStatus>("/admin/system-status");
  },
  getBackupHistory() {
    return request<BackupHistory>("/admin/backups/history");
  },
  exportIncidentEvidence(teacherId: string, hours = 72, note?: string) {
    return downloadRequest("/admin/security-events/export-evidence", { teacher_id: teacherId, hours, note });
  },
  getTestCenter() {
    return request<TestCenterOverview>("/admin/test-center");
  },
  getTestCoverage() {
    return request<TestCoverage>("/admin/test-center/coverage");
  },
  startTestRun(ids?: string[]) {
    return request<TestRunRecord>("/admin/test-center/run", { method: "POST", body: JSON.stringify({ ids: ids ?? null }) });
  },
  getTestRun(runId: string) {
    return request<TestRunRecord>(`/admin/test-center/run/${encodeURIComponent(runId)}`);
  },
  addCustomTest(kind: "function" | "route", target: string) {
    return request<{ id: string }>("/admin/test-center/custom", { method: "POST", body: JSON.stringify({ kind, target }) });
  },
  removeCustomTest(checkId: string) {
    return request<{ ok: boolean }>(`/admin/test-center/custom/${encodeURIComponent(checkId)}`, { method: "DELETE" });
  },
  getAuthStatus() {
    return request<AuthStatus>("/admin/test-center/auth-status");
  },
  getAuthOutbox(channel?: "email" | "sms", limit = 50) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (channel) query.set("channel", channel);
    return request<{ messages: AuthOutboxMessage[] }>(`/admin/test-center/auth-outbox?${query.toString()}`);
  },
  sendAuthProbe(channel: "email" | "sms", recipient: string) {
    return request<AuthProbeResult>("/admin/test-center/auth-probe", { method: "POST", body: JSON.stringify({ channel, recipient }) });
  },
  getTestDatabase() {
    return request<TestDatabaseReport>("/admin/test-center/test-db");
  },
  seedTestDatabase() {
    return request<{ users: string[]; institute_id: string; join_code: string; password: string }>("/admin/test-center/test-db/seed", { method: "POST" });
  },
  wipeTestDatabase() {
    return request<{ users: number; institutes: number; promo_codes: number }>("/admin/test-center/test-db/wipe", { method: "POST" });
  },
};
