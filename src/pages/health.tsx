import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import Link from "next/link";
import { api, ServerLogProblemGroup, TemplateSummary } from "@/lib/apiClient";
import { panel, primaryButton } from "@/components/ui";
import { SystemStatusPanel } from "@/components/SystemStatusPanel";

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
    priority: "P0",
    title: "Run the phone sign-in database script",
    status: "pending",
    evidence: "docs/claude-project/phone-otp-migration.sql adds the phone column and the sign-in code tables. Until it runs in the Supabase SQL editor and the new backend is deployed, phone sign-in cannot work. The Live system status above shows the live database version against the version this release expects.",
    next: "Run it once in Supabase, deploy, re-run db-guard-production.sql, then run alembic stamp 0030_phone_otp_and_auth_outbox.",
  },
  {
    priority: "P0",
    title: "Live Razorpay keys and one real test payment",
    status: "partial",
    evidence: "The code verifies the checkout signature and the webhook signature and processes events once only. What nothing can prove from here: live keys and the webhook secret are set on Railway, the webhook URL is registered in Razorpay, and a small real payment has gone all the way through to a plan change.",
    next: "Set the keys, register the webhook, make one small real purchase on a spare account, and check it in Billing.",
  },
  {
    priority: "P0",
    title: "Custom institute plans (already being promoted)",
    status: "partial",
    evidence: "Built 2026-10-02: per-institute Topical / Full Portion / AI checking / mark scheme switches enforced by the server, per-person caps, seats with a join code and email-domain rule, branding (colours, name, logo, dark mode unchanged), a plan that members get instead of their own, and a delivery checklist in Organizations. Not yet proven: one full run-through with a real test institute.",
    next: "Create a test institute, work down its checklist, join with a second account, and confirm each switch and cap from the member's side before the first customer.",
  },
  {
    priority: "P0",
    title: "Backend-only plan gates",
    status: "current",
    evidence: "Plan limits, Popular filter, mark scheme and AI checking are decided by the server on every request, and an institute's switches and caps go through the same gates. Covered by automated tests.",
    next: "Keep a test for every new limit or switch before it ships.",
  },
  {
    priority: "P0",
    title: "Admin sign-in",
    status: "partial",
    evidence: "Role-based admin accounts, signed tokens, refresh cookies and per-route permissions are in place, and the shared admin token is off by default and refused in production. Not built: two-factor sign-in and re-asking for the password before backups, restores and maintenance.",
    next: "Add admin two-factor and a step-up password prompt for the most dangerous actions.",
  },
  {
    priority: "P1",
    title: "Admin action history",
    status: "current",
    evidence: "Every admin action that changes something (suspend, plan, offers, maintenance, backups, settings, organizations) is recorded automatically with who, what, which record, from where and whether it worked. See Audit Log. Incident evidence can be exported from Security.",
    next: "Keep it that way: new admin routes are covered automatically. Consider showing the Audit Log only to owners.",
  },
  {
    priority: "P1",
    title: "Rate limits shared across servers",
    status: "partial",
    evidence: "Sign-in, billing, generation and upload routes are rate limited. Without REDIS_URL each server instance counts on its own, so the real limit is higher than written when more than one instance runs.",
    next: "Add a Redis add-on on Railway and set REDIS_URL; then check Server Logs for 429s.",
  },
  {
    priority: "P1",
    title: "Alerts when something breaks",
    status: "pending",
    evidence: "Server Logs and this page show problems clearly once you look, but nothing pushes a message to you when errors spike or the backend goes down.",
    next: "Add an uptime check on the health endpoint and an alert (email or phone) on a burst of 5xx errors.",
  },
  {
    priority: "P1",
    title: "Scheduled backups and a restore test",
    status: "partial",
    evidence: "Manual JSON and Excel exports (with readable names and a last-backup warning on the Backups page) and an insert-only restore exist. There is no daily scheduled backup, off-site copy, encryption, or recorded restore test.",
    next: "Schedule a daily backup to cloud storage, encrypt it, and do one restore into a scratch project to prove it works.",
  },
  {
    priority: "P1",
    title: "Free-plan preview ad",
    status: "partial",
    evidence: "The rewarded preview ad flow is built and the server enforces the 30 seconds and one unlock per ad. Until a real ad unit id is set, people see a plain 30-second 'preparing' card instead of an ad.",
    next: "Create a rewarded ad unit with Google, set NEXT_PUBLIC_GPT_REWARDED_UNIT on Vercel for the user app, redeploy, and test one unlock end to end.",
  },
  {
    priority: "P1",
    title: "Sign-in session stability",
    status: "current",
    evidence: "Fixed 2026-10-02: a renewal that arrives just after another tab already renewed is accepted (same browser), and signed-out visitors no longer trigger a renewal request at all. Server Logs now name the user behind any remaining 401.",
    next: "Watch Server Logs for a few days; a named user who keeps appearing means their session is being revoked.",
  },
  {
    priority: "P1",
    title: "ZTNA for admin access",
    status: "pending",
    evidence: "The code enforces a gateway secret on the admin API and the panel has a gateway proxy; Live system status shows whether the secret is set. Whether Cloudflare Access or Tailscale actually sits in front is a hosting setting no code can prove.",
    next: "Put the admin URLs behind Cloudflare Access or Tailscale before exposing them publicly.",
  },
  {
    priority: "P1",
    title: "Upload type and size limits",
    status: "partial",
    evidence: "Enforced in the ingestion backend, not in this panel.",
    next: "Keep type, size and page-count limits on every upload route and surface violations in Security Events.",
  },
  {
    priority: "P1",
    title: "Server-side paging and filtering",
    status: "current",
    evidence: "Users, support, billing, security events and server logs all page and filter on the server.",
    next: "Keep this pattern for every new large table.",
  },
  {
    priority: "P2",
    title: "Institute owners managing their own people",
    status: "pending",
    evidence: "Seats, roles and limits are managed by you in Organizations. An institute owner cannot yet invite, pause or remove members from inside the app (they can share the join code you give them).",
    next: "Add a small members screen for institute owners, limited to their own institute.",
  },
  {
    priority: "P2",
    title: "Pooled allowances for institutes",
    status: "pending",
    evidence: "Institute limits are per person (for example 300 AI checks each). A shared pool across the whole institute is not built.",
    next: "Only build if a customer asks for a shared pool instead of per-person limits.",
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
  const [problems, setProblems] = useState<ServerLogProblemGroup[] | null>(null);
  const [problemsError, setProblemsError] = useState("");

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
    try {
      const summary = await api.getAdminServerLogsSummary();
      setProblems(summary.problem_groups || []);
      setProblemsError("");
    } catch (err) {
      setProblems(null);
      setProblemsError(readableError(err));
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
            <h2 className="text-2xl font-extrabold text-slate-950">Backend reachability</h2>
            <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-extrabold ${statusClass}`}>{status}</p>
            {error ? <p className="mt-3 max-w-3xl rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
            <p className="mt-3 text-sm font-semibold text-slate-500">Health check reads up to {TEMPLATE_HEALTH_LIMIT} templates, matching the backend API limit.</p>
          </div>
          <button className={primaryButton} onClick={refreshHealth} disabled={loading}>{loading ? "Refreshing..." : "Refresh checks"}</button>
        </div>
      </section>

      <SystemStatusPanel refreshKey={refreshTick} />

      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-extrabold text-slate-950">Problems right now</h2>
          <Link href="/logs" className="text-sm font-extrabold text-violet-700 underline">Open Server Logs</Link>
        </div>
        <p className="mt-1 text-sm font-semibold text-slate-500">Repeated failures from recent traffic, who they hit and what to do. Nothing hidden: if it failed, it is listed.</p>
        {problemsError ? <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-semibold text-rose-700">Could not read the server logs: {problemsError}</p> : null}
        {status === "offline" ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">The backend is not reachable from the admin panel. Nothing else on this page can be trusted until it is back.</p> : null}
        {unsafe > 0 ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{unsafe} template{unsafe === 1 ? " is" : "s are"} switched off for generation (safe off). Open Variant Health to see which.</p> : null}
        {missingPaper > 0 ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{missingPaper} template{missingPaper === 1 ? " has" : "s have"} no paper tag, so paper filters will skip {missingPaper === 1 ? "it" : "them"}.</p> : null}
        {problems && problems.length === 0 && status === "online" && unsafe === 0 && missingPaper === 0 ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">No repeated problems in recent traffic.</p> : null}
        <div className="mt-3 grid gap-3">
          {(problems || []).slice(0, 6).map((group) => (
            <div key={`${group.method}-${group.path}-${group.status_code}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-slate-800">{group.status_code} {group.method} {group.path}</span>
                <span className="text-xs font-extrabold text-slate-600">{group.count} times, {group.unique_users} named user{group.unique_users === 1 ? "" : "s"}{group.anonymous_requests ? `, ${group.anonymous_requests} signed-out` : ""}</span>
              </div>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{group.meaning}</p>
              {group.sample_users.length ? <p className="mt-1 text-xs font-semibold text-slate-500">Affected: {group.sample_users.join(", ")}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[["Approved", approved], ["Drafts", drafts], ["Safe off", unsafe], ["Missing paper tag", missingPaper]].map(([label, value]) => (
          <div key={label} className={panel}>
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[["Current", currentChecks, "bg-emerald-50 text-emerald-800"], ["Partial", partialChecks, "bg-amber-50 text-amber-800"], ["Pending", pendingChecks, "bg-slate-100 text-slate-700"]].map(([label, value, classes]) => (
          <div key={label} className={`${panel} ${classes}`}>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em]">{label}</p>
            <p className="mt-2 text-3xl font-extrabold">{value}</p>
          </div>
        ))}
      </section>

      <section className={panel}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">Production readiness by priority</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-500">Grouped as P0/P1/P2 so launch blockers stay separate from scale and polish work. These are status notes, not proof that production is ready.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-5">
          {checksByPriority.map(({ priority, items }) => (
            <div key={priority} className={`rounded-xl border p-4 ${priorityStyle(priority)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-950">{priority} work</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{priorityMeaning(priority)}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-700">{items.length} checks</span>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">No checks in this bucket yet.</div>
                ) : null}
                {items.map((item) => (
                  <div key={item.title} className={`rounded-xl border p-4 ${checkStyle(item.status)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-700">{item.priority}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] ${statusBadge(item.status)}`}>{item.status}</span>
                      <h4 className="text-base font-extrabold text-slate-950">{item.title}</h4>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">{item.evidence}</p>
                    <p className="mt-2 text-sm font-extrabold text-slate-950">Next: {item.next}</p>
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

