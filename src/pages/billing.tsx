import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { AdminPaymentEventRow, AdminSubscriptionRow, api } from "@/lib/apiClient";

const PAGE_SIZE = 25;

function pagerText(total: number, page: number, count: number) {
  if (!total) return "No rows";
  const start = page * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE + count, total);
  return `Showing ${start}-${end} of ${total}`;
}

export default function BillingAdminPage() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [events, setEvents] = useState<AdminPaymentEventRow[]>([]);
  const [subscriptionTotal, setSubscriptionTotal] = useState(0);
  const [eventTotal, setEventTotal] = useState(0);
  const [subscriptionPage, setSubscriptionPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [gateway, setGateway] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSubscriptionPage(0);
      setEventPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listAdminSubscriptions({ limit: PAGE_SIZE, offset: subscriptionPage * PAGE_SIZE, search: search.trim(), plan, status, sort }),
      api.listAdminPaymentEvents({ limit: PAGE_SIZE, offset: eventPage * PAGE_SIZE, search: search.trim(), gateway, event_type: eventType, sort }),
    ])
      .then(([subscriptionResponse, eventResponse]) => {
        if (cancelled) return;
        setSubscriptions(subscriptionResponse.items || []);
        setEvents(eventResponse.items || []);
        setSubscriptionTotal(subscriptionResponse.total || 0);
        setEventTotal(eventResponse.total || 0);
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
  }, [eventPage, eventType, gateway, plan, refreshTick, search, sort, status, subscriptionPage]);

  const activeCount = useMemo(() => subscriptions.filter((row) => row.status === "active" || row.status === "trial").length, [subscriptions]);
  const reset = () => {
    setSearch("");
    setPlan("all");
    setStatus("all");
    setGateway("all");
    setEventType("all");
    setSort("newest");
    setSubscriptionPage(0);
    setEventPage(0);
  };

  return (
    <AppShell title="Billing Operations">
      <section className={panel}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Revenue operations</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">Billing and gateway readiness</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              Server-side paged billing views for subscriptions and gateway events. Razorpay checkout still needs signed webhook verification before paid launch.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm font-black text-slate-700">
            <div className="rounded-2xl bg-violet-50 px-5 py-3">{subscriptionTotal} subscriptions</div>
            <div className="rounded-2xl bg-emerald-50 px-5 py-3">{activeCount} active/trial on page</div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 md:col-span-2">
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-500" placeholder="teacher, event, gateway..." />
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Plan
            <select value={plan} onChange={(event) => { setPlan(event.target.value); setSubscriptionPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="teacher_monthly">Monthly</option>
              <option value="teacher_yearly">Yearly</option>
              <option value="institute">Institute</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setSubscriptionPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All status</option>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Gateway
            <select value={gateway} onChange={(event) => { setGateway(event.target.value); setEventPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="all">All gateways</option>
              <option value="mock">Mock</option>
              <option value="razorpay">Razorpay</option>
              <option value="stripe">Stripe</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            Sort
            <select value={sort} onChange={(event) => { setSort(event.target.value); setSubscriptionPage(0); setEventPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="paid_first">Paid first</option>
              <option value="unprocessed_first">Unprocessed first</option>
            </select>
          </label>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-500 md:col-span-2 xl:col-span-1">
            Event type
            <input value={eventType === "all" ? "" : eventType} onChange={(event) => { setEventType(event.target.value || "all"); setEventPage(0); }} className="mt-2 w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-bold normal-case tracking-normal text-slate-800 outline-none focus:border-violet-500" placeholder="All events" />
          </label>
          <button type="button" onClick={reset} className="rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-black text-purple-900 md:self-end">Reset filters</button>
        </div>

        {loading && <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5 text-sm font-bold text-slate-600">Loading billing data...</div>}
        {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-bold text-rose-700">{error}</div>}

        {!loading && !error && (
          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-violet-100 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-900">Subscriptions</h3>
                <span className="text-xs font-black text-slate-500">{pagerText(subscriptionTotal, subscriptionPage, subscriptions.length)}</span>
              </div>
              {subscriptions.length === 0 ? <p className="mt-3 text-sm font-semibold text-slate-500">No subscription rows found.</p> : null}
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
              <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black">
                <button disabled={subscriptionPage === 0} onClick={() => setSubscriptionPage((value) => Math.max(0, value - 1))} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Previous</button>
                <button disabled={(subscriptionPage + 1) * PAGE_SIZE >= subscriptionTotal} onClick={() => setSubscriptionPage((value) => value + 1)} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Next</button>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black text-slate-900">Payment events</h3>
                <span className="text-xs font-black text-slate-500">{pagerText(eventTotal, eventPage, events.length)}</span>
              </div>
              {events.length === 0 ? <p className="mt-3 text-sm font-semibold text-slate-500">No payment events found.</p> : null}
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
              <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black">
                <button disabled={eventPage === 0} onClick={() => setEventPage((value) => Math.max(0, value - 1))} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Previous</button>
                <button disabled={(eventPage + 1) * PAGE_SIZE >= eventTotal} onClick={() => setEventPage((value) => value + 1)} className="rounded-xl border border-violet-200 px-4 py-2 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
