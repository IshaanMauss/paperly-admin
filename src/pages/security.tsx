import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { AdminSecurityEventRow, api } from "@/lib/apiClient";

const PAGE_SIZE = 25;

const protections = [
  ["ZTNA for admin/backoffice", "Protect admin/backoffice routes behind Cloudflare Access or Tailscale before app login starts."],
  ["Fake plan upgrade", "Backend checks subscription/webhook truth before paid generation, Popular IGCSE, checking, and no-ad access."],
  ["Premium patch attempt", "Premium data and protected actions stay blocked server-side even if browser UI is modified."],
  ["DDoS or scraping", "CDN/WAF, per-IP and per-account rate limits, queueing, and repeated-abuse blocks."],
  ["Account takeover", "OTP, password hashing, session rotation, failed-login throttling, and suspicious-login alerts."],
  ["Product cloning attempt", "Quota limits, export watermarks later, anomaly logs, and admin review before permanent bans."],
];

function eventLabel(eventType: string) {
  return eventType.replace(/^security\./, "").replace(/_/g, " ");
}

export default function SecurityPage() {
  const [events, setEvents] = useState<AdminSecurityEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    const timeout = window.setTimeout(() => setPage(0), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  async function loadEvents() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listAdminSecurityEvents({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search.trim(), severity, status, sort });
      setEvents(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load security events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, [page, refreshTick, search, severity, sort, status]);

  const highRiskCount = useMemo(
    () => events.filter((event) => ["high", "critical"].includes((event.severity || "").toLowerCase())).length,
    [events]
  );
  const start = total ? page * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE + events.length, total);
  const reset = () => {
    setSearch("");
    setSeverity("all");
    setStatus("all");
    setSort("newest");
    setPage(0);
  };

  return (
    <AppShell title="Security & Risk Monitoring">
      <section className={panel}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Production security model</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Frontend is never trusted for paid access.</h2>
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Server-side paged risk logs. Browser buttons can be patched, so real security must live in backend checks, signed sessions, rate limits, audit logs, and admin actions.
            </p>
          </div>
          <button type="button" onClick={loadEvents} className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-purple-800">
            Refresh events
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 md:col-span-2">
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="user, email, event, reason..." className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-500" />
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Severity
            <select value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All severity</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All status</option>
              <option value="detected">Detected</option>
              <option value="active">Active</option>
              <option value="mitigated">Mitigated</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False positive</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Sort
            <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
          <button type="button" onClick={reset} className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-black text-purple-900 md:self-end">Reset filters</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className={panel}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Security Events</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{total}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Matching server-side risk logs</p>
        </article>
        <article className={panel}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">High Risk On Page</p>
          <p className="mt-2 text-3xl font-black text-rose-700">{highRiskCount}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Needs owner review first</p>
        </article>
        <article className={panel}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Page</p>
          <p className="mt-2 text-xl font-black text-slate-950">{total ? `${start}-${end}` : "0"}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Only current rows are loaded</p>
        </article>
      </section>

      <section className={panel}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Live monitoring</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Recent security events</h2>
          </div>
          {loading ? <span className="text-sm font-bold text-slate-500">Loading...</span> : null}
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
        {!loading && !error && events.length === 0 ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">No matching security events.</p> : null}
        <div className="mt-4 grid gap-3">
          {events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-purple-100 bg-white/80 p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black capitalize text-slate-950">{eventLabel(event.event_type)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{event.reason}</p>
                  {event.status_meaning ? <p className="mt-1 text-xs font-bold text-purple-700">{event.status_meaning}</p> : null}
                </div>
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-900">{event.severity}</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-3">
                <span>User: {event.user_name || "Unknown user"}</span>
                <span>Email: {event.user_email || "Not captured"}</span>
                <span>Plan: {event.plan_code || "unknown"} / {event.subscription_status || "unknown"}</span>
                <span>Status: {event.status || "detected"}</span>
                <span>When: {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : "Unknown"}</span>
                <span>Event: {event.event_type}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black">
          <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Previous</button>
          <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Next</button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {protections.map(([title, body]) => (
          <article key={title} className={panel}>
            <h3 className="text-xl font-black text-slate-950">{title}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{body}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
