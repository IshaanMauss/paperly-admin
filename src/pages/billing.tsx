import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { AdminPaymentEventRow, AdminSubscriptionRow, api } from "@/lib/apiClient";

export default function BillingAdminPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [events, setEvents] = useState<AdminPaymentEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.listAdminSubscriptions(), api.listAdminPaymentEvents()])
      .then(([subscriptionResponse, eventResponse]) => {
        if (cancelled) return;
        setSubscriptions(subscriptionResponse.items);
        setEvents(eventResponse.items);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load billing operations data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = subscriptions.filter((row) => row.status === "active" || row.status === "trial").length;

  return (
    <AppShell title="Billing Operations">
      <section className={panel}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Revenue operations</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">Billing and gateway readiness</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Monitor current teacher subscriptions and raw payment events. Real Razorpay checkout should use signed webhooks before paid launch.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm font-black text-slate-700">
            <div className="rounded-2xl bg-violet-50 px-5 py-3">{subscriptions.length} subscriptions</div>
            <div className="rounded-2xl bg-emerald-50 px-5 py-3">{activeCount} active/trial</div>
          </div>
        </div>

        {loading && <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 text-sm font-bold text-slate-600">Loading billing data...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-violet-100 bg-white p-5">
              <h3 className="text-lg font-black text-slate-900">Subscriptions</h3>
              {subscriptions.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-slate-500">No subscription rows found yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {subscriptions.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs">{row.teacher_id}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-slate-700">{row.status}</span>
                      </div>
                      <div className="mt-2 text-slate-900">{row.plan_code}</div>
                      <div className="mt-1 text-xs text-slate-500">Gateway: {row.gateway} | Ends: {row.current_period_end || "-"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-violet-100 bg-white p-5">
              <h3 className="text-lg font-black text-slate-900">Payment events</h3>
              {events.length === 0 ? (
                <p className="mt-3 text-sm font-semibold text-slate-500">No payment events stored yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {events.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>{row.event_type}</span>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase text-slate-700">{row.gateway}</span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate-500">{row.event_id || "no event id"}</div>
                      <div className="mt-1 text-xs text-slate-500">Teacher: {row.teacher_id || "-"} | Created: {new Date(row.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

