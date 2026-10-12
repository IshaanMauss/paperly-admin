import type { DbOverview, DbTargetStatus } from "@/lib/apiTypes";

import { formatBytes, formatNumber, Pill, SectionTitle, Stat } from "./dbUi";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-violet-100 py-2 text-sm last:border-0">
      <dt className="font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-bold text-slate-900">{children}</dd>
    </div>
  );
}

export function OverviewPanel({ status, overview, loading }: { status: DbTargetStatus | undefined; overview: DbOverview | null; loading: boolean }) {
  if (loading && !overview) return <p className="text-sm font-semibold text-slate-500">Loading database details...</p>;
  if (!overview) return status?.locked_reason ? null : <p className="text-sm font-semibold text-slate-500">No details available.</p>;
  const p = overview.pooling;
  const g = overview.guard;
  const connPct = overview.max_connections ? Math.round((overview.connections_in_use / overview.max_connections) * 100) : 0;
  const appVsDb = p.max_app_connections <= overview.max_connections;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tables" value={formatNumber(overview.table_count)} hint={`about ${formatNumber(overview.rows_estimate_total)} rows in total`} />
        <Stat label="Database size" value={formatBytes(overview.size_bytes)} hint={overview.server_version} />
        <Stat
          label="Connections now"
          value={`${overview.connections_in_use} / ${overview.max_connections}`}
          tone={connPct >= 80 ? "bad" : connPct >= 50 ? "warn" : "good"}
          hint={`${connPct}% of what the database allows`}
        />
        <Stat
          label="Row-level security"
          value={`${overview.rls_enabled_tables} / ${overview.table_count}`}
          tone={overview.tables_without_rls.length ? "warn" : "good"}
          hint={overview.tables_without_rls.length ? `off on: ${overview.tables_without_rls.slice(0, 3).join(", ")}${overview.tables_without_rls.length > 3 ? "..." : ""}` : "enabled on every table"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
          <SectionTitle hint="The safety layers that stop wrong data and wrong access.">Guards and access control</SectionTitle>
          <dl>
            <Row label="Data guard (blocks wrong-environment rows)">
              {g.installed ? <Pill tone={g.up_to_date ? "good" : "warn"}>{g.mode} guard v{g.version}</Pill> : <Pill tone="bad">not installed</Pill>}
            </Row>
            <Row label="Guard version expected by the code">{g.expected_version}</Row>
            <Row label="Guarded identity columns">{g.installed ? `${g.guarded_columns} guarded, ${g.unguarded.length} unguarded` : "-"}</Row>
            <Row label="Connected as">{overview.connected_as}</Row>
            <Row label="This role bypasses row-level security">
              {overview.bypasses_rls ? <Pill tone="warn" title="Policies are not applied to console queries unless 'enforce RLS' is ticked.">yes</Pill> : <Pill tone="good">no</Pill>}
            </Row>
            <Row label="Tables with RLS forced for owners">{overview.rls_forced_tables}</Row>
            <Row label="Test marker present">{overview.marker_present === null ? "-" : overview.marker_present ? "yes (test database)" : "no (production)"}</Row>
          </dl>
          {g.unguarded.length ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-semibold text-amber-800">Unguarded: {g.unguarded.join(", ")}</p> : null}
          {!g.installed ? <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">The guard SQL has not been applied to this database yet. See docs/project-records/db-guard-*.sql.</p> : null}
        </section>

        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
          <SectionTitle hint="How the app talks to the database. Pool changes need an app setting or a Supabase dashboard change.">Connection pooling</SectionTitle>
          <dl>
            <Row label="Connection mode">{p.connection_mode}</Row>
            <Row label="App pool per worker">
              {p.app_pool_size} + {p.app_max_overflow} extra
            </Row>
            <Row label="Workers">{p.workers}</Row>
            <Row label="Most connections the app can open">
              {p.max_app_connections} {appVsDb ? <Pill tone="good">fits</Pill> : <Pill tone="bad">above the database limit</Pill>}
            </Row>
            <Row label="Connection recycle">{p.app_pool_recycle_seconds}s, checked before use</Row>
            <Row label="Worksheet generations at once (per worker)">{p.max_concurrent_generations_per_worker}</Row>
            <Row label="Waiting generation gives up after">{p.generation_wait_seconds}s</Row>
            <Row label="Console time limit per statement">{p.statement_timeout_console_seconds}s</Row>
          </dl>
          {overview.connections_by_state.length ? (
            <p className="mt-3 text-xs font-semibold text-slate-500">
              Right now: {overview.connections_by_state.map((s) => `${s.connections} ${s.state}`).join(", ")}.
            </p>
          ) : null}
          <p className="mt-2 text-xs font-medium leading-5 text-slate-500">{p.note}</p>
        </section>
      </div>
    </div>
  );
}
