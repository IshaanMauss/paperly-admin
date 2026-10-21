import { useEffect, useState, type ReactNode } from "react";

import { api } from "@/lib/apiClient";
import type { PaperRecordSummary, PaperStyleRow, UserPaperStyles } from "@/lib/paperStyleTypes";

const card = "rounded-xl border border-violet-200 bg-white p-5 shadow-soft";
const heading = "text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500";

function when(value?: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "Not recorded";
}

const FIELD_LABEL: Record<string, string> = {
  name: "name", easy: "Easy %", medium: "Medium %", hard: "Hard %", popular: "Popular %", marks: "marks", diagrams: "diagrams", length: "question length", variety: "variety",
};
const changedText = (fields: string[]) => fields.map((f) => FIELD_LABEL[f] || f).join(", ");

/** A saved record opened as a collapsible tree. Keys are shown exactly as stored. */
export function JsonTree({ value, label, depth = 0 }: { value: unknown; label?: string; depth?: number }): ReactNode {
  const name = label !== undefined ? <span className="font-bold text-slate-500">{label}: </span> : null;
  if (value === null || typeof value !== "object") {
    return (
      <div className="break-all py-0.5 text-xs">
        {name}
        <span className="font-semibold text-slate-800">{value === null ? "null" : String(value)}</span>
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return (
      <div className="py-0.5 text-xs">
        {name}
        <span className="font-semibold text-slate-400">{Array.isArray(value) ? "[]" : "{}"}</span>
      </div>
    );
  }
  return (
    <details open={depth < 1} className="py-0.5 text-xs">
      <summary className="cursor-pointer font-bold text-slate-700">
        {label ?? "record"} <span className="font-semibold text-slate-400">{Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </summary>
      <div className="ml-3 border-l border-violet-100 pl-3">
        {entries.map(([key, item]) => (
          <JsonTree key={key} value={item} label={key} depth={depth + 1} />
        ))}
      </div>
    </details>
  );
}

function StyleLine({ style, active, changed }: { style: PaperStyleRow; active: boolean; changed?: string[] }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
      <span className="font-extrabold text-slate-800">
        {style.name} {active ? <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-violet-800">selected</span> : null}
      </span>
      <span className="font-bold text-slate-600">
        {style.easy}/{style.medium}/{style.hard} · {style.marks} marks · Popular {style.popular}% · diagrams {style.diagrams} · {style.length} · {style.variety}
      </span>
      <span className={`w-full font-semibold ${changed?.length ? "text-amber-700" : "text-slate-400"}`}>{changed?.length ? `Changed from the built-in: ${changedText(changed)}` : "Built-in settings"}</span>
    </li>
  );
}

/** What this user saved on the Customize page, and their recent saves. Read-only. */
export function UserStylesCard({ teacherId }: { teacherId: string }) {
  const [data, setData] = useState<UserPaperStyles | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError("");
    api
      .getUserPaperStyles(teacherId)
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load this user's styles."));
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  return (
    <div className={card}>
      <p className={heading}>Saved paper styles</p>
      {error ? <p className="mt-2 text-xs font-bold text-rose-700">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-xs font-bold text-slate-500">Loading...</p> : null}
      {data && !data.tables_ready ? <p className="mt-2 text-xs font-bold text-amber-700">The styles tables are not in this database yet (docs/project-records/paper-styles-tables.sql).</p> : null}
      {data && data.tables_ready ? (
        <>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {data.saved ? `Saved ${when(data.updated_at)} (version ${data.version}).` : "Never saved: this user gets the built-in styles."}
          </p>
          <ul className="mt-1 divide-y divide-violet-50">
            {(data.styles || []).map((style) => (
              <StyleLine key={style.id} style={style} active={style.id === data.active_style_id} changed={data.changed?.[style.id]} />
            ))}
          </ul>
          {data.history && data.history.length > 0 ? (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-extrabold text-slate-600">Recent saves ({data.history.length})</summary>
              <ul className="mt-1 space-y-0.5 font-semibold text-slate-600">
                {data.history.map((h) => (
                  <li key={h.version}>
                    v{h.version} · {when(h.at)} · selected {h.active_style_id} · {Object.keys(h.changed).length ? Object.entries(h.changed).map(([slot, fields]) => `${slot}: ${changedText(fields)}`).join("; ") : "built-in settings"}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const SKILLS_TEXT: Record<string, string> = { auto: "chosen for the user", chosen: "user's own skills", chosen_popular: "user's own skills (Popular only)" };

/** One paper in User 360: the facts from its record, and the whole record as a tree when opened. */
export function PaperRecordRow({ worksheetId, title, createdAt, pdfReady, record }: { worksheetId: string; title: string; createdAt: string | null; pdfReady: boolean; record?: PaperRecordSummary | null }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<unknown>(undefined);
  const [error, setError] = useState("");

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && full === undefined && !error) {
      api
        .getPaperRecord(worksheetId)
        .then((result) => setFull(result.recipe ?? null))
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load the record."));
    }
  }

  return (
    <li className="py-2 text-xs">
      <div className="flex flex-wrap justify-between gap-2">
        <span className="font-extrabold text-slate-800">{title}</span>
        <span className="font-bold text-slate-500">
          {when(createdAt)} - PDF {pdfReady ? "ready" : "not ready"}
        </span>
      </div>
      {record ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold text-slate-600">
          <span>Style: {record.style || "-"}</span>
          <span>
            Marks: asked {record.marks ?? "-"}, got {record.got_marks ?? "-"}
          </span>
          <span>
            Skills: {SKILLS_TEXT[record.skills || ""] || record.skills || "-"}
            {record.chosen ? ` (${record.chosen}${record.chosen_pop ? `, ${record.chosen_pop} Popular` : ""})` : ""}
          </span>
          {record.popular_questions ? <span>Popular questions: {record.popular_questions}</span> : null}
          {record.changed.length ? <span className="font-bold text-amber-700">Changed for this paper: {record.changed.map((k) => (k === "pop" ? "Popular %" : "marks")).join(", ")}</span> : null}
          {record.notes ? <span>Notes: {record.notes}</span> : null}
          <button type="button" onClick={toggle} className="font-extrabold text-purple-700 underline underline-offset-2">
            {open ? "Hide record" : "Open record"}
          </button>
        </div>
      ) : (
        <p className="mt-1 font-semibold text-slate-400">No style record (an older paper or a topical paper).</p>
      )}
      {open ? (
        <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/30 p-3">
          {error ? <p className="font-bold text-rose-700">{error}</p> : full === undefined ? <p className="font-bold text-slate-500">Loading...</p> : <JsonTree value={full} label="record" />}
        </div>
      ) : null}
    </li>
  );
}
