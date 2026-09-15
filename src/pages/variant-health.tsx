import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, panel, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh, requestAdminDataRefresh } from "@/lib/adminRefresh";
import { useAdminSession } from "@/lib/adminAuth";
import { api, type VariantHealthOverview, type VariantHealthRisk, type VariantHealthRow } from "@/lib/apiClient";

// Surfaces the same "how much of a template's real capacity has this been
// drawn from" signal the 2026-09 capacity/quality audit computed by hand, so
// an admin can catch a pool running low BEFORE a teacher starts seeing
// repeats, instead of finding out from a support ticket. Ties into two
// backend pieces added the same week: template_capacity.py (the raw
// product-of-variable-space-sizes estimate) and the per-teacher persistent
// variant-signature memory in teacher_template_usage.
//
// "Exhausted"/"watch" here is a usage-vs-capacity ratio across ALL teachers
// combined, not the same thing as one teacher's own personal memory running
// out - it's an earlier, coarser warning that a template's total space is
// small relative to how much it's actually being used, so this is the right
// moment to widen it (superset) or add a sibling into the same subtopic
// pool, before any single teacher's own memory would force a real repeat.

const RISK_THEME: Record<VariantHealthRisk, string> = {
  exhausted: "border-rose-200 bg-rose-50 text-rose-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  unknown: "border-slate-200 bg-slate-50 text-slate-600",
};

const RISK_LABEL: Record<VariantHealthRisk, string> = {
  exhausted: "Exhausted",
  watch: "Watch",
  healthy: "Healthy",
  unknown: "Unknown capacity",
};

function RiskBadge({ risk }: { risk: VariantHealthRisk }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${RISK_THEME[risk]}`}>
      {RISK_LABEL[risk]}
    </span>
  );
}

function formatCapacity(row: VariantHealthRow) {
  if (row.capacity == null) return "—";
  const prefix = row.capacity_uncertain ? "at least " : "";
  const suffix = row.capacity_capped ? "+" : "";
  return `${prefix}${row.capacity.toLocaleString()}${suffix}`;
}

// Fixed status-color order, reused from the RiskBadge theme above so the
// donut and the badges never disagree - color follows the risk bucket, never
// a re-derived hue. Matches this codebase's existing rose/amber/emerald/slate
// status palette rather than introducing a new one.
const RISK_CHART_COLOR: Record<VariantHealthRisk, string> = {
  exhausted: "#e11d48",
  watch: "#d97706",
  healthy: "#059669",
  unknown: "#94a3b8",
};

function RiskDonut({ summary }: { summary: VariantHealthOverview["summary"] }) {
  const order: VariantHealthRisk[] = ["exhausted", "watch", "healthy", "unknown"];
  const total = summary.total || 1;
  const radius = 15.9155; // circumference = 100, so each slice's dash length is just its own percent
  let cumulative = 0;
  const [hovered, setHovered] = useState<VariantHealthRisk | null>(null);

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 40 40" width="112" height="112" role="img" aria-label="Templates by risk bucket">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="7" />
        {order.map((risk) => {
          const pct = (summary[risk] / total) * 100;
          if (pct <= 0) return null;
          const dashArray = `${pct} ${100 - pct}`;
          const dashOffset = 25 - cumulative; // start at 12 o'clock, clockwise
          cumulative += pct;
          const isHovered = hovered === risk;
          return (
            <circle
              key={risk}
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke={RISK_CHART_COLOR[risk]}
              strokeWidth={isHovered ? 9 : 7}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              opacity={hovered && !isHovered ? 0.35 : 1}
              style={{ transition: "stroke-width 120ms, opacity 120ms" }}
              onMouseEnter={() => setHovered(risk)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>
                {RISK_LABEL[risk]}: {summary[risk]} template{summary[risk] === 1 ? "" : "s"} ({Math.round(pct)}%)
              </title>
            </circle>
          );
        })}
        <text x="20" y="19" textAnchor="middle" className="fill-slate-900" style={{ fontSize: "6px", fontWeight: 900 }}>
          {summary.total}
        </text>
        <text x="20" y="24.5" textAnchor="middle" className="fill-slate-500" style={{ fontSize: "2.6px", fontWeight: 700 }}>
          templates
        </text>
      </svg>
      <ul className="flex flex-col gap-1.5">
        {order.map((risk) => (
          <li key={risk} className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: RISK_CHART_COLOR[risk], opacity: hovered && hovered !== risk ? 0.35 : 1 }}
            />
            {RISK_LABEL[risk]}
            <span className="text-slate-400">· {summary[risk]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CapacityUsageBars({ rows }: { rows: VariantHealthRow[] }) {
  // Only rows with a real, sizeable capacity make sense on a shared scale -
  // "unknown" capacity templates have nothing to plot a bar against.
  const sized = rows.filter((r) => r.capacity != null && r.capacity > 0);
  if (!sized.length) return null;
  const top = [...sized].sort((a, b) => (b.usage_ratio ?? 0) - (a.usage_ratio ?? 0)).slice(0, 8);
  return (
    <div className="mt-2">
      <p className="mb-3 text-xs font-bold text-slate-500">
        Top {top.length} by usage-to-capacity ratio (usage as a share of the estimated capacity ceiling)
      </p>
      <div className="flex flex-col gap-2.5">
        {top.map((row) => {
          const pct = Math.min((row.usage_ratio ?? 0) * 100, 100);
          return (
            <div key={row.template_id} className="flex items-center gap-3">
              <p className="w-40 shrink-0 truncate font-mono text-[11px] font-bold text-slate-700" title={row.template_code}>
                {row.template_code}
              </p>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: RISK_CHART_COLOR[row.risk] }}
                  title={`${row.total_usage_count} / ${row.capacity} (${Math.round((row.usage_ratio ?? 0) * 100)}%)`}
                />
              </div>
              <p className="w-16 shrink-0 text-right text-[11px] font-black text-slate-600">
                {Math.round((row.usage_ratio ?? 0) * 100)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ExportFilter = "all" | "exported" | "never_exported";

function ActionCell({ row, onChanged }: { row: VariantHealthRow; onChanged: (templateId: string, status: string) => void }) {
  const { admin } = useAdminSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function deprecate() {
    setBusy(true);
    setError(null);
    try {
      await api.updateTemplateAdminState(row.template_id, {
        status: "deprecated",
        reviewer_name: admin?.name || admin?.email || undefined,
        notes: `Deprecated from Variant Health (risk: ${row.risk}, usage ${row.total_usage_count}/${row.capacity ?? "?"}).`,
      });
      onChanged(row.template_id, "deprecated");
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deprecate this template.");
    } finally {
      setBusy(false);
    }
  }

  const hasSiblings = row.sibling_count_subtopic > 0;

  return (
    <div className="flex flex-col items-start gap-1.5">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryButton} disabled={busy} onClick={deprecate}>
            {busy ? "Deprecating..." : "Confirm deprecate"}
          </button>
          <button type="button" className="text-xs font-bold text-slate-500" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="rounded-xl border border-rose-200 bg-white/85 px-3 py-1.5 text-xs font-extrabold text-rose-700 transition-colors hover:bg-rose-50"
          onClick={() => setConfirming(true)}
        >
          Deprecate
        </button>
      )}
      <p className="text-[11px] font-semibold text-slate-500">
        {hasSiblings
          ? `${row.sibling_count_subtopic} sibling${row.sibling_count_subtopic === 1 ? "" : "s"} in this subtopic can absorb load meanwhile.`
          : "No approved sibling in this subtopic — add a replacement before deprecating."}
      </p>
      {error ? <p className="text-[11px] font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}

export default function VariantHealthPage() {
  const [overview, setOverview] = useState<VariantHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [riskFilter, setRiskFilter] = useState<"all" | VariantHealthRisk>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [popularFilter, setPopularFilter] = useState<"all" | "popular" | "normal">("all");
  const [exportFilter, setExportFilter] = useState<ExportFilter>("all");

  function load() {
    setLoading(true);
    setError(null);
    api
      .getVariantHealth()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load variant health."))
      .finally(() => setLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    load();
  }, [refreshTick]);

  function handleDeprecated(templateId: string) {
    setOverview((prev) => (prev ? { ...prev, rows: prev.rows.filter((row) => row.template_id !== templateId) } : prev));
  }

  const topics = useMemo(() => {
    if (!overview) return [];
    return Array.from(new Set(overview.rows.map((row) => row.topic))).sort();
  }, [overview]);

  const rows = useMemo(() => {
    if (!overview) return [];
    return overview.rows.filter((row) => {
      if (riskFilter !== "all" && row.risk !== riskFilter) return false;
      if (topicFilter !== "all" && row.topic !== topicFilter) return false;
      if (popularFilter === "popular" && !row.popular_igcse) return false;
      if (popularFilter === "normal" && row.popular_igcse) return false;
      if (exportFilter === "exported" && row.exported_worksheets_included <= 0) return false;
      if (exportFilter === "never_exported" && row.exported_worksheets_included > 0) return false;
      return true;
    });
  }, [overview, riskFilter, topicFilter, popularFilter, exportFilter]);

  const activeFilterCount = [riskFilter, topicFilter, popularFilter, exportFilter].filter((v) => v !== "all").length;

  return (
    <AppShell title="Variant Health">
      <section className={panel}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Template capacity</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Which templates are running low on distinct variants</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Every number on this page is computed live from the real database on each load — nothing here is
          sampled, cached, or estimated from a subset. Two numbers are explicitly approximations and are labeled
          as such rather than presented as exact: capacity is a raw upper-bound (the product of each variable's
          independent value range, ignoring how many combinations `constraints` actually reject — shown as
          "at least N" whenever a variable's range couldn't be sized), and "Exports" counts whole worksheets that
          included this template and were opened/downloaded at least once, not individual question variants.
          Usage and export counts themselves are exact SQL aggregates. Treat "Exhausted" as a signal to widen the
          template's ranges (superset) or bring in a sibling from the same subtopic pool — not as proof any
          specific teacher has already seen a repeat.
        </p>
        <p className="mt-3 max-w-3xl rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs font-semibold leading-5 text-slate-700">
          <strong className="font-black text-slate-900">How "Usage" is calculated:</strong> the ratio is the SUM of
          every real teacher's usage_count divided by the template's estimated capacity — so a small capacity
          (some templates only have 6–15 real variants) can read "Exhausted" from a handful of ordinary teachers,
          not from one teacher hitting repeats. The table's Usage column now shows the <em>median</em> (the typical
          teacher's count — resistant to outliers) alongside the mean ± standard deviation across teachers, so you
          can tell "many teachers each did a normal amount" apart from "one heavy teacher skewed the total." This
          number only ever includes real, signed-in teacher-module activity — QA Preview / admin-token / test-panel
          traffic has no teacher_id and is structurally excluded, so a brand-new admin login cannot inflate it.
        </p>
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}

        {!loading && overview ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {(["exhausted", "watch", "healthy", "unknown"] as VariantHealthRisk[]).map((risk) => (
              <button
                key={risk}
                type="button"
                onClick={() => setRiskFilter(riskFilter === risk ? "all" : risk)}
                className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                  riskFilter === risk ? "border-purple-400 ring-2 ring-violet-200" : "border-violet-100 bg-white"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{RISK_LABEL[risk]}</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{overview.summary[risk]}</p>
              </button>
            ))}
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Approved templates</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.summary.total}</p>
            </article>
          </div>
        ) : null}

        {!loading && overview && overview.summary.total > 0 ? (
          <div className="mt-6 grid gap-6 border-t border-violet-100 pt-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Risk mix (click a slice, or a tile above, to filter)
              </p>
              <RiskDonut summary={overview.summary} />
            </div>
            <div>
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Highest usage-to-capacity ratio
              </p>
              <CapacityUsageBars rows={overview.rows} />
            </div>
          </div>
        ) : null}

        {!loading && overview ? (
          <div className="mt-6 border-t border-violet-100 pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Filter the table below
              </p>
              <p className="text-xs font-bold text-slate-500">
                Showing <span className="font-black text-slate-800">{rows.length}</span> of{" "}
                <span className="font-black text-slate-800">{overview.rows.length}</span> templates
                {activeFilterCount > 0 ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-bold text-slate-600">
                Topic
                <select
                  className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                >
                  <option value="all">All topics</option>
                  {topics.map((topic) => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>
                <span className="mt-1 block max-w-[11rem] text-[10.5px] font-semibold text-slate-400">
                  Cambridge syllabus topic, e.g. Mensuration
                </span>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Popularity
                <select
                  className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  value={popularFilter}
                  onChange={(e) => setPopularFilter(e.target.value as "all" | "popular" | "normal")}
                >
                  <option value="all">All templates</option>
                  <option value="popular">Popular IGCSE templates only</option>
                  <option value="normal">Normal (non-flagged) templates only</option>
                </select>
                <span className="mt-1 block max-w-[11rem] text-[10.5px] font-semibold text-slate-400">
                  "Popular IGCSE" = flagged in template metadata as a heavily-tested exam topic
                </span>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Export status
                <select
                  className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                  value={exportFilter}
                  onChange={(e) => setExportFilter(e.target.value as ExportFilter)}
                >
                  <option value="all">All templates</option>
                  <option value="exported">Exported at least once</option>
                  <option value="never_exported">Generated but never exported/downloaded</option>
                </select>
                <span className="mt-1 block max-w-[11rem] text-[10.5px] font-semibold text-slate-400">
                  Whether any real teacher has actually downloaded/previewed a paper using it
                </span>
              </label>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="mb-0.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-black text-purple-800"
                  onClick={() => {
                    setRiskFilter("all");
                    setTopicFilter("all");
                    setPopularFilter("all");
                    setExportFilter("all");
                  }}
                >
                  Clear all filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      {!loading && overview && rows.length ? (
        <section className={panel}>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Template</th>
                  <th className={th}>Topic / Subtopic</th>
                  <th className={th}>Paper / Popularity</th>
                  <th className={th}>Capacity</th>
                  <th className={th}>Usage</th>
                  <th className={th}>Exports</th>
                  <th className={th}>Risk</th>
                  <th className={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.template_id}>
                    <td className={td}>
                      <p className="font-mono text-xs font-bold text-slate-800">{row.template_code}</p>
                      <p className="text-[11px] text-slate-500">{row.template_type} · {row.difficulty}</p>
                    </td>
                    <td className={td}>
                      <p className="text-sm font-semibold text-slate-800">{row.topic}</p>
                      <p className="text-xs text-slate-500">{row.subtopic || "—"}</p>
                    </td>
                    <td className={td}>
                      <p className="text-xs font-bold text-slate-700">{row.paper_code || "—"}</p>
                      <span
                        className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-black capitalize ${
                          row.popular_igcse ? "border-violet-300 bg-violet-50 text-violet-800" : "border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {row.popular_igcse ? "Popular IGCSE" : "Normal"}
                      </span>
                    </td>
                    <td className={td}>
                      <p className="text-sm font-bold text-slate-800">{formatCapacity(row)}</p>
                    </td>
                    <td className={td}>
                      <p className="text-sm font-bold text-slate-800">
                        {row.total_usage_count.toLocaleString()} total
                        {row.usage_ratio != null ? ` (${Math.round(row.usage_ratio * 100)}% of capacity)` : ""}
                      </p>
                      <p className="text-[11px] text-slate-500">{row.distinct_teachers_used} teacher{row.distinct_teachers_used === 1 ? "" : "s"}</p>
                      {row.median_usage_per_teacher != null ? (
                        <p className="mt-1 text-[11px] font-bold text-slate-600">
                          typical teacher: {row.median_usage_per_teacher}
                          {row.mean_usage_per_teacher != null ? (
                            <span className="font-semibold text-slate-400">
                              {" "}(mean {row.mean_usage_per_teacher}
                              {row.stdev_usage_per_teacher != null ? ` ± ${row.stdev_usage_per_teacher}` : ""})
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                    </td>
                    <td className={td}>
                      <p className="text-sm font-bold text-slate-800">
                        {row.exported_worksheets_included.toLocaleString()} exported
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {row.never_exported_worksheets_included.toLocaleString()} generated but never exported
                      </p>
                      {row.excluded_anonymous_worksheets > 0 ? (
                        <p className="text-[10.5px] font-semibold text-slate-400">
                          +{row.excluded_anonymous_worksheets.toLocaleString()} QA/anonymous excluded
                        </p>
                      ) : null}
                      {row.excluded_test_worksheets > 0 ? (
                        <p className="text-[10.5px] font-semibold text-amber-600">
                          +{row.excluded_test_worksheets.toLocaleString()} flagged test-account worksheets excluded
                        </p>
                      ) : null}
                      {row.excluded_test_usage > 0 ? (
                        <p className="text-[10.5px] font-semibold text-amber-600">
                          +{row.excluded_test_usage.toLocaleString()} flagged test-account uses excluded from usage
                        </p>
                      ) : null}
                    </td>
                    <td className={td}>
                      <RiskBadge risk={row.risk} />
                    </td>
                    <td className={td}>
                      {row.risk === "exhausted" || row.risk === "watch" ? (
                        <ActionCell row={row} onChanged={handleDeprecated} />
                      ) : (
                        <p className="text-[11px] font-semibold text-slate-400">No action needed</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!loading && overview && !rows.length ? (
        <section className={panel}>
          <p className="text-sm font-bold text-slate-500">
            {overview.rows.length
              ? "No approved templates match the current filters."
              : "No approved templates yet."}
          </p>
        </section>
      ) : null}

      <p className="text-xs font-semibold text-slate-400">
        <button type="button" className={`${secondaryButton} px-3 py-1.5 text-xs`} onClick={requestAdminDataRefresh}>
          Refresh now
        </button>
      </p>
    </AppShell>
  );
}
