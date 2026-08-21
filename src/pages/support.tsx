import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { AdminSupportTicketRow, api } from "@/lib/apiClient";

export default function SupportAdminPage() {
  const [rows, setRows] = useState<AdminSupportTicketRow[]>([]);
  const [source, setSource] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listAdminSupportTickets()
      .then((response) => {
        if (cancelled) return;
        setRows(response.items);
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
  }, []);

  return (
    <AppShell title="Support Tickets">
      <section className={panel}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Support operations</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">Teacher support queue</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Feedback and complaint records from the teacher product. This page reads only real tickets stored by the backend.
            </p>
          </div>
          <div className="rounded-2xl bg-violet-50 px-5 py-3 text-sm font-black text-slate-700">Source: {source || "backend"}</div>
        </div>

        {loading && <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 text-sm font-bold text-slate-600">Loading support tickets...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-6 text-sm font-bold text-slate-600">
            No support tickets found. If this says missing_table, run the latest backend migration before production use.
          </div>
        )}
        {rows.length > 0 && (
          <div className="mt-6 grid gap-4">
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
        )}
      </section>
    </AppShell>
  );
}

