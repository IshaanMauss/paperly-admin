import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { AdminTeacherRow, api } from "@/lib/apiClient";

type UserSegment = "individual" | "institute";
type SortMode = "newest" | "oldest" | "most_active" | "paid_first" | "profile_complete";

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString();
}

function isPaid(row: AdminTeacherRow) {
  const plan = (row.plan_code || "").toLowerCase();
  const status = (row.subscription_status || "").toLowerCase();
  return (status === "active" || status === "trial") && plan !== "free" && plan !== "unknown";
}

function userSegment(row: AdminTeacherRow): UserSegment {
  if (row.account_segment === "institute") return "institute";
  if (row.account_segment === "individual") return "individual";
  const plan = (row.plan_code || "").toLowerCase();
  const school = (row.school || "").trim();
  if (plan.includes("institute") || plan.includes("school") || plan.includes("enterprise")) return "institute";
  if (school && plan.includes("team")) return "institute";
  return "individual";
}

function userRoleLabel(row: AdminTeacherRow) {
  return row.account_role?.trim() || "Role not answered";
}

function timestamp(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value).getTime();
  return Number.isFinite(date) ? date : 0;
}

function sortRows(rows: AdminTeacherRow[], mode: SortMode) {
  const next = [...rows];
  next.sort((a, b) => {
    if (mode === "oldest") return timestamp(a.last_activity_at || a.profile_updated_at) - timestamp(b.last_activity_at || b.profile_updated_at);
    if (mode === "most_active") return (b.total_template_uses + b.analytics_events) - (a.total_template_uses + a.analytics_events);
    if (mode === "paid_first") return Number(isPaid(b)) - Number(isPaid(a)) || (b.total_template_uses - a.total_template_uses);
    if (mode === "profile_complete") return (b.profile_completion || 0) - (a.profile_completion || 0);
    return timestamp(b.last_activity_at || b.profile_updated_at) - timestamp(a.last_activity_at || a.profile_updated_at);
  });
  return next;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-700">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

export default function UsersPage() {
  const [rows, setRows] = useState<AdminTeacherRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState<UserSegment>("individual");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAdminTeachers()
      .then((response) => {
        if (cancelled) return;
        setRows(response.items);
        setTotal(response.total);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load user monitoring data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const planOptions = useMemo(() => {
    const plans = new Set(rows.map((row) => row.plan_code || "unknown"));
    return ["all", ...Array.from(plans).sort()];
  }, [rows]);

  const segmentedRows = useMemo(() => rows.filter((row) => userSegment(row) === segment), [rows, segment]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = segmentedRows.filter((row) => {
      const haystack = [row.name, row.email, row.phone, row.school, row.teacher_id, row.plan_code, row.subscription_status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !needle || haystack.includes(needle);
      const matchesPlan = planFilter === "all" || row.plan_code === planFilter;
      return matchesSearch && matchesPlan;
    });
    return sortRows(filtered, sortMode);
  }, [planFilter, search, segmentedRows, sortMode]);

  const individualCount = rows.filter((row) => userSegment(row) === "individual").length;
  const instituteCount = rows.filter((row) => userSegment(row) === "institute").length;
  const paidCount = segmentedRows.filter(isPaid).length;
  const activeCount = segmentedRows.filter((row) => row.analytics_events > 0 || row.total_template_uses > 0).length;

  return (
    <AppShell title="User Monitoring">
      <section className={panel}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Customer operations</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">Users</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Monitor student, parent, teacher, tutor, and institute users from their saved onboarding profile. Institute grouping still also considers plan and school signals.
            </p>
          </div>
          <div className="rounded-2xl bg-violet-50 px-5 py-3 text-sm font-black text-slate-700">{total} user ids found</div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Individual side" value={String(individualCount)} />
          <Stat label="Institute" value={String(instituteCount)} />
          <Stat label="Paid in tab" value={String(paidCount)} />
          <Stat label="Active in tab" value={String(activeCount)} />
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-violet-100 bg-white/80 p-3 shadow-soft">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${segment === "individual" ? "bg-purple-700 text-white shadow-soft" : "bg-violet-50 text-slate-700 hover:bg-violet-100"}`}
              onClick={() => setSegment("individual")}
            >
              Individual side
            </button>
            <button
              type="button"
              className={`rounded-2xl px-4 py-3 text-sm font-black transition ${segment === "institute" ? "bg-purple-700 text-white shadow-soft" : "bg-violet-50 text-slate-700 hover:bg-violet-100"}`}
              onClick={() => setSegment("institute")}
            >
              Institute
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-[1.75rem] border border-violet-100 bg-white/90 p-4 shadow-soft lg:grid-cols-[1fr_220px_260px_auto]">
          <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Search users
            <input
              className="mt-1 w-full rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-purple-400"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, school, or user id..."
            />
          </label>
          <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Plan
            <select className="mt-1 w-full rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-purple-400" value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
              {planOptions.map((plan) => (
                <option key={plan} value={plan}>{plan === "all" ? "All plans" : plan}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Sort
            <select className="mt-1 w-full rounded-2xl border border-violet-100 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-purple-400" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="newest">New users / recent activity first</option>
              <option value="oldest">Oldest users first</option>
              <option value="most_active">Most active users first</option>
              <option value="paid_first">Purchased users first</option>
              <option value="profile_complete">Most complete profiles first</option>
            </select>
          </label>
          <button className="self-end rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3 text-sm font-black text-purple-800 transition hover:bg-violet-100" onClick={() => { setSearch(""); setPlanFilter("all"); setSortMode("newest"); }}>
            Reset
          </button>
        </div>

        {loading && <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 text-sm font-bold text-slate-600">Loading user data...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-6 text-sm font-bold text-slate-600">
            No user activity has reached the backend yet. Once product users generate papers, submit support, or activate plans, they will appear here.
          </div>
        )}
        {!loading && !error && rows.length > 0 && filteredRows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-6 text-sm font-bold text-slate-600">
            No {segment === "individual" ? "individual/tutor" : "institute"} users match these filters.
          </div>
        )}
        {filteredRows.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-violet-100 bg-white">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="bg-violet-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Segment</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Profile</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-50">
                {filteredRows.map((row) => (
                  <tr key={row.teacher_id} className="font-semibold text-slate-700">
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900">{row.name || "Unknown user"}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{row.teacher_id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="w-fit rounded-full bg-violet-50 px-2 py-1 text-xs font-black text-purple-800">{userRoleLabel(row)}</span>
                        <span className="text-xs font-bold text-slate-400">{userSegment(row) === "institute" ? "Institute group" : "Individual group"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.plan_code}</td>
                    <td className="px-4 py-3">{row.subscription_status}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-black text-purple-800">{row.profile_completion ?? 0}%</span>
                    </td>
                    <td className="px-4 py-3">
                      <p>{row.email || "No email"}</p>
                      <p className="mt-1 text-xs text-slate-500">{row.phone || "No phone"}</p>
                      {row.school ? <p className="mt-1 text-xs text-slate-500">{row.school}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <p>{row.total_template_uses} template uses</p>
                      <p className="mt-1 text-xs text-slate-500">{row.templates_used} templates · {row.analytics_events} events</p>
                      {row.onboarding_goal ? <p className="mt-1 text-xs text-slate-500">Goal: {row.onboarding_goal}</p> : null}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(row.last_activity_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

