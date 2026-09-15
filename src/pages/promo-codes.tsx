import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, label as labelClass, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type PromoCode, type PromoCodeRedemptionRow } from "@/lib/apiClient";

// Admin-issued coupon/promo code tab, built 2026-09-15 per Toyaj's CEO ask:
// hand specific students/teachers a code, they redeem it, their plan instantly
// changes (e.g. free-of-charge Yearly) - fully dynamic, no code deploy needed
// to issue, edit, or kill a code. Standard coupon-code pattern (Stripe
// Coupons / Shopify discount codes). See app/models/promo.py in the backend
// for the full design note and abuse guards (one redemption per teacher per
// code, a row-locked cap check so the last slot can't double-redeem).

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </article>
  );
}

function StatusBadge({ code }: { code: PromoCode }) {
  if (!code.is_active) {
    return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-600">Off</span>;
  }
  if (code.is_expired) {
    return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">Expired</span>;
  }
  if (code.is_exhausted) {
    return <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-black text-rose-800">Fully redeemed</span>;
  }
  return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800">Active</span>;
}

function CreateCodeForm({ planOptions, onCreated }: { planOptions: Record<string, string>; onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [planCode, setPlanCode] = useState(Object.keys(planOptions)[0] || "teacher_yearly");
  const [label, setLabelText] = useState("");
  const [discountPercent, setDiscountPercent] = useState("100");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createPromoCode({
        code,
        plan_code: planCode,
        label: label || null,
        discount_percent: Number(discountPercent) || 0,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setCode("");
      setLabelText("");
      setDiscountPercent("100");
      setMaxRedemptions("");
      setExpiresAt("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className={labelClass}>
        Code
        <input className={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SCHOOL2026" required maxLength={64} />
      </label>
      <label className={labelClass}>
        Grants plan
        <select className={input} value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
          {Object.entries(planOptions).map(([value, planLabel]) => (
            <option key={value} value={value}>
              {planLabel}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Internal label (optional)
        <input className={input} value={label} onChange={(e) => setLabelText(e.target.value)} placeholder="e.g. Regional school batch" maxLength={200} />
      </label>
      <label className={labelClass}>
        Discount % (display only — 100 = free)
        <input className={input} type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
      </label>
      <label className={labelClass}>
        Max redemptions (blank = unlimited)
        <input className={input} type="number" min={1} value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} placeholder="e.g. 100" />
      </label>
      <label className={labelClass}>
        Expires (optional)
        <input className={input} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </label>
      <div className="sm:col-span-2 lg:col-span-3">
        {error ? <p className={errorNotice}>{error}</p> : null}
        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? "Creating..." : "Create code"}
        </button>
      </div>
    </form>
  );
}

function RedemptionsList({ promoId }: { promoId: string }) {
  const [rows, setRows] = useState<PromoCodeRedemptionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPromoCodeRedemptions(promoId)
      .then((res) => setRows(res.redemptions))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load redemptions."));
  }, [promoId]);

  if (error) return <p className="text-[11px] font-semibold text-rose-700">{error}</p>;
  if (!rows) return <p className="text-[11px] font-semibold text-slate-500">Loading...</p>;
  if (rows.length === 0) return <p className="text-[11px] font-semibold text-slate-500">Nobody has redeemed this code yet.</p>;

  return (
    <ul className="grid gap-1 text-[11px] font-semibold text-slate-600">
      {rows.map((r) => (
        <li key={`${r.teacher_id}-${r.redeemed_at}`}>
          {r.teacher_id} — {r.redeemed_at ? new Date(r.redeemed_at).toLocaleString() : "unknown time"}
        </li>
      ))}
    </ul>
  );
}

function CodeRow({ code, onToggled }: { code: PromoCode; onToggled: (updated: PromoCode) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.setPromoCodeActive(code.id, !code.is_active);
      onToggled(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr>
        <td className={td}>
          <p className="font-mono text-sm font-black text-slate-950">{code.code}</p>
          {code.label ? <p className="text-[11px] font-semibold text-slate-500">{code.label}</p> : null}
        </td>
        <td className={td}>
          {code.plan_label}
          <p className="text-[11px] font-semibold text-slate-500">{code.discount_percent}% off</p>
        </td>
        <td className={td}>
          <p className="text-sm font-black text-slate-950">
            {code.redemption_count} / {code.max_redemptions ?? "∞"}
          </p>
          <p className="text-[11px] font-semibold text-slate-500">
            {code.redemptions_remaining === null ? "unlimited remaining" : `${code.redemptions_remaining} remaining`}
          </p>
          <button type="button" className="mt-1 text-[11px] font-extrabold text-purple-700 underline" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide who redeemed" : "Who redeemed?"}
          </button>
          {expanded ? (
            <div className="mt-1">
              <RedemptionsList promoId={code.id} />
            </div>
          ) : null}
        </td>
        <td className={td}>{code.expires_at ? new Date(code.expires_at).toLocaleDateString() : "No expiry"}</td>
        <td className={td}>
          <StatusBadge code={code} />
        </td>
        <td className={td}>
          <button type="button" className={secondaryButton} disabled={busy} onClick={toggle}>
            {busy ? "..." : code.is_active ? "Turn off" : "Turn on"}
          </button>
          {error ? <p className="mt-1 text-[11px] font-semibold text-rose-700">{error}</p> : null}
        </td>
      </tr>
    </>
  );
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[] | null>(null);
  const [planOptions, setPlanOptions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getPromoCodes()
      .then((res) => {
        setCodes(res.codes);
        setPlanOptions(res.plan_options);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load promo codes."))
      .finally(() => setLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((v) => v + 1)), []);
  useEffect(() => {
    load();
  }, [refreshTick]);

  const activeCount = codes?.filter((c) => c.is_redeemable).length ?? 0;
  const totalRedemptions = codes?.reduce((sum, c) => sum + c.redemption_count, 0) ?? 0;

  return (
    <AppShell title="Promo Codes">
      <section className={panel}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Coupon codes</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Issue and track plan-upgrade codes</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Create a code, pick the plan it grants, cap how many people can redeem it, and set an optional expiry —
          it goes live immediately, no deploy needed. A redeemed code instantly changes that teacher&apos;s plan,
          the same mechanism the mock-billing tools already use. Every count below is live from the database.
        </p>
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}

        {!loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Active codes" value={activeCount} />
            <StatCard label="Total codes" value={codes?.length ?? 0} />
            <StatCard label="Total redemptions" value={totalRedemptions} />
          </div>
        ) : null}

        <div className="mt-6 border-t border-violet-100 pt-5">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Create a code</p>
          {!loading ? <CreateCodeForm planOptions={planOptions} onCreated={load} /> : null}
        </div>

        <div className="mt-6 border-t border-violet-100 pt-4">
          {!loading && codes && codes.length === 0 ? <p className={notice}>No promo codes yet — create one above.</p> : null}
          {!loading && codes && codes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Code</th>
                    <th className={th}>Plan</th>
                    <th className={th}>Redemptions</th>
                    <th className={th}>Expires</th>
                    <th className={th}>Status</th>
                    <th className={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <CodeRow
                      key={c.id}
                      code={c}
                      onToggled={(updated) => setCodes((prev) => (prev ? prev.map((row) => (row.id === updated.id ? updated : row)) : prev))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
