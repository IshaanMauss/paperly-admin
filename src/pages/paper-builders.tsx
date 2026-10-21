import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, panel, table, td, th } from "@/components/ui";
import type { BuilderUsage } from "@/lib/apiTypes";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type FullPortionOverview } from "@/lib/apiClient";

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

export default function PaperBuildersPage() {
  const [overview, setOverview] = useState<FullPortionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getFullPortionOverview()
      .then((overviewResponse) => setOverview(overviewResponse))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load Paper Builders data."))
      .finally(() => setLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    load();
  }, [refreshTick]);

  const fmt = (value: number | null | undefined, unit = "") => (value === null || value === undefined ? "Unlimited" : `${value}${unit}`);
  const usage = overview?.usage;


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
              <UsageCard title="Full Portion papers" data={usage?.full_portion} note="One paper that covers several topics, built from the user's style (Easy/Medium/Hard mix, marks, skills)." />
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
              "Unique users" means each person is counted once, however many papers they made. How Full Portion papers were built (style, marks, skills) is on the Paper Styles page.
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
            <b>Popular filter</b> lets a plan use Popular IGCSE questions (the Popular % and the Popular skills list). <b>Mark scheme</b> is whether the user can open the answers, and <b>MS download</b> whether they can save them as a PDF.
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
                <th className={th}>MS download</th>
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
                  <td className={td}>{row.can_download_mark_scheme ? "Yes" : "No"}</td>
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

    </AppShell>
  );
}
