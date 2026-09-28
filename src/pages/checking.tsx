import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, panel } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type CheckingOverview } from "@/lib/apiClient";

export default function CheckingPage() {
  const [overview, setOverview] = useState<CheckingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Added 2026-09-28: previously only the aggregate counts above existed -
  // there was no way to see individual checks at all.
  const [submissions, setSubmissions] = useState<{ id: string; teacher_id: string; event_type: string; payload: Record<string, unknown>; occurred_at: string }[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getCheckingOverview()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load AI/QR checking usage."))
      .finally(() => setLoading(false));
    setSubmissionsLoading(true);
    api
      .listCheckingSubmissions({ limit: 25 })
      .then((response) => {
        setSubmissions(response.items || []);
        setSubmissionsTotal(response.total || 0);
      })
      .catch(() => {
        setSubmissions([]);
      })
      .finally(() => setSubmissionsLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    load();
  }, [refreshTick]);

  return (
    <AppShell title="AI / QR Checking">
      <section className={panel}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Checking usage</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">How teachers are using AI/QR checking</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          A student's paper is uploaded, its printed QR code is matched back to the Paperly worksheet, and workings are extracted and marked. Every completed check logs a
          {" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">paper_checked</code>
          {" "}
          analytics event.
        </p>
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!loading && overview ? (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Total checks</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.total_checks}</p>
            </article>
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Last 7 days</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.checks_last_7_days}</p>
            </article>
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Last 30 days</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.checks_last_30_days}</p>
            </article>
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Distinct teachers</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.distinct_teachers}</p>
            </article>
          </div>
        ) : null}
        {!loading && overview?.source === "missing_table" ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            The analytics events table isn't provisioned yet, so usage is shown as zero rather than an error.
          </p>
        ) : null}
      </section>

      <section className={panel}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Individual checks</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Recent submissions ({submissionsTotal})</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Each row is one <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">paper_checked</code> analytics event. This product doesn't store the
          student's actual submission (images/extracted answers) server-side anywhere - this is the full stored payload for that event, not a submission viewer.
        </p>
        {submissionsLoading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!submissionsLoading && submissions.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-6 text-sm font-bold text-slate-600">No checks recorded yet.</p>
        ) : null}
        <div className="mt-4 grid gap-2">
          {submissions.map((row) => (
            <div key={row.id} className="rounded-2xl border border-violet-100 bg-white p-4 text-sm font-semibold text-slate-700">
              <button type="button" onClick={() => setOpenId((value) => (value === row.id ? null : row.id))} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                <span className="font-mono text-xs text-slate-800">{row.teacher_id}</span>
                <span className="text-xs text-slate-500">{new Date(row.occurred_at).toLocaleString()}</span>
              </button>
              {openId === row.id ? (
                <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
