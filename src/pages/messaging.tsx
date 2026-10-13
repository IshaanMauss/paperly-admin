import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, label as labelClass, muted, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import {
  api,
  type MessageAudienceIn,
  type MessageAudienceStored,
  type MessageChannel,
  type MessageDetail,
  type MessageEmailLogRow,
  type MessageEstimate,
  type MessageHistory,
  type MessageKind,
  type MessageRow,
  type MessageTemplate,
  type OrganizationRow,
} from "@/lib/apiClient";

type Tab = "send" | "history" | "emails" | "templates";
type AudienceChoice = "all" | "plans" | "new" | "old" | "users" | "organization";

const TABS: { key: Tab; label: string }[] = [
  { key: "send", label: "Send" },
  { key: "history", label: "History" },
  { key: "emails", label: "Emails" },
  { key: "templates", label: "Templates" },
];
const KIND_LABEL: Record<string, string> = { account: "Account notice", offer: "Offer", news: "News" };
const KINDS: MessageKind[] = ["account", "offer", "news"];
const CHANNEL_LABEL: Record<string, string> = { inbox: "In-app bell", push: "Push", email: "Email" };
const PAID_PLANS = ["teacher_monthly", "teacher_quarterly", "teacher_yearly"];
const MAX_BODY = 300;

function when(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function errText(err: unknown) {
  return err instanceof Error ? err.message : "That did not work.";
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (["sent", "delivered", "accepted", "done", "ok", "complete", "completed"].includes(s)) return "bg-emerald-50 text-emerald-800";
  if (["failed", "error", "bounced", "rejected"].includes(s)) return "bg-rose-50 text-rose-800";
  if (["scheduled", "queued", "sending", "pending"].includes(s)) return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(status)}`}>{status}</span>;
}

function audienceSummary(a: MessageAudienceStored | null | undefined, plans: { code: string; label: string }[], teacherId?: string | null): string {
  if (teacherId) return "One user (automatic)";
  if (!a || !a.type || a.type === "all") return "All users";
  if (a.type === "plans") {
    const names = (a.plans || []).map((c) => plans.find((p) => p.code === c)?.label || c);
    return `Plans: ${names.join(", ") || "-"}`;
  }
  if (a.type === "signup") return a.which === "old" ? `Old users (signed up more than ${a.days ?? 30} days ago)` : `New users (last ${a.days ?? 30} days)`;
  if (a.type === "users") {
    const n = (a.teacher_ids || []).length;
    return `${n} user${n === 1 ? "" : "s"}${a.organization_id ? " (institute)" : ""}`;
  }
  return a.type;
}

function resultsText(r: MessageRow) {
  const s = r.stats || {};
  const parts: string[] = [];
  if (s.users !== undefined) parts.push(`${s.users} users`);
  if (s.devices !== undefined) parts.push(`${s.devices} devices`);
  if (s.accepted !== undefined) parts.push(`${s.accepted} accepted`);
  if (s.emails_sent !== undefined || s.emails_failed !== undefined) parts.push(`emails ${s.emails_sent ?? 0} sent / ${s.emails_failed ?? 0} failed`);
  parts.push(`${r.opened_count || 0} opened`);
  return parts.join(", ");
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.key} type="button" onClick={() => onChange(o.key)} className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${value === o.key ? "border-purple-600 bg-purple-600 text-white" : "border-violet-200 bg-white text-slate-700 hover:bg-purple-50"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-full overflow-x-auto rounded-xl border border-violet-100">{children}</div>;
}

export default function MessagingPage() {
  const router = useRouter();
  const { hasPermission } = useAdminSession();
  const canRead = hasPermission("users.read");
  const canWrite = hasPermission("users.write");
  const [tab, setTab] = useState<Tab>("send");
  const [overview, setOverview] = useState<MessageHistory | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [historyKey, setHistoryKey] = useState(0);

  const loadOverview = useCallback(() => {
    api.getMessageHistory({ scope: "sent", limit: 1 }).then((d) => { setOverview(d); setOverviewError(""); }).catch((e) => setOverviewError(errText(e)));
  }, []);
  const loadTemplates = useCallback(() => {
    api.listMessageTemplates().then((d) => setTemplates(d.items)).catch(() => setTemplates([]));
  }, []);
  useEffect(() => {
    if (!canRead) return;
    loadOverview();
    loadTemplates();
  }, [canRead, loadOverview, loadTemplates]);

  const plans = overview?.plans || [];

  return (
    <AppShell title="Messaging">
      {!canRead ? (
        <div className={errorNotice}>You do not have permission to view messaging.</div>
      ) : (
        <>
          <StatusStrip data={overview} error={overviewError} />
          {overview && !overview.ready ? (
            <div className={errorNotice} data-testid="messaging-not-ready">Run push-notifications-migration.sql first. Messaging tables are not created yet.</div>
          ) : null}
          <div className="mb-4 flex max-w-full gap-1 overflow-x-auto border-b border-violet-200">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-extrabold transition-colors ${tab === t.key ? "border-purple-600 text-purple-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === "send" ? (
            <SendTab canWrite={canWrite} plans={plans} templates={templates} onTemplatesChanged={loadTemplates} onSent={() => { setHistoryKey((k) => k + 1); loadOverview(); }} prefillUser={typeof router.query.user === "string" ? router.query.user : ""} routerReady={router.isReady} />
          ) : null}
          {tab === "history" ? <HistoryTab key={historyKey} canWrite={canWrite} plans={plans} /> : null}
          {tab === "emails" ? <EmailsTab /> : null}
          {tab === "templates" ? <TemplatesTab canWrite={canWrite} templates={templates} onChanged={loadTemplates} /> : null}
        </>
      )}
    </AppShell>
  );
}

function StatusStrip({ data, error }: { data: MessageHistory | null; error: string }) {
  if (error) return <div className={errorNotice}>{error}</div>;
  if (!data) return null;
  const item = (label: string, value: string, ok?: boolean) => (
    <div className="min-w-[8rem] flex-1 rounded-lg border border-violet-100 bg-white px-3 py-2">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-0.5 text-sm font-extrabold ${ok === undefined ? "text-slate-900" : ok ? "text-emerald-700" : "text-rose-700"}`}>{value}</p>
    </div>
  );
  return (
    <div className="mb-4 flex flex-wrap gap-2" data-testid="messaging-status">
      {item("Push", data.push_enabled ? "Configured" : "Not configured", data.push_enabled)}
      {item("Email", data.email_enabled ? "Configured" : "Not configured", data.email_enabled)}
      {item("Devices subscribed", `${data.devices} (${data.users} users)`)}
      {item("Offers and news opted in", String(data.offers_opted_in))}
    </div>
  );
}

/* ------------------------------ Send ------------------------------ */

function SendTab({ canWrite, plans, templates, onTemplatesChanged, onSent, prefillUser, routerReady }: {
  canWrite: boolean; plans: { code: string; label: string }[]; templates: MessageTemplate[]; onTemplatesChanged: () => void; onSent: () => void; prefillUser: string; routerReady: boolean;
}) {
  const [kind, setKind] = useState<MessageKind>("news");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [audience, setAudience] = useState<AudienceChoice>("all");
  const [selPlans, setSelPlans] = useState<string[]>([]);
  const [days, setDays] = useState(30);
  const [usersText, setUsersText] = useState("");
  const [orgs, setOrgs] = useState<OrganizationRow[]>([]);
  const [orgId, setOrgId] = useState("");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState("");
  const [estimate, setEstimate] = useState<MessageEstimate | null>(null);
  const [estimateError, setEstimateError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(null);
  const prefilled = useRef(false);

  useEffect(() => {
    api.listOrganizations({ limit: 200 }).then((d) => setOrgs(d.items)).catch(() => setOrgs([]));
  }, []);

  useEffect(() => {
    if (!routerReady || prefilled.current || !prefillUser) return;
    prefilled.current = true;
    setAudience("users");
    setUsersText(prefillUser);
    setKind("account");
  }, [routerReady, prefillUser]);

  const audiencePayload = useMemo<MessageAudienceIn | null>(() => {
    if (audience === "all") return { type: "all" };
    if (audience === "plans") return selPlans.length ? { type: "plans", plans: selPlans } : null;
    if (audience === "new" || audience === "old") return { type: "signup", which: audience, days: Math.max(1, Math.min(3650, Number(days) || 30)) };
    if (audience === "organization") return orgId ? { type: "organization", organization_id: orgId } : null;
    const list = usersText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    return list.length ? { type: "users", users: list } : null;
  }, [audience, selPlans, days, usersText, orgId]);

  const audienceKey = JSON.stringify(audiencePayload);
  useEffect(() => {
    if (!audiencePayload) { setEstimate(null); setEstimateError(""); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      api.estimateMessage({ kind, audience: audiencePayload })
        .then((d) => { if (!cancelled) { setEstimate(d); setEstimateError(""); } })
        .catch((e) => { if (!cancelled) { setEstimate(null); setEstimateError(errText(e)); } });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey, kind]);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setKind(t.kind);
    setTitle(t.title);
    setBody(t.body);
    setUrl(t.url || "");
    setPush(t.channels.includes("push"));
    setEmail(t.channels.includes("email"));
  }

  const channels: MessageChannel[] = ["inbox", ...(push ? (["push"] as const) : []), ...(email ? (["email"] as const) : [])];

  async function saveTemplate() {
    const name = window.prompt("Name for this template");
    if (!name || name.trim().length < 2) return;
    try {
      await api.createMessageTemplate({ name: name.trim(), kind, title: title.trim(), body: body.trim(), url: url.trim() || null, channels });
      setResult({ text: "Template saved.", ok: true });
      onTemplatesChanged();
    } catch (e) {
      setResult({ text: errText(e), ok: false });
    }
  }

  async function send() {
    setResult(null);
    if (title.trim().length < 3) return setResult({ text: "Write a title of at least 3 characters.", ok: false });
    if (body.trim().length < 3) return setResult({ text: "Write a message of at least 3 characters.", ok: false });
    if (url.trim() && (!url.trim().startsWith("/") || url.trim().startsWith("//"))) return setResult({ text: "The link must be a page on this site, starting with a single /.", ok: false });
    if (!audiencePayload) return setResult({ text: "Choose who should get this message.", ok: false });
    let sendAtIso: string | null = null;
    if (mode === "later") {
      const d = new Date(sendAt);
      if (!sendAt || Number.isNaN(d.getTime())) return setResult({ text: "Pick a date and time to send.", ok: false });
      if (d.getTime() <= Date.now()) return setResult({ text: "The scheduled time must be in the future.", ok: false });
      sendAtIso = d.toISOString();
    }
    const reach = estimate ? `${estimate.users} users, ${estimate.email_addresses} email addresses, ${estimate.push_devices} push devices` : "reach not known yet";
    const whenText = sendAtIso ? `Schedule for ${when(sendAtIso)}` : "Send now";
    if (!window.confirm(`${whenText}?\n\n${KIND_LABEL[kind]}: ${title.trim()}\nChannels: ${channels.map((c) => CHANNEL_LABEL[c]).join(", ")}\nReach: ${reach}`)) return;
    setBusy(true);
    try {
      const res = await api.sendMessage({ kind, title: title.trim(), body: body.trim(), url: url.trim() || null, channels, audience: audiencePayload, send_at: sendAtIso });
      setResult({ text: res.status === "scheduled" ? `Scheduled for ${when(res.scheduled_at)}.` : "Message queued. It is being sent now. See History for results.", ok: true });
      setTitle(""); setBody(""); setUrl("");
      onSent();
    } catch (e) {
      setResult({ text: errText(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  const togglePlan = (code: string) => setSelPlans((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  const planCodes = plans.map((p) => p.code);
  const paid = PAID_PLANS.filter((c) => planCodes.includes(c));

  return (
    <section className={panel} data-testid="messaging-send">
      {!canWrite ? <div className={notice}>You can view messaging but you do not have permission to send.</div> : null}
      <fieldset disabled={!canWrite} className="grid min-w-0 gap-4">
        {templates.length > 0 ? (
          <label className={labelClass}>
            Start from a template
            <select className={input} defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}>
              <option value="">Choose a template...</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ) : null}

        <div className={labelClass}>
          Kind
          <Segmented value={kind} options={KINDS.map((k) => ({ key: k, label: KIND_LABEL[k] }))} onChange={setKind} />
        </div>
        <label className={labelClass}>
          Title
          <input className={input} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Short headline" />
        </label>
        <label className={labelClass}>
          <span className="flex justify-between"><span>Message</span><span className={`text-xs ${body.length > MAX_BODY ? "text-rose-700" : muted}`}>{body.length}/{MAX_BODY}</span></span>
          <textarea className={`${input} min-h-[96px]`} value={body} maxLength={MAX_BODY} onChange={(e) => setBody(e.target.value)} />
        </label>
        <label className={labelClass}>
          Link (optional, a page on the site)
          <input className={input} value={url} maxLength={300} onChange={(e) => setUrl(e.target.value)} placeholder="/plans" />
        </label>

        <div className={labelClass}>
          Channels
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> In-app bell (always on)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} /> Push</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email</label>
          </div>
          <p className="text-xs font-semibold text-slate-500">Offers and news by email or push reach only users who switched on &quot;Offers and news&quot;; account notices reach everyone in the audience.</p>
        </div>

        <div className={labelClass}>
          Audience
          <Segmented<AudienceChoice>
            value={audience}
            onChange={setAudience}
            options={[
              { key: "all", label: "All users" },
              { key: "plans", label: "By plan" },
              { key: "new", label: "New users" },
              { key: "old", label: "Old users" },
              { key: "users", label: "Particular users or a group" },
              ...(orgs.length ? [{ key: "organization" as const, label: "An institute" }] : []),
            ]}
          />
          {audience === "plans" ? (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-700">
                {plans.map((p) => (
                  <label key={p.code} className="flex items-center gap-2"><input type="checkbox" checked={selPlans.includes(p.code)} onChange={() => togglePlan(p.code)} /> {p.label}</label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButton} onClick={() => setSelPlans(paid)}>All paid</button>
                <button type="button" className={secondaryButton} onClick={() => setSelPlans(planCodes.filter((c) => c === "free"))}>Free only</button>
              </div>
            </div>
          ) : null}
          {audience === "new" || audience === "old" ? (
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
              {audience === "new" ? "Signed up in the last" : "Signed up more than"}
              <input type="number" min={1} max={3650} className={`${input} !w-24`} value={days} onChange={(e) => setDays(Number(e.target.value))} />
              {audience === "new" ? "days" : "days ago"}
            </label>
          ) : null}
          {audience === "users" ? (
            <textarea className={`${input} min-h-[96px] font-mono`} value={usersText} onChange={(e) => setUsersText(e.target.value)} placeholder={"One email or user id per line, or separated by commas.\nA single line sends to a single user."} />
          ) : null}
          {audience === "organization" ? (
            <select className={input} value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              <option value="">Choose an institute...</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          ) : null}
        </div>

        <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-sm font-bold text-slate-800" data-testid="messaging-reach">
          {estimateError ? <span className="text-rose-700">{estimateError}</span> : estimate ? <>Reach: {estimate.users} users, {estimate.email_addresses} email addresses, {estimate.push_devices} push devices</> : <span className={muted}>Reach: choose an audience to see how many people this reaches.</span>}
        </div>

        <div className={labelClass}>
          When
          <Segmented value={mode} options={[{ key: "now", label: "Send now" }, { key: "later", label: "Schedule" }]} onChange={(m) => { setMode(m); if (m === "later" && !sendAt) setSendAt(toLocalInput(new Date(Date.now() + 3600_000))); }} />
          {mode === "later" ? (
            <div className="grid gap-1">
              <input type="datetime-local" className={`${input} sm:!w-72`} value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
              <span className="text-xs font-semibold text-slate-500">Your local time{(() => { try { return ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`; } catch { return ""; } })()}.</span>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {canWrite ? <button type="button" className={primaryButton} disabled={busy} onClick={() => void send()}>{busy ? "Working..." : mode === "later" ? "Schedule message" : "Send message"}</button> : null}
          {canWrite ? <button type="button" className={secondaryButton} disabled={busy || title.trim().length < 3 || body.trim().length < 3} onClick={() => void saveTemplate()}>Save as template</button> : null}
        </div>
      </fieldset>
      {result ? <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{result.text}</p> : null}
    </section>
  );
}

/* ----------------------------- History ----------------------------- */

function HistoryTab({ canWrite, plans }: { canWrite: boolean; plans: { code: string; label: string }[] }) {
  const [scope, setScope] = useState<"sent" | "automatic">("sent");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [data, setData] = useState<MessageHistory | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.getMessageHistory({ scope, kind, status, q: q.trim(), teacher_id: userFilter.trim(), limit: 100 })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(errText(e)))
      .finally(() => setLoading(false));
  }, [scope, kind, status, q, userFilter]);
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function cancel(id: string) {
    if (!window.confirm("Cancel this scheduled message?")) return;
    try { await api.cancelMessage(id); load(); } catch (e) { setError(errText(e)); }
  }

  return (
    <section className={panel} data-testid="messaging-history">
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <select className={input} value={scope} onChange={(e) => setScope(e.target.value as "sent" | "automatic")}>
          <option value="sent">Sent by admin</option>
          <option value="automatic">Automatic alerts to individual users</option>
        </select>
        <select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All kinds</option>
          {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["scheduled", "queued", "sending", "sent", "failed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className={input} placeholder="Search title or text" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className={input} placeholder="Filter by user id" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
      </div>
      {error ? <div className={errorNotice}>{error}</div> : null}
      {data && !data.ready ? <div className={errorNotice}>Run push-notifications-migration.sql first.</div> : null}
      <TableWrap>
        <table className={`${table} min-w-[900px]`}>
          <thead><tr>{["When", "Kind", "Title", "Audience", "Channels", "Status", "Results", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(data?.items || []).map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-purple-50/40" onClick={() => setOpenId(r.id)}>
                <td className={td}>{when(r.sent_at || r.scheduled_at || r.created_at)}</td>
                <td className={td}>{KIND_LABEL[r.kind] || r.kind}</td>
                <td className={`${td} max-w-[16rem] font-bold`}>{r.title}</td>
                <td className={td}>{audienceSummary(r.audience, plans, r.teacher_id)}</td>
                <td className={td}>{(r.channels || []).map((c) => CHANNEL_LABEL[c] || c).join(", ")}</td>
                <td className={td}><StatusPill status={r.status} /></td>
                <td className={`${td} text-xs`}>{resultsText(r)}</td>
                <td className={td} onClick={(e) => e.stopPropagation()}>
                  {canWrite && r.status === "scheduled" ? <button type="button" className={secondaryButton} onClick={() => void cancel(r.id)}>Cancel</button> : null}
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 ? <tr><td className={td} colSpan={8}>{loading ? "Loading..." : "No messages found."}</td></tr> : null}
            {!data && !error ? <tr><td className={td} colSpan={8}>Loading...</td></tr> : null}
          </tbody>
        </table>
      </TableWrap>
      {openId ? <DetailPanel id={openId} canWrite={canWrite} plans={plans} onClose={() => setOpenId(null)} onChanged={load} /> : null}
    </section>
  );
}

function DetailPanel({ id, canWrite, plans, onClose, onChanged }: { id: string; canWrite: boolean; plans: { code: string; label: string }[]; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [error, setError] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(() => {
    api.getMessageDetail(id, { channel, status }).then((d) => { setDetail(d); setError(""); }).catch((e) => setError(errText(e)));
  }, [id, channel, status]);
  useEffect(load, [load]);

  async function cancel() {
    if (!window.confirm("Cancel this scheduled message?")) return;
    try { await api.cancelMessage(id); load(); onChanged(); } catch (e) { setError(errText(e)); }
  }

  return (
    <div className="mt-4 rounded-xl border border-purple-200 bg-white p-4 shadow-soft" data-testid="messaging-detail">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-extrabold text-slate-950">{detail ? detail.title : "Message"}</h3>
        <div className="flex gap-2">
          {canWrite && detail?.status === "scheduled" ? <button type="button" className={secondaryButton} onClick={() => void cancel()}>Cancel scheduled message</button> : null}
          <button type="button" className={secondaryButton} onClick={onClose}>Close</button>
        </div>
      </div>
      {error ? <div className={`${errorNotice} mt-3`}>{error}</div> : null}
      {detail ? (
        <div className="mt-3 grid gap-4">
          <div className="grid gap-1 text-sm text-slate-700">
            <p><span className="font-bold">Kind:</span> {KIND_LABEL[detail.kind] || detail.kind} <span className="mx-2">|</span> <span className="font-bold">Status:</span> <StatusPill status={detail.status} /></p>
            <p><span className="font-bold">Audience:</span> {audienceSummary(detail.audience, plans, detail.teacher_id)}</p>
            <p><span className="font-bold">Channels:</span> {(detail.channels || []).map((c) => CHANNEL_LABEL[c] || c).join(", ")}</p>
            <p><span className="font-bold">Created:</span> {when(detail.created_at)} by {detail.created_by || "-"} <span className="mx-2">|</span> <span className="font-bold">Scheduled:</span> {when(detail.scheduled_at)} <span className="mx-2">|</span> <span className="font-bold">Sent:</span> {when(detail.sent_at)}</p>
            {detail.url ? <p><span className="font-bold">Link:</span> <span className="font-mono">{detail.url}</span></p> : null}
            <p><span className="font-bold">Results:</span> {resultsText(detail)}</p>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Message</p>
            <p className="mt-1 whitespace-pre-wrap rounded-lg bg-violet-50/60 p-3 text-sm text-slate-800">{detail.body}</p>
          </div>
          {detail.channels.includes("email") && detail.email_preview ? (
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Email preview: {detail.email_preview.subject}</p>
              <iframe title="Email preview" sandbox="" srcDoc={detail.email_preview.html} className="mt-1 h-[360px] w-full rounded-lg border border-violet-200 bg-white" />
            </div>
          ) : null}
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Delivery lines</p>
            <div className="my-2 grid gap-2 sm:grid-cols-2">
              <select className={input} value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="">All channels</option>
                {(["inbox", "push", "email"] as const).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
              </select>
              <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {["sent", "failed", "skipped", "queued"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <TableWrap>
              <table className={`${table} min-w-[720px]`}>
                <thead><tr>{["Name", "Recipient", "Channel", "Status", "Error", "Time"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {detail.deliveries.map((d, i) => (
                    <tr key={i}>
                      <td className={td}>{d.name || d.teacher_id || "-"}</td>
                      <td className={`${td} break-all`}>{d.recipient || "-"}</td>
                      <td className={td}>{CHANNEL_LABEL[d.channel] || d.channel}</td>
                      <td className={td}><StatusPill status={d.status} /></td>
                      <td className={`${td} text-xs text-rose-700`}>{d.error || ""}</td>
                      <td className={td}>{when(d.created_at)}</td>
                    </tr>
                  ))}
                  {detail.deliveries.length === 0 ? <tr><td className={td} colSpan={6}>No delivery lines.</td></tr> : null}
                </tbody>
              </table>
            </TableWrap>
            {detail.deliveries_note ? <p className="mt-2 text-xs font-semibold text-slate-500">{detail.deliveries_note}</p> : null}
          </div>
        </div>
      ) : !error ? <p className="mt-3 text-sm text-slate-500">Loading...</p> : null}
    </div>
  );
}

/* ------------------------------ Emails ------------------------------ */

function EmailsTab() {
  const [source, setSource] = useState<"admin" | "system">("admin");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<MessageEmailLogRow[] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState<MessageEmailLogRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.getMessageEmailLog({ source, q: q.trim(), status, limit: 150 })
        .then((d) => { setRows(d.items); setNote(d.note || ""); setError(""); })
        .catch((e) => setError(errText(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [source, q, status]);

  return (
    <section className={panel} data-testid="messaging-emails">
      <div className="mb-3 flex flex-col gap-2">
        <Segmented value={source} options={[{ key: "admin", label: "Admin messages" }, { key: "system", label: "System mail (sign-in and billing, 7 days)" }]} onChange={(s) => { setSource(s); setRows(null); setOpen(null); }} />
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={input} placeholder="Search recipient" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["sent", "failed", "queued", "skipped"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {note ? <p className="mb-2 text-xs font-semibold text-slate-500">{note}</p> : null}
      {error ? <div className={errorNotice}>{error}</div> : null}
      <TableWrap>
        <table className={`${table} min-w-[720px]`}>
          <thead><tr>{["Recipient", source === "admin" ? "Title" : "Purpose", "Status", "Error", "Time"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {(rows || []).map((r) => (
              <tr key={r.id} className={source === "admin" ? "cursor-pointer hover:bg-purple-50/40" : ""} onClick={() => source === "admin" && setOpen(r)}>
                <td className={`${td} break-all`}>{r.recipient}</td>
                <td className={td}>{r.title}</td>
                <td className={td}><StatusPill status={r.status} /></td>
                <td className={`${td} text-xs text-rose-700`}>{r.error || ""}</td>
                <td className={td}>{when(r.created_at)}</td>
              </tr>
            ))}
            {rows && rows.length === 0 ? <tr><td className={td} colSpan={5}>No emails found.</td></tr> : null}
            {!rows && !error ? <tr><td className={td} colSpan={5}>Loading...</td></tr> : null}
          </tbody>
        </table>
      </TableWrap>
      {open ? (
        <div className="mt-4 rounded-xl border border-purple-200 bg-white p-4 shadow-soft">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-extrabold text-slate-950">{open.title}</h3>
            <button type="button" className={secondaryButton} onClick={() => setOpen(null)}>Close</button>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">To {open.recipient} - {KIND_LABEL[open.kind] || open.kind} - {when(open.created_at)}</p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-violet-50/60 p-3 text-sm text-slate-800">{open.body || ""}</p>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------- Templates ----------------------------- */

type TemplateForm = { id: string | null; name: string; kind: MessageKind; title: string; body: string; url: string; push: boolean; email: boolean };
const EMPTY_FORM: TemplateForm = { id: null, name: "", kind: "news", title: "", body: "", url: "", push: true, email: false };

function TemplatesTab({ canWrite, templates, onChanged }: { canWrite: boolean; templates: MessageTemplate[]; onChanged: () => void }) {
  const [form, setForm] = useState<TemplateForm | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(t: MessageTemplate) {
    setForm({ id: t.id, name: t.name, kind: t.kind, title: t.title, body: t.body, url: t.url || "", push: t.channels.includes("push"), email: t.channels.includes("email") });
    setMessage(null);
  }

  async function save() {
    if (!form) return;
    const channels: MessageChannel[] = ["inbox", ...(form.push ? (["push"] as const) : []), ...(form.email ? (["email"] as const) : [])];
    const payload = { name: form.name.trim(), kind: form.kind, title: form.title.trim(), body: form.body.trim(), url: form.url.trim() || null, channels };
    setBusy(true);
    try {
      if (form.id) await api.updateMessageTemplate(form.id, payload);
      else await api.createMessageTemplate(payload);
      setMessage({ text: "Template saved.", ok: true });
      setForm(null);
      onChanged();
    } catch (e) {
      setMessage({ text: errText(e), ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: MessageTemplate) {
    if (!window.confirm(`Delete the template "${t.name}"?`)) return;
    try { await api.deleteMessageTemplate(t.id); onChanged(); } catch (e) { setMessage({ text: errText(e), ok: false }); }
  }

  return (
    <section className={panel} data-testid="messaging-templates">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Saved messages you can reuse from the Send tab.</p>
        {canWrite ? <button type="button" className={primaryButton} onClick={() => { setForm({ ...EMPTY_FORM }); setMessage(null); }}>New template</button> : null}
      </div>
      {message ? <p className={`mb-3 rounded-xl px-3 py-2 text-sm font-bold ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{message.text}</p> : null}
      {form && canWrite ? (
        <div className="mb-4 grid gap-3 rounded-xl border border-purple-200 bg-violet-50/30 p-4">
          <label className={labelClass}>Name<input className={input} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className={labelClass}>Kind<Segmented value={form.kind} options={KINDS.map((k) => ({ key: k, label: KIND_LABEL[k] }))} onChange={(k) => setForm({ ...form, kind: k })} /></div>
          <label className={labelClass}>Title<input className={input} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label className={labelClass}>
            <span className="flex justify-between"><span>Message</span><span className={`text-xs ${muted}`}>{form.body.length}/{MAX_BODY}</span></span>
            <textarea className={`${input} min-h-[80px]`} maxLength={MAX_BODY} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </label>
          <label className={labelClass}>Link (optional, starts with /)<input className={input} maxLength={300} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
          <div className="flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> In-app bell (always on)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.push} onChange={(e) => setForm({ ...form, push: e.target.checked })} /> Push</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Email</label>
          </div>
          <div className="flex gap-2">
            <button type="button" className={primaryButton} disabled={busy} onClick={() => void save()}>{busy ? "Working..." : "Save template"}</button>
            <button type="button" className={secondaryButton} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      <TableWrap>
        <table className={`${table} min-w-[720px]`}>
          <thead><tr>{["Name", "Kind", "Title", "Message", "Link", "Channels", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td className={`${td} font-bold`}>{t.name}</td>
                <td className={td}>{KIND_LABEL[t.kind] || t.kind}</td>
                <td className={td}>{t.title}</td>
                <td className={`${td} max-w-[18rem] text-xs`}>{t.body}</td>
                <td className={`${td} font-mono text-xs`}>{t.url || "-"}</td>
                <td className={td}>{t.channels.map((c) => CHANNEL_LABEL[c] || c).join(", ")}</td>
                <td className={td}>
                  {canWrite ? (
                    <div className="flex gap-2">
                      <button type="button" className={secondaryButton} onClick={() => edit(t)}>Edit</button>
                      <button type="button" className={secondaryButton} onClick={() => void remove(t)}>Delete</button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {templates.length === 0 ? <tr><td className={td} colSpan={7}>No templates yet.</td></tr> : null}
          </tbody>
        </table>
      </TableWrap>
    </section>
  );
}
