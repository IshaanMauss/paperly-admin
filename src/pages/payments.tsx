import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { UserLabel } from "@/components/UserLabel";
import { input, panel, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type AdminPaymentRow, type AdminPaymentsResponse } from "@/lib/apiClient";

const PAGE_SIZE = 25;

type StatusFilter = "all" | "paid" | "not_completed" | "failed";

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "not_completed", label: "Not completed" },
  { key: "failed", label: "Failed" },
];

function rupees(paise?: number | null) {
  if (typeof paise !== "number") return "-";
  return `Rs. ${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

function dollars(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function when(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : "-";
}

const STATE_STYLE: Record<AdminPaymentRow["state"], { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  not_completed: { label: "Not completed", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  failed: { label: "Failed", cls: "border-rose-200 bg-rose-50 text-rose-800" },
};

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
      {sub ? <p className="text-xs font-semibold text-slate-500">{sub}</p> : null}
    </div>
  );
}

export default function PaymentsPage() {
  const [data, setData] = useState<AdminPaymentsResponse | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      api
        .listAdminPayments({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, search: search.trim(), status })
        .then((res) => {
          if (cancelled) return;
          setData(res);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load payments.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [page, search, status, tick]);

  const summary = data?.summary || {};
  const items = data?.items || [];
  const total = data?.total || 0;

  return (
    <AppShell title="Payments">
      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-700">Revenue</p>
        <h2 className="mt-1 text-2xl font-extrabold text-slate-950">Payments</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Every Razorpay payment, with who paid, the plan, the amount in dollars and rupees, the GST inside it and any offer or promo code.
          &quot;Not completed&quot; are checkouts that were opened but never confirmed: if someone says they paid and nothing happened, start there and
          match the order ID in the Razorpay dashboard.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Collected (all time)" value={rupees(summary.collected_paise)} sub={`${summary.paid_count ?? 0} paid payments`} />
          <Tile label="Last 30 days" value={rupees(summary.last_30_days_paise)} />
          <Tile label="Last 24 hours" value={rupees(summary.last_24_hours_paise)} />
          <Tile label="Checkouts not completed" value={String(summary.not_completed_count ?? 0)} sub="opened, never paid" />
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatus(tab.key);
                  setPage(0);
                }}
                className={`rounded-full border px-4 py-1.5 text-sm font-extrabold ${status === tab.key ? "border-purple-500 bg-purple-600 text-white" : "border-violet-200 bg-white text-slate-700 hover:bg-purple-50"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <input
            className={`${input} lg:max-w-sm`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search name, email, payment or order ID, promo code..."
          />
        </div>

        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
        {loading && !data ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {data?.source === "missing_table" ? <p className="mt-4 text-sm font-bold text-amber-700">The payments table is not set up on this database yet.</p> : null}

        {data && !error ? (
          <div className="mt-4 overflow-x-auto">
            {items.length === 0 ? <p className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-sm font-semibold text-slate-600">No payments found for this filter.</p> : null}
            {items.length > 0 ? (
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>Customer</th>
                    <th className={th}>Plan</th>
                    <th className={th}>Amount</th>
                    <th className={th}>Offer / code</th>
                    <th className={th}>How</th>
                    <th className={th}>IDs</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const state = STATE_STYLE[row.state];
                    return (
                      <tr key={row.id}>
                        <td className={`${td} whitespace-nowrap text-xs font-semibold text-slate-600`}>{when(row.created_at)}</td>
                        <td className={td}>
                          <UserLabel id={row.teacher_id} name={row.teacher_name || row.payer_name} email={row.teacher_email || row.payer_email} />
                          {row.teacher_id ? (
                            <Link href={`/user-360?teacher_id=${encodeURIComponent(row.teacher_id)}`} className="mt-1 inline-block text-xs font-extrabold text-purple-700 hover:underline">
                              Open User 360
                            </Link>
                          ) : null}
                        </td>
                        <td className={`${td} font-bold text-slate-900`}>{row.plan_label || "-"}</td>
                        <td className={td}>
                          <p className="font-extrabold text-slate-950">{dollars(row.usd)}</p>
                          <p className="text-xs font-semibold text-slate-600">{rupees(row.amount_paise)}</p>
                          {row.state === "paid" && typeof row.gst_paise === "number" ? (
                            <p className="text-[11px] font-semibold text-slate-500">
                              {rupees(row.taxable_paise)} + GST {rupees(row.gst_paise)}
                            </p>
                          ) : null}
                        </td>
                        <td className={`${td} text-xs font-semibold text-slate-700`}>
                          {row.promo_code ? <p>Code {row.promo_code}</p> : null}
                          {row.discount_percent ? <p>{row.discount_percent}% off</p> : null}
                          {row.offer_id ? <p>Time-limited offer</p> : null}
                          {!row.promo_code && !row.discount_percent && !row.offer_id ? "-" : null}
                        </td>
                        <td className={`${td} text-xs font-semibold text-slate-700`}>
                          {row.method || "-"}
                          {row.gateway_status ? <p className="text-slate-500">{row.gateway_status}</p> : null}
                          {row.error ? <p className="mt-1 text-rose-700">{row.error}</p> : null}
                        </td>
                        <td className={`${td} font-mono text-[11px] text-slate-500`}>
                          {row.payment_id ? <p title="Razorpay payment ID">{row.payment_id}</p> : null}
                          {row.order_id ? <p title="Razorpay order ID">{row.order_id}</p> : null}
                        </td>
                        <td className={td}>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${state.cls}`}>{state.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}

        {data && total > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between gap-3 text-sm font-extrabold">
            <button type="button" className={secondaryButton} disabled={page === 0} onClick={() => setPage((v) => Math.max(0, v - 1))}>
              Previous
            </button>
            <span className="text-xs text-slate-500">
              {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </span>
            <button type="button" className={secondaryButton} disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((v) => v + 1)}>
              Next
            </button>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
