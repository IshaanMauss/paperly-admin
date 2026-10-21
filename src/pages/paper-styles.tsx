import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, notice, panel, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api } from "@/lib/apiClient";
import type { PaperStylesOverview } from "@/lib/paperStyleTypes";

// Paper Styles: what users saved on the Customize page, and how styled papers were built. Read-only.
// Open one user's styles and paper records in User 360, on the Papers tab.

const FIELD_LABEL: Record<string, string> = {
  name: "Style name", easy: "Easy %", medium: "Medium %", hard: "Hard %", popular: "Popular %", marks: "Marks", diagrams: "Diagrams", length: "Question length", variety: "Variety",
};
const SLOT_LABEL: Record<string, string> = { s1: "Mostly easy (slot 1)", s2: "Balanced (slot 2)", s3: "Exam style (slot 3)" };

function when(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Counts({ title, counts, labels }: { title: string; counts?: Record<string, number>; labels?: Record<string, string> }) {
  const rows = Object.entries(counts || {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-slate-400">None yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm font-semibold text-slate-700">
          {rows.map(([key, n]) => (
            <li key={key} className="flex justify-between gap-3">
              <span>{labels?.[key] || key}</span>
              <span className="font-extrabold text-slate-900">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaperStylesPage() {
  const [data, setData] = useState<PaperStylesOverview | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    setError("");
    api
      .getPaperStylesOverview()
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load paper styles."));
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const papers = data?.papers;
  const options = data?.active_style_options;
  return (
    <AppShell title="Paper Styles">
      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">How users set up their papers</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Each user has three style slots (the Easy/Medium/Hard mix, marks, Popular %, diagrams, question length, variety). This page counts what they saved and how their papers were built. It is read-only. Open one user in User 360, Papers tab, to see their styles and each paper&apos;s record.
        </p>
      </section>
      {error ? <p className={errorNotice}>{error}</p> : null}
      {!data && !error ? <p className="text-sm font-bold text-slate-500">Loading...</p> : null}
      {data && !data.tables_ready ? <p className={notice}>The styles tables are not in this database yet. Run docs/project-records/paper-styles-tables.sql first.</p> : null}
      {data && data.tables_ready ? (
        <>
          <section className={panel}>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Saved styles</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Users who saved" value={data.users_saved ?? 0} hint="Everyone else uses the built-in styles." />
              <Stat label="Changed something" value={data.users_customised ?? 0} hint="At least one setting differs from the built-in." />
              <Stat label="Saves, last 7 / 30 days" value={`${data.edits_7d ?? 0} / ${data.edits_30d ?? 0}`} />
              <Stat label="Average marks (selected style)" value={data.avg_marks_active ?? "-"} hint={`${data.users_with_popular_on_active ?? 0} use Popular %`} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Counts title="Selected style" counts={data.active_style} labels={SLOT_LABEL} />
              <Counts title="Style slots edited" counts={data.slots_edited} labels={SLOT_LABEL} />
              <Counts title="Settings changed" counts={data.fields_edited} labels={FIELD_LABEL} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Counts title="Diagrams (selected style)" counts={options?.diagrams} />
              <Counts title="Question length (selected style)" counts={options?.length} />
              <Counts title="Variety (selected style)" counts={options?.variety} />
            </div>
          </section>

          <section className={panel}>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Papers built with a style, last 30 days</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Papers" value={papers?.papers_30d ?? 0} />
              <Stat label="Own skills picked" value={papers?.own_skills ?? 0} hint={`${papers?.popular_skills ?? 0} with Popular skills`} />
              <Stat label="Marks changed for one paper" value={papers?.changed_marks ?? 0} />
              <Stat label="Popular % changed for one paper" value={papers?.changed_popular ?? 0} />
              <Stat label="Papers with Popular questions" value={papers?.popular_used ?? 0} />
              <Stat label="Papers with notes" value={papers?.with_notes ?? 0} hint="The builder could not meet a wish exactly." />
            </div>
          </section>

          <section className={panel}>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Latest saves</h3>
            {(data.recent || []).length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-slate-400">Nobody has saved a style yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className={table}>
                  <thead>
                    <tr>
                      <th className={th}>User</th>
                      <th className={th}>Selected</th>
                      <th className={th}>Version</th>
                      <th className={th}>Saved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recent || []).map((row) => (
                      <tr key={row.user_id}>
                        <td className={td}>
                          <Link href={`/user-360?teacher_id=${encodeURIComponent(row.user_id)}`} className="font-extrabold text-slate-900 underline decoration-violet-300 decoration-2 underline-offset-2 hover:text-purple-800">
                            {row.email || row.user_id}
                          </Link>
                        </td>
                        <td className={td}>{SLOT_LABEL[row.active_style_id] || row.active_style_id}</td>
                        <td className={td}>{row.version}</td>
                        <td className={td}>{when(row.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
