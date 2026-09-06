import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, panel, primaryButton, table, td, th } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type FullPortionOverview, type SubtopicCapPlanRow } from "@/lib/apiClient";

export default function FullPortionPage() {
  const { hasPermission } = useAdminSession();
  const canWrite = hasPermission("billing.write");

  const [overview, setOverview] = useState<FullPortionOverview | null>(null);
  const [plans, setPlans] = useState<SubtopicCapPlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingPlan, setSavingPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.getFullPortionOverview(), api.getSubtopicCapSettings()])
      .then(([overviewResponse, capResponse]) => {
        setOverview(overviewResponse);
        const rows = Object.values(capResponse.plans || {});
        setPlans(rows);
        const nextDrafts: Record<string, string> = {};
        rows.forEach((row) => {
          nextDrafts[row.plan_code] = row.effective_max_subtopics_per_topic === null ? "" : String(row.effective_max_subtopics_per_topic);
        });
        setDrafts(nextDrafts);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load Full Portion data."))
      .finally(() => setLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    load();
  }, [refreshTick]);

  async function saveCap(planCode: string) {
    if (!canWrite) return;
    setSavingPlan(planCode);
    setError(null);
    const rawValue = (drafts[planCode] ?? "").trim();
    const value = rawValue === "" ? null : Number(rawValue);
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      setError("Subtopic cap must be a non-negative whole number, or left blank for Unlimited.");
      setSavingPlan(null);
      return;
    }
    try {
      const response = await api.updateSubtopicCapSetting({ plan_code: planCode, max_subtopics_per_topic: value, updated_by: "admin" });
      const rows = Object.values(response.plans || {});
      setPlans(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the subtopic cap.");
    } finally {
      setSavingPlan(null);
    }
  }

  return (
    <AppShell title="Full Portion Papers">
      <section className={panel}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Full Portion vs Topical</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">How teachers are using Full Portion papers</h2>
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!loading && overview ? (
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Full Portion papers</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.full_portion_worksheets}</p>
            </article>
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Topical papers</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.topical_worksheets}</p>
            </article>
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">With required subtopics</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.full_portion_with_required_subtopics}</p>
            </article>
            <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Avg. required subtopics</p>
              <p className="mt-2 text-3xl font-black text-slate-950">{overview.average_required_subtopics}</p>
            </article>
          </div>
        ) : null}
      </section>

      <section className={panel}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Billing gate</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Max subtopics per topic, by plan</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              These caps gate the Full Portion "must include" subtopic selector. Leave a plan blank for unlimited. Overrides here take effect immediately in generation - no deploy needed.
            </p>
          </div>
          {!canWrite ? <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-900">Read-only: requires billing.write</span> : null}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Plan</th>
                <th className={th}>Default</th>
                <th className={th}>Effective cap</th>
                <th className={th}>Overridden</th>
                <th className={th}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.plan_code}>
                  <td className={td}>
                    <p className="font-black text-slate-950">{plan.plan_label}</p>
                    <p className="text-xs font-bold text-slate-500">{plan.plan_code}</p>
                  </td>
                  <td className={td}>{plan.default_max_subtopics_per_topic === null ? "Unlimited" : plan.default_max_subtopics_per_topic}</td>
                  <td className={td}>{plan.effective_max_subtopics_per_topic === null ? "Unlimited" : plan.effective_max_subtopics_per_topic}</td>
                  <td className={td}>
                    {plan.is_overridden ? <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-black uppercase text-purple-800">Overridden</span> : <span className="text-xs font-bold text-slate-400">Default</span>}
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-24 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-violet-400 disabled:bg-slate-50 disabled:text-slate-400"
                        placeholder="Unlimited"
                        value={drafts[plan.plan_code] ?? ""}
                        disabled={!canWrite}
                        onChange={(event) => setDrafts((current) => ({ ...current, [plan.plan_code]: event.target.value }))}
                      />
                      <button
                        type="button"
                        className={primaryButton}
                        disabled={!canWrite || savingPlan === plan.plan_code}
                        onClick={() => saveCap(plan.plan_code)}
                      >
                        {savingPlan === plan.plan_code ? "Saving" : "Save"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
