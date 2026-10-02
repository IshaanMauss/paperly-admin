import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, panel, primaryButton, table, td, th } from "@/components/ui";
import type { BuilderUsage } from "@/lib/apiTypes";
import { useAdminSession } from "@/lib/adminAuth";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type FullPortionOverview, type SubtopicCapPlanRow } from "@/lib/apiClient";

export default function PaperBuildersPage() {
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
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load Paper Builders data."))
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

  const fmt = (value: number | null | undefined, unit = "") => (value === null || value === undefined ? "Unlimited" : `${value}${unit}`);
  const usage = overview?.usage;

  function UsageCard({ title, note, data }: { title: string; note: string; data?: BuilderUsage }) {
    return (
      <article className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">{title}</p>
        <p className="mt-2 text-3xl font-extrabold text-slate-950">{data ? data.papers_total : "-"}</p>
        <p className="text-xs font-semibold text-slate-500">papers made, all time</p>
        {data ? (
          <ul className="mt-3 space-y-1 text-xs font-semibold text-slate-700">
            <li>{data.papers_30d} in the last 30 days ({data.papers_7d} in the last 7)</li>
            <li>{data.unique_users_30d} unique users in the last 30 days</li>
            <li>{data.unique_users_total} unique users ever</li>
          </ul>
        ) : null}
        <p className="mt-3 text-[11px] font-semibold leading-4 text-slate-400">{note}</p>
      </article>
    );
  }

  return (
    <AppShell title="Paper Builders">
      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-800">Paper Builders</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-950">How people use the three tools: Full Portion, Topical and AI checking</h2>
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!loading && overview ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <UsageCard title="Full Portion papers" data={usage?.full_portion} note="One paper that covers several whole topics, in the proportions the user picks." />
              <UsageCard title="Topical papers" data={usage?.topical} note="One paper on a single topic or hand-picked subtopics." />
              <article className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">AI checking</p>
                <p className="mt-2 text-3xl font-extrabold text-slate-950">{usage?.ai_checking ? usage.ai_checking.checks_total : "-"}</p>
                <p className="text-xs font-semibold text-slate-500">student scripts checked, all time</p>
                {usage?.ai_checking ? (
                  <ul className="mt-3 space-y-1 text-xs font-semibold text-slate-700">
                    <li>{usage.ai_checking.checks_30d} in the last 30 days</li>
                    <li>{usage.ai_checking.unique_users_30d} unique users in the last 30 days</li>
                    <li>{usage.ai_checking.unique_users_total} unique users ever</li>
                  </ul>
                ) : null}
                <p className="mt-3 text-[11px] font-semibold leading-4 text-slate-400">Every individual check is listed on the AI Checking page.</p>
              </article>
            </div>
            <p className="mt-4 text-xs font-semibold text-slate-500">
              {overview.full_portion_with_required_subtopics} Full Portion papers asked for specific subtopics (on average {overview.average_required_subtopics} each).
              "Unique users" means each person is counted once, however many papers they made.
            </p>
          </>
        ) : null}
      </section>

      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-800">Read this first</p>
        <h2 className="mt-2 text-xl font-extrabold text-slate-950">How the limits work, in plain words</h2>
        <div className="mt-3 grid max-w-4xl gap-3 text-sm font-semibold leading-6 text-slate-700">
          <p>
            <b>Two kinds of paper, one shared allowance.</b> Every paper a user makes, Full Portion or Topical, counts against the plan's overall
            papers allowance (for example 10 a day). Full Portion then has extra, tighter limits of its own, because those papers are bigger.
          </p>
          <p>
            <b>Topics per paper</b> is how many main topics a user may combine in one Full Portion paper.{" "}
            <b>Full Portion papers a day / a month</b> caps just that builder, inside the overall allowance.{" "}
            <b>Max subtopics per topic</b> is how many subtopics a user may tick as "must include" under each topic (blank means no limit).
          </p>
          <p>
            <b>"Default" versus "Effective cap" versus "Overridden".</b> Default is what the plan was built with. If you type a number in the box
            below and save, that number replaces the default straight away for everyone on the plan, and the row shows "Overridden". Effective cap
            is the number actually enforced right now. Clear the box and save to go back to unlimited.
          </p>
          <p>
            <b>Everything else</b> (paper allowance, questions per paper, AI checks per month, prices, features) is edited on the Plans &amp; Features page;
            the table below only shows you what is currently live. People who already paid keep the limits they bought with until they renew.
          </p>
        </div>
      </section>

      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-800">Live limits</p>
        <h2 className="mt-2 text-xl font-extrabold text-slate-950">What each plan can do right now</h2>
        <div className="mt-4 overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Plan</th>
                <th className={th}>Papers (all kinds)</th>
                <th className={th}>Questions per paper</th>
                <th className={th}>Full Portion topics per paper</th>
                <th className={th}>Full Portion papers a day</th>
                <th className={th}>Full Portion papers a month</th>
                <th className={th}>AI checks a month</th>
                <th className={th}>Mark scheme</th>
                <th className={th}>Popular filter</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.plan_limits?.plans || []).map((row) => (
                <tr key={row.plan_code}>
                  <td className={td}><p className="font-extrabold text-slate-950">{row.plan_label}</p></td>
                  <td className={td}>{fmt(row.paper_limit, row.paper_limit_window ? ` a ${row.paper_limit_window}` : "")}</td>
                  <td className={td}>{fmt(row.max_questions_per_paper)}</td>
                  <td className={td}>{fmt(row.full_portion_topics_per_paper)}</td>
                  <td className={td}>{fmt(row.full_portion_papers_per_day)}</td>
                  <td className={td}>{fmt(row.full_portion_papers_per_month)}</td>
                  <td className={td}>{row.ai_checks_per_month === 0 ? "None" : fmt(row.ai_checks_per_month)}</td>
                  <td className={td}>{row.can_view_mark_scheme ? "Yes" : "No"}</td>
                  <td className={td}>{row.can_use_popular_filter ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {overview?.plan_limits?.hidden_plans?.length ? (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs font-semibold leading-5 text-slate-600">
            <p className="font-extrabold text-slate-700">Not shown above, on purpose</p>
            {overview.plan_limits.hidden_plans.map((item) => (
              <p key={item.plan_code}><b className="capitalize">{item.plan_code}</b>: {item.reason}</p>
            ))}
          </div>
        ) : null}
      </section>

      <section className={panel}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-800">Editable here</p>
            <h2 className="mt-2 text-xl font-extrabold text-slate-950">Max subtopics per topic (Full Portion "must include" picker)</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Leave a plan blank for unlimited. A change here is enforced immediately in paper generation, with no deploy.
            </p>
          </div>
          {!canWrite ? <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-extrabold uppercase text-amber-900">Read-only: requires billing.write</span> : null}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Plan</th>
                <th className={th}>Default</th>
                <th className={th}>Effective cap (enforced now)</th>
                <th className={th}>Overridden?</th>
                <th className={th}>Change it</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.plan_code}>
                  <td className={td}>
                    <p className="font-extrabold text-slate-950">{plan.plan_label}</p>
                  </td>
                  <td className={td}>{plan.default_max_subtopics_per_topic === null ? "Unlimited" : plan.default_max_subtopics_per_topic}</td>
                  <td className={td}>{plan.effective_max_subtopics_per_topic === null ? "Unlimited" : plan.effective_max_subtopics_per_topic}</td>
                  <td className={td}>
                    {plan.is_overridden ? <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-extrabold uppercase text-purple-800">Overridden</span> : <span className="text-xs font-bold text-slate-400">Default</span>}
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
