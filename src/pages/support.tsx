import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { AdminSupportTicketRow, api } from "@/lib/apiClient";

const PAGE_SIZE = 25;

export default function SupportAdminPage() {
  const [rows, setRows] = useState<AdminSupportTicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [ticketType, setTicketType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    const timeout = window.setTimeout(() => setPage(0), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAdminSupportTickets({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search.trim(), status, ticket_type: ticketType, sort })
      .then((response) => {
        if (cancelled) return;
        setRows(response.items || []);
        setTotal(response.total || 0);
        setSource(response.source);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load support tickets.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, refreshTick, search, sort, status, ticketType]);

  const start = total ? page * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE + rows.length, total);
  const reset = () => {
    setSearch("");
    setStatus("all");
    setTicketType("all");
    setSort("newest");
    setPage(0);
  };

  return (
    <AppShell title="Support Tickets">
      <section className={panel}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Support operations</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">Teacher support queue</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Server-side search, status filters, and paging for feedback and complaints. The browser only receives the current page.
            </p>
          </div>
          <div className="rounded-2xl bg-violet-50 px-5 py-3 text-sm font-black text-slate-700">Source: {source || "backend"}</div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 md:col-span-2">
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="teacher id or message..." className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-500" />
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All status</option>
              <option value="open">Open</option>
              <option value="reviewing">Reviewing</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Type
            <select value={ticketType} onChange={(event) => { setTicketType(event.target.value); setPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All types</option>
              <option value="feedback">Feedback</option>
              <option value="complaint">Complaint</option>
              <option value="billing">Billing</option>
              <option value="technical">Technical</option>
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

        {loading && <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 text-sm font-bold text-slate-600">Loading support tickets...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-6 text-sm font-bold text-slate-600">No support tickets found.</div>
        )}
        {rows.length > 0 && (
          <>
            <div className="mt-6 flex items-center justify-between text-xs font-black text-slate-500">
              <span>Showing {start}-{end} of {total}</span>
              <span>Page {page + 1}</span>
            </div>
            <div className="mt-3 grid gap-4">
              {rows.map((row) => (
                <article key={row.id} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em]">
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-800">{row.ticket_type || row.type || "feedback"}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{row.status}</span>
                    <span className="text-slate-400">{new Date(row.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-3 font-mono text-xs font-semibold text-slate-500">{row.teacher_id}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{row.message}</p>
                </article>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black">
              <button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Previous</button>
              <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Next</button>
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
