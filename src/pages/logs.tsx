import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel, primaryButton, secondaryButton, input } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { AdminServerLogRow, AdminServerLogSummary, api } from "@/lib/apiClient";
import { diagnose } from "@/lib/troubleshoot";

const PAGE_SIZE = 25;

type Tab = "problems" | "responses";

function pagerText(total: number, page: number, count: number) {
  if (!total) return "No rows";
  const start = page * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE + count, total);
  return `Showing ${start}-${end} of ${total}`;
}

function statusColor(statusCode?: number | null) {
  if (statusCode == null) return "bg-slate-200 text-slate-700";
  if (statusCode >= 500) return "bg-rose-100 text-rose-700";
  if (statusCode >= 400) return "bg-amber-100 text-amber-800";
  if (statusCode >= 300) return "bg-sky-100 text-sky-800";
  return "bg-emerald-100 text-emerald-800";
}

const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx"] as const;
type StatusClass = (typeof STATUS_CLASSES)[number];

const STATUS_CLASS_THEME: Record<StatusClass, { active: string; ring: string; label: string }> = {
  "2xx": { active: "border-emerald-300 bg-emerald-50 text-emerald-800", ring: "ring-emerald-200", label: "Success" },
  "3xx": { active: "border-sky-300 bg-sky-50 text-sky-800", ring: "ring-sky-200", label: "Redirect" },
  "4xx": { active: "border-amber-300 bg-amber-50 text-amber-800", ring: "ring-amber-200", label: "Client errors" },
  "5xx": { active: "border-rose-300 bg-rose-50 text-rose-800", ring: "ring-rose-200", label: "Server errors" },
};

const URGENCY_THEME: Record<string, string> = {
  high: "border-rose-200 bg-rose-50 text-rose-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-700",
};

function TroubleshootPanel({ row }: { row: AdminServerLogRow }) {
  const result = diagnose(row);
  return (
    <div className={`mt-3 rounded-xl border p-3 text-xs ${URGENCY_THEME[result.urgency]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-black">{result.title}</span>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">{result.urgency} urgency</span>
      </div>
      <div className="mt-2"><span className="font-black">Likely cause:</span> {result.likelyCause}</div>
      <div className="mt-1"><span className="font-black">Suggested fix:</span> {result.suggestedFix}</div>
    </div>
  );
}

function LogRow({ row }: { row: AdminServerLogRow }) {
  const [open, setOpen] = useState(false);
  const [troubleshootOpen, setTroubleshootOpen] = useState(false);
  const isProblem = row.outcome === "error" || (row.status_code ?? 0) >= 400;
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusColor(row.status_code)}`}>{row.status_code ?? "-"}</span>
          <span className="font-mono text-xs uppercase text-slate-500">{row.method}</span>
          <span className="font-mono text-xs text-slate-800">{row.path}</span>
        </div>
        <span className="text-xs text-slate-500">{row.occurred_at ? new Date(row.occurred_at).toLocaleString() : "-"}</span>
      </button>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Actor: {row.actor} {row.duration_ms != null ? `| ${row.duration_ms}ms` : ""}</span>
        {isProblem ? (
          <button
            type="button"
            onClick={() => setTroubleshootOpen((value) => !value)}
            className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-800 transition hover:bg-violet-100"
          >
            {troubleshootOpen ? "Hide troubleshoot" : "Troubleshoot"}
          </button>
        ) : null}
      </div>
      {troubleshootOpen ? <TroubleshootPanel row={row} /> : null}
      {open ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs">
          <div><span className="font-black text-slate-600">IP:</span> {row.ip || "-"}</div>
          <div><span className="font-black text-slate-600">Device / user agent:</span> {row.user_agent || "-"}</div>
          {row.error_detail ? (
            <div className="rounded-lg bg-rose-50 p-2 text-rose-800">
              <span className="font-black">Error detail:</span> {row.error_detail}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function ServerLogsPage() {
  const [tab, setTab] = useState<Tab>("problems");
  const [rows, setRows] = useState<AdminServerLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [sort, setSort] = useState("newest");
  const [statusClass, setStatusClass] = useState<StatusClass | "all">("all");
  const [statusCode, setStatusCode] = useState<number | "all">("all");
  const [summary, setSummary] = useState<AdminServerLogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [resetArmed, setResetArmed] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => setPage(0), [tab, search, method, sort, statusClass, statusCode]);

  useEffect(() => {
    let cancelled = false;
    api
      .getAdminServerLogsSummary({ search: search.trim() || undefined, method: method !== "all" ? method : undefined })
      .then((response) => {
        if (!cancelled) setSummary(response);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [search, method, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAdminServerLogs({
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        search: search.trim(),
        outcome: statusClass !== "all" || statusCode !== "all" ? "all" : tab === "problems" ? "error" : "success",
        method,
        sort,
        status_class: statusClass !== "all" ? statusClass : undefined,
        status_code: statusCode !== "all" ? statusCode : undefined,
      })
      .then((response) => {
        if (cancelled) return;
        setRows(response.items || []);
        setTotal(response.total || 0);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load server logs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, page, search, method, sort, statusClass, statusCode, refreshTick]);

  const handleReset = async () => {
    if (!resetArmed) {
      setResetArmed(true);
      window.setTimeout(() => setResetArmed(false), 4000);
      return;
    }
    setResetting(true);
    try {
      await api.resetAdminServerLogs();
      setResetArmed(false);
      setPage(0);
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset server logs.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <AppShell title="Server Logs">
      <section className={panel}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Operations</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">What's happening on the server</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Every request is recorded here as it happens, so problems stay visible after a terminal closes. Does not
              capture response bodies (large exports stream directly), only status, timing, actor, and any error text.
            </p>
          </div>
          <button type="button" onClick={handleReset} disabled={resetting} className={`${secondaryButton} ${resetArmed ? "border-rose-300 text-rose-700" : ""}`}>
            {resetting ? "Resetting..." : resetArmed ? "Click again to confirm reset" : "Reset logs"}
          </button>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("problems")}
            className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${tab === "problems" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-transparent text-slate-600 hover:border-rose-200"}`}
          >
            Problems
          </button>
          <button
            type="button"
            onClick={() => setTab("responses")}
            className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${tab === "responses" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-transparent text-slate-600 hover:border-emerald-200"}`}
          >
            Good responses (200)
          </button>
        </div>

        {summary ? (
          <div className="mt-5 rounded-2xl border border-slate-100 bg-white/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Status breakdown - last {summary.scanned} requests</p>
              {(statusClass !== "all" || statusCode !== "all") && (
                <button
                  type="button"
                  onClick={() => { setStatusClass("all"); setStatusCode("all"); }}
                  className="text-[11px] font-black text-violet-700 underline"
                >
                  Clear code filter
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUS_CLASSES.map((cls) => {
                const count = summary.classes[cls] || 0;
                const active = statusClass === cls;
                const theme = STATUS_CLASS_THEME[cls];
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => { setStatusCode("all"); setStatusClass(active ? "all" : cls); }}
                    className={`rounded-xl border px-3 py-2 text-left transition ${active ? `${theme.active} ring-2 ${theme.ring}` : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                  >
                    <div className="text-lg font-black leading-none">{count}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wide">{cls} {theme.label}</div>
                  </button>
                );
              })}
            </div>
            {summary.top_codes.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-slate-400">Exact codes:</span>
                {summary.top_codes.map((entry) => (
                  <button
                    key={entry.status_code}
                    type="button"
                    onClick={() => { setStatusClass("all"); setStatusCode(statusCode === entry.status_code ? "all" : entry.status_code); }}
                    className={`rounded-full px-2.5 py-1 text-xs font-black transition ${statusCode === entry.status_code ? "ring-2 ring-violet-300" : ""} ${statusColor(entry.status_code)}`}
                  >
                    {entry.status_code} x{entry.count}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 md:col-span-2">
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${input} mt-2 normal-case tracking-normal`} placeholder="path, actor..." />
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Method
            <select value={method} onChange={(event) => setMethod(event.target.value)} className={`${input} mt-2 normal-case tracking-normal`}>
              <option value="all">All methods</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="PATCH">PATCH</option>
              <option value="DELETE">DELETE</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value)} className={`${input} mt-2 normal-case tracking-normal`}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>

        {loading && <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 text-sm font-bold text-slate-600">Loading logs...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-black text-slate-900">{tab === "problems" ? "Problems" : "Good responses"}</h3>
              <span className="text-xs font-black text-slate-500">{pagerText(total, page, rows.length)}</span>
            </div>
            {rows.length === 0 ? <p className="mt-3 text-sm font-semibold text-slate-500">Nothing logged here yet.</p> : null}
            <div className="mt-4 space-y-3">
              {rows.map((row) => (
                <LogRow key={row.id} row={row} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black">
              <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className={`${secondaryButton} disabled:opacity-40`}>Previous</button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((value) => value + 1)} className={`${primaryButton} disabled:opacity-40`}>Next</button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
