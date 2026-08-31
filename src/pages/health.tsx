import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, TemplateSummary } from "@/lib/apiClient";
import { panel, primaryButton } from "@/components/ui";

const TEMPLATE_HEALTH_LIMIT = "200";

type CheckStatus = "current" | "partial" | "pending" | "blocked";

type CheckPriority = "P0" | "P1" | "P2";

type ProductionCheck = {
  priority: CheckPriority;
  title: string;
  status: CheckStatus;
  evidence: string;
  next: string;
};

const productionChecks: ProductionCheck[] = [
  {
    priority: "P1",
    title: "ZTNA for admin/backoffice access",
    status: "pending",
    evidence: "README and launch checklist require Cloudflare Access or Tailscale before public exposure. No admin-panel code can prove this by itself.",
    next: "Configure ZTNA at hosting/network layer before exposing admin/backoffice URLs.",
  },
  {
    priority: "P0",
    title: "Role-based admin auth",
    status: "partial",
    evidence: "Backend now has admin auth tables, signed admin access tokens, refresh cookie sessions, bootstrap owner login, and admin-panel session gating. Legacy X-Admin-Token fallback remains for migration/local tools.",
    next: "Set ADMIN_BOOTSTRAP_PASSWORD, create the first owner account, then replace fallback token use with permission-specific admin route policies.",
  },
  {
    priority: "P0",
    title: "Audit logs for admin actions",
    status: "partial",
    evidence: "Security Events page reads server-side risk logs, but approve/edit/archive/backup/maintenance/billing actions are not all tied to a real admin identity yet.",
    next: "Add append-only admin audit events for every sensitive action with actor, target, timestamp, and result.",
  },
  {
    priority: "P1",
    title: "Daily Excel + JSON backups",
    status: "partial",
    evidence: "Backups page supports manual JSON/XLSX export. Docs still say scheduled cloud backup and restore dry-run are future work.",
    next: "Add daily scheduled backup, cloud copy, encryption, visible backup history, and restore test status.",
  },
  {
    priority: "P1",
    title: "Server-side pagination/filtering",
    status: "current",
    evidence: "Completed 2026-08-21: Users, support tickets, subscriptions, payment events, and security events now use backend limit/offset/search/filter/sort contracts with paged admin UI views.",
    next: "Keep this as the required pattern for every new large admin dataset; do not add client-only full-list filtering for scalable tables.",
  },
  {
    priority: "P0",
    title: "Upload type and size limits",
    status: "partial",
    evidence: "This is mainly enforced in the MVP/backoffice ingestion backend, not inside this admin panel. Admin docs still list it as production protection.",
    next: "Keep MIME/size/page-count limits server-side for all upload routes and show violations in admin health/security views.",
  },
  {
    priority: "P0",
    title: "Razorpay webhook verification",
    status: "pending",
    evidence: "Billing page explicitly says real Razorpay checkout should use signed webhooks before paid launch.",
    next: "Implement signed checkout verification, signed webhook verification, and idempotent event processing before paid launch.",
  },
  {
    priority: "P0",
    title: "Backend-only plan gates",
    status: "current",
    evidence: "Teacher-side plan and Popular IGCSE gates were moved to backend enforcement; admin docs still correctly say frontend state must not be trusted.",
    next: "Keep regression tests for free/monthly/yearly/institute access and extend checks to custom campaign entitlements.",
  },
  {
    priority: "P1",
    title: "Rate limits and DDoS protection",
    status: "pending",
    evidence: "Docs mention Cloudflare/WAF/rate limits, but no admin-panel code proves route-level rate limiting.",
    next: "Add backend route-level rate limits and deploy CDN/WAF rules for auth, generation, export, and admin APIs.",
  },
  {
    priority: "P1",
    title: "Security event logging",
    status: "partial",
    evidence: "Security page reads /api/admin/security-events and displays statuses. Incident response buttons are still not complete.",
    next: "Add status transitions: active, mitigated, resolved, false_positive, with admin actor audit.",
  },
  {
    priority: "P1",
    title: "Session revoke and ban workflow",
    status: "partial",
    evidence: "Teacher session expiry/maintenance revoke exists conceptually, but admin-side force logout, suspend, ban, and review actions are not fully wired.",
    next: "Add admin actions for force logout, suspend account, device review, and incident evidence export.",
  },
];

function readableError(error: unknown) {
  if (!(error instanceof Error)) return "Backend not reachable";
  try {
    const parsed = JSON.parse(error.message) as { detail?: unknown };
    if (Array.isArray(parsed.detail)) {
      return parsed.detail
        .map((item) => {
          const detail = item as { loc?: unknown[]; msg?: string };
          const field = Array.isArray(detail.loc) ? detail.loc.join(".") : "request";
          return `${field}: ${detail.msg || "Invalid request"}`;
        })
        .join("; ");
    }
    if (typeof parsed.detail === "string") return parsed.detail;
  } catch {
    // Use the plain error below.
  }
  return error.message || "Backend not reachable";
}

function checkStyle(status: CheckStatus) {
  if (status === "current") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-950";
  if (status === "blocked") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function statusBadge(status: CheckStatus) {
  if (status === "current") return "bg-emerald-100 text-emerald-800";
  if (status === "partial") return "bg-amber-100 text-amber-800";
  if (status === "blocked") return "bg-rose-100 text-rose-700";
  return "bg-slate-200 text-slate-700";
}

function priorityStyle(priority: CheckPriority) {
  if (priority === "P0") return "border-rose-200 bg-rose-50/70 text-rose-900";
  if (priority === "P1") return "border-amber-200 bg-amber-50/70 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function priorityMeaning(priority: CheckPriority) {
  if (priority === "P0") return "Launch blocker: auth, money, tenant safety, upload abuse, or data integrity.";
  if (priority === "P1") return "Required before scale: operations, monitoring, backups, rate limits, and incident response.";
  return "Polish and growth hardening after the core launch path is safe.";
}

export default function HealthPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [status, setStatus] = useState("checking");
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshHealth = useCallback(async () => {
    setLoading(true);
    setStatus("checking");
    setError("");
    try {
      const response = await api.listTemplates({ limit: TEMPLATE_HEALTH_LIMIT });
      setTemplates(response.items);
      setStatus("online");
    } catch (err) {
      setTemplates([]);
      setStatus("offline");
      setError(readableError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth, refreshTick]);

  const unsafe = templates.filter((t) => !t.safe_to_generate).length;
  const drafts = templates.filter((t) => t.status === "draft").length;
  const approved = templates.filter((t) => t.status === "approved").length;
  const missingPaper = templates.filter((t) => !(t as unknown as { paper_code?: string }).paper_code && !(t.metadata_json || {}).paper_code).length;
  const currentChecks = productionChecks.filter((item) => item.status === "current").length;
  const partialChecks = productionChecks.filter((item) => item.status === "partial").length;
  const pendingChecks = productionChecks.filter((item) => item.status === "pending" || item.status === "blocked").length;
  const checksByPriority = (["P0", "P1", "P2"] as CheckPriority[]).map((priority) => ({
    priority,
    items: productionChecks.filter((item) => item.priority === priority),
  }));
  const statusClass = status === "online" ? "bg-emerald-100 text-emerald-800" : status === "offline" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800";

  return (
    <AppShell title="System Health">
      <section className={panel}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">Backend reachability</h2>
            <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-black ${statusClass}`}>{status}</p>
            {error ? <p className="mt-3 max-w-3xl rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <p className="mt-3 text-sm font-semibold text-slate-500">Health check reads up to {TEMPLATE_HEALTH_LIMIT} templates, matching the backend API limit.</p>
          </div>
          <button className={primaryButton} onClick={refreshHealth} disabled={loading}>{loading ? "Refreshing..." : "Refresh checks"}</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[["Approved", approved], ["Drafts", drafts], ["Safe off", unsafe], ["Missing paper tag", missingPaper]].map(([label, value]) => (
          <div key={label} className={panel}>
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[["Current", currentChecks, "bg-emerald-50 text-emerald-800"], ["Partial", partialChecks, "bg-amber-50 text-amber-800"], ["Pending", pendingChecks, "bg-slate-100 text-slate-700"]].map(([label, value, classes]) => (
          <div key={label} className={`${panel} ${classes}`}>
            <p className="text-sm font-black uppercase tracking-[0.16em]">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <section className={panel}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Production readiness by priority</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">Grouped as P0/P1/P2 so launch blockers stay separate from scale and polish work. These are status notes, not proof that production is ready.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-5">
          {checksByPriority.map(({ priority, items }) => (
            <div key={priority} className={`rounded-[1.75rem] border p-4 ${priorityStyle(priority)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-950">{priority} work</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{priorityMeaning(priority)}</p>
                </div>
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">{items.length} checks</span>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {items.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-4 text-sm font-bold text-slate-500">No checks in this bucket yet.</div>
                ) : null}
                {items.map((item) => (
                  <div key={item.title} className={`rounded-2xl border p-4 ${checkStyle(item.status)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-700">{item.priority}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${statusBadge(item.status)}`}>{item.status}</span>
                      <h4 className="text-base font-black text-slate-950">{item.title}</h4>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">{item.evidence}</p>
                    <p className="mt-2 text-sm font-black text-slate-950">Next: {item.next}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

