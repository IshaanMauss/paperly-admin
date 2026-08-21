import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel, secondaryButton } from "@/components/ui";
import { api, AdminPaymentEventRow, AdminSubscriptionRow, AdminTeacherRow } from "@/lib/apiClient";

const operations = [
  { href: "/teachers", title: "User monitoring", text: "Track individual/tutor and institute users, active plans, template usage, generated-paper activity, and analytics events." },
  { href: "/billing", title: "Billing operations", text: "Review subscriptions, payment events, gateway status, and future Razorpay readiness." },
  { href: "/support", title: "Support desk", text: "Read teacher feedback and complaints submitted from the teacher product." },
  { href: "/backups", title: "Backup and recovery", text: "Export JSON/XLSX operational backups and confirm recovery readiness before deployment." },
  { href: "/health", title: "System health", text: "Check backend reachability, safety counts, missing paper tags, and production hardening gaps." },
  { href: "/security", title: "Security monitoring", text: "Track fraud, fake plan upgrades, no-ad patches, DDoS risk, abuse signals, and response actions." },
  { href: "/users", title: "Admin users and roles", text: "Define owner, admin, reviewer, and uploader responsibilities for future RBAC." },
];

export default function HomePage() {
  const [teachers, setTeachers] = useState<AdminTeacherRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRow[]>([]);
  const [events, setEvents] = useState<AdminPaymentEventRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.listAdminTeachers(), api.listAdminSubscriptions(), api.listAdminPaymentEvents()])
      .then(([teacherRes, subscriptionRes, eventRes]) => {
        setTeachers(teacherRes.items);
        setSubscriptions(subscriptionRes.items);
        setEvents(eventRes.items);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Backend not reachable"));
  }, []);

  const stats = useMemo(
    () => [
      [String(teachers.length), "users tracked"],
      [String(subscriptions.filter((row) => row.status === "active" || row.status === "trial").length), "active/trial plans"],
      [String(events.length), "payment events"],
      [String(teachers.reduce((sum, row) => sum + row.total_template_uses, 0)), "template uses"],
    ],
    [teachers, subscriptions, events]
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
            <Link href={item.href} key={item.href} className="min-h-40 rounded-2xl border border-violet-100 bg-gradient-to-b from-white/90 to-violet-50/70 p-5 shadow-soft transition hover:-translate-y-1 hover:border-purple-300 hover:shadow-card">
              <h3 className="mb-2 text-lg font-black text-slate-950">{item.title}</h3>
              <p className="text-sm font-semibold leading-6 text-slate-500">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}




