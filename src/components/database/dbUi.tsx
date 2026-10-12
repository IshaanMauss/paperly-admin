import type { ReactNode } from "react";

import type { DbResultSet } from "@/lib/apiTypes";

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : "-";
}

type Tone = "good" | "warn" | "bad" | "neutral" | "info";

const toneClass: Record<Tone, string> = {
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-amber-100 text-amber-800",
  bad: "bg-rose-100 text-rose-700",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-violet-100 text-violet-800",
};

export function Pill({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <article className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-extrabold ${tone === "bad" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-emerald-700" : "text-slate-950"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold leading-4 text-slate-500">{hint}</p> : null}
    </article>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-base font-extrabold text-slate-950">{children}</h3>
      {hint ? <p className="mt-0.5 text-sm font-medium text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ResultGrid({ data, empty = "No rows." }: { data: DbResultSet; empty?: string }) {
  if (!data.columns.length) return <p className="text-sm font-semibold text-slate-500">The statement ran and returned no table.</p>;
  const hidden = new Set(data.hidden_columns);
  return (
    <div>
      <div className="max-h-[28rem] overflow-auto rounded-lg border border-violet-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-violet-50">
            <tr>
              {data.columns.map((c) => (
                <th key={c} className="whitespace-nowrap border-b border-violet-200 px-3 py-2 font-bold text-slate-600">
                  {c}
                  {hidden.has(c) ? <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold text-slate-600">hidden</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="px-3 py-4 text-center font-semibold text-slate-500">
                  {empty}
                </td>
              </tr>
            ) : (
              data.rows.map((row, ri) => (
                <tr key={ri} className="odd:bg-white even:bg-violet-50/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="max-w-[24rem] border-b border-violet-100 px-3 py-1.5 align-top font-mono text-[12px] text-slate-800">
                      {cell === null ? (
                        <span className="italic text-slate-400">null</span>
                      ) : typeof cell === "boolean" ? (
                        <span className="font-bold text-purple-700">{String(cell)}</span>
                      ) : hidden.has(data.columns[ci]) ? (
                        <span className="text-slate-400">••••••</span>
                      ) : (
                        <span className="whitespace-pre-wrap break-words">{String(cell)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-xs font-semibold text-slate-500">
        {data.row_count} row{data.row_count === 1 ? "" : "s"} shown{data.truncated ? " (more exist: add LIMIT/WHERE to narrow it)" : ""}
        {typeof data.duration_ms === "number" ? ` - ${data.duration_ms} ms` : ""}
        {data.hidden_columns.length ? " - credential-like columns are hidden by design" : ""}
      </p>
    </div>
  );
}
