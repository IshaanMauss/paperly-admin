import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, label as labelClass, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh, requestAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type PlanOffer } from "@/lib/apiClient";

// Time-limited offers (2026-10-02): pick a plan, a discount, how long each person's
// countdown runs and who sees it. The countdown is real - it starts per person the first
// time they see the offer and the discount really stops at checkout when it ends. Yearly
// users are never shown an offer. See app/models/offer.py in the backend.

const STYLE_LABELS: Record<string, string> = { shiny: "Shiny gold", starry: "Starry night", plain: "Plain" };

function OfferPreview({ plan, discount, hours, style, title }: { plan: string; discount: number; hours: number; style: string; title: string }) {
  return (
    <div className={`offer-card offer-card--${style} max-w-sm`}>
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200">Limited-time offer</p>
      <p className="mt-1 text-lg font-extrabold">{title || `${plan} at ${discount}% off`}</p>
      <p className="mt-1 text-sm font-semibold text-white/85">
        {discount}% off {plan}. Ends in {hours} hour{hours === 1 ? "" : "s"} from when you first see it.
      </p>
      <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold tabular-nums">{String(hours).padStart(2, "0")}:00:00 left</p>
    </div>
  );
}

function CreateOfferForm({ options, onCreated }: { options: { plans: Record<string, string>; audience: Record<string, string>; styles: string[] }; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [planCode, setPlanCode] = useState(Object.keys(options.plans).includes("teacher_yearly") ? "teacher_yearly" : Object.keys(options.plans)[0]);
  const [discount, setDiscount] = useState("40");
  const [hours, setHours] = useState("12");
  const [audience, setAudience] = useState<string[]>(Object.keys(options.audience));
  const [style, setStyle] = useState("shiny");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAudience(code: string) {
    setAudience((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createOffer({
        label: title,
        plan_code: planCode,
        discount_percent: Number(discount) || 0,
        duration_hours: Number(hours) || 0,
        audience_plans: audience,
        style,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      });
      setTitle("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this offer.");
    } finally {
      setBusy(false);
    }
  }

  const planName = options.plans[planCode] || planCode;
  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Offer name (shown to people)
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Festive Yearly offer" required maxLength={200} />
        </label>
        <label className={labelClass}>
          Plan on offer
          <select className={input} value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
            {Object.entries(options.plans).map(([value, name]) => (
              <option key={value} value={value}>{name}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Discount % (1 to 90)
          <input className={input} type="number" min={1} max={90} value={discount} onChange={(e) => setDiscount(e.target.value)} required />
        </label>
        <label className={labelClass}>
          Countdown (hours, from when each person first sees it)
          <input className={input} type="number" min={1} max={720} value={hours} onChange={(e) => setHours(e.target.value)} required />
        </label>
        <label className={labelClass}>
          Card style
          <select className={input} value={style} onChange={(e) => setStyle(e.target.value)}>
            {options.styles.map((value) => (
              <option key={value} value={value}>{STYLE_LABELS[value] || value}</option>
            ))}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-extrabold text-slate-700">Who sees it (Yearly users never do)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {Object.entries(options.audience).map(([code, name]) => (
              <label key={code} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={audience.includes(code)} onChange={() => toggleAudience(code)} />
                {name} users
              </label>
            ))}
          </div>
        </fieldset>
        <label className={labelClass}>
          Campaign starts (optional)
          <input className={input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </label>
        <label className={labelClass}>
          Campaign ends (optional)
          <input className={input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          {error ? <p className={errorNotice}>{error}</p> : null}
          <button type="submit" className={primaryButton} disabled={busy}>{busy ? "Creating..." : "Create offer"}</button>
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Preview</p>
        <OfferPreview plan={planName} discount={Number(discount) || 0} hours={Number(hours) || 0} style={style} title={title} />
      </div>
    </form>
  );
}

function StatusBadge({ offer }: { offer: PlanOffer }) {
  if (!offer.is_active) return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">Off</span>;
  if (!offer.is_live) return <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800">Outside its dates</span>;
  return <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800">Live</span>;
}

function OfferRow({ offer, audienceNames, onToggled }: { offer: PlanOffer; audienceNames: Record<string, string>; onToggled: (updated: PlanOffer) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      onToggled(await api.setOfferActive(offer.id, !offer.is_active));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this offer.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <tr>
      <td className={td}>
        <p className="text-sm font-extrabold text-slate-950">{offer.label}</p>
        <p className="text-[11px] font-semibold text-slate-500">{STYLE_LABELS[offer.style] || offer.style} card</p>
      </td>
      <td className={td}>
        {offer.plan_label}
        <p className="text-[11px] font-semibold text-slate-500">{offer.discount_percent}% off, {offer.duration_hours} h countdown</p>
      </td>
      <td className={td}>{offer.audience_plans.map((code) => audienceNames[code] || code).join(", ")}</td>
      <td className={td}>
        <p className="text-sm font-extrabold text-slate-950">{offer.shown_count ?? 0} unique people saw it</p>
        <p className="text-[11px] font-semibold text-slate-500">{offer.redeemed_count ?? 0} unique people bought</p>
      </td>
      <td className={td}>
        <StatusBadge offer={offer} />
        {offer.ends_at ? <p className="mt-1 text-[11px] font-semibold text-slate-500">Ends {new Date(offer.ends_at).toLocaleString()}</p> : null}
      </td>
      <td className={td}>
        <button type="button" className={secondaryButton} disabled={busy} onClick={toggle}>{busy ? "..." : offer.is_active ? "Turn off" : "Turn on"}</button>
        {error ? <p className="mt-1 text-[11px] font-semibold text-rose-700">{error}</p> : null}
      </td>
    </tr>
  );
}

export default function OffersPage() {
  const [offers, setOffers] = useState<PlanOffer[] | null>(null);
  const [options, setOptions] = useState<{ plans: Record<string, string>; audience: Record<string, string>; styles: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getOffers()
      .then((res) => {
        setOffers(res.offers);
        setOptions(res.options);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load offers."))
      .finally(() => setLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    load();
  }, [tick]);

  return (
    <AppShell title="Offers">
      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-800">Time-limited offers</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-950">Run a discount with a real countdown</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Pick a plan and a discount, choose how many hours each person has, and who sees it. Eligible people get a
          popup with the countdown, the plan card on their Billing page changes look, and checkout charges the
          discounted price. The countdown starts when each person first sees the offer; when it ends the price really
          goes back to normal. People on Yearly never see an offer, and an offer can be used once per person.
        </p>
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!loading && options ? (
          <div className="mt-6 border-t border-violet-200 pt-5">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Create an offer</p>
            <CreateOfferForm options={options} onCreated={() => { load(); requestAdminDataRefresh(); }} />
          </div>
        ) : null}
        <div className="mt-6 border-t border-violet-200 pt-4">
          {!loading && offers && offers.length === 0 ? <p className={notice}>No offers yet — create one above. (If this stays empty after creating, the offers tables may not be set up on the database yet.)</p> : null}
          {!loading && offers && offers.length > 0 && options ? (
            <div className="overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr>
                    <th className={th}>Offer</th>
                    <th className={th}>Plan and discount</th>
                    <th className={th}>Shown to</th>
                    <th className={th}>Results</th>
                    <th className={th}>Status</th>
                    <th className={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((offer) => (
                    <OfferRow
                      key={offer.id}
                      offer={offer}
                      audienceNames={options.audience}
                      onToggled={(updated) => { setOffers((prev) => (prev ? prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)) : prev)); requestAdminDataRefresh(); }}
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
