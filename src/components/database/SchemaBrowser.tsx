import { useCallback, useEffect, useMemo, useState } from "react";

import { input, secondaryButton } from "@/components/ui";
import { api } from "@/lib/apiClient";
import type { DbResultSet, DbTableDetail, DbTableSummary, DbTarget } from "@/lib/apiTypes";

import { formatBytes, formatNumber, Pill, ResultGrid, SectionTitle } from "./dbUi";

type Tab = "columns" | "relations" | "indexes" | "security" | "data" | "sql";
const tabs: { id: Tab; label: string }[] = [
  { id: "columns", label: "Columns" },
  { id: "relations", label: "Keys and links" },
  { id: "indexes", label: "Indexes" },
  { id: "security", label: "Security" },
  { id: "data", label: "Data" },
  { id: "sql", label: "Definition" },
];

const th = "border-b border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-500";
const td = "border-b border-violet-100 px-3 py-2 align-top text-sm";

function DataTab({ target, table }: { target: DbTarget; table: DbTableDetail }) {
  const [rows, setRows] = useState<(DbResultSet & { offset: number; limit: number }) | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [orderBy, setOrderBy] = useState<string | undefined>();
  const [descending, setDescending] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  useEffect(() => {
    setSearch("");
    setQuery("");
    setOrderBy(undefined);
    setDescending(false);
    setOffset(0);
  }, [table.table, target]);

  useEffect(() => {
    if (table.restricted) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDbRows(target, table.table, { limit, offset, order_by: orderBy, descending, q: query })
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load rows."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [target, table.table, table.restricted, offset, orderBy, descending, query]);

  if (table.restricted) return <p className="rounded-lg bg-slate-50 p-4 text-sm font-semibold text-slate-600">This table holds sign-in credentials or live sessions, so its rows are never shown here.</p>;
  return (
    <div>
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setQuery(search);
        }}
      >
        <input className={`${input} max-w-xs`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search text in this table" aria-label="Search rows" />
        <button className={secondaryButton} type="submit">
          Search
        </button>
        <select
          className={`${input} max-w-[14rem]`}
          value={orderBy || ""}
          onChange={(e) => {
            setOrderBy(e.target.value || undefined);
            setOffset(0);
          }}
          aria-label="Sort by"
        >
          <option value="">Sort: default</option>
          {table.columns.map((c) => (
            <option key={c.name} value={c.name}>
              Sort: {c.name}
            </option>
          ))}
        </select>
        <button type="button" className={secondaryButton} onClick={() => setDescending((d) => !d)} disabled={!orderBy}>
          {descending ? "Newest / largest first" : "Oldest / smallest first"}
        </button>
      </form>
      {error ? <p className="mb-3 rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      {rows ? <ResultGrid data={rows} empty={query ? "No rows match that search." : "This table is empty."} /> : <p className="text-sm font-semibold text-slate-500">{loading ? "Loading rows..." : ""}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button className={secondaryButton} disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - limit))}>
          Previous
        </button>
        <button className={secondaryButton} disabled={!rows?.truncated || loading} onClick={() => setOffset(offset + limit)}>
          Next
        </button>
        <span className="text-xs font-semibold text-slate-500">Rows {offset + 1} to {offset + (rows?.row_count || 0)}. Read-only here: use the SQL console to change data.</span>
      </div>
    </div>
  );
}

function Detail({ target, name }: { target: DbTarget; name: string }) {
  const [detail, setDetail] = useState<DbTableDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("columns");

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    api
      .getDbTable(target, name)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load the table."));
    return () => {
      cancelled = true;
    };
  }, [target, name]);

  if (error) return <p className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>;
  if (!detail) return <p className="text-sm font-semibold text-slate-500">Loading table...</p>;

  return (
    <div>
      <div className="mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold text-slate-950">{detail.label}</h2>
          <Pill tone="info">{detail.group}</Pill>
          {detail.restricted ? <Pill tone="bad">restricted</Pill> : null}
          <Pill tone={detail.rls_enabled ? "good" : "warn"}>{detail.rls_enabled ? "RLS on" : "RLS off"}</Pill>
          {detail.guarded ? <Pill tone="good">guarded</Pill> : <Pill tone="neutral">no data guard</Pill>}
        </div>
        <p className="mt-1 font-mono text-xs font-semibold text-slate-500">public.{detail.table}</p>
        {detail.description ? <p className="mt-1 text-sm font-medium text-slate-600">{detail.description}</p> : null}
        <p className="mt-1 text-xs font-semibold text-slate-500">
          about {formatNumber(detail.rows_estimate)} rows - {formatBytes(detail.bytes)} - {detail.columns.length} columns - {detail.indexes.length} indexes
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1 border-b border-violet-200" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-lg border-x border-t px-3 py-2 text-sm font-bold ${tab === t.id ? "border-violet-200 border-b-white bg-white text-purple-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "columns" ? (
        <div className="overflow-x-auto rounded-lg border border-violet-200">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className={th}>Field</th>
                <th className={th}>Kind of data</th>
                <th className={th}>Required</th>
                <th className={th}>Default</th>
                <th className={th}>Links to</th>
              </tr>
            </thead>
            <tbody>
              {detail.columns.map((c) => (
                <tr key={c.name}>
                  <td className={td}>
                    <span className="font-mono text-[13px] font-bold text-slate-900">{c.name}</span> {c.primary_key ? <Pill tone="info">primary key</Pill> : null} {c.sensitive ? <Pill tone="warn" title="Values are hidden in results">credential-like</Pill> : null}
                    <span className="block text-xs font-medium text-slate-500">{c.comment || c.label}</span>
                  </td>
                  <td className={td}>
                    {c.friendly_type}
                    <span className="block font-mono text-[11px] text-slate-400">{c.type}</span>
                  </td>
                  <td className={td}>{c.nullable ? <span className="text-slate-500">optional</span> : <span className="font-bold text-slate-900">required</span>}</td>
                  <td className={`${td} font-mono text-xs text-slate-600`}>{c.default_value || "-"}</td>
                  <td className={`${td} font-mono text-xs text-slate-600`}>{c.references || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "relations" ? (
        <div className="grid gap-5">
          <div>
            <SectionTitle>Rules on this table</SectionTitle>
            {detail.constraints.length === 0 ? <p className="text-sm text-slate-500">None.</p> : null}
            <ul className="grid gap-2">
              {detail.constraints.map((c) => (
                <li key={c.name} className="rounded-lg border border-violet-100 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={c.kind === "p" ? "info" : c.kind === "f" ? "good" : "neutral"}>{c.kind_label}</Pill>
                    <span className="font-mono text-xs font-bold">{c.name}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-600">{c.definition}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionTitle hint="Other tables that point at this one.">Used by</SectionTitle>
            {detail.referenced_by.length === 0 ? <p className="text-sm text-slate-500">No other table links here.</p> : null}
            <ul className="grid gap-1 text-sm">
              {detail.referenced_by.map((r) => (
                <li key={r.constraint_name} className="font-mono text-xs text-slate-700">
                  {r.table_name} <span className="text-slate-400">via {r.constraint_name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "indexes" ? (
        <ul className="grid gap-2">
          {detail.indexes.length === 0 ? <p className="text-sm text-slate-500">No indexes.</p> : null}
          {detail.indexes.map((i) => (
            <li key={i.name} className="rounded-lg border border-violet-100 p-3">
              <p className="font-mono text-xs font-bold text-slate-900">{i.name}</p>
              <p className="mt-1 break-words font-mono text-xs text-slate-600">{i.definition}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {tab === "security" ? (
        <div className="grid gap-5">
          <div className="grid gap-2 rounded-lg border border-violet-100 p-4 text-sm">
            <p>
              <b>Row-level security:</b> {detail.rls_enabled ? "enabled" : "NOT enabled"}
              {detail.rls_enabled ? (detail.rls_forced ? ", also applied to the table owner" : ", not applied to the table owner or to roles that bypass it") : ""}.
            </p>
            <p>
              <b>Data guard:</b> {detail.guarded ? "active on this table (rejects rows that belong to the other environment)" : "no guard trigger on this table"}.
            </p>
          </div>
          <div>
            <SectionTitle hint="Who may read or change which rows.">Policies ({detail.policies.length})</SectionTitle>
            {detail.policies.length === 0 ? <p className="text-sm text-slate-500">{detail.rls_enabled ? "RLS is on with no policy: only roles that bypass RLS can read this table." : "No policies."}</p> : null}
            <ul className="grid gap-2">
              {detail.policies.map((p) => (
                <li key={p.name} className="rounded-lg border border-violet-100 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{p.name}</span>
                    <Pill tone="info">{p.command}</Pill>
                    <Pill>{Array.isArray(p.roles) ? p.roles.join(", ") : String(p.roles).replace(/[{}]/g, "")}</Pill>
                  </div>
                  {p.using_expression ? <p className="mt-1 break-words font-mono text-xs text-slate-600">only rows where: {p.using_expression}</p> : null}
                  {p.with_check ? <p className="mt-1 break-words font-mono text-xs text-slate-600">new rows must satisfy: {p.with_check}</p> : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionTitle>Triggers ({detail.triggers.length})</SectionTitle>
            {detail.triggers.length === 0 ? <p className="text-sm text-slate-500">None.</p> : null}
            <ul className="grid gap-2">
              {detail.triggers.map((t) => (
                <li key={t.name} className="rounded-lg border border-violet-100 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">{t.name}</span>
                    <Pill tone={t.enabled ? "good" : "bad"}>{t.enabled ? "enabled" : "disabled"}</Pill>
                  </div>
                  <p className="mt-1 break-words font-mono text-xs text-slate-600">{t.definition}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {tab === "data" ? <DataTab target={target} table={detail} /> : null}

      {tab === "sql" ? (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500">A readable CREATE TABLE definition rebuilt from the live database (for reference; it is not run).</p>
          <pre className="max-h-[32rem] overflow-auto rounded-lg border border-violet-200 bg-slate-950 p-4 font-mono text-xs leading-5 text-violet-100">{detail.ddl}</pre>
        </div>
      ) : null}
    </div>
  );
}

export function SchemaBrowser({ target }: { target: DbTarget }) {
  const [tables, setTables] = useState<DbTableSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getDbTables(target)
      .then((r) => {
        setTables(r.tables);
        setSelected((cur) => (cur && r.tables.some((t) => t.name === cur) ? cur : r.tables[0]?.name || null));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load tables."))
      .finally(() => setLoading(false));
  }, [target]);

  useEffect(load, [load]);

  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const map = new Map<string, DbTableSummary[]>();
    tables
      .filter((t) => !needle || t.name.includes(needle) || t.label.toLowerCase().includes(needle))
      .forEach((t) => map.set(t.group, [...(map.get(t.group) || []), t]));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tables, filter]);

  if (error) return <p className="rounded-lg bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="rounded-xl border border-violet-200 bg-white p-3 shadow-soft lg:max-h-[75vh] lg:overflow-y-auto">
        <input className={`${input} mb-3`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a table" aria-label="Find a table" />
        {loading ? <p className="px-2 text-sm font-semibold text-slate-500">Loading...</p> : null}
        {grouped.map(([group, items]) => (
          <div key={group} className="mb-3">
            <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{group}</p>
            {items.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelected(t.name)}
                className={`mb-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${selected === t.name ? "bg-purple-50 font-bold text-purple-700" : "font-semibold text-slate-700 hover:bg-violet-50"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{t.label}</span>
                  <span className="block truncate font-mono text-[11px] font-medium text-slate-400">{t.name}</span>
                </span>
                <span className="shrink-0 text-right text-[11px] font-semibold text-slate-400">
                  {formatNumber(t.rows_estimate)}
                  <span className={`ml-1 inline-block h-2 w-2 rounded-full ${t.rls_enabled ? "bg-emerald-400" : "bg-amber-400"}`} title={t.rls_enabled ? "RLS on" : "RLS off"} />
                </span>
              </button>
            ))}
          </div>
        ))}
      </aside>
      <section className="min-w-0 rounded-xl border border-violet-200 bg-white p-5 shadow-soft">{selected ? <Detail target={target} name={selected} /> : <p className="text-sm text-slate-500">Choose a table.</p>}</section>
    </div>
  );
}
