import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, AdminOverview } from "@/lib/apiClient";


const operations = [
  { href: "/teachers", title: "User monitoring", text: "Track individual/tutor and institute users, active plans, template usage, generated-paper activity, and analytics events." },
  { href: "/billing", title: "Billing operations", text: "Review subscriptions, payment events, gateway status, and future Razorpay readiness." },
  { href: "/support", title: "Support desk", text: "Read user feedback and complaints submitted from the product." },
  { href: "/backups", title: "Export data and backup", text: "Export a readable Excel workbook for any date range, and download the full JSON backup for recovery." },
  { href: "/health", title: "System health", text: "Check backend reachability, safety counts, missing paper tags, and production hardening gaps." },
  { href: "/security", title: "Security monitoring", text: "Track fraud, fake plan upgrades, no-ad patches, DDoS risk, abuse signals, and response actions." },
  { href: "/users", title: "Admin users and roles", text: "Define owner, admin, reviewer, and uploader responsibilities for future RBAC." },
];

const emptyOverview: AdminOverview = {
  users_tracked: 0,
  active_trial_plans: 0,
  payment_events: 0,
  template_uses: 0,
  open_support_tickets: 0,
  generated_at: null,
  source: "empty",
};

// Kept in memory only, like the admin token: nothing from the overview is written
// to browser storage. It is a speed hint for moving between pages; the backend
// remains the source of truth.
let cachedOverview: AdminOverview | null = null;

function readCachedOverview() {
  return cachedOverview;
}

function writeCachedOverview(value: AdminOverview) {
  cachedOverview = value;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Not refreshed yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function HomePage() {
  const [overview, setOverview] = useState<AdminOverview>(() => readCachedOverview() || emptyOverview);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const refreshOverview = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getAdminOverview();
      setOverview(response);
      writeCachedOverview(response);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend not reachable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview, refreshTick]);

  const stats = useMemo(
    () => [
      { value: String(overview.users_tracked), label: "Users tracked", href: "/teachers", tone: "text-purple-700 bg-purple-50" },
      { value: String(overview.active_trial_plans), label: "Active / trial plans", href: "/billing", tone: "text-emerald-700 bg-emerald-50" },
      { value: String(overview.payment_events), label: "Payment events", href: "/billing", tone: "text-sky-700 bg-sky-50" },
      { value: String(overview.template_uses), label: "Template uses", href: "/variant-health", tone: "text-amber-700 bg-amber-50" },
      { value: String(overview.open_support_tickets), label: "Open support tickets", href: "/support", tone: overview.open_support_tickets > 0 ? "text-rose-700 bg-rose-50" : "text-slate-600 bg-violet-100" },
    ],
    [overview]
  );

  return (
    <AppShell title="Overview">
      {error ? <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">Backend status: {error}</section> : null}

      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">
          {loading ? "Refreshing…" : formatUpdatedAt(overview.generated_at)}
          {overview.source ? ` · ${overview.source}` : ""}
        </p>
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((item) => (
          <Link key={item.label} href={item.href} className="group rounded-xl border border-violet-200 bg-white p-4 shadow-soft transition hover:border-purple-300 hover:shadow-card">
            <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${item.tone}`}>{item.label}</span>
            <strong className="mt-3 block text-3xl font-extrabold tracking-tight text-slate-950">{item.value}</strong>
          </Link>
        ))}
      </section>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-400">Jump to</h2>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {operations.map((item) => (
          <Link href={item.href} key={item.href} className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft transition hover:border-purple-300 hover:shadow-card">
            <h3 className="text-base font-extrabold text-slate-950">{item.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-slate-500">{item.text}</p>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}