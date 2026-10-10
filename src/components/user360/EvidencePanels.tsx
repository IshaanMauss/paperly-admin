import type { ReactNode } from "react";

import { planLabel } from "@/components/ui";
import type { UserDisputeCheck, UserMessageRow, UserPaymentDetail, UserSignInBlock, UserThreeSixty, UserTicketRow } from "@/lib/apiTypes";

const card = "rounded-xl border border-violet-200 bg-white p-5 shadow-soft";
const heading = "text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500";

function when(value?: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "Not recorded";
}

function rupees(paise?: number | null) {
  if (typeof paise !== "number") return "Not recorded";
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex flex-wrap justify-between gap-x-4 border-b border-violet-50 py-1.5 text-xs">
      <span className="font-bold text-slate-500">{label}</span>
      <span className={`break-all text-right font-bold ${empty ? "text-slate-300" : "text-slate-800"}`}>{empty ? "Not recorded" : value}</span>
    </div>
  );
}

const RESULT_STYLE: Record<UserDisputeCheck["result"], { dot: string; word: string }> = {
  yes: { dot: "bg-emerald-500", word: "Yes" },
  no: { dot: "bg-rose-500", word: "No" },
  unknown: { dot: "bg-amber-500", word: "Not recorded" },
  info: { dot: "bg-slate-400", word: "Note" },
};

export function DisputeChecklist({ checks }: { checks: UserDisputeCheck[] }) {
  if (!checks.length) return null;
  return (
    <div className={card}>
      <p className={heading}>Refund / dispute checklist</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        Each answer comes from saved records. "Not recorded" means the fact was never saved (for example an older payment), it does not mean "No".
      </p>
      <ul className="mt-3 divide-y divide-violet-50">
        {checks.map((c) => (
          <li key={c.label} className="flex gap-3 py-2">
            <span className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${RESULT_STYLE[c.result].dot}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-900">
                {c.label} <span className="ml-1 text-xs font-extrabold text-slate-500">{RESULT_STYLE[c.result].word}</span>
              </p>
              <p className="text-xs font-semibold text-slate-500">{c.evidence}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const OUTCOME_BADGE: Record<UserPaymentDetail["outcome"], string> = {
  paid: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  started: "bg-slate-100 text-slate-600",
  other: "bg-amber-100 text-amber-800",
};

export function PaymentsPanel({ payments }: { payments: UserPaymentDetail[] }) {
  if (!payments.length) return <div className={card}><p className="text-sm font-bold text-slate-500">No payment records for this account.</p></div>;
  return (
    <div className="space-y-4">
      {payments.map((p) => {
        const g = p.gateway_details || {};
        const cust = p.customer_at_payment || {};
        const cl = p.client || {};
        const per = p.plan_period || {};
        return (
          <details key={p.id} className={card} open={p.outcome === "paid" || p.outcome === "failed"}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-slate-900">
                <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${OUTCOME_BADGE[p.outcome]}`}>{p.outcome}</span>
                {p.plan_code ? planLabel(p.plan_code) : "Payment event"} - {p.amount_saved ? rupees(p.amount_paise) : "amount not saved"}
              </span>
              <span className="text-xs font-bold text-slate-400">{when(p.at)}</span>
            </summary>
            <div className="mt-3 grid gap-x-8 gap-y-3 lg:grid-cols-2">
              <div>
                <p className={heading}>What was charged</p>
                <Row label="Total (GST included)" value={p.amount_saved ? `${rupees(p.amount_paise)} (about $${((p.amount_paise ?? 0) / 100 / 88).toFixed(2)})` : null} />
                <Row label="Taxable value (before GST)" value={p.amount_saved ? rupees(p.taxable_value_paise) : null} />
                <Row label={`GST ${p.gst_rate_percent ?? ""}%`} value={p.amount_saved ? rupees(p.gst_amount_paise) : null} />
                <Row label="Promo code" value={p.promo_code} />
                <Row label="Discount" value={p.discount_percent ? `${p.discount_percent}%` : null} />
                <Row label="Offer id" value={p.offer_id} />
                <Row label="Bill number" value={p.bill_number} />
                <p className={`${heading} mt-3`}>What it bought</p>
                <Row label="Plan" value={p.plan_code ? planLabel(p.plan_code) : null} />
                {Object.entries(per).map(([k, v]) => <Row key={k} label={k.replace(/_/g, " ")} value={v} />)}
              </div>
              <div>
                <p className={heading}>Gateway references</p>
                <Row label="Gateway" value={p.gateway} />
                <Row label="Event" value={p.event_type} />
                <Row label="Event id" value={p.event_id} />
                <Row label="Order id" value={p.order_id} />
                <Row label="Payment id" value={p.payment_id} />
                <Row label="Processed at" value={p.processed_at ? when(p.processed_at) : null} />
                <p className={`${heading} mt-3`}>How it was paid</p>
                {Object.keys(g).length === 0 ? <Row label="Details" value={null} /> : Object.entries(g).map(([k, v]) => <Row key={k} label={k.replace(/_/g, " ")} value={String(v)} />)}
              </div>
              <div>
                <p className={heading}>Who the account was at that moment</p>
                {Object.keys(cust).length === 0 ? <Row label="Details" value={null} /> : Object.entries(cust).map(([k, v]) => <Row key={k} label={k.replace(/_/g, " ")} value={v} />)}
              </div>
              <div>
                <p className={heading}>Where the confirmation came from</p>
                {Object.keys(cl).length === 0 ? <Row label="Details" value={null} /> : Object.entries(cl).map(([k, v]) => <Row key={k} label={k.replace(/_/g, " ")} value={v} />)}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function PapersPanel({ worksheets }: { worksheets: UserThreeSixty["worksheets"] }) {
  return (
    <div className={card}>
      <p className={heading}>Papers generated (latest 50)</p>
      {worksheets.length === 0 ? (
        <p className="mt-3 text-sm font-bold text-slate-500">No papers generated by this account.</p>
      ) : (
        <ul className="mt-2 divide-y divide-violet-50">
          {worksheets.map((w) => (
            <li key={w.worksheet_id} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
              <span className="font-extrabold text-slate-800">{w.title}</span>
              <span className="font-bold text-slate-500">
                {when(w.created_at)} - PDF {w.pdf_ready ? "ready" : "not ready"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MSG_STATUS: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-800",
  failed: "bg-rose-100 text-rose-800",
  mock: "bg-amber-100 text-amber-800",
};

const PURPOSE_LABEL: Record<string, string> = {
  payment_bill: "Payment bill",
  signup: "Sign-up code",
  password_reset: "Password reset code",
  email_link: "Add-email code",
};

export function MessagesPanel({ messages, tickets }: { messages: UserMessageRow[]; tickets: UserTicketRow[] }) {
  return (
    <div className="space-y-4">
      <div className={card}>
        <p className={heading}>Emails and texts sent to this account</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">"mock" means no real provider was configured, so nothing left the server. Message text is never shown here because it can contain sign-in codes.</p>
        {messages.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-slate-500">Nothing sent.</p>
        ) : (
          <ul className="mt-2 divide-y divide-violet-50">
            {messages.map((m, i) => (
              <li key={i} className="py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-slate-800">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${MSG_STATUS[m.status] || "bg-slate-100 text-slate-600"}`}>{m.status}</span>
                    {PURPOSE_LABEL[m.purpose] || m.purpose} ({m.channel})
                  </span>
                  <span className="font-bold text-slate-400">{when(m.at)}</span>
                </div>
                <p className="mt-0.5 font-semibold text-slate-500">To {m.recipient} via {m.provider}{m.error ? ` - error: ${m.error}` : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={card}>
        <p className={heading}>Support tickets</p>
        {tickets.length === 0 ? (
          <p className="mt-3 text-sm font-bold text-slate-500">No tickets.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-xl border border-violet-50 bg-violet-50/30 p-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-extrabold text-slate-800">{t.type} - {t.status}</span>
                  <span className="font-bold text-slate-400">{when(t.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap font-semibold text-slate-700">{t.message}</p>
                {t.admin_reply && (
                  <p className="mt-2 border-l-2 border-purple-300 pl-2 font-semibold text-slate-600">
                    Reply from {t.resolved_by || "admin"} ({when(t.resolved_at)}): {t.admin_reply}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SignInSummary({ info }: { info: UserSignInBlock }) {
  return (
    <div className={card}>
      <p className={heading}>Ways this account can sign in</p>
      <div className="mt-2 grid gap-x-8 sm:grid-cols-2">
        <Row label="Email" value={`${info.email} (${info.email_verified ? "verified" : "not verified"})`} />
        <Row label="Phone" value={info.phone ? `${info.phone} (${info.phone_verified ? "verified" : "not verified"})` : null} />
        <Row label="Password set" value={info.has_password ? "Yes" : "No (Google or phone only)"} />
        <Row label="Account created" value={when(info.created_at)} />
        <Row label="Last login" value={when(info.last_login_at)} />
        <Row label="Networks seen (recent sessions)" value={info.distinct_ips.join(", ") || null} />
      </div>
    </div>
  );
}
