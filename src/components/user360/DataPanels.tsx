import { useEffect, useState } from "react";

import { api, saveBlob } from "@/lib/apiClient";
import type { PersonData } from "@/lib/apiClient";
import type { ReferralPerson } from "@/lib/referralTypes";
import { useAdminSession } from "@/lib/adminAuth";
import { errorNotice, secondaryButton, table, td, th } from "@/components/ui";

const card = "rounded-xl border border-violet-200 bg-white p-5 shadow-soft";
const heading = "text-sm font-extrabold text-slate-900";
const muted = "text-sm font-semibold text-slate-500";

const REASONS: Record<string, string> = {
  referral_start: "Referral reward started",
  referral_end: "Referral reward ended, plan put back",
  referral_revoked: "Referral reward ended early by an admin",
  referral_kept: "Referral reward kept: bought Yearly",
  refund: "Refund",
  promo: "Promo code",
  admin: "Changed by an admin",
  payment: "Payment",
  cancel: "Cancelled by the user",
  expiry: "Plan ran out",
};
const PLANS: Record<string, string> = {
  free: "Free", teacher_monthly: "Monthly", teacher_quarterly: "Quarterly", teacher_yearly: "Yearly", none: "No plan",
};
const plan = (v: unknown) => (v == null || v === "" ? "-" : PLANS[String(v)] ?? String(v).replace(/_/g, " "));
const reasonText = (v: unknown) => REASONS[String(v)] ?? String(v ?? "-").replace(/_/g, " ");

export function when(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const text = (v: unknown) => (v == null || v === "" ? "-" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Every plan change in plain words: when, from which plan to which, why, and for how many days. Accepts both row shapes (`at` or `created_at`). */
export function PlanHistoryList({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return <p className={muted}>No plan changes recorded yet.</p>;
  return (
    <table className={table}>
      <thead><tr><th className={th}>When</th><th className={th}>Change</th><th className={th}>Why</th><th className={th}>Days</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={td}>{when(r.at ?? r.created_at)}</td>
            <td className={td}>{plan(r.from_plan)} → <b>{plan(r.to_plan)}</b></td>
            <td className={td}>{reasonText(r.reason)}{r.source ? <span className="block text-xs text-slate-500">{text(r.source)}</span> : null}</td>
            <td className={td}>{r.days == null ? "-" : text(r.days)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A small generic table: pick the columns to show, everything else stays in the JSON download. */
function Rows({ rows, columns, empty }: { rows: Array<Record<string, unknown>>; columns: Array<[string, string]>; empty: string }) {
  if (!rows.length) return <p className={muted}>{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={table}>
        <thead><tr>{columns.map(([, label]) => <th key={label} className={th}>{label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{columns.map(([key]) => <td key={key} className={`${td} text-xs`}>{key === "at" || key.endsWith("_at") ? when(r[key]) : text(r[key])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const yesNo = (v: boolean) => (v ? "yes" : "not yet");

/** The referral story for one person: what reward they got, what their friends have done, and whether they kept Yearly. Quietly hidden when this admin cannot read referrals. */
function ReferralStoryCard({ teacherId }: { teacherId: string }) {
  const [view, setView] = useState<ReferralPerson | null>(null);
  useEffect(() => {
    let live = true;
    setView(null);
    api.getReferralPerson(teacherId).then((d) => live && setView(d)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [teacherId]);
  if (!view || (!view.trial.length && !view.friends.length && !view.invited_by.length)) return null;
  return (
    <div className={card}>
      <h4 className={heading}>Referral</h4>
      {view.trial.map((t) => (
        <p key={t.id} className="mt-2 text-sm font-semibold text-slate-700">{t.story ?? `${t.state}, ${when(t.starts_at)} to ${when(t.ends_at)}`}</p>
      ))}
      {view.friends.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className={table}>
            <thead><tr><th className={th}>Friend</th><th className={th}>Signed up</th><th className={th}>Email verified</th><th className={th}>Exported a paper</th><th className={th}>Result</th></tr></thead>
            <tbody>
              {view.friends.map((f, i) => (
                <tr key={f.referee_teacher_id}>
                  <td className={td}>{view.people[f.referee_teacher_id]?.email || `Friend ${i + 1}`}</td>
                  <td className={td}>{yesNo(f.steps?.signed_up ?? true)}</td>
                  <td className={td}>{yesNo(f.steps?.email_verified ?? false)}</td>
                  <td className={td}>{yesNo(f.steps?.paper_exported ?? false)}</td>
                  <td className={td}>{f.state}{f.reason ? ` (${f.reason})` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {view.invited_by.map((i) => (
        <p key={i.code} className="mt-2 text-xs font-semibold text-slate-500">Joined with an invite code ({i.state}).</p>
      ))}
    </div>
  );
}

/** Everything kept about one person, in plain sections. Reading needs users.read; the JSON download needs accounts.write (and is logged). */
export function UserDataPanel({ teacherId }: { teacherId: string }) {
  const { hasPermission } = useAdminSession();
  const [data, setData] = useState<PersonData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    api.getPersonData(teacherId).then((d) => live && setData(d)).catch((e) => live && setError(e instanceof Error ? e.message : "Could not load this person's data."));
    return () => {
      live = false;
    };
  }, [teacherId]);

  async function download() {
    setBusy(true);
    setError("");
    try {
      const { blob, filename } = await api.downloadPersonData(teacherId);
      saveBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  const answers = data?.profile_answers ? Object.entries(data.profile_answers).filter(([k, v]) => v != null && v !== "" && k !== "teacher_id") : [];

  return (
    <div className="grid gap-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-950">What Paperly-NT keeps about this person</h3>
            <p className={muted}>{data?.about ?? "Plan changes, orders, AI-check marks, paper actions, screen problems and profile answers."}</p>
          </div>
          {hasPermission("accounts.write") ? (
            <button type="button" className={secondaryButton} disabled={busy || !data} onClick={() => void download()}>{busy ? "Preparing..." : "Download this person (JSON)"}</button>
          ) : <span className="text-xs font-bold text-slate-400">Downloads are for the owner.</span>}
        </div>
        {error ? <p className={`${errorNotice} mt-3`}>{error}</p> : null}
        {!data && !error ? <p className="mt-3 text-sm font-bold text-slate-500">Loading...</p> : null}
      </div>

      {data ? (
        <>
          <ReferralStoryCard teacherId={teacherId} />
          <div className={card}><h4 className={heading}>Plan history</h4><PlanHistoryList rows={data.plan_history} /></div>
          <div className={card}><h4 className={heading}>Orders and refunds</h4>
            <Rows rows={data.orders} empty="No paid orders recorded yet." columns={[["at", "Paid"], ["plan", "Plan"], ["amount_paid_major", "Amount"], ["currency", "Currency"], ["promo_code", "Promo"], ["status", "Status"], ["refunded_amount", "Refunded"], ["refund_reason", "Refund reason"]]} />
          </div>
          <div className={card}><h4 className={heading}>AI checking, by topic</h4>
            <p className={muted}>Marks only. No student names, photos or handwriting are kept.</p>
            <Rows rows={data.ai_checks.by_topic} empty="No AI-checked questions yet." columns={[["topic", "Topic"], ["subtopic", "Subtopic"], ["difficulty", "Difficulty"], ["questions", "Questions"], ["average_score_fraction", "Average score (0 to 1)"]]} />
          </div>
          <div className={card}><h4 className={heading}>Paper actions (swap, fresh version, "this looks wrong")</h4>
            <Rows rows={data.paper_actions} empty="No paper actions yet." columns={[["at", "When"], ["action", "Action"], ["question_no", "Question"], ["template_id", "Template"], ["note", "Note"]]} />
          </div>
          <div className={card}><h4 className={heading}>Screen problems seen in the browser</h4>
            <Rows rows={data.screen_errors} empty="None recorded." columns={[["at", "When"], ["page", "Page"], ["message", "Message"], ["browser", "Browser"], ["app_version", "Version"]]} />
          </div>
          <div className={card}><h4 className={heading}>Profile answers</h4>
            {answers.length ? (
              <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                {answers.map(([k, v]) => (<div key={k}><dt className="text-xs font-bold uppercase text-slate-500">{k.replace(/_/g, " ")}</dt><dd className="font-semibold text-slate-800">{k === "at" ? when(v) : text(v)}</dd></div>))}
              </dl>
            ) : <p className={muted}>This person has not answered the optional questions.</p>}
          </div>
        </>
      ) : null}
    </div>
  );
}
