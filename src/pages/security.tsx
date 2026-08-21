import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { AdminSecurityEventRow, api } from "@/lib/apiClient";

const protections = [
  {
    title: "ZTNA for admin/backoffice",
    risk: "An attacker finds the admin, backoffice, or internal API URL and tries to reach it directly.",
    prevention: "Put admin/backoffice behind Cloudflare Access or Tailscale. Only approved admin identities and trusted devices should reach these routes before app login starts.",
    action: "Block public access, require identity login, review access logs, and rotate admin tokens if bypass is suspected.",
  },
  {
    title: "Fake plan upgrade",
    risk: "A user patches the browser or request payload to pretend Free/Monthly is Yearly.",
    prevention: "Never trust frontend plan state. Backend must check subscription rows and verified gateway webhook state before generation, Popular IGCSE, checking, and no-ad access.",
    action: "Log event, revoke sessions, force re-login, suspend repeat offenders for manual review.",
  },
  {
    title: "No-ad patch or premium unlock",
    risk: "A user modifies the client bundle to hide ads or expose premium controls.",
    prevention: "Premium data and protected actions must be blocked server-side. UI hiding is only presentation, not security.",
    action: "Record mismatch between plan and attempted feature; add account/device risk score.",
  },
  {
    title: "DDoS or scraping",
    risk: "High-volume requests try to slow the system, scrape templates, or mass-export papers.",
    prevention: "Use CDN/WAF, per-IP and per-account rate limits, request size limits, queue slow OCR/LLM jobs, and block repeated abuse.",
    action: "Throttle first, then temporary block, then manual ban for confirmed abuse.",
  },
  {
    title: "Account takeover",
    risk: "Someone logs in using stolen credentials or attacks OTP/login routes.",
    prevention: "Email OTP, password hashing, session rotation, failed-login throttling, device/session history, and suspicious-login alerts.",
    action: "Force logout everywhere, require OTP, lock account if repeated.",
  },
  {
    title: "Product cloning attempt",
    risk: "A user exports unusually large amounts or repeatedly browses the full template bank.",
    prevention: "Quota limits, export watermarks later, anomaly logs, and template-list pagination.",
    action: "Flag account, hide bulk access, ask admin to review before permanent ban.",
  },
];

const adminControls = [
  "Force logout all sessions for a user",
  "Suspend account until manual review",
  "Block verified phone/email after confirmed abuse",
  "Add device/session fingerprint to watchlist with privacy notice",
  "Reset plan from gateway truth",
  "Export security events for audit",
  "Enable maintenance mode during active incident",
];

function eventLabel(eventType: string) {
  return eventType.replace(/^security\./, "").replace(/_/g, " ");
}

export default function SecurityPage() {
  const [events, setEvents] = useState<AdminSecurityEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadEvents() {
    setLoading(true);
    setError("");
    try {
      const response = await api.listAdminSecurityEvents();
      setEvents(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load security events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const highRiskCount = useMemo(
    () => events.filter((event) => ["high", "critical"].includes((event.severity || "").toLowerCase())).length,
    [events]
  );

  return (
    <AppShell title="Security & Risk Monitoring">
      <section className={panel}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Production security model</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Frontend is never trusted for paid access.</h2>
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Browser buttons can be patched. Real security must live in backend checks, verified payment webhooks, signed sessions, rate limits, audit logs, and admin response actions.
            </p>
          </div>
          <button type="button" onClick={loadEvents} className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-purple-800">
            Refresh events
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className={panel}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Security Events</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{events.length}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Recent server-side risk logs</p>
        </article>
        <article className={panel}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">High Risk</p>
          <p className="mt-2 text-3xl font-black text-rose-700">{highRiskCount}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Needs owner review first</p>
        </article>
        <article className={panel}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Source</p>
          <p className="mt-2 text-xl font-black text-slate-950">Backend audit stream</p>
          <p className="mt-1 text-sm font-bold text-slate-500">Events are stored server-side, not trusted from UI state</p>
        </article>
      </section>

      <section className={panel}>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Live monitoring</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Recent security events</h2>
          </div>
          {loading ? <span className="text-sm font-bold text-slate-500">Loading...</span> : null}
        </div>
        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
        {!loading && !error && events.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">No security events recorded yet.</p>
        ) : null}
        <div className="mt-4 grid gap-3">
          {events.map((event) => (
            <article key={event.id} className="rounded-2xl border border-purple-100 bg-white/80 p-4 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-black capitalize text-slate-950">{eventLabel(event.event_type)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{event.reason}</p>
                  {event.status_meaning ? <p className="mt-1 text-xs font-bold text-purple-700">{event.status_meaning}</p> : null}
                </div>
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black uppercase text-amber-900">{event.severity}</span>
              </div>
              <div className="mt-3 grid gap-2 text-xs font-bold text-slate-500 sm:grid-cols-3">
                <span>User: {event.user_name || "Unknown user"}</span>
                <span>Email: {event.user_email || "Not captured"}</span>
                <span>Plan: {event.plan_code || "unknown"} / {event.subscription_status || "unknown"}</span>
                <span>Status: {event.status || "detected"}</span>
                <span>When: {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : "Unknown"}</span>
                <span>Event: {event.event_type}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {protections.map((item) => (
          <article key={item.title} className={panel}>
            <h3 className="text-xl font-black text-slate-950">{item.title}</h3>
            <p className="mt-3 text-sm font-bold text-rose-700">Risk: {item.risk}</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Prevention: {item.prevention}</p>
            <p className="mt-3 rounded-2xl border border-violet-100 bg-violet-50/70 p-3 text-sm font-bold text-purple-900">Admin action: {item.action}</p>
          </article>
        ))}
      </section>

      <section className={panel}>
        <h2 className="text-xl font-black text-slate-950">Buttons and programs to build next</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adminControls.map((item) => (
            <div key={item} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-900">
              Planned: {item}
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
