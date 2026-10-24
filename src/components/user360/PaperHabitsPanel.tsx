import { useEffect, useState } from "react";

import { api, saveBlob } from "@/lib/apiClient";
import { JsonTree } from "@/components/user360/PaperStylePanels";

const card = "rounded-xl border border-violet-200 bg-white p-5 shadow-soft";
const heading = "text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500";
const button = "rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-extrabold text-violet-800 hover:bg-violet-50";

type Habits = { teacher_id: string; summary: Record<string, unknown>; papers: Array<Record<string, unknown>>; papers_shown: number };

function pct(map: unknown) {
  if (!map || typeof map !== "object") return "-";
  const entries = Object.entries(map as Record<string, number>);
  return entries.length ? entries.map(([k, v]) => `${k.replace(/_/g, " ")} ${Math.round(Number(v) * 100)}%`).join(", ") : "-";
}

function list(map: unknown) {
  if (!map || typeof map !== "object") return "-";
  const entries = Object.entries(map as Record<string, number>);
  return entries.length ? entries.map(([k, v]) => `${k} (${v})`).join(", ") : "-";
}

/** What kinds of papers this person makes: a short summary, then the full JSON (copy or download) for analysis later. */
export function PaperHabitsPanel({ teacherId }: { teacherId: string }) {
  const [data, setData] = useState<Habits | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    api.getPaperHabits(teacherId).then((d) => live && setData(d as Habits)).catch((e) => live && setError(e instanceof Error ? e.message : "Could not load."));
    return () => {
      live = false;
    };
  }, [teacherId]);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy. Use Download instead.");
    }
  }

  function download() {
    if (!data) return;
    saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `paper-habits-${teacherId}.json`);
  }

  async function downloadEveryone() {
    setBusy(true);
    setError("");
    try {
      const all: unknown[] = [];
      for (let offset = 0; offset < 100000; offset += 5000) {
        const page = await api.getPaperExport(offset);
        all.push(...page.items);
        if (page.count < 5000) break;
      }
      saveBlob(new Blob([JSON.stringify({ schema_version: 1, count: all.length, items: all }, null, 1)], { type: "application/json" }), "paperly-all-paper-data.json");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Only the owner account can download everyone's data.");
    }
    setBusy(false);
  }

  const s = (data?.summary ?? {}) as Record<string, any>;
  return (
    <section className={card} data-testid="paper-habits">
      <p className={heading}>Paper habits</p>
      <p className="mt-1 text-sm font-semibold text-slate-600">What kinds of papers this person makes: how they split Easy, Medium and Hard, the marks they ask for, the names they gave their styles, and what they export.</p>
      {error ? <p className="mt-2 text-sm font-bold text-red-700">{error}</p> : null}
      {!data && !error ? <p className="mt-2 text-sm font-bold text-slate-500">Loading...</p> : null}
      {data ? (
        <>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="font-extrabold text-slate-500">Papers made</dt><dd className="font-bold text-slate-900">{s.papers_total} ({s.papers_exported} exported, {s.papers_checked} checked)</dd></div>
            <div><dt className="font-extrabold text-slate-500">Marks asked</dt><dd className="font-bold text-slate-900">average {s.marks?.average ?? "-"}, from {s.marks?.min ?? "-"} to {s.marks?.max ?? "-"}</dd></div>
            <div><dt className="font-extrabold text-slate-500">Usual split (Easy / Medium / Hard / Popular %)</dt><dd className="font-bold text-slate-900">{[s.average_split_pct?.easy, s.average_split_pct?.medium, s.average_split_pct?.hard, s.average_split_pct?.popular].map((v) => v ?? "-").join(" / ")}</dd></div>
            <div><dt className="font-extrabold text-slate-500">How they build</dt><dd className="font-bold text-slate-900">{pct(s.builder_share)}</dd></div>
            <div><dt className="font-extrabold text-slate-500">Top topics</dt><dd className="font-bold text-slate-900">{list(s.top_topics)}</dd></div>
            <div><dt className="font-extrabold text-slate-500">Paper codes</dt><dd className="font-bold text-slate-900">{list(s.paper_codes)}</dd></div>
            <div><dt className="font-extrabold text-slate-500">Style names they use</dt><dd className="font-bold text-slate-900">{list(s.style_names_used)}</dd></div>
            <div><dt className="font-extrabold text-slate-500">Where we could not match the ask</dt><dd className="font-bold text-slate-900">{list(s.adjustments_seen)}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => void copyJson()}>{copied ? "Copied" : "Copy JSON"}</button>
            <button type="button" className={button} onClick={download}>Download JSON</button>
            <button type="button" className={button} disabled={busy} onClick={() => void downloadEveryone()}>{busy ? "Preparing..." : "Download everyone's paper data (owner only)"}</button>
          </div>
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-lg bg-slate-50 p-3">
            <JsonTree value={data} label="paper_habits" />
          </div>
        </>
      ) : null}
    </section>
  );
}
