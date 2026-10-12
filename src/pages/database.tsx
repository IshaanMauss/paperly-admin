import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { HistoryPanel } from "@/components/database/HistoryPanel";
import { OverviewPanel } from "@/components/database/OverviewPanel";
import { SchemaBrowser } from "@/components/database/SchemaBrowser";
import { SqlConsole } from "@/components/database/SqlConsole";
import { Pill } from "@/components/database/dbUi";
import { errorNotice, secondaryButton } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import { api } from "@/lib/apiClient";
import type { DbOverview, DbTarget, DbTargetStatus } from "@/lib/apiTypes";

type Section = "overview" | "schema" | "console" | "history";
const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "schema", label: "Tables and schema" },
  { id: "console", label: "SQL console" },
  { id: "history", label: "History" },
];

export default function DatabasePage() {
  const { admin } = useAdminSession();
  const [target, setTarget] = useState<DbTarget>("production");
  const [section, setSection] = useState<Section>("overview");
  const [statuses, setStatuses] = useState<DbTargetStatus[]>([]);
  const [overview, setOverview] = useState<DbOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = admin?.role === "owner";
  const status = statuses.find((s) => s.target === target);
  const locked = !status || status.locked;

  const loadTargets = useCallback(() => {
    api
      .getDbTargets()
      .then((r) => setStatuses(r.targets))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not check the databases."));
  }, []);

  useEffect(() => {
    if (isOwner) loadTargets();
  }, [isOwner, loadTargets]);

  useEffect(() => {
    if (!isOwner || !status || status.locked) {
      setOverview(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDbOverview(target)
      .then((o) => !cancelled && setOverview(o))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the database."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isOwner, status, target]);

  if (!isOwner) {
    return (
      <AppShell title="Database">
        <div className={errorNotice}>The Database area is for the owner account only.</div>
      </AppShell>
    );
  }

  const prod = target === "production";
  return (
    <AppShell title="Database">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-950">Database</h1>
        <p className="mt-1 max-w-3xl text-sm font-medium text-slate-600">
          Browse tables and security settings, run queries, change data with confirmations, and see which SQL has been applied. Owner only. Credential tables are never shown and every change is logged.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Choose the database">
        {(["production", "test"] as const).map((t) => {
          const s = statuses.find((x) => x.target === t);
          const active = target === t;
          return (
            <button
              key={t}
              onClick={() => setTarget(t)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-extrabold transition-colors ${
                active ? (t === "production" ? "border-rose-600 bg-rose-600 text-white shadow-soft" : "border-emerald-600 bg-emerald-600 text-white shadow-soft") : "border-violet-200 bg-white text-slate-700 hover:bg-violet-50"
              }`}
            >
              {t === "production" ? "Production database" : "Test database"}
              {s ? <span className={`h-2.5 w-2.5 rounded-full ${s.locked ? "bg-amber-300" : "bg-emerald-300"}`} title={s.locked ? "Locked or not connected" : "Connected"} /> : null}
            </button>
          );
        })}
        <button className={`${secondaryButton} ml-auto`} onClick={loadTargets}>
          Re-check connections
        </button>
      </div>

      {status ? (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm shadow-soft">
          <Pill tone={locked ? "warn" : prod ? "bad" : "good"}>{locked ? "Locked" : prod ? "Live production data" : "Test data"}</Pill>
          {status.host ? <span className="font-mono text-xs font-semibold text-slate-600">{status.host}{status.database ? ` / ${status.database}` : ""}</span> : null}
          <span className="text-xs font-semibold text-slate-500">identity check: {status.marker_present === null ? "not checked" : status.marker_present ? "carries the test marker" : "no test marker"}</span>
        </div>
      ) : null}

      {status?.locked ? (
        <div className="rounded-xl border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
          <p className="mb-1 font-extrabold">{status.label} is not available</p>
          <p>{status.locked_reason}</p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-1 border-b border-violet-200" role="tablist">
            {sections.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={section === s.id}
                onClick={() => setSection(s.id)}
                className={`-mb-px rounded-t-lg border-x border-t px-4 py-2.5 text-sm font-bold ${section === s.id ? "border-violet-200 border-b-white bg-white text-purple-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {error ? <div className={errorNotice}>{error}</div> : null}
          {section === "overview" ? <OverviewPanel status={status} overview={overview} loading={loading} /> : null}
          {section === "schema" ? <SchemaBrowser target={target} /> : null}
          {section === "console" ? <SqlConsole target={target} locked={locked} /> : null}
          {section === "history" ? <HistoryPanel /> : null}
        </>
      )}
    </AppShell>
  );
}
