import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel, secondaryButton } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, AdminOverview } from "@/lib/apiClient";

const OVERVIEW_CACHE_KEY = "paperly_admin_overview_cache_v1";

const operations = [
  { href: "/teachers", title: "User monitoring", text: "Track individual/tutor and institute users, active plans, template usage, generated-paper activity, and analytics events." },
  { href: "/billing", title: "Billing operations", text: "Review subscriptions, payment events, gateway status, and future Razorpay readiness." },
  { href: "/support", title: "Support desk", text: "Read teacher feedback and complaints submitted from the teacher product." },
  { href: "/backups", title: "Backup and recovery", text: "Export JSON/XLSX operational backups and confirm recovery readiness before deployment." },
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

function readCachedOverview() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(OVERVIEW_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AdminOverview) : null;
  } catch {
    return null;
  }
}

function writeCachedOverview(value: AdminOverview) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OVERVIEW_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Cache is a speed hint only. The backend remains the source of truth.
  }
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
      [String(overview.users_tracked), "users tracked"],
      [String(overview.active_trial_plans), "active/trial plans"],
      [String(overview.payment_events), "payment events"],
      [String(overview.template_uses), "template uses"],
    ],
    [overview]
  );

  return (
    <AppShell title="Platform Operations Overview">
      {error ? <section className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-800">Backend status: {error}</section> : null}

      <section className="mb-6 grid gap-6 rounded-3xl border border-violet-100 bg-white/95 p-6 shadow-card lg:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-5">
          <span className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-extrabold text-purple-800">Business control plane</span>
          <div>
            <h2 className="max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">Monitor the product after templates are approved.</h2>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-slate-500">
              This is not the template-ingestion workspace. This panel is for owners/admins to see platform usage, billing evidence, support requests, backups, health, and future role-based controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/teachers" className={secondaryButton}>View users</Link>
            <Link href="/billing" className={secondaryButton}>Review billing</Link>
            <Link href="/backups" className={secondaryButton}>Backup data</Link>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{formatUpdatedAt(overview.generated_at)} · {overview.source || "aggregate"}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {stats.map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-violet-100 bg-gradient-to-b from-white/90 to-violet-50/70 p-5 shadow-soft">
              <strong className="block text-3xl font-black text-slate-950">{value}</strong>
              <span className="text-sm font-bold text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={panel}>
        <div className="mb-5">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-purple-800">Admin map</p>
          <h2 className="text-2xl font-black text-slate-950">Monitoring sections</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {operations.map((item) => (
            <Link href={item.href} key={item.href} className="min-h-40 rounded-2xl border border-violet-100 bg-gradient-to-b from-white/90 to-violet-50/70 p-5 shadow-soft transition-colors hover:border-purple-300">
              <h3 className="mb-2 text-lg font-black text-slate-950">{item.title}</h3>
              <p className="text-sm font-semibold leading-6 text-slate-500">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}