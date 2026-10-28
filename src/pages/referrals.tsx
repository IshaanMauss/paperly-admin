import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api } from "@/lib/apiClient";
import type { ReferralEventRow, ReferralOverview, ReferralPerson, ReferralTrialRow } from "@/lib/referralTypes";
import { PlanHistoryList } from "@/components/user360/DataPanels";

// Refer and Unlock Yearly: who has invited whom, who is on the Yearly trial, the invited friends' discounts, and the
// few actions an admin may take (end a trial early, switch off an invite code, withdraw a discount). Every action
// needs a written reason that is saved in the audit trail. Friends are shown here for admin review only.

type Tab = "summary" | "trials" | "person" | "events";
const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "trials", label: "Trials" },
  { id: "person", label: "One person" },
  { id: "events", label: "Event log" },
];

function when(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const paise = (value: number) => `₹${(value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load this."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: () => setTick((v) => v + 1) };
}

function Status({ error, loading }: { error: string; loading: boolean }) {
  return (
    <>
      {error ? <p className={errorNotice}>{error}</p> : null}
      {loading ? <p className="text-sm font-bold text-slate-500">Loading...</p> : null}
    </>
  );
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

function countText(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(", ") : "none yet";
}

function SummaryTab() {
  const { data, error, loading } = useLoad<ReferralOverview>(() => api.getReferralOverview(), []);
  return (
    <section className={panel}>
      <Status error={error} loading={loading} />
      {data ? (
        <>
          <p className={notice}>
            The feature is <b>{data.switch_on ? "ON" : "OFF"}</b> on the server (setting REFERRAL_ENABLED). While it is off nobody can get an invite code, a friend discount or a new trial; a trial that already started keeps running.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Invite codes" value={data.codes} />
            <Stat label="Friends" value={countText(data.friends)} hint="attributed = signed up, qualified = counts" />
            <Stat label="Trials" value={countText(data.trials)} />
            <Stat label="Friend discounts" value={countText(data.discounts)} />
            <Stat label="Keep Yearly payments" value={countText(data.keep_yearly)} />
            <Stat label="Same network as inviter" value={data.flags.same_network_friends} hint="information only, never blocks" />
            <Stat label="Rejected friends" value={data.flags.rejected_friends} hint="same browser, suspended or test account" />
            <Stat label="Discount used twice" value={data.flags.discount_reuse} hint="second payment on a spent discount" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-600">Trials that were due but not granted (inviter not eligible): {data.flags.trials_not_granted}. See the event log for the reason.</p>
        </>
      ) : null}
    </section>
  );
}

function ReasonBox({ reason, setReason }: { reason: string; setReason: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      Reason for the action (at least 8 characters, saved in the audit trail)
      <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you doing this?" />
    </label>
  );
}

function TrialsTab() {
  const router = useRouter();
  const [state, setState] = useState("");
  const [offset, setOffset] = useState(0);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const { data, error, loading, reload } = useLoad(() => api.getReferralTrials({ state: state || undefined, offset }), [state, offset]);
  const rows: ReferralTrialRow[] = data?.items ?? [];
  const reasonOk = reason.trim().length >= 8;

  async function revoke(id: number) {
    setMessage("");
    setActionError("");
    try {
      await api.revokeReferralTrial(id, reason.trim());
      setMessage("Trial ended. The person's own plan and unused days are back.");
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not end this trial.");
    }
  }

  return (
    <section className={panel}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          State
          <select className={input} value={state} onChange={(e) => { setState(e.target.value); setOffset(0); }}>
            <option value="">All</option>
            {["active", "converted", "expired", "revoked"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="sm:col-span-2"><ReasonBox reason={reason} setReason={setReason} /></div>
      </div>
      <div className="mt-3"><Status error={error || actionError} loading={loading} /></div>
      {message ? <p className={notice}>{message}</p> : null}
      {rows.length ? (
        <>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Person</th>
                <th className={th}>State</th>
                <th className={th}>Started</th>
                <th className={th}>Ends</th>
                <th className={th}>Was on</th>
                <th className={th}>Days given</th>
                <th className={th}>What happened</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>
                    <button type="button" className="font-bold text-purple-700 underline" onClick={() => router.push(`/referrals?tab=person&user=${encodeURIComponent(r.teacher_id)}`)}>
                      {r.person?.name || r.teacher_id.slice(0, 12)}
                    </button>
                    <div className="text-xs text-slate-500">{r.person?.email ?? ""}</div>
                  </td>
                  <td className={td}>{r.state}{r.cancel_requested_at ? " (cancel asked)" : ""}{r.revoke_reason ? ` - ${r.revoke_reason}` : ""}</td>
                  <td className={td}>{when(r.starts_at)}</td>
                  <td className={td}>{when(r.ends_at)}</td>
                  <td className={td}>{r.prior_plan_code ?? "-"}</td>
                  <td className={td}>{r.reward_days ?? "-"}</td>
                  <td className={`${td} text-xs`}>{r.story ?? "-"}</td>
                  <td className={td}>
                    {r.state === "active" ? (
                      <button type="button" className={secondaryButton} disabled={!reasonOk} onClick={() => void revoke(r.id)}>End trial now</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3 text-sm font-bold text-slate-600">
            <button type="button" className={secondaryButton} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Newer</button>
            <span>{offset + 1}-{offset + rows.length} of {data?.total ?? 0}</span>
            <button type="button" className={secondaryButton} disabled={offset + rows.length >= (data?.total ?? 0)} onClick={() => setOffset(offset + 50)}>Older</button>
          </div>
        </>
      ) : !loading && !error ? (
        <p className="text-sm font-bold text-slate-500">No trials here yet.</p>
      ) : null}
    </section>
  );
}

function PersonTab({ initialUser }: { initialUser: string }) {
  const [userId, setUserId] = useState(initialUser);
  const [active, setActive] = useState(initialUser);
  const [view, setView] = useState<ReferralPerson | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError("");
    try {
      setView(await api.getReferralPerson(id.trim()));
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : "Could not load this person.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void load(active);
  }, [active, load]);

  async function act(run: () => Promise<unknown>, done: string) {
    setMessage("");
    setError("");
    try {
      await run();
      setMessage(done);
      await load(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  }

  const reasonOk = reason.trim().length >= 8;
  const who = (id: string) => view?.people[id]?.email || view?.people[id]?.name || id.slice(0, 14);

  return (
    <section className={panel}>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setActive(userId.trim()); }}>
        <label className="grid min-w-[16rem] flex-1 gap-1 text-xs font-bold text-slate-600">
          Teacher id
          <input className={input} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Teacher id" />
        </label>
        <button type="submit" className={primaryButton}>Look up</button>
      </form>
      <div className="mt-3"><Status error={error} loading={loading} /></div>
      {message ? <p className={notice}>{message}</p> : null}
      {view ? (
        <div className="mt-2 grid gap-5">
          <div className="max-w-xl"><ReasonBox reason={reason} setReason={setReason} /></div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Invite code</h3>
            {view.code.length ? view.code.map((c) => (
              <p key={c.code} className="mt-1 text-sm font-semibold text-slate-700">
                <b>{c.code}</b>, made {when(c.created_at)}{c.disabled_at ? `, switched off ${when(c.disabled_at)} (${c.disabled_reason ?? ""})` : ""}{" "}
                {!c.disabled_at ? <button type="button" className="ml-2 text-xs font-bold text-purple-700 underline disabled:opacity-40" disabled={!reasonOk} onClick={() => void act(() => api.disableReferralCode(view.teacher_id, reason.trim()), "Invite code switched off.")}>Switch off</button> : null}
              </p>
            )) : <p className="text-sm font-semibold text-slate-500">No invite code.</p>}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Trial</h3>
            {view.trial.length ? view.trial.map((t) => (
              <p key={t.id} className="mt-1 text-sm font-semibold text-slate-700">
                {t.state}, {when(t.starts_at)} to {when(t.ends_at)}, was on {t.prior_plan_code ?? "-"}, {Math.round(t.frozen_seconds / 86400)} paid days kept aside
                {t.revoke_reason ? `. Ended early by ${t.revoked_by}: ${t.revoke_reason}` : ""}{t.story ? <span className="block text-xs font-semibold text-slate-500">{t.story}</span> : null}{" "}
                {t.state === "active" ? <button type="button" className="ml-2 text-xs font-bold text-purple-700 underline disabled:opacity-40" disabled={!reasonOk} onClick={() => void act(() => api.revokeReferralTrial(t.id, reason.trim()), "Trial ended.")}>End trial now</button> : null}
              </p>
            )) : <p className="text-sm font-semibold text-slate-500">No trial.</p>}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Friend discount (as an invited friend)</h3>
            {view.discount.length ? view.discount.map((d) => (
              <p key={d.id} className="mt-1 text-sm font-semibold text-slate-700">
                {d.state}: {paise(d.price)} instead of {paise(d.list_price)}, offered {when(d.offered_at)}, expires {when(d.expires_at)}{d.used_at ? `, used ${when(d.used_at)}` : ""}{" "}
                {d.state === "offered" ? <button type="button" className="ml-2 text-xs font-bold text-purple-700 underline disabled:opacity-40" disabled={!reasonOk} onClick={() => void act(() => api.revokeReferralDiscount(d.id, reason.trim()), "Discount withdrawn.")}>Withdraw</button> : null}
              </p>
            )) : <p className="text-sm font-semibold text-slate-500">No discount.</p>}
            {view.invited_by.map((i) => (
              <p key={i.code} className="mt-1 text-xs font-semibold text-slate-500">Invited by {who(i.referrer_teacher_id)} with {i.code} ({i.state}{i.reason ? `: ${i.reason}` : ""}).</p>
            ))}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Friends this person invited ({view.friends.length})</h3>
            {view.friends.length ? (
              <table className={table}>
                <thead><tr><th className={th}>Friend</th><th className={th}>State</th><th className={th}>Why</th><th className={th}>Steps done</th></tr></thead>
                <tbody>
                  {view.friends.map((f) => (
                    <tr key={f.referee_teacher_id}>
                      <td className={td}>{who(f.referee_teacher_id)}</td>
                      <td className={td}>{f.state}</td>
                      <td className={td}>{f.reason ?? "-"}</td>
                      <td className={`${td} text-xs`}>{f.steps ? `Signed up: ${f.steps.signed_up ? "yes" : "no"}, Email verified: ${f.steps.email_verified ? "yes" : "no"}, Exported a paper: ${f.steps.paper_exported ? "yes" : "no"}` : Object.entries(f.checks || {}).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v ? "yes" : "no"}`).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm font-semibold text-slate-500">None yet.</p>}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Plan history</h3>
            <PlanHistoryList rows={view.plan_history ?? []} />
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Keep Yearly payments</h3>
            {view.keep_yearly.length ? view.keep_yearly.map((k) => (
              <p key={k.id} className="mt-1 text-sm font-semibold text-slate-700">{k.state}: {paise(k.amount)}, order {k.order_id ?? "-"}, payment {k.payment_id ?? "-"}, {when(k.paid_at ?? k.created_at)}</p>
            )) : <p className="text-sm font-semibold text-slate-500">None.</p>}
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Recent events</h3>
            <EventTable rows={view.events.map((e, i) => ({ id: i, occurred_at: e.occurred_at, actor: e.actor, teacher_id: null, event_type: e.event_type, detail: e.detail }))} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function EventTable({ rows }: { rows: ReferralEventRow[] }) {
  if (!rows.length) return <p className="text-sm font-semibold text-slate-500">Nothing yet.</p>;
  return (
    <table className={table}>
      <thead><tr><th className={th}>When</th><th className={th}>Event</th><th className={th}>By</th><th className={th}>Detail</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className={td}>{when(r.occurred_at)}</td>
            <td className={td}>{r.event_type.replace(/_/g, " ")}</td>
            <td className={td}>{r.actor}</td>
            <td className={`${td} text-xs`}>{Object.entries(r.detail || {}).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventsTab() {
  const [kind, setKind] = useState("");
  const { data, error, loading } = useLoad(() => api.getReferralEvents({ eventType: kind || undefined }), [kind]);
  return (
    <section className={panel}>
      <label className="grid max-w-xs gap-1 text-xs font-bold text-slate-600">
        Event type
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All</option>
          {["attributed", "friend_qualified", "friend_rejected", "trial_granted", "trial_not_granted", "trial_ended", "trial_revoked", "trial_converted", "discount_offered", "discount_used", "discount_reuse_flagged", "keep_yearly_order", "trial_reminder"].map((k) => (
            <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
          ))}
        </select>
      </label>
      <div className="mt-3"><Status error={error} loading={loading} /></div>
      {data ? <EventTable rows={data.items} /> : null}
    </section>
  );
}

export default function ReferralsPage() {
  const router = useRouter();
  const queryTab = typeof router.query.tab === "string" ? (router.query.tab as Tab) : "summary";
  const queryUser = typeof router.query.user === "string" ? router.query.user : "";
  const [tab, setTab] = useState<Tab>("summary");
  useEffect(() => {
    if (TABS.some((t) => t.id === queryTab)) setTab(queryTab);
  }, [queryTab]);

  return (
    <AppShell title="Referrals">
      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">Refer and Unlock Yearly</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          A member who brings in two friends (each with a verified email who has exported a paper) gets Yearly for 28 days (a Free, Monthly or Quarterly member; a Yearly member has nothing to earn). A friend gets two months off Yearly for 14 days. Only one offer can be used on a payment: a promo code, the friend discount and Keep Yearly never combine. Ending a trial early, switching off a code or withdrawing a discount needs a written reason.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? primaryButton : secondaryButton} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </section>
      {tab === "summary" ? <SummaryTab /> : null}
      {tab === "trials" ? <TrialsTab /> : null}
      {tab === "person" ? <PersonTab key={queryUser} initialUser={queryUser} /> : null}
      {tab === "events" ? <EventsTab /> : null}
    </AppShell>
  );
}
