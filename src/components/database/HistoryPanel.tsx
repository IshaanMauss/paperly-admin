import { useEffect, useState } from "react";

import { secondaryButton } from "@/components/ui";
import { api } from "@/lib/apiClient";
import type { DbHistory } from "@/lib/apiTypes";

import { Pill, SectionTitle } from "./dbUi";

type View = "runs" | "files" | "migrations";

const statusTone = { applied: "good", not_applied: "neutral", pending: "warn", note: "info" } as const;
const statusLabel = { applied: "Applied", not_applied: "Not applied / retired", pending: "Pending", note: "Note" } as const;

function when(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function HistoryPanel() {
  const [data, setData] = useState<DbHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("runs");
  const [filter, setFilter] = useState<"all" | "applied" | "pending" | "not_applied">("all");

  function load() {
    setError(null);
    api
      .getDbHistory()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load history."));
  }
  useEffect(load, []);

  if (error) return <p className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>;
  if (!data) return <p className="text-sm font-semibold text-slate-500">Loading history...</p>;

  const views: { id: View; label: string }[] = [
    { id: "runs", label: `Run from this console (${data.console_runs.length})` },
    { id: "files", label: "SQL files applied" },
    { id: "migrations", label: "Migrations" },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${view === v.id ? "border-purple-600 bg-purple-600 text-white" : "border-violet-200 bg-white text-slate-700 hover:bg-violet-50"}`}>
            {v.label}
          </button>
        ))}
        <button className={`${secondaryButton} ml-auto`} onClick={load}>
          Refresh
        </button>
      </div>

      {view === "runs" ? (
        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
          <SectionTitle hint="Every statement that changed (or tried to change) data from this console. Reads are not listed.">Console activity</SectionTitle>
          {data.console_runs.length === 0 ? <p className="text-sm font-semibold text-slate-500">Nothing has been run from the console yet.</p> : null}
          <ul className="grid gap-2">
            {data.console_runs.map((r) => (
              <li key={r.id} className="rounded-lg border border-violet-100 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={r.outcome === "ok" ? "good" : "bad"}>{r.outcome === "ok" ? "Applied" : "Failed"}</Pill>
                  <Pill tone={r.target === "production" ? "bad" : "info"}>{r.target === "production" ? "Production" : "Test"}</Pill>
                  <Pill tone={r.risk === "write" ? "warn" : "bad"}>{r.risk}</Pill>
                  <span className="text-xs font-semibold text-slate-500">
                    {when(r.at)} by {r.admin}
                  </span>
                  {typeof r.rows_affected === "number" ? <span className="text-xs font-bold text-slate-700">{r.rows_affected} rows</span> : null}
                </div>
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 font-mono text-xs text-slate-700">{r.statement}</pre>
                {r.error ? <p className="mt-1 text-xs font-semibold text-rose-700">{r.error}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view === "files" ? (
        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
          <SectionTitle hint="Taken from the SQL files applied log (docs/sql-files-applied-log.md). Statuses are read from the log's wording; open the log for the exact record.">One-off SQL files</SectionTitle>
          {!data.applied_files.available ? <p className="text-sm font-semibold text-slate-500">The applied-files list is not on this server. Run scripts/build_sql_history.py and redeploy.</p> : null}
          <div className="mb-3 flex flex-wrap gap-2">
            {(["all", "applied", "pending", "not_applied"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3 py-1 text-xs font-bold ${filter === f ? "border-purple-600 bg-purple-600 text-white" : "border-violet-200 bg-white text-slate-600"}`}>
                {f === "all" ? "All" : statusLabel[f]}
              </button>
            ))}
            {data.applied_files.written ? <span className="self-center text-xs font-semibold text-slate-400">log started {data.applied_files.written}</span> : null}
          </div>
          {data.applied_files.sections.map((s) => {
            const entries = s.entries.filter((e) => filter === "all" || e.status === filter);
            if (!entries.length) return null;
            return (
              <div key={s.title} className="mb-4">
                <p className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">{s.title}</p>
                <ul className="grid gap-2">
                  {entries.map((e, i) => (
                    <li key={`${s.title}-${i}`} className="rounded-lg border border-violet-100 p-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone={statusTone[e.status]}>{statusLabel[e.status]}</Pill>
                        {e.files.map((f) => (
                          <span key={f} className="font-mono text-xs font-bold text-slate-800">
                            {f}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-xs font-medium leading-5 text-slate-600">{e.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}

      {view === "migrations" ? (
        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
          <SectionTitle hint="Alembic revisions in the code, compared with the revision stamped in the production database.">Schema migrations</SectionTitle>
          <p className="mb-3 text-sm font-semibold text-slate-700">
            Database is at <span className="font-mono">{data.migrations.current || "unknown"}</span>; the code expects <span className="font-mono">{data.migrations.latest || "-"}</span>{" "}
            {data.migrations.up_to_date ? <Pill tone="good">up to date</Pill> : <Pill tone="warn">not stamped at the latest</Pill>}
          </p>
          <p className="mb-3 text-xs font-medium text-slate-500">Some migrations were applied by hand as SQL, so a revision can be "pending" here although its changes are live. The SQL files log has the details.</p>
          <ul className="grid gap-1.5">
            {data.migrations.chain.map((m) => (
              <li key={m.revision} className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 px-3 py-2 text-sm">
                <Pill tone={m.status === "applied" ? "good" : m.status === "pending" ? "warn" : "neutral"}>{m.status}</Pill>
                <span className="font-mono text-xs font-bold text-slate-900">{m.revision}</span>
                <span className="text-xs font-medium text-slate-500">{m.title}</span>
                {m.created ? <span className="ml-auto text-xs font-semibold text-slate-400">{m.created}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
